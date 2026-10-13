from rest_framework import viewsets, permissions
from apps.audit_logging.models import AuditLog
from apps.audit_logging.serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all().select_related('actor')
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.AllowAny]
    filterset_fields = ['entity_type', 'action', 'entity_id']

    def get_queryset(self):
        qs = super().get_queryset()
        entity_id = self.request.query_params.get('entity_id')
        entity_type = self.request.query_params.get('entity_type')
        action_val = self.request.query_params.get('action')
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        if entity_type:
            qs = qs.filter(entity_type__iexact=entity_type)
        if action_val:
            qs = qs.filter(action=action_val)
        return qs.order_by('-timestamp')
