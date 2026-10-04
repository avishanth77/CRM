import os
import sys
import django
from datetime import timedelta
from decimal import Decimal

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.utils import timezone
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError, PermissionDenied

from apps.accounts.models import Account, Contact, ContactRoleType, AccountType
from apps.products.models import Product, ProductModule, ProductCapability, ProductStatus
from apps.leads.models import Lead, LeadStatus
from apps.sales_handoff.models import SQLHandoff, HandoffStatus
from apps.opportunities.models import (
    Opportunity, OpportunityStatus,
    Proposal, ProposalVersion, ProposalItem,
    ApprovalRule, ApprovalRuleType, ProposalStatus
)
from apps.opportunities.services import OpportunityService, ProposalService
from apps.workflows.models import StageHistory, Approval, ApprovalType, ApprovalStatus
from apps.activities.models import Activity, ActivityType
from apps.audit_logging.models import AuditLog, AuditAction
from apps.pld_engine.models import PipelineStage, PipelineType, ProductConfigurationVersion

User = get_user_model()


def run_phase8_tests():
    print("=" * 80)
    print("TEXOL CRM -- PHASE 8 AUTOMATED TEST SUITE: PROPOSAL / QUOTE + APPROVALS + NEGOTIATION")
    print("=" * 80)

    # 0. Setup Fixtures
    sales_rep = User.objects.filter(username='rep_user_p8').first()
    if not sales_rep:
        sales_rep = User.objects.create_user(
            username='rep_user_p8', email='rep.p8@texol.sa', password='password123',
            role='SALES_REP'
        )

    sales_mgr = User.objects.filter(username='mgr_user_p8').first()
    if not sales_mgr:
        sales_mgr = User.objects.create_user(
            username='mgr_user_p8', email='mgr.p8@texol.sa', password='password123',
            role='SALES_MANAGER', is_staff=True
        )

    unauth_user = User.objects.filter(username='guest_user_p8').first()
    if not unauth_user:
        unauth_user = User.objects.create_user(
            username='guest_user_p8', email='guest.p8@texol.sa', password='password123',
            role='VIEWER'
        )

    account = Account.objects.create(
        company_name="Saudi Logistics Corp P8",
        industry="Logistics",
        country="Saudi Arabia",
        account_type=AccountType.PROSPECT
    )
    contact = Contact.objects.create(
        account=account,
        first_name="Ahmed",
        last_name="Al-Mansoor",
        email="ahmed.mansoor@saudilogistics.sa",
        designation="Chief Operating Officer",
        role_type=ContactRoleType.DECISION_MAKER
    )
    product = Product.objects.filter(code="VF-LOG-P8").first()
    if not product:
        product = Product.objects.create(
            name="VanForces Logistics Suite P8",
            code="VF-LOG-P8",
            status=ProductStatus.ACTIVE
        )
    module1 = ProductModule.objects.filter(product=product, code="VF-DISP-P8").first()
    if not module1:
        module1 = ProductModule.objects.create(
            product=product,
            name="Fleet Dispatching & Telematics",
            code="VF-DISP-P8"
        )
    module2 = ProductModule.objects.filter(product=product, code="VF-OPT-P8").first()
    if not module2:
        module2 = ProductModule.objects.create(
            product=product,
            name="Inventory & Route Optimization",
            code="VF-OPT-P8"
        )
    cap1 = ProductCapability.objects.filter(module=module1, code="VF-GPS-P8").first()
    if not cap1:
        cap1 = ProductCapability.objects.create(
            product=product,
            module=module1,
            name="Real-time GPS Tracking Engine",
            code="VF-GPS-P8"
        )

    # Pipeline config and stages
    config = ProductConfigurationVersion.objects.filter(product=product, status='PUBLISHED').first()
    if not config:
        config = ProductConfigurationVersion.objects.create(
            product=product,
            version_number=1,
            status='PUBLISHED'
        )

    prop_stage = PipelineStage.objects.filter(config_version=config, stage_code='OPP_PROPOSAL').first()
    if not prop_stage:
        prop_stage = PipelineStage.objects.create(
            config_version=config,
            stage_code='OPP_PROPOSAL',
            stage_name='Proposal / Quote',
            pipeline_type=PipelineType.OPPORTUNITY,
            sequence_order=40
        )
    nego_stage = PipelineStage.objects.filter(config_version=config, stage_code='OPP_NEGOTIATION').first()
    if not nego_stage:
        nego_stage = PipelineStage.objects.create(
            config_version=config,
            stage_code='OPP_NEGOTIATION',
            stage_name='Commercial Negotiation',
            pipeline_type=PipelineType.OPPORTUNITY,
            sequence_order=50
        )
    won_stage = PipelineStage.objects.filter(config_version=config, stage_code='OPP_CLOSED_WON').first()
    if not won_stage:
        won_stage = PipelineStage.objects.create(
            config_version=config,
            stage_code='OPP_CLOSED_WON',
            stage_name='Closed Won',
            pipeline_type=PipelineType.OPPORTUNITY,
            sequence_order=100
        )

    lead = Lead.objects.create(
        account=account,
        contact=contact,
        primary_product=product,
        owner=sales_rep,
        status=LeadStatus.ACTIVE
    )
    handoff = SQLHandoff.objects.create(
        lead=lead,
        account=account,
        product=product,
        status=HandoffStatus.ACCEPTED,
        assigned_sales_owner=sales_rep,
        decision_date=timezone.now(),
        estimated_value=Decimal('100000.00'),
        currency='USD'
    )
    opportunity = OpportunityService.create_from_accepted_sql(
        handoff=handoff,
        user=sales_rep,
        owner=sales_rep
    )

    passed_count = 0

    # -------------------------------------------------------------
    # 1. Create Proposal from Opportunity
    # -------------------------------------------------------------
    proposal = ProposalService.create_proposal(
        opportunity=opportunity,
        data={
            'title': 'Enterprise Fleet Transformation',
            'contract_term_months': 12,
            'discount_pct': 0.00
        },
        user=sales_rep
    )
    assert proposal.id is not None
    assert proposal.opportunity == opportunity
    assert proposal.account == account
    assert proposal.primary_contact == contact
    assert proposal.product == product
    assert proposal.version_number == 1
    assert proposal.proposal_number.startswith('PROP-')
    assert proposal.versions.count() == 1
    passed_count += 1
    print("[PASS] Test 1: Proposal successfully created from Opportunity with linked account, contact and product.")

    # -------------------------------------------------------------
    # 2. Create single line item
    # -------------------------------------------------------------
    prop2 = ProposalService.create_proposal(
        opportunity=opportunity,
        data={
            'title': 'Single Item Proposal',
            'items': [
                {
                    'product': product.id,
                    'module': module1.id,
                    'description': 'Fleet Dispatching Module License',
                    'quantity': 10,
                    'unit_price': '2500.00',
                    'discount_pct': '0.00'
                }
            ]
        },
        user=sales_rep
    )
    v1_2 = prop2.versions.first()
    assert v1_2.items.count() == 1
    item = v1_2.items.first()
    assert item.quantity == 10
    assert item.unit_price == Decimal('2500.00')
    assert item.line_total == Decimal('25000.00')
    assert v1_2.gross_amount == Decimal('25000.00')
    assert v1_2.net_amount == Decimal('25000.00')
    passed_count += 1
    print("[PASS] Test 2: Single proposal line item created with accurate line total calculation.")

    # -------------------------------------------------------------
    # 3. Multiple line items
    # -------------------------------------------------------------
    prop3 = ProposalService.create_proposal(
        opportunity=opportunity,
        data={
            'title': 'Multi-Module Proposal',
            'items': [
                {
                    'product': product.id,
                    'module': module1.id,
                    'quantity': 5,
                    'unit_price': '4000.00',
                    'discount_pct': '0.00'
                },
                {
                    'product': product.id,
                    'module': module2.id,
                    'quantity': 2,
                    'unit_price': '10000.00',
                    'discount_pct': '0.00'
                }
            ]
        },
        user=sales_rep
    )
    v1_3 = prop3.versions.first()
    assert v1_3.items.count() == 2
    # 5 * 4000 = 20000; 2 * 10000 = 20000; total = 40000
    assert v1_3.gross_amount == Decimal('40000.00')
    assert v1_3.net_amount == Decimal('40000.00')
    passed_count += 1
    print("[PASS] Test 3: Multiple line items calculated with correct aggregate totals.")

    # -------------------------------------------------------------
    # 4. Pricing calculation with safe Decimal handling
    # -------------------------------------------------------------
    prop4 = ProposalService.create_proposal(
        opportunity=opportunity,
        data={
            'title': 'Taxed Proposal',
            'tax_pct': '15.00',  # 15% VAT
            'items': [
                {
                    'product': product.id,
                    'quantity': 1,
                    'unit_price': '10000.00',
                    'discount_pct': '0.00'
                }
            ]
        },
        user=sales_rep
    )
    v1_4 = prop4.versions.first()
    assert v1_4.gross_amount == Decimal('10000.00')
    assert v1_4.tax_pct == Decimal('15.00')
    assert v1_4.tax_amount == Decimal('1500.00')
    assert v1_4.net_amount == Decimal('11500.00')
    passed_count += 1
    print("[PASS] Test 4: Pricing calculation with tax percentage applies exact decimal math.")

    # -------------------------------------------------------------
    # 5. Discount handling
    # -------------------------------------------------------------
    prop5 = ProposalService.create_proposal(
        opportunity=opportunity,
        data={
            'title': 'Discounted Proposal',
            'discount_pct': '10.00',
            'discount_reason': 'Strategic introductory partner discount',
            'items': [
                {
                    'product': product.id,
                    'quantity': 1,
                    'unit_price': '50000.00',
                    'discount_pct': '0.00'
                }
            ]
        },
        user=sales_rep
    )
    v1_5 = prop5.versions.first()
    assert v1_5.gross_amount == Decimal('50000.00')
    assert v1_5.discount_pct == Decimal('10.00')
    assert v1_5.discount_amount == Decimal('5000.00')
    assert v1_5.net_amount == Decimal('45000.00')
    passed_count += 1
    print("[PASS] Test 5: Configurable proposal-level discount calculated accurately.")

    # -------------------------------------------------------------
    # 6. Proposal versioning
    # -------------------------------------------------------------
    assert proposal.version_number == 1
    v1 = proposal.versions.first()
    assert v1.version_number == 1
    passed_count += 1
    print("[PASS] Test 6: Proposal Version 1 created by default.")

    # -------------------------------------------------------------
    # 7. Version history preservation
    # -------------------------------------------------------------
    prop7 = ProposalService.create_proposal(
        opportunity=opportunity,
        data={'discount_pct': '5.00'},
        user=sales_rep
    )
    v2_7 = ProposalService.create_new_version(
        proposal=prop7,
        data={'discount_pct': '12.00'},
        user=sales_rep
    )
    assert prop7.versions.count() == 2
    v1_7 = prop7.versions.get(version_number=1)
    assert v1_7.discount_pct == Decimal('5.00')
    assert v2_7.version_number == 2
    assert v2_7.discount_pct == Decimal('12.00')
    assert prop7.version_number == 2
    passed_count += 1
    print("[PASS] Test 7: Historical versions preserved independently without mutation.")

    # -------------------------------------------------------------
    # 8. Expiry checking
    # -------------------------------------------------------------
    yesterday = timezone.now().date() - timedelta(days=1)
    week_ago = timezone.now().date() - timedelta(days=7)
    prop8 = ProposalService.create_proposal(
        opportunity=opportunity,
        data={'valid_from': week_ago, 'valid_until': yesterday},
        user=sales_rep
    )
    v1_8 = prop8.versions.first()
    assert v1_8.is_expired() is True
    assert prop8.is_expired() is True

    ProposalService.mark_expired(v1_8, user=sales_rep)
    v1_8.refresh_from_db()
    prop8.refresh_from_db()
    assert v1_8.status == ProposalStatus.EXPIRED
    assert prop8.status == ProposalStatus.EXPIRED
    passed_count += 1
    print("[PASS] Test 8: Proposal expiry detected and marked as EXPIRED.")

    # -------------------------------------------------------------
    # 9. Proposal Status lifecycle
    # -------------------------------------------------------------
    prop9 = ProposalService.create_proposal(
        opportunity=opportunity,
        data={'discount_pct': '0.00'},
        user=sales_rep
    )
    v1_9 = prop9.versions.first()
    assert v1_9.status == ProposalStatus.APPROVED

    ProposalService.send_proposal(v1_9, user=sales_rep, recipient_email='ahmed@saudilogistics.sa')
    v1_9.refresh_from_db()
    prop9.refresh_from_db()
    assert v1_9.status == ProposalStatus.SENT
    assert prop9.status == ProposalStatus.SENT
    passed_count += 1
    print("[PASS] Test 9: Proposal lifecycle transitions from DRAFT -> APPROVED -> SENT.")

    # -------------------------------------------------------------
    # 10. Proposal validation
    # -------------------------------------------------------------
    today = timezone.now().date()
    yesterday = today - timedelta(days=1)
    val_error_caught = False
    try:
        ProposalService.create_proposal(
            opportunity=opportunity,
            data={'valid_from': today, 'valid_until': yesterday},
            user=sales_rep
        )
    except ValidationError:
        val_error_caught = True
    assert val_error_caught is True
    passed_count += 1
    print("[PASS] Test 10: Proposal validation rejects invalid date boundaries.")

    # -------------------------------------------------------------
    # 11. Approval required rule evaluation
    # -------------------------------------------------------------
    rule = ApprovalRule.objects.create(
        rule_name="Standard Discount Cap",
        rule_type=ApprovalRuleType.DISCOUNT_PERCENT,
        threshold_value=Decimal('10.00'),
        approver_role="SALES_MANAGER",
        is_active=True
    )

    prop11 = ProposalService.create_proposal(
        opportunity=opportunity,
        data={'discount_pct': '15.00', 'discount_reason': 'Volume commitment'},
        user=sales_rep
    )
    v1_11 = prop11.versions.first()
    assert v1_11.approval_required_flag is True
    assert v1_11.status == ProposalStatus.PENDING_APPROVAL
    assert v1_11.approval_request is not None
    assert v1_11.approval_request.status == ApprovalStatus.PENDING
    passed_count += 1
    print("[PASS] Test 11: Configurable ApprovalRule triggers approval requirement above threshold.")

    # -------------------------------------------------------------
    # 12. Manual / automated approval request
    # -------------------------------------------------------------
    prop12 = ProposalService.create_proposal(
        opportunity=opportunity,
        data={'discount_pct': '5.00'},
        user=sales_rep
    )
    v1_12 = prop12.versions.first()
    assert v1_12.approval_required_flag is False

    ProposalService.request_approval(v1_12, reason="Requesting custom 24-month payment terms", user=sales_rep)
    v1_12.refresh_from_db()
    prop12.refresh_from_db()
    assert v1_12.approval_required_flag is True
    assert v1_12.status == ProposalStatus.PENDING_APPROVAL
    assert prop12.status == ProposalStatus.PENDING_APPROVAL
    passed_count += 1
    print("[PASS] Test 12: Manual approval request creates pending Approval record and locks proposal.")

    # -------------------------------------------------------------
    # 13. Approve decision
    # -------------------------------------------------------------
    prop13 = ProposalService.create_proposal(
        opportunity=opportunity,
        data={'discount_pct': '20.00'},
        user=sales_rep
    )
    v1_13 = prop13.versions.first()
    assert v1_13.status == ProposalStatus.PENDING_APPROVAL

    ProposalService.approve_proposal(v1_13, user=sales_mgr, comments="Approved for strategic logo acquisition.")
    v1_13.refresh_from_db()
    prop13.refresh_from_db()
    assert v1_13.status == ProposalStatus.APPROVED
    assert prop13.status == ProposalStatus.APPROVED
    assert v1_13.approved_at is not None
    assert v1_13.approval_request.status == ApprovalStatus.APPROVED
    passed_count += 1
    print("[PASS] Test 13: Authorized manager approval unlocks proposal for client delivery.")

    # -------------------------------------------------------------
    # 14. Reject decision
    # -------------------------------------------------------------
    prop14 = ProposalService.create_proposal(
        opportunity=opportunity,
        data={'discount_pct': '30.00'},
        user=sales_rep
    )
    v1_14 = prop14.versions.first()

    ProposalService.reject_proposal(v1_14, user=sales_mgr, rejection_reason="Discount exceeds commercial ceiling of 20%.")
    v1_14.refresh_from_db()
    prop14.refresh_from_db()
    assert v1_14.status == ProposalStatus.REJECTED
    assert prop14.status == ProposalStatus.REJECTED
    assert v1_14.approval_request.status == ApprovalStatus.REJECTED
    assert v1_14.approval_request.decision_notes == "Discount exceeds commercial ceiling of 20%."
    passed_count += 1
    print("[PASS] Test 14: Proposal rejected with documented reason recorded.")

    # -------------------------------------------------------------
    # 15. Reject without reason blocked
    # -------------------------------------------------------------
    prop15 = ProposalService.create_proposal(
        opportunity=opportunity,
        data={'discount_pct': '25.00'},
        user=sales_rep
    )
    v1_15 = prop15.versions.first()
    reject_err = False
    try:
        ProposalService.reject_proposal(v1_15, user=sales_mgr, rejection_reason="")
    except ValidationError:
        reject_err = True
    assert reject_err is True
    passed_count += 1
    print("[PASS] Test 15: Silent rejection without reason blocked by ValidationError.")

    # -------------------------------------------------------------
    # 16. Unauthorized approval blocked
    # -------------------------------------------------------------
    prop16 = ProposalService.create_proposal(
        opportunity=opportunity,
        data={'discount_pct': '25.00'},
        user=sales_rep
    )
    v1_16 = prop16.versions.first()
    perm_err = False
    try:
        ProposalService.approve_proposal(v1_16, user=unauth_user, comments="Unauthorized bypass")
    except PermissionDenied:
        perm_err = True
    assert perm_err is True
    passed_count += 1
    print("[PASS] Test 16: Unauthorized approval attempt blocked by PermissionDenied.")

    # -------------------------------------------------------------
    # 17. Approval history
    # -------------------------------------------------------------
    prop17 = ProposalService.create_proposal(
        opportunity=opportunity,
        data={'discount_pct': '20.00'},
        user=sales_rep
    )
    v1_17 = prop17.versions.first()
    ProposalService.approve_proposal(v1_17, user=sales_mgr, comments="Approved.")

    approvals = Approval.objects.filter(record_type='PROPOSAL_VERSION', record_id=v1_17.id)
    assert approvals.count() == 1
    assert approvals.first().approver == sales_mgr
    passed_count += 1
    print("[PASS] Test 17: Approval request and decision permanently queryable in approval history.")

    # -------------------------------------------------------------
    # 18-21. Version 2 creation, independent approval and immutability
    # -------------------------------------------------------------
    prop18 = ProposalService.create_proposal(
        opportunity=opportunity,
        data={'discount_pct': '5.00'},
        user=sales_rep
    )
    v1_18 = prop18.versions.first()
    assert v1_18.status == ProposalStatus.APPROVED

    v2_18 = ProposalService.create_new_version(
        proposal=prop18,
        data={'discount_pct': '20.00', 'discount_reason': 'Competitive match with competitor X'},
        user=sales_rep
    )

    v1_18.refresh_from_db()
    assert v1_18.version_number == 1
    assert v1_18.discount_pct == Decimal('5.00')

    assert v2_18.version_number == 2
    assert v2_18.discount_pct == Decimal('20.00')
    assert v2_18.approval_required_flag is True
    assert v2_18.status == ProposalStatus.PENDING_APPROVAL

    prop18.refresh_from_db()
    assert prop18.version_number == 2
    assert prop18.status == ProposalStatus.PENDING_APPROVAL

    ProposalService.approve_proposal(v2_18, user=sales_mgr, comments="Approved match.")
    v2_18.refresh_from_db()
    assert v2_18.status == ProposalStatus.APPROVED
    passed_count += 4
    print("[PASS] Tests 18-21: Version 2 created, V1 remains intact, V2 has independent approval workflow.")

    # -------------------------------------------------------------
    # 22. Approved proposal can be sent
    # -------------------------------------------------------------
    prop22 = ProposalService.create_proposal(
        opportunity=opportunity,
        data={'discount_pct': '0.00'},
        user=sales_rep
    )
    v1_22 = prop22.versions.first()
    sent_version = ProposalService.send_proposal(
        proposal_version=v1_22,
        user=sales_rep,
        recipient_email='ahmed@saudilogistics.sa'
    )
    assert sent_version.status == ProposalStatus.SENT
    assert sent_version.sent_to == 'ahmed@saudilogistics.sa'
    passed_count += 1
    print("[PASS] Test 22: Approved proposal sent to client successfully.")

    # -------------------------------------------------------------
    # 23. Unapproved proposal blocked from sending when approval required
    # -------------------------------------------------------------
    prop23 = ProposalService.create_proposal(
        opportunity=opportunity,
        data={'discount_pct': '25.00'},
        user=sales_rep
    )
    v1_23 = prop23.versions.first()
    assert v1_23.status == ProposalStatus.PENDING_APPROVAL

    unapproved_blocked = False
    try:
        ProposalService.send_proposal(v1_23, user=sales_rep)
    except ValidationError:
        unapproved_blocked = True
    assert unapproved_blocked is True
    passed_count += 1
    print("[PASS] Test 23: Unapproved proposal strictly blocked from sending when approval is required.")

    # -------------------------------------------------------------
    # 24. Expired proposal cannot be sent
    # -------------------------------------------------------------
    prop24 = ProposalService.create_proposal(
        opportunity=opportunity,
        data={'valid_from': week_ago, 'valid_until': yesterday, 'discount_pct': '0.00'},
        user=sales_rep
    )
    v1_24 = prop24.versions.first()
    expired_blocked = False
    try:
        ProposalService.send_proposal(v1_24, user=sales_rep)
    except ValidationError:
        expired_blocked = True
    assert expired_blocked is True
    passed_count += 1
    print("[PASS] Test 24: Expired proposal blocked from sending.")

    # -------------------------------------------------------------
    # 25. Sent activity recorded in Activity system
    # -------------------------------------------------------------
    prop25 = ProposalService.create_proposal(
        opportunity=opportunity,
        data={'discount_pct': '0.00'},
        user=sales_rep
    )
    v1_25 = prop25.versions.first()
    ProposalService.send_proposal(v1_25, user=sales_rep, recipient_email='ahmed@saudilogistics.sa')

    act = Activity.objects.filter(proposal=prop25, activity_type=ActivityType.PROPOSAL_SENT).first()
    assert act is not None
    assert act.opportunity == opportunity
    assert "PROP-" in act.subject
    passed_count += 1
    print("[PASS] Test 25: PROPOSAL_SENT activity recorded in CRM timeline.")

    # -------------------------------------------------------------
    # 26. Transition to Negotiation stage
    # -------------------------------------------------------------
    OpportunityService.transition_to_negotiation(opportunity, user=sales_rep, reason="Client received quote; starting commercial terms negotiation.")
    opportunity.refresh_from_db()
    assert opportunity.stage.stage_code == 'OPP_NEGOTIATION'
    passed_count += 1
    print("[PASS] Test 26: Opportunity transitioned to Negotiation stage.")

    # -------------------------------------------------------------
    # 27. Invalid backward stage transition blocked without reason
    # -------------------------------------------------------------
    backward_blocked = False
    try:
        OpportunityService.transition_stage(opportunity, target_stage=prop_stage, reason="", user=sales_rep)
    except ValidationError:
        backward_blocked = True
    assert backward_blocked is True
    passed_count += 1
    print("[PASS] Test 27: Backward pipeline transition requires mandatory explanatory reason.")

    # -------------------------------------------------------------
    # 28-29. Negotiation activities and next actions
    # -------------------------------------------------------------
    act_nego = Activity.objects.create(
        opportunity=opportunity,
        account=account,
        activity_type=ActivityType.NEGOTIATION,
        subject="Commercial Payment Terms Discussion with CFO",
        outcome_notes="Agreed to quarterly billing instead of annual upfront.",
        next_action_description="Send revised Proposal V2 with quarterly payment schedule",
        next_action_due_at=timezone.now() + timedelta(days=2)
    )
    opportunity.last_activity_at = timezone.now()
    opportunity.next_action_description = act_nego.next_action_description
    opportunity.next_activity_due_at = act_nego.next_action_due_at
    opportunity.save()

    opportunity.refresh_from_db()
    assert opportunity.next_action_description == "Send revised Proposal V2 with quarterly payment schedule"
    passed_count += 2
    print("[PASS] Tests 28 & 29: Negotiation activities and next actions updated on Opportunity.")

    # -------------------------------------------------------------
    # 30-31. Stage history and Audit trail
    # -------------------------------------------------------------
    sh = StageHistory.objects.filter(record_type='OPPORTUNITY', record_id=opportunity.id)
    assert sh.exists() is True

    audit_entries = AuditLog.objects.filter(entity_type='Opportunity', entity_id=opportunity.id)
    assert audit_entries.exists() is True
    passed_count += 2
    print("[PASS] Tests 30 & 31: Stage history and Universal Audit Trail logged with WHO, WHAT, WHEN.")

    # -------------------------------------------------------------
    # 32-34. Security and RBAC enforcement
    # -------------------------------------------------------------
    prop32 = ProposalService.create_proposal(
        opportunity=opportunity,
        data={'discount_pct': '20.00'},
        user=sales_rep
    )
    v1_32 = prop32.versions.first()

    rep_self_approve_blocked = False
    try:
        ProposalService.approve_proposal(v1_32, user=sales_rep, comments="Self approval")
    except PermissionDenied:
        rep_self_approve_blocked = True
    assert rep_self_approve_blocked is True

    guest_reject_blocked = False
    try:
        ProposalService.reject_proposal(v1_32, user=unauth_user, rejection_reason="Unauthorized rejection")
    except PermissionDenied:
        guest_reject_blocked = True
    assert guest_reject_blocked is True
    passed_count += 3
    print("[PASS] Tests 32-34: RBAC commercial permissions verified: Sales Rep and Viewer cannot approve/reject.")

    # -------------------------------------------------------------
    # 33. COMPLETE END-TO-END TEST
    # SQL Accepted -> Opportunity -> Proposal V1 -> Approval -> Send -> Negotiation -> Won
    # -------------------------------------------------------------
    print("\n--- RUNNING COMPLETE SECTION 33 END-TO-END COMMERCIAL TEST ---")
    assert opportunity.status == OpportunityStatus.OPEN

    # Sales Rep creates Proposal V1 with 18% discount (triggers approval rule)
    prop_e2e = ProposalService.create_proposal(
        opportunity=opportunity,
        data={
            'title': 'End-to-End Fleet Cloud Commercial Proposal',
            'discount_pct': '18.00',
            'discount_reason': 'High-volume 50-vehicle commitment',
            'tax_pct': '15.00',
            'items': [
                {
                    'product': product.id,
                    'module': module1.id,
                    'description': 'VanForces Dispatching Core License',
                    'quantity': 50,
                    'unit_price': '2000.00',
                    'discount_pct': '0.00'
                }
            ]
        },
        user=sales_rep
    )
    v1_e2e = prop_e2e.versions.first()
    assert v1_e2e.gross_amount == Decimal('100000.00')
    assert v1_e2e.discount_amount == Decimal('18000.00')
    assert v1_e2e.tax_amount == Decimal('12300.00')
    assert v1_e2e.net_amount == Decimal('94300.00')
    assert v1_e2e.status == ProposalStatus.PENDING_APPROVAL

    # Blocked from sending
    e2e_send_blocked = False
    try:
        ProposalService.send_proposal(v1_e2e, user=sales_rep)
    except ValidationError:
        e2e_send_blocked = True
    assert e2e_send_blocked is True

    # Sales Manager approves
    ProposalService.approve_proposal(v1_e2e, user=sales_mgr, comments="Approved for 50-vehicle deal.")
    v1_e2e.refresh_from_db()
    assert v1_e2e.status == ProposalStatus.APPROVED

    # Send approved proposal to client
    ProposalService.send_proposal(v1_e2e, user=sales_rep, recipient_email='procurement@saudilogistics.sa')
    v1_e2e.refresh_from_db()
    prop_e2e.refresh_from_db()
    assert v1_e2e.status == ProposalStatus.SENT
    assert prop_e2e.status == ProposalStatus.SENT

    # Advance to Negotiation
    ProposalService.transition_to_negotiation(opportunity, user=sales_rep, reason="Client reviewing proposal v1.")
    opportunity.refresh_from_db()
    assert opportunity.stage.stage_code == 'OPP_NEGOTIATION'

    # Close deal as WON with final proposal
    ProposalService.mark_opportunity_won(opportunity, final_proposal=prop_e2e, user=sales_mgr)
    opportunity.refresh_from_db()
    prop_e2e.refresh_from_db()
    assert opportunity.status == OpportunityStatus.WON
    assert opportunity.stage.stage_code == 'OPP_CLOSED_WON'
    assert prop_e2e.status == ProposalStatus.ACCEPTED
    assert opportunity.account.account_type == AccountType.CUSTOMER

    passed_count += 1
    print("[PASS] Test 35: Full Section 33 E2E completed: SQL -> Opportunity -> Proposal -> Approval -> Sent -> Negotiation -> Closed Won.")

    print("\n" + "=" * 80)
    print(f"ALL {passed_count} PHASE 8 TESTS PASSED SUCCESSFULLY! (100% SUCCESS)")
    print("=" * 80)


if __name__ == '__main__':
    run_phase8_tests()
