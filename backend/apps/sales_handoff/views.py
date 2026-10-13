from django.utils import timezone
from django.core.exceptions import ValidationError, PermissionDenied
from django.contrib.auth import get_user_model
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from django.db.models import Q
from apps.sales_handoff.models import SQLHandoff, HandoffStatus
from apps.sales_handoff.serializers import SQLHandoffSerializer
from apps.sales_handoff.services import SQLReadinessValidator, SQLHandoffService
from apps.leads.models import Lead
from apps.workflows.models import StageHistory

from apps.authentication.backends import get_request_user, is_management_or_admin, is_sales_staff
User = get_user_model()


class SQLHandoffViewSet(viewsets.ModelViewSet):
    queryset = SQLHandoff.objects.all().select_related(
        'lead__account', 'lead__contact', 'product', 'pld_executive',
        'assigned_sales_owner', 'previous_owner', 'override_approved_by'
    ).order_by('-created_at')
    serializer_class = SQLHandoffSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        user = get_request_user(self.request)

        if is_sales_staff(user):
            qs = qs.filter(Q(lead__owner=user) | Q(assigned_sales_owner=user))

        return qs

    @action(detail=False, methods=['get', 'post'], url_path='readiness')
    def check_readiness(self, request):
        """
        Evaluates the 9 mandatory qualification gates for SQL Readiness.
        Accepts lead_id in query params (GET) or request body (POST).
        """
        lead_id = request.data.get('lead_id') if request.method == 'POST' else request.query_params.get('lead_id')
        estimated_val = request.data.get('estimated_value') if request.method == 'POST' else request.query_params.get('estimated_value')

        user = get_request_user(request)
        if not lead_id:
            return Response({'error': 'lead_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            lead = Lead.objects.select_related('account', 'contact', 'primary_product').get(id=lead_id)
        except Lead.DoesNotExist:
            return Response({'error': f"Lead with id {lead_id} does not exist"}, status=status.HTTP_404_NOT_FOUND)

        if is_sales_staff(user) and lead.owner_id and lead.owner_id != getattr(user, 'id', None):
            return Response({'error': f"Lead with id {lead_id} does not exist"}, status=status.HTTP_404_NOT_FOUND)

        readiness_data = SQLReadinessValidator.validate_readiness(lead, estimated_value=estimated_val)
        return Response(readiness_data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='submit')
    def submit_sql(self, request):
        """
        Submits a lead for Sales Acceptance. Enforces 9 gates on backend.
        Blocks submission if gates are missing unless an authorized override is provided.
        """
        lead_id = request.data.get('lead_id')
        estimated_value = request.data.get('estimated_value')
        sales_owner_id = request.data.get('assigned_sales_owner_id')
        sla_hours = int(request.data.get('sla_duration_hours', 48))
        is_override = bool(request.data.get('is_override', False))
        override_reason = request.data.get('override_reason')

        user = get_request_user(request)
        if not lead_id:
            return Response({'error': 'lead_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            lead = Lead.objects.select_related('account', 'contact', 'primary_product', 'tenant').get(id=lead_id)
        except Lead.DoesNotExist:
            return Response({'error': f"Lead with id {lead_id} does not exist"}, status=status.HTTP_404_NOT_FOUND)

        if is_sales_staff(user) and lead.owner_id and lead.owner_id != getattr(user, 'id', None):
            return Response({'error': f"Lead with id {lead_id} does not exist"}, status=status.HTTP_404_NOT_FOUND)

        sales_owner = None
        if sales_owner_id:
            sales_owner = User.objects.filter(id=sales_owner_id).first()

        if not is_management_or_admin(user):
            if sales_owner and getattr(sales_owner, 'id', None) != getattr(user, 'id', None):
                return Response({'error': 'Staff members cannot assign handoffs to other owners. Only managers can assign leads.'}, status=status.HTTP_403_FORBIDDEN)

        if not user:
            user = lead.owner or User.objects.first()

        try:
            handoff = SQLHandoffService.submit_sql(
                lead=lead,
                user=user,
                assigned_sales_owner=sales_owner,
                estimated_value=estimated_value,
                sla_hours=sla_hours,
                is_override=is_override,
                override_reason=override_reason
            )
            return Response({
                'message': 'SQL Handoff submitted successfully for Sales Acceptance review.',
                'handoff': SQLHandoffSerializer(handoff).data
            }, status=status.HTTP_201_CREATED)
        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
        except PermissionDenied as pd:
            return Response({'error': str(pd)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as ex:
            return Response({'error': str(ex)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='override')
    def override_sql(self, request, pk=None):
        """
        Applies authorized override to a pending/blocked handoff or lead.
        """
        handoff = self.get_object()
        reason = request.data.get('override_reason')
        user = get_request_user(request)
        if not is_management_or_admin(user):
            return Response({'error': 'User is not authorized to grant SQL overrides.'}, status=status.HTTP_403_FORBIDDEN)

        if not reason or not reason.strip():
            return Response({'error': 'Override reason is mandatory.'}, status=status.HTTP_400_BAD_REQUEST)

        handoff.is_override = True
        handoff.override_reason = reason.strip()
        handoff.override_approved_by = user
        handoff.override_approved_at = timezone.now()
        handoff.readiness_status = 'OVERRIDDEN'
        handoff.save(update_fields=['is_override', 'override_reason', 'override_approved_by', 'override_approved_at', 'readiness_status'])

        return Response({
            'message': 'SQL Handoff override approved successfully.',
            'handoff': SQLHandoffSerializer(handoff).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='pending')
    def pending_handoffs(self, request):
        """
        Returns all pending SQL Handoffs awaiting Sales Acceptance with SLA metrics.
        """
        pending = self.get_queryset().filter(status=HandoffStatus.PENDING)
        serializer = self.get_serializer(pending, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='sla-status')
    def sla_status(self, request, pk=None):
        """
        Returns SLA health metrics for a specific handoff.
        """
        handoff = self.get_object()
        return Response({
            'handoff_id': str(handoff.id),
            'status': handoff.status,
            'sla_duration_hours': handoff.sla_duration_hours,
            'submitted_at': handoff.submitted_at,
            'sla_expires_at': handoff.sla_expires_at,
            'is_sla_overdue': handoff.is_sla_overdue,
            'sla_remaining_hours': handoff.sla_remaining_hours
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='accept')
    def accept(self, request, pk=None):
        """
        Sales accepts the SQL handoff. Transfers ownership, marks ACCEPTED, and creates the Opportunity.
        """
        handoff = self.get_object()
        user = get_request_user(request)
        new_sales_owner = None
        new_owner_id = request.data.get('new_sales_owner_id')
        if new_owner_id:
            new_sales_owner = User.objects.filter(id=new_owner_id).first()

        if not is_management_or_admin(user) and new_sales_owner and getattr(new_sales_owner, 'id', None) != getattr(user, 'id', None):
            return Response({'error': 'Staff members cannot reassign ownership to other representatives.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            result = SQLHandoffService.accept_sql(handoff, user=user, new_sales_owner=new_sales_owner)
            return Response({
                'message': result['message'],
                'opportunity_id': str(result['opportunity'].id),
                'handoff': SQLHandoffSerializer(result['handoff']).data
            }, status=status.HTTP_200_OK)
        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({'error': str(ex)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        """
        Sales declines the SQL handoff with mandatory reason. Returns lead to configured state.
        """
        handoff = self.get_object()
        reason = request.data.get('rejection_reason')
        return_target = request.data.get('return_target', 'NURTURE')
        user = request.user if request.user.is_authenticated else None

        if not reason or not reason.strip():
            return Response({'error': 'Rejection reason is mandatory when declining an SQL handoff.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = SQLHandoffService.reject_sql(handoff, reason=reason, return_target=return_target, user=user)
            return Response({
                'message': result['message'],
                'return_target': result['return_target'],
                'handoff': SQLHandoffSerializer(result['handoff']).data
            }, status=status.HTTP_200_OK)
        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({'error': str(ex)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='history')
    def handoff_history(self, request, pk=None):
        """
        Retrieves stage history and qualification snapshots for this handoff.
        """
        handoff = self.get_object()
        histories = StageHistory.objects.filter(record_type='LEAD', record_id=handoff.lead_id).order_by('-changed_at')
        history_data = [
            {
                'id': str(h.id),
                'from_stage': h.from_stage.stage_name if h.from_stage else None,
                'to_stage': h.to_stage.stage_name if h.to_stage else None,
                'transition_reason': h.transition_reason,
                'is_override': h.is_override,
                'changed_by': h.changed_by.get_full_name() if h.changed_by else "System",
                'changed_at': h.changed_at
            }
            for h in histories
        ]
        return Response({
            'handoff_id': str(handoff.id),
            'gate_audit_results': handoff.gate_audit_results,
            'original_gate_results': handoff.original_gate_results,
            'qualification_evidence': handoff.qualification_evidence,
            'stage_history': history_data
        }, status=status.HTTP_200_OK)
