import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.core.models import BaseModel
from apps.accounts.models import Account
from apps.leads.models import Lead


# ==============================================================================
# 1. ACTIVITIES & ACTIVITY STATUS
# ==============================================================================

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
    PARTNER_FOLLOWUP = 'PARTNER_FOLLOWUP', 'Partner Follow-up'
    DEAL_REGISTRATION = 'DEAL_REGISTRATION', 'Deal Registration'
    ENABLEMENT = 'ENABLEMENT', 'Partner Enablement'
    TRAINING = 'TRAINING', 'Partner Training'
    CUSTOMER_INTRODUCTION = 'CUSTOMER_INTRODUCTION', 'Customer Introduction'
    OPPORTUNITY_SUPPORT = 'OPPORTUNITY_SUPPORT', 'Opportunity Support'
    PROPOSAL_SENT = 'PROPOSAL_SENT', 'Proposal Sent'
    PROPOSAL_REVIEW = 'PROPOSAL_REVIEW', 'Proposal Review'
    NEGOTIATION = 'NEGOTIATION', 'Commercial Negotiation'
    CUSTOM = 'CUSTOM', 'Custom Activity'


class ActivityStatus(models.TextChoices):
    PLANNED = 'PLANNED', 'Planned'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'
    RESCHEDULED = 'RESCHEDULED', 'Rescheduled'


class ActivityPriority(models.TextChoices):
    LOW = 'LOW', 'Low'
    MEDIUM = 'MEDIUM', 'Medium'
    HIGH = 'HIGH', 'High'
    CRITICAL = 'CRITICAL', 'Critical'


class Activity(BaseModel):
    """
    Unified activity stream across Account, Lead, Opportunity, Proposal, Demo, and POC.
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
    demo = models.ForeignKey(
        'evaluations.Demo',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activities"
    )
    poc = models.ForeignKey(
        'evaluations.POC',
        on_delete=models.SET_NULL,
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
    proposal = models.ForeignKey(
        'opportunities.Proposal',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activities"
    )
    partner = models.ForeignKey(
        'partners.Partner',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="activities"
    )
    deal_registration = models.ForeignKey(
        'partners.DealRegistration',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activities"
    )

    activity_type = models.CharField(max_length=32, choices=ActivityType.choices, default=ActivityType.CALL)
    custom_activity_type = models.CharField(max_length=64, blank=True, null=True, help_text="Configurable custom activity category")
    subject = models.CharField(max_length=255)
    description_notes = models.TextField(blank=True, null=True)
    conducted_at = models.DateTimeField(default=timezone.now)
    duration_minutes = models.PositiveIntegerField(default=30, blank=True, null=True)
    status = models.CharField(max_length=32, choices=ActivityStatus.choices, default=ActivityStatus.COMPLETED, db_index=True)
    outcome_notes = models.TextField(blank=True, null=True)

    # Next Action Mandatory Tracking
    next_action_description = models.CharField(max_length=255, blank=True, null=True)
    next_action_due_at = models.DateTimeField(null=True, blank=True)

    priority = models.CharField(max_length=16, choices=ActivityPriority.choices, default=ActivityPriority.MEDIUM)

    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="performed_activities"
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_activities"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_activities"
    )

    class Meta:
        ordering = ['-conducted_at']
        indexes = [
            models.Index(fields=['conducted_at']),
            models.Index(fields=['activity_type']),
            models.Index(fields=['status']),
            models.Index(fields=['next_action_due_at']),
        ]

    def __str__(self):
        return f"[{self.get_activity_type_display()}] {self.subject} ({self.conducted_at.strftime('%Y-%m-%d')})"

    @property
    def next_action_status(self):
        """
        Calculates operational next action state:
        NO_NEXT_ACTION, OVERDUE, DUE_TODAY, DUE_SOON, SCHEDULED
        """
        if not self.next_action_due_at:
            return 'NO_NEXT_ACTION'
        now = timezone.now()
        if self.next_action_due_at < now:
            return 'OVERDUE'
        if self.next_action_due_at.date() == now.date():
            return 'DUE_TODAY'
        if self.next_action_due_at <= now + timezone.timedelta(hours=48):
            return 'DUE_SOON'
        return 'SCHEDULED'


# ==============================================================================
# 2. TASKS & TASK MANAGEMENT
# ==============================================================================

class TaskPriority(models.TextChoices):
    LOW = 'LOW', 'Low'
    MEDIUM = 'MEDIUM', 'Medium'
    HIGH = 'HIGH', 'High'
    CRITICAL = 'CRITICAL', 'Critical'
    URGENT = 'URGENT', 'Urgent'


class TaskStatus(models.TextChoices):
    OPEN = 'OPEN', 'Open'
    IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'
    OVERDUE = 'OVERDUE', 'Overdue'


class Task(BaseModel):
    """
    Actionable task generated automatically by PLD events, next actions, or manually by users.
    Linkable to Lead, Opportunity, Account, Contact, Discovery, Demo, POC, Proposal, and SQL Handoff.
    """
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assigned_tasks"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_tasks"
    )

    # CRM Lifecycle Links
    related_account = models.ForeignKey(Account, on_delete=models.CASCADE, null=True, blank=True, related_name="tasks")
    related_contact = models.ForeignKey('accounts.Contact', on_delete=models.CASCADE, null=True, blank=True, related_name="tasks")
    related_lead = models.ForeignKey(Lead, on_delete=models.CASCADE, null=True, blank=True, related_name="tasks")
    related_opportunity = models.ForeignKey(
        'opportunities.Opportunity',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="tasks"
    )
    related_discovery = models.ForeignKey('discovery.Discovery', on_delete=models.SET_NULL, null=True, blank=True, related_name="tasks")
    related_demo = models.ForeignKey('evaluations.Demo', on_delete=models.SET_NULL, null=True, blank=True, related_name="tasks")
    related_poc = models.ForeignKey('evaluations.POC', on_delete=models.SET_NULL, null=True, blank=True, related_name="tasks")
    related_proposal = models.ForeignKey('opportunities.Proposal', on_delete=models.SET_NULL, null=True, blank=True, related_name="tasks")
    related_handoff = models.ForeignKey('sales_handoff.SQLHandoff', on_delete=models.SET_NULL, null=True, blank=True, related_name="tasks")
    source_activity = models.ForeignKey(Activity, on_delete=models.SET_NULL, null=True, blank=True, related_name="generated_tasks")

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
            ('RE_ENGAGEMENT', 'Nurture Re-engagement'),
            ('SALES_ACCEPTANCE', 'Sales Acceptance Review'),
            ('PROPOSAL_FOLLOWUP', 'Proposal Follow-up'),
            ('INACTIVITY_CHECK', 'Inactive Account / Opportunity Check'),
            ('GENERAL', 'General Task')
        ],
        default='FOLLOW_UP'
    )
    priority = models.CharField(max_length=16, choices=TaskPriority.choices, default=TaskPriority.MEDIUM)
    due_date = models.DateTimeField()
    status = models.CharField(max_length=32, choices=TaskStatus.choices, default=TaskStatus.OPEN, db_index=True)
    is_completed = models.BooleanField(default=False, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['is_completed', 'due_date']
        indexes = [
            models.Index(fields=['assigned_to', 'status']),
            models.Index(fields=['due_date']),
            models.Index(fields=['is_completed', 'due_date']),
        ]

    def __str__(self):
        status = "Done" if self.is_completed else self.status
        return f"Task: {self.title} [{status}]"

    def save(self, *args, **kwargs):
        if self.is_completed and self.status != TaskStatus.COMPLETED:
            self.status = TaskStatus.COMPLETED
            if not self.completed_at:
                self.completed_at = timezone.now()
        elif self.status == TaskStatus.COMPLETED and not self.is_completed:
            self.is_completed = True
            if not self.completed_at:
                self.completed_at = timezone.now()
        elif not self.is_completed and self.status == TaskStatus.COMPLETED:
            self.status = TaskStatus.OPEN
            self.completed_at = None
        super().save(*args, **kwargs)

    @property
    def is_overdue(self):
        if not self.is_completed and self.status not in [TaskStatus.COMPLETED, TaskStatus.CANCELLED]:
            due = self.due_date
            if due and timezone.is_naive(due):
                due = timezone.make_aware(due)
            return due < timezone.now() if due else False
        return False


# ==============================================================================
# 3. CENTRALIZED NOTIFICATIONS SYSTEM
# ==============================================================================

class NotificationType(models.TextChoices):
    NEW_LEAD = 'NEW_LEAD', 'New Lead Created'
    LEAD_ASSIGNED = 'LEAD_ASSIGNED', 'Lead Assigned'
    NO_CONTACT = 'NO_CONTACT', 'No Contact SLA Alert'
    NO_NEXT_ACTION = 'NO_NEXT_ACTION', 'Missing Next Action'
    HIGH_PLD_SCORE = 'HIGH_PLD_SCORE', 'High PLD Score Alert'
    SQL_READY = 'SQL_READY', 'SQL Ready for Sales Acceptance'
    SALES_ACCEPTANCE_DUE = 'SALES_ACCEPTANCE_DUE', 'Sales Acceptance Due Soon'
    SALES_ACCEPTANCE_BREACHED = 'SALES_ACCEPTANCE_BREACHED', 'Sales Acceptance SLA Breached'
    POC_REVIEW = 'POC_REVIEW', 'POC Review Due'
    PROPOSAL_EXPIRING = 'PROPOSAL_EXPIRING', 'Proposal Approaching Expiry'
    PROPOSAL_EXPIRED = 'PROPOSAL_EXPIRED', 'Proposal Expired'
    OPPORTUNITY_INACTIVE = 'OPPORTUNITY_INACTIVE', 'Inactive Opportunity Escalation'
    SLA_AT_RISK = 'SLA_AT_RISK', 'SLA at Risk'
    SLA_BREACHED = 'SLA_BREACHED', 'SLA Breached'
    NURTURE_REENGAGEMENT = 'NURTURE_REENGAGEMENT', 'Nurture Re-engagement Due'
    TASK_DUE = 'TASK_DUE', 'Task Due'
    TASK_OVERDUE = 'TASK_OVERDUE', 'Task Overdue'
    DEAL_REGISTRATION_SUBMITTED = 'DEAL_REGISTRATION_SUBMITTED', 'Deal Registration Submitted'
    DEAL_REGISTRATION_APPROVED = 'DEAL_REGISTRATION_APPROVED', 'Deal Registration Approved'
    DEAL_REGISTRATION_REJECTED = 'DEAL_REGISTRATION_REJECTED', 'Deal Registration Rejected'
    CHANNEL_CONFLICT_DETECTED = 'CHANNEL_CONFLICT_DETECTED', 'Channel Conflict Detected'
    CHANNEL_CONFLICT_RESOLVED = 'CHANNEL_CONFLICT_RESOLVED', 'Channel Conflict Resolved'
    PARTNER_AUTH_CHANGED = 'PARTNER_AUTH_CHANGED', 'Partner Authorization Changed'
    CERTIFICATION_EXPIRING = 'CERTIFICATION_EXPIRING', 'Partner Certification Expiring'
    PARTNER_STATUS_CHANGED = 'PARTNER_STATUS_CHANGED', 'Partner Status Changed'
    PARTNER_OPPORTUNITY_INFLUENCE = 'PARTNER_OPPORTUNITY_INFLUENCE', 'Partner Opportunity Influence Recorded'
    CAMPAIGN_ALERT = 'CAMPAIGN_ALERT', 'Campaign Alert'
    GENERAL = 'GENERAL', 'System Notification'


class NotificationPriority(models.TextChoices):
    LOW = 'LOW', 'Low'
    MEDIUM = 'MEDIUM', 'Medium'
    HIGH = 'HIGH', 'High'
    CRITICAL = 'CRITICAL', 'Critical'


class Notification(BaseModel):
    """
    Centralized in-app notification record with prioritization, read status, and deep linking.
    """
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=48, choices=NotificationType.choices, default=NotificationType.GENERAL, db_index=True)
    priority = models.CharField(max_length=16, choices=NotificationPriority.choices, default=NotificationPriority.MEDIUM, db_index=True)
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    # Polymorphic linking to CRM records for deep-linking
    related_entity_type = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    related_entity_id = models.UUIDField(null=True, blank=True, db_index=True)
    action_url = models.CharField(max_length=255, blank=True, null=True)

    email_dispatched = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['notification_type']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"[{self.notification_type}] to {self.recipient.email}: {self.title}"

    def mark_as_read(self):
        self.is_read = True
        self.read_at = timezone.now()
        self.save(update_fields=['is_read', 'read_at'])


# ==============================================================================
# 4. CONFIGURABLE SLA ENGINE
# ==============================================================================

class SLAEntityType(models.TextChoices):
    LEAD_RESPONSE = 'LEAD_RESPONSE', 'Lead First Response SLA'
    SQL_ACCEPTANCE = 'SQL_ACCEPTANCE', 'SQL Sales Acceptance SLA'
    FIRST_FOLLOWUP = 'FIRST_FOLLOWUP', 'Discovery Follow-up SLA'
    OPPORTUNITY_INACTIVITY = 'OPPORTUNITY_INACTIVITY', 'Opportunity Inactivity Limit'
    PROPOSAL_FOLLOWUP = 'PROPOSAL_FOLLOWUP', 'Proposal Follow-up SLA'
    NURTURE_REVIEW = 'NURTURE_REVIEW', 'Nurture Periodic Review SLA'


class SLAStatus(models.TextChoices):
    WITHIN_SLA = 'WITHIN_SLA', 'Within SLA'
    DUE_SOON = 'DUE_SOON', 'Due Soon'
    AT_RISK = 'AT_RISK', 'At Risk'
    BREACHED = 'BREACHED', 'Breached'
    COMPLETED = 'COMPLETED', 'Completed'


class SLAEscalationAction(models.TextChoices):
    NOTIFY_OWNER = 'NOTIFY_OWNER', 'Notify Owner Only'
    NOTIFY_MANAGER = 'NOTIFY_MANAGER', 'Notify Owner & Manager'
    CREATE_TASK = 'CREATE_TASK', 'Create Escalation Task'
    FULL_ESCALATION = 'FULL_ESCALATION', 'Full Escalation (Notify & Task)'


class SLADefinition(BaseModel):
    """
    Configurable SLA governance definition across CRM lifecycle stages.
    """
    name = models.CharField(max_length=128)
    entity_type = models.CharField(max_length=48, choices=SLAEntityType.choices, unique=True)
    target_duration_hours = models.PositiveIntegerField(default=48, help_text="Target hours to fulfill SLA")
    warning_threshold_pct = models.PositiveIntegerField(
        default=75,
        help_text="Percentage of SLA duration elapsed when Due Soon / At Risk triggers (e.g. 75%)"
    )
    escalation_role = models.CharField(max_length=64, default='SALES_MANAGER')
    escalation_action = models.CharField(max_length=32, choices=SLAEscalationAction.choices, default=SLAEscalationAction.FULL_ESCALATION)
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"SLA: {self.name} ({self.target_duration_hours}h)"


class SLATracker(BaseModel):
    """
    Active or historical tracking instance of an SLA attached to a CRM record.
    """
    definition = models.ForeignKey(SLADefinition, on_delete=models.CASCADE, related_name="tracked_instances")
    entity_type = models.CharField(max_length=64, db_index=True)
    entity_id = models.UUIDField(db_index=True)
    assigned_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tracked_slas"
    )
    start_time = models.DateTimeField(default=timezone.now)
    due_time = models.DateTimeField()
    completed_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=32, choices=SLAStatus.choices, default=SLAStatus.WITHIN_SLA, db_index=True)
    is_escalated = models.BooleanField(default=False)
    escalated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['due_time']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['due_time']),
            models.Index(fields=['entity_type', 'entity_id']),
        ]

    def __str__(self):
        return f"SLA Tracker: {self.definition.name} [{self.status}]"

    @property
    def remaining_hours(self):
        if self.status == SLAStatus.COMPLETED:
            return 0.0
        delta = self.due_time - timezone.now()
        return round(delta.total_seconds() / 3600.0, 1)

    def calculate_status(self):
        if self.completed_time:
            self.status = SLAStatus.COMPLETED
            return self.status

        now = timezone.now()
        if now > self.due_time:
            self.status = SLAStatus.BREACHED
        else:
            total_duration = (self.due_time - self.start_time).total_seconds()
            if total_duration > 0:
                elapsed = (now - self.start_time).total_seconds()
                pct_elapsed = (elapsed / total_duration) * 100
                if pct_elapsed >= self.definition.warning_threshold_pct:
                    self.status = SLAStatus.AT_RISK
                elif pct_elapsed >= (self.definition.warning_threshold_pct * 0.8):
                    self.status = SLAStatus.DUE_SOON
                else:
                    self.status = SLAStatus.WITHIN_SLA
            else:
                self.status = SLAStatus.BREACHED
        return self.status


# ==============================================================================
# 5. CONFIGURABLE AUTOMATION ENGINE
# ==============================================================================

class AutomationTrigger(models.TextChoices):
    ON_LEAD_CREATE = 'ON_LEAD_CREATE', 'On New Lead Created'
    ON_SCORE_UPDATE = 'ON_SCORE_UPDATE', 'On PLD Score Update'
    ON_POC_COMPLETE = 'ON_POC_COMPLETE', 'On POC Trial Completed'
    ON_SQL_READY = 'ON_SQL_READY', 'On Lead Becoming SQL Ready'
    SCHEDULED_NO_CONTACT = 'SCHEDULED_NO_CONTACT', 'Scheduled: No-Contact Check'
    SCHEDULED_NO_NEXT_ACTION = 'SCHEDULED_NO_NEXT_ACTION', 'Scheduled: No-Next-Action Check'
    SCHEDULED_PROPOSAL_EXPIRY = 'SCHEDULED_PROPOSAL_EXPIRY', 'Scheduled: Proposal Expiry Check'
    SCHEDULED_OPPORTUNITY_INACTIVITY = 'SCHEDULED_OPPORTUNITY_INACTIVITY', 'Scheduled: Inactive Opportunity Check'
    SCHEDULED_NURTURE_REENGAGEMENT = 'SCHEDULED_NURTURE_REENGAGEMENT', 'Scheduled: Nurture Re-engagement Check'


class AutomationAction(models.TextChoices):
    ASSIGN_OWNER = 'ASSIGN_OWNER', 'Assign Owner'
    CREATE_TASK = 'CREATE_TASK', 'Create Task'
    SEND_NOTIFICATION = 'SEND_NOTIFICATION', 'Send Notification'
    ESCALATE_SLA = 'ESCALATE_SLA', 'Escalate SLA'
    MARK_EXPIRED = 'MARK_EXPIRED', 'Mark Expired'
    MULTI_ACTION = 'MULTI_ACTION', 'Execute Multi-Step Automation'


class AutomationRule(BaseModel):
    """
    Configurable automation rule: Trigger + Conditions + Action + Logging.
    """
    name = models.CharField(max_length=128)
    trigger_type = models.CharField(max_length=48, choices=AutomationTrigger.choices, unique=True)
    is_active = models.BooleanField(default=True)
    conditions_json = models.JSONField(
        default=dict,
        blank=True,
        help_text="Configurable criteria: e.g. {'threshold_score': 80, 'inactivity_days': 14, 'no_contact_hours': 48}"
    )
    action_type = models.CharField(max_length=32, choices=AutomationAction.choices, default=AutomationAction.MULTI_ACTION)
    action_config_json = models.JSONField(
        default=dict,
        blank=True,
        help_text="Configurable action params: e.g. {'assignee_role': 'PLD_EXECUTIVE', 'task_priority': 'HIGH'}"
    )
    last_run_at = models.DateTimeField(null=True, blank=True)
    execution_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['name']

    def __str__(self):
        state = "Active" if self.is_active else "Disabled"
        return f"Rule: {self.name} [{state}]"


class AutomationExecutionLog(BaseModel):
    """
    Auditable history of every automated event executed by the CRM automation engine.
    """
    rule = models.ForeignKey(AutomationRule, on_delete=models.CASCADE, related_name="execution_logs")
    trigger_event = models.CharField(max_length=64)
    target_entity_type = models.CharField(max_length=64)
    target_entity_id = models.UUIDField()
    status = models.CharField(max_length=16, choices=[('SUCCESS', 'Success'), ('SKIPPED', 'Skipped'), ('FAILED', 'Failed')])
    details = models.TextField(blank=True, null=True)
    executed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-executed_at']
        indexes = [
            models.Index(fields=['rule', 'executed_at']),
        ]

    def __str__(self):
        return f"[{self.status}] {self.rule.name} -> {self.target_entity_type} #{str(self.target_entity_id)[:8]}"
