from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.evaluations.models import Demo, POC
from apps.evaluations.serializers import DemoSerializer, POCSerializer


class DemoViewSet(viewsets.ModelViewSet):
    queryset = Demo.objects.all().select_related('account', 'presenter')
    serializer_class = DemoSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=True, methods=['post'], url_path='complete')
    def complete(self, request, pk=None):
        demo = self.get_object()
        feedback = request.data.get('customer_feedback')
        next_action = request.data.get('next_action_description')
        next_action_due = request.data.get('next_action_due_at')

        if not feedback or not next_action or not next_action_due:
            return Response({'error': 'Customer feedback, next action description, and due date are mandatory to complete a demo'}, status=status.HTTP_400_BAD_REQUEST)

        demo.customer_feedback = feedback
        demo.next_action_description = next_action
        demo.next_action_due_at = next_action_due
        demo.status = 'COMPLETED'
        demo.conducted_at = timezone.now()
        demo.save()

        return Response(DemoSerializer(demo).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='mark-not-required')
    def mark_not_required(self, request, pk=None):
        demo = self.get_object()
        reason = request.data.get('reason')

        if not reason:
            return Response({'error': 'Reason is mandatory when marking demo as Not Required'}, status=status.HTTP_400_BAD_REQUEST)

        demo.status = 'NOT_REQUIRED'
        demo.not_required_reason = reason
        demo.save(update_fields=['status', 'not_required_reason'])

        return Response(DemoSerializer(demo).data, status=status.HTTP_200_OK)


class POCViewSet(viewsets.ModelViewSet):
    queryset = POC.objects.all().select_related('account', 'owner')
    serializer_class = POCSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=True, methods=['post'], url_path='complete')
    def complete(self, request, pk=None):
        poc = self.get_object()
        result_metrics = request.data.get('result_metrics', {})
        feedback = request.data.get('customer_feedback', '')
        success = request.data.get('is_successful', True)

        if not result_metrics:
            return Response({'error': 'Documented result KPI metrics are required to complete a POC'}, status=status.HTTP_400_BAD_REQUEST)

        poc.result_metrics = result_metrics
        poc.customer_feedback = feedback
        poc.status = 'COMPLETED' if success else 'FAILED'
        poc.save(update_fields=['result_metrics', 'customer_feedback', 'status'])

        return Response(POCSerializer(poc).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='mark-not-required')
    def mark_not_required(self, request, pk=None):
        poc = self.get_object()
        reason = request.data.get('reason')

        if not reason:
            return Response({'error': 'Reason is mandatory when skipping POC as Not Required'}, status=status.HTTP_400_BAD_REQUEST)

        poc.status = 'NOT_REQUIRED'
        poc.not_required_reason = reason
        poc.save(update_fields=['status', 'not_required_reason'])

        return Response(POCSerializer(poc).data, status=status.HTTP_200_OK)
