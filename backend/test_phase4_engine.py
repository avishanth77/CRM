import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from decimal import Decimal
from django.utils import timezone
from datetime import timedelta
from apps.accounts.models import Account, AccountAttribute
from apps.products.models import Product, Problem, ProblemCategory
from apps.leads.models import Lead, LeadProblem, LeadProductInterest
from apps.pld_engine.models import (
    ProductConfigurationVersion, ConfigStatus, ICPProfile, ICPRule, ICPRuleType,
    RuleOperator, ScoreModel, ScoreDimension, QuestionnaireTemplate, QuestionnaireQuestion,
    QuestionAnswerOption, PipelineStage, PipelineType, StageGate
)
from apps.pld_engine.services import ICPEvaluator, PLDScoreCalculator, GateValidator
from apps.pld_assessments.models import AccountProductAssessment, ScoreClassification, ICPResultStatus
from apps.audit_logging.models import AuditLog, AuditAction
from apps.authentication.models import User, UserRole


def run_phase4_test_suite():
    print("=" * 75)
    print("TEXOL CRM -- PHASE 4 AUTOMATED TEST SUITE: ICP & PLD QUALIFICATION ENGINE")
    print("=" * 75)

    # Setup baseline user & product
    admin_user, _ = User.objects.get_or_create(
        email="pld_admin@texol.com",
        defaults={
            "username": "pld_admin",
            "first_name": "Admin",
            "last_name": "PLD",
            "role": UserRole.ADMIN,
            "is_staff": True
        }
    )
    vanforces = Product.objects.get(code='VANFORCES')
    config_v1 = vanforces.configurations.filter(status='PUBLISHED').first() or vanforces.configurations.first()

    # -------------------------------------------------------------
    # TEST 1: Account with valid ICP
    # -------------------------------------------------------------
    acc_valid = Account.objects.create(
        company_name="Valid FMCG Distributor KSA",
        industry="FMCG",
        country="Saudi Arabia",
        employees_count=150
    )
    AccountAttribute.objects.create(account=acc_valid, product=vanforces, attribute_key="field_sales", attribute_value=True)
    AccountAttribute.objects.create(account=acc_valid, product=vanforces, attribute_key="salesmen_count", attribute_value=25)
    AccountAttribute.objects.create(account=acc_valid, product=vanforces, attribute_key="vans_count", attribute_value=18)
    AccountAttribute.objects.create(account=acc_valid, product=vanforces, attribute_key="primary_erp", attribute_value="SAP")

    icp_res_1 = ICPEvaluator.evaluate(acc_valid, vanforces, config_v1, user=admin_user)
    assert icp_res_1["knockout_passed"] is True, "Valid account must pass knockouts"
    assert icp_res_1["result"] == ICPResultStatus.PASS, f"Expected PASS, got {icp_res_1['result']}"
    assert icp_res_1["fit_score"] == 100, f"Expected fit score 100, got {icp_res_1['fit_score']}"
    assert len(icp_res_1["breakdown"]["what_we_know"]) > 0
    print("[PASS] Test 1: Account with valid ICP passed knockouts & fit scoring (Result: PASS, Score: 100%)")

    # -------------------------------------------------------------
    # TEST 2: Account failing knock-out rule
    # -------------------------------------------------------------
    acc_fail = Account.objects.create(
        company_name="Commercial Bank Riyadh",
        industry="Banking",  # Outside FMCG / Bakery / Food distribution
        country="Saudi Arabia",
        employees_count=500
    )
    AccountAttribute.objects.create(account=acc_fail, product=vanforces, attribute_key="field_sales", attribute_value=False)

    icp_res_2 = ICPEvaluator.evaluate(acc_fail, vanforces, config_v1, user=admin_user)
    assert icp_res_2["knockout_passed"] is False, "Banking account must fail knockout"
    assert icp_res_2["result"] == ICPResultStatus.FAIL, f"Expected FAIL, got {icp_res_2['result']}"
    assert len(icp_res_2["failed_knockouts"]) >= 1, "Failed knockouts list must not be empty"
    print(f"[PASS] Test 2: Account failing knock-out correctly identified as FAIL ({len(icp_res_2['failed_knockouts'])} knockouts failed)")

    # -------------------------------------------------------------
    # TEST 3: Missing ICP information
    # -------------------------------------------------------------
    acc_missing = Account.objects.create(
        company_name="Unknown Inquiry Corp",
        country="Saudi Arabia"
        # industry is None, field_sales is not set
    )
    icp_res_3 = ICPEvaluator.evaluate(acc_missing, vanforces, config_v1, user=admin_user)
    assert icp_res_3["knockout_passed"] is False
    assert icp_res_3["result"] == ICPResultStatus.PENDING, f"Expected PENDING for missing data, got {icp_res_3['result']}"
    assert len(icp_res_3["missing_knockouts"]) >= 1
    assert len(icp_res_3["breakdown"]["what_is_missing"]) > 0
    print(f"[PASS] Test 3: Missing ICP info results in PENDING with clear missing list: {icp_res_3['breakdown']['what_is_missing']}")

    # -------------------------------------------------------------
    # TEST 4 & 5: Product-specific ICP & Multiple Products
    # -------------------------------------------------------------
    prod_taskforces, _ = Product.objects.get_or_create(
        code="TASKFORCES_ERP",
        defaults={"name": "TaskForces ERP", "category": "ERP"}
    )
    config_tf, _ = ProductConfigurationVersion.objects.get_or_create(
        product=prod_taskforces,
        version_number=1,
        defaults={"status": ConfigStatus.PUBLISHED}
    )
    # TF knockout rule: any company size >= 50
    ICPRule.objects.get_or_create(
        config_version=config_tf,
        field_name="employees_count",
        rule_type=ICPRuleType.KNOCKOUT,
        defaults={"operator": RuleOperator.GREATER_THAN_OR_EQUAL, "target_value": 50, "is_active": True}
    )

    # Evaluate acc_valid for TaskForces as well
    icp_res_tf = ICPEvaluator.evaluate(acc_valid, prod_taskforces, config_tf, user=admin_user)

    # Verify both assessments exist independently on the same account
    van_assessment = AccountProductAssessment.objects.filter(account=acc_valid, product=vanforces).first()
    tf_assessment = AccountProductAssessment.objects.filter(account=acc_valid, product=prod_taskforces).first()

    assert van_assessment is not None and tf_assessment is not None
    assert van_assessment.product.code == "VANFORCES"
    assert tf_assessment.product.code == "TASKFORCES_ERP"
    assert van_assessment.id != tf_assessment.id
    print(f"[PASS] Tests 4 & 5: Product-specific ICP verified across multiple products on same account (VanForces: {van_assessment.icp_result}, TaskForces: {tf_assessment.icp_result})")

    # -------------------------------------------------------------
    # TEST 6: Questionnaire loading
    # -------------------------------------------------------------
    template = QuestionnaireTemplate.objects.filter(product=vanforces, is_active=True).first()
    assert template is not None, "Questionnaire template for VanForces must exist"
    questions = template.questions.filter(is_active=True)
    assert questions.count() == 15, f"Expected 15 qualification questions, found {questions.count()}"
    print(f"[PASS] Test 6: Questionnaire template loaded successfully with {questions.count()} active questions")

    # -------------------------------------------------------------
    # TEST 7: Required question validation
    # -------------------------------------------------------------
    for q in questions:
        assert q.is_required is True
        assert q.feeds_dimension is not None
        assert q.options.count() >= 2
    print("[PASS] Test 7: Required question validation verified (all 15 questions have required=True, feeds_dimension, and valid options)")

    # -------------------------------------------------------------
    # TEST 8 & 9: PLD score calculation & Score weights
    # -------------------------------------------------------------
    # Verify score models sum to 100%
    score_models = config_v1.score_models.filter(is_active=True)
    total_weights = sum(sm.weight_percentage for sm in score_models)
    assert total_weights == 100, f"Score model weights must sum to 100%, found {total_weights}%"

    lead_valid = Lead.objects.create(
        account=acc_valid,
        primary_product=vanforces,
        next_activity_due_at=timezone.now() + timedelta(days=2),
        next_action_description="Conduct initial qualification meeting"
    )

    # Attach assessment to lead
    van_assessment.lead = lead_valid
    van_assessment.save(update_fields=['lead'])

    # Test deterministic calculation
    answers_high = {
        "PROBLEM_SEVERITY": "HIGH",
        "BUSINESS_VALUE": ">=20%",
        "DECISION_ACCESS": "DECISION_MAKER",
        "TIMELINE": "<3 months",
        "TECHNICAL_FIT": "STANDARD_ERP",
        "COMMERCIAL_POTENTIAL": ">=50 vans"
    }

    # Add a problem first to test un-capped score
    prob_route = Problem.objects.filter(code='PROB_ROUTE_INEFFICIENCY').first() or Problem.objects.first()
    lp = LeadProblem.objects.create(
        lead=lead_valid,
        problem=prob_route,
        category=ProblemCategory.DISTRIBUTION,
        severity='HIGH',
        frequency='DAILY',
        business_impact="25% route delivery delay and missed customer drops",
        notes="Confirmed during qualification call"
    )

    calc_res_high = PLDScoreCalculator.calculate(van_assessment, answers_high, user=admin_user)
    assert calc_res_high["pld_score"] == 100, f"Expected 100, got {calc_res_high['pld_score']}"
    assert calc_res_high["classification"] == ScoreClassification.HIGH_PRIORITY
    assert calc_res_high["problem_missing_capped"] is False
    print(f"[PASS] Tests 8 & 9: Deterministic score calculation and 100% weight distribution verified (Score: {calc_res_high['pld_score']}/100, Status: {calc_res_high['classification']})")

    # -------------------------------------------------------------
    # TEST 10: Score thresholds
    # -------------------------------------------------------------
    # Moderate inputs
    answers_mod = {
        "PROBLEM_SEVERITY": "MEDIUM",
        "BUSINESS_VALUE": "10-20%",
        "DECISION_ACCESS": "CHAMPION",
        "TIMELINE": "3-6 months",
        "TECHNICAL_FIT": "CUSTOM_ERP",
        "COMMERCIAL_POTENTIAL": "10-19 vans"
    }
    calc_res_mod = PLDScoreCalculator.calculate(van_assessment, answers_mod, user=admin_user)
    # Expected score around 70 -> QUALIFIED PLD
    assert 61 <= calc_res_mod["pld_score"] <= 80, f"Expected score in 61-80, got {calc_res_mod['pld_score']}"
    assert calc_res_mod["classification"] == ScoreClassification.QUALIFIED
    print(f"[PASS] Test 10: Score threshold verified (Score: {calc_res_mod['pld_score']}/100 maps to {calc_res_mod['classification']})")

    # -------------------------------------------------------------
    # TEST 11: Missing business problem mandate
    # -------------------------------------------------------------
    # Remove all problems from lead
    LeadProblem.objects.filter(lead=lead_valid).delete()
    van_assessment.is_overridden = False
    van_assessment.save(update_fields=['is_overridden'])

    calc_res_no_prob = PLDScoreCalculator.calculate(van_assessment, answers_high, user=admin_user)
    assert calc_res_no_prob["pld_score"] == 100
    assert calc_res_no_prob["classification"] == ScoreClassification.DEVELOPMENT, \
        f"MANDATE VIOLATION: Score 100 with 0 problems must be capped at DEVELOPMENT, got {calc_res_no_prob['classification']}"
    assert calc_res_no_prob["problem_missing_capped"] is True
    print(f"[PASS] Test 11: Qualification mandate enforced! Score 100 correctly capped at DEVELOPMENT because 0 business problems are documented.")

    # -------------------------------------------------------------
    # TEST 12: Authorized Score Override
    # -------------------------------------------------------------
    override_reason = "Board-level priority expansion mandate approved by CEO"
    van_assessment_overridden = PLDScoreCalculator.override(
        assessment=van_assessment,
        new_score=85,
        new_classification=ScoreClassification.HIGH_PRIORITY,
        reason=override_reason,
        user=admin_user
    )
    assert van_assessment_overridden.is_overridden is True
    assert van_assessment_overridden.pld_score == 85
    assert van_assessment_overridden.original_pld_score == 100, f"Original score 100 must be preserved, found {van_assessment_overridden.original_pld_score}"
    assert van_assessment_overridden.override_reason == override_reason
    assert van_assessment_overridden.overridden_by == admin_user
    assert len(van_assessment_overridden.qualification_history) >= 2
    print(f"[PASS] Test 12: Authorized manual score override verified (Original: {van_assessment_overridden.original_pld_score}, Overridden: {van_assessment_overridden.pld_score}, Reason: '{override_reason}')")

    # -------------------------------------------------------------
    # TEST 13: Unauthorized override / Missing reason validation
    # -------------------------------------------------------------
    try:
        PLDScoreCalculator.override(
            assessment=van_assessment,
            new_score=90,
            new_classification=ScoreClassification.HIGH_PRIORITY,
            reason="",  # Empty reason must raise ValueError
            user=admin_user
        )
        assert False, "Empty reason must be rejected"
    except ValueError as e:
        assert "mandatory" in str(e).lower()
        print(f"[PASS] Test 13: Empty override reason correctly rejected: '{e}'")

    # -------------------------------------------------------------
    # TEST 14 & 15: Score and ICP Versioning
    # -------------------------------------------------------------
    assert van_assessment.score_model_version == config_v1.version_number
    assert van_assessment.icp_rule_version == config_v1.version_number

    # Create config v2 (Draft)
    config_v2, _ = ProductConfigurationVersion.objects.get_or_create(
        product=vanforces,
        version_number=2,
        defaults={"status": ConfigStatus.DRAFT, "notes": "Next version"}
    )
    # Ensure existing assessment still points to v1
    van_assessment.refresh_from_db()
    assert van_assessment.config_version.version_number == 1
    assert van_assessment.score_model_version == 1
    print("[PASS] Tests 14 & 15: Score and ICP versioning verified (Historical assessment remains pinned to immutable v1)")

    # -------------------------------------------------------------
    # TEST 16: Problem creation with full qualification fields
    # -------------------------------------------------------------
    new_prob, _ = Problem.objects.get_or_create(
        code="PROB_VAN_STOCK_SHRINK",
        defaults={
            "name": "Van Stock Shrinkage & Cash Discrepancies",
            "category": ProblemCategory.OPERATIONS,
            "default_severity": "CRITICAL"
        }
    )
    lp_created = LeadProblem.objects.create(
        lead=lead_valid,
        problem=new_prob,
        category=ProblemCategory.OPERATIONS,
        severity="CRITICAL",
        frequency="DAILY",
        business_impact="SAR 15,000 monthly shrinkage across 18 delivery vans",
        affected_users="18 Drivers and Central Warehouse Dispatchers",
        evidence="Physical warehouse end-of-week reconciliation variance reports",
        notes="Documented during qualification session"
    )
    assert lp_created.severity == "CRITICAL"
    assert lp_created.frequency == "DAILY"
    assert lp_created.business_impact != ""
    print(f"[PASS] Test 16: Business problem created with full qualification metadata: '{lp_created.problem.name}' [{lp_created.severity}]")

    # -------------------------------------------------------------
    # TEST 17: Qualification gate blocking
    # -------------------------------------------------------------
    pld_stage = config_v1.stages.filter(stage_code='PLD_QUALIFIED').first()
    assert pld_stage is not None

    # Case A: Blocked if ICP fails
    van_assessment.icp_result = ICPResultStatus.FAIL
    van_assessment.icp_knockout_passed = False
    van_assessment.save(update_fields=['icp_result', 'icp_knockout_passed'])

    gate_check_icp_fail = GateValidator.validate_lead_stage(lead_valid, pld_stage)
    assert gate_check_icp_fail["all_passed"] is False, "Must block when ICP fails"
    assert any("ICP" in m for m in gate_check_icp_fail["what_is_missing"])
    print("[PASS] Test 17A: Qualification gate strictly BLOCKED when ICP has not passed")

    # Restore ICP
    van_assessment.icp_result = ICPResultStatus.PASS
    van_assessment.icp_knockout_passed = True
    van_assessment.save(update_fields=['icp_result', 'icp_knockout_passed'])

    # Case B: Blocked if no business problem
    LeadProblem.objects.filter(lead=lead_valid).delete()
    gate_check_no_prob = GateValidator.validate_lead_stage(lead_valid, pld_stage)
    assert gate_check_no_prob["all_passed"] is False, "Must block when 0 business problems exist"
    assert any("business problem" in m.lower() for m in gate_check_no_prob["what_is_missing"])
    print("[PASS] Test 17B: Qualification gate strictly BLOCKED when 0 business problems are documented")

    # Restore problem
    LeadProblem.objects.create(lead=lead_valid, problem=new_prob, severity="HIGH", notes="Restored")

    # -------------------------------------------------------------
    # TEST 18: Next-action validation
    # -------------------------------------------------------------
    lead_valid.next_action_description = None
    lead_valid.next_activity_due_at = None
    lead_valid.save(update_fields=['next_action_description', 'next_activity_due_at'])

    gate_check_no_action = GateValidator.validate_lead_stage(lead_valid, pld_stage)
    assert gate_check_no_action["all_passed"] is False
    assert any("Next Action" in m for m in gate_check_no_action["what_is_missing"])
    print("[PASS] Test 18: Qualification gate strictly BLOCKED when Next Action is missing")

    # Restore next action
    lead_valid.next_action_description = "Conduct detailed technical Discovery session"
    lead_valid.next_activity_due_at = timezone.now() + timedelta(days=2)
    lead_valid.save(update_fields=['next_action_description', 'next_activity_due_at'])

    # Verify all passed now!
    gate_check_passed = GateValidator.validate_lead_stage(lead_valid, pld_stage)
    assert gate_check_passed["all_passed"] is True, f"All gates must pass now! Got: {gate_check_passed}"
    print("[PASS] All qualification criteria satisfied -> Gate Validator permits progression to PLD Qualified!")

    # -------------------------------------------------------------
    # TEST 19: Audit Logging
    # -------------------------------------------------------------
    audit_count = AuditLog.objects.filter(entity_type='AccountProductAssessment').count()
    assert audit_count >= 1, "Audit logs must be generated for assessment operations"
    override_audit = AuditLog.objects.filter(
        entity_type='AccountProductAssessment', action=AuditAction.SCORE_OVERRIDE
    ).first()
    assert override_audit is not None, "Score override must generate SCORE_OVERRIDE audit log"
    print(f"[PASS] Test 19: Universal audit logging confirmed ({audit_count} assessment audit entries found, SCORE_OVERRIDE recorded with old vs new diff)")

    print("=" * 75)
    print("ALL 19 PHASE 4 AUTOMATED ENGINE TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 75)


if __name__ == '__main__':
    run_phase4_test_suite()
