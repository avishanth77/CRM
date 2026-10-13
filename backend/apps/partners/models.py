import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.core.models import BaseModel
from apps.accounts.models import Account, Contact
from apps.products.models import Product


# ==============================================================================
# 1. PARTNER TYPES & LIFECYCLE
# ==============================================================================

class PartnerType(models.TextChoices):
    ERP = 'ERP', 'ERP Partner'
    SAP = 'SAP', 'SAP Partner'
    MICROSOFT = 'MICROSOFT', 'Microsoft Partner'
    ODOO = 'ODOO', 'Odoo Partner'
    POS = 'POS', 'POS Provider'
    SI = 'SI', 'System Integrator'
    CONSULTANT = 'CONSULTANT', 'Distribution Consultant'
    MOBILITY = 'MOBILITY', 'Mobility Partner'
    REFERRAL = 'REFERRAL', 'Referral Partner'


class PartnerTypeMaster(BaseModel):
    """
    Configurable Master Data for Partner Types.
    Allows administrators to configure, activate, and extend partner types
    without hard-coding business logic.
    """
    code = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"


class PartnerStatus(models.TextChoices):
    PROSPECT = 'PROSPECT', 'Prospect'
    ONBOARDING = 'ONBOARDING', 'Onboarding'
    ENABLED = 'ENABLED', 'Enabled'
    AUTHORISED = 'AUTHORISED', 'Authorised'
    ACTIVE = 'ACTIVE', 'Active'
    SUSPENDED = 'SUSPENDED', 'Suspended'
    INACTIVE = 'INACTIVE', 'Inactive'


# ==============================================================================
# 2. PARTNER ORGANISATION
# ==============================================================================

class Partner(BaseModel):
    """
    Partner organization master entity.
    Keeps Partner as a separate business entity linked to Account.
    """
    account = models.OneToOneField(
        Account,
        on_delete=models.CASCADE,
        related_name="partner_profile",
        help_text="The Account record representing the partner organization"
    )
    partner_code = models.CharField(max_length=64, unique=True)
    partner_type = models.CharField(max_length=32, choices=PartnerType.choices, default=PartnerType.ERP)
    partner_type_master = models.ForeignKey(
        PartnerTypeMaster,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="partners"
    )
    territory = models.CharField(max_length=128, default='GCC / Middle East')
    authorized_territories = models.JSONField(default=list, blank=True)
    status = models.CharField(
        max_length=32,
        choices=PartnerStatus.choices,
        default=PartnerStatus.ONBOARDING,
        db_index=True
    )
    status_change_date = models.DateTimeField(default=timezone.now, null=True, blank=True)
    status_change_reason = models.TextField(blank=True, null=True)
    partner_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_partners"
    )
    notes = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['account__company_name']

    def __str__(self):
        return f"Partner: {self.account.company_name} [{self.partner_code}]"

    @property
    def partner_type_display_name(self):
        if self.partner_type_master:
            return self.partner_type_master.name
        return self.get_partner_type_display()


# ==============================================================================
# 3. PARTNER USERS
# ==============================================================================

class PartnerUser(BaseModel):
    """
    Links portal user to their partner organization for strict server-side tenant isolation.
    """
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name="users")
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="partner_profile"
    )
    partner_role = models.CharField(
        max_length=32,
        choices=[('ADMIN', 'Partner Admin'), ('SALES', 'Partner Sales'), ('PRESALES', 'Partner Presales')],
        default='SALES'
    )
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.user.email} ({self.partner.account.company_name})"


# ==============================================================================
# 4. PARTNER PRODUCT & TERRITORY AUTHORIZATION
# ==============================================================================

class PartnerProduct(BaseModel):
    """
    Authorized / certified products per partner and territory.
    """
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name="authorized_products")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="partner_authorizations")
    authorization_status = models.CharField(
        max_length=32,
        choices=[
            ('CERTIFIED', 'Certified'),
            ('AUTHORIZED', 'Authorized'),
            ('EVALUATION', 'Under Evaluation'),
            ('REVOKED', 'Revoked')
        ],
        default='AUTHORIZED'
    )
    territory = models.CharField(max_length=128, blank=True, null=True)
    commission_rate_pct = models.DecimalField(max_digits=5, decimal_places=2, default=15.00)
    valid_from = models.DateField(default=timezone.now)
    valid_to = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ('partner', 'product')

    def __str__(self):
        return f"{self.partner.account.company_name} ↔ {self.product.name} ({self.authorization_status})"


class PartnerTerritory(BaseModel):
    """
    Configurable territory authorization per partner organization.
    """
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name="territory_authorizations")
    territory = models.CharField(max_length=128)
    is_primary = models.BooleanField(default=False)
    is_exclusive = models.BooleanField(default=False)
    status = models.CharField(
        max_length=32,
        choices=[('ACTIVE', 'Active'), ('PENDING', 'Pending Review'), ('REVOKED', 'Revoked')],
        default='ACTIVE'
    )

    class Meta:
        ordering = ['territory']

    def __str__(self):
        return f"{self.partner.account.company_name} - {self.territory} [{self.status}]"


# ==============================================================================
# 5. PARTNER CERTIFICATION FOUNDATION
# ==============================================================================

class PartnerCertification(BaseModel):
    """
    Foundation for Partner Certification tracking across products and capabilities.
    """
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name="certifications")
    certification_name = models.CharField(max_length=255)
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="partner_certifications"
    )
    status = models.CharField(
        max_length=32,
        choices=[
            ('ACTIVE', 'Active'),
            ('EXPIRED', 'Expired'),
            ('PENDING', 'Pending Verification'),
            ('REVOKED', 'Revoked')
        ],
        default='ACTIVE'
    )
    issue_date = models.DateField(default=timezone.now)
    expiry_date = models.DateField(null=True, blank=True)
    credential_id = models.CharField(max_length=128, blank=True, null=True)
    evidence_url = models.CharField(max_length=512, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-issue_date']

    def __str__(self):
        return f"{self.partner.account.company_name} - {self.certification_name} [{self.status}]"


# ==============================================================================
# 6. DEAL REGISTRATION & LIFECYCLE
# ==============================================================================

class DealRegistrationStatus(models.TextChoices):
    SUBMITTED = 'SUBMITTED', 'Submitted'
    UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
    ACCEPTED = 'ACCEPTED', 'Accepted & Protected'
    REJECTED = 'REJECTED', 'Rejected'
    EXPIRED = 'EXPIRED', 'Expired'
    CANCELLED = 'CANCELLED', 'Cancelled'


class DealRegistration(BaseModel):
    """
    Protected deal registration submitted by partner.
    Guarantees deal exclusivity window if approved.
    """
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name="deal_registrations")
    registered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submitted_deal_registrations"
    )
    customer_account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="deal_registrations"
    )
    contact = models.ForeignKey(
        Contact,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="deal_registrations"
    )
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="deal_registrations")
    territory = models.CharField(max_length=128, blank=True, null=True)
    expected_deal_value = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    expected_close_date = models.DateField(null=True, blank=True)
    evidence_notes = models.TextField(help_text="Evidence of customer relationship and qualification")
    protection_expiry_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=32,
        choices=DealRegistrationStatus.choices,
        default=DealRegistrationStatus.SUBMITTED,
        db_index=True
    )
    rejection_reason = models.TextField(blank=True, null=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_deal_registrations"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    opportunity = models.ForeignKey(
        'opportunities.Opportunity',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="deal_registrations"
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Deal Reg #{str(self.id)[:8]}: {self.partner.account.company_name} -> {self.customer_account.company_name}"


# ==============================================================================
# 7. CHANNEL CONFLICT MANAGEMENT
# ==============================================================================

class ChannelConflictType(models.TextChoices):
    DUPLICATE_REGISTRATION = 'DUPLICATE_REGISTRATION', 'Duplicate Deal Registration'
    PARTNER_VS_DIRECT = 'PARTNER_VS_DIRECT', 'Partner Claim vs Direct Account/Lead'
    CAMPAIGN_VS_PARTNER = 'CAMPAIGN_VS_PARTNER', 'Campaign Lead vs Partner Claim'
    MULTI_PARTNER = 'MULTI_PARTNER', 'Multiple Partners Claiming Same Account'
    TERRITORY_CONFLICT = 'TERRITORY_CONFLICT', 'Territory Authorization Conflict'


class ChannelConflictStatus(models.TextChoices):
    DETECTED = 'DETECTED', 'Detected / Pending Review'
    UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
    RESOLVED = 'RESOLVED', 'Resolved'
    DISMISSED = 'DISMISSED', 'Dismissed'


class ChannelConflictDecision(models.TextChoices):
    PENDING = 'PENDING', 'Pending Decision'
    AWARD_TO_PARTNER = 'AWARD_TO_PARTNER', 'Award to Registering Partner'
    AWARD_TO_COMPETITOR = 'AWARD_TO_COMPETITOR', 'Award to Incumbent / Competing Partner'
    AWARD_TO_DIRECT = 'AWARD_TO_DIRECT', 'Retain as Direct TEXOL Lead'
    SPLIT_COMMISSION = 'SPLIT_COMMISSION', 'Split Commission / Shared Influence'
    REJECTED = 'REJECTED', 'Reject Partner Claim'


class ChannelConflict(BaseModel):
    """
    Channel conflict record capturing multi-partner or direct-vs-partner overlaps.
    Provides governance workflow, reviewer decision, reason, and audit trail.
    """
    conflict_type = models.CharField(
        max_length=48,
        choices=ChannelConflictType.choices,
        default=ChannelConflictType.DUPLICATE_REGISTRATION
    )
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name="channel_conflicts")
    competing_partner = models.ForeignKey(
        Partner,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="competing_channel_conflicts"
    )
    deal_registration = models.ForeignKey(
        DealRegistration,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conflicts"
    )
    lead = models.ForeignKey(
        'leads.Lead',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="channel_conflicts"
    )
    opportunity = models.ForeignKey(
        'opportunities.Opportunity',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="channel_conflicts"
    )
    customer_account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="channel_conflicts"
    )
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="channel_conflicts")
    status = models.CharField(
        max_length=32,
        choices=ChannelConflictStatus.choices,
        default=ChannelConflictStatus.DETECTED,
        db_index=True
    )
    conflict_details = models.TextField()
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_channel_conflicts"
    )
    decision = models.CharField(
        max_length=48,
        choices=ChannelConflictDecision.choices,
        default=ChannelConflictDecision.PENDING
    )
    decision_reason = models.TextField(blank=True, null=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Conflict #{str(self.id)[:8]}: {self.partner.account.company_name} vs {self.customer_account.company_name} [{self.status}]"


# ==============================================================================
# 8. PARTNER INFLUENCE AT OPPORTUNITY LEVEL
# ==============================================================================

class PartnerInfluence(BaseModel):
    """
    Opportunity-level partner influence tracking.
    Enables partners to influence deals even if they did not create the original lead.
    """
    opportunity = models.ForeignKey(
        'opportunities.Opportunity',
        on_delete=models.CASCADE,
        related_name="partner_influences"
    )
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name="influenced_opportunities")
    influence_type = models.CharField(
        max_length=32,
        choices=[
            ('ORIGINATOR', 'Originator'),
            ('SPONSOR', 'Sponsor'),
            ('CO_SELLER', 'Co-Seller'),
            ('IMPLEMENTER', 'Implementer'),
            ('TECHNICAL_ADVISOR', 'Technical Advisor'),
            ('EXECUTIVE_RELATIONSHIP', 'Executive Relationship')
        ],
        default='ORIGINATOR'
    )
    influence_pct = models.PositiveIntegerField(default=100)
    influence_date = models.DateField(default=timezone.now)
    status = models.CharField(
        max_length=32,
        choices=[('CONFIRMED', 'Confirmed'), ('UNDER_REVIEW', 'Under Review'), ('DISPUTED', 'Disputed')],
        default='CONFIRMED'
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recorded_partner_influences"
    )
    notes = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ('opportunity', 'partner')

    def __str__(self):
        return f"{self.partner.account.company_name} -> Opp #{str(self.opportunity_id)[:8]} ({self.influence_type})"


# ==============================================================================
# 9. PARTNER COMMISSION FOUNDATION (CONFIGURABLE - NO HARDCODED FORMULAS)
# ==============================================================================

class PartnerCommission(BaseModel):
    """
    Commercial payout and revenue-share ledger for closed partner deals.
    Foundation ready for future configurable commission rules without hardcoding formulas.
    """
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name="commissions")
    opportunity = models.ForeignKey(
        'opportunities.Opportunity',
        on_delete=models.CASCADE,
        related_name="partner_commissions"
    )
    deal_registration = models.ForeignKey(
        DealRegistration,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="commissions"
    )
    revenue_basis = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    commission_rate_pct = models.DecimalField(max_digits=5, decimal_places=2, default=15.00)
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    currency = models.CharField(max_length=8, default='USD')
    calculation_basis = models.TextField(blank=True, null=True)
    rule_reference = models.CharField(max_length=128, default='Standard Tier Commission')
    payment_status = models.CharField(
        max_length=32,
        choices=[('ACCRUED', 'Accrued'), ('APPROVED', 'Approved'), ('PAID', 'Paid'), ('CANCELLED', 'Cancelled')],
        default='ACCRUED'
    )
    approval_status = models.CharField(
        max_length=32,
        choices=[('PENDING', 'Pending Approval'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected')],
        default='PENDING'
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_partner_commissions"
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.partner.account.company_name}: {self.currency} {self.commission_amount} [{self.payment_status}]"


# ==============================================================================
# 10. CONFIGURABLE PARTNER & CHANNEL SETTINGS
# ==============================================================================

class PartnerChannelConfig(BaseModel):
    """
    Configurable settings for deal protection window, conflict thresholds,
    and default attribution model.
    Avoids hard-coding unresolved TEXOL decisions.
    """
    default_protection_days = models.PositiveIntegerField(default=90)
    allow_grace_period_days = models.PositiveIntegerField(default=14)
    conflict_auto_flag = models.BooleanField(default=True)
    attribution_default_model = models.CharField(max_length=32, default='W_SHAPED')
    partner_attribution_weight_pct = models.DecimalField(max_digits=5, decimal_places=2, default=60.00)
    notes = models.TextField(blank=True, null=True)

    @classmethod
    def get_config(cls):
        cfg = cls.objects.first()
        if not cfg:
            cfg = cls.objects.create(
                default_protection_days=90,
                allow_grace_period_days=14,
                conflict_auto_flag=True,
                attribution_default_model='W_SHAPED',
                partner_attribution_weight_pct=60.00,
                notes="Default channel protection configuration"
            )
        return cfg

    def __str__(self):
        return f"Channel Config (Protection: {self.default_protection_days}d, Model: {self.attribution_default_model})"
