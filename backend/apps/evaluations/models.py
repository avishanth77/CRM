import uuid
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel
from apps.accounts.models import Account, Contact
from apps.leads.models import Lead, LeadProblem
from apps.discovery.models import Discovery, DiscoveryProblem
from apps.products.models import Product, ProductModule, ProductCapability


class DemoStatus(models.TextChoices):
    PLANNED = 'PLANNED', 'Planned'
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
    product = models.ForeignKey(
        Product,
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
    participants_notes = models.TextField(blank=True, null=True, help_text="Summary of attendees and client stakeholders")
    demonstrated_use_cases = models.JSONField(
        default=list,
        blank=True,
        help_text="Legacy list of capabilities and scenarios demonstrated"
    )
    customer_feedback = models.TextField(blank=True, null=True, help_text="Detailed post-demo customer feedback")
    objections_raised = models.TextField(blank=True, null=True, help_text="Customer objections or technical concerns raised")
    customer_questions = models.TextField(blank=True, null=True, help_text="Key questions asked during demo")
    customer_response = models.TextField(blank=True, null=True, help_text="Customer overall sentiment and buying interest")
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
    next_action_description = models.CharField(max_length=255, blank=True, null=True)
    next_action_due_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-scheduled_at']

    def __str__(self):
        return f"Demo #{str(self.id)[:8]} - {self.account.company_name} [{self.status}]"


class DemoParticipant(BaseModel):
    """
    Identifies customer contacts and internal team members attending a Demo session.
    """
    demo = models.ForeignKey(Demo, on_delete=models.CASCADE, related_name="participants")
    contact = models.ForeignKey(Contact, on_delete=models.SET_NULL, null=True, blank=True, related_name="demo_attendances")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="demo_attendances")
    name = models.CharField(max_length=255, blank=True)
    email = models.CharField(max_length=255, blank=True)
    participant_type = models.CharField(
        max_length=32,
        choices=[('CUSTOMER', 'Customer Participant'), ('INTERNAL', 'Internal Team / Presenter')],
        default='CUSTOMER'
    )
    role_title = models.CharField(max_length=128, blank=True)
    attended = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['participant_type', 'name']

    def __str__(self):
        return f"{self.name or self.contact or self.user} ({self.participant_type}) - Demo #{str(self.demo_id)[:8]}"


class DemoUseCaseMapping(BaseModel):
    """
    Maps specific Discovery problems and Product Capabilities to what was presented in the Demo.
    Preserves end-to-end traceability without duplicate data entry.
    """
    demo = models.ForeignKey(Demo, on_delete=models.CASCADE, related_name="use_cases")
    discovery_problem = models.ForeignKey(DiscoveryProblem, on_delete=models.SET_NULL, null=True, blank=True, related_name="demo_use_cases")
    lead_problem = models.ForeignKey(LeadProblem, on_delete=models.SET_NULL, null=True, blank=True, related_name="demo_use_cases")
    module = models.ForeignKey(ProductModule, on_delete=models.SET_NULL, null=True, blank=True, related_name="demo_use_cases")
    capability = models.ForeignKey(ProductCapability, on_delete=models.SET_NULL, null=True, blank=True, related_name="demo_use_cases")
    notes = models.TextField(blank=True, help_text="Notes on how capability resolves the specific problem")
    was_demonstrated = models.BooleanField(default=True)

    class Meta:
        ordering = ['demo', 'created_at']

    def __str__(self):
        cap_name = self.capability.name if self.capability else "Custom Use Case"
        return f"Demo #{str(self.demo_id)[:8]} -> {cap_name}"


class POCStatus(models.TextChoices):
    PLANNED = 'PLANNED', 'Planned'
    APPROVED = 'APPROVED', 'Approved'
    ACTIVE = 'ACTIVE', 'Active / In Progress'
    REVIEW = 'REVIEW', 'Under Review'
    COMPLETED = 'COMPLETED', 'Completed Successfully'
    FAILED = 'FAILED', 'Failed'
    CANCELLED = 'CANCELLED', 'Cancelled'
    NOT_REQUIRED = 'NOT_REQUIRED', 'Not Required (Optional Stage Skipped)'


class POC(BaseModel):
    """
    Proof of Concept / Pilot evaluation.
    Tracks pilot scope, users, geography, baseline KPIs, targets, and verified results before commercial commitment.
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
    product = models.ForeignKey(
        Product,
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
    geography_coverage = models.CharField(max_length=255, blank=True, null=True, help_text="Deployment location e.g. Riyadh Central Fleet")
    start_date = models.DateField()
    end_date = models.DateField()

    success_criteria = models.JSONField(
        default=list,
        blank=True,
        help_text="Documented criteria agreeing on what constitutes POC success"
    )
    baseline_metrics = models.JSONField(
        default=dict,
        blank=True,
        help_text="Starting baseline KPI values (e.g. {'route_adherence': '62%'})"
    )
    baseline_notes = models.TextField(blank=True, null=True, help_text="Customer pre-pilot workflow and operational baseline notes")
    result_metrics = models.JSONField(
        default=dict,
        blank=True,
        help_text="Achieved result KPI values (e.g. {'route_adherence': '84%'})"
    )
    results_summary = models.TextField(blank=True, null=True, help_text="Summary of trial results, variances, and evidence")
    customer_feedback = models.TextField(blank=True, null=True, help_text="Documented post-trial customer evaluation")
    status = models.CharField(
        max_length=32,
        choices=POCStatus.choices,
        default=POCStatus.PLANNED,
        db_index=True
    )
    not_required_reason = models.TextField(blank=True, null=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Mandatory next action
    next_action_description = models.CharField(max_length=255, blank=True, null=True)
    next_action_due_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return f"POC #{str(self.id)[:8]} - {self.account.company_name} [{self.status}]"


class POCSuccessCriterion(BaseModel):
    """
    Specific, measurable success criterion for a POC trial.
    Keeps KPI definitions configurable per customer/product rather than fixed.
    """
    poc = models.ForeignKey(POC, on_delete=models.CASCADE, related_name="criteria_items")
    name = models.CharField(max_length=255, help_text="Name of criterion (e.g. Daily Van Cash Reconciliation)")
    category = models.CharField(max_length=128, blank=True, default="PERFORMANCE")
    measurement_baseline = models.CharField(max_length=255, help_text="Current baseline measurement (e.g. 4.5 hours)")
    expected_target = models.CharField(max_length=255, help_text="Target threshold for success (e.g. < 30 minutes)")
    actual_result = models.CharField(max_length=255, blank=True, help_text="Measured result upon pilot completion")
    is_met = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['poc', 'created_at']

    def __str__(self):
        return f"Criterion: {self.name} (Target: {self.expected_target}) - POC #{str(self.poc_id)[:8]}"


class POCParticipant(BaseModel):
    """
    Identifies pilot salesmen, fleet supervisors, and internal engineers participating in the trial.
    """
    poc = models.ForeignKey(POC, on_delete=models.CASCADE, related_name="participants")
    contact = models.ForeignKey(Contact, on_delete=models.SET_NULL, null=True, blank=True, related_name="poc_participations")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="poc_participations")
    name = models.CharField(max_length=255, blank=True)
    email = models.CharField(max_length=255, blank=True)
    participant_type = models.CharField(
        max_length=32,
        choices=[('CUSTOMER', 'Customer Pilot User'), ('INTERNAL', 'Internal Lead / Engineer')],
        default='CUSTOMER'
    )
    role_title = models.CharField(max_length=128, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['participant_type', 'name']

    def __str__(self):
        return f"{self.name or self.contact or self.user} ({self.participant_type}) - POC #{str(self.poc_id)[:8]}"
