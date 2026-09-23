from django.contrib import admin

from .models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "name",
        "phone",
        "email",
        "company_name",
        "converted_by",
        "converted_at",
    )

    search_fields = (
        "name",
        "phone",
        "email",
        "company_name",
    )

    list_filter = (
        "converted_at",
    )