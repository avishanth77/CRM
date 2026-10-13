import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.leads.models import Lead, LeadStatus
from apps.accounts.models import Account
from apps.products.models import Product
from apps.pld_engine.models import PipelineStage

User = get_user_model()

def run_tests():
    print("==================================================================")
    print("STARTING TEXOL PLD CRM RBAC & LEAD ISOLATION VERIFICATION SUITE")
    print("==================================================================")

    # 1. Setup users
    sales_ae1 = User.objects.get(email='sales.ae@texol.com')
    sales_ae2, created = User.objects.get_or_create(
        email='sales.ae2@texol.com',
        defaults={
            'username': 'sales_ae2',
            'first_name': 'Farhan',
            'last_name': 'Al-Mansoor',
            'role': 'SALES_BDM',
            'is_active': True
        }
    )
    if created:
        sales_ae2.set_password('TexolDemo2026!')
        sales_ae2.save()

    sales_manager = User.objects.get(email='sales.manager@texol.com')
    admin_user = User.objects.get(email='admin@texol.com')

    # Get sample account and product
    account1, _ = Account.objects.get_or_create(
        company_name="Test Enterprise Alpha",
        defaults={"industry": "FMCG", "employees_count": 250, "city": "Riyadh", "country": "Saudi Arabia"}
    )
    account2, _ = Account.objects.get_or_create(
        company_name="Test Enterprise Beta",
        defaults={"industry": "Logistics", "employees_count": 300, "city": "Jeddah", "country": "Saudi Arabia"}
    )
    product = Product.objects.first()

    # 2. Setup leads: lead1 for AE1, lead2 for AE2
    lead1, _ = Lead.objects.get_or_create(
        account=account1,
        primary_product=product,
        defaults={'owner': sales_ae1, 'status': LeadStatus.ACTIVE}
    )
    lead1.owner = sales_ae1
    lead1.save(update_fields=['owner'])

    lead2, _ = Lead.objects.get_or_create(
        account=account2,
        primary_product=product,
        defaults={'owner': sales_ae2, 'status': LeadStatus.ACTIVE}
    )
    lead2.owner = sales_ae2
    lead2.save(update_fields=['owner'])

    passed_count = 0
    total_count = 0

    def assert_test(condition, test_name, detail=""):
        nonlocal passed_count, total_count
        total_count += 1
        if condition:
            passed_count += 1
            print(f" [PASS] Test {total_count}: {test_name}")
        else:
            print(f" [FAIL] Test {total_count}: {test_name} -> {detail}")

    client = APIClient()

    # -------------------------------------------------------------------------
    # TEST 1: Lead Visibility - List Endpoint
    # -------------------------------------------------------------------------
    client.force_authenticate(user=sales_ae1)
    res = client.get('/api/v1/leads/')
    lead_ids = [str(l['id']) for l in res.data.get('results', [])]
    assert_test(
        str(lead1.id) in lead_ids and str(lead2.id) not in lead_ids,
        "Sales AE 1 can view only assigned leads in lead list",
        f"Returned IDs: {lead_ids}, Expected: [{lead1.id}] but NOT [{lead2.id}]"
    )

    client.force_authenticate(user=sales_ae2)
    res = client.get('/api/v1/leads/')
    lead_ids = [str(l['id']) for l in res.data.get('results', [])]
    assert_test(
        str(lead2.id) in lead_ids and str(lead1.id) not in lead_ids,
        "Sales AE 2 can view only assigned leads in lead list",
        f"Returned IDs: {lead_ids}, Expected: [{lead2.id}] but NOT [{lead1.id}]"
    )

    # -------------------------------------------------------------------------
    # TEST 2: Direct Lead URL / ID Access Isolation
    # -------------------------------------------------------------------------
    client.force_authenticate(user=sales_ae1)
    res = client.get(f'/api/v1/leads/{lead2.id}/')
    assert_test(
        res.status_code == 404,
        "Sales AE 1 cannot access Sales AE 2 lead via direct URL/ID (returns 404)",
        f"Status code: {res.status_code}"
    )

    client.force_authenticate(user=sales_ae2)
    res = client.get(f'/api/v1/leads/{lead1.id}/')
    assert_test(
        res.status_code == 404,
        "Sales AE 2 cannot access Sales AE 1 lead via direct URL/ID (returns 404)",
        f"Status code: {res.status_code}"
    )

    # -------------------------------------------------------------------------
    # TEST 3: Unauthorized Lead Modification / Operations
    # -------------------------------------------------------------------------
    client.force_authenticate(user=sales_ae1)
    res = client.patch(f'/api/v1/leads/{lead2.id}/', {'estimated_opportunity_value': 88888}, format='json')
    assert_test(
        res.status_code == 404,
        "Sales AE 1 cannot update Sales AE 2 lead via PATCH (returns 404)",
        f"Status code: {res.status_code}"
    )

    # -------------------------------------------------------------------------
    # TEST 4: Lead Creation Assignment Permissions
    # -------------------------------------------------------------------------
    # Sales AE 1 attempts to create a lead and assign it to Sales AE 2
    client.force_authenticate(user=sales_ae1)
    res = client.post('/api/v1/leads/', {
        'account': str(account1.id),
        'primary_product': str(product.id),
        'owner': str(sales_ae2.id)
    }, format='json')
    assert_test(
        res.status_code == 403,
        "Sales AE 1 cannot assign new lead to another staff member (returns 403)",
        f"Status code: {res.status_code}, data: {res.data}"
    )

    # -------------------------------------------------------------------------
    # TEST 5: Lead Ownership Reassignment Prevention
    # -------------------------------------------------------------------------
    # Sales AE 1 attempts to reassign their own lead to Sales AE 2
    client.force_authenticate(user=sales_ae1)
    res = client.patch(f'/api/v1/leads/{lead1.id}/', {
        'owner': str(sales_ae2.id)
    }, format='json')
    assert_test(
        res.status_code == 403,
        "Sales AE 1 cannot reassign lead ownership to another staff member (returns 403)",
        f"Status code: {res.status_code}, data: {res.data}"
    )

    # -------------------------------------------------------------------------
    # TEST 6: PLD Engine Validation Gate Isolation
    # -------------------------------------------------------------------------
    target_stage = PipelineStage.objects.first()
    client.force_authenticate(user=sales_ae1)
    res = client.post('/api/v1/product-configs/validate-gate/', {
        'lead_id': str(lead2.id),
        'target_stage_id': str(target_stage.id) if target_stage else ""
    }, format='json')
    assert_test(
        res.status_code == 404,
        "Sales AE 1 cannot execute PLD stage gate validation on unowned lead (returns 404)",
        f"Status code: {res.status_code}, data: {getattr(res, 'data', None)}"
    )

    # -------------------------------------------------------------------------
    # TEST 7: Sales Handoff Readiness & Submission Isolation
    # -------------------------------------------------------------------------
    client.force_authenticate(user=sales_ae1)
    res = client.post('/api/v1/sales-handoff/readiness/', {
        'lead_id': str(lead2.id)
    }, format='json')
    assert_test(
        res.status_code == 404,
        "Sales AE 1 cannot inspect SQL readiness for unowned lead (returns 404)",
        f"Status code: {res.status_code}, data: {getattr(res, 'data', None)}"
    )

    res = client.post('/api/v1/sales-handoff/submit/', {
        'lead_id': str(lead2.id)
    }, format='json')
    assert_test(
        res.status_code == 404,
        "Sales AE 1 cannot submit SQL handoff for unowned lead (returns 404)",
        f"Status code: {res.status_code}, data: {getattr(res, 'data', None)}"
    )

    # -------------------------------------------------------------------------
    # TEST 8: Reports & Exports Scoping
    # -------------------------------------------------------------------------
    client.force_authenticate(user=sales_ae1)
    res = client.get('/api/v1/analytics/reports/?report=pipeline_by_owner')
    rows = res.data.get('rows', [])
    owner_names = [r.get('email') for r in rows]
    assert_test(
        len(rows) == 1 and sales_ae1.email in owner_names and sales_ae2.email not in owner_names,
        "Sales AE 1 report data strictly isolated to their own user scope",
        f"Report rows count: {len(rows)}, emails: {owner_names}"
    )

    res_csv = client.get('/api/v1/analytics/reports/export/?report=pipeline_by_owner')
    csv_text = res_csv.content.decode('utf-8')
    assert_test(
        res_csv.status_code == 200 and sales_ae1.email in csv_text and sales_ae2.email not in csv_text,
        "Sales AE 1 CSV export strictly excludes other staff members' data",
        f"CSV Content: {csv_text}"
    )

    # -------------------------------------------------------------------------
    # TEST 9: Preserving Sales Manager Permissions & Enterprise Scopes
    # -------------------------------------------------------------------------
    client.force_authenticate(user=sales_manager)
    res = client.get('/api/v1/leads/')
    manager_lead_ids = [str(l['id']) for l in res.data.get('results', [])]
    assert_test(
        str(lead1.id) in manager_lead_ids and str(lead2.id) in manager_lead_ids,
        "Sales Manager retains visibility over all team members' leads",
        f"Manager lead count: {len(manager_lead_ids)}"
    )

    # Sales Manager CAN reassign leads
    res = client.patch(f'/api/v1/leads/{lead1.id}/', {
        'owner': str(sales_ae2.id)
    }, format='json')
    assert_test(
        res.status_code == 200,
        "Sales Manager is authorized to reassign lead ownership across staff members",
        f"Status code: {res.status_code}"
    )

    # Reassign back to AE1
    client.patch(f'/api/v1/leads/{lead1.id}/', {'owner': str(sales_ae1.id)}, format='json')

    # -------------------------------------------------------------------------
    # TEST 10: Preserving Admin Global Scope
    # -------------------------------------------------------------------------
    client.force_authenticate(user=admin_user)
    res = client.get('/api/v1/leads/')
    admin_lead_ids = [str(l['id']) for l in res.data.get('results', [])]
    assert_test(
        str(lead1.id) in admin_lead_ids and str(lead2.id) in admin_lead_ids,
        "Admin retains global enterprise visibility over all leads",
        f"Admin lead count: {len(admin_lead_ids)}"
    )

    print("==================================================================")
    print(f"VERIFICATION COMPLETE: {passed_count}/{total_count} TESTS PASSED")
    print("==================================================================")

    return passed_count == total_count

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
