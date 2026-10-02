from rest_framework import viewsets, permissions
from apps.audit_logging.models import AuditLog
from apps.audit_logging.serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all().select_related('actor')
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.AllowAny]
    filterset_fields = ['entity_type', 'action']
