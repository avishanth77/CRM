import uuid
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel
from apps.accounts.models import Account
from apps.products.models import Product


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


class PartnerStatus(models.TextChoices):
    PROSPECT = 'PROSPECT', 'Prospect'
    ONBOARDING = 'ONBOARDING', 'Onboarding'
    ENABLED = 'ENABLED', 'Enabled'
    AUTHORISED = 'AUTHORISED', 'Authorised'
    ACTIVE = 'ACTIVE', 'Active'
    SUSPENDED = 'SUSPENDED', 'Suspended'
    INACTIVE = 'INACTIVE', 'Inactive'


class Partner(BaseModel):
    """
    Partner organization master entity.
    """
    account = models.OneToOneField(
        Account,
        on_delete=models.CASCADE,
        related_name="partner_profile",
        help_text="The Account record representing the partner organization"
    )
    partner_code = models.CharField(max_length=64, unique=True)
    partner_type = models.CharField(max_length=32, choices=PartnerType.choices, default=PartnerType.ERP)
    territory = models.CharField(max_length=128, default='GCC / Middle East')
    status = models.CharField(
        max_length=32,
        choices=PartnerStatus.choices,
        default=PartnerStatus.ONBOARDING,
        db_index=True
    )
    partner_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_partners"
    )

    class Meta:
        ordering = ['account__company_name']

    def __str__(self):
        return f"Partner: {self.account.company_name} [{self.partner_code}]"


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


class PartnerProduct(BaseModel):
    """
    Authorized / certified products per partner and territory.
    """
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name="authorized_products")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="partner_authorizations")
    authorization_status = models.CharField(
        max_length=32,
        choices=[('CERTIFIED', 'Certified'), ('AUTHORIZED', 'Authorized'), ('EVALUATION', 'Under Evaluation')],
        default='AUTHORIZED'
    )
    territory = models.CharField(max_length=128, blank=True, null=True)
    commission_rate_pct = models.DecimalField(max_digits=5, decimal_places=2, default=15.00)
    valid_from = models.DateField()
    valid_to = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ('partner', 'product')

    def __str__(self):
        return f"{self.partner.account.company_name} ↔ {self.product.name} ({self.authorization_status})"


class DealRegistrationStatus(models.TextChoices):
    SUBMITTED = 'SUBMITTED', 'Submitted'
    UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
    ACCEPTED = 'ACCEPTED', 'Accepted & Protected'
    REJECTED = 'REJECTED', 'Rejected'
    EXPIRED = 'EXPIRED', 'Expired'


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
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="deal_registrations")
    expected_deal_value = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    evidence_notes = models.TextField(help_text="Evidence of customer relationship and qualification")
    protection_expiry_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=32,
        choices=DealRegistrationStatus.choices,
        default=DealRegistrationStatus.SUBMITTED,
        db_index=True
    )
    rejection_reason = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Deal Reg #{str(self.id)[:8]}: {self.partner.account.company_name} -> {self.customer_account.company_name}"


class PartnerCommission(BaseModel):
    """
    Commercial payout and revenue-share ledger for closed partner deals.
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
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    calculation_basis = models.TextField(blank=True, null=True)
    payment_status = models.CharField(
        max_length=32,
        choices=[('ACCRUED', 'Accrued'), ('APPROVED', 'Approved'), ('PAID', 'Paid')],
        default='ACCRUED'
    )
    paid_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.partner.account.company_name}: {self.commission_amount} [{self.payment_status}]"


class PartnerInfluence(BaseModel):
    """
    Opportunity-level partner influence tracking.
    """
    opportunity = models.ForeignKey(
        'opportunities.Opportunity',
        on_delete=models.CASCADE,
        related_name="partner_influences"
    )
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name="influenced_opportunities")
    influence_type = models.CharField(
        max_length=32,
        choices=[('ORIGINATOR', 'Originator'), ('SPONSOR', 'Sponsor'), ('CO_SELLER', 'Co-Seller'), ('IMPLEMENTER', 'Implementer')],
        default='ORIGINATOR'
    )
    influence_pct = models.PositiveIntegerField(default=100)

    class Meta:
        unique_together = ('opportunity', 'partner')
