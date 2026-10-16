import logging
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

logger = logging.getLogger(__name__)
from apps.leads.models import Lead, LeadProductInterest, LeadTouch, LeadProblem, LeadSource, Campaign
from apps.leads.serializers import (
    LeadSerializer, LeadProductInterestSerializer,
    LeadTouchSerializer, LeadProblemSerializer,
    LeadSourceSerializer, CampaignSerializer
)
from apps.pld_engine.models import PipelineStage
from apps.pld_engine.services import GateValidator, ICPEvaluator
from apps.workflows.models import StageHistory
from apps.products.models import Product, Problem
from apps.accounts.models import Account, Contact
from django.utils import timezone
from django.db.models import Q
from apps.authentication.models import User, UserRole
from apps.audit_logging.models import AuditLog, AuditAction
from apps.activities.models import Activity, ActivityType, ActivityStatus, Task, TaskPriority, TaskStatus
from apps.activities.services import ActivityService


def get_request_user(request):
    if request.user and request.user.is_authenticated:
        return request.user

    user_id = (
        request.headers.get('X-User-Id') or
        request.headers.get('x-user-id') or
        (request.data.get('user_id') if hasattr(request, 'data') and isinstance(request.data, dict) else None)
    )
    if user_id:
        try:
            u = User.objects.filter(id=user_id, is_active=True).first()
            if u:
                return u
        except Exception:
            pass

    user_email = (
        request.headers.get('X-User-Email') or
        request.headers.get('x-user-email') or
        (request.data.get('user_email') if hasattr(request, 'data') and isinstance(request.data, dict) else None)
    )
    if user_email:
        try:
            u = User.objects.filter(email__iexact=user_email, is_active=True).first()
            if u:
                return u
        except Exception:
            pass

    return None


from apps.authentication.backends import get_request_user, is_management_or_admin, is_sales_staff
from apps.authentication.permissions import ScopedQuerySetMixin, DomainOperationPermission, apply_data_scoping


class LeadViewSet(ScopedQuerySetMixin, viewsets.ModelViewSet):
    domain_name = 'LEADS'
    serializer_class = LeadSerializer
    permission_classes = [permissions.IsAuthenticated, DomainOperationPermission]

    def get_queryset(self):
        user = self.request.user if (self.request and self.request.user and self.request.user.is_authenticated) else get_request_user(self.request)
        qs = Lead.objects.all().prefetch_related(
            'product_interests__product', 'recorded_problems__problem',
            'touches__source', 'touches__campaign', 'touches__partner'
        ).select_related('account', 'contact', 'primary_product', 'current_stage', 'owner', 'partner__account', 'source')

        if user:
            qs = apply_data_scoping(qs, user, domain='LEADS')

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        return qs


    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        refreshed_instance = self.get_queryset().filter(id=serializer.instance.id).first() or serializer.instance
        output_serializer = self.get_serializer(refreshed_instance)
        headers = self.get_success_headers(output_serializer.data)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        user = get_request_user(self.request)
        partner = None
        if user and (getattr(user, 'is_partner_user', False) or getattr(user, 'role', None) == 'PARTNER_USER'):
            partner_prof = getattr(user, 'partner_profile', None)
            partner = partner_prof.partner if partner_prof else None

        manager_or_admin = is_management_or_admin(user)
        requested_owner = serializer.validated_data.get('owner')

        if requested_owner and not manager_or_admin:
            if user and getattr(requested_owner, 'id', None) != user.id:
                raise permissions.exceptions.PermissionDenied(
                    "Staff members can only assign leads to themselves. Only Managers and Administrators can assign leads to other staff members."
                )

        if partner:
            lead = serializer.save(partner=partner)
        elif not manager_or_admin:
            # Sales Reps and non-managers can ONLY assign leads to themselves
            lead = serializer.save(owner=user)
        else:
            if not requested_owner and user:
                lead = serializer.save(owner=user)
            else:
                lead = serializer.save()

        # Audit Log on Lead Creation with timestamp
        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else 'system@texol.com',
            actor_role=getattr(user, 'role', 'SYSTEM') if user else 'SYSTEM',
            entity_type='Lead',
            entity_id=lead.id,
            action=AuditAction.CREATE,
            changes_json={
                'account': {'new': lead.account.company_name},
                'primary_product': {'new': lead.primary_product.name},
                'source': {'new': lead.source.name if lead.source else None},
                'status': {'new': lead.status}
            }
        )

        # Automatic ICP Evaluation on Lead Creation
        icp_failed = False
        eval_res = None
        if lead.account and lead.primary_product:
            req_icp_attrs = self.request.data.get('icp_attributes') or self.request.data.get('attributes') or {}
            if isinstance(req_icp_attrs, dict) and req_icp_attrs:
                from apps.accounts.models import AccountAttribute
                for k, v in req_icp_attrs.items():
                    if v is not None:
                        AccountAttribute.objects.update_or_create(
                            account=lead.account,
                            product=lead.primary_product,
                            attribute_key=k,
                            defaults={'attribute_value': v}
                        )

            config_version = lead.primary_product.configurations.filter(status='PUBLISHED').first() or lead.primary_product.configurations.first()
            if config_version:
                try:
                    eval_res = ICPEvaluator.evaluate(
                        account=lead.account,
                        product=lead.primary_product,
                        config_version=config_version,
                        lead=lead,
                        user=user
                    )
                    lead.refresh_from_db()
                    if eval_res and (eval_res.get('result') == 'FAIL' or not eval_res.get('knockout_passed')):
                        icp_failed = True
                except Exception:
                    pass

        # If ICP evaluation failed, route lead immediately to NURTURE and record knockout failure reasons
        if icp_failed:
            from apps.leads.models import LeadStatus
            lead.status = LeadStatus.NURTURE
            failure_reasons = (eval_res.get('why_result_occurred') or eval_res.get('reasons') or eval_res.get('failure_reasons')) if eval_res else None
            reason_text = failure_reasons[0] if (failure_reasons and isinstance(failure_reasons, list) and len(failure_reasons) > 0) else "Account does not meet minimum ICP knockout profile."
            lead.nurture_reason = f"ICP Knockout Failed: {reason_text}"
            lead.disqualification_reason = lead.nurture_reason
            lead.save(update_fields=['status', 'nurture_reason', 'disqualification_reason'])
            lead.refresh_from_db()

        # Record initial touch
        if not lead.touches.exists():
            lead.record_touch(
                source=lead.source,
                partner=lead.partner,
                touch_type="Inbound Lead Created",
                user=user
            )

        # Automatic Work Queue Task creation for lead owner (ONLY if ICP did not fail and lead is ACTIVE)
        if not icp_failed and lead.status == 'ACTIVE':
            assigned_to_user = lead.owner or user
            if assigned_to_user:
                Task.objects.create(
                    tenant=lead.tenant,
                    title=f"Initial Prospect Outreach: {lead.account.company_name}",
                    description=lead.next_action_description or "Contact prospect, verify commercial requirements, and conduct initial discovery.",
                    assigned_to=assigned_to_user,
                    created_by=user,
                    related_lead=lead,
                    related_account=lead.account,
                    task_type="FIRST_CONTACT",
                    priority="HIGH",
                    due_date=timezone.now(),
                    is_completed=False
                )

        # Automated Customer Stage Notification Email for initial registration
        try:
            from apps.integrations.stage_notifications import CustomerStageEmailService
            CustomerStageEmailService.send_stage_email(
                record=lead,
                stage='NURTURE' if icp_failed else (lead.current_stage or 'NEW'),
                user=user,
                status_override=lead.status
            )
        except Exception as stg_err:
            logger.warning(f"Initial customer intake email failed: {stg_err}")

    def perform_update(self, serializer):
        user = get_request_user(self.request)
        manager_or_admin = is_management_or_admin(user)
        user_role = str(getattr(user, 'role', '') or '').upper()
        is_pld = user_role in ['PLD_EXECUTIVE', 'PLD_SPECIALIST']
        old_instance = self.get_object()

        if 'owner' in serializer.validated_data and not (manager_or_admin or is_pld):
            new_owner = serializer.validated_data.get('owner')
            if new_owner != old_instance.owner:
                raise permissions.exceptions.PermissionDenied(
                    "Staff members are not permitted to change lead ownership. Only Managers, Admins, and PLD Specialists can assign or reassign leads."
                )

        updated_lead = serializer.save()

        diffs = {}
        for field in ['status', 'next_action_description', 'next_activity_due_at', 'owner', 'current_stage', 'estimated_opportunity_value']:
            old_val = getattr(old_instance, field, None)
            new_val = getattr(updated_lead, field, None)
            if old_val != new_val:
                diffs[field] = {
                    'old': str(old_val) if old_val is not None else None,
                    'new': str(new_val) if new_val is not None else None
                }

        if diffs:
            AuditLog.objects.create(
                actor=user,
                actor_email=user.email if user else 'system@texol.com',
                actor_role=getattr(user, 'role', 'SYSTEM') if user else 'SYSTEM',
                entity_type='Lead',
                entity_id=updated_lead.id,
                action=AuditAction.UPDATE,
                changes_json=diffs
            )

    @action(detail=False, methods=['post'], url_path='check-duplicates')
    def check_duplicates(self, request):
        company_name = request.data.get('company_name', '').strip()
        domain = request.data.get('domain', '').strip()
        email = request.data.get('email', '').strip()
        phone = request.data.get('phone', '').strip()

        duplicates = []

        if domain:
            matched_accounts = Account.objects.filter(domain__iexact=domain)
            for acc in matched_accounts:
                duplicates.append({
                    'type': 'ACCOUNT',
                    'id': str(acc.id),
                    'name': acc.company_name,
                    'matched_on': f'Domain match: {domain}',
                    'confidence': 'HIGH'
                })

        if company_name:
            matched_accounts = Account.objects.filter(company_name__icontains=company_name)[:5]
            for acc in matched_accounts:
                if not any(d['id'] == str(acc.id) for d in duplicates):
                    duplicates.append({
                        'type': 'ACCOUNT',
                        'id': str(acc.id),
                        'name': acc.company_name,
                        'matched_on': f'Company name match: {acc.company_name}',
                        'confidence': 'MEDIUM'
                    })

        if email:
            matched_contacts = Contact.objects.filter(email__iexact=email).select_related('account')
            for c in matched_contacts:
                duplicates.append({
                    'type': 'CONTACT',
                    'id': str(c.id),
                    'name': f"{c.first_name} {c.last_name or ''} ({c.account.company_name})",
                    'matched_on': f'Email match: {email}',
                    'confidence': 'EXACT'
                })

        return Response({
            'has_duplicates': len(duplicates) > 0,
            'duplicate_count': len(duplicates),
            'duplicates': duplicates
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='transition-stage')
    def transition_stage(self, request, pk=None):
        lead = self.get_object()
        target_stage_id = request.data.get('target_stage_id')
        transition_reason = request.data.get('transition_reason', '')
        is_override = request.data.get('is_override', False)

        try:
            target_stage = PipelineStage.objects.get(id=target_stage_id)
        except PipelineStage.DoesNotExist:
            return Response({'error': 'Target stage not found'}, status=status.HTTP_404_NOT_FOUND)

        # Enforce Gate Validation
        validation = GateValidator.validate_lead_stage(lead, target_stage)

        if not validation['all_passed'] and not is_override:
            return Response({
                'error': 'Gate criteria not satisfied for transition to ' + target_stage.stage_name,
                'checklist': validation['checklist']
            }, status=status.HTTP_400_BAD_REQUEST)

        # Record Stage History
        from_stage = lead.current_stage
        lead.current_stage = target_stage
        lead.save(update_fields=['current_stage'])

        StageHistory.objects.create(
            record_type='LEAD',
            record_id=lead.id,
            from_stage=from_stage,
            to_stage=target_stage,
            transition_reason=transition_reason,
            is_override=is_override,
            changed_by=request.user if request.user.is_authenticated else None
        )

        AuditLog.objects.create(
            actor=request.user if request.user.is_authenticated else None,
            actor_email=request.user.email if request.user.is_authenticated else 'system@texol.com',
            actor_role=getattr(request.user, 'role', 'SYSTEM') if request.user.is_authenticated else 'SYSTEM',
            entity_type='Lead',
            entity_id=lead.id,
            action=AuditAction.STAGE_CHANGE,
            changes_json={
                'from_stage': {'old': from_stage.stage_name if from_stage else None, 'new': target_stage.stage_name},
                'transition_reason': {'new': transition_reason},
                'is_override': {'new': is_override}
            }
        )

        # If entering Discovery stage, auto-initialize Discovery workspace and carry forward problems
        if target_stage.stage_code == 'DISCOVERY' or 'Discovery' in target_stage.stage_name:
            from apps.discovery.models import Discovery
            from apps.discovery.services import DiscoveryService
            disc, _ = Discovery.objects.get_or_create(
                lead=lead,
                defaults={
                    'account': lead.account,
                    'product': lead.primary_product,
                    'conducted_by': request.user if request.user.is_authenticated else None,
                    'next_action_description': lead.next_action_description,
                    'next_activity_due_at': lead.next_activity_due_at
                }
            )
            DiscoveryService.carry_forward_lead_problems(disc)

        # If entering Demo stage, auto-initialize Demo workspace with Discovery use case mappings
        elif target_stage.stage_code == 'DEMO' or 'Demo' in target_stage.stage_name:
            from apps.evaluations.services import DemoService
            DemoService.create_or_init_demo(
                lead=lead,
                discovery=lead.discoveries.first(),
                user=request.user if request.user.is_authenticated else None
            )

        # If entering POC stage, auto-initialize POC trial with Discovery KPIs & criteria
        elif target_stage.stage_code == 'POC' or 'POC' in target_stage.stage_name:
            from apps.evaluations.services import POCService
            POCService.create_or_init_poc(
                lead=lead,
                discovery=lead.discoveries.first(),
                user=request.user if request.user.is_authenticated else None
            )

        # Automated Customer Stage Email
        stage_email_res = None
        send_email_requested = request.data.get('send_stage_email', True)
        if send_email_requested:
            try:
                from apps.integrations.stage_notifications import CustomerStageEmailService
                stage_email_res = CustomerStageEmailService.send_stage_email(
                    record=lead,
                    stage=target_stage,
                    user=request.user if request.user.is_authenticated else None,
                    custom_subject=request.data.get('custom_email_subject'),
                    custom_body=request.data.get('custom_email_body'),
                    custom_recipient_email=request.data.get('custom_recipient_email')
                )
            except Exception as email_err:
                logger.warning(f"Stage email dispatch error: {str(email_err)}")

        # Check if sales assignment was requested during transition
        assigned_sales_owner_id = (
            request.data.get('assigned_sales_owner_id') or
            request.data.get('sales_user_id') or
            request.data.get('owner_id')
        )
        if assigned_sales_owner_id:
            try:
                new_sales_owner = User.objects.get(id=assigned_sales_owner_id, is_active=True)
                old_owner = lead.owner
                lead.owner = new_sales_owner
                task_due = timezone.now() + timezone.timedelta(hours=48)
                lead.next_activity_due_at = task_due
                lead.next_action_description = f"Sales Discovery Outreach by {new_sales_owner.get_full_name() or new_sales_owner.username}"
                lead.save(update_fields=['owner', 'next_activity_due_at', 'next_action_description'])

                Task.objects.create(
                    tenant=lead.tenant,
                    related_lead=lead,
                    related_account=lead.account,
                    related_contact=getattr(lead, 'contact', None),
                    title=f"Sales Discovery Outreach - {lead.account.company_name}",
                    description=f"Qualified through PLD Engine. Stage advanced to {target_stage.stage_name}. Assigned to {new_sales_owner.get_full_name() or new_sales_owner.username}.",
                    due_date=task_due,
                    priority=TaskPriority.HIGH,
                    status=TaskStatus.OPEN,
                    task_type="FOLLOW_UP",
                    assigned_to=new_sales_owner,
                    created_by=request.user if (request.user and request.user.is_authenticated) else None
                )

                Activity.objects.create(
                    lead=lead,
                    account=lead.account,
                    activity_type=ActivityType.FOLLOW_UP,
                    subject=f"Assigned to Sales Representative: {new_sales_owner.get_full_name() or new_sales_owner.username}",
                    description_notes=f"Lead qualified through PLD Engine and advanced to {target_stage.stage_name}. Assigned to {new_sales_owner.get_full_name() or new_sales_owner.email}.",
                    conducted_at=timezone.now(),
                    status=ActivityStatus.COMPLETED,
                    performed_by=request.user if request.user.is_authenticated else None,
                    created_by=request.user if request.user.is_authenticated else None
                )
            except User.DoesNotExist:
                pass

        return Response({
            'message': f"Lead successfully progressed to {target_stage.stage_name}",
            'lead': LeadSerializer(lead).data,
            'stage_email': stage_email_res
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='assign-sales')
    def assign_sales(self, request, pk=None):
        """
        Assigns or hands off a qualified lead to a designated Sales Representative (Sales BDM/AE).
        Dual-records in AuditLog and Activity stream, and automatically initializes an outreach
        task in the Salesman's Work Queue.
        """
        lead = self.get_object()
        user = get_request_user(request)
        sales_user_id = (
            request.data.get('sales_user_id') or
            request.data.get('user_id') or
            request.data.get('owner_id')
        )
        handoff_notes = (request.data.get('notes') or request.data.get('handoff_notes') or '').strip()
        schedule_task = request.data.get('schedule_task', True)

        if not sales_user_id:
            return Response({'error': 'sales_user_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sales_user = User.objects.get(id=sales_user_id, is_active=True)
        except User.DoesNotExist:
            return Response({'error': 'Target sales representative not found or inactive'}, status=status.HTTP_404_NOT_FOUND)

        old_owner = lead.owner
        lead.owner = sales_user

        sales_name = sales_user.get_full_name() or sales_user.username
        due_date = timezone.now() + timezone.timedelta(hours=48)
        lead.next_activity_due_at = due_date
        lead.next_action_description = f"Sales Discovery Outreach by {sales_name}"
        lead.save(update_fields=['owner', 'next_activity_due_at', 'next_action_description'])

        # Audit log entry
        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else 'system@texol.com',
            actor_role=getattr(user, 'role', 'SYSTEM') if user else 'SYSTEM',
            entity_type='Lead',
            entity_id=lead.id,
            action=AuditAction.UPDATE,
            changes_json={
                'owner': {
                    'old': old_owner.get_full_name() or old_owner.email if old_owner else 'Unassigned',
                    'new': sales_name
                },
                'assignment_type': {'new': 'POST_PLD_QUALIFICATION_SALES_HANDOFF'},
                'handoff_notes': {'new': handoff_notes}
            }
        )

        # Work Queue Task creation for the assigned salesman
        if schedule_task:
            task_desc = f"PLD Qualified Lead Assigned: Follow up with {lead.account.company_name} for {lead.primary_product.name}."
            if handoff_notes:
                task_desc += f"\nHandoff Notes: {handoff_notes}"

            Task.objects.create(
                tenant=lead.tenant,
                related_lead=lead,
                related_account=lead.account,
                related_contact=getattr(lead, 'contact', None),
                title=f"Sales Outreach - {lead.account.company_name}",
                description=task_desc,
                due_date=due_date,
                priority=TaskPriority.HIGH,
                status=TaskStatus.OPEN,
                task_type="FOLLOW_UP",
                assigned_to=sales_user,
                created_by=user if (user and user.is_authenticated) else None
            )

        # Record activity in timeline
        Activity.objects.create(
            lead=lead,
            account=lead.account,
            activity_type=ActivityType.FOLLOW_UP,
            subject=f"Assigned to Sales Representative: {sales_name}",
            description_notes=f"Qualified through PLD Engine. Assigned to sales representative {sales_name} ({sales_user.email}).{(' Notes: ' + handoff_notes) if handoff_notes else ''}",
            conducted_at=timezone.now(),
            status=ActivityStatus.COMPLETED,
            performed_by=user,
            created_by=user
        )

        return Response({
            'message': f"Lead successfully assigned to {sales_name}",
            'lead': LeadSerializer(lead).data,
            'assigned_user': {
                'id': str(sales_user.id),
                'name': sales_name,
                'email': sales_user.email,
                'role': sales_user.role,
                'role_display': sales_user.get_role_display()
            }
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='stage-email-preview')
    def stage_email_preview(self, request, pk=None):
        """
        Returns preview of the stage completion email that will be sent to the customer.
        """
        lead = self.get_object()
        stage_id = request.query_params.get('stage_id')
        stage = None
        if stage_id:
            stage = PipelineStage.objects.filter(id=stage_id).first()
        if not stage:
            stage = lead.current_stage or 'NEW'
        status_override = request.query_params.get('status')
        from apps.integrations.stage_notifications import CustomerStageEmailService
        preview = CustomerStageEmailService.get_stage_email_preview(
            record=lead,
            stage=stage,
            status_override=status_override
        )
        return Response(preview, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='send-stage-email')
    def send_stage_email(self, request, pk=None):
        """
        Manually trigger / resend customer stage notification email.
        """
        lead = self.get_object()
        stage_id = request.data.get('stage_id')
        stage = None
        if stage_id:
            stage = PipelineStage.objects.filter(id=stage_id).first()
        if not stage:
            stage = lead.current_stage or 'NEW'
        custom_subject = request.data.get('subject') or request.data.get('custom_subject')
        custom_body = request.data.get('body') or request.data.get('custom_body')
        custom_recipient = request.data.get('recipient_email') or request.data.get('custom_recipient_email')
        status_override = request.data.get('status')

        from apps.integrations.stage_notifications import CustomerStageEmailService
        res = CustomerStageEmailService.send_stage_email(
            record=lead,
            stage=stage,
            user=request.user if request.user.is_authenticated else None,
            custom_subject=custom_subject,
            custom_body=custom_body,
            custom_recipient_email=custom_recipient,
            status_override=status_override
        )
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get', 'post'], url_path='problems')
    def problems(self, request, pk=None):
        lead = self.get_object()
        if request.method == 'GET':
            qs = lead.recorded_problems.all().select_related('problem')
            return Response(LeadProblemSerializer(qs, many=True).data)

        problem_id = request.data.get('problem_id')
        problem_code = request.data.get('problem_code')
        problem_name = request.data.get('problem_name')
        category = request.data.get('category', 'DISTRIBUTION')
        severity = request.data.get('severity', 'HIGH')
        frequency = request.data.get('frequency', 'DAILY')
        business_impact = request.data.get('business_impact', '')
        affected_users = request.data.get('affected_users', '')
        evidence = request.data.get('evidence', '')
        notes = request.data.get('notes', '')

        problem = None
        if problem_id:
            problem = Problem.objects.filter(id=problem_id).first()
        elif problem_code:
            problem = Problem.objects.filter(code=problem_code).first()
        elif problem_name:
            code = f"PROB_{problem_name.upper().replace(' ', '_')[:30]}"
            problem, _ = Problem.objects.get_or_create(
                code=code,
                defaults={
                    'name': problem_name,
                    'category': category,
                    'default_severity': severity
                }
            )

        if not problem:
            return Response({'error': 'Problem identification (problem_id, problem_code, or problem_name) is required'}, status=status.HTTP_400_BAD_REQUEST)

        lp, _ = LeadProblem.objects.update_or_create(
            lead=lead,
            problem=problem,
            defaults={
                'category': category,
                'severity': severity,
                'frequency': frequency,
                'business_impact': business_impact,
                'affected_users': affected_users,
                'evidence': evidence,
                'notes': notes
            }
        )

        AuditLog.objects.create(
            actor=request.user if request.user.is_authenticated else None,
            actor_email=request.user.email if request.user.is_authenticated else 'system@texol.com',
            actor_role=getattr(request.user, 'role', 'SYSTEM') if request.user.is_authenticated else 'SYSTEM',
            entity_type='Lead',
            entity_id=lead.id,
            action=AuditAction.UPDATE,
            changes_json={
                'problem_recorded': {'new': problem.name},
                'severity': {'new': severity},
                'category': {'new': category}
            }
        )

        return Response(LeadProblemSerializer(lp).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='restore-active')
    def restore_active(self, request, pk=None):
        lead = self.get_object()
        from apps.leads.models import LeadStatus
        old_status = lead.status
        lead.status = LeadStatus.ACTIVE
        lead.nurture_reason = None
        lead.disqualification_reason = None
        lead.save(update_fields=['status', 'nurture_reason', 'disqualification_reason'])

        user = get_request_user(request)

        # Satisfy/override any failed ICP assessments so lead is fully qualified in active queue
        from apps.pld_assessments.models import AccountProductAssessment, ICPResultStatus
        assessments = lead.assessments.all()
        if not assessments.exists() and lead.account and lead.primary_product:
            assessments = lead.account.assessments.filter(product=lead.primary_product)

        for ass in assessments:
            if not ass.icp_knockout_passed or ass.icp_result == ICPResultStatus.FAIL:
                ass.icp_knockout_passed = True
                ass.icp_result = ICPResultStatus.PASS
                ass.is_overridden = True
                actor_str = user.email if user else 'Operational Override'
                ass.override_reason = f"Restored from ICP Failed / Nurture pool to active pursuit by {actor_str}."
                ass.overridden_by = user
                ass.save(update_fields=['icp_knockout_passed', 'icp_result', 'is_overridden', 'override_reason', 'overridden_by', 'updated_at'])

        # Ensure active outreach task exists for lead owner in Work Queue
        assigned_to_user = lead.owner or user
        if assigned_to_user:
            existing_task = Task.objects.filter(related_lead=lead, is_completed=False).first()
            if not existing_task:
                Task.objects.create(
                    tenant=lead.tenant,
                    title=f"Restored Prospect Outreach: {lead.account.company_name}",
                    description="Lead was restored from ICP Failed / Nurture pool into active PLD qualification. Contact prospect, verify updated operational requirements, and advance discovery.",
                    assigned_to=assigned_to_user,
                    created_by=user,
                    related_lead=lead,
                    related_account=lead.account,
                    task_type="FIRST_CONTACT",
                    priority="HIGH",
                    due_date=timezone.now(),
                    is_completed=False
                )

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else 'system@texol.com',
            actor_role=getattr(user, 'role', 'SYSTEM') if user else 'SYSTEM',
            entity_type='Lead',
            entity_id=lead.id,
            action=AuditAction.UPDATE,
            changes_json={
                'status': {'old': old_status, 'new': 'ACTIVE'},
                'action': {'new': 'RESTORED_TO_ACTIVE_PLD_QUEUE'}
            }
        )

        return Response({
            'message': f"Lead for '{lead.account.company_name}' successfully restored to active pursuit! Moved to Active PLD Queue & Work Queue.",
            'moved_to': 'PLD_WORK_QUEUE',
            'queue_name': 'PLD Work Queue',
            'lead': LeadSerializer(lead).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='move-to-nurture')
    def move_to_nurture(self, request, pk=None):
        lead = self.get_object()
        from apps.leads.models import LeadStatus
        reason = request.data.get('reason') or request.data.get('nurture_reason') or 'Failed qualification criteria / ICP filter'
        status_choice = request.data.get('status', 'NURTURE')
        is_icp_failure = (
            request.data.get('is_icp_failure', False) or
            'ICP' in reason.upper() or
            'KNOCKOUT' in reason.upper()
        )

        lead.status = LeadStatus.DISQUALIFIED if status_choice == 'DISQUALIFIED' else LeadStatus.NURTURE
        if is_icp_failure and not reason.upper().startswith('ICP KNOCKOUT FAILED'):
            lead.nurture_reason = f"ICP Knockout Failed: {reason}"
            lead.disqualification_reason = f"ICP Knockout Failed: {reason}"
        else:
            lead.nurture_reason = reason
            lead.disqualification_reason = reason
        lead.save(update_fields=['status', 'nurture_reason', 'disqualification_reason'])

        # If ICP failure, sync or record assessment so ICP Engine reflects knockout failure
        if is_icp_failure and lead.account and lead.primary_product:
            from apps.pld_assessments.models import AccountProductAssessment, ICPResultStatus
            ass = lead.assessments.order_by('-assessed_at').first() or lead.account.assessments.filter(product=lead.primary_product).order_by('-assessed_at').first()
            if ass:
                ass.icp_result = ICPResultStatus.FAIL
                ass.icp_knockout_passed = False
                icp_reasons = ass.icp_reasons if isinstance(ass.icp_reasons, list) else []
                if reason not in icp_reasons:
                    icp_reasons = [reason] + [r for r in icp_reasons if r != reason]
                ass.icp_reasons = icp_reasons
                ass.save(update_fields=['icp_result', 'icp_knockout_passed', 'icp_reasons', 'updated_at'])
            else:
                config_version = lead.primary_product.configurations.filter(status='PUBLISHED').first() or lead.primary_product.configurations.first()
                if config_version:
                    AccountProductAssessment.objects.create(
                        tenant=lead.tenant,
                        account=lead.account,
                        product=lead.primary_product,
                        config_version=config_version,
                        lead=lead,
                        icp_result=ICPResultStatus.FAIL,
                        icp_knockout_passed=False,
                        icp_reasons=[reason],
                        icp_fit_score=0
                    )

        # Mark any open operational tasks as completed
        Task.objects.filter(related_lead=lead, is_completed=False).update(
            is_completed=True,
            completed_at=timezone.now()
        )

        user = get_request_user(request)
        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else 'system@texol.com',
            actor_role=getattr(user, 'role', 'SYSTEM') if user else 'SYSTEM',
            entity_type='Lead',
            entity_id=lead.id,
            action=AuditAction.UPDATE,
            changes_json={
                'status': {'new': lead.status},
                'nurture_reason': {'new': reason}
            }
        )

        # Automated Customer Notification Email on Nurture/Disqualification
        try:
            from apps.integrations.stage_notifications import CustomerStageEmailService
            CustomerStageEmailService.send_stage_email(
                record=lead,
                stage='DISQUALIFIED' if lead.status == LeadStatus.DISQUALIFIED else 'NURTURE',
                user=user,
                status_override=lead.status
            )
        except Exception as stg_err:
            logger.warning(f"Customer nurture/disqualified email failed: {stg_err}")

        destination_name = 'ICP Failed Queue' if is_icp_failure else 'Nurture & Win-Back Pool'
        return Response({
            'message': f"Lead for '{lead.account.company_name}' successfully routed to {destination_name}.",
            'moved_to': 'ICP_FAILED' if is_icp_failure else 'NURTURE',
            'lead': LeadSerializer(lead).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='add-problem')
    def add_problem(self, request, pk=None):
        return self.problems(request, pk)

    @action(detail=True, methods=['post'], url_path='add-product-interest')
    def add_product_interest(self, request, pk=None):
        lead = self.get_object()
        product_id = request.data.get('product_id')
        interest_level = request.data.get('interest_level', 'HIGH')
        is_primary = request.data.get('is_primary', False)
        evidence_notes = request.data.get('evidence_notes', '')

        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

        lpi, _ = LeadProductInterest.objects.update_or_create(
            lead=lead,
            product=product,
            defaults={
                'interest_level': interest_level,
                'is_primary': is_primary,
                'evidence_notes': evidence_notes
            }
        )

        AuditLog.objects.create(
            actor=request.user if request.user.is_authenticated else None,
            actor_email=request.user.email if request.user.is_authenticated else 'system@texol.com',
            actor_role=getattr(request.user, 'role', 'SYSTEM') if request.user.is_authenticated else 'SYSTEM',
            entity_type='Lead',
            entity_id=lead.id,
            action=AuditAction.UPDATE,
            changes_json={
                'product_interest': {'new': product.name},
                'interest_level': {'new': interest_level}
            }
        )

        # Automatic ICP Evaluation when product interest is added/updated
        if lead.account:
            config_version = product.configurations.filter(status='PUBLISHED').first() or product.configurations.first()
            if config_version:
                try:
                    ICPEvaluator.evaluate(
                        account=lead.account,
                        product=product,
                        config_version=config_version,
                        lead=lead,
                        user=request.user if request.user.is_authenticated else None
                    )
                except Exception:
                    pass

        return Response(LeadProductInterestSerializer(lpi).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='action-logs')
    def action_logs(self, request, pk=None):
        """
        Unified chronological Date and Time audit log for all actions performed on this lead.
        Consolidates Lead Creation, Stage Transitions, Conducted Activities, Tasks,
        PLD Qualification Score Events, Documented Problems, Touches, and Audit Updates.
        """
        lead = self.get_object()
        logs = []

        # 1. Lead Creation Action
        creator_name = "System"
        creator_role = "SYSTEM"
        if lead.owner:
            creator_name = lead.owner.get_full_name() or lead.owner.email
            creator_role = getattr(lead.owner, 'role', 'SALES_EXECUTIVE')

        logs.append({
            'id': f"lead-create-{lead.id}",
            'action_type': 'LEAD_CREATED',
            'action_category': 'LIFECYCLE',
            'title': f"Lead Created: {lead.account.company_name}",
            'timestamp': lead.created_at.isoformat(),
            'date_formatted': lead.created_at.strftime('%b %d, %Y'),
            'time_formatted': lead.created_at.strftime('%I:%M %p'),
            'actor_name': creator_name,
            'actor_role': creator_role,
            'status': 'COMPLETED',
            'description': f"Inbound commercial lead created for {lead.primary_product.name} ({lead.primary_product.code})",
            'outcome': f"Initial Stage: {lead.current_stage.stage_name if lead.current_stage else 'Inbound'}",
            'details': {
                'account': lead.account.company_name,
                'product': lead.primary_product.name,
                'source': lead.source.name if lead.source else 'Direct',
                'status': lead.status,
                'estimated_value': float(lead.estimated_opportunity_value) if lead.estimated_opportunity_value else None,
            },
            'source': 'Lead'
        })

        # 2. Stage Transitions from StageHistory
        stage_transitions = StageHistory.objects.filter(
            record_type='LEAD',
            record_id=lead.id
        ).select_related('from_stage', 'to_stage', 'changed_by', 'override_approved_by').order_by('-created_at')

        for st in stage_transitions:
            actor_name = "System"
            actor_role = "SYSTEM"
            if st.changed_by:
                actor_name = st.changed_by.get_full_name() or st.changed_by.email
                actor_role = getattr(st.changed_by, 'role', 'SALES_EXECUTIVE')

            from_name = st.from_stage.stage_name if st.from_stage else 'Initial Intake'
            to_name = st.to_stage.stage_name

            logs.append({
                'id': f"stage-{st.id}",
                'action_type': 'STAGE_TRANSITION',
                'action_category': 'PIPELINE',
                'title': f"Stage Progressed: {from_name} ➔ {to_name}",
                'timestamp': st.created_at.isoformat(),
                'date_formatted': st.created_at.strftime('%b %d, %Y'),
                'time_formatted': st.created_at.strftime('%I:%M %p'),
                'actor_name': actor_name,
                'actor_role': actor_role,
                'status': 'OVERRIDE' if st.is_override else 'PASSED',
                'description': st.transition_reason or f"Advanced pipeline stage to {to_name}",
                'outcome': f"Pipeline Stage: {to_name}" + (" (Governance Override)" if st.is_override else ""),
                'details': {
                    'from_stage': from_name,
                    'to_stage': to_name,
                    'is_override': st.is_override,
                    'reason': st.transition_reason
                },
                'source': 'StageHistory'
            })

        # 3. Activities logged on this lead
        activities = Activity.objects.filter(lead=lead).select_related('performed_by', 'created_by').order_by('-conducted_at')
        for act in activities:
            act_user = act.performed_by or act.created_by
            act_user_name = "Unassigned"
            act_user_role = "SALES_EXECUTIVE"
            if act_user:
                act_user_name = act_user.get_full_name() or act_user.email
                act_user_role = getattr(act_user, 'role', 'SALES_EXECUTIVE')

            t_val = act.conducted_at or act.created_at

            logs.append({
                'id': f"act-{act.id}",
                'action_type': f"ACTIVITY_{act.activity_type}",
                'action_category': 'ACTIVITY',
                'title': f"{act.get_activity_type_display()}: {act.subject}",
                'timestamp': t_val.isoformat(),
                'date_formatted': t_val.strftime('%b %d, %Y'),
                'time_formatted': t_val.strftime('%I:%M %p'),
                'actor_name': act_user_name,
                'actor_role': act_user_role,
                'status': act.status,
                'description': act.description_notes or act.subject,
                'outcome': act.outcome_notes or f"{act.duration_minutes} min {act.get_activity_type_display()}",
                'details': {
                    'activity_type': act.activity_type,
                    'subject': act.subject,
                    'duration_minutes': act.duration_minutes,
                    'outcome_notes': act.outcome_notes,
                    'description_notes': act.description_notes,
                    'next_action': act.next_action_description,
                    'next_action_due_at': act.next_action_due_at.isoformat() if act.next_action_due_at else None,
                    'next_action_status': act.next_action_status
                },
                'source': 'Activity'
            })

        # 4. Tasks & Next Actions
        tasks = Task.objects.filter(related_lead=lead).select_related('assigned_to', 'created_by').order_by('-created_at')
        for task in tasks:
            t_user = task.assigned_to or task.created_by
            t_name = (t_user.get_full_name() or t_user.email) if t_user else "Unassigned"
            t_role = getattr(t_user, 'role', 'STAFF') if t_user else 'STAFF'
            t_time = task.created_at

            logs.append({
                'id': f"task-{task.id}",
                'action_type': 'TASK_SCHEDULED',
                'action_category': 'TASK',
                'title': f"Task Created: {task.title}",
                'timestamp': t_time.isoformat(),
                'date_formatted': t_time.strftime('%b %d, %Y'),
                'time_formatted': t_time.strftime('%I:%M %p'),
                'actor_name': t_name,
                'actor_role': t_role,
                'status': task.status,
                'description': task.description or task.title,
                'outcome': f"Priority: {task.priority} | Due: {task.due_date.strftime('%b %d, %Y') if task.due_date else 'No due date'}",
                'details': {
                    'title': task.title,
                    'priority': task.priority,
                    'task_type': task.task_type,
                    'due_date': task.due_date.isoformat() if task.due_date else None,
                    'status': task.status
                },
                'source': 'Task'
            })

        # 5. Documented Business Problems
        problems = lead.recorded_problems.all().select_related('problem').order_by('-created_at')
        for prob in problems:
            logs.append({
                'id': f"prob-{prob.id}",
                'action_type': 'PROBLEM_RECORDED',
                'action_category': 'QUALIFICATION',
                'title': f"Business Problem Documented: {prob.problem.name}",
                'timestamp': prob.created_at.isoformat(),
                'date_formatted': prob.created_at.strftime('%b %d, %Y'),
                'time_formatted': prob.created_at.strftime('%I:%M %p'),
                'actor_name': "Evaluator",
                'actor_role': "QUALIFICATION",
                'status': prob.severity,
                'description': prob.business_impact or prob.notes or f"Identified operational pain in {prob.category}",
                'outcome': f"Severity: {prob.severity} | Frequency: {prob.frequency}",
                'details': {
                    'problem': prob.problem.name,
                    'severity': prob.severity,
                    'frequency': prob.frequency,
                    'category': prob.category,
                    'business_impact': prob.business_impact,
                    'evidence': prob.evidence
                },
                'source': 'LeadProblem'
            })

        # 6. Product Interests
        interests = lead.product_interests.all().select_related('product').order_by('-created_at')
        for interest in interests:
            logs.append({
                'id': f"interest-{interest.id}",
                'action_type': 'PRODUCT_INTEREST',
                'action_category': 'QUALIFICATION',
                'title': f"Product Interest: {interest.product.name} ({interest.interest_level})",
                'timestamp': interest.created_at.isoformat(),
                'date_formatted': interest.created_at.strftime('%b %d, %Y'),
                'time_formatted': interest.created_at.strftime('%I:%M %p'),
                'actor_name': "Commercial Team",
                'actor_role': "COMMERCIAL",
                'status': interest.interest_level,
                'description': interest.evidence_notes or f"Interest flagged for {interest.product.name}",
                'outcome': "Primary Product" if interest.is_primary else "Cross-Sell / Expansion",
                'details': {
                    'product': interest.product.name,
                    'interest_level': interest.interest_level,
                    'is_primary': interest.is_primary,
                    'notes': interest.evidence_notes
                },
                'source': 'LeadProductInterest'
            })

        # 7. Touches & Inbound Attributions
        for touch in lead.touches.all().select_related('source', 'campaign', 'partner', 'recorded_by').order_by('-touch_date'):
            t_user = touch.recorded_by
            t_name = (t_user.get_full_name() or t_user.email) if t_user else "System"
            t_role = getattr(t_user, 'role', 'MARKETING') if t_user else 'MARKETING'
            logs.append({
                'id': f"touch-{touch.id}",
                'action_type': 'TOUCH_RECORDED',
                'action_category': 'ATTRIBUTION',
                'title': f"Touchpoint: {touch.touch_type}",
                'timestamp': touch.touch_date.isoformat(),
                'date_formatted': touch.touch_date.strftime('%b %d, %Y'),
                'time_formatted': touch.touch_date.strftime('%I:%M %p'),
                'actor_name': t_name,
                'actor_role': t_role,
                'status': 'FIRST_TOUCH' if touch.is_first_touch else ('LAST_TOUCH' if touch.is_last_touch else 'TOUCH'),
                'description': f"Attributed via {touch.source.name if touch.source else 'Direct'} channel",
                'outcome': f"Campaign: {touch.campaign.name if touch.campaign else 'None'}",
                'details': {
                    'touch_type': touch.touch_type,
                    'source': touch.source.name if touch.source else None,
                    'campaign': touch.campaign.name if touch.campaign else None,
                    'partner': touch.partner.account.company_name if touch.partner else None,
                    'utm_parameters': touch.utm_parameters
                },
                'source': 'LeadTouch'
            })

        # 8. Score Calculations & Overrides from Assessment
        assessments = lead.account.assessments.filter(product=lead.primary_product)
        for ass in assessments:
            if ass.qualification_history:
                for idx, qh in enumerate(ass.qualification_history):
                    calc_at = qh.get('calculated_at')
                    dt_obj = None
                    if calc_at:
                        try:
                            from django.utils.dateparse import parse_datetime
                            dt_obj = parse_datetime(calc_at)
                        except Exception:
                            dt_obj = None

                    t_str = dt_obj.isoformat() if dt_obj else (calc_at or ass.created_at.isoformat())
                    d_fmt = dt_obj.strftime('%b %d, %Y') if dt_obj else 'Recent'
                    t_fmt = dt_obj.strftime('%I:%M %p') if dt_obj else 'N/A'

                    is_override = qh.get('action') == 'SCORE_OVERRIDE'

                    logs.append({
                        'id': f"pld-{ass.id}-{idx}",
                        'action_type': 'SCORE_OVERRIDE' if is_override else 'PLD_EVALUATION',
                        'action_category': 'SCORING',
                        'title': f"Score {'Override' if is_override else 'Calculated'}: {qh.get('score')}/100 [{qh.get('classification')}]",
                        'timestamp': t_str,
                        'date_formatted': d_fmt,
                        'time_formatted': t_fmt,
                        'actor_name': qh.get('user_name') or ('Authorized Manager' if is_override else 'PLD Engine'),
                        'actor_role': 'MANAGER' if is_override else 'ENGINE',
                        'status': qh.get('classification', 'SCORED'),
                        'description': qh.get('reason') or f"PLD Qualification score calculated to {qh.get('score')} points",
                        'outcome': f"Classification: {qh.get('classification')} (Model: {qh.get('model_version', 'v1.0')})",
                        'details': qh,
                        'source': 'AccountProductAssessment'
                    })

        # 9. Universal AuditLog entries
        audit_records = AuditLog.objects.filter(
            entity_id=lead.id
        ).select_related('actor').order_by('-timestamp')

        for rec in audit_records:
            actor_name = (rec.actor.get_full_name() or rec.actor.email) if rec.actor else (rec.actor_email or 'System')
            logs.append({
                'id': f"audit-{rec.id}",
                'action_type': f"AUDIT_{rec.action}",
                'action_category': 'AUDIT',
                'title': f"System Audit: {rec.get_action_display() if hasattr(rec, 'get_action_display') else rec.action}",
                'timestamp': rec.timestamp.isoformat(),
                'date_formatted': rec.timestamp.strftime('%b %d, %Y'),
                'time_formatted': rec.timestamp.strftime('%I:%M %p'),
                'actor_name': actor_name,
                'actor_role': rec.actor_role or 'SYSTEM',
                'status': 'VERIFIED',
                'description': f"Audit log record for {rec.action}",
                'outcome': f"Field changes: {len(rec.changes_json)} modified",
                'details': rec.changes_json,
                'source': 'AuditLog'
            })

        # Sort all logs chronologically (newest first)
        logs.sort(key=lambda x: x.get('timestamp') or '', reverse=True)

        return Response({
            'lead_id': str(lead.id),
            'account_name': lead.account.company_name,
            'total_actions': len(logs),
            'last_action_at': logs[0]['timestamp'] if logs else None,
            'logs': logs
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='log-action')
    def log_action(self, request, pk=None):
        """
        Explicitly record an action with date and time log on this lead.
        """
        lead = self.get_object()
        user = request.user if request.user.is_authenticated else None

        action_type = request.data.get('action_type', 'CALL')
        subject = request.data.get('subject') or request.data.get('title') or f"Action logged on {lead.account.company_name}"
        conducted_at_raw = request.data.get('conducted_at') or request.data.get('timestamp')

        from django.utils.dateparse import parse_datetime
        conducted_at = parse_datetime(conducted_at_raw) if conducted_at_raw else timezone.now()
        if not conducted_at:
            conducted_at = timezone.now()

        duration_minutes = int(request.data.get('duration_minutes') or 30)
        description_notes = request.data.get('description_notes', '').strip()
        outcome_notes = request.data.get('outcome_notes', '').strip()
        next_action_description = request.data.get('next_action_description', '').strip()
        next_action_due_raw = request.data.get('next_action_due_at') or request.data.get('next_activity_due_at')
        next_action_due_at = parse_datetime(next_action_due_raw) if next_action_due_raw else None
        action_status = request.data.get('status', ActivityStatus.COMPLETED)

        activity = ActivityService.log_activity(
            subject=subject,
            activity_type=action_type if action_type in dict(ActivityType.choices) else 'CUSTOM',
            performed_by=user,
            account=lead.account,
            contact=lead.contact,
            lead=lead,
            description_notes=description_notes,
            outcome_notes=outcome_notes,
            conducted_at=conducted_at,
            duration_minutes=duration_minutes,
            status=action_status,
            priority=request.data.get('priority', 'MEDIUM'),
            next_action_description=next_action_description or None,
            next_action_due_at=next_action_due_at,
            create_next_task=bool(next_action_due_at)
        )

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else 'system@texol.com',
            actor_role=getattr(user, 'role', 'SYSTEM') if user else 'SYSTEM',
            entity_type='Lead',
            entity_id=lead.id,
            action=AuditAction.LEAD_ACTION if hasattr(AuditAction, 'LEAD_ACTION') else AuditAction.ACTIVITY_LOG,
            changes_json={
                'action_type': {'new': action_type},
                'subject': {'new': subject},
                'conducted_at': {'new': conducted_at.isoformat()},
                'outcome_notes': {'new': outcome_notes},
                'next_action': {'new': next_action_description}
            }
        )

        return Response({
            'message': 'Action and date/time successfully recorded on lead.',
            'activity_id': str(activity.id),
            'conducted_at': conducted_at.isoformat(),
            'lead': LeadSerializer(lead).data
        }, status=status.HTTP_201_CREATED)


class LeadSourceViewSet(ScopedQuerySetMixin, viewsets.ModelViewSet):
    domain_name = 'LEADS'
    queryset = LeadSource.objects.all()
    serializer_class = LeadSourceSerializer
    permission_classes = [permissions.IsAuthenticated]


class CampaignViewSet(ScopedQuerySetMixin, viewsets.ModelViewSet):
    domain_name = 'LEADS'
    serializer_class = CampaignSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Campaign.objects.all().select_related('source', 'product', 'owner')
        user = self.request.user if (self.request and self.request.user and self.request.user.is_authenticated) else get_request_user(self.request)
        if user:
            qs = apply_data_scoping(qs, user, domain='LEADS')
        status_val = self.request.query_params.get('status')
        product_id = self.request.query_params.get('product')
        source_id = self.request.query_params.get('source')
        if status_val:
            qs = qs.filter(status=status_val)
        if product_id:
            qs = qs.filter(product_id=product_id)
        if source_id:
            qs = qs.filter(source_id=source_id)
        return qs.order_by('-created_at')


class LeadTouchViewSet(ScopedQuerySetMixin, viewsets.ModelViewSet):
    domain_name = 'LEADS'
    serializer_class = LeadTouchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user if (self.request and self.request.user and self.request.user.is_authenticated) else get_request_user(self.request)
        qs = LeadTouch.objects.all().select_related('lead', 'campaign', 'partner__account', 'source', 'recorded_by')
        if user:
            qs = apply_data_scoping(qs, user, domain='LEADS')


        lead_id = self.request.query_params.get('lead')
        campaign_id = self.request.query_params.get('campaign')
        partner_id = self.request.query_params.get('partner')
        source_id = self.request.query_params.get('source')

        if lead_id:
            qs = qs.filter(lead_id=lead_id)
        if campaign_id:
            qs = qs.filter(campaign_id=campaign_id)
        if partner_id:
            qs = qs.filter(partner_id=partner_id)
        if source_id:
            qs = qs.filter(source_id=source_id)

        return qs.order_by('-touch_date')
