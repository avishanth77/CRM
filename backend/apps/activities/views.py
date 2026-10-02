from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.activities.models import Activity, Task
from apps.activities.serializers import ActivitySerializer, TaskSerializer
from apps.leads.models import Lead
from apps.opportunities.models import Opportunity
from apps.accounts.models import Account


class ActivityViewSet(viewsets.ModelViewSet):
    queryset = Activity.objects.all().select_related(
        'account', 'contact', 'lead', 'opportunity', 'performed_by'
    )
    serializer_class = ActivitySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        account_id = self.request.query_params.get('account')
        contact_id = self.request.query_params.get('contact')
        lead_id = self.request.query_params.get('lead')
        opportunity_id = self.request.query_params.get('opportunity')
        activity_type = self.request.query_params.get('activity_type')

        if account_id:
            qs = qs.filter(account_id=account_id)
        if contact_id:
            qs = qs.filter(contact_id=contact_id)
        if lead_id:
            qs = qs.filter(lead_id=lead_id)
        if opportunity_id:
            qs = qs.filter(opportunity_id=opportunity_id)
        if activity_type:
            qs = qs.filter(activity_type=activity_type)
        return qs

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        activity = serializer.save(performed_by=user)

        now = timezone.now()
        # Automatically update timeline and SLA timestamps on parent records
        if activity.lead:
            activity.lead.last_activity_at = now
            if activity.next_action_due_at:
                activity.lead.next_activity_due_at = activity.next_action_due_at
                activity.lead.next_action_description = activity.next_action_description
            activity.lead.save(update_fields=['last_activity_at', 'next_activity_due_at', 'next_action_description'])

        if activity.opportunity:
            activity.opportunity.last_activity_at = now
            if activity.next_action_due_at:
                activity.opportunity.next_activity_due_at = activity.next_action_due_at
                activity.opportunity.next_action_description = activity.next_action_description
            activity.opportunity.save(update_fields=['last_activity_at', 'next_activity_due_at', 'next_action_description'])

        if activity.account:
            activity.account.last_activity_at = now
            if activity.next_action_due_at:
                activity.account.next_activity_due_at = activity.next_action_due_at
                activity.account.next_action_description = activity.next_action_description
            activity.account.save(update_fields=['last_activity_at', 'next_activity_due_at', 'next_action_description'])

    @action(detail=False, methods=['get'], url_path='records-missing-next-action')
    def records_missing_next_action(self, request):
        """
        TEXOL PLD Rule: Every active record must have a future activity.
        Identifies all active Leads and Opportunities without a scheduled next activity.
        """
        now = timezone.now()
        leads_missing = Lead.objects.filter(
            status__in=['NEW', 'ICP_CHECK', 'QUALIFICATION', 'DISCOVERY', 'DEMO', 'POC', 'SQL_READY'],
            next_activity_due_at__isnull=True
        ).values('id', 'account__company_name', 'primary_product__code', 'status', 'created_at')

        leads_overdue = Lead.objects.filter(
            status__in=['NEW', 'ICP_CHECK', 'QUALIFICATION', 'DISCOVERY', 'DEMO', 'POC', 'SQL_READY'],
            next_activity_due_at__lt=now
        ).values('id', 'account__company_name', 'primary_product__code', 'status', 'next_activity_due_at', 'next_action_description')

        opps_missing = Opportunity.objects.filter(
            status='OPEN',
            next_activity_due_at__isnull=True
        ).values('id', 'account__company_name', 'total_contract_value', 'currency', 'expected_close_date')

        return Response({
            'leads_missing_future_action': list(leads_missing),
            'leads_overdue_action': list(leads_overdue),
            'opportunities_missing_future_action': list(opps_missing),
            'total_alerts': len(leads_missing) + len(leads_overdue) + len(opps_missing)
        }, status=status.HTTP_200_OK)


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all().select_related('assigned_to', 'related_lead', 'related_opportunity')
    serializer_class = TaskSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=True, methods=['post'], url_path='complete')
    def complete(self, request, pk=None):
        task = self.get_object()
        task.is_completed = True
        task.completed_at = timezone.now()
        task.save(update_fields=['is_completed', 'completed_at'])
        return Response(TaskSerializer(task).data, status=status.HTTP_200_OK)
