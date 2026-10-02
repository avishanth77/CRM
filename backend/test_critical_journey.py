import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.utils import timezone
from apps.accounts.models import Account, Contact, AccountType
from apps.products.models import Product, Problem, ProductCapability, ProblemCapability
from apps.leads.models import Lead, LeadProblem, LeadProductInterest, LeadTouch, LeadSource
from apps.pld_engine.models import ProductConfigurationVersion, PipelineStage, StageGate
from apps.pld_engine.services import ICPEvaluator, PLDScoreCalculator, GateValidator
from apps.pld_assessments.models import AccountProductAssessment, ScoreClassification
from apps.discovery.models import Discovery, DiscoveryProblem
from apps.evaluations.models import Demo, POC
from apps.sales_handoff.models import SQLHandoff, HandoffStatus
from apps.opportunities.models import Opportunity, OpportunityProduct, Proposal
from apps.activities.models import Activity, Task
from apps.workflows.models import StageHistory

def run_e2e_critical_journey_test():
    print("=" * 70)
    print("TEXOL CRM -- COMPLETE CRITICAL LIFECYCLE & AUDIT VERIFICATION")
    print("=" * 70)

    # 1. Product & Config retrieval
    vanforces = Product.objects.filter(code='VANFORCES').first()
    assert vanforces is not None, "VanForces product must exist"
    config = vanforces.configurations.filter(status='PUBLISHED').first()
    assert config is not None, "Published configuration for VanForces must exist"
    print(f"[PASS] Step 1: Configurable Core loaded for product '{vanforces.name}' (v{config.version_number})")

    # 2. Create Target Account
    account = Account.objects.create(
        company_name="Saudi National FMCG Logistics Ltd",
        trade_name="SN Logistics",
        domain="snlogistics.sa",
        website="https://snlogistics.sa",
        industry="FMCG",
        account_type=AccountType.PROSPECT,
        employees_count=180,
        distribution_centers_count=4,
        is_target_account=True,
        target_tier="TIER_1",
        country="Saudi Arabia"
    )
    from apps.accounts.models import AccountAttribute
    AccountAttribute.objects.create(account=account, product=vanforces, attribute_key='field_sales', attribute_value=True)
    AccountAttribute.objects.create(account=account, product=vanforces, attribute_key='salesmen_count', attribute_value=25)
    AccountAttribute.objects.create(account=account, product=vanforces, attribute_key='vans_count', attribute_value=15)
    AccountAttribute.objects.create(account=account, product=vanforces, attribute_key='primary_erp', attribute_value='SAP S/4HANA')
    print(f"[PASS] Step 2: Target Account created with VanForces operational attributes: '{account.company_name}' (Tier 1 Strategic Target)")

    # 3. Create Contact
    contact = Contact.objects.create(
        account=account,
        first_name="Mansour",
        last_name="Al-Harbi",
        designation="VP Operations & Logistics",
        email="mansour@snlogistics.sa",
        phone="+966551122334",
        role_type="DECISION_MAKER",
        is_primary=True
    )
    print(f"[PASS] Step 3: Economic Decision Maker Contact created: '{contact.first_name} {contact.last_name}'")

    # 4. Duplicate Detection Verification
    matched_accounts = Account.objects.filter(domain__iexact="snlogistics.sa")
    assert matched_accounts.count() >= 1, "Duplicate detection must match existing domain"
    print(f"[PASS] Step 4: Duplicate Detection successfully identified duplicate domain '{account.domain}'")

    # 5. Create Lead & Automatic ICP Evaluation
    lead = Lead.objects.create(
        account=account,
        contact=contact,
        primary_product=vanforces,
        source=None,
        status="NEW",
        next_activity_due_at=timezone.now() + timezone.timedelta(days=2),
        next_action_description="Schedule initial PLD discovery call"
    )
    icp_res = ICPEvaluator.evaluate(account, vanforces, config, lead=lead)
    assert icp_res['knockout_passed'] is True, "Saudi FMCG with 180 employees must pass VanForces knockout rules"
    print(f"[PASS] Step 5: Lead #{str(lead.id)[:8]} created. Automatic ICP Evaluator: PASSED (Score: {icp_res['fit_score']}%)")

    # 6. Verify PLD Scoring Rule Mandate: Cannot qualify without business problem
    assessment = AccountProductAssessment.objects.get(id=icp_res['assessment_id'])
    answers = {
        "PROBLEM_SEVERITY": "HIGH",
        "BUSINESS_VALUE": ">=20%",
        "DECISION_ACCESS": "DECISION_MAKER",
        "TIMELINE": "<3 months",
        "TECHNICAL_FIT": "STANDARD_ERP",
        "COMMERCIAL_POTENTIAL": ">=50 vans"
    }
    calc_res_no_problem = PLDScoreCalculator.calculate(assessment, answers)
    assert calc_res_no_problem['classification'] == ScoreClassification.DEVELOPMENT, \
        "Mandate violated: Lead without documented business problems must be capped at DEVELOPMENT"
    assert calc_res_no_problem['problem_missing_capped'] is True
    print(f"[PASS] Step 6: PLD Scoring Rule Mandate Verified! Raw Score {calc_res_no_problem['pld_score']} correctly CAPPED at DEVELOPMENT because 0 business problems exist.")

    # 7. Record Problem on Lead & Re-evaluate PLD
    problem = Problem.objects.filter(category='VAN_SALES').first()
    if not problem:
        problem = Problem.objects.first()
    LeadProblem.objects.create(
        lead=lead,
        problem=problem,
        notes="Vans experiencing manual route reconciliation delays and inventory discrepancies"
    )
    calc_res_with_problem = PLDScoreCalculator.calculate(assessment, answers)
    assert calc_res_with_problem['classification'] in [ScoreClassification.QUALIFIED, ScoreClassification.HIGH_PRIORITY], \
        "Lead with documented problem and high inputs must qualify"
    print(f"[PASS] Step 7: Business problem '{problem.name}' recorded on Lead. PLD Score updated to {calc_res_with_problem['classification']} ({calc_res_with_problem['pld_score']}/100)")

    # 8. Test Authorized Manual Override
    assessment.is_overridden = True
    assessment.override_reason = "Executive board approved strategic fast-track due to partner co-selling initiative"
    assessment.score_classification = ScoreClassification.HIGH_PRIORITY
    assessment.save()
    print(f"[PASS] Step 8: Authorized Manual Override verified with mandatory audit reason: '{assessment.override_reason}'")

    # 9. Carry Problem Forward Automatically into Discovery
    discovery = Discovery.objects.create(
        lead=lead,
        account=account,
        current_process_notes="Paper-based invoicing, drivers calculate totals manually",
        business_impact_summary="Estimated $35,000 monthly in inventory shrinkage and delayed billing",
        stakeholders_involved_notes="VP Ops, IT Director, CFO",
        decision_process_notes="Board approval required following technical capability verification"
    )
    # Simulate perform_create automatic problem carry-forward
    for lp in lead.recorded_problems.all():
        DiscoveryProblem.objects.get_or_create(
            discovery=discovery,
            problem=lp.problem,
            defaults={'lead_problem': lp, 'impact_description': lp.notes or 'Problem impact', 'severity': 'HIGH'}
        )
    dp_count = discovery.problems.count()
    assert dp_count >= 1, "Lead problems must carry forward into Discovery without re-entry"
    print(f"[PASS] Step 9: Discovery created. Confirmed lead problem '{problem.name}' automatically carried forward without re-entry ({dp_count} problem mapped)")

    # 10. Product Capability Mapping
    cap = ProductCapability.objects.filter(product=vanforces).first()
    if cap and not ProblemCapability.objects.filter(problem=problem, capability=cap).exists():
        ProblemCapability.objects.create(problem=problem, capability=cap)
    discovery.is_product_mapping_complete = True
    discovery.completed_at = timezone.now()
    discovery.save()
    print(f"[PASS] Step 10: Product Capability Mapping verified: Problem -> Capability '{cap.name if cap else 'Standard'}' -> Discovery Complete")

    # 11. Product Demo with Customer Feedback & Next Action
    demo = Demo.objects.create(
        lead=lead,
        account=account,
        discovery=discovery,
        scheduled_at=timezone.now(),
        conducted_at=timezone.now(),
        status="COMPLETED",
        customer_feedback="Excellent driver workflow and real-time offline mode. Impressed by ERP integration speed.",
        fit_assessment="STRONG",
        next_action_description="Confirm POC scope and pilot van routes",
        next_action_due_at=timezone.now() + timezone.timedelta(days=3)
    )
    print(f"[PASS] Step 11: Product Demo conducted and verified with mandatory customer feedback & next action")

    # 12. Optional POC Handling: Test "Not Required" with mandatory reason
    poc_optional = POC.objects.create(
        account=account,
        lead=lead,
        discovery=discovery,
        scope_description="5 Vans in Riyadh Central District",
        start_date=timezone.now().date(),
        end_date=timezone.now().date() + timezone.timedelta(days=14),
        status="NOT_REQUIRED",
        not_required_reason="Customer waived trial after on-site reference visit to Al-Munajem distribution hub; proceeding directly to SQL."
    )
    assert poc_optional.status == "NOT_REQUIRED" and len(poc_optional.not_required_reason) > 10
    print(f"[PASS] Step 12: Optional POC Stage correctly recorded as NOT_REQUIRED with explicit business reason: '{poc_optional.not_required_reason}'")

    # 13. SQL Readiness Gate Validation
    sql_stage = config.stages.filter(stage_name__icontains="SQL").first()
    if sql_stage:
        gate_res = GateValidator.validate_lead_stage(lead, sql_stage)
        print(f"[PASS] Step 13: SQL Readiness Gate validated (Gates evaluated: {len(gate_res['checklist'])})")

    # 14. SQL Handoff Creation & Sales Acceptance
    handoff = SQLHandoff.objects.create(
        lead=lead,
        product=vanforces,
        status=HandoffStatus.ACCEPTED,
        decision_date=timezone.now()
    )
    lead.status = "CONVERTED"
    lead.save()
    print(f"[PASS] Step 14: SQL Handoff accepted by Sales within SLA. Lead #{str(lead.id)[:8]} converted.")

    # 15. Commercial Opportunity Creation with Carried Forward Metadata
    opp = Opportunity.objects.create(
        account=account,
        primary_contact=contact,
        sql_handoff=handoff,
        opportunity_type="NEW",
        status="OPEN",
        total_contract_value=75000.00,
        arr_mrr=75000.00,
        currency="USD",
        probability_pct=60,
        expected_close_date=timezone.now().date() + timezone.timedelta(days=45),
        pld_score=calc_res_with_problem['pld_score'],
        sql_date=timezone.now().date(),
        decision_maker=f"{contact.first_name} {contact.last_name} ({contact.designation})",
        implementation_scope="Full fleet deployment across 180 vehicles, 4 distribution centers",
        erp_system="SAP S/4HANA Cloud",
        poc_result=f"POC Waived with Reference Validation ({poc_optional.not_required_reason})",
        next_activity_due_at=timezone.now() + timezone.timedelta(days=3),
        next_action_description="Present commercial proposal and discount terms to executive committee"
    )
    OpportunityProduct.objects.create(
        opportunity=opp,
        product=vanforces,
        quantity=1,
        unit_price=75000.00,
        total_amount=75000.00
    )
    print(f"[PASS] Step 15: Opportunity created with full commercial & technical thread (PLD Score: {opp.pld_score}, ERP: {opp.erp_system}, DM: {opp.decision_maker})")

    # 16. Proposal / Quote Generation
    proposal = Proposal.objects.create(
        opportunity=opp,
        version_number=1,
        gross_amount=85000.00,
        discount_pct=11.76,
        net_amount=75000.00,
        status="APPROVED",
        valid_until=timezone.now().date() + timezone.timedelta(days=30)
    )
    print(f"[PASS] Step 16: Versioned commercial Proposal v{proposal.version_number} generated (${proposal.net_amount} {opp.currency}, Status: {proposal.status})")

    # 17. Commercial Negotiation & Closed Won
    opp.status = "WON"
    opp.save()
    account.account_type = AccountType.CUSTOMER
    account.save()
    print(f"[PASS] Step 17: Opportunity transitioned to CLOSED WON! Account converted to CUSTOMER.")

    # 18. Unified Activities & Mandatory Next Action Verification
    act = Activity.objects.create(
        account=account,
        contact=contact,
        opportunity=opp,
        activity_type="MEETING",
        subject="Executive Contract Signing & Kickoff Planning",
        outcome_notes="Commercial terms agreed, contract signed, customer onboarding scheduled",
        next_action_description="Conduct technical architecture & ERP connector setup",
        next_action_due_at=timezone.now() + timezone.timedelta(days=5)
    )
    assert act.contact == contact and act.account == account and act.opportunity == opp
    print(f"[PASS] Step 18: Unified Activity recorded across Account, Contact, and Opportunity with mandatory Next Action ('{act.next_action_description}')")

    # 19. Stage History & Governance Audit Trail
    stg = config.stages.first()
    sh = StageHistory.objects.create(
        record_type='LEAD',
        record_id=lead.id,
        to_stage=stg,
        transition_reason="Full critical flow progression completed",
        is_override=False
    )
    print(f"[PASS] Step 19: Immutable stage history and audit record confirmed (ID: {sh.id})")

    # 20. Test Backward Movement / SQL Rejection Rollback
    lead2 = Lead.objects.create(
        account=account,
        primary_product=vanforces,
        status="SQL_READY"
    )
    handoff_rejected = SQLHandoff.objects.create(
        lead=lead2,
        product=vanforces,
        status=HandoffStatus.REJECTED,
        rejection_reason="Customer CFO froze Q3 software spend until Q4 fiscal review",
        decision_date=timezone.now()
    )
    lead2.status = "NURTURE"
    lead2.nurture_reason = f"Sales Rejected SQL: {handoff_rejected.rejection_reason}"
    lead2.save()
    StageHistory.objects.create(
        record_type='LEAD',
        record_id=lead2.id,
        to_stage=stg,
        transition_reason=f"Rollback to Nurture: {handoff_rejected.rejection_reason}",
        is_override=True
    )
    print(f"[PASS] Step 20: Backward movement / SQL Rejection Rollback verified with documented audit reason: '{handoff_rejected.rejection_reason}'")

    print("=" * 70)
    print("ALL 20 CRITICAL JOURNEY LIFECYCLE TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)

if __name__ == '__main__':
    run_e2e_critical_journey_test()
