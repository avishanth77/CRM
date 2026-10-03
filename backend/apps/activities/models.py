import uuid
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel
from apps.accounts.models import Account
from apps.leads.models import Lead


class ActivityType(models.TextChoices):
    CALL = 'CALL', 'Phone Call'
    EMAIL = 'EMAIL', 'Email'
    WHATSAPP = 'WHATSAPP', 'WhatsApp'
    MEETING = 'MEETING', 'Meeting'
    DISCOVERY = 'DISCOVERY', 'Discovery Session'
    DEMO = 'DEMO', 'Product Demo'
    POC = 'POC', 'POC Check-in'
    FOLLOW_UP = 'FOLLOW_UP', 'Follow-up'
    SITE_VISIT = 'SITE_VISIT', 'Site Visit'
    PARTNER_MEETING = 'PARTNER_MEETING', 'Partner Meeting'


class Activity(BaseModel):
    """
    Unified activity stream across Account, Lead, and Opportunity.
    Every active record requires documented outcome and next action.
    """
    account = models.ForeignKey(Account, on_delete=models.CASCADE, null=True, blank=True, related_name="activities")
    contact = models.ForeignKey('accounts.Contact', on_delete=models.CASCADE, null=True, blank=True, related_name="activities")
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, null=True, blank=True, related_name="activities")
    discovery = models.ForeignKey(
        'discovery.Discovery',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="activities"
    )
    opportunity = models.ForeignKey(
        'opportunities.Opportunity',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="activities"
    )

    activity_type = models.CharField(max_length=32, choices=ActivityType.choices, default=ActivityType.CALL)
    subject = models.CharField(max_length=255)
    description_notes = models.TextField(blank=True, null=True)
    conducted_at = models.DateTimeField(auto_now_add=True)
    outcome_notes = models.TextField(blank=True, null=True)

    # Next Action Mandatory Field
    next_action_description = models.CharField(max_length=255, blank=True, null=True)
    next_action_due_at = models.DateTimeField(null=True, blank=True)

    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="performed_activities"
    )

    class Meta:
        ordering = ['-conducted_at']

    def __str__(self):
        return f"[{self.get_activity_type_display()}] {self.subject} ({self.conducted_at.strftime('%Y-%m-%d')})"


class TaskPriority(models.TextChoices):
    URGENT = 'URGENT', 'Urgent'
    HIGH = 'HIGH', 'High'
    MEDIUM = 'MEDIUM', 'Medium'
    LOW = 'LOW', 'Low'


class Task(BaseModel):
    """
    Actionable task generated automatically by PLD events or manually by users.
    """
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assigned_tasks"
    )
    related_lead = models.ForeignKey(Lead, on_delete=models.CASCADE, null=True, blank=True, related_name="tasks")
    related_opportunity = models.ForeignKey(
        'opportunities.Opportunity',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="tasks"
    )

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    task_type = models.CharField(
        max_length=64,
        choices=[
            ('FIRST_CONTACT', 'First Contact'),
            ('FOLLOW_UP', 'Follow Up'),
            ('GATE_MISSING', 'Provide Gate Evidence'),
            ('SLA_EXPIRY', 'SLA Approaching Expiry'),
            ('POC_REVIEW', 'POC Review Due'),
            ('RE_ENGAGEMENT', 'Nurture Re-engagement')
        ],
        default='FOLLOW_UP'
    )
    priority = models.CharField(max_length=16, choices=TaskPriority.choices, default=TaskPriority.MEDIUM)
    due_date = models.DateTimeField()
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['is_completed', 'due_date']

    def __str__(self):
        status = "Done" if self.is_completed else "Pending"
        return f"Task: {self.title} [{status}]"
