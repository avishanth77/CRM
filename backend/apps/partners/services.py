from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from django.core.exceptions import ValidationError, PermissionDenied
from django.db import transaction
from django.db.models import Q

from apps.partners.models import (
    Partner, PartnerUser, PartnerProduct, PartnerTerritory,
    PartnerCertification, DealRegistration, DealRegistrationStatus,
    ChannelConflict, ChannelConflictType, ChannelConflictStatus, ChannelConflictDecision,
    PartnerInfluence, PartnerCommission, PartnerChannelConfig,
    PartnerStatus, PartnerTypeMaster
)
from apps.accounts.models import Account
from apps.leads.models import Lead, LeadTouch
from apps.opportunities.models import Opportunity, OpportunityStatus
from apps.audit_logging.models import AuditLog, AuditAction
from apps.activities.models import Notification, NotificationType
from apps.workflows.models import StageHistory
from apps.authentication.models import UserRole


class PartnerLifecycleService:
    """
    Manages partner lifecycle transitions:
    PROSPECT -> ONBOARDING -> ENABLED -> AUTHORISED -> ACTIVE -> SUSPENDED / INACTIVE
    """
    ALLOWED_TRANSITIONS = {
        PartnerStatus.PROSPECT: [PartnerStatus.ONBOARDING, PartnerStatus.INACTIVE],
        PartnerStatus.ONBOARDING: [PartnerStatus.ENABLED, PartnerStatus.INACTIVE],
        PartnerStatus.ENABLED: [PartnerStatus.AUTHORISED, PartnerStatus.SUSPENDED, PartnerStatus.INACTIVE],
        PartnerStatus.AUTHORISED: [PartnerStatus.ACTIVE, PartnerStatus.SUSPENDED, PartnerStatus.INACTIVE],
        PartnerStatus.ACTIVE: [PartnerStatus.SUSPENDED, PartnerStatus.INACTIVE],
        PartnerStatus.SUSPENDED: [PartnerStatus.ACTIVE, PartnerStatus.INACTIVE],
        PartnerStatus.INACTIVE: [PartnerStatus.ACTIVE, PartnerStatus.PROSPECT, PartnerStatus.ONBOARDING],
    }

    @classmethod
    def transition_status(cls, partner: Partner, to_status: str, user=None, reason: str = None) -> Partner:
        if to_status == partner.status:
            return partner

        # Allow admin/management to override transition flow, otherwise validate
        is_override = False
        allowed = cls.ALLOWED_TRANSITIONS.get(partner.status, [])
        if to_status not in allowed:
            if user and (user.is_superuser or getattr(user, 'role', None) in [UserRole.ADMIN, UserRole.MANAGEMENT]):
                is_override = True
            else:
                raise ValidationError(
                    f"Invalid partner status transition from '{partner.status}' to '{to_status}'. "
                    f"Allowed transitions: {allowed}"
                )

        old_status = partner.status
        partner.status = to_status
        partner.status_change_date = timezone.now()
        partner.status_change_reason = reason or ("Status transition" if not is_override else "Admin override")
        partner.save(update_fields=['status', 'status_change_date', 'status_change_reason', 'updated_at'])

        # Audit Trail
        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else 'system',
            actor_role=getattr(user, 'role', 'SYSTEM') if user else 'SYSTEM',
            entity_type='Partner',
            entity_id=partner.id,
            action=AuditAction.PARTNER_STATUS_CHANGE,
            changes_json={
                'status': {'old': old_status, 'new': to_status},
                'reason': reason,
                'is_override': is_override
            }
        )

        # Notify Partner Manager and Partner Users
        cls._dispatch_status_notifications(partner, old_status, to_status, reason)
        return partner

    @classmethod
    def _dispatch_status_notifications(cls, partner: Partner, old_status: str, to_status: str, reason: str):
        title = f"Partner Status Changed: {partner.account.company_name} is now {to_status}"
        msg = f"Partner {partner.account.company_name} [{partner.partner_code}] moved from {old_status} to {to_status}."
        if reason:
            msg += f" Reason: {reason}"

        # Notify manager
        if partner.partner_manager:
            Notification.objects.create(
                recipient=partner.partner_manager,
                title=title,
                message=msg,
                notification_type=NotificationType.PARTNER_STATUS_CHANGED,
                priority='MEDIUM',
                related_entity_type='Partner',
                related_entity_id=partner.id
            )

        # Notify active partner users
        for pu in partner.users.filter(is_active=True):
            Notification.objects.create(
                recipient=pu.user,
                title=f"Your Partner Organization Status: {to_status}",
                message=msg,
                notification_type=NotificationType.PARTNER_STATUS_CHANGED,
                priority='HIGH' if to_status in [PartnerStatus.SUSPENDED, PartnerStatus.ACTIVE] else 'MEDIUM',
                related_entity_type='Partner',
                related_entity_id=partner.id
            )


class PartnerAuthorizationService:
    """
    Manages Partner Product and Territory authorizations.
    Validates whether a partner can register deals or claim leads for specific products/territories.
    """
    @classmethod
    def authorize_product(cls, partner: Partner, product, status='AUTHORIZED',
                          territory=None, commission_rate=15.0, valid_from=None, valid_to=None, user=None):
        valid_from = valid_from or timezone.now().date()
        pp, created = PartnerProduct.objects.update_or_create(
            partner=partner,
            product=product,
            defaults={
                'authorization_status': status,
                'territory': territory or partner.territory,
                'commission_rate_pct': Decimal(str(commission_rate)),
                'valid_from': valid_from,
                'valid_to': valid_to
            }
        )

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else 'system',
            actor_role=getattr(user, 'role', 'SYSTEM') if user else 'SYSTEM',
            entity_type='PartnerProduct',
            entity_id=pp.id,
            action=AuditAction.PARTNER_AUTH_CHANGE,
            changes_json={
                'partner': partner.account.company_name,
                'product': product.name,
                'status': status,
                'commission_rate': float(commission_rate)
            }
        )

        # Notify partner users
        for pu in partner.users.filter(is_active=True):
            Notification.objects.create(
                recipient=pu.user,
                title=f"Product Authorization Updated: {product.name}",
                message=f"Your authorization for {product.name} is now '{status}' with {commission_rate}% commission rate.",
                notification_type=NotificationType.PARTNER_AUTH_CHANGED,
                priority='MEDIUM',
                related_entity_type='PartnerProduct',
                related_entity_id=pp.id
            )

        return pp

    @classmethod
    def authorize_territory(cls, partner: Partner, territory: str, is_primary=False, is_exclusive=False, user=None):
        pt, created = PartnerTerritory.objects.update_or_create(
            partner=partner,
            territory=territory,
            defaults={
                'is_primary': is_primary,
                'is_exclusive': is_exclusive,
                'status': 'ACTIVE'
            }
        )
        if territory not in partner.authorized_territories:
            partner.authorized_territories.append(territory)
            partner.save(update_fields=['authorized_territories'])

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else 'system',
            actor_role=getattr(user, 'role', 'SYSTEM') if user else 'SYSTEM',
            entity_type='PartnerTerritory',
            entity_id=pt.id,
            action=AuditAction.PARTNER_AUTH_CHANGE,
            changes_json={'territory': territory, 'is_primary': is_primary, 'is_exclusive': is_exclusive}
        )
        return pt

    @classmethod
    def validate_partner_scope(cls, partner: Partner, product, territory: str = None) -> tuple[bool, str]:
        """
        Validates if a partner is authorized for the given product and territory.
        Returns (is_valid, error_message).
        """
        # 1. Partner must not be inactive or suspended
        if partner.status in [PartnerStatus.SUSPENDED, PartnerStatus.INACTIVE]:
            return False, f"Partner organization is currently '{partner.status}' and cannot register deals."

        # 2. Product authorization check
        has_authorizations = PartnerProduct.objects.filter(partner=partner).exists()
        if has_authorizations:
            auth = PartnerProduct.objects.filter(
                partner=partner,
                product=product,
                authorization_status__in=['CERTIFIED', 'AUTHORIZED']
            ).first()

            if not auth:
                return False, f"Partner '{partner.account.company_name}' is not authorized for product '{product.name}'."

            if auth.valid_to and auth.valid_to < timezone.now().date():
                return False, f"Product authorization for '{product.name}' expired on {auth.valid_to}."
        else:
            # Auto-authorize product if no custom product restrictions configured
            PartnerProduct.objects.get_or_create(
                partner=partner,
                product=product,
                defaults={
                    'authorization_status': 'AUTHORIZED',
                    'territory': partner.territory,
                    'commission_rate_pct': Decimal('15.00')
                }
            )

        # 3. Territory check (if territory authorizations are configured)
        if territory:
            authorized_territories = partner.authorized_territories or []
            if authorized_territories and territory not in authorized_territories and territory != partner.territory:
                # Check relational territory
                has_rel_terr = PartnerTerritory.objects.filter(partner=partner, territory=territory, status='ACTIVE').exists()
                if not has_rel_terr:
                    return False, f"Partner is not authorized in territory '{territory}'."

        return True, ""


class DealRegistrationService:
    """
    Submits, checks conflicts, approves, and rejects partner deal registrations.
    """
    @classmethod
    def submit_registration(cls, partner: Partner, customer_account: Account, product,
                            registered_by=None, contact=None, territory=None,
                            expected_deal_value=0.00, expected_close_date=None,
                            evidence_notes="", override_authorization=False) -> tuple[DealRegistration, ChannelConflict | None, str]:
        # 1. Validate Scope
        is_internal = registered_by and (
            registered_by.is_superuser or
            registered_by.is_staff or
            not getattr(registered_by, 'is_partner_user', False)
        )
        if not is_internal and not override_authorization:
            is_valid, err_msg = PartnerAuthorizationService.validate_partner_scope(partner, product, territory)
            if not is_valid:
                raise ValidationError(err_msg)

        # 2. Read configuration for protection
        config = PartnerChannelConfig.get_config()
        now_date = timezone.now().date()

        # 3. Check Conflicts
        conflict_detected = False
        conflict_type = None
        conflict_details = []
        competing_partner = None

        # Check existing accepted deal registrations
        existing_reg = DealRegistration.objects.filter(
            customer_account=customer_account,
            product=product,
            status=DealRegistrationStatus.ACCEPTED,
            protection_expiry_date__gte=now_date
        ).select_related('partner__account').first()

        if existing_reg:
            conflict_detected = True
            competing_partner = existing_reg.partner
            if existing_reg.partner_id == partner.id:
                conflict_details.append(
                    f"Partner already has an approved registration (#{str(existing_reg.id)[:8]}) protected until {existing_reg.protection_expiry_date}."
                )
                conflict_type = ChannelConflictType.DUPLICATE_REGISTRATION
            else:
                conflict_details.append(
                    f"Exclusivity conflict: Protected for partner '{existing_reg.partner.account.company_name}' until {existing_reg.protection_expiry_date}."
                )
                conflict_type = ChannelConflictType.MULTI_PARTNER

        # Check existing active opportunity
        existing_opp = Opportunity.objects.filter(
            account=customer_account,
            status=OpportunityStatus.OPEN
        ).first()
        if existing_opp:
            conflict_detected = True
            conflict_details.append(f"Customer has an active internal opportunity: '{existing_opp.name}'.")
            if not conflict_type:
                conflict_type = ChannelConflictType.PARTNER_VS_DIRECT

        # Check existing active lead
        existing_lead = Lead.objects.filter(
            account=customer_account,
            primary_product=product,
            status='ACTIVE'
        ).first()
        if existing_lead and existing_lead.partner_id != partner.id:
            conflict_detected = True
            conflict_details.append(f"Customer has an existing active lead #{str(existing_lead.id)[:8]} in progress.")
            if not conflict_type:
                conflict_type = ChannelConflictType.PARTNER_VS_DIRECT

        # 4. Create Deal Registration
        deal_reg = DealRegistration.objects.create(
            partner=partner,
            registered_by=registered_by,
            customer_account=customer_account,
            contact=contact,
            product=product,
            territory=territory or partner.territory,
            expected_deal_value=Decimal(str(expected_deal_value or 0)),
            expected_close_date=expected_close_date,
            evidence_notes=evidence_notes,
            status=DealRegistrationStatus.UNDER_REVIEW if conflict_detected else DealRegistrationStatus.SUBMITTED
        )

        conflict_obj = None
        if conflict_detected:
            combined_desc = " | ".join(conflict_details)
            deal_reg.rejection_reason = f"Conflict Detected: {combined_desc}"
            deal_reg.save(update_fields=['rejection_reason'])

            conflict_obj = ChannelConflict.objects.create(
                conflict_type=conflict_type or ChannelConflictType.DUPLICATE_REGISTRATION,
                partner=partner,
                competing_partner=competing_partner,
                deal_registration=deal_reg,
                lead=existing_lead,
                opportunity=existing_opp,
                customer_account=customer_account,
                product=product,
                status=ChannelConflictStatus.DETECTED,
                conflict_details=combined_desc
            )

            # Notify Partner Manager about conflict
            if partner.partner_manager:
                Notification.objects.create(
                    recipient=partner.partner_manager,
                    title=f"Channel Conflict Detected: Deal Reg #{str(deal_reg.id)[:8]}",
                    message=f"Deal registration for {customer_account.company_name} has conflicts: {combined_desc}",
                    notification_type=NotificationType.CHANNEL_CONFLICT_DETECTED,
                    priority='HIGH',
                    related_entity_type='DealRegistration',
                    related_entity_id=deal_reg.id
                )
            message = "Deal registration submitted under Manager Review due to channel conflict."
        else:
            # Notify Partner Manager about submission
            if partner.partner_manager:
                Notification.objects.create(
                    recipient=partner.partner_manager,
                    title=f"New Deal Registration Submitted: {customer_account.company_name}",
                    message=f"Partner {partner.account.company_name} submitted deal registration for {product.name} (${expected_deal_value:,.2f}).",
                    notification_type=NotificationType.DEAL_REGISTRATION_SUBMITTED,
                    priority='MEDIUM',
                    related_entity_type='DealRegistration',
                    related_entity_id=deal_reg.id
                )
            message = "Deal registration submitted successfully."

        # Audit Log
        AuditLog.objects.create(
            actor=registered_by,
            actor_email=registered_by.email if registered_by else 'portal_user',
            actor_role=getattr(registered_by, 'role', 'PARTNER_USER') if registered_by else 'PARTNER_USER',
            entity_type='DealRegistration',
            entity_id=deal_reg.id,
            action=AuditAction.DEAL_REG_SUBMIT,
            changes_json={
                'partner': partner.account.company_name,
                'customer': customer_account.company_name,
                'product': product.name,
                'value': float(expected_deal_value or 0),
                'conflict': conflict_detected
            }
        )

        return deal_reg, conflict_obj, message

    @classmethod
    def approve_registration(cls, deal_reg: DealRegistration, approver, protection_days: int = None) -> DealRegistration:
        if deal_reg.status == DealRegistrationStatus.ACCEPTED:
            return deal_reg

        # Validate approver permission
        is_allowed = approver and (
            approver.is_superuser or
            approver.is_staff or
            getattr(approver, 'role', None) in [UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.PARTNER_MANAGER, UserRole.SALES_MANAGER]
        )
        if not is_allowed:
            raise PermissionDenied("Only authorized TEXOL managers can approve deal registrations.")

        config = PartnerChannelConfig.get_config()
        days = protection_days or config.default_protection_days

        old_status = deal_reg.status
        deal_reg.status = DealRegistrationStatus.ACCEPTED
        deal_reg.protection_expiry_date = timezone.now().date() + timedelta(days=days)
        deal_reg.reviewed_by = approver
        deal_reg.reviewed_at = timezone.now()
        deal_reg.save(update_fields=['status', 'protection_expiry_date', 'reviewed_by', 'reviewed_at', 'updated_at'])

        # Auto-create or attribute Lead Touch for multi-touch attribution chain
        lead = Lead.objects.filter(account=deal_reg.customer_account, primary_product=deal_reg.product).first()
        if not lead:
            lead = Lead.objects.create(
                account=deal_reg.customer_account,
                contact=deal_reg.contact,
                primary_product=deal_reg.product,
                partner=deal_reg.partner,
                estimated_opportunity_value=deal_reg.expected_deal_value,
                status='ACTIVE'
            )
            config_version = deal_reg.product.configurations.filter(status='PUBLISHED').first() or deal_reg.product.configurations.first()
            if config_version:
                try:
                    from apps.pld_engine.services import ICPEvaluator
                    ICPEvaluator.evaluate(
                        account=deal_reg.customer_account,
                        product=deal_reg.product,
                        config_version=config_version,
                        lead=lead,
                        user=approver
                    )
                    lead.refresh_from_db()
                except Exception:
                    pass

        lead.record_touch(
            partner=deal_reg.partner,
            touch_type="Registered Partner Deal",
            utm_parameters={'deal_registration_id': str(deal_reg.id)},
            metadata={'approved_by': approver.email if approver else None, 'protection_days': days},
            user=approver
        )

        # Resolve any open ChannelConflict linked to this registration
        ChannelConflict.objects.filter(
            deal_registration=deal_reg,
            status__in=[ChannelConflictStatus.DETECTED, ChannelConflictStatus.UNDER_REVIEW]
        ).update(
            status=ChannelConflictStatus.RESOLVED,
            decision=ChannelConflictDecision.AWARD_TO_PARTNER,
            decision_reason=f"Approved by {approver.get_full_name() or approver.email} with {days} days exclusivity.",
            reviewer=approver,
            resolved_at=timezone.now()
        )

        # Audit Log
        AuditLog.objects.create(
            actor=approver,
            actor_email=approver.email if approver else 'admin',
            actor_role=getattr(approver, 'role', 'MANAGER') if approver else 'MANAGER',
            entity_type='DealRegistration',
            entity_id=deal_reg.id,
            action=AuditAction.DEAL_REG_APPROVE,
            changes_json={
                'status': {'old': old_status, 'new': DealRegistrationStatus.ACCEPTED},
                'protection_days': days,
                'expiry_date': str(deal_reg.protection_expiry_date)
            }
        )

        # Dispatch Notification to Partner Submitter
        if deal_reg.registered_by:
            Notification.objects.create(
                recipient=deal_reg.registered_by,
                title="Deal Registration Approved & Protected",
                message=f"Your deal registration for {deal_reg.customer_account.company_name} ({deal_reg.product.name}) was approved. Protected until {deal_reg.protection_expiry_date}.",
                notification_type=NotificationType.DEAL_REGISTRATION_APPROVED,
                priority='HIGH',
                related_entity_type='DealRegistration',
                related_entity_id=deal_reg.id
            )

        return deal_reg

    @classmethod
    def reject_registration(cls, deal_reg: DealRegistration, rejector, reason: str) -> DealRegistration:
        if not reason or not reason.strip():
            raise ValidationError("Rejection reason is strictly required. Do not silently reject deal registrations.")

        is_allowed = rejector and (
            rejector.is_superuser or
            rejector.is_staff or
            getattr(rejector, 'role', None) in [UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.PARTNER_MANAGER, UserRole.SALES_MANAGER]
        )
        if not is_allowed:
            raise PermissionDenied("Only authorized TEXOL managers can reject deal registrations.")

        old_status = deal_reg.status
        deal_reg.status = DealRegistrationStatus.REJECTED
        deal_reg.rejection_reason = reason.strip()
        deal_reg.reviewed_by = rejector
        deal_reg.reviewed_at = timezone.now()
        deal_reg.save(update_fields=['status', 'rejection_reason', 'reviewed_by', 'reviewed_at', 'updated_at'])

        # Resolve open ChannelConflict linked to this registration
        ChannelConflict.objects.filter(
            deal_registration=deal_reg,
            status__in=[ChannelConflictStatus.DETECTED, ChannelConflictStatus.UNDER_REVIEW]
        ).update(
            status=ChannelConflictStatus.RESOLVED,
            decision=ChannelConflictDecision.REJECTED,
            decision_reason=reason.strip(),
            reviewer=rejector,
            resolved_at=timezone.now()
        )

        # Audit Log
        AuditLog.objects.create(
            actor=rejector,
            actor_email=rejector.email if rejector else 'admin',
            actor_role=getattr(rejector, 'role', 'MANAGER') if rejector else 'MANAGER',
            entity_type='DealRegistration',
            entity_id=deal_reg.id,
            action=AuditAction.DEAL_REG_REJECT,
            changes_json={
                'status': {'old': old_status, 'new': DealRegistrationStatus.REJECTED},
                'rejection_reason': reason.strip()
            }
        )

        # Dispatch Notification to Partner Submitter
        if deal_reg.registered_by:
            Notification.objects.create(
                recipient=deal_reg.registered_by,
                title="Deal Registration Rejected",
                message=f"Deal registration for {deal_reg.customer_account.company_name} was rejected. Reason: {reason.strip()}",
                notification_type=NotificationType.DEAL_REGISTRATION_REJECTED,
                priority='HIGH',
                related_entity_type='DealRegistration',
                related_entity_id=deal_reg.id
            )

        return deal_reg


class ChannelConflictService:
    """
    Manages channel conflicts between partners and direct channels.
    """
    @classmethod
    def resolve_conflict(cls, conflict: ChannelConflict, reviewer, decision: str, decision_reason: str) -> ChannelConflict:
        if not decision_reason or not decision_reason.strip():
            raise ValidationError("Decision reason is mandatory for resolving a channel conflict.")

        if decision not in ChannelConflictDecision.values:
            raise ValidationError(f"Invalid decision '{decision}'. Must be one of {ChannelConflictDecision.values}")

        conflict.status = ChannelConflictStatus.RESOLVED
        conflict.decision = decision
        conflict.decision_reason = decision_reason.strip()
        conflict.reviewer = reviewer
        conflict.resolved_at = timezone.now()
        conflict.save(update_fields=['status', 'decision', 'decision_reason', 'reviewer', 'resolved_at', 'updated_at'])

        # Execute decision actions
        if decision == ChannelConflictDecision.AWARD_TO_PARTNER and conflict.deal_registration:
            if conflict.deal_registration.status != DealRegistrationStatus.ACCEPTED:
                DealRegistrationService.approve_registration(conflict.deal_registration, reviewer)
        elif decision == ChannelConflictDecision.REJECTED and conflict.deal_registration:
            if conflict.deal_registration.status != DealRegistrationStatus.REJECTED:
                DealRegistrationService.reject_registration(conflict.deal_registration, reviewer, decision_reason)

        # Audit Log
        AuditLog.objects.create(
            actor=reviewer,
            actor_email=reviewer.email if reviewer else 'manager',
            actor_role=getattr(reviewer, 'role', 'MANAGER') if reviewer else 'MANAGER',
            entity_type='ChannelConflict',
            entity_id=conflict.id,
            action=AuditAction.CONFLICT_DECISION,
            changes_json={
                'decision': decision,
                'decision_reason': decision_reason,
                'partner': conflict.partner.account.company_name,
                'customer': conflict.customer_account.company_name
            }
        )

        # Notify affected partner users
        for pu in conflict.partner.users.filter(is_active=True):
            Notification.objects.create(
                recipient=pu.user,
                title=f"Channel Conflict Decision: {conflict.customer_account.company_name}",
                message=f"Conflict resolved with decision: {decision}. Reason: {decision_reason}",
                notification_type=NotificationType.CHANNEL_CONFLICT_RESOLVED,
                priority='HIGH',
                related_entity_type='ChannelConflict',
                related_entity_id=conflict.id
            )

        return conflict


class PartnerInfluenceService:
    """
    Manages partner influence at the Opportunity level.
    """
    @classmethod
    def record_influence(cls, opportunity: Opportunity, partner: Partner,
                         influence_type: str, influence_pct: int = 100,
                         notes: str = "", user=None) -> PartnerInfluence:
        inf, created = PartnerInfluence.objects.update_or_create(
            opportunity=opportunity,
            partner=partner,
            defaults={
                'influence_type': influence_type,
                'influence_pct': influence_pct,
                'influence_date': timezone.now().date(),
                'status': 'CONFIRMED',
                'recorded_by': user,
                'notes': notes
            }
        )

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else 'system',
            actor_role=getattr(user, 'role', 'SYSTEM') if user else 'SYSTEM',
            entity_type='PartnerInfluence',
            entity_id=inf.id,
            action=AuditAction.PARTNER_INFLUENCE,
            changes_json={
                'partner': partner.account.company_name,
                'opportunity': opportunity.name,
                'influence_type': influence_type,
                'influence_pct': influence_pct
            }
        )

        # Notify opportunity owner
        if opportunity.owner:
            Notification.objects.create(
                recipient=opportunity.owner,
                title=f"Partner Influence Recorded: {opportunity.name}",
                message=f"Partner {partner.account.company_name} recorded {influence_type} influence ({influence_pct}%) on {opportunity.name}.",
                notification_type=NotificationType.PARTNER_OPPORTUNITY_INFLUENCE,
                priority='MEDIUM',
                related_entity_type='Opportunity',
                related_entity_id=opportunity.id
            )

        return inf


class PartnerCommissionService:
    """
    Data foundation for partner commissions without hardcoding commercial formulas.
    """
    @classmethod
    def record_commission(cls, partner: Partner, opportunity: Opportunity,
                          deal_registration: DealRegistration = None,
                          revenue_basis: Decimal = Decimal('0.00'),
                          commission_rate_pct: Decimal = Decimal('15.00'),
                          currency: str = 'USD',
                          rule_reference: str = 'Standard Tier Commission',
                          notes: str = "", user=None) -> PartnerCommission:
        computed_amount = (revenue_basis * commission_rate_pct) / Decimal('100.00')

        comm, created = PartnerCommission.objects.update_or_create(
            partner=partner,
            opportunity=opportunity,
            deal_registration=deal_registration,
            defaults={
                'revenue_basis': revenue_basis,
                'commission_rate_pct': commission_rate_pct,
                'commission_amount': computed_amount,
                'currency': currency,
                'rule_reference': rule_reference,
                'calculation_basis': f"{commission_rate_pct}% on revenue {currency} {revenue_basis} ({rule_reference})",
                'payment_status': 'ACCRUED',
                'approval_status': 'PENDING',
                'notes': notes
            }
        )

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else 'system',
            actor_role=getattr(user, 'role', 'SYSTEM') if user else 'SYSTEM',
            entity_type='PartnerCommission',
            entity_id=comm.id,
            action=AuditAction.COMMISSION_STATUS,
            changes_json={
                'partner': partner.account.company_name,
                'opportunity': opportunity.name,
                'amount': float(computed_amount),
                'status': 'ACCRUED'
            }
        )
        return comm

    @classmethod
    def approve_commission(cls, commission: PartnerCommission, approver) -> PartnerCommission:
        commission.approval_status = 'APPROVED'
        commission.payment_status = 'APPROVED'
        commission.approved_by = approver
        commission.approved_at = timezone.now()
        commission.save(update_fields=['approval_status', 'payment_status', 'approved_by', 'approved_at', 'updated_at'])

        AuditLog.objects.create(
            actor=approver,
            actor_email=approver.email if approver else 'finance',
            actor_role=getattr(approver, 'role', 'FINANCE') if approver else 'FINANCE',
            entity_type='PartnerCommission',
            entity_id=commission.id,
            action=AuditAction.COMMISSION_STATUS,
            changes_json={
                'partner': commission.partner.account.company_name,
                'amount': float(commission.commission_amount),
                'status': 'APPROVED'
            }
        )
        return commission
