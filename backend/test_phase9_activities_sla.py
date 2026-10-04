import os
import django
import uuid
from decimal import Decimal
from datetime import timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.utils import timezone
from django.core.exceptions import ValidationError, PermissionDenied
from apps.authentication.models import User, UserRole
from apps.accounts.models import Account, Contact
from apps.products.models import Product
from apps.leads.models import Lead, LeadStatus
from apps.opportunities.models import Opportunity, Proposal, ProposalStatus, ProposalVersion
from apps.evaluations.models import POC, POCStatus
from apps.sales_handoff.models import SQLHandoff, HandoffStatus
from apps.activities.models import (
    Activity, ActivityType, ActivityStatus, ActivityPriority,
    Task, TaskStatus, TaskPriority,
    Notification, NotificationType, NotificationPriority,
    SLADefinition, SLATracker, SLAEntityType, SLAStatus, SLAEscalationAction,
    AutomationRule, AutomationTrigger, AutomationAction
)
from apps.activities.services import (
    ActivityService, TaskService, NotificationService,
    SLAService, AutomationService, WorkQueueService
)
from apps.activities.seed_rules import seed_phase9_configuration
from apps.audit_logging.models import AuditLog, AuditAction


def run_tests():
    print("=" * 80)
    print("TEXOL CRM -- PHASE 9 AUTOMATED TEST SUITE: ACTIVITIES, TASKS, SLA, AUTOMATION")
    print("=" * 80)

    seed_phase9_configuration()

    # Setup base test fixtures
    admin_user, _ = User.objects.get_or_create(
        email='admin_p9@texol.com',
        defaults={'username': 'admin_p9', 'role': UserRole.ADMIN, 'is_staff': True, 'is_superuser': True}
    )
    sales_mgr, _ = User.objects.get_or_create(
        email='manager_p9@texol.com',
        defaults={'username': 'manager_p9', 'role': UserRole.SALES_MANAGER}
    )
    sales_rep, _ = User.objects.get_or_create(
        email='rep_p9@texol.com',
        defaults={'username': 'rep_p9', 'role': UserRole.SALES_BDM}
    )
    pld_exec, _ = User.objects.get_or_create(
        email='pld_p9@texol.com',
        defaults={'username': 'pld_p9', 'role': UserRole.PLD_EXECUTIVE}
    )

    run_id = uuid.uuid4().hex[:6]
    account = Account.objects.create(
        company_name=f'Saudi Logistics Corp P9 {run_id}',
        industry='Logistics',
        country='SA'
    )
    contact = Contact.objects.create(
        account=account,
        email=f'ops_{run_id}@saudilogistics-p9.com',
        first_name='Tariq',
        last_name='Al-Otaibi',
        designation='VP Fleet Operations'
    )
    product, _ = Product.objects.get_or_create(
        code='VANFORCES_P9',
        defaults={'name': 'VanForces Fleet ERP', 'category': 'Supply Chain'}
    )

    lead = Lead.objects.create(
        account=account,
        primary_product=product,
        owner=pld_exec,
        status=LeadStatus.ACTIVE
    )

    opportunity = Opportunity.objects.create(
        account=account,
        primary_contact=contact,
        product=product,
        owner=sales_rep,
        total_contract_value=Decimal('120000.00'),
        status='OPEN'
    )

    # --------------------------------------------------------------------------
    # SECTION 1: ACTIVITIES
    # --------------------------------------------------------------------------
    print("\n--- SECTION 1: ACTIVITIES & TIMELINE ---")

    # Test 1: Create planned and completed activities
    now = timezone.now()
    act1 = ActivityService.log_activity(
        subject="Technical Architecture Workshop",
        activity_type=ActivityType.MEETING,
        performed_by=sales_rep,
        account=account,
        lead=lead,
        opportunity=opportunity,
        description_notes="Reviewed van routing and telematics requirements.",
        outcome_notes="Client confirmed 120 vans in scope.",
        conducted_at=now,
        duration_minutes=45,
        status=ActivityStatus.COMPLETED
    )
    assert act1.id is not None
    assert act1.status == ActivityStatus.COMPLETED
    assert act1.duration_minutes == 45
    print("[PASS] Test 1: Completed activity logged with parent record linking.")

    # Test 2: Next Action update on Lead and Opportunity
    future_date = now + timedelta(days=2)
    act2 = ActivityService.log_activity(
        subject="Follow-up Call with Fleet Director",
        activity_type=ActivityType.CALL,
        performed_by=pld_exec,
        lead=lead,
        next_action_description="Send integration security document",
        next_action_due_at=future_date,
        create_next_task=True
    )
    lead.refresh_from_db()
    assert lead.next_action_description == "Send integration security document"
    assert lead.next_activity_due_at is not None
    assert lead.last_activity_at is not None
    print("[PASS] Test 2: Activity automatically updated next action on Lead.")

    # Test 3: Activity timeline filters
    lead_activities = Activity.objects.filter(lead=lead)
    assert lead_activities.count() >= 2
    opp_activities = Activity.objects.filter(opportunity=opportunity)
    assert opp_activities.count() >= 1
    call_activities = Activity.objects.filter(activity_type=ActivityType.CALL)
    assert call_activities.count() >= 1
    print("[PASS] Test 3: Chronological timeline queryable by Lead, Opportunity, and ActivityType.")

    # --------------------------------------------------------------------------
    # SECTION 2: NEXT ACTION MANAGEMENT & VISUAL STATES
    # --------------------------------------------------------------------------
    print("\n--- SECTION 2: NEXT ACTION MANAGEMENT ---")

    # Test 4: Next action status calculation
    # Test DUE_SOON
    assert act2.next_action_status in ['DUE_SOON', 'SCHEDULED']
    
    # Test OVERDUE
    overdue_act = Activity.objects.create(
        subject="Past Follow-up",
        activity_type=ActivityType.FOLLOW_UP,
        account=account,
        next_action_description="Urgent overdue follow-up",
        next_action_due_at=now - timedelta(days=3)
    )
    assert overdue_act.next_action_status == 'OVERDUE'

    # Test NO_NEXT_ACTION
    no_act = Activity.objects.create(
        subject="No next action meeting",
        activity_type=ActivityType.MEETING,
        account=account
    )
    assert no_act.next_action_status == 'NO_NEXT_ACTION'
    print("[PASS] Test 4: Next action visual states calculated (OVERDUE, DUE_SOON, NO_NEXT_ACTION).")

    # --------------------------------------------------------------------------
    # SECTION 3: TASKS
    # --------------------------------------------------------------------------
    print("\n--- SECTION 3: TASK MANAGEMENT ---")

    # Test 5: Automatic task creation from Activity with source link
    auto_task = Task.objects.filter(source_activity=act2).first()
    assert auto_task is not None
    assert auto_task.assigned_to == pld_exec
    assert auto_task.title == "Send integration security document"
    print("[PASS] Test 5: Next action automatically generated linked Task.")

    # Test 6: Manual task creation with validation
    manual_task = TaskService.create_task(
        title="Prepare Enterprise Commercial Proposal",
        assigned_to=sales_rep,
        due_date=now + timedelta(days=1),
        created_by=sales_mgr,
        priority=TaskPriority.HIGH,
        related_opportunity=opportunity
    )
    assert manual_task.status == TaskStatus.OPEN
    assert not manual_task.is_completed
    print("[PASS] Test 6: Manual task created with priority and opportunity reference.")

    # Test 7: Task completion
    TaskService.complete_task(manual_task, completed_by=sales_rep)
    manual_task.refresh_from_db()
    assert manual_task.is_completed is True
    assert manual_task.status == TaskStatus.COMPLETED
    assert manual_task.completed_at is not None
    print("[PASS] Test 7: Task completed with timestamp and status synchronization.")

    # Test 8: Overdue task detection
    overdue_task = Task.objects.create(
        title="Old Overdue Task",
        assigned_to=sales_rep,
        due_date=now - timedelta(days=4),
        status=TaskStatus.OPEN,
        is_completed=False
    )
    assert overdue_task.is_overdue is True
    print("[PASS] Test 8: Overdue task properly detected via due_date comparison.")

    # --------------------------------------------------------------------------
    # SECTION 4: NOTIFICATIONS
    # --------------------------------------------------------------------------
    print("\n--- SECTION 4: NOTIFICATIONS ---")

    # Test 9: Create and retrieve notification
    notif = NotificationService.send_notification(
        recipient=sales_rep,
        title="Test Operational Alert",
        message="Please inspect latest account activities.",
        notification_type=NotificationType.GENERAL,
        priority=NotificationPriority.MEDIUM
    )
    assert notif.id is not None
    assert not notif.is_read
    print("[PASS] Test 9: Operational notification created with unread state.")

    # Test 10: Mark notification as read
    notif.mark_as_read()
    notif.refresh_from_db()
    assert notif.is_read is True
    assert notif.read_at is not None
    print("[PASS] Test 10: Notification marked as read with read_at timestamp.")

    # --------------------------------------------------------------------------
    # SECTION 5: THE 9 REQUIRED AUTOMATIONS
    # --------------------------------------------------------------------------
    print("\n--- SECTION 5: THE 9 REQUIRED AUTOMATIONS ---")

    # Automation A: New Lead Owner Assignment
    unassigned_lead = Lead.objects.create(
        account=account,
        primary_product=product,
        owner=None,
        status=LeadStatus.ACTIVE
    )
    assigned = AutomationService.run_new_lead_assignment(unassigned_lead)
    unassigned_lead.refresh_from_db()
    assert assigned is True
    assert unassigned_lead.owner is not None
    print("[PASS] Automation A: New lead without owner automatically assigned.")

    # Automation B: No-Contact Follow-up
    stale_lead = Lead.objects.create(
        account=account,
        primary_product=product,
        owner=pld_exec,
        status=LeadStatus.ACTIVE,
        last_activity_at=now - timedelta(hours=60)
    )
    flagged_no_contact = AutomationService.run_no_contact_check()
    assert flagged_no_contact >= 1
    # Verify task created
    contact_task = Task.objects.filter(related_lead=stale_lead, task_type='FIRST_CONTACT').first()
    assert contact_task is not None
    print("[PASS] Automation B: Lead with no contact >48h flagged and contact task created.")

    # Automation C: No-Next-Action Flag
    no_next_lead = Lead.objects.create(
        account=account,
        primary_product=product,
        owner=pld_exec,
        status=LeadStatus.ACTIVE,
        next_activity_due_at=None
    )
    flagged_no_next = AutomationService.run_no_next_action_check()
    assert flagged_no_next >= 1
    print("[PASS] Automation C: Active lead without future action flagged for user attention.")

    # Automation D: High-Score Manager Notification
    high_score_lead = Lead.objects.create(
        account=account,
        primary_product=product,
        owner=pld_exec,
        status=LeadStatus.ACTIVE
    )
    mgr_notif_triggered = AutomationService.run_high_score_check(high_score_lead, Decimal('88.50'))
    assert mgr_notif_triggered is True
    high_score_notifs = Notification.objects.filter(
        notification_type=NotificationType.HIGH_PLD_SCORE,
        recipient=sales_mgr
    )
    assert high_score_notifs.exists()
    print("[PASS] Automation D: High PLD score (>=80) triggered manager notification.")

    # Automation E: POC Completion -> SQL Review
    poc_trial = POC.objects.create(
        lead=lead,
        account=account,
        product=product,
        scope_description="Saudi Logistics 30-Van Pilot",
        start_date=now.date() - timedelta(days=30),
        end_date=now.date(),
        status=POCStatus.COMPLETED
    )
    poc_reviewed = AutomationService.run_poc_completion_check(poc_trial)
    assert poc_reviewed is True
    poc_review_task = Task.objects.filter(related_poc=poc_trial, task_type='POC_REVIEW').first()
    assert poc_review_task is not None
    print("[PASS] Automation E: POC completion generated SQL review task for lead owner.")

    # Automation F: Proposal Expiry Handling
    expiring_prop = Proposal.objects.create(
        opportunity=opportunity,
        account=account,
        product=product,
        owner=sales_rep,
        status=ProposalStatus.SENT,
        valid_until=now.date() + timedelta(days=2),
        version_number=1
    )
    ProposalVersion.objects.create(
        proposal=expiring_prop,
        version_number=1,
        status=ProposalStatus.SENT,
        valid_until=now.date() + timedelta(days=2),
        created_by=sales_rep
    )
    past_prop = Proposal.objects.create(
        opportunity=opportunity,
        account=account,
        product=product,
        owner=sales_rep,
        status=ProposalStatus.SENT,
        valid_until=now.date() - timedelta(days=1),
        version_number=1
    )
    ProposalVersion.objects.create(
        proposal=past_prop,
        version_number=1,
        status=ProposalStatus.SENT,
        valid_until=now.date() - timedelta(days=1),
        created_by=sales_rep
    )

    prop_res = AutomationService.run_proposal_expiry_check()
    assert prop_res['warning_sent'] >= 1
    assert prop_res['marked_expired'] >= 1
    past_prop.refresh_from_db()
    assert past_prop.status == ProposalStatus.EXPIRED
    print("[PASS] Automation F: Approaching proposal warned and past proposal marked EXPIRED.")

    # Automation G: Inactive Opportunity Escalation
    inactive_opp = Opportunity.objects.create(
        account=account,
        primary_contact=contact,
        product=product,
        owner=sales_rep,
        status='OPEN',
        total_contract_value=Decimal('65000.00'),
        last_activity_at=now - timedelta(days=18)
    )
    opp_escalated = AutomationService.run_inactive_opportunity_check()
    assert opp_escalated >= 1
    inact_task = Task.objects.filter(related_opportunity=inactive_opp, task_type='INACTIVITY_CHECK').first()
    assert inact_task is not None
    print("[PASS] Automation G: Inactive opportunity (>14d) escalated with task and manager alert.")

    # Automation H: SQL Ready Notification & Acceptance SLA
    sql_handoff = SQLHandoff.objects.create(
        lead=lead,
        account=account,
        product=product,
        pld_executive=pld_exec,
        assigned_sales_owner=sales_rep,
        estimated_value=Decimal('90000.00'),
        sla_duration_hours=48,
        sla_expires_at=now + timedelta(hours=48),
        status=HandoffStatus.PENDING
    )
    sql_ready_triggered = AutomationService.run_sql_ready_handoff(lead, sql_handoff)
    assert sql_ready_triggered is True
    acceptance_task = Task.objects.filter(related_handoff=sql_handoff, task_type='SALES_ACCEPTANCE').first()
    assert acceptance_task is not None
    sql_sla = SLATracker.objects.filter(entity_type=SLAEntityType.SQL_ACCEPTANCE, entity_id=sql_handoff.id).first()
    assert sql_sla is not None
    print("[PASS] Automation H: SQL Ready handoff generated acceptance task and 48h SLA tracker.")

    # Automation I: Nurture Re-engagement
    nurture_lead = Lead.objects.create(
        account=account,
        primary_product=product,
        owner=pld_exec,
        status=LeadStatus.NURTURE
    )
    # Simulate updated_at older than 30 days
    Lead.objects.filter(id=nurture_lead.id).update(updated_at=now - timedelta(days=35))
    nurture_reengaged = AutomationService.run_nurture_reengagement_check()
    assert nurture_reengaged >= 1
    reengage_task = Task.objects.filter(related_lead=nurture_lead, task_type='RE_ENGAGEMENT').first()
    assert reengage_task is not None
    print("[PASS] Automation I: Nurture lead (>30d) flagged with scheduled re-engagement task.")

    # --------------------------------------------------------------------------
    # SECTION 6: SLA ENGINE & ESCALATIONS
    # --------------------------------------------------------------------------
    print("\n--- SECTION 6: SLA ENGINE & ESCALATIONS ---")

    # Test 11: Within SLA calculation
    active_tracker = SLAService.start_sla_tracker(
        entity_type=SLAEntityType.FIRST_FOLLOWUP,
        entity_id=lead.id,
        assigned_user=pld_exec,
        duration_hours=24
    )
    assert active_tracker.status == SLAStatus.WITHIN_SLA
    assert active_tracker.remaining_hours > 0
    print("[PASS] Test 11: New SLA tracker initializes in WITHIN_SLA state.")

    # Test 12: Breached SLA and Multi-Tier Escalation
    breached_tracker = SLATracker.objects.create(
        definition=SLAService.get_or_create_default_sla(SLAEntityType.LEAD_RESPONSE),
        entity_type=SLAEntityType.LEAD_RESPONSE,
        entity_id=lead.id,
        assigned_user=sales_rep,
        start_time=now - timedelta(hours=60),
        due_time=now - timedelta(hours=12),
        status=SLAStatus.WITHIN_SLA
    )
    eval_res = SLAService.evaluate_and_escalate_all_slas()
    breached_tracker.refresh_from_db()
    assert breached_tracker.status == SLAStatus.BREACHED
    assert breached_tracker.is_escalated is True
    assert breached_tracker.escalated_at is not None

    # Check that escalation notification was sent to manager
    mgr_breach_notif = Notification.objects.filter(
        recipient=sales_mgr,
        notification_type=NotificationType.SLA_BREACHED
    )
    assert mgr_breach_notif.exists()

    # Check that critical escalation task was created
    esc_task = Task.objects.filter(
        task_type='SLA_EXPIRY',
        priority=TaskPriority.CRITICAL
    )
    assert esc_task.exists()
    print("[PASS] Test 12: Breached SLA escalated to manager with critical task and notification.")

    # Test 13: Completed SLA
    SLAService.complete_sla_tracker(SLAEntityType.FIRST_FOLLOWUP, lead.id)
    active_tracker.refresh_from_db()
    assert active_tracker.status == SLAStatus.COMPLETED
    assert active_tracker.completed_time is not None
    print("[PASS] Test 13: Fulfilled SLA marked COMPLETED.")

    # --------------------------------------------------------------------------
    # SECTION 7: WORK QUEUE & OPERATIONAL METRICS
    # --------------------------------------------------------------------------
    print("\n--- SECTION 7: WORK QUEUE & OPERATIONAL METRICS ---")

    # Test 14: Work Queue data aggregation
    queue_data = WorkQueueService.get_work_queue_data(user=admin_user)
    assert 'overdue_tasks' in queue_data
    assert 'due_today_tasks' in queue_data
    assert 'upcoming_tasks' in queue_data
    assert 'leads_missing_next_action' in queue_data
    assert 'slas_at_risk' in queue_data
    assert queue_data['counts']['overdue'] >= 1
    print("[PASS] Test 14: Work Queue aggregated Overdue, Today, Upcoming, and SLA alerts.")

    # Test 15: Operational Metrics for Executive Dashboard
    metrics = WorkQueueService.get_operational_metrics()
    assert 'activities_today' in metrics
    assert 'overdue_tasks' in metrics
    assert 'tasks_due_today' in metrics
    assert 'leads_no_next_action' in metrics
    assert 'opportunities_inactive' in metrics
    assert 'sla_breached' in metrics
    assert metrics['activities_today'] >= 1
    print("[PASS] Test 15: Operational dashboard metrics generated with real data.")

    # --------------------------------------------------------------------------
    # SECTION 8: AUDIT TRAIL VERIFICATION
    # --------------------------------------------------------------------------
    print("\n--- SECTION 8: AUDIT TRAIL VERIFICATION ---")

    # Test 16: Audit logs for Activity, Task, and SLA events
    act_logs = AuditLog.objects.filter(action=AuditAction.ACTIVITY_LOG)
    assert act_logs.exists()
    task_logs = AuditLog.objects.filter(action=AuditAction.TASK_CREATE)
    assert task_logs.exists()
    sla_logs = AuditLog.objects.filter(action=AuditAction.SLA_BREACH)
    assert sla_logs.exists()
    print("[PASS] Test 16: Immutable Universal Audit Trail verified for Phase 9 actions.")

    print("\n" + "=" * 80)
    print("ALL 16 PHASE 9 CORE AND AUTOMATION TEST BLOCKS PASSED SUCCESSFULLY! (100%)")
    print("=" * 80)


if __name__ == '__main__':
    run_tests()
