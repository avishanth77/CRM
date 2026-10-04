import uuid
from decimal import Decimal
from datetime import timedelta
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.core.exceptions import ValidationError, PermissionDenied
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()

from apps.opportunities.models import (
    Opportunity, OpportunityProduct, OpportunityModule,
    OpportunityCapability, OpportunityType, OpportunityStatus,
    Proposal, ProposalVersion, ProposalItem,
    ApprovalRule, ApprovalRuleType, ProposalStatus
)
from apps.sales_handoff.models import SQLHandoff, HandoffStatus
from apps.pld_engine.models import PipelineType, PipelineStage
from apps.audit_logging.models import AuditLog, AuditAction
from apps.workflows.models import StageHistory, Approval, ApprovalType, ApprovalStatus
from apps.activities.models import Activity, ActivityType
from apps.accounts.models import AccountType


class OpportunityService:
    """
    Manages Opportunity creation from accepted SQL handoffs, data carry-forward,
    product/module relationships, commercial field validation, and stage transitions.
    """
    @classmethod
    def create_from_accepted_sql(cls, handoff, user=None, owner=None):
        """
        Creates a new Opportunity strictly from an ACCEPTED SQL handoff.
        Carries forward all evaluation, technical discovery, and commercial context.
        Prevents duplicate creation for the same handoff.
        """
        if handoff.status != HandoffStatus.ACCEPTED:
            raise ValidationError(f"Opportunity creation blocked: SQL Handoff must have status 'ACCEPTED' (current status: '{handoff.status}').")

        # Prevent duplicate opportunity creation
        existing_opp = Opportunity.objects.filter(sql_handoff=handoff).first()
        if existing_opp:
            raise ValidationError(f"An Opportunity (#{str(existing_opp.id)[:8]}) has already been created for this SQL Handoff.")

        lead = handoff.lead
        product = handoff.product

        # Resolve initial opportunity stage from published pipeline configuration
        config = product.configurations.filter(status='PUBLISHED').first() or product.configurations.first()
        initial_stage = None
        if config:
            initial_stage = config.stages.filter(pipeline_type=PipelineType.OPPORTUNITY).order_by('sequence_order').first()

        # Extract carried-forward technical and evaluation details
        latest_assessment = lead.assessments.filter(product=product).order_by('-assessed_at').first()
        latest_discovery = lead.discoveries.first()
        latest_demo = lead.demos.filter(status='COMPLETED').first()
        latest_poc = lead.pocs.filter(status='COMPLETED').first()

        # Decision Maker resolution
        dm_str = None
        if lead.contact:
            role_disp = lead.contact.get_role_type_display() if hasattr(lead.contact, 'get_role_type_display') else lead.contact.role_type
            dm_str = f"{lead.contact.first_name} {lead.contact.last_name or ''} ({role_disp})".strip()
        elif latest_discovery:
            dm_sh = latest_discovery.stakeholders.filter(decision_role__in=['DECISION_MAKER', 'ECONOMIC_BUYER']).first()
            if dm_sh:
                dm_str = f"{dm_sh.contact.first_name} {dm_sh.contact.last_name or ''} ({dm_sh.get_decision_role_display()})".strip()

        # Implementation Scope & ERP System
        impl_scope = ""
        if latest_poc and latest_poc.scope_description:
            impl_scope = latest_poc.scope_description
        elif latest_discovery and latest_discovery.business_impact_summary:
            impl_scope = latest_discovery.business_impact_summary

        erp_str = None
        if lead.account:
            erp_attr = lead.account.custom_attributes.filter(attribute_key__in=['primary_erp', 'erp_system', 'erp']).first()
            if erp_attr:
                erp_str = str(erp_attr.attribute_value)

        # POC Result Summary
        poc_summary_str = None
        if latest_poc:
            poc_summary_str = latest_poc.results_summary or f"Completed pilot across {latest_poc.users_count} users"
        elif latest_demo:
            poc_summary_str = f"Demo Completed: {latest_demo.fit_assessment} fit with {latest_demo.use_cases.count()} demonstrated capabilities"

        # Commercial Values
        val = handoff.estimated_value or lead.estimated_opportunity_value or Decimal('0.00')
        contract_term = 12
        arr_val = val
        mrr_val = (val / Decimal('12')).quantize(Decimal('0.01')) if contract_term == 12 else Decimal('0.00')

        opp = Opportunity.objects.create(
            account=lead.account,
            primary_contact=lead.contact,
            owner=owner or handoff.assigned_sales_owner or user,
            sql_handoff=handoff,
            opportunity_type=OpportunityType.NEW,
            stage=initial_stage,
            status=OpportunityStatus.OPEN,
            product=product,
            total_contract_value=val,
            arr=arr_val,
            mrr=mrr_val,
            arr_mrr=val,
            pricing_plan="Enterprise Annual Subscription",
            seat_units_count=getattr(latest_poc, 'users_count', 15) if latest_poc else 15,
            contract_term_months=contract_term,
            currency=handoff.currency or 'USD',
            probability_pct=50,
            expected_close_date=timezone.now().date() + timedelta(days=60),
            pld_score=latest_assessment.pld_score if latest_assessment else Decimal('85.00'),
            sql_date=timezone.now().date(),
            decision_maker=dm_str,
            implementation_scope=impl_scope,
            erp_system=erp_str or "SAP S/4HANA Cloud",
            integration_requirements="REST API & Webhooks connector for ERP auto-synchronization",
            poc_result=poc_summary_str,
            next_action_description=lead.next_action_description or "Present formal commercial proposal and pricing schedule",
            next_activity_due_at=timezone.now() + timedelta(days=3),
            tenant=lead.tenant
        )

        # Auto-create OpportunityProduct line item
        OpportunityProduct.objects.create(
            opportunity=opp,
            product=product,
            quantity=1,
            unit_price=val,
            total_amount=val,
            term_months=contract_term,
            tenant=lead.tenant
        )

        # Auto-populate OpportunityModule & OpportunityCapability from mapped Discovery & Demo capabilities
        if latest_discovery:
            for dp in latest_discovery.problems.all():
                for pm in dp.capability_mappings.all():
                    cap = pm.capability
                    if cap:
                        if not OpportunityCapability.objects.filter(opportunity=opp, capability=cap).exists():
                            OpportunityCapability.objects.create(
                                opportunity=opp,
                                capability=cap,
                                tenant=lead.tenant
                            )
                        if cap.module:
                            if not OpportunityModule.objects.filter(opportunity=opp, module=cap.module).exists():
                                OpportunityModule.objects.create(
                                    opportunity=opp,
                                    module=cap.module,
                                    is_included=True,
                                    notes=f"Mapped to problem: {dp.problem.name if dp.problem else 'Problem'}",
                                    tenant=lead.tenant
                                )

        # Record Stage History
        if initial_stage:
            StageHistory.objects.create(
                record_type='OPPORTUNITY',
                record_id=opp.id,
                from_stage=None,
                to_stage=initial_stage,
                transition_reason=f"Opportunity created from accepted SQL Handoff #{str(handoff.id)[:8]}",
                changed_by=user,
                tenant=lead.tenant
            )

        # Universal Audit Log
        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.CREATE,
            entity_type='Opportunity',
            entity_id=opp.id,
            changes_json={
                "account": opp.account.company_name,
                "product": product.name,
                "total_contract_value": str(val),
                "sql_handoff": str(handoff.id)
            }
        )

        return opp

    @classmethod
    def transition_stage(cls, opportunity, target_stage, reason=None, user=None):
        """
        Transitions Opportunity to a new stage in the commercial pipeline.
        Enforces explanatory reason if moving backward.
        """
        if not target_stage:
            raise ValidationError("Target stage is required.")

        from_stage = opportunity.stage
        is_backward = False
        if from_stage and target_stage.sequence_order < from_stage.sequence_order:
            is_backward = True
            if not reason or not reason.strip():
                raise ValidationError("Reason is mandatory when moving an opportunity backward in the pipeline.")

        opportunity.stage = target_stage
        opportunity.save(update_fields=['stage'])

        # Record Stage History
        StageHistory.objects.create(
            record_type='OPPORTUNITY',
            record_id=opportunity.id,
            from_stage=from_stage,
            to_stage=target_stage,
            transition_reason=reason or f"Transitioned to {target_stage.stage_name}",
            is_override=is_backward,
            changed_by=user,
            tenant=opportunity.tenant
        )

        # Universal Audit Log
        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.UPDATE,
            entity_type='Opportunity',
            entity_id=opportunity.id,
            changes_json={
                "from_stage": from_stage.stage_name if from_stage else None,
                "to_stage": target_stage.stage_name,
                "is_backward": is_backward,
                "reason": reason
            }
        )

        return opportunity

    @classmethod
    def transition_to_negotiation(cls, opportunity, user=None, reason=""):
        return ProposalService.transition_to_negotiation(opportunity, user=user, reason=reason)

    @classmethod
    def update_commercial_fields(cls, opportunity, data, user=None):
        """
        Updates and validates commercial values on the Opportunity.
        Logs audit changes for all updated commercial parameters.
        """
        changes = {}
        fields_to_update = []

        if 'total_contract_value' in data:
            new_val = Decimal(str(data['total_contract_value']))
            if new_val < 0:
                raise ValidationError("Total contract value cannot be negative.")
            if opportunity.total_contract_value != new_val:
                changes['total_contract_value'] = {'old': str(opportunity.total_contract_value), 'new': str(new_val)}
                opportunity.total_contract_value = new_val
                fields_to_update.append('total_contract_value')

        if 'arr' in data:
            new_arr = Decimal(str(data['arr']))
            if opportunity.arr != new_arr:
                changes['arr'] = {'old': str(opportunity.arr), 'new': str(new_arr)}
                opportunity.arr = new_arr
                fields_to_update.append('arr')

        if 'mrr' in data:
            new_mrr = Decimal(str(data['mrr']))
            if opportunity.mrr != new_mrr:
                changes['mrr'] = {'old': str(opportunity.mrr), 'new': str(new_mrr)}
                opportunity.mrr = new_mrr
                fields_to_update.append('mrr')

        if 'pricing_plan' in data and data['pricing_plan']:
            if opportunity.pricing_plan != data['pricing_plan']:
                changes['pricing_plan'] = {'old': opportunity.pricing_plan, 'new': data['pricing_plan']}
                opportunity.pricing_plan = data['pricing_plan']
                fields_to_update.append('pricing_plan')

        if 'seat_units_count' in data:
            new_seats = int(data['seat_units_count'])
            if opportunity.seat_units_count != new_seats:
                changes['seat_units_count'] = {'old': opportunity.seat_units_count, 'new': new_seats}
                opportunity.seat_units_count = new_seats
                fields_to_update.append('seat_units_count')

        if 'contract_term_months' in data:
            new_term = int(data['contract_term_months'])
            if opportunity.contract_term_months != new_term:
                changes['contract_term_months'] = {'old': opportunity.contract_term_months, 'new': new_term}
                opportunity.contract_term_months = new_term
                fields_to_update.append('contract_term_months')

        if 'probability_pct' in data:
            new_prob = int(data['probability_pct'])
            if opportunity.probability_pct != new_prob:
                changes['probability_pct'] = {'old': opportunity.probability_pct, 'new': new_prob}
                opportunity.probability_pct = new_prob
                fields_to_update.append('probability_pct')

        if 'expected_close_date' in data and data['expected_close_date']:
            opportunity.expected_close_date = data['expected_close_date']
            fields_to_update.append('expected_close_date')

        if 'next_action_description' in data and data['next_action_description']:
            opportunity.next_action_description = data['next_action_description']
            fields_to_update.append('next_action_description')

        if 'next_activity_due_at' in data and data['next_activity_due_at']:
            opportunity.next_activity_due_at = data['next_activity_due_at']
            fields_to_update.append('next_activity_due_at')

        if fields_to_update:
            opportunity.save(update_fields=fields_to_update)

            if changes:
                AuditLog.objects.create(
                    actor=user,
                    actor_email=user.email if user else "system@texol.sa",
                    actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
                    action=AuditAction.UPDATE,
                    entity_type='Opportunity',
                    entity_id=opportunity.id,
                    changes_json=changes
                )

        return opportunity


class ProposalService:
    """
    Commercial Proposal / Quote Service implementing:
    - Versioned Proposals (Proposal -> ProposalVersion -> ProposalItem -> Approval)
    - Dynamic Pricing calculation with safe Decimal arithmetic
    - Configurable Approval Rules evaluation (Discount %, Total Value, Commercial Exceptions)
    - Approval Requests and Decisions (Approve / Reject with mandatory reason)
    - Version Creation (V1 -> V2 -> V3) preserving immutable historical data
    - Proposal Expiry verification
    - Proposal Sending with validation (blocked if unapproved when required, or expired)
    - Negotiation stage management and Activity tracking with mandatory next actions
    - Universal AuditLog and StageHistory tracking
    """

    @classmethod
    def check_approval_required(cls, proposal_version):
        """
        Evaluates active approval rules for this proposal version.
        Checks discount percentage threshold, total value threshold, and exceptions.
        Returns: (requires_approval: bool, triggering_rule: ApprovalRule or None, reason: str)
        """
        product = proposal_version.proposal.product
        active_rules = ApprovalRule.objects.filter(is_active=True).filter(
            Q(product=product) | Q(product__isnull=True)
        ).order_by('approval_sequence', '-created_at')

        if active_rules.exists():
            for rule in active_rules:
                if rule.rule_type == ApprovalRuleType.DISCOUNT_PERCENT:
                    if proposal_version.discount_pct >= rule.threshold_value:
                        return True, rule, f"Discount of {proposal_version.discount_pct}% meets or exceeds approval threshold ({rule.threshold_value}%)."
                elif rule.rule_type == ApprovalRuleType.TOTAL_VALUE:
                    if proposal_version.net_amount >= rule.threshold_value:
                        return True, rule, f"Total contract value {proposal_version.net_amount} meets or exceeds approval threshold ({rule.threshold_value})."
                elif rule.rule_type in [ApprovalRuleType.PRICING_EXCEPTION, ApprovalRuleType.COMMERCIAL_EXCEPTION]:
                    if proposal_version.discount_pct > 0 or proposal_version.contract_term_months > 24:
                        return True, rule, f"Commercial term exception triggered under rule '{rule.rule_name}'."
        else:
            # Default fallback governance: discount >= 15% requires approval
            if proposal_version.discount_pct >= Decimal('15.00'):
                return True, None, f"Discount of {proposal_version.discount_pct}% exceeds default threshold (15%)."

        return False, None, ""

    @classmethod
    @transaction.atomic
    def create_proposal(cls, opportunity, data=None, user=None):
        """
        Creates a new versioned Proposal envelope and ProposalVersion 1.
        Preserves opportunity relationships and carries forward commercial context.
        """
        if not opportunity:
            raise ValidationError("Opportunity is mandatory to create a commercial Proposal.")

        data = data or {}
        currency = data.get('currency', opportunity.currency or 'USD')
        valid_from = data.get('valid_from', timezone.now().date())
        valid_until = data.get('valid_until', timezone.now().date() + timedelta(days=30))
        if isinstance(valid_until, str):
            from datetime import datetime
            valid_until = datetime.strptime(valid_until, '%Y-%m-%d').date()
        if isinstance(valid_from, str):
            from datetime import datetime
            valid_from = datetime.strptime(valid_from, '%Y-%m-%d').date()

        if valid_until and valid_from and valid_until <= valid_from:
            raise ValidationError("Proposal expiry date (valid_until) must be after valid_from date.")

        discount_pct = Decimal(str(data.get('discount_pct', 0.00)))
        discount_reason = data.get('discount_reason', '')
        tax_pct = Decimal(str(data.get('tax_pct', 0.00)))
        contract_term_months = int(data.get('contract_term_months', opportunity.contract_term_months or 12))
        payment_terms = data.get('payment_terms', 'Net 30 Days')
        title = data.get('title', f"Proposal for {opportunity.account.company_name}")
        notes = data.get('notes', '')

        import random
        proposal_number = data.get('proposal_number') or f"PROP-{timezone.now().year}-{random.randint(1000, 9999)}"

        proposal = Proposal.objects.create(
            opportunity=opportunity,
            account=opportunity.account,
            primary_contact=opportunity.primary_contact,
            product=opportunity.product,
            proposal_number=proposal_number,
            title=title,
            owner=user or opportunity.owner,
            version_number=1,
            status=ProposalStatus.DRAFT,
            currency=currency,
            valid_from=valid_from,
            valid_until=valid_until,
            contract_term_months=contract_term_months,
            payment_terms=payment_terms,
            discount_pct=discount_pct,
            discount_reason=discount_reason,
            tax_pct=tax_pct,
            notes=notes
        )

        version = ProposalVersion.objects.create(
            proposal=proposal,
            version_number=1,
            status=ProposalStatus.DRAFT,
            currency=currency,
            valid_from=valid_from,
            valid_until=valid_until,
            contract_term_months=contract_term_months,
            payment_terms=payment_terms,
            discount_pct=discount_pct,
            discount_reason=discount_reason,
            tax_pct=tax_pct,
            created_by=user,
            notes=notes
        )

        # Create Line Items
        items_data = data.get('items')
        if items_data and len(items_data) > 0:
            for item in items_data:
                prod_id = item.get('product') or (opportunity.product.id if opportunity.product else None)
                from apps.products.models import Product, ProductModule, ProductCapability
                prod = Product.objects.get(id=prod_id) if prod_id else opportunity.product
                mod = ProductModule.objects.filter(id=item.get('module')).first() if item.get('module') else None
                cap = ProductCapability.objects.filter(id=item.get('capability')).first() if item.get('capability') else None
                
                qty = int(item.get('quantity', 1))
                unit_pr = Decimal(str(item.get('unit_price', 0.00)))
                it_disc_pct = Decimal(str(item.get('discount_pct', 0.00)))
                
                p_item = ProposalItem(
                    proposal_version=version,
                    product=prod,
                    module=mod,
                    capability=cap,
                    description=item.get('description', prod.name if prod else 'Commercial Module'),
                    quantity=qty,
                    unit_price=unit_pr,
                    discount_pct=it_disc_pct
                )
                p_item.calculate_line_total()
                p_item.save()
        elif opportunity.product:
            unit_price = opportunity.total_contract_value if opportunity.total_contract_value > 0 else Decimal('50000.00')
            p_item = ProposalItem(
                proposal_version=version,
                product=opportunity.product,
                description=f"{opportunity.product.name} Enterprise Subscription",
                quantity=opportunity.seat_units_count or 1,
                unit_price=unit_price,
                discount_pct=Decimal('0.00')
            )
            p_item.calculate_line_total()
            p_item.save()

        # Recalculate totals
        gross = sum(i.line_total for i in version.items.all())
        if discount_pct > 0:
            disc_amt = (gross * (discount_pct / Decimal('100'))).quantize(Decimal('0.01'))
        else:
            disc_amt = Decimal(str(data.get('discount_amount', '0.00'))).quantize(Decimal('0.01'))
        tax_amt = (((gross - disc_amt) * (tax_pct / Decimal('100')))).quantize(Decimal('0.01'))
        net = max(Decimal('0.00'), (gross - disc_amt + tax_amt)).quantize(Decimal('0.01'))

        version.gross_amount = gross
        version.discount_amount = disc_amt
        version.tax_amount = tax_amt
        version.net_amount = net

        # Check approval requirement
        req_approval, rule, reason = cls.check_approval_required(version)
        if req_approval:
            version.approval_required_flag = True
            version.status = ProposalStatus.PENDING_APPROVAL
            approval = Approval.objects.create(
                record_type='PROPOSAL_VERSION',
                record_id=version.id,
                approval_type=ApprovalType.DISCOUNT_EXCEPTION if (rule and rule.rule_type == ApprovalRuleType.DISCOUNT_PERCENT) else ApprovalType.PROPOSAL_APPROVAL,
                requested_by=user or opportunity.owner,
                status=ApprovalStatus.PENDING,
                justification_notes=reason
            )
            version.approval_request = approval
        else:
            version.approval_required_flag = False
            version.status = ProposalStatus.APPROVED

        version.save()

        # Sync Proposal header
        proposal.gross_amount = version.gross_amount
        proposal.discount_pct = version.discount_pct
        proposal.discount_amount = version.discount_amount
        proposal.tax_pct = version.tax_pct
        proposal.tax_amount = version.tax_amount
        proposal.net_amount = version.net_amount
        proposal.status = version.status
        proposal.approval_required_flag = version.approval_required_flag
        proposal.save()

        # Audit
        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.PROPOSAL_CREATE,
            entity_type='Proposal',
            entity_id=proposal.id,
            changes_json={
                'proposal_number': proposal.proposal_number,
                'version': 1,
                'gross': str(gross),
                'discount_pct': str(discount_pct),
                'net_amount': str(net),
                'status': proposal.status,
                'approval_required': version.approval_required_flag
            }
        )

        return proposal

    @classmethod
    @transaction.atomic
    def create_new_version(cls, proposal, data=None, user=None):
        """
        Creates a new immutable version (e.g. Version 2, Version 3) for a Proposal.
        Preserves the previous version intact and marks it SUPERSEDED if appropriate.
        Evaluates independent approval rules for the new version.
        """
        data = data or {}
        latest_version = proposal.versions.order_by('-version_number').first()
        new_version_num = (latest_version.version_number + 1) if latest_version else (proposal.version_number + 1)

        if latest_version and latest_version.status not in [ProposalStatus.SENT, ProposalStatus.ACCEPTED]:
            latest_version.status = ProposalStatus.SUPERSEDED
            latest_version.save(update_fields=['status'])

        currency = data.get('currency', latest_version.currency if latest_version else proposal.currency)
        valid_from = data.get('valid_from', timezone.now().date())
        valid_until = data.get('valid_until', latest_version.valid_until if latest_version else (timezone.now().date() + timedelta(days=30)))
        if isinstance(valid_until, str):
            from datetime import datetime
            valid_until = datetime.strptime(valid_until, '%Y-%m-%d').date()
        if isinstance(valid_from, str):
            from datetime import datetime
            valid_from = datetime.strptime(valid_from, '%Y-%m-%d').date()

        discount_pct = Decimal(str(data.get('discount_pct', latest_version.discount_pct if latest_version else Decimal('0.00'))))
        discount_reason = data.get('discount_reason', latest_version.discount_reason if latest_version else '')
        tax_pct = Decimal(str(data.get('tax_pct', latest_version.tax_pct if latest_version else Decimal('0.00'))))
        contract_term_months = int(data.get('contract_term_months', latest_version.contract_term_months if latest_version else 12))
        payment_terms = data.get('payment_terms', latest_version.payment_terms if latest_version else 'Net 30 Days')
        notes = data.get('notes', latest_version.notes if latest_version else '')

        new_version = ProposalVersion.objects.create(
            proposal=proposal,
            version_number=new_version_num,
            status=ProposalStatus.DRAFT,
            currency=currency,
            valid_from=valid_from,
            valid_until=valid_until,
            contract_term_months=contract_term_months,
            payment_terms=payment_terms,
            discount_pct=discount_pct,
            discount_reason=discount_reason,
            tax_pct=tax_pct,
            created_by=user,
            notes=notes
        )

        if 'items' in data and data['items']:
            from apps.products.models import Product, ProductModule, ProductCapability
            for item in data['items']:
                prod = Product.objects.get(id=item.get('product')) if item.get('product') else proposal.product
                mod = ProductModule.objects.filter(id=item.get('module')).first() if item.get('module') else None
                cap = ProductCapability.objects.filter(id=item.get('capability')).first() if item.get('capability') else None
                p_item = ProposalItem(
                    proposal_version=new_version,
                    product=prod,
                    module=mod,
                    capability=cap,
                    description=item.get('description', prod.name if prod else 'Line Item'),
                    quantity=int(item.get('quantity', 1)),
                    unit_price=Decimal(str(item.get('unit_price', 0.00))),
                    discount_pct=Decimal(str(item.get('discount_pct', 0.00)))
                )
                p_item.calculate_line_total()
                p_item.save()
        elif latest_version and latest_version.items.exists():
            for it in latest_version.items.all():
                ProposalItem.objects.create(
                    proposal_version=new_version,
                    product=it.product,
                    module=it.module,
                    capability=it.capability,
                    description=it.description,
                    quantity=it.quantity,
                    unit_price=it.unit_price,
                    discount_pct=it.discount_pct,
                    discount_amount=it.discount_amount,
                    line_total=it.line_total
                )

        gross = sum(i.line_total for i in new_version.items.all())
        if discount_pct > 0:
            disc_amt = (gross * (discount_pct / Decimal('100'))).quantize(Decimal('0.01'))
        else:
            disc_amt = Decimal(str(data.get('discount_amount', '0.00'))).quantize(Decimal('0.01'))
        tax_amt = (((gross - disc_amt) * (tax_pct / Decimal('100')))).quantize(Decimal('0.01'))
        net = max(Decimal('0.00'), (gross - disc_amt + tax_amt)).quantize(Decimal('0.01'))

        new_version.gross_amount = gross
        new_version.discount_amount = disc_amt
        new_version.tax_amount = tax_amt
        new_version.net_amount = net

        req_approval, rule, reason = cls.check_approval_required(new_version)
        if req_approval:
            new_version.approval_required_flag = True
            new_version.status = ProposalStatus.PENDING_APPROVAL
            approval = Approval.objects.create(
                record_type='PROPOSAL_VERSION',
                record_id=new_version.id,
                approval_type=ApprovalType.DISCOUNT_EXCEPTION if (rule and rule.rule_type == ApprovalRuleType.DISCOUNT_PERCENT) else ApprovalType.PROPOSAL_APPROVAL,
                requested_by=user or proposal.owner,
                status=ApprovalStatus.PENDING,
                justification_notes=reason
            )
            new_version.approval_request = approval
        else:
            new_version.approval_required_flag = False
            new_version.status = ProposalStatus.APPROVED

        new_version.save()

        proposal.version_number = new_version_num
        proposal.gross_amount = new_version.gross_amount
        proposal.discount_pct = new_version.discount_pct
        proposal.discount_amount = new_version.discount_amount
        proposal.tax_pct = new_version.tax_pct
        proposal.tax_amount = new_version.tax_amount
        proposal.net_amount = new_version.net_amount
        proposal.status = new_version.status
        proposal.approval_required_flag = new_version.approval_required_flag
        proposal.save()

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.PROPOSAL_VERSION,
            entity_type='Proposal',
            entity_id=proposal.id,
            changes_json={
                'proposal_number': proposal.proposal_number,
                'new_version': new_version_num,
                'net_amount': str(net),
                'discount_pct': str(discount_pct),
                'status': proposal.status,
                'approval_required': new_version.approval_required_flag
            }
        )

        return new_version

    @classmethod
    def request_approval(cls, proposal_version, reason="", user=None):
        """
        Manually requests or re-requests approval for a proposal version.
        """
        proposal = proposal_version.proposal
        approval = Approval.objects.create(
            record_type='PROPOSAL_VERSION',
            record_id=proposal_version.id,
            approval_type=ApprovalType.PROPOSAL_APPROVAL,
            requested_by=user or proposal.owner,
            status=ApprovalStatus.PENDING,
            justification_notes=reason or "Commercial approval requested by sales representative."
        )
        proposal_version.approval_request = approval
        proposal_version.approval_required_flag = True
        proposal_version.status = ProposalStatus.PENDING_APPROVAL
        proposal_version.save(update_fields=['approval_request', 'approval_required_flag', 'status'])

        proposal.status = ProposalStatus.PENDING_APPROVAL
        proposal.approval_required_flag = True
        proposal.save(update_fields=['status', 'approval_required_flag'])

        return proposal_version

    @classmethod
    @transaction.atomic
    def approve_proposal(cls, proposal_version, user, comments=""):
        """
        Approves a proposal version. Enforces RBAC permissions.
        """
        is_approver = (
            user.is_superuser or
            user.is_staff or
            getattr(user, 'role', '') in ['ADMIN', 'SALES_MANAGER', 'VP_SALES', 'FINANCE_HEAD']
        )
        if not is_approver:
            raise PermissionDenied("Unauthorized: Only Sales Management or System Administrators can approve commercial proposals.")

        approval = proposal_version.approval_request
        if approval:
            approval.status = ApprovalStatus.APPROVED
            approval.approver = user
            approval.decision_date = timezone.now()
            approval.decision_notes = comments
            approval.save()

        proposal_version.status = ProposalStatus.APPROVED
        proposal_version.approved_at = timezone.now()
        proposal_version.save(update_fields=['status', 'approved_at'])

        proposal = proposal_version.proposal
        if proposal.version_number == proposal_version.version_number:
            proposal.status = ProposalStatus.APPROVED
            proposal.approved_at = timezone.now()
            proposal.save(update_fields=['status', 'approved_at'])

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email,
            actor_role=getattr(user, 'role', 'MANAGER'),
            action=AuditAction.PROPOSAL_APPROVE,
            entity_type='ProposalVersion',
            entity_id=proposal_version.id,
            changes_json={
                'proposal_number': proposal.proposal_number,
                'version': proposal_version.version_number,
                'decision': 'APPROVED',
                'comments': comments
            }
        )

        return proposal_version

    @classmethod
    @transaction.atomic
    def reject_proposal(cls, proposal_version, user, rejection_reason):
        """
        Rejects a proposal version. Requires a mandatory documented rejection reason.
        """
        if not rejection_reason or not rejection_reason.strip():
            raise ValidationError("Rejection reason is mandatory when declining proposal approval.")

        is_approver = (
            user.is_superuser or
            user.is_staff or
            getattr(user, 'role', '') in ['ADMIN', 'SALES_MANAGER', 'VP_SALES', 'FINANCE_HEAD']
        )
        if not is_approver:
            raise PermissionDenied("Unauthorized: Only Sales Management or System Administrators can reject commercial proposals.")

        approval = proposal_version.approval_request
        if approval:
            approval.status = ApprovalStatus.REJECTED
            approval.approver = user
            approval.decision_date = timezone.now()
            approval.decision_notes = rejection_reason
            approval.save()

        proposal_version.status = ProposalStatus.REJECTED
        proposal_version.rejected_at = timezone.now()
        proposal_version.save(update_fields=['status', 'rejected_at'])

        proposal = proposal_version.proposal
        if proposal.version_number == proposal_version.version_number:
            proposal.status = ProposalStatus.REJECTED
            proposal.rejected_at = timezone.now()
            proposal.save(update_fields=['status', 'rejected_at'])

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email,
            actor_role=getattr(user, 'role', 'MANAGER'),
            action=AuditAction.PROPOSAL_REJECT,
            entity_type='ProposalVersion',
            entity_id=proposal_version.id,
            changes_json={
                'proposal_number': proposal.proposal_number,
                'version': proposal_version.version_number,
                'decision': 'REJECTED',
                'rejection_reason': rejection_reason
            }
        )

        return proposal_version

    @classmethod
    @transaction.atomic
    def send_proposal(cls, proposal_version, user, recipient_email=None, next_action_description=None, next_action_due_at=None):
        """
        Sends a proposal version to the customer.
        Strict validation:
        1. Blocked if expired.
        2. Blocked if approval is required and status != APPROVED.
        3. Blocked if net_amount <= 0.
        Records Activity, advances Opportunity stage, and updates commercial fields.
        """
        if proposal_version.is_expired():
            raise ValidationError("Cannot send an expired proposal. Create a new version with an updated validity date.")

        if proposal_version.approval_required_flag and proposal_version.status != ProposalStatus.APPROVED:
            raise ValidationError(f"Proposal cannot be sent: Management approval is required (current status: '{proposal_version.status}').")

        if proposal_version.net_amount <= 0:
            raise ValidationError("Proposal must have a valid positive total amount before sending.")

        proposal = proposal_version.proposal
        opportunity = proposal.opportunity
        recipient = recipient_email or (proposal.primary_contact.email if proposal.primary_contact else f"procurement@{opportunity.account.company_name.lower().replace(' ', '')}.com")

        now = timezone.now()
        proposal_version.status = ProposalStatus.SENT
        proposal_version.sent_at = now
        proposal_version.sent_by = user
        proposal_version.sent_to = recipient
        proposal_version.save(update_fields=['status', 'sent_at', 'sent_by', 'sent_to'])

        proposal.status = ProposalStatus.SENT
        proposal.sent_at = now
        proposal.sent_by = user
        proposal.sent_to = recipient
        proposal.save(update_fields=['status', 'sent_at', 'sent_by', 'sent_to'])

        opportunity.total_contract_value = proposal_version.net_amount
        opportunity.arr = proposal_version.net_amount
        opportunity.mrr = (proposal_version.net_amount / Decimal('12')).quantize(Decimal('0.01'))
        opportunity.contract_term_months = proposal_version.contract_term_months

        prop_stage = PipelineStage.objects.filter(stage_code__in=['OPP_PROPOSAL', 'PROPOSAL']).first()
        if prop_stage and (not opportunity.stage or opportunity.stage.stage_code not in ['OPP_PROPOSAL', 'NEGOTIATION', 'OPP_NEGOTIATION']):
            OpportunityService.transition_stage(
                opportunity=opportunity,
                target_stage=prop_stage,
                reason=f"Commercial Proposal {proposal.proposal_number} v{proposal_version.version_number} sent to client.",
                user=user
            )
        else:
            opportunity.save(update_fields=['total_contract_value', 'arr', 'mrr', 'contract_term_months'])

        action_desc = next_action_description or "Commercial proposal review with client economic buyer"
        due_at = next_action_due_at or (now + timedelta(days=3))
        Activity.objects.create(
            opportunity=opportunity,
            account=opportunity.account,
            contact=opportunity.primary_contact,
            proposal=proposal,
            activity_type=ActivityType.PROPOSAL_SENT,
            subject=f"Commercial Proposal {proposal.proposal_number} v{proposal_version.version_number} Sent to {recipient}",
            outcome_notes=f"Delivered proposal v{proposal_version.version_number}. Total: {proposal_version.net_amount} {proposal_version.currency}. Discount: {proposal_version.discount_pct}%.",
            next_action_description=action_desc,
            next_action_due_at=due_at
        )

        opportunity.last_activity_at = now
        opportunity.next_action_description = action_desc
        opportunity.next_activity_due_at = due_at
        opportunity.save(update_fields=['last_activity_at', 'next_action_description', 'next_activity_due_at'])

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SALES_REP') if user else "SYSTEM",
            action=AuditAction.PROPOSAL_SEND,
            entity_type='ProposalVersion',
            entity_id=proposal_version.id,
            changes_json={
                'proposal_number': proposal.proposal_number,
                'version': proposal_version.version_number,
                'recipient': recipient,
                'amount': str(proposal_version.net_amount),
                'status': 'SENT'
            }
        )

        return proposal_version

    @classmethod
    @transaction.atomic
    def mark_expired(cls, proposal_version, user=None):
        """
        Marks a proposal version (and proposal if active) as EXPIRED.
        """
        proposal = proposal_version.proposal
        proposal_version.status = ProposalStatus.EXPIRED
        proposal_version.save(update_fields=['status'])

        if proposal.version_number == proposal_version.version_number:
            proposal.status = ProposalStatus.EXPIRED
            proposal.save(update_fields=['status'])

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.UPDATE,
            entity_type='ProposalVersion',
            entity_id=proposal_version.id,
            changes_json={
                'proposal_number': proposal.proposal_number,
                'version': proposal_version.version_number,
                'status': 'EXPIRED'
            }
        )
        return proposal_version

    @classmethod
    @transaction.atomic
    def transition_to_negotiation(cls, opportunity, user=None, reason=""):
        """
        Advances Opportunity to the Negotiation stage.
        """
        nego_stage = PipelineStage.objects.filter(stage_code__in=['OPP_NEGOTIATION', 'NEGOTIATION']).first()
        if not nego_stage:
            from apps.pld_engine.models import ProductConfigurationVersion
            cfg = None
            if opportunity.product:
                cfg = opportunity.product.configurations.filter(status='PUBLISHED').first() or opportunity.product.configurations.first()
            if not cfg:
                cfg = ProductConfigurationVersion.objects.first()
            nego_stage = PipelineStage.objects.create(
                config_version=cfg,
                stage_code='OPP_NEGOTIATION',
                stage_name='Commercial Negotiation',
                pipeline_type=PipelineType.OPPORTUNITY,
                sequence_order=60
            )

        return OpportunityService.transition_stage(
            opportunity=opportunity,
            target_stage=nego_stage,
            reason=reason or "Entering commercial negotiation on proposal terms.",
            user=user
        )

    @classmethod
    @transaction.atomic
    def mark_opportunity_won(cls, opportunity, final_proposal=None, user=None):
        """
        Closes opportunity as WON and converts Account to CUSTOMER.
        """
        won_stage = PipelineStage.objects.filter(stage_code__in=['OPP_CLOSED_WON', 'CLOSED_WON', 'WON']).first()
        if not won_stage:
            from apps.pld_engine.models import ProductConfigurationVersion
            cfg = None
            if opportunity.product:
                cfg = opportunity.product.configurations.filter(status='PUBLISHED').first() or opportunity.product.configurations.first()
            if not cfg:
                cfg = ProductConfigurationVersion.objects.first()
            won_stage = PipelineStage.objects.create(
                config_version=cfg,
                stage_code='OPP_CLOSED_WON',
                stage_name='Closed Won',
                pipeline_type=PipelineType.OPPORTUNITY,
                sequence_order=100
            )

        opportunity.status = OpportunityStatus.WON
        opportunity.expected_close_date = timezone.now().date()
        if final_proposal:
            opportunity.total_contract_value = final_proposal.net_amount
            final_proposal.status = ProposalStatus.ACCEPTED
            final_proposal.save(update_fields=['status'])
        opportunity.save(update_fields=['status', 'expected_close_date', 'total_contract_value'])

        opportunity.account.account_type = AccountType.CUSTOMER
        opportunity.account.save(update_fields=['account_type'])

        return OpportunityService.transition_stage(
            opportunity=opportunity,
            target_stage=won_stage,
            reason="Deal successfully closed won.",
            user=user
        )

    @classmethod
    @transaction.atomic
    def mark_opportunity_lost(cls, opportunity, loss_reason_category, loss_reason_notes="", competitor="", user=None):
        """
        Closes opportunity as LOST with mandatory loss analysis fields.
        """
        if not loss_reason_category:
            raise ValidationError("Loss reason category is required when closing an opportunity as lost.")

        lost_stage = PipelineStage.objects.filter(stage_code__in=['OPP_CLOSED_LOST', 'CLOSED_LOST', 'LOST']).first()
        if not lost_stage:
            from apps.pld_engine.models import ProductConfigurationVersion
            cfg = None
            if opportunity.product:
                cfg = opportunity.product.configurations.filter(status='PUBLISHED').first() or opportunity.product.configurations.first()
            if not cfg:
                cfg = ProductConfigurationVersion.objects.first()
            lost_stage = PipelineStage.objects.create(
                config_version=cfg,
                stage_code='OPP_CLOSED_LOST',
                stage_name='Closed Lost',
                pipeline_type=PipelineType.OPPORTUNITY,
                sequence_order=99
            )

        opportunity.status = OpportunityStatus.LOST
        opportunity.loss_reason_category = loss_reason_category
        opportunity.loss_reason_notes = loss_reason_notes
        opportunity.competitor = competitor
        opportunity.expected_close_date = timezone.now().date()
        opportunity.save(update_fields=['status', 'loss_reason_category', 'loss_reason_notes', 'competitor', 'expected_close_date'])

        return OpportunityService.transition_stage(
            opportunity=opportunity,
            target_stage=lost_stage,
            reason=f"Deal lost: {loss_reason_category}. {loss_reason_notes}".strip(),
            user=user
        )
