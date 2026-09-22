from django.contrib import admin
from .models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "phone",
        "company_name",
        "converted_at",
        "created_by",
    )

    search_fields = (
        "name",
        "phone",
        "email",
        "company_name",
    )