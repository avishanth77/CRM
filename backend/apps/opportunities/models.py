import uuid
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel
from apps.accounts.models import Account, Contact
from apps.products.models import Product, ProductCapability
from apps.pld_engine.models import PipelineStage
from apps.sales_handoff.models import SQLHandoff


class OpportunityType(models.TextChoices):
    NEW = 'NEW', 'New Business'
    EXPANSION = 'EXPANSION', 'Expansion / Cross-Sell'
    RENEWAL = 'RENEWAL', 'Contract Renewal'


class OpportunityStatus(models.TextChoices):
    OPEN = 'OPEN', 'Open'
    WON = 'WON', 'Closed Won'
    LOST = 'LOST', 'Closed Lost'


class Opportunity(BaseModel):
    """
    Commercial opportunity lifecycle entity.
    Supports multi-product line items, versioned proposals, and discount thresholds.
    """
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="opportunities")
    primary_contact = models.ForeignKey(
        Contact,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="opportunities"
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owned_opportunities"
    )
    sql_handoff = models.OneToOneField(
        SQLHandoff,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="converted_opportunity"
    )
    opportunity_type = models.CharField(
        max_length=32,
        choices=OpportunityType.choices,
        default=OpportunityType.NEW,
        db_index=True
    )
    stage = models.ForeignKey(
        PipelineStage,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="opportunities"
    )
    status = models.CharField(
        max_length=32,
        choices=OpportunityStatus.choices,
        default=OpportunityStatus.OPEN,
        db_index=True
    )

    # Commercial parameters
    total_contract_value = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    arr_mrr = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    pricing_plan = models.CharField(max_length=128, blank=True, null=True)
    seat_units_count = models.PositiveIntegerField(default=1)
    contract_term_months = models.PositiveIntegerField(default=12)
    currency = models.CharField(max_length=8, default='USD')
    probability_pct = models.PositiveIntegerField(default=50)
    expected_close_date = models.DateField(null=True, blank=True)

    # Carried Forward PLD & Technical Evaluation Details
    pld_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="Carried-forward PLD Fit Score")
    sql_date = models.DateField(null=True, blank=True, help_text="Date SQL handoff was accepted")
    decision_maker = models.CharField(max_length=255, blank=True, null=True, help_text="Confirmed economic decision maker")
    implementation_scope = models.TextField(blank=True, null=True, help_text="Rollout scope, users, geographical coverage")
    erp_system = models.CharField(max_length=128, blank=True, null=True, help_text="Primary ERP / Backend System (e.g., SAP, Oracle, Odoo)")
    integration_requirements = models.TextField(blank=True, null=True, help_text="Integration connectors, protocols, APIs needed")
    poc_result = models.TextField(blank=True, null=True, help_text="POC outcome / baseline vs achieved result")

    # Competitor & Loss Analysis
    competitor = models.CharField(max_length=128, blank=True, null=True)
    loss_reason_category = models.CharField(max_length=128, blank=True, null=True)
    loss_reason_notes = models.TextField(blank=True, null=True)

    # Activity tracking & SLA
    last_activity_at = models.DateTimeField(null=True, blank=True)
    next_activity_due_at = models.DateTimeField(null=True, blank=True)
    next_action_description = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        ordering = ['-expected_close_date', '-created_at']

    def __str__(self):
        return f"Opp #{str(self.id)[:8]} - {self.account.company_name} ({self.total_contract_value} {self.currency})"


class OpportunityProduct(BaseModel):
    """
    Multi-product line items on an opportunity.
    Allows VanForces + TaskForces ERP on the same commercial deal.
    """
    opportunity = models.ForeignKey(Opportunity, on_delete=models.CASCADE, related_name="product_lines")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="opportunity_lines")
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    term_months = models.PositiveIntegerField(default=12)

    class Meta:
        unique_together = ('opportunity', 'product')

    def __str__(self):
        return f"{self.opportunity}: {self.product.name} ({self.total_amount})"


class OpportunityCapability(BaseModel):
    """
    Specific capabilities committed or required in this commercial opportunity.
    """
    opportunity = models.ForeignKey(Opportunity, on_delete=models.CASCADE, related_name="required_capabilities")
    capability = models.ForeignKey(ProductCapability, on_delete=models.CASCADE, related_name="opportunity_commitments")

    class Meta:
        unique_together = ('opportunity', 'capability')


class ProposalStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    SUBMITTED = 'SUBMITTED', 'Submitted to Client'
    APPROVED = 'APPROVED', 'Internally Approved'
    REJECTED = 'REJECTED', 'Client Rejected'
    EXPIRED = 'EXPIRED', 'Expired'


class Proposal(BaseModel):
    """
    Versioned commercial proposal / quote document.
    """
    opportunity = models.ForeignKey(Opportunity, on_delete=models.CASCADE, related_name="proposals")
    version_number = models.PositiveIntegerField(default=1)
    proposal_document_url = models.URLField(max_length=512, blank=True, null=True)
    gross_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    net_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    valid_until = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=32,
        choices=ProposalStatus.choices,
        default=ProposalStatus.DRAFT
    )
    approval_required_flag = models.BooleanField(default=False)

    class Meta:
        ordering = ['opportunity', '-version_number']

    def __str__(self):
        return f"Proposal v{self.version_number} - {self.opportunity} [{self.net_amount}]"
