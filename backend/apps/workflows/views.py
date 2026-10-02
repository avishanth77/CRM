from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.workflows.models import Approval, StageHistory, ApprovalStatus
from apps.workflows.serializers import ApprovalSerializer, StageHistorySerializer


class ApprovalViewSet(viewsets.ModelViewSet):
    queryset = Approval.objects.all().select_related('requested_by', 'approver')
    serializer_class = ApprovalSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=True, methods=['post'], url_path='decide')
    def decide(self, request, pk=None):
        approval = self.get_object()
        decision = request.data.get('status')
        notes = request.data.get('decision_notes', '')

        if decision not in [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED]:
            return Response({'error': 'Status must be APPROVED or REJECTED'}, status=status.HTTP_400_BAD_REQUEST)

        approval.status = decision
        approval.decision_notes = notes
        approval.decision_date = timezone.now()
        approval.approver = request.user if request.user.is_authenticated else None
        approval.save()

        return Response(ApprovalSerializer(approval).data, status=status.HTTP_200_OK)


class StageHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StageHistory.objects.all().select_related('from_stage', 'to_stage', 'changed_by')
    serializer_class = StageHistorySerializer
    permission_classes = [permissions.AllowAny]
