import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from apps.core.models import BaseModel, Tenant


class UserRole(models.TextChoices):
    ADMIN = 'ADMIN', 'Platform Admin'
    MANAGEMENT = 'MANAGEMENT', 'TEXOL Management'
    SALES_MANAGER = 'SALES_MANAGER', 'Sales Manager'
    SALES_BDM = 'SALES_BDM', 'Sales / BDM'
    PLD_EXECUTIVE = 'PLD_EXECUTIVE', 'PLD Executive'
    SOLUTION_CONSULTANT = 'SOLUTION_CONSULTANT', 'Solution Consultant'
    MARKETING = 'MARKETING', 'Marketing'
    PRODUCT_MANAGER = 'PRODUCT_MANAGER', 'Product Manager'
    CUSTOMER_SUCCESS = 'CUSTOMER_SUCCESS', 'Customer Success'
    PARTNER_MANAGER = 'PARTNER_MANAGER', 'Partner Manager'
    PARTNER_USER = 'PARTNER_USER', 'Partner User'
    FINANCE = 'FINANCE', 'Finance / Operations'


# Documented alias for Sales / BDM
UserRole.AE = UserRole.SALES_BDM


class User(AbstractUser):
    """
    Custom user model supporting RBAC roles, tenant isolation, and partner portal scoping.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="users"
    )
    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=32,
        choices=UserRole.choices,
        default=UserRole.PLD_EXECUTIVE,
        db_index=True
    )
    phone = models.CharField(max_length=32, blank=True, null=True)
    territory = models.CharField(max_length=128, blank=True, null=True)
    is_partner_user = models.BooleanField(default=False)
    team = models.CharField(max_length=128, blank=True, null=True, help_text="Assigned commercial or functional team")
    manager = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="direct_reports",
        help_text="Direct reporting manager for team and approval scoping"
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    ROLE_ALIASES = {
        'ACCOUNT_EXECUTIVE': UserRole.SALES_BDM,
        'AE': UserRole.SALES_BDM,
        'SALES_REP': UserRole.SALES_BDM,
        'SDR': UserRole.PLD_EXECUTIVE,
        'SOLUTIONS_CONSULTANT': UserRole.SOLUTION_CONSULTANT,
        'SALES_MGR': UserRole.SALES_MANAGER,
        'MGMT': UserRole.MANAGEMENT,
        'CS': UserRole.CUSTOMER_SUCCESS,
        'PROD_MGR': UserRole.PRODUCT_MANAGER,
        'PARTNER_MGR': UserRole.PARTNER_MANAGER,
    }

    @property
    def canonical_role(self) -> str:
        """
        Normalizes role aliases consistently into one of the 12 primary UserRole codes.
        """
        raw = str(self.role or '').strip().upper()
        return self.ROLE_ALIASES.get(raw, raw)

    @property
    def is_global_scope(self) -> bool:
        """Tier 1: Global Scope (ADMIN, MANAGEMENT)"""
        return self.is_superuser or self.canonical_role in [UserRole.ADMIN, UserRole.MANAGEMENT]

    @property
    def is_territory_scope(self) -> bool:
        """Tier 2: Territory / Team Scope (SALES_MANAGER, PARTNER_MANAGER)"""
        return self.canonical_role in [UserRole.SALES_MANAGER, UserRole.PARTNER_MANAGER]

    @property
    def is_owner_scope(self) -> bool:
        """Tier 3: Owner / Functional Scope"""
        return self.canonical_role in [
            UserRole.SALES_BDM,
            UserRole.PLD_EXECUTIVE,
            UserRole.SOLUTION_CONSULTANT,
            UserRole.MARKETING,
            UserRole.PRODUCT_MANAGER,
            UserRole.CUSTOMER_SUCCESS,
            UserRole.FINANCE,
        ]

    @property
    def is_partner_scope(self) -> bool:
        """Tier 4: Partner Tenant Scope (PARTNER_USER)"""
        return bool(self.is_partner_user or self.canonical_role == UserRole.PARTNER_USER)

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"

