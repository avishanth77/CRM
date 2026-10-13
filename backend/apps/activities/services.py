import uuid
from datetime import timedelta
from decimal import Decimal
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.conf import settings
from django.core.exceptions import ValidationError, PermissionDenied

from apps.activities.models import (
    Activity, ActivityType, ActivityStatus, ActivityPriority,
    Task, TaskStatus, TaskPriority,
    Notification, NotificationType, NotificationPriority,
    SLADefinition, SLATracker, SLAEntityType, SLAStatus, SLAEscalationAction,
    AutomationRule, AutomationTrigger, AutomationAction, AutomationExecutionLog
)
from apps.audit_logging.models import AuditLog, AuditAction
from apps.authentication.models import User, UserRole
from apps.leads.models import Lead, LeadStatus
from apps.opportunities.models import Opportunity, OpportunityStatus, Proposal, ProposalStatus
from apps.sales_handoff.models import SQLHandoff, HandoffStatus


# ==============================================================================
# EMAIL NOTIFICATION ADAPTER (Clean integration interface without fake delivery)
# ==============================================================================

class EmailNotificationService:
    """
    Standard Email adapter interface. If real SMTP/SES provider is configured,
    delivers external email. Otherwise preserves in-app notification center.
    """
    @staticmethod
    def send_email_notification(recipient_email: str, subject: str, message: str) -> bool:
        # Check if actual SMTP / SES provider credentials are configured in Django
        email_enabled = getattr(settings, 'CRM_EMAIL_ENABLED', False)
        email_user = getattr(settings, 'EMAIL_HOST_USER', None)
        if email_enabled and email_user:
            try:
                from django.core.mail import send_mail
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'crm@texol.com'),
                    recipient_list=[recipient_email],
                    fail_silently=True
                )
                return True
            except Exception:
                return False
        # Provider not configured: keep in notification system without faking delivery
        return False


# ==============================================================================
# NOTIFICATION SERVICE
# ==============================================================================

class NotificationService:
    """
    Centralized notification management for all operational events across the CRM.
    """
    @staticmethod
    def send_notification(
        recipient: User,
        title: str,
        message: str,
        notification_type: str = NotificationType.GENERAL,
        priority: str = NotificationPriority.MEDIUM,
        related_entity_type: str = None,
        related_entity_id: uuid.UUID = None,
        action_url: str = None
    ) -> Notification:
        # Avoid redundant duplicate unread notifications for the same event
        existing = Notification.objects.filter(
            recipient=recipient,
            notification_type=notification_type,
            related_entity_id=related_entity_id,
            is_read=False
        ).first()
        if existing:
            existing.message = message
            existing.title = title
            existing.priority = priority
            existing.save(update_fields=['message', 'title', 'priority'])
            return existing

        notif = Notification.objects.create(
            recipient=recipient,
            title=title,
            message=message,
            notification_type=notification_type,
            priority=priority,
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
            action_url=action_url,
            is_read=False
        )

        # Attempt optional email dispatch via adapter
        if recipient.email:
            dispatched = EmailNotificationService.send_email_notification(
                recipient.email, title, message
            )
            if dispatched:
                notif.email_dispatched = True
                notif.save(update_fields=['email_dispatched'])

        return notif

    @staticmethod
    def notify_managers(
        title: str,
        message: str,
        notification_type: str = NotificationType.GENERAL,
        priority: str = NotificationPriority.HIGH,
        related_entity_type: str = None,
        related_entity_id: uuid.UUID = None,
        action_url: str = None
    ):
        managers = User.objects.filter(
            role__in=[UserRole.SALES_MANAGER, UserRole.MANAGEMENT, UserRole.ADMIN],
            is_active=True
        )
        for mgr in managers:
            NotificationService.send_notification(
                recipient=mgr,
                title=title,
                message=message,
                notification_type=notification_type,
                priority=priority,
                related_entity_type=related_entity_type,
                related_entity_id=related_entity_id,
                action_url=action_url
            )


# ==============================================================================
# ACTIVITY SERVICE
# ==============================================================================

class ActivityService:
    """
    Unified Activity Engine handling logging, next action scheduling,
    automatic task creation, and CRM lifecycle timeline propagation.
    """
    @staticmethod
    @transaction.atomic
    def log_activity(
        subject: str,
        activity_type: str,
        performed_by: User = None,
        account=None,
        contact=None,
        lead=None,
        opportunity=None,
        proposal=None,
        discovery=None,
        demo=None,
        poc=None,
        description_notes: str = '',
        outcome_notes: str = '',
        conducted_at=None,
        duration_minutes: int = 30,
        status: str = ActivityStatus.COMPLETED,
        priority: str = ActivityPriority.MEDIUM,
        next_action_description: str = None,
        next_action_due_at=None,
        create_next_task: bool = False,
        task_assignee: User = None
    ) -> Activity:
        if not subject:
            raise ValidationError("Activity subject is required.")

        if not any([account, contact, lead, opportunity, proposal, discovery, demo, poc]):
            raise ValidationError("An activity must be linked to at least one CRM record.")

        conducted_at = conducted_at or timezone.now()

        # If lead provided, infer account and contact if missing
        if lead and not account and lead.account:
            account = lead.account
        if lead and not contact and lead.contact:
            contact = lead.contact
        if opportunity and not account and opportunity.account:
            account = opportunity.account

        activity = Activity.objects.create(
            subject=subject,
            activity_type=activity_type,
            performed_by=performed_by,
            account=account,
            contact=contact,
            lead=lead,
            opportunity=opportunity,
            proposal=proposal,
            discovery=discovery,
            demo=demo,
            poc=poc,
            description_notes=description_notes,
            outcome_notes=outcome_notes,
            conducted_at=conducted_at,
            duration_minutes=duration_minutes,
            status=status,
            priority=priority,
            next_action_description=next_action_description,
            next_action_due_at=next_action_due_at,
            created_by=performed_by
        )

        # Update parent record activity timestamps
        now = timezone.now()
        if lead:
            lead.last_activity_at = conducted_at or now
            if next_action_due_at or next_action_description:
                lead.next_activity_due_at = next_action_due_at
                lead.next_action_description = next_action_description
            lead.save(update_fields=['last_activity_at', 'next_activity_due_at', 'next_action_description'])

        if opportunity:
            opportunity.last_activity_at = conducted_at or now
            if next_action_due_at or next_action_description:
                opportunity.next_activity_due_at = next_action_due_at
                opportunity.next_action_description = next_action_description
            opportunity.save(update_fields=['last_activity_at', 'next_activity_due_at', 'next_action_description'])

        if account:
            account.last_activity_at = conducted_at or now
            if next_action_due_at or next_action_description:
                account.next_activity_due_at = next_action_due_at
                account.next_action_description = next_action_description
            account.save(update_fields=['last_activity_at', 'next_activity_due_at', 'next_action_description'])

        # Automatic follow-up Task generation
        if (create_next_task or next_action_description) and next_action_due_at:
            assignee = (
                task_assignee or
                performed_by or
                (lead.owner if lead else None) or
                (opportunity.owner if opportunity else None) or
                (getattr(account, 'primary_owner', None) if account else None) or
                User.objects.filter(is_active=True).first()
            )
            if assignee:
                Task.objects.create(
                    title=next_action_description or f"Follow-up: {subject}",
                    description=f"Automated next action from activity: {subject}\nOutcome: {outcome_notes}",
                    task_type='FOLLOW_UP',
                    priority=priority,
                    due_date=next_action_due_at,
                    assigned_to=assignee,
                    created_by=performed_by,
                    related_lead=lead,
                    related_opportunity=opportunity,
                    related_account=account,
                    related_contact=contact,
                    source_activity=activity,
                    status=TaskStatus.OPEN
                )

        # Log to Universal Audit Trail
        AuditLog.objects.create(
            actor=performed_by,
            actor_email=performed_by.email if performed_by else 'system@texol.com',
            actor_role=performed_by.role if performed_by else 'SYSTEM',
            entity_type='Activity',
            entity_id=activity.id,
            action=AuditAction.ACTIVITY_LOG,
            changes_json={
                'subject': {'old': None, 'new': subject},
                'activity_type': {'old': None, 'new': activity_type},
                'next_action': {'old': None, 'new': next_action_description},
                'next_action_due': {'old': None, 'new': str(next_action_due_at) if next_action_due_at else None}
            }
        )

        return activity


# ==============================================================================
# TASK SERVICE
# ==============================================================================

class TaskService:
    """
    Task management handling assignments, status updates, completion tracking,
    and automatic notifications.
    """
    @staticmethod
    @transaction.atomic
    def create_task(
        title: str,
        assigned_to: User,
        due_date,
        created_by: User = None,
        description: str = '',
        task_type: str = 'FOLLOW_UP',
        priority: str = TaskPriority.MEDIUM,
        related_lead=None,
        related_opportunity=None,
        related_account=None,
        related_contact=None,
        related_discovery=None,
        related_demo=None,
        related_poc=None,
        related_proposal=None,
        related_handoff=None,
        source_activity=None
    ) -> Task:
        if not title or not title.strip():
            raise ValidationError("Task title is required.")
        if not assigned_to:
            raise ValidationError("Task must be assigned to an active user.")
        if not due_date:
            raise ValidationError("Task due date is required.")

        task = Task.objects.create(
            title=title.strip(),
            assigned_to=assigned_to,
            created_by=created_by,
            due_date=due_date,
            description=description,
            task_type=task_type,
            priority=priority,
            related_lead=related_lead,
            related_opportunity=related_opportunity,
            related_account=related_account,
            related_contact=related_contact,
            related_discovery=related_discovery,
            related_demo=related_demo,
            related_poc=related_poc,
            related_proposal=related_proposal,
            related_handoff=related_handoff,
            source_activity=source_activity,
            status=TaskStatus.OPEN,
            is_completed=False
        )

        # Notify assigned user
        NotificationService.send_notification(
            recipient=assigned_to,
            title=f"New Task Assigned: {title}",
            message=f"You have been assigned a task: '{title}' due on {due_date.strftime('%Y-%m-%d %H:%M') if hasattr(due_date, 'strftime') else str(due_date)}.",
            notification_type=NotificationType.TASK_DUE,
            priority=NotificationPriority.HIGH if priority in [TaskPriority.HIGH, TaskPriority.CRITICAL, TaskPriority.URGENT] else NotificationPriority.MEDIUM,
            related_entity_type='Task',
            related_entity_id=task.id,
            action_url=f"/tasks/{task.id}"
        )

        # Audit Log
        AuditLog.objects.create(
            actor=created_by,
            actor_email=created_by.email if created_by else 'system@texol.com',
            actor_role=created_by.role if created_by else 'SYSTEM',
            entity_type='Task',
            entity_id=task.id,
            action=AuditAction.TASK_CREATE,
            changes_json={
                'title': {'old': None, 'new': task.title},
                'assigned_to': {'old': None, 'new': assigned_to.email},
                'due_date': {'old': None, 'new': str(due_date)}
            }
        )

        return task

    @staticmethod
    @transaction.atomic
    def complete_task(task: Task, completed_by: User = None) -> Task:
        task.status = TaskStatus.COMPLETED
        task.is_completed = True
        task.completed_at = timezone.now()
        task.save(update_fields=['status', 'is_completed', 'completed_at'])

        AuditLog.objects.create(
            actor=completed_by,
            actor_email=completed_by.email if completed_by else 'system@texol.com',
            actor_role=completed_by.role if completed_by else 'SYSTEM',
            entity_type='Task',
            entity_id=task.id,
            action=AuditAction.TASK_COMPLETE,
            changes_json={
                'status': {'old': 'OPEN', 'new': 'COMPLETED'},
                'completed_at': {'old': None, 'new': str(task.completed_at)}
            }
        )
        return task


# ==============================================================================
# SLA SERVICE & ENGINE
# ==============================================================================

class SLAService:
    """
    Configurable Service Level Agreement engine supporting tracking, state
    transitions, automated warnings, and multi-tier manager escalations.
    """
    @staticmethod
    def get_or_create_default_sla(entity_type: str, default_hours: int = 48) -> SLADefinition:
        definition, _ = SLADefinition.objects.get_or_create(
            entity_type=entity_type,
            defaults={
                'name': f"{entity_type.replace('_', ' ').title()} SLA",
                'target_duration_hours': default_hours,
                'warning_threshold_pct': 75,
                'escalation_role': 'SALES_MANAGER',
                'escalation_action': SLAEscalationAction.FULL_ESCALATION,
                'is_active': True
            }
        )
        return definition

    @staticmethod
    def start_sla_tracker(
        entity_type: str,
        entity_id: uuid.UUID,
        assigned_user: User = None,
        duration_hours: int = None
    ) -> SLATracker:
        definition = SLAService.get_or_create_default_sla(entity_type)
        hours = duration_hours or definition.target_duration_hours

        now = timezone.now()
        due_time = now + timedelta(hours=hours)

        tracker = SLATracker.objects.create(
            definition=definition,
            entity_type=entity_type,
            entity_id=entity_id,
            assigned_user=assigned_user,
            start_time=now,
            due_time=due_time,
            status=SLAStatus.WITHIN_SLA
        )
        return tracker

    @staticmethod
    def complete_sla_tracker(entity_type: str, entity_id: uuid.UUID) -> bool:
        trackers = SLATracker.objects.filter(
            entity_type=entity_type,
            entity_id=entity_id,
            status__in=[SLAStatus.WITHIN_SLA, SLAStatus.DUE_SOON, SLAStatus.AT_RISK]
        )
        updated = False
        now = timezone.now()
        for t in trackers:
            t.status = SLAStatus.COMPLETED
            t.completed_time = now
            t.save(update_fields=['status', 'completed_time'])
            updated = True
        return updated

    @staticmethod
    @transaction.atomic
    def evaluate_and_escalate_all_slas():
        """
        Evaluates all active SLA trackers. Updates states, identifies breaches,
        and executes configurable escalation actions.
        """
        active_slas = SLATracker.objects.filter(
            status__in=[SLAStatus.WITHIN_SLA, SLAStatus.DUE_SOON, SLAStatus.AT_RISK, SLAStatus.BREACHED],
            completed_time__isnull=True
        ).select_related('definition', 'assigned_user')

        now = timezone.now()
        breached_count = 0
        escalated_count = 0

        for tracker in active_slas:
            old_status = tracker.status
            new_status = tracker.calculate_status()

            if new_status == SLAStatus.BREACHED and not tracker.is_escalated:
                tracker.is_escalated = True
                tracker.escalated_at = now
                tracker.save(update_fields=['status', 'is_escalated', 'escalated_at'])
                breached_count += 1
                escalated_count += 1

                # Execute Escalation Action
                SLAService._execute_escalation(tracker)

                # Universal Audit Log
                AuditLog.objects.create(
                    actor=None,
                    actor_email='sla-engine@texol.com',
                    actor_role='SLA_ENGINE',
                    entity_type='SLA',
                    entity_id=tracker.id,
                    action=AuditAction.SLA_BREACH,
                    changes_json={
                        'entity': f"{tracker.entity_type} #{str(tracker.entity_id)[:8]}",
                        'sla': tracker.definition.name,
                        'due_time': str(tracker.due_time),
                        'status': {'old': old_status, 'new': new_status}
                    }
                )
            elif old_status != new_status:
                tracker.save(update_fields=['status'])

                if new_status == SLAStatus.AT_RISK and tracker.assigned_user:
                    NotificationService.send_notification(
                        recipient=tracker.assigned_user,
                        title=f"⚠️ SLA Warning: {tracker.definition.name} At Risk",
                        message=f"SLA for {tracker.entity_type} is at risk. Only {tracker.remaining_hours} hours remaining before breach.",
                        notification_type=NotificationType.SLA_AT_RISK,
                        priority=NotificationPriority.HIGH,
                        related_entity_type=tracker.entity_type,
                        related_entity_id=tracker.entity_id
                    )

        return {'active_checked': active_slas.count(), 'breached': breached_count, 'escalated': escalated_count}

    @staticmethod
    def _execute_escalation(tracker: SLATracker):
        action = tracker.definition.escalation_action
        entity_label = f"{tracker.entity_type} #{str(tracker.entity_id)[:8]}"

        # 1. Notify Owner
        if tracker.assigned_user and action in [SLAEscalationAction.NOTIFY_OWNER, SLAEscalationAction.NOTIFY_MANAGER, SLAEscalationAction.FULL_ESCALATION]:
            NotificationService.send_notification(
                recipient=tracker.assigned_user,
                title=f"🚨 SLA Breached: {tracker.definition.name}",
                message=f"The SLA deadline for {entity_label} expired at {tracker.due_time.strftime('%Y-%m-%d %H:%M')}. Immediate action is required.",
                notification_type=NotificationType.SLA_BREACHED,
                priority=NotificationPriority.CRITICAL,
                related_entity_type=tracker.entity_type,
                related_entity_id=tracker.entity_id
            )

        # 2. Notify Manager
        if action in [SLAEscalationAction.NOTIFY_MANAGER, SLAEscalationAction.FULL_ESCALATION]:
            NotificationService.notify_managers(
                title=f"🚨 Escalation: {tracker.definition.name} Breached on {entity_label}",
                message=f"Responsible Owner: {tracker.assigned_user.get_full_name() if tracker.assigned_user else 'Unassigned'}. Deadline was {tracker.due_time.strftime('%Y-%m-%d %H:%M')}.",
                notification_type=NotificationType.SLA_BREACHED,
                priority=NotificationPriority.CRITICAL,
                related_entity_type=tracker.entity_type,
                related_entity_id=tracker.entity_id
            )

        # 3. Create Escalation Task
        if action in [SLAEscalationAction.CREATE_TASK, SLAEscalationAction.FULL_ESCALATION]:
            assignee = tracker.assigned_user or User.objects.filter(role=UserRole.SALES_MANAGER, is_active=True).first()
            if assignee:
                Task.objects.create(
                    title=f"ESCALATION: Resolve Breached SLA on {entity_label}",
                    description=f"SLA {tracker.definition.name} breached. Immediate managerial resolution required.",
                    task_type='SLA_EXPIRY',
                    priority=TaskPriority.CRITICAL,
                    due_date=timezone.now() + timedelta(hours=12),
                    assigned_to=assignee,
                    status=TaskStatus.OPEN
                )


# ==============================================================================
# AUTOMATION ENGINE (Implementing the 9 Required Automations)
# ==============================================================================

class AutomationService:
    """
    Automated business rules engine executing the 9 core requirements:
    A. New Lead Owner Assignment
    B. No-Contact Follow-up
    C. No-Next-Action Flag
    D. High-Score Manager Notification
    E. POC Completion -> SQL Review
    F. Proposal Expiry Notification
    G. Inactive Opportunity Escalation
    H. SQL Ready Notification & Acceptance SLA
    I. Nurture Re-engagement
    """

    # --------------------------------------------------------------------------
    # A. NEW LEAD OWNER ASSIGNMENT
    # --------------------------------------------------------------------------
    @staticmethod
    def run_new_lead_assignment(lead: Lead) -> bool:
        if lead.owner:
            return False  # Already assigned

        rule = AutomationRule.objects.filter(
            trigger_type=AutomationTrigger.ON_LEAD_CREATE,
            is_active=True
        ).first()

        target_role = (rule.action_config_json.get('assignee_role', UserRole.PLD_EXECUTIVE) if rule else UserRole.PLD_EXECUTIVE)
        assignee = User.objects.filter(role=target_role, is_active=True).first()
        if not assignee:
            assignee = User.objects.filter(is_active=True).first()

        if assignee:
            lead.owner = assignee
            lead.save(update_fields=['owner'])

            NotificationService.send_notification(
                recipient=assignee,
                title=f"New Lead Assigned: {lead.account.company_name}",
                message=f"You have been assigned as owner for lead {lead.account.company_name} ({lead.primary_product.name}).",
                notification_type=NotificationType.LEAD_ASSIGNED,
                priority=NotificationPriority.MEDIUM,
                related_entity_type='Lead',
                related_entity_id=lead.id,
                action_url=f"/leads/{lead.id}"
            )

            # Audit assignment
            AuditLog.objects.create(
                actor=None,
                actor_email='automation@texol.com',
                actor_role='AUTOMATION',
                entity_type='Lead',
                entity_id=lead.id,
                action=AuditAction.UPDATE,
                changes_json={'owner': {'old': None, 'new': assignee.email}}
            )

            if rule:
                AutomationExecutionLog.objects.create(
                    rule=rule,
                    trigger_event='ON_LEAD_CREATE',
                    target_entity_type='Lead',
                    target_entity_id=lead.id,
                    status='SUCCESS',
                    details=f"Assigned lead to {assignee.email} via role {target_role}"
                )
            return True
        return False

    # --------------------------------------------------------------------------
    # B. NO-CONTACT FOLLOW-UP
    # --------------------------------------------------------------------------
    @staticmethod
    def run_no_contact_check() -> int:
        rule = AutomationRule.objects.filter(
            trigger_type=AutomationTrigger.SCHEDULED_NO_CONTACT,
            is_active=True
        ).first()
        max_inactive_hours = rule.conditions_json.get('max_inactive_hours', 48) if rule else 48
        cutoff = timezone.now() - timedelta(hours=max_inactive_hours)

        # Active leads with no activity or created before cutoff without touch
        leads_without_contact = Lead.objects.filter(
            status=LeadStatus.ACTIVE,
            last_activity_at__isnull=True,
            created_at__lt=cutoff
        ) | Lead.objects.filter(
            status=LeadStatus.ACTIVE,
            last_activity_at__lt=cutoff
        )

        flagged_count = 0
        for lead in leads_without_contact[:50]:
            owner = lead.owner
            if not owner:
                continue

            # Ensure open task doesn't already exist
            has_task = Task.objects.filter(
                related_lead=lead,
                task_type='FIRST_CONTACT',
                is_completed=False
            ).exists()

            if not has_task:
                Task.objects.create(
                    title=f"URGENT: First Contact Required - {lead.account.company_name}",
                    description=f"Lead has not received customer contact in >{max_inactive_hours} hours.",
                    task_type='FIRST_CONTACT',
                    priority=TaskPriority.HIGH,
                    due_date=timezone.now() + timedelta(hours=24),
                    assigned_to=owner,
                    related_lead=lead,
                    related_account=lead.account,
                    status=TaskStatus.OPEN
                )

                NotificationService.send_notification(
                    recipient=owner,
                    title=f"No Contact Alert: {lead.account.company_name}",
                    message=f"Lead {lead.account.company_name} has had no contact for {max_inactive_hours}h. Contact task generated.",
                    notification_type=NotificationType.NO_CONTACT,
                    priority=NotificationPriority.HIGH,
                    related_entity_type='Lead',
                    related_entity_id=lead.id
                )
                flagged_count += 1

        if rule:
            rule.last_run_at = timezone.now()
            rule.execution_count += 1
            rule.save(update_fields=['last_run_at', 'execution_count'])
        return flagged_count

    # --------------------------------------------------------------------------
    # C. NO-NEXT-ACTION FLAG
    # --------------------------------------------------------------------------
    @staticmethod
    def run_no_next_action_check() -> int:
        rule = AutomationRule.objects.filter(
            trigger_type=AutomationTrigger.SCHEDULED_NO_NEXT_ACTION,
            is_active=True
        ).first()

        active_leads = Lead.objects.filter(
            status=LeadStatus.ACTIVE,
            next_activity_due_at__isnull=True
        ).select_related('owner', 'account')

        flagged = 0
        for lead in active_leads[:50]:
            if lead.owner:
                NotificationService.send_notification(
                    recipient=lead.owner,
                    title=f"Missing Next Action: {lead.account.company_name}",
                    message=f"Active PLD Lead {lead.account.company_name} has no future action scheduled. Please define next action.",
                    notification_type=NotificationType.NO_NEXT_ACTION,
                    priority=NotificationPriority.MEDIUM,
                    related_entity_type='Lead',
                    related_entity_id=lead.id,
                    action_url=f"/leads/{lead.id}"
                )
                flagged += 1

        if rule:
            rule.last_run_at = timezone.now()
            rule.execution_count += 1
            rule.save(update_fields=['last_run_at', 'execution_count'])
        return flagged

    # --------------------------------------------------------------------------
    # D. HIGH-SCORE MANAGER NOTIFICATION
    # --------------------------------------------------------------------------
    @staticmethod
    def run_high_score_check(lead: Lead, score: Decimal) -> bool:
        rule = AutomationRule.objects.filter(
            trigger_type=AutomationTrigger.ON_SCORE_UPDATE,
            is_active=True
        ).first()
        threshold = Decimal(str(rule.conditions_json.get('min_score', 80))) if rule else Decimal('80.00')

        if score >= threshold:
            NotificationService.notify_managers(
                title=f"🔥 High PLD Score: {lead.account.company_name} ({score}/100)",
                message=f"Lead {lead.account.company_name} evaluating {lead.primary_product.name} scored {score}/100 (Threshold: {threshold}). High commercial readiness!",
                notification_type=NotificationType.HIGH_PLD_SCORE,
                priority=NotificationPriority.HIGH,
                related_entity_type='Lead',
                related_entity_id=lead.id,
                action_url=f"/leads/{lead.id}"
            )

            AuditLog.objects.create(
                actor=None,
                actor_email='pld-engine@texol.com',
                actor_role='PLD_ENGINE',
                entity_type='Lead',
                entity_id=lead.id,
                action=AuditAction.SCORE_OVERRIDE,
                changes_json={
                    'event': 'High PLD Score Threshold Crossed',
                    'score': float(score),
                    'threshold': float(threshold)
                }
            )

            if rule:
                AutomationExecutionLog.objects.create(
                    rule=rule,
                    trigger_event='ON_SCORE_UPDATE',
                    target_entity_type='Lead',
                    target_entity_id=lead.id,
                    status='SUCCESS',
                    details=f"Notified sales managers: PLD score {score} >= {threshold}"
                )
            return True
        return False

    # --------------------------------------------------------------------------
    # E. POC COMPLETION → SQL REVIEW
    # --------------------------------------------------------------------------
    @staticmethod
    def run_poc_completion_check(poc) -> bool:
        rule = AutomationRule.objects.filter(
            trigger_type=AutomationTrigger.ON_POC_COMPLETE,
            is_active=True
        ).first()

        # Check if POC status is COMPLETED or all success gates cleared
        lead = poc.lead
        owner = lead.owner if lead else None
        if not owner:
            owner = User.objects.filter(role=UserRole.PLD_EXECUTIVE, is_active=True).first()

        if owner:
            # Create SQL Review Task (without auto-converting to SQL Ready)
            Task.objects.get_or_create(
                related_poc=poc,
                task_type='POC_REVIEW',
                defaults={
                    'title': f"Review Completed POC for SQL Readiness - {lead.account.company_name if lead else 'Account'}",
                    'description': f"POC #{str(poc.id)[:8]} has concluded. Review success metrics, client recommendation, and verify SQL readiness gates.",
                    'priority': TaskPriority.HIGH,
                    'due_date': timezone.now() + timedelta(hours=48),
                    'assigned_to': owner,
                    'related_lead': lead,
                    'status': TaskStatus.OPEN
                }
            )

            NotificationService.send_notification(
                recipient=owner,
                title=f"POC Completed: Review Required for {lead.account.company_name if lead else 'Lead'}",
                message=f"The trial evaluation has concluded. Please review POC results and verify SQL gates.",
                notification_type=NotificationType.POC_REVIEW,
                priority=NotificationPriority.HIGH,
                related_entity_type='POC',
                related_entity_id=poc.id,
                action_url=f"/poc/{poc.id}"
            )

            if rule:
                AutomationExecutionLog.objects.create(
                    rule=rule,
                    trigger_event='ON_POC_COMPLETE',
                    target_entity_type='POC',
                    target_entity_id=poc.id,
                    status='SUCCESS',
                    details="Created SQL review task and notified owner."
                )
            return True
        return False

    # --------------------------------------------------------------------------
    # F. PROPOSAL EXPIRY NOTIFICATION & HANDLING
    # --------------------------------------------------------------------------
    @staticmethod
    def run_proposal_expiry_check() -> dict:
        rule = AutomationRule.objects.filter(
            trigger_type=AutomationTrigger.SCHEDULED_PROPOSAL_EXPIRY,
            is_active=True
        ).first()

        warning_days = rule.conditions_json.get('warning_days_before', 3) if rule else 3
        now_date = timezone.now().date()
        warning_date = now_date + timedelta(days=warning_days)

        warning_count = 0
        expired_count = 0

        # 1. Warning: Approaching Expiry within warning_days
        approaching = Proposal.objects.filter(
            status__in=[ProposalStatus.APPROVED, ProposalStatus.SENT],
            valid_until__gte=now_date,
            valid_until__lte=warning_date
        ).select_related('owner')

        for prop in approaching:
            if prop.owner:
                NotificationService.send_notification(
                    recipient=prop.owner,
                    title=f"Proposal Expiring Soon: #{prop.proposal_number}",
                    message=f"Proposal #{prop.proposal_number} expires in {(prop.valid_until - now_date).days} days ({prop.valid_until}). Follow up with client immediately.",
                    notification_type=NotificationType.PROPOSAL_EXPIRING,
                    priority=NotificationPriority.HIGH,
                    related_entity_type='Proposal',
                    related_entity_id=prop.id,
                    action_url=f"/proposals/{prop.id}"
                )
                warning_count += 1

        # 2. Expired: Expiry date passed
        expired = Proposal.objects.filter(
            status__in=[ProposalStatus.APPROVED, ProposalStatus.SENT, ProposalStatus.DRAFT],
            valid_until__lt=now_date
        ).select_related('owner')

        for prop in expired:
            old_status = prop.status
            prop.status = ProposalStatus.EXPIRED
            prop.save(update_fields=['status'])

            # Mark active version expired
            active_version = prop.versions.filter(version_number=prop.version_number).first()
            if active_version:
                active_version.status = 'EXPIRED'
                active_version.save(update_fields=['status'])

            if prop.owner:
                NotificationService.send_notification(
                    recipient=prop.owner,
                    title=f"Proposal Expired: #{prop.proposal_number}",
                    message=f"Proposal #{prop.proposal_number} reached expiry date ({prop.valid_until}). Status updated to EXPIRED.",
                    notification_type=NotificationType.PROPOSAL_EXPIRED,
                    priority=NotificationPriority.MEDIUM,
                    related_entity_type='Proposal',
                    related_entity_id=prop.id
                )

            AuditLog.objects.create(
                actor=None,
                actor_email='automation@texol.com',
                actor_role='AUTOMATION',
                entity_type='Proposal',
                entity_id=prop.id,
                action=AuditAction.UPDATE,
                changes_json={'status': {'old': old_status, 'new': 'EXPIRED'}}
            )
            expired_count += 1

        if rule:
            rule.last_run_at = timezone.now()
            rule.execution_count += 1
            rule.save(update_fields=['last_run_at', 'execution_count'])

        return {'warning_sent': warning_count, 'marked_expired': expired_count}

    # --------------------------------------------------------------------------
    # G. INACTIVE OPPORTUNITY ESCALATION
    # --------------------------------------------------------------------------
    @staticmethod
    def run_inactive_opportunity_check() -> int:
        rule = AutomationRule.objects.filter(
            trigger_type=AutomationTrigger.SCHEDULED_OPPORTUNITY_INACTIVITY,
            is_active=True
        ).first()
        inactivity_days = rule.conditions_json.get('max_inactive_days', 14) if rule else 14
        cutoff = timezone.now() - timedelta(days=inactivity_days)

        inactive_opps = Opportunity.objects.filter(
            status='OPEN',
            last_activity_at__lt=cutoff
        ) | Opportunity.objects.filter(
            status='OPEN',
            last_activity_at__isnull=True,
            created_at__lt=cutoff
        )

        flagged = 0
        for opp in inactive_opps[:50]:
            owner = opp.owner
            days_inactive = (timezone.now() - (opp.last_activity_at or opp.created_at)).days

            # Create follow-up task
            if owner:
                Task.objects.get_or_create(
                    related_opportunity=opp,
                    task_type='INACTIVITY_CHECK',
                    is_completed=False,
                    defaults={
                        'title': f"Re-engage Inactive Opportunity: {opp.account.company_name}",
                        'description': f"Opportunity has had zero activity for {days_inactive} days (Threshold: {inactivity_days}d).",
                        'priority': TaskPriority.HIGH,
                        'due_date': timezone.now() + timedelta(hours=48),
                        'assigned_to': owner,
                        'related_account': opp.account,
                        'status': TaskStatus.OPEN
                    }
                )

                NotificationService.send_notification(
                    recipient=owner,
                    title=f"Inactive Opportunity Alert: {opp.account.company_name}",
                    message=f"Opportunity {opp.account.company_name} ({opp.total_contract_value} {opp.currency}) inactive for {days_inactive} days.",
                    notification_type=NotificationType.OPPORTUNITY_INACTIVE,
                    priority=NotificationPriority.HIGH,
                    related_entity_type='Opportunity',
                    related_entity_id=opp.id,
                    action_url=f"/opportunities/{opp.id}"
                )

            # Notify sales managers for major inactive deals
            if opp.total_contract_value >= 50000:
                NotificationService.notify_managers(
                    title=f"Deal Stalled: {opp.account.company_name} ({opp.total_contract_value} {opp.currency})",
                    message=f"Major deal inactive for {days_inactive} days. Owner: {owner.get_full_name() if owner else 'Unassigned'}.",
                    notification_type=NotificationType.OPPORTUNITY_INACTIVE,
                    priority=NotificationPriority.HIGH,
                    related_entity_type='Opportunity',
                    related_entity_id=opp.id
                )

            AuditLog.objects.create(
                actor=None,
                actor_email='automation@texol.com',
                actor_role='AUTOMATION',
                entity_type='Opportunity',
                entity_id=opp.id,
                action=AuditAction.ESCALATION,
                changes_json={
                    'event': 'Inactive Opportunity Flagged',
                    'days_inactive': days_inactive,
                    'threshold_days': inactivity_days
                }
            )
            flagged += 1

        if rule:
            rule.last_run_at = timezone.now()
            rule.execution_count += 1
            rule.save(update_fields=['last_run_at', 'execution_count'])
        return flagged

    # --------------------------------------------------------------------------
    # H. SQL READY NOTIFICATION & SALES ACCEPTANCE SLA
    # --------------------------------------------------------------------------
    @staticmethod
    def run_sql_ready_handoff(lead: Lead, handoff: SQLHandoff) -> bool:
        sales_owner = handoff.assigned_sales_owner
        if not sales_owner:
            sales_owner = User.objects.filter(role=UserRole.SALES_BDM, is_active=True).first()

        if sales_owner:
            # 1. Create Sales Acceptance Task
            Task.objects.create(
                title=f"Review & Accept SQL Handoff: {handoff.account.company_name if handoff.account else lead.account.company_name}",
                description=f"SQL Ready handoff received from PLD. 48-hour SLA deadline: {handoff.sla_expires_at}.",
                task_type='SALES_ACCEPTANCE',
                priority=TaskPriority.CRITICAL,
                due_date=handoff.sla_expires_at or (timezone.now() + timedelta(hours=48)),
                assigned_to=sales_owner,
                related_lead=lead,
                related_account=handoff.account or lead.account,
                related_handoff=handoff,
                status=TaskStatus.OPEN
            )

            # 2. Start SLA Tracker
            SLAService.start_sla_tracker(
                entity_type=SLAEntityType.SQL_ACCEPTANCE,
                entity_id=handoff.id,
                assigned_user=sales_owner,
                duration_hours=handoff.sla_duration_hours or 48
            )

            # 3. Notification to Sales Owner
            NotificationService.send_notification(
                recipient=sales_owner,
                title=f"🚀 Action Required: New SQL Ready - {handoff.account.company_name if handoff.account else lead.account.company_name}",
                message=f"PLD gates verified for {handoff.product.name}. Value: {handoff.estimated_value} {handoff.currency}. Review & accept within 48h.",
                notification_type=NotificationType.SQL_READY,
                priority=NotificationPriority.CRITICAL,
                related_entity_type='SQLHandoff',
                related_entity_id=handoff.id,
                action_url=f"/sql/{handoff.id}"
            )
            return True
        return False

    # --------------------------------------------------------------------------
    # I. NURTURE RE-ENGAGEMENT
    # --------------------------------------------------------------------------
    @staticmethod
    def run_nurture_reengagement_check() -> int:
        rule = AutomationRule.objects.filter(
            trigger_type=AutomationTrigger.SCHEDULED_NURTURE_REENGAGEMENT,
            is_active=True
        ).first()
        reengagement_days = rule.conditions_json.get('reengagement_days', 30) if rule else 30
        cutoff = timezone.now() - timedelta(days=reengagement_days)

        nurture_leads = Lead.objects.filter(
            status=LeadStatus.NURTURE,
            updated_at__lt=cutoff
        ).select_related('owner', 'account')

        flagged = 0
        for lead in nurture_leads[:50]:
            owner = lead.owner
            if owner:
                # Ensure no pending task already
                has_task = Task.objects.filter(
                    related_lead=lead,
                    task_type='RE_ENGAGEMENT',
                    is_completed=False
                ).exists()

                if not has_task:
                    Task.objects.create(
                        title=f"Re-engage Nurture Lead: {lead.account.company_name}",
                        description=f"Nurture period of {reengagement_days} days elapsed. Conduct re-qualification check.",
                        task_type='RE_ENGAGEMENT',
                        priority=TaskPriority.MEDIUM,
                        due_date=timezone.now() + timedelta(days=3),
                        assigned_to=owner,
                        related_lead=lead,
                        related_account=lead.account,
                        status=TaskStatus.OPEN
                    )

                    NotificationService.send_notification(
                        recipient=owner,
                        title=f"Nurture Re-engagement Due: {lead.account.company_name}",
                        message=f"Lead {lead.account.company_name} is due for scheduled nurture follow-up.",
                        notification_type=NotificationType.NURTURE_REENGAGEMENT,
                        priority=NotificationPriority.MEDIUM,
                        related_entity_type='Lead',
                        related_entity_id=lead.id
                    )
                    flagged += 1

        if rule:
            rule.last_run_at = timezone.now()
            rule.execution_count += 1
            rule.save(update_fields=['last_run_at', 'execution_count'])
        return flagged

    # --------------------------------------------------------------------------
    # RUN ALL AUTOMATIONS (Idempotent execution)
    # --------------------------------------------------------------------------
    @staticmethod
    def run_all_automations() -> dict:
        results = {}
        results['no_contact_flagged'] = AutomationService.run_no_contact_check()
        results['no_next_action_flagged'] = AutomationService.run_no_next_action_check()
        results['proposals'] = AutomationService.run_proposal_expiry_check()
        results['inactive_opps_flagged'] = AutomationService.run_inactive_opportunity_check()
        results['nurture_reengaged'] = AutomationService.run_nurture_reengagement_check()
        results['slas_evaluated'] = SLAService.evaluate_and_escalate_all_slas()
        return results


# ==============================================================================
# WORK QUEUE & OPERATIONAL METRICS SERVICE
# ==============================================================================

class WorkQueueService:
    """
    Supplies the action-oriented MY WORK queue and real-time operational metrics.
    Supports role-based views (Sales Executive, Manager, Executive) and the 5 Phase 10 sections:
    TODAY, OVERDUE, AT RISK, NO NEXT ACTION, UPCOMING.
    """
    @staticmethod
    def get_work_queue_data(user: User = None, role_view: str = None) -> dict:
        now = timezone.now()
        today_date = now.date()

        # Determine effective role mode (Only Admin can freely switch roles)
        is_admin = bool(user and (user.is_superuser or getattr(user, 'role', None) == UserRole.ADMIN))
        if not is_admin and user:
            if getattr(user, 'role', None) == UserRole.MANAGEMENT:
                effective_role = 'EXECUTIVE'
            elif getattr(user, 'role', None) in [UserRole.SALES_MANAGER, UserRole.PARTNER_MANAGER] or 'MANAGER' in getattr(user, 'role', ''):
                effective_role = 'MANAGER'
            else:
                effective_role = 'SALES_EXECUTIVE'
        else:
            effective_role = role_view or 'SALES_EXECUTIVE'
        effective_role = effective_role or 'SALES_EXECUTIVE'

        # Base Querysets
        task_qs = Task.objects.select_related(
            'assigned_to', 'related_lead', 'related_opportunity', 'related_account'
        ).exclude(
            related_lead__status__in=[LeadStatus.NURTURE, LeadStatus.DISQUALIFIED]
        ).exclude(
            related_lead__assessments__icp_result='FAIL'
        ).exclude(
            related_lead__assessments__icp_knockout_passed=False
        )
        lead_qs = Lead.objects.filter(status=LeadStatus.ACTIVE).exclude(
            assessments__icp_result='FAIL'
        ).exclude(
            assessments__icp_knockout_passed=False
        ).select_related('account', 'owner', 'primary_product')
        opp_qs = Opportunity.objects.filter(status=OpportunityStatus.OPEN).select_related('account', 'owner', 'stage', 'product')
        sql_qs = SQLHandoff.objects.filter(status=HandoffStatus.PENDING).select_related('lead__account', 'assigned_sales_owner', 'product')
        sla_qs = SLATracker.objects.filter(completed_time__isnull=True).select_related('definition', 'assigned_user')
        act_qs = Activity.objects.filter(status=ActivityStatus.PLANNED).select_related('performed_by', 'lead__account', 'opportunity__account')

        # Apply Scoping based on effective_role
        if effective_role == 'SALES_EXECUTIVE' and user and not user.is_superuser and user.role not in [UserRole.ADMIN, UserRole.MANAGEMENT]:
            task_qs = task_qs.filter(assigned_to=user)
            lead_qs = lead_qs.filter(owner=user)
            opp_qs = opp_qs.filter(owner=user)
            sql_qs = sql_qs.filter(assigned_sales_owner=user)
            sla_qs = sla_qs.filter(assigned_user=user)
            act_qs = act_qs.filter(performed_by=user)
        elif effective_role == 'MANAGER' and user and user.territory:
            # Manager territory filtering if defined
            lead_qs = lead_qs.filter(Q(owner__territory=user.territory) | Q(owner=user))
            opp_qs = opp_qs.filter(Q(owner__territory=user.territory) | Q(owner=user))

        # ======================================================================
        # SECTION 1: TODAY
        # ======================================================================
        tasks_due_today = list(task_qs.filter(
            is_completed=False,
            due_date__date=today_date
        ).order_by('priority', 'due_date'))

        followups_today_leads = list(lead_qs.filter(next_activity_due_at__date=today_date))
        followups_today_opps = list(opp_qs.filter(next_activity_due_at__date=today_date))

        sql_acceptance_pending = list(sql_qs.order_by('sla_expires_at'))
        scheduled_activities_today = list(act_qs.filter(conducted_at__date=today_date))

        # ======================================================================
        # SECTION 2: OVERDUE
        # ======================================================================
        overdue_tasks = list(task_qs.filter(
            is_completed=False,
            due_date__lt=now
        ).order_by('due_date'))

        overdue_followups_leads = list(lead_qs.filter(next_activity_due_at__lt=now))
        overdue_followups_opps = list(opp_qs.filter(next_activity_due_at__lt=now))
        sla_breaches = list(sla_qs.filter(status=SLAStatus.BREACHED).order_by('due_time'))

        # ======================================================================
        # SECTION 3: AT RISK
        # ======================================================================
        slas_at_risk = list(sla_qs.filter(status__in=[SLAStatus.AT_RISK, SLAStatus.DUE_SOON]).order_by('due_time'))

        fourteen_days_ago = now - timedelta(days=14)
        inactive_opps = list(opp_qs.filter(
            Q(last_activity_at__lt=fourteen_days_ago) | Q(last_activity_at__isnull=True)
        ).order_by('-total_contract_value'))

        three_days_future = today_date + timedelta(days=3)
        proposals_qs = Proposal.objects.filter(
            status__in=[ProposalStatus.APPROVED, ProposalStatus.SENT],
            valid_until__lte=three_days_future
        ).select_related('opportunity__account', 'owner')
        if effective_role == 'SALES_EXECUTIVE' and user and not user.is_superuser and user.role not in [UserRole.ADMIN, UserRole.MANAGEMENT]:
            proposals_qs = proposals_qs.filter(Q(owner=user) | Q(opportunity__owner=user))
        proposals_expiring = list(proposals_qs)

        # ======================================================================
        # SECTION 4: NO NEXT ACTION
        # ======================================================================
        leads_missing_action = list(lead_qs.filter(
            Q(next_activity_due_at__isnull=True) | Q(next_action_description__isnull=True)
        ).order_by('-created_at'))

        opps_missing_action = list(opp_qs.filter(
            Q(next_activity_due_at__isnull=True) | Q(next_action_description__isnull=True)
        ).order_by('-total_contract_value'))

        # ======================================================================
        # SECTION 5: UPCOMING
        # ======================================================================
        upcoming_tasks = list(task_qs.filter(
            is_completed=False,
            due_date__gt=now,
            due_date__lte=now + timedelta(days=7)
        ).exclude(due_date__date=today_date).order_by('due_date'))

        upcoming_activities = list(act_qs.filter(
            conducted_at__gt=now,
            conducted_at__lte=now + timedelta(days=7)
        ).exclude(conducted_at__date=today_date).order_by('conducted_at'))

        thirty_days_ago = now - timedelta(days=30)
        nurture_leads_qs = Lead.objects.filter(
            status=LeadStatus.NURTURE,
            updated_at__lte=thirty_days_ago
        )
        if effective_role == 'SALES_EXECUTIVE' and user and not user.is_superuser and user.role not in [UserRole.ADMIN, UserRole.MANAGEMENT]:
            nurture_leads_qs = nurture_leads_qs.filter(owner=user)
        nurture_reengagement = list(nurture_leads_qs.select_related('account', 'owner', 'primary_product')[:20])

        return {
            'role_view': effective_role,
            # Structured Sections
            'today': {
                'tasks': tasks_due_today,
                'follow_ups_leads': followups_today_leads,
                'follow_ups_opps': followups_today_opps,
                'sql_acceptance': sql_acceptance_pending,
                'scheduled_activities': scheduled_activities_today,
                'count': len(tasks_due_today) + len(followups_today_leads) + len(followups_today_opps) + len(sql_acceptance_pending) + len(scheduled_activities_today)
            },
            'overdue': {
                'tasks': overdue_tasks,
                'follow_ups_leads': overdue_followups_leads,
                'follow_ups_opps': overdue_followups_opps,
                'sla_breaches': sla_breaches,
                'count': len(overdue_tasks) + len(overdue_followups_leads) + len(overdue_followups_opps) + len(sla_breaches)
            },
            'at_risk': {
                'slas_at_risk': slas_at_risk,
                'inactive_opportunities': inactive_opps,
                'proposals_expiring': proposals_expiring,
                'count': len(slas_at_risk) + len(inactive_opps) + len(proposals_expiring)
            },
            'no_next_action': {
                'leads': leads_missing_action,
                'opportunities': opps_missing_action,
                'count': len(leads_missing_action) + len(opps_missing_action)
            },
            'upcoming': {
                'tasks': upcoming_tasks,
                'activities': upcoming_activities,
                'nurture_reengagement': nurture_reengagement,
                'count': len(upcoming_tasks) + len(upcoming_activities) + len(nurture_reengagement)
            },
            # Backward-compatible keys
            'overdue_tasks': overdue_tasks,
            'due_today_tasks': tasks_due_today,
            'upcoming_tasks': upcoming_tasks,
            'leads_missing_next_action': leads_missing_action,
            'opportunities_missing_next_action': opps_missing_action,
            'slas_at_risk': slas_at_risk,
            'counts': {
                'today': len(tasks_due_today) + len(followups_today_leads) + len(sql_acceptance_pending),
                'overdue': len(overdue_tasks) + len(sla_breaches),
                'due_today': len(tasks_due_today),
                'upcoming': len(upcoming_tasks),
                'no_next_action': len(leads_missing_action) + len(opps_missing_action),
                'sla_alerts': len(slas_at_risk) + len(sla_breaches)
            }
        }

    @staticmethod
    def reschedule_task(task_id: str, new_due_date: str, user=None) -> Task:
        task = Task.objects.get(id=task_id)
        if isinstance(new_due_date, str):
            from django.utils.dateparse import parse_datetime
            parsed = parse_datetime(new_due_date)
            if not parsed:
                try:
                    parsed = datetime.strptime(new_due_date, '%Y-%m-%d %H:%M')
                except Exception:
                    parsed = datetime.strptime(new_due_date, '%Y-%m-%d')
            if parsed and timezone.is_naive(parsed):
                parsed = timezone.make_aware(parsed)
            task.due_date = parsed
        else:
            if new_due_date and timezone.is_naive(new_due_date):
                new_due_date = timezone.make_aware(new_due_date)
            task.due_date = new_due_date
        task.save(update_fields=['due_date'])
        return task

    @staticmethod
    def schedule_next_action(entity_type: str, entity_id: str, description: str, due_date: str, user=None) -> dict:
        parsed_dt = timezone.now() + timedelta(days=1)
        if isinstance(due_date, str):
            from django.utils.dateparse import parse_datetime
            p = parse_datetime(due_date)
            if not p:
                try:
                    p = timezone.make_aware(datetime.strptime(due_date, '%Y-%m-%d'))
                except Exception:
                    pass
            if p:
                if timezone.is_naive(p):
                    p = timezone.make_aware(p)
                parsed_dt = p

        if entity_type == 'LEAD':
            lead = Lead.objects.get(id=entity_id)
            lead.next_action_description = description
            lead.next_activity_due_at = parsed_dt
            lead.save(update_fields=['next_action_description', 'next_activity_due_at'])

            # Also create corresponding task
            Task.objects.create(
                title=f"Next Action: {description}",
                assigned_to=lead.owner or user,
                created_by=user,
                due_date=parsed_dt,
                related_lead=lead,
                task_type='FOLLOW_UP',
                priority='MEDIUM'
            )
            return {"status": "SUCCESS", "entity": "LEAD", "id": str(lead.id)}

        elif entity_type == 'OPPORTUNITY':
            opp = Opportunity.objects.get(id=entity_id)
            opp.next_action_description = description
            opp.next_activity_due_at = parsed_dt
            opp.save(update_fields=['next_action_description', 'next_activity_due_at'])

            Task.objects.create(
                title=f"Opportunity Next Action: {description}",
                assigned_to=opp.owner or user,
                created_by=user,
                due_date=parsed_dt,
                related_opportunity=opp,
                task_type='FOLLOW_UP',
                priority='HIGH'
            )
            return {"status": "SUCCESS", "entity": "OPPORTUNITY", "id": str(opp.id)}

        raise ValidationError(f"Unsupported entity_type {entity_type}")

    @staticmethod
    def get_operational_metrics() -> dict:
        now = timezone.now()
        today_date = now.date()

        activities_today = Activity.objects.filter(conducted_at__date=today_date).count()
        overdue_tasks = Task.objects.filter(is_completed=False, due_date__lt=now).count()
        tasks_due_today = Task.objects.filter(is_completed=False, due_date__date=today_date).count()
        leads_no_next_action = Lead.objects.filter(status=LeadStatus.ACTIVE, next_activity_due_at__isnull=True).count()
        
        fourteen_days_ago = now - timedelta(days=14)
        opportunities_inactive = Opportunity.objects.filter(
            status='OPEN',
            last_activity_at__lt=fourteen_days_ago
        ).count()

        sla_at_risk = SLATracker.objects.filter(status=SLAStatus.AT_RISK, completed_time__isnull=True).count()
        sla_breached = SLATracker.objects.filter(status=SLAStatus.BREACHED, completed_time__isnull=True).count()
        sql_pending = SQLHandoff.objects.filter(status=HandoffStatus.PENDING).count()

        prop_warning_date = today_date + timedelta(days=3)
        proposal_alerts = Proposal.objects.filter(
            status__in=[ProposalStatus.APPROVED, ProposalStatus.SENT],
            valid_until__lte=prop_warning_date
        ).count()

        return {
            'activities_today': activities_today,
            'overdue_tasks': overdue_tasks,
            'tasks_due_today': tasks_due_today,
            'leads_no_next_action': leads_no_next_action,
            'opportunities_inactive': opportunities_inactive,
            'sla_at_risk': sla_at_risk,
            'sla_breached': sla_breached,
            'sql_acceptance_pending': sql_pending,
            'proposal_expiry_alerts': proposal_alerts
        }

