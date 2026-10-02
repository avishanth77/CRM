import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import Account, AccountAttribute
from apps.products.models import Product, Problem
from apps.leads.models import Lead, LeadProblem
from apps.pld_engine.models import ProductConfigurationVersion, PipelineStage
from apps.pld_engine.services import ICPEvaluator, PLDScoreCalculator, GateValidator
from apps.pld_assessments.models import AccountProductAssessment
from django.utils import timezone
from datetime import timedelta

print("=== STARTING PLD ENGINE VALIDATION ===")
product = Product.objects.get(code='VANFORCES')
config = product.configurations.get(status='PUBLISHED')

# 1. Create Account
account, _ = Account.objects.get_or_create(
    company_name='Al-Bustan Food Distribution Ltd',
    defaults={
        'industry': 'Bakery',
        'employees_count': 120,
        'country': 'Saudi Arabia'
    }
)

# 2. Add Dynamic Product Attributes for VanForces
AccountAttribute.objects.update_or_create(account=account, product=product, attribute_key='salesmen_count', defaults={'attribute_value': 35})
AccountAttribute.objects.update_or_create(account=account, product=product, attribute_key='vans_count', defaults={'attribute_value': 22})
AccountAttribute.objects.update_or_create(account=account, product=product, attribute_key='field_sales', defaults={'attribute_value': True})
AccountAttribute.objects.update_or_create(account=account, product=product, attribute_key='current_erp', defaults={'attribute_value': 'Odoo'})

# 3. Create Lead
lead, _ = Lead.objects.get_or_create(
    account=account,
    primary_product=product,
    defaults={
        'next_activity_due_at': timezone.now() + timedelta(days=2),
        'next_action_description': 'Conduct initial PLD discovery call'
    }
)

# 4. Evaluate ICP
icp_res = ICPEvaluator.evaluate(account, product, config, lead=lead)
print(f"[1] ICP Knockout Passed: {icp_res['knockout_passed']}")
print(f"[2] ICP Fit Score: {icp_res['fit_score']}/100")

# 5. Evaluate PLD Score
assessment = AccountProductAssessment.objects.get(id=icp_res['assessment_id'])
answers = {
    'PROBLEM_SEVERITY': 'HIGH',
    'BUSINESS_VALUE': '>=20%',
    'DECISION_ACCESS': 'DECISION_MAKER',
    'TIMELINE': '<3 months',
    'TECHNICAL_FIT': 'STANDARD_ERP',
    'COMMERCIAL_POTENTIAL': '20-49 vans'
}
score_res = PLDScoreCalculator.calculate(assessment, answers)
print(f"[3] PLD Score: {score_res['pld_score']}/100 | Classification: {score_res['classification']}")
for d in score_res['dimension_scores']:
    print(f"    - {d['dimension']}: raw {d['raw_score']}, weighted {d['weighted_score']} (weight: {d['weight_percentage']}%)")

# 6. Test Gate Validation without problem
pld_qualified_stage = config.stages.get(stage_code='PLD_QUALIFIED')
# Ensure no problems attached initially for negative test
LeadProblem.objects.filter(lead=lead).delete()
gate_check_1 = GateValidator.validate_lead_stage(lead, pld_qualified_stage)
print(f"[4] Gate check without problem (Expect all_passed=False): {gate_check_1['all_passed']}")
for g in gate_check_1['checklist']:
    print(f"    * {g['gate_name']} -> Satisfied: {g['satisfied']}, Missing: {g['missing']}")

# 7. Add documented problem and recheck
prob = Problem.objects.get(code='PROB_OUTLET_COVERAGE')
LeadProblem.objects.get_or_create(lead=lead, problem=prob, defaults={'notes': 'Drivers skip 25% of retail outlets due to poor routing'})
gate_check_2 = GateValidator.validate_lead_stage(lead, pld_qualified_stage)
print(f"[5] Gate check with problem and next action (Expect all_passed=True): {gate_check_2['all_passed']}")

print("=== PLD ENGINE PIPELINE TEST COMPLETED SUCCESSFULLY ===")
