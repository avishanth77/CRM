import uuid
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel


class ProductStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    INTERNAL = 'INTERNAL', 'Internal Testing'
    ACTIVE = 'ACTIVE', 'Active'
    SUNSET = 'SUNSET', 'Sunset'
    ARCHIVED = 'ARCHIVED', 'Archived'


class Product(BaseModel):
    """
    Master product entity (e.g. VanForces, TaskForces ERP, EntAura.AI, AL Mawasil, SpeakOrder).
    """
    code = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=128, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    status = models.CharField(
        max_length=32,
        choices=ProductStatus.choices,
        default=ProductStatus.ACTIVE,
        db_index=True
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owned_products"
    )

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} [{self.code}]"


class ProductModule(BaseModel):
    """
    Modules belonging to a product (e.g. Van Sales, Route Planning, Inventory for VanForces).
    """
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="modules")
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('product', 'code')
        ordering = ['name']

    def __str__(self):
        return f"{self.product.code} - {self.name}"


class ProductCapability(BaseModel):
    """
    Specific capability provided by a module (e.g. Real-time Outlet Geofencing, Van Stock Sync).
    """
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="capabilities")
    module = models.ForeignKey(ProductModule, on_delete=models.CASCADE, related_name="capabilities")
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('product', 'code')
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.module.name})"


class ProblemCategory(models.TextChoices):
    SALES = 'SALES', 'Sales'
    DISTRIBUTION = 'DISTRIBUTION', 'Distribution'
    MANAGEMENT = 'MANAGEMENT', 'Management'
    INTEGRATION = 'INTEGRATION', 'Integration'
    COMPLIANCE = 'COMPLIANCE', 'Compliance & Tax'
    OPERATIONS = 'OPERATIONS', 'Operations'


class Problem(BaseModel):
    """
    Master business problem library.
    Shared taxonomy referenced across all product qualification discovery sessions.
    """
    code = models.CharField(max_length=64, unique=True)
    category = models.CharField(max_length=32, choices=ProblemCategory.choices, db_index=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    default_severity = models.CharField(
        max_length=16,
        choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High'), ('CRITICAL', 'Critical')],
        default='HIGH'
    )

    class Meta:
        ordering = ['category', 'name']

    def __str__(self):
        return f"[{self.category}] {self.name}"


class ProblemCapability(BaseModel):
    """
    Maps business problems to the product capabilities that solve them.
    Used for Discovery completion gate (Discovery cannot complete until mapped).
    """
    problem = models.ForeignKey(Problem, on_delete=models.CASCADE, related_name="capability_mappings")
    capability = models.ForeignKey(ProductCapability, on_delete=models.CASCADE, related_name="problem_mappings")
    expected_kpi_impact = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        unique_together = ('problem', 'capability')

    def __str__(self):
        return f"{self.problem.name} -> {self.capability.name}"
