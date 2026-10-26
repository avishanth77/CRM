from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from apps.products.models import Product
from apps.core.models import Territory
from apps.leads.models import Lead, LeadStatus, LeadProductInterest, LeadTouch, LeadSource
from apps.accounts.models import Account, Contact, AccountAttribute
from apps.activities.models import Activity


class WebsiteLeadIngestionAPITests(TestCase):
    """
    Test suite for public Website Lead Ingestion POST API endpoints:
    - POST /api/v1/leads/website/
    - POST /api/v1/website-leads/
    - POST /api/v1/integrations/inbound-lead/
    """

    def setUp(self):
        self.client = APIClient()

        # Seed Territories
        self.t_central = Territory.objects.create(
            name="Central / Riyadh",
            code="CENTRAL",
            is_active=True
        )
        self.t_western = Territory.objects.create(
            name="Western / Jeddah & Makkah",
            code="WESTERN",
            is_active=True
        )
        self.t_eastern = Territory.objects.create(
            name="Eastern / Dammam & Khobar",
            code="EASTERN",
            is_active=True
        )
        self.t_southern = Territory.objects.create(
            name="Southern / Asir & Jazan",
            code="SOUTHERN",
            is_active=True
        )
        self.t_northern = Territory.objects.create(
            name="Northern / Tabuk & Al-Jouf",
            code="NORTHERN",
            is_active=True
        )
        self.t_gcc = Territory.objects.create(
            name="UAE / GCC Regional Hub",
            code="GCC",
            is_active=True
        )

        # Seed Products
        self.vanforces = Product.objects.create(
            name="VanForces™ Route Execution",
            code="VANFORCES",
            category="DISTRIBUTION"
        )
        self.almawasil = Product.objects.create(
            name="Al Mawasil Logistics Delivery",
            code="AL_MAWASIL",
            category="LOGISTICS"
        )

    def test_post_website_lead_success_via_leads_website_endpoint(self):
        """Verify unauthenticated POST to /api/v1/leads/website/ creates unassigned lead for triage queue."""
        payload = {
            "company_name": "Al-Othaim Commercial Co.",
            "contact_name": "Ahmed Al-Harbi",
            "email": "ahmed@alothaim.com.sa",
            "phone": "+966501234567",
            "designation": "Head of Van Sales & Operations",
            "product_code": "VANFORCES",
            "city": "Riyadh",
            "country": "Saudi Arabia",
            "message": "We need mobile route execution for 45 van sales reps integrated with SAP S/4HANA.",
            "vans_count": 45,
            "salesmen_count": 45,
            "primary_erp": "SAP",
            "monthly_invoices": 18000,
            "utm_source": "google_ads",
            "utm_medium": "cpc",
            "utm_campaign": "ksa_fmcg_vanforces"
        }

        response = self.client.post('/api/v1/leads/website/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        res_data = response.json()

        self.assertTrue(res_data['success'])
        self.assertFalse(res_data['owner_assigned'])
        self.assertEqual(res_data['triage_status'], 'PENDING_ASSIGNMENT')
        self.assertEqual(res_data['territory'], 'Central / Riyadh')
        self.assertEqual(res_data['product_code'], 'VANFORCES')

        lead_id = res_data['lead_id']
        lead = Lead.objects.get(id=lead_id)

        # Verify lead state
        self.assertIsNone(lead.owner)
        self.assertEqual(lead.status, LeadStatus.ACTIVE)
        self.assertEqual(lead.territory, 'Central / Riyadh')
        self.assertEqual(lead.primary_product, self.vanforces)
        self.assertIn("Awaiting Sales Assignment", lead.next_action_description)

        # Verify account and contact
        self.assertEqual(lead.account.company_name, "Al-Othaim Commercial Co.")
        self.assertEqual(lead.account.domain, "alothaim.com.sa")
        self.assertEqual(lead.account.territory, "Central / Riyadh")
        self.assertEqual(lead.contact.first_name, "Ahmed")
        self.assertEqual(lead.contact.last_name, "Al-Harbi")
        self.assertEqual(lead.contact.email, "ahmed@alothaim.com.sa")

        # Verify product interest
        product_interest = LeadProductInterest.objects.filter(lead=lead, product=self.vanforces).first()
        self.assertIsNotNone(product_interest)
        self.assertTrue(product_interest.is_primary)

        # Verify LeadTouch attribution
        touch = LeadTouch.objects.filter(lead=lead).first()
        self.assertIsNotNone(touch)
        self.assertEqual(touch.utm_parameters.get('utm_source'), 'google_ads')
        self.assertEqual(touch.utm_parameters.get('utm_campaign'), 'ksa_fmcg_vanforces')

        # Verify Activity
        act = Activity.objects.filter(lead=lead).first()
        self.assertIsNotNone(act)
        self.assertEqual(act.description_notes, payload['message'])

        # Verify AccountAttributes
        van_attr = AccountAttribute.objects.filter(account=lead.account, attribute_key='vans_count').first()
        self.assertIsNotNone(van_attr)
        self.assertEqual(str(van_attr.attribute_value), "45")

        erp_attr = AccountAttribute.objects.filter(account=lead.account, attribute_key='primary_erp').first()
        self.assertIsNotNone(erp_attr)
        self.assertEqual(erp_attr.attribute_value, "SAP")

    def test_post_website_lead_via_direct_website_leads_url(self):
        """Verify POST to /api/v1/website-leads/ works identically without authentication."""
        payload = {
            "name": "Fahad Al-Zahrani",
            "company": "Red Sea FMCG Distribution",
            "email": "fahad@redseadistrib.com",
            "phone": "+966559876543",
            "city": "Jeddah",
            "product_code": "VANFORCES",
            "message": "Interested in evaluating VanForces for our Jeddah and Makkah routes."
        }

        response = self.client.post('/api/v1/website-leads/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        res_data = response.json()

        self.assertTrue(res_data['success'])
        self.assertEqual(res_data['territory'], 'Western / Jeddah & Makkah')
        self.assertEqual(res_data['company_name'], "Red Sea FMCG Distribution")

        lead = Lead.objects.get(id=res_data['lead_id'])
        self.assertIsNone(lead.owner)
        self.assertEqual(lead.territory, "Western / Jeddah & Makkah")

    def test_city_territory_inference_across_regions(self):
        """Verify automatic regional mapping for cities across KSA and GCC."""
        test_cases = [
            ("Dammam", "Eastern / Dammam & Khobar"),
            ("Khobar", "Eastern / Dammam & Khobar"),
            ("Jubail", "Eastern / Dammam & Khobar"),
            ("Jeddah", "Western / Jeddah & Makkah"),
            ("Makkah", "Western / Jeddah & Makkah"),
            ("Medina", "Western / Jeddah & Makkah"),
            ("Riyadh", "Central / Riyadh"),
            ("Buraidah", "Central / Riyadh"),
            ("Abha", "Southern / Asir & Jazan"),
            ("Jazan", "Southern / Asir & Jazan"),
            ("Tabuk", "Northern / Tabuk & Al-Jouf"),
            ("Dubai", "UAE / GCC Regional Hub"),
        ]

        for city, expected_territory in test_cases:
            payload = {
                "name": f"Contact in {city}",
                "company": f"Corp {city}",
                "email": f"contact@{city.lower().replace(' ', '')}-corp.com",
                "phone": "+966500000000",
                "city": city,
                "product_code": "VANFORCES"
            }
            response = self.client.post('/api/v1/leads/website/', payload, format='json')
            self.assertEqual(response.status_code, status.HTTP_201_CREATED, f"Failed for city: {city}")
            self.assertEqual(
                response.json()['territory'],
                expected_territory,
                f"City '{city}' mapped to '{response.json()['territory']}' instead of '{expected_territory}'"
            )

    def test_validation_errors(self):
        """Verify validation errors when neither email nor phone is supplied."""
        # Missing contact details
        payload = {
            "company_name": "Incomplete Prospect",
            "name": "Mystery Person"
        }
        response = self.client.post('/api/v1/leads/website/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        res_data = response.json()
        self.assertIn("non_field_errors", res_data)

    def test_account_and_contact_deduplication(self):
        """Verify subsequent inquiries from the same company/domain reuse the existing Account and Contact."""
        payload1 = {
            "company_name": "Al-Bustan Beverage",
            "name": "Saleh Al-Amri",
            "email": "saleh@albustan-beverage.com",
            "phone": "+966501112233",
            "city": "Dammam",
            "product_code": "VANFORCES"
        }
        r1 = self.client.post('/api/v1/leads/website/', payload1, format='json')
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)
        acc_id_1 = r1.json()['account_id']

        # Second inquiry with same domain
        payload2 = {
            "company_name": "Al-Bustan Beverage Co.",
            "name": "Saleh Al-Amri",
            "email": "saleh@albustan-beverage.com",
            "phone": "+966501112233",
            "city": "Dammam",
            "product_code": "AL_MAWASIL",
            "message": "Also inquiring about Al Mawasil for logistics tracking."
        }
        r2 = self.client.post('/api/v1/leads/website/', payload2, format='json')
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED)
        acc_id_2 = r2.json()['account_id']

        # Same account should be reused
        self.assertEqual(acc_id_1, acc_id_2)

        # Total accounts with domain albustan-beverage.com should be 1
        self.assertEqual(Account.objects.filter(domain="albustan-beverage.com").count(), 1)
        self.assertEqual(Contact.objects.filter(email="saleh@albustan-beverage.com").count(), 1)

    def test_inbound_webhook_lead_view_backward_compatibility(self):
        """Verify /api/v1/integrations/inbound-lead/ also ingests properly and sets territory."""
        payload = {
            "company_name": "Jeddah Fresh Cold Chain",
            "contact_name": "Tariq Mansoor",
            "email": "tariq@jeddahfresh.sa",
            "phone": "+966540001122",
            "city": "Jeddah",
            "product_code": "VANFORCES",
            "message": "Need pricing for 20 refrigerated vans."
        }
        response = self.client.post('/api/v1/integrations/inbound-lead/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        res_data = response.json()
        self.assertTrue(res_data['success'])
        self.assertEqual(res_data['territory'], 'Western / Jeddah & Makkah')
        self.assertFalse(res_data['owner_assigned'])
