import uuid
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel
from apps.accounts.models import Account, Contact
from apps.products.models import Product, Problem, ProblemCategory
from apps.pld_engine.models import PipelineStage


class LeadSource(BaseModel):
    """
    Lead origination channels (Website, LinkedIn, WhatsApp, Referral, Partner, etc.).
    """
    code = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=128)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Campaign(BaseModel):
    """
    Marketing campaign tracking for multi-touch attribution and ROI.
    """
    code = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    campaign_type = models.CharField(max_length=64, blank=True, null=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    budget = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    def __str__(self):
        return f"{self.name} ({self.code})"


class LeadStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active / In Progress'
    NURTURE = 'NURTURE', 'Nurture'
    DISQUALIFIED = 'DISQUALIFIED', 'Disqualified'
    CONVERTED = 'CONVERTED', 'Converted to SQL'


class Lead(BaseModel):
    """
    Generic commercial lead entity representing an inquiry / prospect interest.
    """
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="leads")
    contact = models.ForeignKey(Contact, on_delete=models.SET_NULL, null=True, blank=True, related_name="leads")
    primary_product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="primary_leads")
    source = models.ForeignKey(LeadSource, on_delete=models.SET_NULL, null=True, blank=True, related_name="leads")
    partner = models.ForeignKey(
        'partners.Partner',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="originated_leads"
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owned_leads"
    )
    current_stage = models.ForeignKey(
        PipelineStage,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="active_leads"
    )
    status = models.CharField(
        max_length=32,
        choices=LeadStatus.choices,
        default=LeadStatus.ACTIVE,
        db_index=True
    )
    nurture_reason = models.TextField(blank=True, null=True)
    disqualification_reason = models.TextField(blank=True, null=True)

    # Activity & Mandatory Next Action enforcement
    last_activity_at = models.DateTimeField(null=True, blank=True)
    next_activity_due_at = models.DateTimeField(null=True, blank=True)
    next_action_description = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Lead #{str(self.id)[:8]} - {self.account.company_name} [{self.primary_product.code}]"


class LeadProductInterest(BaseModel):
    """
    Multi-product interest matrix.
    A lead can express interest in VanForces, TaskForces, and EntAura simultaneously.
    """
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="product_interests")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="lead_interests")
    interest_level = models.CharField(
        max_length=16,
        choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High')],
        default='HIGH'
    )
    is_primary = models.BooleanField(default=False)
    evidence_notes = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ('lead', 'product')

    def __str__(self):
        return f"{self.lead} -> {self.product.name} ({self.interest_level})"


class LeadTouch(BaseModel):
    """
    Multi-touch attribution record.
    Tracks every campaign, partner, and touchpoint influencing the lead throughout its lifecycle.
    """
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="touches")
    campaign = models.ForeignKey(Campaign, on_delete=models.SET_NULL, null=True, blank=True, related_name="touches")
    partner = models.ForeignKey(
        'partners.Partner',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="touches"
    )
    source = models.ForeignKey(LeadSource, on_delete=models.SET_NULL, null=True, blank=True, related_name="touches")
    touch_type = models.CharField(max_length=64, default="Inbound Form")
    touch_date = models.DateTimeField(auto_now_add=True)
    utm_parameters = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-touch_date']


class LeadProblem(BaseModel):
    """
    Initial business problems identified during lead qualification.
    Carried forward automatically into Discovery without requiring re-entry.
    """
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="recorded_problems")
    problem = models.ForeignKey(Problem, on_delete=models.CASCADE, related_name="lead_occurrences")
    category = models.CharField(
        max_length=32,
        choices=ProblemCategory.choices,
        default=ProblemCategory.DISTRIBUTION,
        db_index=True
    )
    severity = models.CharField(
        max_length=16,
        choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High'), ('CRITICAL', 'Critical')],
        default='HIGH'
    )
    frequency = models.CharField(
        max_length=16,
        choices=[('DAILY', 'Daily'), ('WEEKLY', 'Weekly'), ('MONTHLY', 'Monthly'), ('OCCASIONAL', 'Occasional')],
        default='DAILY'
    )
    business_impact = models.TextField(blank=True, null=True, help_text="Quantified loss or consequence")
    affected_users = models.CharField(max_length=255, blank=True, null=True)
    evidence = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ('lead', 'problem')

    def __str__(self):
        return f"{self.lead}: {self.problem.name} [{self.severity}]"
