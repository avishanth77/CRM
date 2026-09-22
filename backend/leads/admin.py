from django.contrib import admin
from .models import Lead, LeadSource, LeadNote, ActivityLog


@admin.register(LeadSource)
class LeadSourceAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "is_active",
    )

    list_filter = (
        "is_active",
    )


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "phone",
        "company_name",
        "status",
        "priority",
        "assigned_to",
        "created_at",
    )

    list_filter = (
        "status",
        "priority",
        "source",
    )

    search_fields = (
        "name",
        "phone",
        "email",
        "company_name",
    )


@admin.register(LeadNote)
class LeadNoteAdmin(admin.ModelAdmin):
    list_display = (
        "lead",
        "note_type",
        "user",
        "created_at",
    )


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = (
        "entity_type",
        "action",
        "performed_by",
        "created_at",
    )

    list_filter = (
        "entity_type",
        "action",
    )