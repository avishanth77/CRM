from rest_framework import serializers
from apps.audit_logging.models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            'id', 'actor', 'actor_email', 'actor_role', 'ip_address',
            'entity_type', 'entity_id', 'action', 'changes_json', 'timestamp'
        ]
