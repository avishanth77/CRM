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

    gate_audit_results = models.JSONField(
        default=dict,
        help_text="Snapshot of passed SQL gates at handoff time"
    )
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
        return f"SQL Handoff #{str(self.id)[:8]} - {self.lead.account.company_name} [{self.status}]"
