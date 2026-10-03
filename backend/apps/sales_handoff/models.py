import uuid
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel
from apps.leads.models import Lead
from apps.products.models import Product


class HandoffStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Sales Review'
    ACCEPTED = 'ACCEPTED', 'Accepted by Sales'
    REJECTED = 'REJECTED', 'Rejected back to PLD'


class SQLHandoff(BaseModel):
    """
    Formal Sales Acceptance gate between PLD Executive and Sales Team.
    When gates pass, PLD submits SQL Ready handoff with SLA timer.
    Sales acceptance creates the Opportunity; rejection returns lead to PLD.
    """
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="sql_handoffs")
    account = models.ForeignKey(
        'accounts.Account',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="sql_handoffs"
    )
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="sql_handoffs")
    pld_executive = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submitted_handoffs"
    )
    assigned_sales_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_handoffs"
    )

    # Phase 7: Commercial qualification & readiness
    estimated_value = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    currency = models.CharField(max_length=8, default='USD')
    readiness_status = models.CharField(max_length=32, default='READY')
    qualification_evidence = models.JSONField(
        default=dict,
        blank=True,
        help_text="Detailed qualification snapshots: problems, capabilities, decision maker, timeline"
    )
    gate_audit_results = models.JSONField(
        default=dict,
        blank=True,
        help_text="Snapshot of passed SQL gates at handoff time"
    )

    # Authorized Override Governance
    is_override = models.BooleanField(default=False)
    override_reason = models.TextField(blank=True, null=True)
    override_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_sql_overrides"
    )
    override_approved_at = models.DateTimeField(null=True, blank=True)
    original_gate_results = models.JSONField(
        default=dict,
        blank=True,
        help_text="Original failed/missing gates before authorized override"
    )

    # Ownership Transfer & Audit
    previous_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transferred_from_handoffs"
    )
    ownership_transferred_at = models.DateTimeField(null=True, blank=True)

    # SLA Tracking
    sla_duration_hours = models.PositiveIntegerField(default=48, help_text="SLA hours allowed for Sales Acceptance review")
    sql_ready_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    sla_expires_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=32,
        choices=HandoffStatus.choices,
        default=HandoffStatus.PENDING,
        db_index=True
    )
    decision_date = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(
        blank=True,
        null=True,
        help_text="Mandatory if Sales rejects the SQL handoff"
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        acc_name = self.account.company_name if self.account else (self.lead.account.company_name if self.lead else "Unknown")
        return f"SQL Handoff #{str(self.id)[:8]} - {acc_name} [{self.status}]"

    @property
    def is_sla_overdue(self):
        from django.utils import timezone
        if self.status == HandoffStatus.PENDING and self.sla_expires_at:
            return timezone.now() > self.sla_expires_at
        return False

    @property
    def sla_remaining_hours(self):
        from django.utils import timezone
        if self.status == HandoffStatus.PENDING and self.sla_expires_at:
            delta = self.sla_expires_at - timezone.now()
            return round(delta.total_seconds() / 3600.0, 1)
        return 0.0
