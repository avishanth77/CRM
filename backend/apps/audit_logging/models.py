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
    ACTIVITY_LOG = 'ACTIVITY_LOG', 'Log Activity'
    TASK_CREATE = 'TASK_CREATE', 'Create Task'
    TASK_COMPLETE = 'TASK_COMPLETE', 'Complete Task'
    SLA_BREACH = 'SLA_BREACH', 'SLA Breached'
    ESCALATION = 'ESCALATION', 'Escalation Triggered'
    AUTOMATION_EXECUTE = 'AUTOMATION_EXECUTE', 'Automation Rule Executed'
    PARTNER_CREATE = 'PARTNER_CREATE', 'Create Partner'
    PARTNER_STATUS_CHANGE = 'PARTNER_STATUS_CHANGE', 'Partner Status Changed'
    PARTNER_AUTH_CHANGE = 'PARTNER_AUTH_CHANGE', 'Partner Authorization Changed'
    PARTNER_USER_CHANGE = 'PARTNER_USER_CHANGE', 'Partner User Changed'
    DEAL_REG_SUBMIT = 'DEAL_REG_SUBMIT', 'Submit Deal Registration'
    DEAL_REG_APPROVE = 'DEAL_REG_APPROVE', 'Approve Deal Registration'
    DEAL_REG_REJECT = 'DEAL_REG_REJECT', 'Reject Deal Registration'
    CONFLICT_DECISION = 'CONFLICT_DECISION', 'Channel Conflict Resolved'
    ATTRIBUTION_CHANGE = 'ATTRIBUTION_CHANGE', 'Attribution Model Configured'
    PARTNER_INFLUENCE = 'PARTNER_INFLUENCE', 'Partner Influence Recorded'
    COMMISSION_STATUS = 'COMMISSION_STATUS', 'Commission Status Changed'
    CAMPAIGN_CHANGE = 'CAMPAIGN_CHANGE', 'Campaign Modified'
    LEAD_ACTION = 'LEAD_ACTION', 'Lead Action'
    USER_CREATE = 'USER_CREATE', 'User Created'
    USER_UPDATE = 'USER_UPDATE', 'User Updated'
    USER_DELETE = 'USER_DELETE', 'User Deleted'
    ROLE_CHANGE = 'ROLE_CHANGE', 'Role Assignment Changed'
    PASSWORD_CHANGE = 'PASSWORD_CHANGE', 'Password Changed'
    DISCOUNT_APPROVE = 'DISCOUNT_APPROVE', 'Discount Approved'
    CONFIG_PUBLISH = 'CONFIG_PUBLISH', 'Product Configuration Published'
    ERP_SYNC = 'ERP_SYNC', 'ERP Synchronized'


# Documented alias for Stage-Gate Override
AuditAction.OVERRIDE = AuditAction.GATE_OVERRIDE


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


def log_audit_event(actor=None, action=AuditAction.UPDATE, entity_type='', entity_id=None, changes_json=None, request=None):
    """
    Centralized helper for creating immutable audit records without leaking sensitive credentials.
    """
    ip = None
    if request:
        ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
        if ip and ',' in ip:
            ip = ip.split(',')[0].strip()

    actor_email = getattr(actor, 'email', None) if actor else 'system'
    actor_role = getattr(actor, 'role', None) if actor else 'SYSTEM'

    # Sanitize changes_json so passwords, tokens, and secrets are NEVER logged
    sanitized_changes = {}
    if isinstance(changes_json, dict):
        sensitive_keys = {'password', 'token', 'access', 'refresh', 'secret', 'key'}
        for k, v in changes_json.items():
            if any(s in k.lower() for s in sensitive_keys):
                sanitized_changes[k] = '[REDACTED]'
            else:
                sanitized_changes[k] = v
    else:
        sanitized_changes = {'details': str(changes_json)}

    return AuditLog.objects.create(
        actor=actor if (actor and getattr(actor, 'is_authenticated', False)) else None,
        actor_email=actor_email,
        actor_role=actor_role,
        ip_address=ip if (ip and len(ip) <= 45) else None,
        entity_type=entity_type or 'General',
        entity_id=entity_id or uuid.uuid4(),
        action=action,
        changes_json=sanitized_changes
    )

