import uuid
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel
from apps.products.models import Product


class AccountType(models.TextChoices):
    PROSPECT = 'PROSPECT', 'Prospect'
    CUSTOMER = 'CUSTOMER', 'Customer'
    PARTNER = 'PARTNER', 'Partner'
    VENDOR = 'VENDOR', 'Vendor'


class Account(BaseModel):
    """
    Universal commercial organisation entity.
    Maintains clean generic core with product-specific attributes held in AccountAttribute.
    """
    company_name = models.CharField(max_length=255, db_index=True)
    legal_name = models.CharField(max_length=255, blank=True, null=True)
    trade_name = models.CharField(max_length=255, blank=True, null=True)
    account_type = models.CharField(
        max_length=32,
        choices=AccountType.choices,
        default=AccountType.PROSPECT,
        db_index=True
    )
    industry = models.CharField(max_length=128, blank=True, null=True, db_index=True)
    sub_industry = models.CharField(max_length=128, blank=True, null=True)
    country = models.CharField(max_length=128, default='Saudi Arabia')
    state = models.CharField(max_length=128, blank=True, null=True)
    city = models.CharField(max_length=128, blank=True, null=True)
    company_size_band = models.CharField(max_length=64, blank=True, null=True)
    website = models.URLField(max_length=255, blank=True, null=True)
    domain = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    phone = models.CharField(max_length=64, blank=True, null=True)
    
    # Generic core operational metrics
    employees_count = models.PositiveIntegerField(default=0)
    distribution_centers_count = models.PositiveIntegerField(default=0)

    primary_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_accounts"
    )

    # Target Account & Origination Tracking
    is_target_account = models.BooleanField(default=False, db_index=True)
    target_tier = models.CharField(
        max_length=32,
        choices=[
            ('TIER_1', 'Tier 1 - Strategic'),
            ('TIER_2', 'Tier 2 - High Priority'),
            ('TIER_3', 'Tier 3 - Standard')
        ],
        blank=True,
        null=True
    )
    source = models.CharField(max_length=128, blank=True, null=True, help_text="Origination source / channel")
    partner = models.ForeignKey(
        'partners.Partner',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sourced_accounts"
    )

    # Activity tracking & SLA
    last_activity_at = models.DateTimeField(null=True, blank=True)
    next_activity_due_at = models.DateTimeField(null=True, blank=True)
    next_action_description = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        ordering = ['company_name']

    def __str__(self):
        return f"{self.company_name} ({self.get_account_type_display()})"


class AccountAttribute(BaseModel):
    """
    EAV / JSONB dynamic attributes per Product x Account.
    Allows VanForces attributes (salesmen, vans, outlets, SKUs, ERP) without polluting Account schema.
    """
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="custom_attributes")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="account_attributes")
    attribute_key = models.CharField(max_length=128, db_index=True)
    attribute_value = models.JSONField(
        help_text="Stores typed value: int, string, array, or object"
    )

    class Meta:
        unique_together = ('account', 'product', 'attribute_key')

    def __str__(self):
        return f"{self.account.company_name} [{self.product.code}]: {self.attribute_key} = {self.attribute_value}"


class ContactRoleType(models.TextChoices):
    DECISION_MAKER = 'DECISION_MAKER', 'Decision Maker'
    CHAMPION = 'CHAMPION', 'Champion'
    INFLUENCER = 'INFLUENCER', 'Influencer'
    TECHNICAL = 'TECHNICAL', 'Technical / IT'
    FINANCE = 'FINANCE', 'Finance'
    USER = 'USER', 'End User'


class Contact(BaseModel):
    """
    Individual stakeholders associated with an Account.
    """
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="contacts")
    first_name = models.CharField(max_length=128)
    last_name = models.CharField(max_length=128, blank=True, null=True)
    designation = models.CharField(max_length=128, blank=True, null=True)
    email = models.EmailField(blank=True, null=True, db_index=True)
    phone = models.CharField(max_length=64, blank=True, null=True)
    mobile = models.CharField(max_length=64, blank=True, null=True)
    linkedin_url = models.URLField(blank=True, null=True)
    role_type = models.CharField(
        max_length=32,
        choices=ContactRoleType.choices,
        default=ContactRoleType.INFLUENCER
    )
    decision_level = models.CharField(max_length=64, blank=True, null=True)
    preferred_channel = models.CharField(
        max_length=32,
        choices=[('EMAIL', 'Email'), ('PHONE', 'Phone'), ('WHATSAPP', 'WhatsApp'), ('LINKEDIN', 'LinkedIn')],
        default='EMAIL'
    )
    is_primary = models.BooleanField(default=False)
    consent_status = models.BooleanField(default=True)

    class Meta:
        ordering = ['account', 'first_name', 'last_name']

    def __str__(self):
        return f"{self.first_name} {self.last_name or ''} ({self.designation or 'Contact'}) - {self.account.company_name}"


class AccountProductStatus(models.TextChoices):
    PROSPECT = 'PROSPECT', 'Prospect'
    EVALUATION = 'EVALUATION', 'Evaluation / Trial'
    CUSTOMER = 'CUSTOMER', 'Active Customer'
    INACTIVE = 'INACTIVE', 'Inactive'
    EXPANSION = 'EXPANSION', 'Expansion Candidate'


class AccountProduct(BaseModel):
    """
    Tracks the continuous commercial relationship of an Account to each TEXOL product.
    Enables true multi-product cross-selling and product lifecycle tracking.
    """
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="product_relationships")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="account_relationships")
    status = models.CharField(
        max_length=32,
        choices=AccountProductStatus.choices,
        default=AccountProductStatus.PROSPECT
    )
    contract_value = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    arr_mrr = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    renewal_date = models.DateField(null=True, blank=True)
    health_score = models.PositiveIntegerField(default=100)

    class Meta:
        unique_together = ('account', 'product')

    def __str__(self):
        return f"{self.account.company_name} ↔ {self.product.name} [{self.status}]"
