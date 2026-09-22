from django.db import models
from django.conf import settings


class Customer(models.Model):

    lead = models.OneToOneField(
        "leads.Lead",
        on_delete=models.PROTECT,
        related_name="customer",
    )

    name = models.CharField(max_length=150)

    phone = models.CharField(max_length=20)

    email = models.EmailField(blank=True)

    company_name = models.CharField(
        max_length=200,
        blank=True,
    )

    address = models.TextField(blank=True)

    converted_at = models.DateTimeField(
        auto_now_add=True
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_customers",
    )

    def __str__(self):
        return self.name