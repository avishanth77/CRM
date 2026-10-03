import uuid
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel
from apps.accounts.models import Account, Contact, ContactRoleType
from apps.leads.models import Lead, LeadProblem
from apps.products.models import Product, Problem, ProductCapability


class DiscoveryStatus(models.TextChoices):
    IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'


class Discovery(BaseModel):
    """
    Discovery session workspace.
    Refines customer problems, current processes, stakeholders, timeline, and product capability mapping.
    """
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="discoveries")
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="discoveries")
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="discoveries",
        null=True,
        blank=True
    )
    conducted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conducted_discoveries"
    )
    status = models.CharField(
        max_length=32,
        choices=DiscoveryStatus.choices,
        default=DiscoveryStatus.IN_PROGRESS,
        db_index=True
    )

    # Core Discovery Documentation Areas
    current_process_notes = models.TextField(
        blank=True,
        null=True,
        help_text="Current operations, workflows, manual processes, existing systems, operational steps, limitations"
    )
    business_impact_summary = models.TextField(
        blank=True,
        null=True,
        help_text="Overall operational, financial, productivity, customer, and management impact"
    )
    stakeholders_involved_notes = models.TextField(
        blank=True,
        null=True,
        help_text="Buying committee / decision influencers overview"
    )
    decision_process_notes = models.TextField(
        blank=True,
        null=True,
        help_text="Procurement process, buying steps, approval stages, evaluation criteria"
    )
    timeline_notes = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Expected timeline, target go-live, fiscal quarter deadlines"
    )
    expected_decision_date = models.DateField(null=True, blank=True)
    expected_implementation_date = models.DateField(null=True, blank=True)
    budget_notes = models.CharField(max_length=255, blank=True, null=True)
    technical_constraints_notes = models.TextField(blank=True, null=True)
    evidence_notes = models.TextField(blank=True, null=True)

    # Next Action & SLA Integration
    next_action_description = models.CharField(max_length=255, blank=True, null=True)
    next_activity_due_at = models.DateTimeField(null=True, blank=True)
    last_activity_at = models.DateTimeField(null=True, blank=True)

    # Discovery Completion Gate: Must map all confirmed problems to capabilities before Discovery is complete
    is_product_mapping_complete = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        prod_name = self.product.name if self.product else (self.lead.primary_product.name if self.lead else 'Product')
        return f"Discovery #{str(self.id)[:8]} - {self.account.company_name} ({prod_name}) [{self.status}]"

    def save(self, *args, **kwargs):
        if not self.product and self.lead and self.lead.primary_product:
            self.product = self.lead.primary_product
        super().save(*args, **kwargs)


class DiscoveryProblem(BaseModel):
    """
    Refined problem documentation within Discovery.
    Links back to original LeadProblem to avoid data re-entry while capturing Discovery-refined attributes.
    """
    discovery = models.ForeignKey(Discovery, on_delete=models.CASCADE, related_name="problems")
    problem = models.ForeignKey(Problem, on_delete=models.CASCADE, related_name="discovery_occurrences")
    lead_problem = models.ForeignKey(
        LeadProblem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="discovery_problems"
    )

    # Discovery-Refined Attributes (distinguished from original LeadProblem qualification info)
    refined_statement = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Refined statement of the problem in customer's specific operational context"
    )
    category = models.CharField(max_length=64, default='DISTRIBUTION')
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
    impact_description = models.TextField(
        help_text="Detailed operational or financial consequence of this problem"
    )
    quantified_loss_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Estimated financial or time loss per month/year (SAR/USD/Hours)"
    )
    affected_teams = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Teams or user personas affected (e.g. 35 Van Drivers, 4 Dispatchers, CFO)"
    )
    evidence = models.TextField(
        blank=True,
        null=True,
        help_text="Observed evidence, interview quotes, ERP reports, or screenshots"
    )
    notes = models.TextField(blank=True, null=True)
    is_confirmed = models.BooleanField(
        default=True,
        help_text="True if confirmed as an active customer problem requiring product solution"
    )

    class Meta:
        unique_together = ('discovery', 'problem')
        ordering = ['-severity', 'created_at']

    def __str__(self):
        return f"{self.discovery}: {self.problem.name} [{self.severity}]"


class DiscoveryProblemMapping(BaseModel):
    """
    Session-level mapping between a Discovery Problem and a Product Capability.
    Supports Many-to-Many relationships:
    - One problem -> multiple capabilities
    - Multiple problems -> same capability
    """
    discovery_problem = models.ForeignKey(
        DiscoveryProblem,
        on_delete=models.CASCADE,
        related_name="capability_mappings"
    )
    capability = models.ForeignKey(
        ProductCapability,
        on_delete=models.CASCADE,
        related_name="discovery_mappings"
    )
    expected_kpi_impact = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Expected KPI / Value outcome (e.g. 50% faster dispatch, 0% invoice discrepancy)"
    )
    notes = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ('discovery_problem', 'capability')
        ordering = ['discovery_problem', 'capability']

    def __str__(self):
        return f"{self.discovery_problem.problem.name} -> {self.capability.name}"


class DiscoveryStakeholder(BaseModel):
    """
    Key customer stakeholders identified during Discovery.
    Links to Contact and records role, responsibility, involvement, and buying committee position.
    """
    discovery = models.ForeignKey(
        Discovery,
        on_delete=models.CASCADE,
        related_name="stakeholders"
    )
    contact = models.ForeignKey(
        Contact,
        on_delete=models.CASCADE,
        related_name="discovery_participations"
    )
    role_name = models.CharField(
        max_length=128,
        blank=True,
        null=True,
        help_text="Specific title/role in this discovery (e.g. Economic Decision Maker, Fleet Operations Director)"
    )
    decision_role = models.CharField(
        max_length=32,
        choices=ContactRoleType.choices,
        default=ContactRoleType.INFLUENCER
    )
    responsibility = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Areas of responsibility in evaluation/procurement"
    )
    involvement_level = models.CharField(
        max_length=32,
        choices=[('HIGH', 'High'), ('MEDIUM', 'Medium'), ('LOW', 'Low')],
        default='HIGH'
    )
    notes = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ('discovery', 'contact')
        ordering = ['-involvement_level', 'contact__first_name']

    def __str__(self):
        return f"{self.contact.first_name} {self.contact.last_name or ''} ({self.decision_role}) - Discovery #{str(self.discovery.id)[:8]}"
