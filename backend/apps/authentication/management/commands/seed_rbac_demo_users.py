import uuid
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.core.management.base import BaseCommand
from apps.authentication.models import User, UserRole
from apps.core.models import Tenant
from apps.accounts.models import Account, AccountType, Contact, AccountAttribute, AccountProduct, AccountProductStatus
from apps.products.models import Product
from apps.pld_engine.models import PipelineStage
from apps.leads.models import Lead
from apps.opportunities.models import Opportunity, OpportunityType, OpportunityStatus, Proposal, ProposalVersion
from apps.partners.models import Partner, PartnerUser, PartnerProduct, DealRegistration, PartnerStatus, PartnerType


DEMO_USERS = [
    {
        'username': 'admin',
        'email': 'admin@texol.com',
        'first_name': 'TEXOL',
        'last_name': 'Administrator',
        'role': UserRole.ADMIN,
        'territory': 'Global HQ',
        'phone': '+966 50 000 0000',
        'is_staff': True,
        'is_superuser': True,
        'is_partner_user': False,
        'custom_pass': 'Admin@Texol2026!',
    },
    {
        'username': 'management',
        'email': 'management@texol.com',
        'first_name': 'Khalid',
        'last_name': 'Al-Hassan',
        'role': UserRole.MANAGEMENT,
        'territory': 'Global HQ',
        'phone': '+966 50 111 2222',
        'is_staff': False,
        'is_superuser': False,
        'is_partner_user': False,
    },
    {
        'username': 'sales_manager',
        'email': 'sales.manager@texol.com',
        'first_name': 'Omar',
        'last_name': 'Al-Fahad',
        'role': UserRole.SALES_MANAGER,
        'territory': 'Riyadh & Central Province',
        'phone': '+966 50 222 3333',
        'is_staff': False,
        'is_superuser': False,
        'is_partner_user': False,
    },
    {
        'username': 'sales_ae',
        'email': 'sales.ae@texol.com',
        'first_name': 'Zaid',
        'last_name': 'Al-Harbi',
        'role': UserRole.SALES_BDM,
        'territory': 'Riyadh & Central Province',
        'phone': '+966 50 333 4444',
        'is_staff': False,
        'is_superuser': False,
        'is_partner_user': False,
    },
    {
        'username': 'presales',
        'email': 'presales@texol.com',
        'first_name': 'Tariq',
        'last_name': 'Al-Presales',
        'role': UserRole.PRESALES,
        'territory': 'Presales Technical & Discovery Operations',
        'phone': '+966 50 555 6666',
        'is_staff': False,
        'is_superuser': False,
        'is_partner_user': False,
    },
    {
        'username': 'product_manager',
        'email': 'product.manager@texol.com',
        'first_name': 'Noura',
        'last_name': 'Al-Dosari',
        'role': UserRole.PRODUCT_MANAGER,
        'territory': 'Product Operations & Architecture',
        'phone': '+966 50 666 7777',
        'is_staff': False,
        'is_superuser': False,
        'is_partner_user': False,
    },
    {
        'username': 'partner_manager',
        'email': 'partner.manager@texol.com',
        'first_name': 'Faisal',
        'last_name': 'Al-Qasim',
        'role': UserRole.PARTNER_MANAGER,
        'territory': 'Channel & Alliance Partnerships',
        'phone': '+966 50 777 8888',
        'is_staff': False,
        'is_superuser': False,
        'is_partner_user': False,
    },
    {
        'username': 'customer_success',
        'email': 'customer.success@texol.com',
        'first_name': 'Reem',
        'last_name': 'Al-Shamrani',
        'role': UserRole.CUSTOMER_SUCCESS,
        'territory': 'Post-Sale Customer Retention',
        'phone': '+966 50 888 9999',
        'is_staff': False,
        'is_superuser': False,
        'is_partner_user': False,
    },
    {
        'username': 'marketing',
        'email': 'marketing@texol.com',
        'first_name': 'Layla',
        'last_name': 'Al-Subaie',
        'role': UserRole.MARKETING,
        'territory': 'Growth & Demand Generation',
        'phone': '+966 50 999 0000',
        'is_staff': False,
        'is_superuser': False,
        'is_partner_user': False,
    },
    {
        'username': 'finance',
        'email': 'finance@texol.com',
        'first_name': 'Majid',
        'last_name': 'Al-Ghamdi',
        'role': UserRole.FINANCE,
        'territory': 'Finance & Commercial Operations',
        'phone': '+966 50 123 7890',
        'is_staff': False,
        'is_superuser': False,
        'is_partner_user': False,
    },
    {
        'username': 'partner_user',
        'email': 'partner.user@texol.com',
        'first_name': 'Bilal',
        'last_name': 'Al-Masri',
        'role': UserRole.PARTNER_USER,
        'territory': 'GCC / Middle East',
        'phone': '+966 55 987 6543',
        'is_staff': False,
        'is_superuser': False,
        'is_partner_user': True,
    },
]

DEMO_PASSWORD = 'TexolDemo2026!'


class Command(BaseCommand):
    help = 'Seeds all 12 RBAC demo accounts and comprehensive demo commercial records across all workspaces'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("=== Seeding RBAC Demo Accounts & Enterprise Commercial Data ==="))
        
        tenant = Tenant.objects.filter(code='TEXOL_INTERNAL').first()
        if not tenant:
            tenant = Tenant.objects.first()

        user_map = {}

        # 1. Seed All 12 Users
        self.stdout.write(self.style.NOTICE("\n[1/3] Seeding 12 User Accounts..."))
        for user_data in DEMO_USERS:
            email = user_data['email']
            user = User.objects.filter(email__iexact=email).first()
            if not user:
                user = User(
                    username=user_data['username'],
                    email=email,
                    tenant=tenant,
                )
            
            user.first_name = user_data['first_name']
            user.last_name = user_data['last_name']
            user.role = user_data['role']
            user.territory = user_data['territory']
            user.phone = user_data['phone']
            user.is_staff = user_data['is_staff']
            user.is_superuser = user_data['is_superuser']
            user.is_partner_user = user_data['is_partner_user']
            user.is_active = True

            target_pass = user_data.get('custom_pass', DEMO_PASSWORD)
            user.set_password(target_pass)
            user.save()
            user_map[user_data['role']] = user
            self.stdout.write(self.style.SUCCESS(f"  [OK] [{user_data['role']}] {email} ({target_pass})"))

        # 2. Seed Demo Partner Organisation & Partner User Profile
        self.stdout.write(self.style.NOTICE("\n[2/3] Seeding Demo Partner Organisation..."))
        partner_acc, _ = Account.objects.get_or_create(
            company_name="Gulf Tech Distribution & SI Partners",
            defaults={
                'account_type': AccountType.PARTNER,
                'industry': 'Information Technology & System Integration',
                'country': 'Saudi Arabia',
                'city': 'Riyadh',
                'website': 'https://gulftech-partners.example.sa',
                'domain': 'gulftech-partners.example.sa',
                'phone': '+966 11 456 7890',
                'employees_count': 180,
                'tenant': tenant,
                'primary_owner': user_map.get(UserRole.PARTNER_MANAGER),
            }
        )

        partner_org, _ = Partner.objects.get_or_create(
            partner_code="PARTNER-GULFTECH",
            defaults={
                'account': partner_acc,
                'partner_type': PartnerType.SI,
                'territory': 'GCC / Middle East',
                'status': PartnerStatus.ACTIVE,
                'partner_manager': user_map.get(UserRole.PARTNER_MANAGER),
                'notes': 'Certified Tier-1 VanForces System Integrator for GCC territory.',
                'tenant': tenant,
            }
        )

        partner_user_obj = user_map.get(UserRole.PARTNER_USER)
        if partner_user_obj:
            p_profile, _ = PartnerUser.objects.get_or_create(
                user=partner_user_obj,
                defaults={
                    'partner': partner_org,
                    'partner_role': 'ADMIN',
                    'is_active': True,
                    'tenant': tenant,
                }
            )
            p_profile.partner = partner_org
            p_profile.save()
            self.stdout.write(self.style.SUCCESS(f"  [OK] Linked {partner_user_obj.email} to {partner_org.account.company_name}"))

        # Authorize Product for Partner
        vanforces_prod = Product.objects.filter(code='VANFORCES').first()
        if vanforces_prod and partner_org:
            PartnerProduct.objects.get_or_create(
                partner=partner_org,
                product=vanforces_prod,
                defaults={
                    'authorization_status': 'CERTIFIED',
                    'territory': 'GCC / Middle East',
                    'commission_rate_pct': Decimal('15.00'),
                    'tenant': tenant,
                }
            )

        # 3. Seed Demo Commercial Accounts for All Workspaces
        self.stdout.write(self.style.NOTICE("\n[3/3] Seeding Demo Commercial Accounts & Lifecycles..."))
        
        now = timezone.now()
        sales_ae = user_map.get(UserRole.SALES_BDM)
        presales_rep = user_map.get(UserRole.PRESALES)
        cs_rep = user_map.get(UserRole.CUSTOMER_SUCCESS)
        stage_opp_neg = PipelineStage.objects.filter(stage_code='OPP_NEGOTIATION').first()
        stage_discovery = PipelineStage.objects.filter(stage_code='DISCOVERY').first()

        # Account 1: Al-Rayan Food & Beverage Logistics (Active Customer with Telemetry & Onboarding)
        al_rayan, _ = Account.objects.get_or_create(
            company_name="Al-Rayan Food & Beverage Logistics",
            defaults={
                'legal_name': 'Al-Rayan F&B Distribution Saudi Co. LLC',
                'account_type': AccountType.CUSTOMER,
                'industry': 'Food & Beverage Direct Store Delivery (DSD)',
                'country': 'Saudi Arabia',
                'city': 'Jeddah',
                'website': 'https://alrayan-logistics.example.sa',
                'domain': 'alrayan-logistics.example.sa',
                'phone': '+966 12 654 3210',
                'employees_count': 650,
                'distribution_centers_count': 6,
                'primary_owner': cs_rep,
                'is_target_account': True,
                'target_tier': 'TIER_1',
                'tenant': tenant,
                'last_activity_at': now - timedelta(days=2),
                'next_activity_due_at': now + timedelta(days=5),
                'next_action_description': 'Executive QBR & Telemetry Health Review for VanForces Rollout',
            }
        )

        Contact.objects.get_or_create(
            account=al_rayan,
            email='tariq.amoudi@alrayan.example.sa',
            defaults={
                'first_name': 'Tariq',
                'last_name': 'Al-Amoudi',
                'designation': 'VP of Fleet Operations & Supply Chain',
                'phone': '+966 50 789 1234',
                'is_primary': True,
                'tenant': tenant,
            }
        )

        if vanforces_prod:
            AccountProduct.objects.get_or_create(
                account=al_rayan,
                product=vanforces_prod,
                defaults={
                    'status': AccountProductStatus.CUSTOMER,
                    'contract_value': Decimal('435000.00'),
                    'arr_mrr': Decimal('145000.00'),
                    'renewal_date': (now + timedelta(days=85)).date(),
                    'health_score': 94,
                    'tenant': tenant,
                }
            )
            AccountAttribute.objects.update_or_create(
                account=al_rayan,
                product=vanforces_prod,
                attribute_key='van_count',
                defaults={'attribute_value': 120, 'tenant': tenant}
            )
            AccountAttribute.objects.update_or_create(
                account=al_rayan,
                product=vanforces_prod,
                attribute_key='erp_system',
                defaults={'attribute_value': 'SAP S/4HANA', 'tenant': tenant}
            )
            AccountAttribute.objects.update_or_create(
                account=al_rayan,
                product=vanforces_prod,
                attribute_key='telemetry_active_seats',
                defaults={'attribute_value': 118, 'tenant': tenant}
            )
        self.stdout.write(self.style.SUCCESS("  [OK] Demo Customer: Al-Rayan Food & Beverage Logistics (Health: 94%, ARR $145k)"))

        # Account 2: National Cold Chain Logistics KSA (Active Opportunity & Quoted Proposal)
        national_cold, _ = Account.objects.get_or_create(
            company_name="National Cold Chain Logistics KSA",
            defaults={
                'legal_name': 'National Cold Chain Transport Saudi JSC',
                'account_type': AccountType.PROSPECT,
                'industry': 'Cold Chain Distribution & Pharmaceuticals',
                'country': 'Saudi Arabia',
                'city': 'Riyadh',
                'website': 'https://nationalcoldchain.example.sa',
                'domain': 'nationalcoldchain.example.sa',
                'phone': '+966 11 234 5678',
                'employees_count': 320,
                'distribution_centers_count': 4,
                'primary_owner': sales_ae,
                'is_target_account': True,
                'target_tier': 'TIER_1',
                'tenant': tenant,
                'last_activity_at': now - timedelta(days=1),
                'next_activity_due_at': now + timedelta(days=2),
                'next_action_description': 'Commercial proposal sign-off meeting with CFO',
            }
        )

        c_director, _ = Contact.objects.get_or_create(
            account=national_cold,
            email='sultan.otaibi@nationalcoldchain.example.sa',
            defaults={
                'first_name': 'Sultan',
                'last_name': 'Al-Otaibi',
                'designation': 'Commercial Director & Partner',
                'phone': '+966 55 123 4567',
                'is_primary': True,
                'tenant': tenant,
            }
        )

        if vanforces_prod:
            opp, _ = Opportunity.objects.get_or_create(
                account=national_cold,
                product=vanforces_prod,
                defaults={
                    'primary_contact': c_director,
                    'owner': sales_ae,
                    'opportunity_type': OpportunityType.NEW,
                    'stage': stage_opp_neg,
                    'status': OpportunityStatus.OPEN,
                    'total_contract_value': Decimal('185000.00'),
                    'arr_mrr': Decimal('62000.00'),
                    'arr': Decimal('62000.00'),
                    'pricing_plan': 'Enterprise Van Fleet License',
                    'seat_units_count': 45,
                    'contract_term_months': 36,
                    'currency': 'SAR',
                    'probability_pct': 85,
                    'expected_close_date': (now + timedelta(days=20)).date(),
                    'pld_score': 88,
                    'erp_system': 'Microsoft Dynamics 365',
                    'tenant': tenant,
                    'next_action_description': 'Close negotiation on 12% discount proposal and execute contract.',
                }
            )

            # Proposal v1
            prop, _ = Proposal.objects.get_or_create(
                opportunity=opp,
                version_number=1,
                defaults={
                    'account': national_cold,
                    'primary_contact': c_director,
                    'product': vanforces_prod,
                    'proposal_number': 'PROP-2026-NCC01',
                    'title': 'Enterprise Fleet Automation Proposal v1.0',
                    'owner': sales_ae,
                    'status': 'Submitted',
                    'currency': 'SAR',
                    'valid_from': now.date(),
                    'valid_until': (now + timedelta(days=30)).date(),
                    'gross_amount': Decimal('185000.00'),
                    'discount_pct': Decimal('12.00'),
                    'discount_amount': Decimal('22200.00'),
                    'discount_reason': 'Standard enterprise volume discount (45 vans, 3-year term).',
                    'net_amount': Decimal('162800.00'),
                    'contract_term_months': 36,
                    'payment_terms': 'Annual in advance',
                    'approval_required_flag': False,
                    'tenant': tenant,
                }
            )
            ProposalVersion.objects.get_or_create(
                proposal=prop,
                version_number=1,
                defaults={
                    'status': 'Submitted',
                    'currency': 'SAR',
                    'gross_amount': Decimal('185000.00'),
                    'discount_pct': Decimal('12.00'),
                    'discount_amount': Decimal('22200.00'),
                    'discount_reason': 'Standard enterprise volume discount (45 vans, 3-year term).',
                    'net_amount': Decimal('162800.00'),
                    'contract_term_months': 36,
                    'payment_terms': 'Annual in advance',
                    'created_by': sales_ae,
                    'tenant': tenant,
                }
            )
        self.stdout.write(self.style.SUCCESS("  [OK] Demo Opportunity & Proposal: National Cold Chain ($185k Gross, $162.8k Net)"))

        # Account 3: Al-Madina FMCG Wholesale & Trading (Active Inbound Lead in Discovery)
        al_madina, _ = Account.objects.get_or_create(
            company_name="Al-Madina FMCG Wholesale & Trading",
            defaults={
                'legal_name': 'Al-Madina FMCG General Trading Establishment',
                'account_type': AccountType.PROSPECT,
                'industry': 'FMCG Wholesale & Retail Distribution',
                'country': 'Saudi Arabia',
                'city': 'Medina',
                'website': 'https://almadina-fmcg.example.sa',
                'domain': 'almadina-fmcg.example.sa',
                'phone': '+966 14 822 9988',
                'employees_count': 350,
                'distribution_centers_count': 3,
                'primary_owner': presales_rep,
                'tenant': tenant,
                'last_activity_at': now - timedelta(hours=6),
                'next_activity_due_at': now + timedelta(days=1),
                'next_action_description': 'Complete Problem Impact Discovery & parameterize POC trial',
            }
        )

        c_madina, _ = Contact.objects.get_or_create(
            account=al_madina,
            email='hassan.zahrani@almadina.example.sa',
            defaults={
                'first_name': 'Hassan',
                'last_name': 'Al-Zahrani',
                'designation': 'Supply Chain & Route Planning Manager',
                'phone': '+966 54 321 0987',
                'is_primary': True,
                'tenant': tenant,
            }
        )

        if vanforces_prod:
            Lead.objects.get_or_create(
                account=al_madina,
                primary_product=vanforces_prod,
                defaults={
                    'contact': c_madina,
                    'owner': presales_rep,
                    'current_stage': stage_discovery,
                    'status': 'Active',
                    'estimated_opportunity_value': Decimal('110000.00'),
                    'timeline_expectation': 'Within 60 days',
                    'next_activity_due_at': now + timedelta(days=1),
                    'next_action_description': 'Conduct POC scope discovery and prepare SQL handoff checklist',
                    'tenant': tenant,
                }
            )
        self.stdout.write(self.style.SUCCESS("  [OK] Demo Discovery Lead: Al-Madina FMCG Wholesale (Estimated: $110,000)"))

        # Account 4: Gulf Hypermarket Supply Co (Closed Lost Opportunity in Nurture Pool)
        gulf_hyper, _ = Account.objects.get_or_create(
            company_name="Gulf Hypermarket Supply Co",
            defaults={
                'legal_name': 'Gulf Hypermarket Logistics Co.',
                'account_type': AccountType.PROSPECT,
                'industry': 'Grocery & Supermarket Distribution',
                'country': 'Saudi Arabia',
                'city': 'Dammam',
                'employees_count': 220,
                'primary_owner': sales_ae,
                'tenant': tenant,
            }
        )
        if vanforces_prod:
            Opportunity.objects.get_or_create(
                account=gulf_hyper,
                product=vanforces_prod,
                defaults={
                    'owner': sales_ae,
                    'opportunity_type': OpportunityType.NEW,
                    'status': OpportunityStatus.LOST,
                    'total_contract_value': Decimal('92000.00'),
                    'arr_mrr': Decimal('30000.00'),
                    'loss_reason_category': 'PRICE_BUDGET',
                    'competitor': 'SAP Direct Extension',
                    'loss_reason_notes': 'Budget deferred to next fiscal year; requested win-back contact in Q1.',
                    'expected_close_date': (now - timedelta(days=45)).date(),
                    'tenant': tenant,
                    'next_activity_due_at': now + timedelta(days=40),
                    'next_action_description': 'Trigger Marketing Win-Back Campaign & competitor contract expiry check',
                }
            )
        self.stdout.write(self.style.SUCCESS("  [OK] Demo Nurture Opportunity: Gulf Hypermarket Supply Co (Lost to SAP on price)"))

        # Account 5: Al-Khaleej Retail Depot (Protected Deal Registration by Partner)
        al_khaleej, _ = Account.objects.get_or_create(
            company_name="Al-Khaleej Retail Depot",
            defaults={
                'legal_name': 'Al-Khaleej Retail Central Distribution Est',
                'account_type': AccountType.PROSPECT,
                'industry': 'Retail DSD & Route Delivery',
                'country': 'Saudi Arabia',
                'city': 'Al-Khobar',
                'employees_count': 140,
                'tenant': tenant,
            }
        )
        if vanforces_prod and partner_org:
            DealRegistration.objects.get_or_create(
                customer_account=al_khaleej,
                product=vanforces_prod,
                defaults={
                    'partner': partner_org,
                    'registered_by': partner_user_obj,
                    'territory': 'Eastern Province / GCC',
                    'expected_deal_value': Decimal('95000.00'),
                    'expected_close_date': (now + timedelta(days=60)).date(),
                    'evidence_notes': 'Exclusive client introduction meeting held with Operations VP on route planning requirements.',
                    'protection_expiry_date': (now + timedelta(days=90)).date(),
                    'status': 'Submitted',
                    'tenant': tenant,
                }
            )
        self.stdout.write(self.style.SUCCESS("  [OK] Demo Protected Deal Registration: Al-Khaleej Retail Depot (by Gulf Tech Partners)"))

        self.stdout.write(self.style.SUCCESS("\n[DONE] Complete! All 12 demo user accounts and enterprise commercial accounts are ready."))
