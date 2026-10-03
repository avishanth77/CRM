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

from apps.core.models import Tenant
from apps.products.models import (
    Product, ProductModule, ProductCapability, Problem,
    ProblemCapability, ProductStatus
)
from apps.accounts.models import Account, Contact, ContactRoleType, AccountType
from apps.leads.models import Lead, LeadProblem, LeadStatus
from apps.discovery.models import (
    Discovery, DiscoveryProblem, DiscoveryProblemMapping,
    DiscoveryStakeholder, DiscoveryStatus
)
from apps.evaluations.models import (
    Demo, DemoStatus, DemoParticipant, DemoUseCaseMapping,
    POC, POCStatus, POCParticipant
)
from apps.evaluations.services import StageRequirementChecker
from apps.sales_handoff.models import SQLHandoff, HandoffStatus
from apps.sales_handoff.services import SQLReadinessValidator, SQLHandoffService
from apps.opportunities.models import (
    Opportunity, OpportunityProduct, OpportunityModule,
    OpportunityCapability, OpportunityType, OpportunityStatus
)
from apps.opportunities.services import OpportunityService
from apps.pld_assessments.models import AccountProductAssessment
from apps.activities.models import Activity, ActivityType
from apps.audit_logging.models import AuditLog, AuditAction
from apps.workflows.models import StageHistory
from apps.pld_engine.models import (
    ProductConfigurationVersion, PipelineStage, PipelineType
)

User = get_user_model()


def run_phase7_tests():
    print("=" * 80)
    print("TEXOL CRM -- PHASE 7 AUTOMATED TEST SUITE: SQL READINESS + SALES ACCEPTANCE + OPPORTUNITY")
    print("=" * 80)

    # 0. Setup Base Fixtures
    tenant = Tenant.objects.filter(code="TEXOL_CORP").first()
    if not tenant:
        tenant = Tenant.objects.create(code="TEXOL_CORP", name="TEXOL Technologies")

    pld_user = User.objects.filter(username="pld_rep_tariq").first()
    if not pld_user:
        pld_user = User.objects.create(
            username="pld_rep_tariq",
            email="tariq.pld@texol.sa",
            first_name="Tariq",
            last_name="Mansour",
            role="SDR",
            tenant=tenant
        )

    sales_user = User.objects.filter(username="ae_faisal").first()
    if not sales_user:
        sales_user = User.objects.create(
            username="ae_faisal",
            email="faisal.sales@texol.sa",
            first_name="Faisal",
            last_name="Al-Zahrani",
            role="ACCOUNT_EXECUTIVE",
            tenant=tenant
        )

    vp_sales = User.objects.filter(username="vp_sales_nasser").first()
    if not vp_sales:
        vp_sales = User.objects.create(
            username="vp_sales_nasser",
            email="nasser.vp@texol.sa",
            first_name="Nasser",
            last_name="Al-Harbi",
            role="VP_SALES",
            tenant=tenant
        )

    # Product & Pipeline Setup
    product = Product.objects.filter(code="VF-001").first()
    if not product:
        product = Product.objects.create(
            name="VanForces",
            code="VF-001",
            category="VAN_SALES",
            status=ProductStatus.ACTIVE,
            tenant=tenant
        )

    module = ProductModule.objects.filter(product=product, code="MOD-ROUTE-OPT").first()
    if not module:
        module = ProductModule.objects.create(
            product=product,
            name="Dynamic Route Optimization",
            code="MOD-ROUTE-OPT",
            is_active=True,
            tenant=tenant
        )

    capability = ProductCapability.objects.filter(module=module, code="CAP-LIVE-DISPATCH").first()
    if not capability:
        capability = ProductCapability.objects.create(
            product=product,
            module=module,
            name="Real-time Dispatching",
            code="CAP-LIVE-DISPATCH",
            tenant=tenant
        )

    problem_def = Problem.objects.filter(code="PROB-ROUTE-INEFF").first()
    if not problem_def:
        problem_def = Problem.objects.create(
            name="Manual Dispatch Route Inefficiency",
            code="PROB-ROUTE-INEFF",
            tenant=tenant
        )
        ProblemCapability.objects.create(problem=problem_def, capability=capability)

    config = ProductConfigurationVersion.objects.filter(product=product, status='PUBLISHED').first()
    if not config:
        config = ProductConfigurationVersion.objects.create(
            product=product,
            version_number=1,
            status='PUBLISHED',
            tenant=tenant
        )
        stage_pld = PipelineStage.objects.create(
            config_version=config,
            stage_name="PLD Qualification",
            stage_code="PLD_QUALIFIED",
            pipeline_type=PipelineType.PURSUIT,
            sequence_order=1,
            tenant=tenant
        )
        stage_disco = PipelineStage.objects.create(
            config_version=config,
            stage_name="Technical Discovery",
            stage_code="DISCOVERY",
            pipeline_type=PipelineType.PURSUIT,
            sequence_order=2,
            tenant=tenant
        )
        stage_sql = PipelineStage.objects.create(
            config_version=config,
            stage_name="SQL Ready",
            stage_code="SQL_READY",
            pipeline_type=PipelineType.PURSUIT,
            sequence_order=3,
            tenant=tenant
        )
        stage_opp1 = PipelineStage.objects.create(
            config_version=config,
            stage_name="Commercial Discovery",
            stage_code="OPP_DISCO",
            pipeline_type=PipelineType.OPPORTUNITY,
            sequence_order=1,
            tenant=tenant
        )
        stage_opp2 = PipelineStage.objects.create(
            config_version=config,
            stage_name="Proposal / Quote",
            stage_code="OPP_PROPOSAL",
            pipeline_type=PipelineType.OPPORTUNITY,
            sequence_order=2,
            tenant=tenant
        )
    else:
        stage_sql = config.stages.filter(stage_code="SQL_READY").first()
        if not stage_sql:
            stage_sql = PipelineStage.objects.create(
                config_version=config,
                stage_name="SQL Ready",
                stage_code="SQL_READY",
                pipeline_type=PipelineType.PURSUIT,
                sequence_order=3,
                tenant=tenant
            )
        stage_opp1 = config.stages.filter(pipeline_type=PipelineType.OPPORTUNITY).order_by('sequence_order').first()
        if not stage_opp1:
            stage_opp1 = PipelineStage.objects.create(
                config_version=config,
                stage_name="Commercial Discovery",
                stage_code="OPP_DISCO",
                pipeline_type=PipelineType.OPPORTUNITY,
                sequence_order=1,
                tenant=tenant
            )
        stage_opp2 = config.stages.filter(pipeline_type=PipelineType.OPPORTUNITY, sequence_order=2).first()
        if not stage_opp2:
            stage_opp2 = PipelineStage.objects.create(
                config_version=config,
                stage_name="Proposal / Quote",
                stage_code="OPP_PROPOSAL",
                pipeline_type=PipelineType.OPPORTUNITY,
                sequence_order=2,
                tenant=tenant
            )

    # Helper function to generate a fully-qualified lead
    def create_fully_qualified_lead(suffix="A"):
        acc = Account.objects.create(
            company_name=f"Al-Bustan Beverages {suffix}",
            account_type=AccountType.PROSPECT,
            target_tier="TIER_1",
            is_target_account=True,
            tenant=tenant
        )
        ct = Contact.objects.create(
            account=acc,
            first_name="Tariq",
            last_name="Al-Jamil",
            email=f"tariq{suffix.lower()}@albustan.sa",
            phone="+966501239999",
            role_type=ContactRoleType.DECISION_MAKER,
            tenant=tenant
        )
        ld = Lead.objects.create(
            account=acc,
            contact=ct,
            primary_product=product,
            owner=pld_user,
            status=LeadStatus.ACTIVE,
            estimated_opportunity_value=Decimal('85000.00'),
            timeline_expectation="Q4 2026 Commercial Rollout",
            next_action_description="Executive commercial handoff meeting",
            next_activity_due_at=timezone.now() + timedelta(days=2),
            tenant=tenant
        )
        # Assessment passing ICP
        AccountProductAssessment.objects.create(
            account=acc,
            lead=ld,
            product=product,
            config_version=config,
            assessed_by=pld_user,
            icp_result='PASS',
            icp_knockout_passed=True,
            icp_fit_score=92,
            pld_score=88,
            tenant=tenant
        )
        # Discovery with confirmed problem, impact, capability, stakeholder, timeline
        disco = Discovery.objects.create(
            lead=ld,
            account=acc,
            product=product,
            conducted_by=pld_user,
            status=DiscoveryStatus.COMPLETED,
            business_impact_summary="Estimated 18% fuel waste and SAR 320,000 annual operational loss",
            expected_decision_date=timezone.now().date() + timedelta(days=30),
            decision_process_notes="CFO and VP Logistics require joint business case review",
            is_product_mapping_complete=True,
            tenant=tenant
        )
        d_prob = DiscoveryProblem.objects.create(
            discovery=disco,
            problem=problem_def,
            refined_statement="Severe delay in route recalibration causing 2.5 hours idle driver time daily",
            impact_description="SAR 320,000 lost in delivery delays per annum",
            is_confirmed=True,
            tenant=tenant
        )
        DiscoveryProblemMapping.objects.create(
            discovery_problem=d_prob,
            capability=capability,
            expected_kpi_impact="Automated instant dynamic route resequencing",
            tenant=tenant
        )
        DiscoveryStakeholder.objects.create(
            discovery=disco,
            contact=ct,
            decision_role=ContactRoleType.DECISION_MAKER,
            involvement_level='HIGH',
            tenant=tenant
        )
        return ld

    print("\n--- TEST GROUP 1: SQL READINESS GATES & BLOCKING ---")

    # Test 1: All gates complete
    lead_all = create_fully_qualified_lead("ALL")
    res1 = SQLReadinessValidator.validate_readiness(lead_all)
    assert res1["is_ready"] is True, f"Expected READY, got {res1['status']}"
    assert res1["status"] == "READY"
    assert len(res1["missing_gates"]) == 0
    print("✓ Test 1 Passed: All 9 SQL gates complete and validated as READY.")

    # Test 2: Missing ICP
    lead_no_icp = create_fully_qualified_lead("NO_ICP")
    lead_no_icp.assessments.all().delete()
    lead_no_icp.account.target_tier = ""
    lead_no_icp.account.is_target_account = False
    lead_no_icp.account.save()
    res2 = SQLReadinessValidator.validate_readiness(lead_no_icp)
    assert res2["is_ready"] is False
    assert "ICP Confirmed" in res2["missing_gates"]
    print("✓ Test 2 Passed: Missing ICP gate correctly flagged.")

    # Test 3: Missing business problem
    lead_no_prob = create_fully_qualified_lead("NO_PROB")
    for d in lead_no_prob.discoveries.all():
        d.problems.all().delete()
    lead_no_prob.recorded_problems.all().delete()
    res3 = SQLReadinessValidator.validate_readiness(lead_no_prob)
    assert res3["is_ready"] is False
    assert "Business Problem Confirmed" in res3["missing_gates"]
    print("✓ Test 3 Passed: Missing confirmed business problem gate detected.")

    # Test 4: Missing impact
    lead_no_imp = create_fully_qualified_lead("NO_IMP")
    for d in lead_no_imp.discoveries.all():
        d.business_impact_summary = ""
        d.save()
        for dp in d.problems.all():
            dp.impact_description = ""
            dp.save()
    res4 = SQLReadinessValidator.validate_readiness(lead_no_imp)
    assert res4["is_ready"] is False
    assert "Problem Impact Documented" in res4["missing_gates"]
    print("✓ Test 4 Passed: Missing problem business impact gate detected.")

    # Test 5: Missing capability
    lead_no_cap = create_fully_qualified_lead("NO_CAP")
    for d in lead_no_cap.discoveries.all():
        d.is_product_mapping_complete = False
        d.save()
        for dp in d.problems.all():
            dp.capability_mappings.all().delete()
    res5 = SQLReadinessValidator.validate_readiness(lead_no_cap)
    assert res5["is_ready"] is False
    assert "Solution / Capability Identified" in res5["missing_gates"]
    print("✓ Test 5 Passed: Missing capability mapping detected.")

    # Test 6: Missing decision maker / buying process
    lead_no_dm = create_fully_qualified_lead("NO_DM")
    lead_no_dm.contact.role_type = ContactRoleType.USER
    lead_no_dm.contact.save()
    for d in lead_no_dm.discoveries.all():
        d.stakeholders.all().delete()
        d.decision_process_notes = ""
        d.save()
    res6 = SQLReadinessValidator.validate_readiness(lead_no_dm)
    assert res6["is_ready"] is False
    assert "Decision Maker / Buying Process Documented" in res6["missing_gates"]
    print("✓ Test 6 Passed: Missing decision maker / buying process detected.")

    # Test 7: Missing timeline
    lead_no_time = create_fully_qualified_lead("NO_TIME")
    lead_no_time.timeline_expectation = ""
    lead_no_time.save()
    for d in lead_no_time.discoveries.all():
        d.expected_decision_date = None
        d.expected_implementation_date = None
        d.timeline_notes = ""
        d.save()
    res7 = SQLReadinessValidator.validate_readiness(lead_no_time)
    assert res7["is_ready"] is False
    assert "Timeline Documented" in res7["missing_gates"]
    print("✓ Test 7 Passed: Missing timeline gate detected.")

    # Test 8: Missing commercial action
    lead_no_act = create_fully_qualified_lead("NO_ACT")
    lead_no_act.next_action_description = ""
    lead_no_act.save()
    res8 = SQLReadinessValidator.validate_readiness(lead_no_act)
    assert res8["is_ready"] is False
    assert "Next Commercial Action Documented" in res8["missing_gates"]
    print("✓ Test 8 Passed: Missing next commercial action detected.")

    # Test 9: Missing opportunity value
    lead_no_val = create_fully_qualified_lead("NO_VAL")
    lead_no_val.estimated_opportunity_value = Decimal('0.00')
    lead_no_val.save()
    res9 = SQLReadinessValidator.validate_readiness(lead_no_val)
    assert res9["is_ready"] is False
    assert "Opportunity Value Documented" in res9["missing_gates"]
    print("✓ Test 9 Passed: Missing opportunity value detected.")

    # Test 10: Missing required POC result
    lead_poc_req = create_fully_qualified_lead("POC_REQ")
    poc_stage, _ = PipelineStage.objects.get_or_create(
        config_version=config,
        stage_code="POC",
        defaults={"stage_name": "POC Pilot", "pipeline_type": PipelineType.PURSUIT, "sequence_order": 3, "is_required": True, "tenant": tenant}
    )
    poc_stage.is_required = True
    poc_stage.save()
    res10 = SQLReadinessValidator.validate_readiness(lead_poc_req)
    assert res10["is_ready"] is False
    assert "Required POC Result Documented" in res10["missing_gates"]
    # Revert POC stage requirement
    poc_stage.is_required = False
    poc_stage.save()
    print("✓ Test 10 Passed: Missing mandatory POC result detected.")

    # Test 11: SQL blocked on backend when gates incomplete
    blocked_lead = lead_no_val
    try:
        SQLHandoffService.submit_sql(lead=blocked_lead, user=pld_user)
        assert False, "Expected ValidationError due to missing gates."
    except ValidationError as e:
        assert "SQL Readiness blocked" in str(e)
    print("✓ Test 11 Passed: Backend strictly blocks submission when gates are incomplete.")

    # Test 12: Authorized override succeeds with manager and reason
    overridden_handoff = SQLHandoffService.submit_sql(
        lead=lead_no_dm,
        user=vp_sales,
        is_override=True,
        override_reason="VP Sales authorized commercial review due to strategic key account tier."
    )
    assert overridden_handoff.is_override is True
    assert overridden_handoff.override_reason is not None
    assert overridden_handoff.override_approved_by == vp_sales
    assert overridden_handoff.readiness_status == 'OVERRIDDEN'
    assert len(overridden_handoff.original_gate_results.get("missing_gates", [])) > 0
    print("✓ Test 12 Passed: Authorized override succeeds and captures original gate results.")

    # Test 13: Unauthorized override rejected
    lead_unauth = create_fully_qualified_lead("UNAUTH")
    lead_unauth.estimated_opportunity_value = Decimal('0.00')
    lead_unauth.save()
    try:
        SQLHandoffService.submit_sql(
            lead=lead_unauth,
            user=pld_user,  # SDR role - not in authorized override roles
            is_override=True,
            override_reason="SDR trying to bypass gates"
        )
        assert False, "Expected PermissionDenied."
    except PermissionDenied as e:
        assert "not have authorization" in str(e)
    print("✓ Test 13 Passed: Unauthorized override blocked with PermissionDenied.")

    # Test 14: Override reason mandatory
    try:
        SQLHandoffService.submit_sql(
            lead=lead_unauth,
            user=vp_sales,
            is_override=True,
            override_reason=""  # Empty reason
        )
        assert False, "Expected ValidationError for missing override reason."
    except ValidationError as e:
        assert "override reason is mandatory" in str(e)
    print("✓ Test 14 Passed: Mandatory override reason enforced.")

    # Test 15: Clean SQL submission creates handoff, SLA, stage history, and audit
    clean_lead = create_fully_qualified_lead("CLEAN")
    handoff_clean = SQLHandoffService.submit_sql(
        lead=clean_lead,
        user=pld_user,
        assigned_sales_owner=sales_user,
        estimated_value=Decimal('95000.00'),
        currency='USD',
        sla_hours=48
    )
    assert handoff_clean.status == HandoffStatus.PENDING
    assert handoff_clean.estimated_value == Decimal('95000.00')
    assert handoff_clean.sla_duration_hours == 48
    assert handoff_clean.sla_expires_at is not None
    assert clean_lead.current_stage.stage_code == "SQL_READY"
    # Stage history verified
    sh = StageHistory.objects.filter(record_type='LEAD', record_id=clean_lead.id).first()
    assert sh is not None
    # Audit log verified
    audit = AuditLog.objects.filter(entity_type='SQLHandoff', entity_id=handoff_clean.id, action=AuditAction.CREATE).first()
    assert audit is not None
    print("✓ Test 15 Passed: Clean SQL submission creates handoff, starts SLA, records stage history & audit.")

    # Test 16: Duplicate submission prevention
    try:
        SQLHandoffService.submit_sql(lead=clean_lead, user=pld_user)
        assert False, "Expected duplicate active submission error."
    except ValidationError as e:
        assert "already exists for this lead" in str(e)
    print("✓ Test 16 Passed: Duplicate active submission strictly blocked.")

    print("\n--- TEST GROUP 2: SALES ACCEPTANCE LIFECYCLE, REJECTION & SLA ---")

    # Test 17: Pending acceptance & SLA properties
    assert handoff_clean.status == HandoffStatus.PENDING
    assert handoff_clean.is_sla_overdue is False
    assert handoff_clean.sla_remaining_hours > 40.0
    print("✓ Test 17 Passed: Pending acceptance and SLA health metrics verified.")

    # Test 18: Accept SQL handoff
    accept_res = SQLHandoffService.accept_sql(handoff=handoff_clean, user=sales_user, new_sales_owner=sales_user)
    assert accept_res["handoff"].status == HandoffStatus.ACCEPTED
    assert accept_res["handoff"].decision_date is not None
    assert accept_res["opportunity"] is not None
    opp18 = accept_res["opportunity"]
    print("✓ Test 18 Passed: Sales accepts SQL handoff and triggers Opportunity creation.")

    # Test 19: Reject SQL handoff
    lead_reject = create_fully_qualified_lead("REJECT")
    handoff_rej = SQLHandoffService.submit_sql(lead=lead_reject, user=pld_user, assigned_sales_owner=sales_user)
    rej_res = SQLHandoffService.reject_sql(
        handoff=handoff_rej,
        reason="Economic buyer deferred budget allocation to next fiscal year.",
        return_target="NURTURE",
        user=sales_user
    )
    assert rej_res["handoff"].status == HandoffStatus.REJECTED
    assert lead_reject.status == LeadStatus.NURTURE
    assert "deferred budget allocation" in lead_reject.nurture_reason
    print("✓ Test 19 Passed: Sales rejects SQL handoff and routes lead back to Nurture.")

    # Test 20: Reject without reason blocked
    lead_rej_no_reason = create_fully_qualified_lead("REJ_NO_REASON")
    handoff_rej_no_reason = SQLHandoffService.submit_sql(lead=lead_rej_no_reason, user=pld_user, assigned_sales_owner=sales_user)
    try:
        SQLHandoffService.reject_sql(handoff=handoff_rej_no_reason, reason="", user=sales_user)
        assert False, "Expected ValidationError for missing rejection reason."
    except ValidationError as e:
        assert "Rejection reason is mandatory" in str(e)
    print("✓ Test 20 Passed: Reject without reason strictly blocked.")

    # Test 21: Rejection reason saved and auditable
    assert handoff_rej.rejection_reason == "Economic buyer deferred budget allocation to next fiscal year."
    sh_rej = StageHistory.objects.filter(record_type='LEAD', record_id=lead_reject.id).first()
    assert "Economic buyer deferred budget" in sh_rej.transition_reason
    print("✓ Test 21 Passed: Rejection reason auditable in handoff record and stage history.")

    # Test 22: SLA overdue detection
    lead_overdue = create_fully_qualified_lead("OVERDUE")
    handoff_overdue = SQLHandoffService.submit_sql(lead=lead_overdue, user=pld_user, assigned_sales_owner=sales_user)
    # Simulate overdue by setting past expiration
    handoff_overdue.sla_expires_at = timezone.now() - timedelta(hours=5)
    handoff_overdue.save(update_fields=['sla_expires_at'])
    assert handoff_overdue.is_sla_overdue is True
    assert handoff_overdue.sla_remaining_hours <= 0.0
    print("✓ Test 22 Passed: SLA overdue status accurately detected.")

    # Test 23: Ownership transfer
    assert handoff_clean.previous_owner == pld_user
    assert handoff_clean.assigned_sales_owner == sales_user
    assert clean_lead.owner == sales_user
    assert handoff_clean.ownership_transferred_at is not None
    print("✓ Test 23 Passed: Ownership transferred from PLD rep to Sales owner.")

    # Test 24: Sales Acceptance Audit
    accept_audit = AuditLog.objects.filter(entity_type='SQLHandoff', entity_id=handoff_clean.id, action=AuditAction.SALES_ACCEPT).first()
    assert accept_audit is not None
    assert accept_audit.changes_json["previous_owner"] == pld_user.username
    assert accept_audit.changes_json["new_owner"] == sales_user.username
    print("✓ Test 24 Passed: Ownership transfer and acceptance logged in Universal Audit.")

    print("\n--- TEST GROUP 3: OPPORTUNITY CREATION & LIFECYCLE ---")

    # Test 25: Create Opportunity from accepted SQL carries forward full context
    assert opp18.account == clean_lead.account
    assert opp18.primary_contact == clean_lead.contact
    assert opp18.product == product
    assert opp18.total_contract_value == Decimal('95000.00')
    assert opp18.arr == Decimal('95000.00')
    assert opp18.mrr == round(Decimal('95000.00') / Decimal('12'), 2)
    assert opp18.decision_maker is not None
    assert opp18.pld_score is not None
    assert opp18.sql_date == timezone.now().date()
    assert opp18.next_action_description is not None
    print("✓ Test 25 Passed: Opportunity successfully created from accepted SQL with carry-forward data.")

    # Test 26: Cannot create Opportunity from rejected SQL
    try:
        OpportunityService.create_from_accepted_sql(handoff=handoff_rej, user=sales_user)
        assert False, "Expected error when creating opportunity from rejected SQL."
    except ValidationError as e:
        assert "must have status 'ACCEPTED'" in str(e)
    print("✓ Test 26 Passed: Opportunity creation from rejected SQL strictly blocked.")

    # Test 27: Cannot create duplicate Opportunity from same accepted SQL
    try:
        OpportunityService.create_from_accepted_sql(handoff=handoff_clean, user=sales_user)
        assert False, "Expected error for duplicate opportunity creation."
    except ValidationError as e:
        assert "already been created for this SQL Handoff" in str(e)
    print("✓ Test 27 Passed: Duplicate Opportunity creation strictly blocked.")

    # Test 28: Opportunity types
    assert opp18.opportunity_type == OpportunityType.NEW
    opp18.opportunity_type = OpportunityType.EXPANSION
    opp18.save()
    assert opp18.opportunity_type == OpportunityType.EXPANSION
    opp18.opportunity_type = OpportunityType.RENEWAL
    opp18.save()
    assert opp18.opportunity_type == OpportunityType.RENEWAL
    opp18.opportunity_type = OpportunityType.NEW
    opp18.save()
    print("✓ Test 28 Passed: Supported Opportunity types (NEW, EXPANSION, RENEWAL) verified.")

    # Test 29: Commercial fields validation (value, terms, seats, ARR, MRR)
    try:
        OpportunityService.update_commercial_fields(opp18, {'total_contract_value': Decimal('-5000.00')})
        assert False, "Expected error for negative contract value."
    except ValidationError as e:
        assert "cannot be negative" in str(e)

    OpportunityService.update_commercial_fields(
        opp18,
        {
            'total_contract_value': Decimal('120000.00'),
            'arr': Decimal('120000.00'),
            'mrr': Decimal('10000.00'),
            'pricing_plan': 'VanForces Enterprise Tier',
            'seat_units_count': 45,
            'contract_term_months': 12,
            'probability_pct': 70
        },
        user=sales_user
    )
    opp18.refresh_from_db()
    assert opp18.total_contract_value == Decimal('120000.00')
    assert opp18.arr == Decimal('120000.00')
    assert opp18.mrr == Decimal('10000.00')
    assert opp18.seat_units_count == 45
    assert opp18.probability_pct == 70
    print("✓ Test 29 Passed: Commercial fields validation & updates verified.")

    # Test 30: Product / Module relationships
    assert opp18.product_lines.filter(product=product).exists()
    assert opp18.selected_modules.filter(module=module).exists()
    assert opp18.required_capabilities.filter(capability=capability).exists()
    print("✓ Test 30 Passed: Opportunity -> Product -> Module relationship populated and verified.")

    # Test 31: Forward stage transition
    opp_stage2 = stage_opp2
    OpportunityService.transition_stage(opp18, target_stage=opp_stage2, reason="Client scheduled formal proposal presentation", user=sales_user)
    opp18.refresh_from_db()
    assert opp18.stage == opp_stage2
    print("✓ Test 31 Passed: Forward stage transition recorded.")

    # Test 32: Backward stage transition requires mandatory reason
    try:
        OpportunityService.transition_stage(opp18, target_stage=stage_opp1, reason="", user=sales_user)
        assert False, "Expected error for backward stage transition without reason."
    except ValidationError as e:
        assert "Reason is mandatory when moving an opportunity backward" in str(e)

    OpportunityService.transition_stage(opp18, target_stage=stage_opp1, reason="Client requested additional scoping discovery", user=sales_user)
    opp18.refresh_from_db()
    assert opp18.stage == stage_opp1
    print("✓ Test 32 Passed: Backward stage movement requires and enforces mandatory reason.")

    # Test 33: Stage history tracking
    histories = StageHistory.objects.filter(record_type='OPPORTUNITY', record_id=opp18.id)
    assert histories.count() >= 2
    assert histories.filter(is_override=True).exists()
    print("✓ Test 33 Passed: Opportunity stage transitions tracked in StageHistory.")

    # Test 34: Activities on Opportunity
    act = Activity.objects.create(
        opportunity=opp18,
        account=opp18.account,
        contact=opp18.primary_contact,
        activity_type=ActivityType.MEETING,
        subject="Executive Review of Implementation Scope",
        outcome_notes="Client confirmed 45 fleet vehicles in Phase 1 deployment.",
        next_action_description="Send revised commercial schedule",
        next_action_due_at=timezone.now() + timedelta(days=2),
        performed_by=sales_user,
        tenant=tenant
    )
    assert opp18.activities.filter(id=act.id).exists()
    print("✓ Test 34 Passed: Activity logged on Opportunity with mandatory next action.")

    # Test 35: Next action on Opportunity
    assert opp18.next_action_description is not None
    assert opp18.next_activity_due_at is not None
    print("✓ Test 35 Passed: Next action and due date tracked on Opportunity.")

    # Test 36: Audit on Opportunity commercial updates
    opp_audits = AuditLog.objects.filter(entity_type='Opportunity', entity_id=opp18.id)
    assert opp_audits.count() >= 2
    update_audit = next((a for a in opp_audits if "total_contract_value" in a.changes_json), None)
    assert update_audit is not None
    assert "total_contract_value" in update_audit.changes_json
    print("✓ Test 36 Passed: Opportunity commercial updates auditable (WHO, WHAT, WHEN, OLD/NEW).")

    # Test 37: Permissions & RBAC
    assert SQLHandoffService.check_override_permission(vp_sales) is True
    assert SQLHandoffService.check_override_permission(pld_user) is False
    print("✓ Test 37 Passed: Backend RBAC permissions strictly enforced for SQL overrides.")

    # Test 38: Dashboard data aggregation
    sql_ready_count = SQLHandoff.objects.filter(status=HandoffStatus.PENDING).count()
    accepted_sql_count = SQLHandoff.objects.filter(status=HandoffStatus.ACCEPTED).count()
    open_opps_count = Opportunity.objects.filter(status=OpportunityStatus.OPEN).count()
    total_pipeline_val = sum(o.total_contract_value for o in Opportunity.objects.filter(status=OpportunityStatus.OPEN))
    assert sql_ready_count >= 1
    assert accepted_sql_count >= 1
    assert open_opps_count >= 1
    assert total_pipeline_val > 0
    print(f"✓ Test 38 Passed: Live dashboard data available: Pending SQLs={sql_ready_count}, Accepted={accepted_sql_count}, Open Opps={open_opps_count}, Total Pipeline=${total_pipeline_val}.")

    print("\n--- TEST GROUP 4: SECTION 34 END-TO-END FLOW ---")
    print("Executing full journey: Lead -> ICP -> PLD -> Problem -> Discovery -> Product Mapping -> Demo/POC -> SQL Readiness -> Sales Acceptance -> Opportunity")

    # E2E Lead
    e2e_lead = create_fully_qualified_lead("E2E")
    # Verify Readiness
    e2e_ready = SQLReadinessValidator.validate_readiness(e2e_lead)
    assert e2e_ready["is_ready"] is True

    # PLD Submits SQL
    e2e_handoff = SQLHandoffService.submit_sql(
        lead=e2e_lead,
        user=pld_user,
        assigned_sales_owner=sales_user,
        estimated_value=Decimal('150000.00'),
        currency='USD',
        sla_hours=48
    )
    assert e2e_handoff.status == HandoffStatus.PENDING
    assert e2e_lead.current_stage.stage_code == "SQL_READY"

    # Sales Accepts SQL
    e2e_accept = SQLHandoffService.accept_sql(
        handoff=e2e_handoff,
        user=sales_user,
        new_sales_owner=sales_user
    )
    e2e_opp = e2e_accept["opportunity"]
    assert e2e_opp is not None
    assert e2e_opp.account == e2e_lead.account
    assert e2e_opp.primary_contact == e2e_lead.contact
    assert e2e_opp.owner == sales_user
    assert e2e_opp.total_contract_value == Decimal('150000.00')
    assert e2e_opp.product == product
    assert e2e_opp.selected_modules.filter(module=module).exists()
    assert e2e_lead.status == LeadStatus.CONVERTED

    print("✓ Section 34 End-to-End Test Passed: Complete commercial handoff executed flawlessly.")
    print("=" * 80)
    print("ALL 38 PHASE 7 TESTS + SECTION 34 END-TO-END TEST PASSED SUCCESSFULLY!")
    print("=" * 80)


if __name__ == '__main__':
    run_phase7_tests()
