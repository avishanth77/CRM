from django.contrib import admin
from .models import FollowUp


@admin.register(FollowUp)
class FollowUpAdmin(admin.ModelAdmin):
    list_display = (
        "lead",
        "assigned_to",
        "follow_up_at",
        "status",
    )

    list_filter = (
        "status",
        "assigned_to",
    )