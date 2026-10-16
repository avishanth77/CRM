from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.workflows.models import Approval, StageHistory, ApprovalStatus
from apps.workflows.serializers import ApprovalSerializer, StageHistorySerializer
from apps.authentication.models import UserRole
from apps.audit_logging.models import AuditLog, AuditAction


class ApprovalViewSet(viewsets.ModelViewSet):
    queryset = Approval.objects.all().select_related('requested_by', 'approver')
    serializer_class = ApprovalSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=['post'], url_path='decide')
    def decide(self, request, pk=None):
        user = request.user
        role = getattr(user, 'canonical_role', '')
        if role in [UserRole.SALES_BDM, UserRole.PLD_EXECUTIVE, UserRole.SOLUTION_CONSULTANT, UserRole.PARTNER_USER]:
            return Response(
                {'error': 'Permission denied: Frontline and partner users cannot decide workflow approvals.'},
                status=status.HTTP_403_FORBIDDEN
            )

        approval = self.get_object()
        decision = request.data.get('status')
        notes = request.data.get('decision_notes', '')

        if decision not in [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED]:
            return Response({'error': 'Status must be APPROVED or REJECTED'}, status=status.HTTP_400_BAD_REQUEST)

        approval.status = decision
        approval.decision_notes = notes
        approval.decision_date = timezone.now()
        approval.approver = user
        approval.save()

        AuditLog.objects.create(
            actor=user,
            actor_email=getattr(user, 'email', ''),
            actor_role=role,
            action=AuditAction.APPROVE if decision == ApprovalStatus.APPROVED else AuditAction.REJECT,
            entity_type='Approval',
            entity_id=approval.id,
            changes_json={
                'decision': decision,
                'notes': notes,
                'approval_type': approval.approval_type
            }
        )

        return Response(ApprovalSerializer(approval).data, status=status.HTTP_200_OK)


class StageHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StageHistory.objects.all().select_related('from_stage', 'to_stage', 'changed_by')
    serializer_class = StageHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

