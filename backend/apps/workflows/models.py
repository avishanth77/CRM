import uuid
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel
from apps.pld_engine.models import PipelineStage


class StageHistory(BaseModel):
    """
    Complete chronological record of every stage transition across all lifecycles.
    Backward movement and stage skipping always require an explanatory reason.
    """
    record_type = models.CharField(
        max_length=64,
        choices=[('LEAD', 'Lead'), ('OPPORTUNITY', 'Opportunity'), ('POC', 'POC'), ('DEAL_REGISTRATION', 'Deal Registration')]
    )
    record_id = models.UUIDField(db_index=True)
    from_stage = models.ForeignKey(
        PipelineStage,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transitions_from"
    )
    to_stage = models.ForeignKey(
        PipelineStage,
        on_delete=models.CASCADE,
        related_name="transitions_to"
    )
    transition_reason = models.TextField(blank=True, null=True)
    is_override = models.BooleanField(default=False)
    override_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_stage_overrides"
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="initiated_stage_transitions"
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.record_type} #{str(self.record_id)[:8]}: {self.from_stage} -> {self.to_stage}"


class ApprovalType(models.TextChoices):
    STAGE_GATE_OVERRIDE = 'STAGE_GATE_OVERRIDE', 'Stage Gate Override'
    DISCOUNT_EXCEPTION = 'DISCOUNT_EXCEPTION', 'Commercial Discount Exception'
    SCORE_OVERRIDE = 'SCORE_OVERRIDE', 'PLD Score Override'


class ApprovalStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Review'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'


class Approval(BaseModel):
    """
    Governance approval workflow for gate overrides, pricing discounts, and score adjustments.
    """
    record_type = models.CharField(max_length=64)
    record_id = models.UUIDField(db_index=True)
    approval_type = models.CharField(max_length=32, choices=ApprovalType.choices)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="requested_approvals"
    )
    approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="decided_approvals"
    )
    status = models.CharField(
        max_length=32,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.PENDING,
        db_index=True
    )
    justification_notes = models.TextField(help_text="Reason why exception is requested")
    decision_notes = models.TextField(blank=True, null=True)
    decision_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Approval [{self.get_approval_type_display()}]: {self.status}"
