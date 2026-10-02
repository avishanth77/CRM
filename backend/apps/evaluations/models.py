import uuid
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel
from apps.accounts.models import Account
from apps.leads.models import Lead
from apps.discovery.models import Discovery


class DemoStatus(models.TextChoices):
    SCHEDULED = 'SCHEDULED', 'Scheduled'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'
    NOT_REQUIRED = 'NOT_REQUIRED', 'Not Required (Optional Stage Skipped)'


class Demo(BaseModel):
    """
    Demo evaluation record.
    Links to Lead/Discovery and Account; Opportunity link is optional.
    Stage completion requires: participants + use cases + feedback + next action.
    """
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="demos")
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="demos")
    discovery = models.ForeignKey(Discovery, on_delete=models.SET_NULL, null=True, blank=True, related_name="demos")
    opportunity = models.ForeignKey(
        'opportunities.Opportunity',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="demos"
    )

    presenter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="presented_demos"
    )
    scheduled_at = models.DateTimeField()
    conducted_at = models.DateTimeField(null=True, blank=True)
    participants_notes = models.TextField(blank=True, null=True, help_text="Attendees and client stakeholders")
    demonstrated_use_cases = models.JSONField(
        default=list,
        blank=True,
        help_text="Capabilities and scenarios demonstrated"
    )
    customer_feedback = models.TextField(blank=True, null=True)
    objections_raised = models.TextField(blank=True, null=True)
    fit_assessment = models.CharField(
        max_length=32,
        choices=[('STRONG', 'Strong Fit'), ('MODERATE', 'Moderate Fit'), ('POOR', 'Poor Fit')],
        default='STRONG'
    )
    status = models.CharField(
        max_length=32,
        choices=DemoStatus.choices,
        default=DemoStatus.SCHEDULED,
        db_index=True
    )
    not_required_reason = models.TextField(
        blank=True,
        null=True,
        help_text="Mandatory if stage is skipped as Not Required in an optional pipeline"
    )

    # Mandatory next action
    next_action_due_at = models.DateTimeField(null=True, blank=True)
    next_action_description = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        ordering = ['-scheduled_at']

    def __str__(self):
        return f"Demo #{str(self.id)[:8]} - {self.account.company_name} [{self.status}]"


class POCStatus(models.TextChoices):
    PLANNED = 'PLANNED', 'Planned'
    ACTIVE = 'ACTIVE', 'Active / In Progress'
    REVIEW = 'REVIEW', 'Under Review'
    COMPLETED = 'COMPLETED', 'Completed Successfully'
    FAILED = 'FAILED', 'Failed'
    CANCELLED = 'CANCELLED', 'Cancelled'
    NOT_REQUIRED = 'NOT_REQUIRED', 'Not Required (Optional Stage Skipped)'


class POC(BaseModel):
    """
    Proof of Concept / Pilot evaluation.
    Tracks baseline KPIs, targets, and verified results before commercial commitment.
    """
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="pocs")
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="pocs")
    discovery = models.ForeignKey(Discovery, on_delete=models.SET_NULL, null=True, blank=True, related_name="pocs")
    opportunity = models.ForeignKey(
        'opportunities.Opportunity',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pocs"
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_pocs"
    )
    scope_description = models.TextField(help_text="Pilot parameters: products, routes, outlets, or modules")
    users_count = models.PositiveIntegerField(default=1, help_text="Number of active pilot users/salesmen")
    geography_coverage = models.CharField(max_length=255, blank=True, null=True)
    start_date = models.DateField()
    end_date = models.DateField()

    success_criteria = models.JSONField(
        default=list,
        help_text="Documented criteria agreeing on what constitutes POC success"
    )
    baseline_metrics = models.JSONField(
        default=dict,
        blank=True,
        help_text="Starting baseline KPI values (e.g. {'route_adherence': '62%'})"
    )
    result_metrics = models.JSONField(
        default=dict,
        blank=True,
        help_text="Achieved result KPI values (e.g. {'route_adherence': '84%'})"
    )
    customer_feedback = models.TextField(blank=True, null=True)
    status = models.CharField(
        max_length=32,
        choices=POCStatus.choices,
        default=POCStatus.PLANNED,
        db_index=True
    )
    not_required_reason = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return f"POC #{str(self.id)[:8]} - {self.account.company_name} [{self.status}]"
