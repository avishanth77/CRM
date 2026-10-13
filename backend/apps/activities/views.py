from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.activities.models import (
    Activity, ActivityStatus,
    Task, TaskStatus,
    Notification,
    SLADefinition, SLATracker, SLAStatus,
    AutomationRule, AutomationExecutionLog
)
from apps.activities.serializers import (
    ActivitySerializer, TaskSerializer, NotificationSerializer,
    SLADefinitionSerializer, SLATrackerSerializer,
    AutomationRuleSerializer, AutomationExecutionLogSerializer
)
from apps.activities.services import (
    ActivityService, TaskService, NotificationService,
    SLAService, AutomationService, WorkQueueService
)
from apps.authentication.models import User, UserRole
from apps.leads.models import Lead, LeadStatus
from apps.opportunities.models import Opportunity
from apps.accounts.models import Account


from apps.authentication.backends import get_request_user, is_management_or_admin, is_sales_staff


class ActivityViewSet(viewsets.ModelViewSet):
    """
    Unified activity stream across Account, Contact, Lead, Opportunity, Proposal, Demo, POC.
    """
    queryset = Activity.objects.all().select_related(
        'account', 'contact', 'lead', 'opportunity', 'proposal',
        'performed_by', 'assigned_to'
    )
    serializer_class = ActivitySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        account_id = self.request.query_params.get('account')
        contact_id = self.request.query_params.get('contact')
        lead_id = self.request.query_params.get('lead')
        opportunity_id = self.request.query_params.get('opportunity')
        proposal_id = self.request.query_params.get('proposal')
        discovery_id = self.request.query_params.get('discovery')
        demo_id = self.request.query_params.get('demo')
        poc_id = self.request.query_params.get('poc')
        partner_id = self.request.query_params.get('partner')
        deal_reg_id = self.request.query_params.get('deal_registration')
        activity_type = self.request.query_params.get('activity_type')
        activity_status = self.request.query_params.get('status')
        performed_by_id = self.request.query_params.get('performed_by')

        user = get_request_user(self.request)
        if user and (getattr(user, 'is_partner_user', False) or getattr(user, 'role', None) == 'PARTNER_USER'):
            partner_prof = getattr(user, 'partner_profile', None)
            if partner_prof:
                qs = qs.filter(Q(partner=partner_prof.partner) | Q(deal_registration__partner=partner_prof.partner))
        elif is_sales_staff(user):
            qs = qs.filter(Q(lead__owner=user) | Q(opportunity__owner=user) | Q(performed_by=user))

        if partner_id:
            qs = qs.filter(partner_id=partner_id)
        if deal_reg_id:
            qs = qs.filter(deal_registration_id=deal_reg_id)

        if account_id:
            qs = qs.filter(account_id=account_id)
        if contact_id:
            qs = qs.filter(contact_id=contact_id)
        if lead_id:
            qs = qs.filter(lead_id=lead_id)
        if opportunity_id:
            qs = qs.filter(opportunity_id=opportunity_id)
        if proposal_id:
            qs = qs.filter(proposal_id=proposal_id)
        if discovery_id:
            qs = qs.filter(discovery_id=discovery_id)
        if demo_id:
            qs = qs.filter(demo_id=demo_id)
        if poc_id:
            qs = qs.filter(poc_id=poc_id)
        if activity_type:
            qs = qs.filter(activity_type=activity_type)
        if activity_status:
            qs = qs.filter(status=activity_status)
        if performed_by_id:
            qs = qs.filter(performed_by_id=performed_by_id)

        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        output_serializer = self.get_serializer(serializer.instance)
        headers = self.get_success_headers(output_serializer.data)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        user = get_request_user(self.request)
        data = serializer.validated_data

        try:
            activity = ActivityService.log_activity(
                subject=data.get('subject'),
                activity_type=data.get('activity_type'),
                performed_by=user,
                account=data.get('account'),
                contact=data.get('contact'),
                lead=data.get('lead'),
                opportunity=data.get('opportunity'),
                proposal=data.get('proposal'),
                discovery=data.get('discovery'),
                demo=data.get('demo'),
                poc=data.get('poc'),
                description_notes=data.get('description_notes', ''),
                outcome_notes=data.get('outcome_notes', ''),
                conducted_at=data.get('conducted_at') or timezone.now(),
                duration_minutes=data.get('duration_minutes', 30),
                status=data.get('status', ActivityStatus.COMPLETED),
                priority=data.get('priority', 'MEDIUM'),
                next_action_description=data.get('next_action_description'),
                next_action_due_at=data.get('next_action_due_at'),
                create_next_task=bool(data.get('next_action_due_at'))
            )
            serializer.instance = activity
            return activity
        except Exception as e:
            from rest_framework.exceptions import ValidationError as DRFValidationError
            raise DRFValidationError({'detail': str(e)})

    @action(detail=True, methods=['post'], url_path='complete')
    def complete(self, request, pk=None):
        activity = self.get_object()
        outcome_notes = request.data.get('outcome_notes', activity.outcome_notes)
        next_action_desc = request.data.get('next_action_description', activity.next_action_description)
        next_action_due = request.data.get('next_action_due_at', activity.next_action_due_at)

        activity.status = ActivityStatus.COMPLETED
        activity.outcome_notes = outcome_notes
        if next_action_desc:
            activity.next_action_description = next_action_desc
        if next_action_due:
            activity.next_action_due_at = next_action_due
        activity.save()

        # Update parent record
        now = timezone.now()
        if activity.lead and next_action_due:
            activity.lead.next_activity_due_at = next_action_due
            activity.lead.next_action_description = next_action_desc
            activity.lead.last_activity_at = now
            activity.lead.save(update_fields=['next_activity_due_at', 'next_action_description', 'last_activity_at'])
        if activity.opportunity and next_action_due:
            activity.opportunity.next_activity_due_at = next_action_due
            activity.opportunity.next_action_description = next_action_desc
            activity.opportunity.last_activity_at = now
            activity.opportunity.save(update_fields=['next_activity_due_at', 'next_action_description', 'last_activity_at'])

        # Optionally create follow-up task
        if request.data.get('create_task', False) and next_action_due:
            user = request.user if request.user.is_authenticated else activity.performed_by
            Task.objects.create(
                title=next_action_desc or f"Follow-up: {activity.subject}",
                description=f"Follow-up task created from completed activity: {activity.subject}",
                task_type='FOLLOW_UP',
                priority=activity.priority,
                due_date=next_action_due,
                assigned_to=user,
                related_lead=activity.lead,
                related_opportunity=activity.opportunity,
                related_account=activity.account,
                source_activity=activity
            )

        return Response(ActivitySerializer(activity).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        activity = self.get_object()
        activity.status = ActivityStatus.CANCELLED
        activity.save(update_fields=['status'])
        return Response(ActivitySerializer(activity).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='records-missing-next-action')
    def records_missing_next_action(self, request):
        user = get_request_user(request)
        now = timezone.now()
        leads_qs = Lead.objects.filter(status=LeadStatus.ACTIVE)
        opps_qs = Opportunity.objects.filter(status='OPEN')
        if is_sales_staff(user):
            leads_qs = leads_qs.filter(owner=user)
            opps_qs = opps_qs.filter(owner=user)

        leads_missing = leads_qs.filter(
            next_activity_due_at__isnull=True
        ).values('id', 'account__company_name', 'primary_product__code', 'status', 'created_at')

        leads_overdue = leads_qs.filter(
            next_activity_due_at__lt=now
        ).values('id', 'account__company_name', 'primary_product__code', 'status', 'next_activity_due_at', 'next_action_description')

        opps_missing = opps_qs.filter(
            next_activity_due_at__isnull=True
        ).values('id', 'account__company_name', 'total_contract_value', 'currency', 'expected_close_date')

        return Response({
            'leads_missing_future_action': list(leads_missing),
            'leads_overdue_action': list(leads_overdue),
            'opportunities_missing_future_action': list(opps_missing),
            'total_alerts': len(leads_missing) + len(leads_overdue) + len(opps_missing)
        }, status=status.HTTP_200_OK)


class TaskViewSet(viewsets.ModelViewSet):
    """
    Actionable Task management with status transitions, assignment scoping, and completion.
    """
    queryset = Task.objects.all().select_related(
        'assigned_to', 'created_by', 'related_lead', 'related_opportunity', 'related_account'
    )
    serializer_class = TaskSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        assigned_to_id = self.request.query_params.get('assigned_to')
        task_status = self.request.query_params.get('status')
        priority = self.request.query_params.get('priority')
        lead_id = self.request.query_params.get('lead')
        opp_id = self.request.query_params.get('opportunity')
        account_id = self.request.query_params.get('account')

        user = get_request_user(self.request)
        if is_sales_staff(user):
            qs = qs.filter(Q(assigned_to=user) | Q(related_lead__owner=user))

        if assigned_to_id:
            qs = qs.filter(assigned_to_id=assigned_to_id)
        if task_status:
            if task_status == 'OVERDUE':
                qs = qs.filter(is_completed=False, due_date__lt=timezone.now())
            else:
                qs = qs.filter(status=task_status)
        if priority:
            qs = qs.filter(priority=priority)
        if lead_id:
            qs = qs.filter(related_lead_id=lead_id)
        if opp_id:
            qs = qs.filter(related_opportunity_id=opp_id)
        if account_id:
            qs = qs.filter(related_account_id=account_id)

        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        output_serializer = self.get_serializer(serializer.instance)
        headers = self.get_success_headers(output_serializer.data)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        data = serializer.validated_data
        try:
            task = TaskService.create_task(
                title=data.get('title'),
                assigned_to=data.get('assigned_to'),
                due_date=data.get('due_date'),
                created_by=user,
                description=data.get('description', ''),
                task_type=data.get('task_type', 'FOLLOW_UP'),
                priority=data.get('priority', 'MEDIUM'),
                related_lead=data.get('related_lead'),
                related_opportunity=data.get('related_opportunity'),
                related_account=data.get('related_account'),
                related_contact=data.get('related_contact'),
                related_discovery=data.get('related_discovery'),
                related_demo=data.get('related_demo'),
                related_poc=data.get('related_poc'),
                related_proposal=data.get('related_proposal'),
                related_handoff=data.get('related_handoff'),
                source_activity=data.get('source_activity')
            )
            serializer.instance = task
            return task
        except Exception as e:
            from rest_framework.exceptions import ValidationError as DRFValidationError
            raise DRFValidationError({'detail': str(e)})

    @action(detail=True, methods=['post'], url_path='complete')
    def complete(self, request, pk=None):
        task = self.get_object()
        user = request.user if request.user.is_authenticated else None
        TaskService.complete_task(task, completed_by=user)
        return Response(TaskSerializer(task).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        task = self.get_object()
        task.status = TaskStatus.CANCELLED
        task.save(update_fields=['status'])
        return Response(TaskSerializer(task).data, status=status.HTTP_200_OK)


class NotificationViewSet(viewsets.ModelViewSet):
    """
    Centralized in-app notification center with read status management and deep linking.
    """
    queryset = Notification.objects.all().select_related('recipient')
    serializer_class = NotificationSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        recipient_id = self.request.query_params.get('recipient')
        is_read = self.request.query_params.get('is_read')
        notif_type = self.request.query_params.get('notification_type')

        user = get_request_user(self.request)
        if user and not user.is_superuser:
            qs = qs.filter(recipient=user)
        elif recipient_id:
            qs = qs.filter(recipient_id=recipient_id)

        if is_read is not None:
            qs = qs.filter(is_read=(is_read.lower() == 'true'))
        if notif_type:
            qs = qs.filter(notification_type=notif_type)

        return qs

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.mark_as_read()
        return Response({'status': 'marked_read', 'id': str(notif.id)}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        qs = self.get_queryset().filter(is_read=False)
        updated = qs.update(is_read=True, read_at=timezone.now())
        return Response({'status': 'all_marked_read', 'updated_count': updated}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'unread_count': count}, status=status.HTTP_200_OK)


class SLADefinitionViewSet(viewsets.ModelViewSet):
    """
    Configurable SLA governance definitions across CRM lifecycle stages.
    """
    queryset = SLADefinition.objects.all()
    serializer_class = SLADefinitionSerializer
    permission_classes = [permissions.AllowAny]


class SLATrackerViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Query active and historical SLA trackers.
    """
    queryset = SLATracker.objects.all().select_related('definition', 'assigned_user')
    serializer_class = SLATrackerSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        entity_type = self.request.query_params.get('entity_type')
        entity_id = self.request.query_params.get('entity_id')
        status_param = self.request.query_params.get('status')

        if entity_type:
            qs = qs.filter(entity_type=entity_type)
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        if status_param:
            qs = qs.filter(status=status_param)

        return qs

    @action(detail=False, methods=['post'], url_path='evaluate-all')
    def evaluate_all(self, request):
        result = SLAService.evaluate_and_escalate_all_slas()
        return Response(result, status=status.HTTP_200_OK)


class AutomationRuleViewSet(viewsets.ModelViewSet):
    """
    CRUD for configurable automation rules and on-demand execution.
    """
    queryset = AutomationRule.objects.all()
    serializer_class = AutomationRuleSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['post'], url_path='run-all')
    def run_all(self, request):
        result = AutomationService.run_all_automations()
        return Response(result, status=status.HTTP_200_OK)


class WorkQueueView(APIView):
    """
    Delivers action-oriented MY WORK queue: Today, Overdue, At Risk,
    No Next Action, and Upcoming, with role-based filtering.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        user = get_request_user(request)
        role_view = request.query_params.get('role_view')
        data = WorkQueueService.get_work_queue_data(user=user, role_view=role_view)

        def serialize_lead(l):
            return {
                'id': str(l.id),
                'account_id': str(l.account.id) if l.account else None,
                'account_name': l.account.company_name if l.account else 'Unknown',
                'product_name': l.primary_product.name if l.primary_product else 'Unknown',
                'owner_name': l.owner.get_full_name() if l.owner else 'Unassigned',
                'status': l.status,
                'next_action': l.next_action_description,
                'next_action_due': l.next_activity_due_at.strftime('%Y-%m-%d %H:%M') if l.next_activity_due_at else None,
                'created_at': l.created_at.strftime('%Y-%m-%d')
            }

        def serialize_opp(o):
            return {
                'id': str(o.id),
                'account_id': str(o.account.id) if o.account else None,
                'account_name': o.account.company_name if o.account else 'Unknown',
                'product_name': o.product.name if o.product else 'Multi-Product',
                'value': f"{o.total_contract_value} {o.currency}",
                'total_contract_value': float(o.total_contract_value),
                'owner_name': o.owner.get_full_name() if o.owner else 'Unassigned',
                'stage_name': o.stage.stage_name if o.stage else 'New',
                'status': o.status,
                'next_action': o.next_action_description,
                'next_action_due': o.next_activity_due_at.strftime('%Y-%m-%d %H:%M') if o.next_activity_due_at else None,
                'created_at': o.created_at.strftime('%Y-%m-%d')
            }

        def serialize_sql(s):
            return {
                'id': str(s.id),
                'account_name': s.lead.account.company_name if s.lead and s.lead.account else 'Unknown',
                'product_name': s.product.name if s.product else 'Unknown',
                'sales_owner': s.assigned_sales_owner.get_full_name() if s.assigned_sales_owner else 'Unassigned',
                'status': s.status,
                'sla_expires_at': s.sla_expires_at.strftime('%Y-%m-%d %H:%M') if s.sla_expires_at else None,
                'is_sla_overdue': s.is_sla_overdue,
                'sla_remaining_hours': s.sla_remaining_hours,
                'estimated_value': float(s.estimated_value)
            }

        def serialize_proposal(p):
            return {
                'id': str(p.id),
                'proposal_number': p.proposal_number,
                'account_name': p.opportunity.account.company_name if p.opportunity and p.opportunity.account else 'Unknown',
                'owner_name': p.owner.get_full_name() if p.owner else 'Unassigned',
                'status': p.status,
                'net_amount': float(p.net_amount),
                'currency': p.currency,
                'valid_until': p.valid_until.strftime('%Y-%m-%d') if p.valid_until else None,
                'is_expired': p.is_expired()
            }

        # Structure sections
        data['today']['tasks'] = TaskSerializer(data['today']['tasks'], many=True).data
        data['today']['follow_ups_leads'] = [serialize_lead(l) for l in data['today']['follow_ups_leads']]
        data['today']['follow_ups_opps'] = [serialize_opp(o) for o in data['today']['follow_ups_opps']]
        data['today']['sql_acceptance'] = [serialize_sql(s) for s in data['today']['sql_acceptance']]
        data['today']['scheduled_activities'] = ActivitySerializer(data['today']['scheduled_activities'], many=True).data

        data['overdue']['tasks'] = TaskSerializer(data['overdue']['tasks'], many=True).data
        data['overdue']['follow_ups_leads'] = [serialize_lead(l) for l in data['overdue']['follow_ups_leads']]
        data['overdue']['follow_ups_opps'] = [serialize_opp(o) for o in data['overdue']['follow_ups_opps']]
        data['overdue']['sla_breaches'] = SLATrackerSerializer(data['overdue']['sla_breaches'], many=True).data

        data['at_risk']['slas_at_risk'] = SLATrackerSerializer(data['at_risk']['slas_at_risk'], many=True).data
        data['at_risk']['inactive_opportunities'] = [serialize_opp(o) for o in data['at_risk']['inactive_opportunities']]
        data['at_risk']['proposals_expiring'] = [serialize_proposal(p) for p in data['at_risk']['proposals_expiring']]

        data['no_next_action']['leads'] = [serialize_lead(l) for l in data['no_next_action']['leads']]
        data['no_next_action']['opportunities'] = [serialize_opp(o) for o in data['no_next_action']['opportunities']]

        data['upcoming']['tasks'] = TaskSerializer(data['upcoming']['tasks'], many=True).data
        data['upcoming']['activities'] = ActivitySerializer(data['upcoming']['activities'], many=True).data
        data['upcoming']['nurture_reengagement'] = [serialize_lead(l) for l in data['upcoming']['nurture_reengagement']]

        # Backward compatibility
        data['overdue_tasks'] = data['overdue']['tasks']
        data['due_today_tasks'] = data['today']['tasks']
        data['upcoming_tasks'] = data['upcoming']['tasks']
        data['leads_missing_next_action'] = data['no_next_action']['leads']
        data['opportunities_missing_next_action'] = data['no_next_action']['opportunities']
        data['slas_at_risk'] = data['at_risk']['slas_at_risk']

        return Response(data, status=status.HTTP_200_OK)


class WorkQueueActionView(APIView):
    """
    Direct actions from Work Queue: Reschedule Task, Schedule Next Action.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, action_name=None):
        user = request.user if request.user.is_authenticated else None
        if action_name == 'reschedule-task':
            task_id = request.data.get('task_id')
            new_due_date = request.data.get('new_due_date')
            if not task_id or not new_due_date:
                return Response({'error': 'task_id and new_due_date required'}, status=status.HTTP_400_BAD_REQUEST)
            task = WorkQueueService.reschedule_task(task_id, new_due_date, user=user)
            return Response({'status': 'SUCCESS', 'task': TaskSerializer(task).data}, status=status.HTTP_200_OK)

        elif action_name == 'schedule-next-action':
            entity_type = request.data.get('entity_type', 'LEAD')
            entity_id = request.data.get('entity_id')
            description = request.data.get('description')
            due_date = request.data.get('due_date')
            if not entity_id or not description:
                return Response({'error': 'entity_id and description required'}, status=status.HTTP_400_BAD_REQUEST)
            res = WorkQueueService.schedule_next_action(entity_type, entity_id, description, due_date, user=user)
            return Response(res, status=status.HTTP_200_OK)

        return Response({'error': f'Unsupported action {action_name}'}, status=status.HTTP_400_BAD_REQUEST)


class OperationalMetricsView(APIView):
    """
    Supplies real-time operational dashboard metrics for Section 35.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        metrics = WorkQueueService.get_operational_metrics()
        return Response(metrics, status=status.HTTP_200_OK)

