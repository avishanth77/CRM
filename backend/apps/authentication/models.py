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

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"
