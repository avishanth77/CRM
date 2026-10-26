import uuid
from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from apps.authentication.models import User, UserRole
from apps.accounts.models import Account, AccountType
from apps.leads.models import Lead, LeadStatus
from apps.opportunities.models import Opportunity, Proposal, ProposalVersion, ProposalStatus
from apps.partners.models import Partner, PartnerUser, DealRegistration, DealRegistrationStatus
from apps.pld_engine.models import ProductConfigurationVersion
from apps.products.models import Product
from apps.pld_assessments.models import AccountProductAssessment
from apps.integrations.models import ERPConnectorConfig


class AuthenticationAndRBACSecurityTests(TestCase):
    """
    Automated security tests for Section 9 Authentication and RBAC Architecture.
    Covers:
    A. JWT Authentication (login, logout, refresh, blacklist, password change, active validation)
    B. 12 Roles & Privilege Escalation Protection
    C. 4 Hierarchical Data Scoping Tiers & IDOR Isolation
    D. Section 9.5 Approval & Governance Workflows
    """

    def setUp(self):
        self.client = APIClient()

        # Shared Product
        self.product = Product.objects.create(
            name="VanForces Route Execution",
            code="VANFORCES",
            category="DISTRIBUTION"
        )

        # 1. Platform Admin (Tier 1)
        self.admin_user = User.objects.create_user(
            email="admin.security@texol.sa",
            username="admin.security",
            password="SecurePassword123!",
            role=UserRole.ADMIN,
            first_name="Platform",
            last_name="Admin",
            territory="Saudi Arabia"
        )

        # 2. Management (Tier 1)
        self.mgmt_user = User.objects.create_user(
            email="mgmt.security@texol.sa",
            username="mgmt.security",
            password="SecurePassword123!",
            role=UserRole.MANAGEMENT,
            first_name="Executive",
            last_name="Management",
            territory="Saudi Arabia"
        )

        # 3. Sales Manager (Tier 2) - Central Region
        self.sales_manager = User.objects.create_user(
            email="manager.central@texol.sa",
            username="manager.central",
            password="SecurePassword123!",
            role=UserRole.SALES_MANAGER,
            first_name="Central",
            last_name="Manager",
            territory="Riyadh / Central"
        )

        # 4. Sales BDM (Tier 3) - Central Region (Reports to sales_manager)
        self.sales_rep_a = User.objects.create_user(
            email="rep.central@texol.sa",
            username="rep.central",
            password="SecurePassword123!",
            role=UserRole.SALES_BDM,
            first_name="Tariq",
            last_name="Sales",
            territory="Riyadh / Central",
            manager=self.sales_manager
        )

        # 5. Sales BDM (Tier 3) - Eastern Region (Different territory & manager)
        self.sales_rep_b = User.objects.create_user(
            email="rep.eastern@texol.sa",
            username="rep.eastern",
            password="SecurePassword123!",
            role=UserRole.AE,  # Normalized alias for SALES_BDM
            first_name="Fahad",
            last_name="Eastern",
            territory="Dammam / Eastern"
        )

        # 6. PLD Executive (Tier 3)
        self.pld_exec = User.objects.create_user(
            email="pld.exec@texol.sa",
            username="pld.exec",
            password="SecurePassword123!",
            role=UserRole.PLD_EXECUTIVE,
            first_name="Omar",
            last_name="PLD"
        )

        # 7. Product Manager (Tier 3)
        self.product_manager = User.objects.create_user(
            email="pm.studio@texol.sa",
            username="pm.studio",
            password="SecurePassword123!",
            role=UserRole.PRODUCT_MANAGER,
            first_name="Reem",
            last_name="Product"
        )

        # 8. Finance (Tier 3)
        self.finance_user = User.objects.create_user(
            email="finance.auditor@texol.sa",
            username="finance.auditor",
            password="SecurePassword123!",
            role=UserRole.FINANCE,
            first_name="Huda",
            last_name="Finance"
        )

        # 9. Partner Organization 1 & Partner User (Tier 4)
        self.partner_acc_1 = Account.objects.create(
            company_name="CloudBridge Arabia",
            account_type=AccountType.PARTNER,
            country="Saudi Arabia"
        )
        self.partner_1 = Partner.objects.create(
            account=self.partner_acc_1,
            partner_code="PTR-CBA-01",
            status="ACTIVE",
            partner_type="INTEGRATOR",
            territory="Saudi Arabia"
        )
        self.partner_user_1 = User.objects.create_user(
            email="user@cloudbridge.sa",
            username="user.cloudbridge",
            password="SecurePassword123!",
            role=UserRole.PARTNER_USER,
            first_name="Partner",
            last_name="Alpha",
            is_partner_user=True
        )
        PartnerUser.objects.create(
            partner=self.partner_1,
            user=self.partner_user_1,
            partner_role="SALES",
            is_active=True
        )

        # 10. Partner Organization 2 & Partner User (Tier 4)
        self.partner_acc_2 = Account.objects.create(
            company_name="Delta Tech Solutions",
            account_type=AccountType.PARTNER,
            country="UAE"
        )
        self.partner_2 = Partner.objects.create(
            account=self.partner_acc_2,
            partner_code="PTR-DTS-02",
            status="ACTIVE",
            partner_type="RESELLER",
            territory="UAE"
        )
        self.partner_user_2 = User.objects.create_user(
            email="user@deltatech.ae",
            username="user.deltatech",
            password="SecurePassword123!",
            role=UserRole.PARTNER_USER,
            first_name="Partner",
            last_name="Beta",
            is_partner_user=True
        )
        PartnerUser.objects.create(
            partner=self.partner_2,
            user=self.partner_user_2,
            partner_role="SALES",
            is_active=True
        )

        # Business records for data scoping tests
        self.client_acc_a = Account.objects.create(
            company_name="Al-Rashid Food Industries",
            account_type=AccountType.PROSPECT,
            primary_owner=self.sales_rep_a,
            city="Riyadh"
        )
        self.client_acc_b = Account.objects.create(
            company_name="Gulf Logistics Group",
            account_type=AccountType.PROSPECT,
            primary_owner=self.sales_rep_b,
            city="Dammam"
        )

        self.lead_a = Lead.objects.create(
            account=self.client_acc_a,
            primary_product=self.product,
            owner=self.sales_rep_a,
            status=LeadStatus.ACTIVE
        )
        self.lead_b = Lead.objects.create(
            account=self.client_acc_b,
            primary_product=self.product,
            owner=self.sales_rep_b,
            status=LeadStatus.ACTIVE
        )

    # =========================================================================
    # A. AUTHENTICATION TESTS
    # =========================================================================

    def test_valid_login_returns_jwt_and_canonical_role(self):
        """Valid login issues access and refresh tokens and returns canonical user profile."""
        response = self.client.post('/api/v1/auth/token/', {
            'username': 'admin.security',
            'password': 'SecurePassword123!'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['canonical_role'], 'ADMIN')
        self.assertEqual(response.data['user']['email'], 'admin.security@texol.sa')

    def test_invalid_credentials_rejected(self):
        """Invalid credentials return 401 Unauthorized."""
        response = self.client.post('/api/v1/auth/token/', {
            'username': 'admin.security',
            'password': 'WrongPassword999!'
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_inactive_user_cannot_login(self):
        """Deactivated accounts cannot authenticate."""
        self.sales_rep_a.is_active = False
        self.sales_rep_a.save()

        response = self.client.post('/api/v1/auth/token/', {
            'username': 'rep.central',
            'password': 'SecurePassword123!'
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unauthenticated_request_returns_401(self):
        """Protected endpoints reject unauthenticated requests."""
        response = self.client.get('/api/v1/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_jwt_token_refresh(self):
        """Valid refresh token issues a new access token."""
        login_res = self.client.post('/api/v1/auth/token/', {
            'username': 'rep.central',
            'password': 'SecurePassword123!'
        })
        refresh_token = login_res.data['refresh']

        refresh_res = self.client.post('/api/v1/auth/token/refresh/', {
            'refresh': refresh_token
        })
        self.assertEqual(refresh_res.status_code, status.HTTP_200_OK)
        self.assertIn('access', refresh_res.data)

    def test_logout_blacklists_refresh_token(self):
        """Logout invalidates refresh token in blacklist."""
        login_res = self.client.post('/api/v1/auth/token/', {
            'username': 'rep.central',
            'password': 'SecurePassword123!'
        })
        access_token = login_res.data['access']
        refresh_token = login_res.data['refresh']

        # Logout with access token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        logout_res = self.client.post('/api/v1/auth/logout/', {
            'refresh': refresh_token
        })
        self.assertEqual(logout_res.status_code, status.HTTP_200_OK)

        # Attempting to use blacklisted refresh token must fail
        self.client.credentials()
        bad_refresh = self.client.post('/api/v1/auth/token/refresh/', {
            'refresh': refresh_token
        })
        self.assertEqual(bad_refresh.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_password_change_enforces_current_password(self):
        """Password change requires valid current password and applies update."""
        self.client.force_authenticate(user=self.sales_rep_a)
        # Bad current password
        bad_res = self.client.post('/api/v1/auth/password-change/', {
            'current_password': 'IncorrectPassword',
            'new_password': 'BrandNewPassword123!'
        })
        self.assertEqual(bad_res.status_code, status.HTTP_400_BAD_REQUEST)

        # Correct current password
        good_res = self.client.post('/api/v1/auth/password-change/', {
            'current_password': 'SecurePassword123!',
            'new_password': 'BrandNewPassword123!'
        })
        self.assertEqual(good_res.status_code, status.HTTP_200_OK)

        # Verify authentication with new password succeeds
        self.client.credentials()
        new_login = self.client.post('/api/v1/auth/token/', {
            'username': 'rep.central',
            'password': 'BrandNewPassword123!'
        })
        self.assertEqual(new_login.status_code, status.HTTP_200_OK)

    # =========================================================================
    # B. ROLE & PRIVILEGE ESCALATION PROTECTION TESTS
    # =========================================================================

    def test_ordinary_user_cannot_create_staff_users(self):
        """Non-admin users cannot create staff users (403 Forbidden)."""
        self.client.force_authenticate(user=self.sales_rep_a)
        response = self.client.post('/api/v1/admin/staff/', {
            'email': 'hacker@texol.sa',
            'first_name': 'Evil',
            'last_name': 'Attacker',
            'role': 'ADMIN',
            'password': 'Password123!'
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_ordinary_user_cannot_elevate_own_role(self):
        """Ordinary users cannot modify role assignments via API."""
        self.client.force_authenticate(user=self.sales_rep_a)
        response = self.client.patch(f'/api/v1/admin/staff/{self.sales_rep_a.id}/', {
            'role': 'ADMIN'
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.sales_rep_a.refresh_from_db()
        self.assertEqual(self.sales_rep_a.canonical_role, 'SALES_BDM')

    def test_admin_can_create_and_update_staff_roles(self):
        """Only Platform Admin can create and modify user roles."""
        self.client.force_authenticate(user=self.admin_user)
        create_res = self.client.post('/api/v1/admin/staff/', {
            'email': 'new.consultant@texol.sa',
            'first_name': 'Bilal',
            'last_name': 'Consultant',
            'role': 'SOLUTION_CONSULTANT',
            'password': 'InitialPassword123!'
        })
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        new_user_id = create_res.data['user']['id']

        # Update role to SALES_MANAGER
        update_res = self.client.patch(f'/api/v1/admin/staff/{new_user_id}/', {
            'role': 'SALES_MANAGER',
            'territory': 'Jeddah / Western'
        })
        self.assertEqual(update_res.status_code, status.HTTP_200_OK)
        self.assertEqual(update_res.data['user']['canonical_role'], 'SALES_MANAGER')

    # =========================================================================
    # C. DATA ISOLATION (4 TIERS) & IDOR PROTECTION TESTS
    # =========================================================================

    def test_tier_1_admin_has_global_visibility(self):
        """Tier 1 Admin sees records across all territories and owners."""
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/v1/accounts/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        account_ids = [a['id'] for a in res.data.get('results', [])]
        self.assertIn(str(self.client_acc_a.id), account_ids)
        self.assertIn(str(self.client_acc_b.id), account_ids)

    def test_tier_2_sales_manager_scoped_to_territory_and_reports(self):
        """Tier 2 Sales Manager accesses direct reports and territory records."""
        self.client.force_authenticate(user=self.sales_manager)
        res = self.client.get('/api/v1/accounts/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        account_ids = [a['id'] for a in res.data.get('results', [])]
        # Central Region account (direct report) is visible
        self.assertIn(str(self.client_acc_a.id), account_ids)
        # Eastern Region account (different territory) is excluded
        self.assertNotIn(str(self.client_acc_b.id), account_ids)

    def test_tier_3_sales_rep_scoped_to_own_records(self):
        """Tier 3 Sales BDM only accesses authorized owned records."""
        self.client.force_authenticate(user=self.sales_rep_a)
        res = self.client.get('/api/v1/accounts/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        account_ids = [a['id'] for a in res.data.get('results', [])]
        self.assertIn(str(self.client_acc_a.id), account_ids)
        self.assertNotIn(str(self.client_acc_b.id), account_ids)

    def test_idor_direct_uuid_access_blocked(self):
        """Direct object reference (IDOR) to other users' records returns 404 Not Found."""
        self.client.force_authenticate(user=self.sales_rep_a)
        # Attempting to fetch client_acc_b (owned by sales_rep_b in Eastern region)
        response = self.client.get(f'/api/v1/accounts/{self.client_acc_b.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_tier_4_partner_isolated_to_own_organization(self):
        """Tier 4 Partner Users only access records belonging to their partner."""
        # Create deal registrations for both partners
        reg_1 = DealRegistration.objects.create(
            partner=self.partner_1,
            customer_account=self.client_acc_a,
            product=self.product,
            registered_by=self.partner_user_1,
            territory="Saudi Arabia",
            expected_deal_value=Decimal('50000.00'),
            status=DealRegistrationStatus.SUBMITTED
        )
        reg_2 = DealRegistration.objects.create(
            partner=self.partner_2,
            customer_account=self.client_acc_b,
            product=self.product,
            registered_by=self.partner_user_2,
            territory="UAE",
            expected_deal_value=Decimal('75000.00'),
            status=DealRegistrationStatus.SUBMITTED
        )

        self.client.force_authenticate(user=self.partner_user_1)
        res = self.client.get('/api/v1/deal-registrations/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        reg_ids = [r['id'] for r in res.data.get('results', [])]
        self.assertIn(str(reg_1.id), reg_ids)
        self.assertNotIn(str(reg_2.id), reg_ids)

        # IDOR attempt by Partner 1 on Partner 2's deal returns 404
        idor_res = self.client.get(f'/api/v1/deal-registrations/{reg_2.id}/')
        self.assertEqual(idor_res.status_code, status.HTTP_404_NOT_FOUND)

    # =========================================================================
    # D. SECTION 9.5 APPROVAL & GOVERNANCE WORKFLOW TESTS
    # =========================================================================

    def test_commercial_discount_thresholds(self):
        """
        Section 9.5 A Discount Governance:
        - <= 15.00%: Sales BDM / AE self-approved
        - <= 25.00%: Sales Manager approval
        - > 25.00%: Executive approval (Management / Admin with mandatory justification)
        """
        opp = Opportunity.objects.create(
            account=self.client_acc_a,
            product=self.product,
            owner=self.sales_rep_a,
            total_contract_value=Decimal('10000.00')
        )
        proposal = Proposal.objects.create(
            opportunity=opp,
            account=self.client_acc_a,
            proposal_number="PROP-TEST-001",
            owner=self.sales_rep_a,
            gross_amount=Decimal('10000.00'),
            net_amount=Decimal('8500.00')
        )
        # Version with 15.00% discount
        v_15 = ProposalVersion.objects.create(
            proposal=proposal,
            version_number=1,
            gross_amount=Decimal('10000.00'),
            discount_pct=Decimal('15.00'),
            discount_amount=Decimal('1500.00'),
            net_amount=Decimal('8500.00'),
            status=ProposalStatus.DRAFT
        )

        # 1. Sales rep self-approval succeeds at exactly 15.00%
        self.client.force_authenticate(user=self.sales_rep_a)
        res_15 = self.client.post(f'/api/v1/proposals/{proposal.id}/approve/', {
            'version_number': 1
        })
        self.assertEqual(res_15.status_code, status.HTTP_200_OK)

        # Version with 20.00% discount (> 15% but <= 25%)
        v_20 = ProposalVersion.objects.create(
            proposal=proposal,
            version_number=2,
            gross_amount=Decimal('10000.00'),
            discount_pct=Decimal('20.00'),
            discount_amount=Decimal('2000.00'),
            net_amount=Decimal('8000.00'),
            status=ProposalStatus.PENDING_APPROVAL
        )

        # 2. Sales rep approval FAILS for 20% discount (403 Forbidden)
        res_20_rep = self.client.post(f'/api/v1/proposals/{proposal.id}/approve/', {
            'version_number': 2
        })
        self.assertEqual(res_20_rep.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Sales Manager approval SUCCEEDS for 20% discount
        self.client.force_authenticate(user=self.sales_manager)
        res_20_mgr = self.client.post(f'/api/v1/proposals/{proposal.id}/approve/', {
            'version_number': 2
        })
        self.assertEqual(res_20_mgr.status_code, status.HTTP_200_OK)

        # Version with 30.00% discount (> 25.00%)
        v_30 = ProposalVersion.objects.create(
            proposal=proposal,
            version_number=3,
            gross_amount=Decimal('10000.00'),
            discount_pct=Decimal('30.00'),
            discount_amount=Decimal('3000.00'),
            net_amount=Decimal('7000.00'),
            status=ProposalStatus.PENDING_APPROVAL
        )

        # 4. Sales Manager approval FAILS for 30% discount (403 Forbidden)
        res_30_mgr = self.client.post(f'/api/v1/proposals/{proposal.id}/approve/', {
            'version_number': 3,
            'comments': 'Manager approval attempt'
        })
        self.assertEqual(res_30_mgr.status_code, status.HTTP_403_FORBIDDEN)

        # 5. Executive approval WITHOUT comments FAILS (400 Bad Request)
        self.client.force_authenticate(user=self.mgmt_user)
        res_30_no_just = self.client.post(f'/api/v1/proposals/{proposal.id}/approve/', {
            'version_number': 3,
            'comments': ''
        })
        self.assertEqual(res_30_no_just.status_code, status.HTTP_400_BAD_REQUEST)

        # 6. Executive approval WITH comments SUCCEEDS
        res_30_exec = self.client.post(f'/api/v1/proposals/{proposal.id}/approve/', {
            'version_number': 3,
            'comments': 'Executive discount authorized based on multi-year strategic enterprise commitment.'
        })
        self.assertEqual(res_30_exec.status_code, status.HTTP_200_OK)

    def test_mandatory_stage_gate_overrides(self):
        """Frontline users cannot override stage gates; Sales Manager / Admin require justification."""
        opp = Opportunity.objects.create(
            account=self.client_acc_a,
            product=self.product,
            owner=self.sales_rep_a
        )
        config = ProductConfigurationVersion.objects.create(
            product=self.product,
            version_number=1,
            status="DRAFT"
        )
        from apps.pld_engine.models import PipelineStage
        stage_1 = PipelineStage.objects.create(
            config_version=config,
            stage_name="Stage 1",
            stage_code="S1",
            sequence_order=1
        )
        stage_3 = PipelineStage.objects.create(
            config_version=config,
            stage_name="Stage 3",
            stage_code="S3",
            sequence_order=3
        )
        opp.stage = stage_1
        opp.save()

        # Frontline rep attempt to override fails with 403 Forbidden
        self.client.force_authenticate(user=self.sales_rep_a)
        res_rep = self.client.post(f'/api/v1/opportunities/{opp.id}/transition-stage/', {
            'target_stage_id': str(stage_3.id),
            'is_override': True,
            'reason': 'Rep bypass attempt'
        })
        self.assertEqual(res_rep.status_code, status.HTTP_403_FORBIDDEN)

        # Sales Manager override without reason fails with 400 Bad Request
        self.client.force_authenticate(user=self.sales_manager)
        res_mgr_no_reason = self.client.post(f'/api/v1/opportunities/{opp.id}/transition-stage/', {
            'target_stage_id': str(stage_3.id),
            'is_override': True,
            'reason': ''
        })
        self.assertEqual(res_mgr_no_reason.status_code, status.HTTP_400_BAD_REQUEST)

        # Sales Manager override with justification succeeds
        res_mgr_ok = self.client.post(f'/api/v1/opportunities/{opp.id}/transition-stage/', {
            'target_stage_id': str(stage_3.id),
            'is_override': True,
            'reason': 'Fast-track pilot approved for strategic client.'
        })
        self.assertEqual(res_mgr_ok.status_code, status.HTTP_200_OK)

    def test_product_configuration_publishing_permissions(self):
        """Only Product Manager and Admin can publish configurations."""
        config = ProductConfigurationVersion.objects.create(
            product=self.product,
            version_number=2,
            notes="v2.0-Summer",
            status="DRAFT"
        )

        # Sales rep publishing fails (403 Forbidden)
        self.client.force_authenticate(user=self.sales_rep_a)
        res_rep = self.client.post(f'/api/v1/product-configs/{config.id}/publish/')
        self.assertEqual(res_rep.status_code, status.HTTP_403_FORBIDDEN)

        # Product Manager publishing succeeds
        self.client.force_authenticate(user=self.product_manager)
        res_pm = self.client.post(f'/api/v1/product-configs/{config.id}/publish/')
        self.assertEqual(res_pm.status_code, status.HTTP_200_OK)
        config.refresh_from_db()
        self.assertEqual(config.status, "PUBLISHED")

    def test_erp_synchronization_authority(self):
        """Only Admin and Finance roles can trigger ERP sync."""
        connector = ERPConnectorConfig.objects.create(
            system_name="Odoo 17 Enterprise",
            system_type="ODOO",
            base_endpoint="https://odoo.texol.sa/api",
            is_active=True
        )

        # Sales rep attempt to sync account fails (403 Forbidden)
        self.client.force_authenticate(user=self.sales_rep_a)
        res_rep = self.client.post(f'/api/v1/erp-connectors/{connector.id}/sync-account/', {
            'account_id': str(self.client_acc_a.id)
        })
        self.assertEqual(res_rep.status_code, status.HTTP_403_FORBIDDEN)

        # Finance user attempt succeeds
        self.client.force_authenticate(user=self.finance_user)
        res_fin = self.client.post(f'/api/v1/erp-connectors/{connector.id}/sync-account/', {
            'account_id': str(self.client_acc_a.id)
        })
        self.assertEqual(res_fin.status_code, status.HTTP_200_OK)

    # =========================================================================
    # E. TERRITORY MANAGEMENT & REGIONAL LEAD SCOPING TESTS
    # =========================================================================

    def test_territory_management_and_regional_manager_assignment(self):
        """Admin can create territories, assign regional sales managers, and list dropdowns."""
        self.client.force_authenticate(user=self.admin_user)

        # 1. Admin creates a new territory
        res = self.client.post('/api/v1/territories/', {
            'name': 'Southern Province KSA',
            'country': 'Saudi Arabia',
            'description': 'Southern territory covering Abha and Jazan',
            'regional_manager': str(self.sales_manager.id)
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['name'], 'Southern Province KSA')
        self.assertEqual(str(res.data['regional_manager']), str(self.sales_manager.id))

        # Manager user territory is synchronized
        self.sales_manager.refresh_from_db()
        self.assertEqual(self.sales_manager.territory, 'Southern Province KSA')

        # 2. Ordinary sales rep cannot create territory
        self.client.force_authenticate(user=self.sales_rep_a)
        res_fail = self.client.post('/api/v1/territories/', {
            'name': 'Unauthorized Territory'
        })
        self.assertEqual(res_fail.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Authenticated users can list territories for dropdown
        res_list = self.client.get('/api/v1/territories/')
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        terr_names = [t['name'] for t in res_list.data.get('results', res_list.data)]
        self.assertIn('Southern Province KSA', terr_names)

    def test_sales_manager_strictly_isolated_to_assigned_territory_leads(self):
        """Sales Manager can ONLY see leads from their assigned territory."""
        # Setup: Ensure sales_manager has territory "Riyadh / Central"
        self.sales_manager.territory = "Riyadh / Central"
        self.sales_manager.save(update_fields=['territory'])

        # Create Lead 1 in Central territory
        lead_central = Lead.objects.create(
            account=self.client_acc_a,
            primary_product=self.product,
            owner=self.sales_rep_a,
            territory="Riyadh / Central",
            status=LeadStatus.ACTIVE
        )

        # Create Lead 2 in Eastern territory
        lead_eastern = Lead.objects.create(
            account=self.client_acc_b,
            primary_product=self.product,
            owner=self.sales_rep_b,
            territory="Dammam / Eastern",
            status=LeadStatus.ACTIVE
        )

        # Authenticate as Central Sales Manager
        self.client.force_authenticate(user=self.sales_manager)
        res = self.client.get('/api/v1/leads/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        returned_ids = [str(l['id']) for l in res.data.get('results', [])]

        # Central lead is visible
        self.assertIn(str(lead_central.id), returned_ids)
        # Eastern lead is strictly excluded
        self.assertNotIn(str(lead_eastern.id), returned_ids)

        # Direct access to Eastern lead returns 404 Not Found
        res_direct = self.client.get(f'/api/v1/leads/{lead_eastern.id}/')
        self.assertEqual(res_direct.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_lead_filtering_by_region(self):
        """Admin can filter leads by territory / region query parameter."""
        lead_central = Lead.objects.create(
            account=self.client_acc_a,
            primary_product=self.product,
            owner=self.sales_rep_a,
            territory="Riyadh / Central",
            status=LeadStatus.ACTIVE
        )
        lead_eastern = Lead.objects.create(
            account=self.client_acc_b,
            primary_product=self.product,
            owner=self.sales_rep_b,
            territory="Dammam / Eastern",
            status=LeadStatus.ACTIVE
        )

        self.client.force_authenticate(user=self.admin_user)

        # Filter by region=Riyadh / Central
        res_central = self.client.get('/api/v1/leads/?region=Riyadh / Central')
        self.assertEqual(res_central.status_code, status.HTTP_200_OK)
        central_ids = [str(l['id']) for l in res_central.data.get('results', [])]
        self.assertIn(str(lead_central.id), central_ids)
        self.assertNotIn(str(lead_eastern.id), central_ids)

        # Filter by territory=Dammam / Eastern
        res_eastern = self.client.get('/api/v1/leads/?territory=Dammam / Eastern')
        self.assertEqual(res_eastern.status_code, status.HTTP_200_OK)
        eastern_ids = [str(l['id']) for l in res_eastern.data.get('results', [])]
        self.assertIn(str(lead_eastern.id), eastern_ids)
        self.assertNotIn(str(lead_central.id), eastern_ids)

    def test_salesman_cannot_reassign_lead_but_manager_and_admin_can(self):
        """
        Enforce Section 9.3 RBAC:
        Sales representatives (SALES_BDM / AE) cannot reassign leads.
        Only Sales Managers and Administrators have authority to reassign leads.
        """
        lead = Lead.objects.create(
            account=self.client_acc_a,
            primary_product=self.product,
            owner=self.sales_rep_a,
            territory="Riyadh / Central",
            status=LeadStatus.ACTIVE
        )

        # 1. Sales rep A attempts to reassign lead via assign-sales endpoint -> 403 Forbidden
        self.client.force_authenticate(user=self.sales_rep_a)
        res_rep_assign = self.client.post(f'/api/v1/leads/{lead.id}/assign-sales/', {
            'sales_user_id': str(self.sales_rep_b.id),
            'notes': 'Attempted reassignment by salesman'
        })
        self.assertEqual(res_rep_assign.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Permission denied", res_rep_assign.data.get('error', ''))
        lead.refresh_from_db()
        self.assertEqual(lead.owner, self.sales_rep_a)

        # 2. Sales rep A attempts to reassign lead via PATCH -> 403 Forbidden
        res_rep_patch = self.client.patch(f'/api/v1/leads/{lead.id}/', {
            'owner': str(self.sales_rep_b.id)
        })
        self.assertEqual(res_rep_patch.status_code, status.HTTP_403_FORBIDDEN)
        lead.refresh_from_db()
        self.assertEqual(lead.owner, self.sales_rep_a)

        # 3. Sales Manager reassigns lead to sales_rep_b -> 200 OK
        self.client.force_authenticate(user=self.sales_manager)
        res_mgr_assign = self.client.post(f'/api/v1/leads/{lead.id}/assign-sales/', {
            'sales_user_id': str(self.sales_rep_b.id),
            'notes': 'Manager authorized lead reassignment'
        })
        self.assertEqual(res_mgr_assign.status_code, status.HTTP_200_OK)
        lead.refresh_from_db()
        self.assertEqual(lead.owner, self.sales_rep_b)

        # 4. Administrator reassigns lead back to sales_rep_a -> 200 OK
        self.client.force_authenticate(user=self.admin_user)
        res_admin_assign = self.client.post(f'/api/v1/leads/{lead.id}/assign-sales/', {
            'sales_user_id': str(self.sales_rep_a.id),
            'notes': 'Admin override reassignment'
        })
        self.assertEqual(res_admin_assign.status_code, status.HTTP_200_OK)
        lead.refresh_from_db()
        self.assertEqual(lead.owner, self.sales_rep_a)

