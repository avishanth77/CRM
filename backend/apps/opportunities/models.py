import uuid
from decimal import Decimal
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.core.models import BaseModel
from apps.accounts.models import Account, Contact
from apps.products.models import Product, ProductCapability, ProductModule
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

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="opportunities"
    )
    total_contract_value = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    arr = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="Annual Recurring Revenue")
    mrr = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="Monthly Recurring Revenue")
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


class OpportunityModule(BaseModel):
    """
    Product Modules included or configured within this opportunity.
    Preserves Opportunity -> Product -> Modules relationship per Section 17.
    """
    opportunity = models.ForeignKey(Opportunity, on_delete=models.CASCADE, related_name="selected_modules")
    module = models.ForeignKey('products.ProductModule', on_delete=models.CASCADE, related_name="opportunity_assignments")
    is_included = models.BooleanField(default=True)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        unique_together = ('opportunity', 'module')

    def __str__(self):
        return f"{self.opportunity} -> {self.module.name}"


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
    PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
    APPROVED = 'APPROVED', 'Internally Approved'
    REJECTED = 'REJECTED', 'Client Rejected'
    SENT = 'SENT', 'Sent to Client'
    SUBMITTED = 'SUBMITTED', 'Submitted to Client'
    ACCEPTED = 'ACCEPTED', 'Accepted by Client'
    EXPIRED = 'EXPIRED', 'Expired'
    SUPERSEDED = 'SUPERSEDED', 'Superseded'


class Proposal(BaseModel):
    """
    Commercial Proposal envelope entity belonging to an Opportunity.
    Supports versioning, multi-product line items, discount thresholds, and approvals.
    """
    opportunity = models.ForeignKey(Opportunity, on_delete=models.CASCADE, related_name="proposals")
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="proposals", null=True, blank=True)
    primary_contact = models.ForeignKey(Contact, on_delete=models.SET_NULL, null=True, blank=True, related_name="proposals")
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True, related_name="proposals")
    proposal_number = models.CharField(max_length=64, db_index=True, blank=True, default='')
    title = models.CharField(max_length=255, blank=True, default='')
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owned_proposals"
    )
    version_number = models.PositiveIntegerField(default=1, help_text="Current active version number")
    status = models.CharField(
        max_length=32,
        choices=ProposalStatus.choices,
        default=ProposalStatus.DRAFT,
        db_index=True
    )
    currency = models.CharField(max_length=8, default='USD')
    valid_from = models.DateField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True, help_text="Expiry date of current proposal version")
    gross_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    discount_reason = models.TextField(blank=True, default='')
    tax_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    net_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    contract_term_months = models.PositiveIntegerField(default=12)
    payment_terms = models.CharField(max_length=128, blank=True, default='Net 30 Days')
    approval_required_flag = models.BooleanField(default=False)
    proposal_document_url = models.URLField(max_length=512, blank=True, null=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_proposals"
    )
    sent_to = models.CharField(max_length=255, blank=True, default='')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['opportunity', '-version_number', '-created_at']

    def is_expired(self):
        if self.valid_until:
            return timezone.now().date() > self.valid_until
        return False

    def save(self, *args, **kwargs):
        if not self.account and self.opportunity:
            self.account = self.opportunity.account
        if not self.primary_contact and self.opportunity:
            self.primary_contact = self.opportunity.primary_contact
        if not self.product and self.opportunity:
            self.product = self.opportunity.product
        if not self.owner and self.opportunity:
            self.owner = self.opportunity.owner
        if not self.currency and self.opportunity:
            self.currency = self.opportunity.currency
        if not self.proposal_number:
            import random
            rand_suffix = f"{random.randint(1000, 9999)}"
            self.proposal_number = f"PROP-{timezone.now().year}-{rand_suffix}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.proposal_number} v{self.version_number} - {self.opportunity.account.company_name} ({self.net_amount} {self.currency})"


class ProposalVersion(BaseModel):
    """
    Immutable historical version of a commercial proposal.
    Each version preserves line items, pricing, discount, approval status, and audit history.
    """
    proposal = models.ForeignKey(Proposal, on_delete=models.CASCADE, related_name="versions")
    version_number = models.PositiveIntegerField(default=1)
    status = models.CharField(
        max_length=32,
        choices=ProposalStatus.choices,
        default=ProposalStatus.DRAFT,
        db_index=True
    )
    currency = models.CharField(max_length=8, default='USD')
    valid_from = models.DateField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)
    gross_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    discount_reason = models.TextField(blank=True, default='')
    tax_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    net_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    contract_term_months = models.PositiveIntegerField(default=12)
    payment_terms = models.CharField(max_length=128, blank=True, default='Net 30 Days')
    approval_required_flag = models.BooleanField(default=False)
    approval_request = models.ForeignKey(
        'workflows.Approval',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="proposal_versions"
    )
    proposal_document_url = models.URLField(max_length=512, blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_proposal_versions"
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_proposal_versions"
    )
    sent_to = models.CharField(max_length=255, blank=True, default='')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['proposal', '-version_number']
        unique_together = ('proposal', 'version_number')

    def is_expired(self):
        if self.valid_until:
            return timezone.now().date() > self.valid_until
        return False

    def __str__(self):
        return f"{self.proposal.proposal_number} v{self.version_number} [{self.status}] - {self.net_amount} {self.currency}"


class ProposalItem(BaseModel):
    """
    Commercial line item on a proposal version.
    Supports Product, Module, and Capability breakdown with safe decimal financial precision.
    """
    proposal_version = models.ForeignKey(ProposalVersion, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name="proposal_items")
    module = models.ForeignKey('products.ProductModule', on_delete=models.SET_NULL, null=True, blank=True, related_name="proposal_items")
    capability = models.ForeignKey('products.ProductCapability', on_delete=models.SET_NULL, null=True, blank=True, related_name="proposal_items")
    description = models.CharField(max_length=255, blank=True, default='')
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        ordering = ['created_at']

    def calculate_line_total(self):
        gross = Decimal(self.quantity) * Decimal(self.unit_price)
        if self.discount_pct > 0:
            disc = (gross * (Decimal(self.discount_pct) / Decimal('100'))).quantize(Decimal('0.01'))
            self.discount_amount = disc
        else:
            disc = Decimal(self.discount_amount or 0)
        self.line_total = max(Decimal('0.00'), gross - disc).quantize(Decimal('0.01'))
        return self.line_total

    def save(self, *args, **kwargs):
        self.calculate_line_total()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Line Item: {self.description or self.product.name} (Qty: {self.quantity}, Total: {self.line_total})"


class ApprovalRuleType(models.TextChoices):
    DISCOUNT_PERCENT = 'DISCOUNT_PERCENT', 'Discount Percentage Threshold'
    TOTAL_VALUE = 'TOTAL_VALUE', 'Total Proposal Value Threshold'
    PRICING_EXCEPTION = 'PRICING_EXCEPTION', 'Pricing Exception'
    COMMERCIAL_EXCEPTION = 'COMMERCIAL_EXCEPTION', 'Commercial Exception'


class ApprovalRule(BaseModel):
    """
    Configurable approval rules determining whether commercial proposals
    require management approval before sending to client.
    """
    rule_name = models.CharField(max_length=128)
    rule_type = models.CharField(max_length=32, choices=ApprovalRuleType.choices, default=ApprovalRuleType.DISCOUNT_PERCENT)
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="approval_rules",
        help_text="Null product means rule applies globally across all products"
    )
    threshold_value = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        help_text="Threshold, e.g. 15.00 for 15% discount, or 100000.00 for deal value"
    )
    approver_role = models.CharField(max_length=64, default='SALES_MANAGER')
    approval_sequence = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['approval_sequence', '-created_at']

    def __str__(self):
        return f"Rule: {self.rule_name} [{self.rule_type} >= {self.threshold_value}]"

