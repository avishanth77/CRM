import uuid
from django.db import models
from django.conf import settings


class AuditAction(models.TextChoices):
    CREATE = 'CREATE', 'Create'
    UPDATE = 'UPDATE', 'Update'
    DELETE = 'DELETE', 'Delete'
    GATE_OVERRIDE = 'GATE_OVERRIDE', 'Gate Override'
    SCORE_OVERRIDE = 'SCORE_OVERRIDE', 'Score Override'
    SALES_ACCEPT = 'SALES_ACCEPT', 'Sales Accepted SQL'
    SALES_REJECT = 'SALES_REJECT', 'Sales Rejected SQL'
    LOGIN = 'LOGIN', 'User Login'
    PROPOSAL_CREATE = 'PROPOSAL_CREATE', 'Create Proposal'
    PROPOSAL_VERSION = 'PROPOSAL_VERSION', 'Create Proposal Version'
    PROPOSAL_APPROVE = 'PROPOSAL_APPROVE', 'Approve Proposal'
    PROPOSAL_REJECT = 'PROPOSAL_REJECT', 'Reject Proposal'
    PROPOSAL_SEND = 'PROPOSAL_SEND', 'Send Proposal'
    STAGE_CHANGE = 'STAGE_CHANGE', 'Stage Transition'


class AuditLog(models.Model):
    """
    Universal immutable audit trail capturing who changed what, when, old vs new values.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs"
    )
    actor_email = models.CharField(max_length=255, blank=True, null=True)
    actor_role = models.CharField(max_length=64, blank=True, null=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    entity_type = models.CharField(max_length=128, db_index=True)
    entity_id = models.UUIDField(db_index=True)
    action = models.CharField(max_length=32, choices=AuditAction.choices, db_index=True)
    changes_json = models.JSONField(
        default=dict,
        help_text="Detailed field-level diff: {'field': {'old': x, 'new': y}}"
    )
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"[{self.timestamp.strftime('%Y-%m-%d %H:%M')}] {self.actor_email or 'System'} {self.action} {self.entity_type} #{str(self.entity_id)[:8]}"
