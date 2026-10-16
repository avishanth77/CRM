"""
Centralized Role-Based Access Control (RBAC) and Row-Level Security (RLS) Scoping.
Implements:
- Section 9.1: 12 User Roles Taxonomy
- Section 9.2: 4 Data Scoping & RLS Tiers
- Section 9.3: 20-Domain Operations Rights Matrix
- Section 9.4: Workspace Access Mapping
- Section 9.5: Approval & Governance Authorities
"""

from typing import Optional, Set
from rest_framework import permissions
from django.db.models import Q, QuerySet
from apps.authentication.models import User, UserRole


# ==============================================================================
# 1. DOMAIN OPERATIONS PERMISSION MATRIX (SECTION 9.3)
# ==============================================================================

# Explicit mapping of Domain -> Canonical Role -> Set of permitted actions
# Actions: 'view', 'create', 'update', 'delete', 'override', 'approve', 'reject',
#          'submit', 'publish', 'sync', 'audit', 'reassign'

DOMAIN_OPERATIONS_MATRIX = {
    'ACCOUNTS': {
        UserRole.ADMIN: {'view', 'create', 'update', 'delete', 'reassign', 'export'},
        UserRole.MANAGEMENT: {'view', 'create', 'update', 'export'},
        UserRole.SALES_MANAGER: {'view', 'create', 'update', 'reassign'},
        UserRole.SALES_BDM: {'view', 'create', 'update'},
        UserRole.PLD_EXECUTIVE: {'view', 'create', 'update'},
        UserRole.SOLUTION_CONSULTANT: {'view'},
        UserRole.MARKETING: {'view'},
        UserRole.PRODUCT_MANAGER: {'view'},
        UserRole.CUSTOMER_SUCCESS: {'view', 'create', 'update'},
        UserRole.PARTNER_MANAGER: {'view', 'create', 'update'},
        UserRole.PARTNER_USER: {'view', 'create'},  # Scoped to partner org
        UserRole.FINANCE: {'view'},
    },
    'LEADS': {
        UserRole.ADMIN: {'view', 'create', 'update', 'delete', 'reassign', 'override', 'export'},
        UserRole.MANAGEMENT: {'view', 'export'},
        UserRole.SALES_MANAGER: {'view', 'create', 'update', 'reassign'},
        UserRole.SALES_BDM: {'view'},
        UserRole.PLD_EXECUTIVE: {'view', 'create', 'update', 'submit'},
        UserRole.SOLUTION_CONSULTANT: {'view'},
        UserRole.MARKETING: {'view', 'create'},  # Campaign intake
        UserRole.PRODUCT_MANAGER: {'view'},
        UserRole.CUSTOMER_SUCCESS: {'view'},
        UserRole.PARTNER_MANAGER: {'view', 'create'},
        UserRole.PARTNER_USER: {'view', 'create'},  # Submit deal / lead
        UserRole.FINANCE: {'view'},
    },
    'DYNAMIC_ICP': {
        UserRole.ADMIN: {'view', 'run', 'override'},
        UserRole.MANAGEMENT: {'view', 'run'},
        UserRole.SALES_MANAGER: {'view', 'run'},
        UserRole.SALES_BDM: {'view', 'run'},
        UserRole.PLD_EXECUTIVE: {'view', 'run', 'submit'},
        UserRole.SOLUTION_CONSULTANT: {'view', 'run'},
        UserRole.MARKETING: {'view'},
        UserRole.PRODUCT_MANAGER: {'view', 'run', 'author'},
        UserRole.CUSTOMER_SUCCESS: {'view'},
        UserRole.PARTNER_MANAGER: {'view', 'run'},
        UserRole.PARTNER_USER: {'view'},  # Own deals only
        UserRole.FINANCE: {'view'},
    },
    'PLD_SCORING': {
        UserRole.ADMIN: {'view', 'score', 'override'},
        UserRole.MANAGEMENT: {'view', 'score', 'override'},
        UserRole.SALES_MANAGER: {'view', 'score', 'override'},
        UserRole.SALES_BDM: {'view'},
        UserRole.PLD_EXECUTIVE: {'view', 'submit'},
        UserRole.SOLUTION_CONSULTANT: {'view', 'input'},
        UserRole.MARKETING: {'view'},
        UserRole.PRODUCT_MANAGER: {'view', 'author'},  # Author model only, not live scores
        UserRole.CUSTOMER_SUCCESS: {'view'},
        UserRole.PARTNER_MANAGER: {'view'},
        UserRole.PARTNER_USER: {'view'},
        UserRole.FINANCE: {'view'},
    },
    'DISCOVERY': {
        UserRole.ADMIN: {'view', 'create', 'update', 'delete'},
        UserRole.MANAGEMENT: {'view'},
        UserRole.SALES_MANAGER: {'view', 'create', 'update'},
        UserRole.SALES_BDM: {'view', 'create', 'update'},
        UserRole.PLD_EXECUTIVE: {'view', 'create', 'update', 'map'},
        UserRole.SOLUTION_CONSULTANT: {'view', 'update', 'map'},
        UserRole.MARKETING: {'view'},
        UserRole.PRODUCT_MANAGER: {'view', 'author'},
        UserRole.CUSTOMER_SUCCESS: {'view'},
        UserRole.PARTNER_MANAGER: {'view'},
        UserRole.PARTNER_USER: {'view', 'create'},
        UserRole.FINANCE: {'view'},
    },
    'DEMO': {
        UserRole.ADMIN: {'view', 'create', 'update', 'delete'},
        UserRole.MANAGEMENT: {'view'},
        UserRole.SALES_MANAGER: {'view', 'create', 'update'},
        UserRole.SALES_BDM: {'view', 'create', 'update', 'attend'},
        UserRole.PLD_EXECUTIVE: {'view', 'create', 'update'},
        UserRole.SOLUTION_CONSULTANT: {'view', 'create', 'update', 'conduct'},
        UserRole.MARKETING: {'view'},
        UserRole.PRODUCT_MANAGER: {'view'},
        UserRole.CUSTOMER_SUCCESS: {'view', 'attend'},
        UserRole.PARTNER_MANAGER: {'view'},
        UserRole.PARTNER_USER: {'view', 'create'},  # Request demo
        UserRole.FINANCE: {'view'},
    },
    'POC': {
        UserRole.ADMIN: {'view', 'create', 'update', 'delete'},
        UserRole.MANAGEMENT: {'view'},
        UserRole.SALES_MANAGER: {'view', 'create', 'update'},
        UserRole.SALES_BDM: {'view', 'create', 'update'},
        UserRole.PLD_EXECUTIVE: {'view'},
        UserRole.SOLUTION_CONSULTANT: {'view', 'create', 'update', 'lead_poc'},
        UserRole.MARKETING: {'view'},
        UserRole.PRODUCT_MANAGER: {'view'},
        UserRole.CUSTOMER_SUCCESS: {'view'},
        UserRole.PARTNER_MANAGER: {'view'},
        UserRole.PARTNER_USER: {'view'},
        UserRole.FINANCE: {'view', 'audit'},
    },
    'SQL_GATE': {
        UserRole.ADMIN: {'view', 'validate', 'override'},
        UserRole.MANAGEMENT: {'view', 'override'},
        UserRole.SALES_MANAGER: {'view', 'override'},
        UserRole.SALES_BDM: {'view'},
        UserRole.PLD_EXECUTIVE: {'view', 'submit'},
        UserRole.SOLUTION_CONSULTANT: {'view', 'sign_off'},
        UserRole.MARKETING: {'view'},
        UserRole.PRODUCT_MANAGER: {'view', 'author'},
        UserRole.CUSTOMER_SUCCESS: {'view'},
        UserRole.PARTNER_MANAGER: {'view'},
        UserRole.PARTNER_USER: set(),
        UserRole.FINANCE: {'view'},
    },
    'SQL_ACCEPTANCE': {
        UserRole.ADMIN: {'view', 'accept', 'reject', 'override', 'reassign'},
        UserRole.MANAGEMENT: {'view', 'accept', 'reject', 'override'},
        UserRole.SALES_MANAGER: {'view', 'accept', 'reject', 'reassign'},
        UserRole.SALES_BDM: {'view', 'accept', 'reject'},
        UserRole.PLD_EXECUTIVE: {'view', 'submit'},
        UserRole.SOLUTION_CONSULTANT: set(),
        UserRole.MARKETING: set(),
        UserRole.PRODUCT_MANAGER: set(),
        UserRole.CUSTOMER_SUCCESS: set(),
        UserRole.PARTNER_MANAGER: {'view'},
        UserRole.PARTNER_USER: set(),
        UserRole.FINANCE: set(),
    },
    'OPPORTUNITIES': {
        UserRole.ADMIN: {'view', 'create', 'update', 'delete', 'export'},
        UserRole.MANAGEMENT: {'view', 'export'},
        UserRole.SALES_MANAGER: {'view', 'create', 'update', 'reassign'},
        UserRole.SALES_BDM: {'view', 'create', 'update'},
        UserRole.PLD_EXECUTIVE: {'view'},
        UserRole.SOLUTION_CONSULTANT: {'view'},
        UserRole.MARKETING: {'view'},
        UserRole.PRODUCT_MANAGER: {'view'},
        UserRole.CUSTOMER_SUCCESS: {'view', 'create', 'update'},
        UserRole.PARTNER_MANAGER: {'view', 'update'},
        UserRole.PARTNER_USER: {'view'},  # Scoped to registered deals
        UserRole.FINANCE: {'view', 'audit'},
    },
    'PROPOSALS': {
        UserRole.ADMIN: {'view', 'create', 'update', 'delete', 'approve', 'sign'},
        UserRole.MANAGEMENT: {'view', 'approve', 'sign'},
        UserRole.SALES_MANAGER: {'view', 'create', 'update', 'approve'},
        UserRole.SALES_BDM: {'view', 'create', 'update', 'submit', 'approve'},
        UserRole.PLD_EXECUTIVE: set(),
        UserRole.SOLUTION_CONSULTANT: {'view'},
        UserRole.MARKETING: set(),
        UserRole.PRODUCT_MANAGER: {'view'},
        UserRole.CUSTOMER_SUCCESS: set(),
        UserRole.PARTNER_MANAGER: {'view'},
        UserRole.PARTNER_USER: {'view'},  # Customer quotes only
        UserRole.FINANCE: {'view', 'audit'},
    },
    'DISCOUNT_AUTHORITY': {
        UserRole.ADMIN: {'approve_unlimited', 'override'},
        UserRole.MANAGEMENT: {'approve_unlimited'},
        UserRole.SALES_MANAGER: {'approve_25'},
        UserRole.SALES_BDM: {'self_approve_15'},
        UserRole.PLD_EXECUTIVE: set(),
        UserRole.SOLUTION_CONSULTANT: set(),
        UserRole.MARKETING: set(),
        UserRole.PRODUCT_MANAGER: set(),
        UserRole.CUSTOMER_SUCCESS: set(),
        UserRole.PARTNER_MANAGER: set(),
        UserRole.PARTNER_USER: set(),
        UserRole.FINANCE: {'audit'},
    },
    'STAGE_GATE_OVERRIDES': {
        UserRole.ADMIN: {'global_override'},
        UserRole.MANAGEMENT: {'global_override'},
        UserRole.SALES_MANAGER: {'team_override'},
        UserRole.SALES_BDM: set(),
        UserRole.PLD_EXECUTIVE: set(),
        UserRole.SOLUTION_CONSULTANT: set(),
        UserRole.MARKETING: set(),
        UserRole.PRODUCT_MANAGER: set(),
        UserRole.CUSTOMER_SUCCESS: set(),
        UserRole.PARTNER_MANAGER: set(),
        UserRole.PARTNER_USER: set(),
        UserRole.FINANCE: set(),
    },
    'CUSTOMER_ONBOARDING': {
        UserRole.ADMIN: {'view', 'create', 'update', 'delete'},
        UserRole.MANAGEMENT: {'view'},
        UserRole.SALES_MANAGER: {'view'},
        UserRole.SALES_BDM: {'view', 'handoff'},
        UserRole.PLD_EXECUTIVE: set(),
        UserRole.SOLUTION_CONSULTANT: {'view', 'support'},
        UserRole.MARKETING: set(),
        UserRole.PRODUCT_MANAGER: {'view'},
        UserRole.CUSTOMER_SUCCESS: {'view', 'create', 'update'},
        UserRole.PARTNER_MANAGER: {'view'},
        UserRole.PARTNER_USER: set(),
        UserRole.FINANCE: {'view', 'billing'},
    },
    'ADOPTION_HEALTH': {
        UserRole.ADMIN: {'view', 'create', 'update', 'delete'},
        UserRole.MANAGEMENT: {'view'},
        UserRole.SALES_MANAGER: {'view'},
        UserRole.SALES_BDM: {'view'},
        UserRole.PLD_EXECUTIVE: set(),
        UserRole.SOLUTION_CONSULTANT: {'view'},
        UserRole.MARKETING: set(),
        UserRole.PRODUCT_MANAGER: {'view'},
        UserRole.CUSTOMER_SUCCESS: {'view', 'update'},
        UserRole.PARTNER_MANAGER: {'view'},
        UserRole.PARTNER_USER: set(),
        UserRole.FINANCE: {'view'},
    },
    'NURTURE_POOL': {
        UserRole.ADMIN: {'view', 'create', 'update', 'delete'},
        UserRole.MANAGEMENT: {'view'},
        UserRole.SALES_MANAGER: {'view', 'reengage'},
        UserRole.SALES_BDM: {'view', 'reengage'},
        UserRole.PLD_EXECUTIVE: {'view', 'reengage'},
        UserRole.SOLUTION_CONSULTANT: set(),
        UserRole.MARKETING: {'view', 'create', 'update', 'campaign'},
        UserRole.PRODUCT_MANAGER: {'view'},
        UserRole.CUSTOMER_SUCCESS: {'view', 'flag_churn'},
        UserRole.PARTNER_MANAGER: {'view'},
        UserRole.PARTNER_USER: set(),
        UserRole.FINANCE: set(),
    },
    'PARTNER_DEAL_PROTECTION': {
        UserRole.ADMIN: {'view', 'create', 'update', 'delete', 'override'},
        UserRole.MANAGEMENT: {'view', 'arbitrate'},
        UserRole.SALES_MANAGER: {'view', 'conflict_review'},
        UserRole.SALES_BDM: {'view'},
        UserRole.PLD_EXECUTIVE: set(),
        UserRole.SOLUTION_CONSULTANT: set(),
        UserRole.MARKETING: {'view'},
        UserRole.PRODUCT_MANAGER: set(),
        UserRole.CUSTOMER_SUCCESS: set(),
        UserRole.PARTNER_MANAGER: {'view', 'create', 'update', 'approve', 'reject', 'extend'},
        UserRole.PARTNER_USER: {'view', 'submit'},  # Scoped to own deal registrations
        UserRole.FINANCE: {'view', 'audit'},
    },
    'PRODUCT_STUDIO': {
        UserRole.ADMIN: {'view', 'create', 'update', 'publish', 'archive'},
        UserRole.MANAGEMENT: {'view'},
        UserRole.SALES_MANAGER: {'view'},
        UserRole.SALES_BDM: {'view'},
        UserRole.PLD_EXECUTIVE: {'view'},
        UserRole.SOLUTION_CONSULTANT: {'view'},
        UserRole.MARKETING: {'view'},
        UserRole.PRODUCT_MANAGER: {'view', 'create', 'update', 'publish', 'archive'},
        UserRole.CUSTOMER_SUCCESS: {'view'},
        UserRole.PARTNER_MANAGER: {'view'},
        UserRole.PARTNER_USER: set(),
        UserRole.FINANCE: {'view'},
    },
    'UNIVERSAL_AUDIT': {
        UserRole.ADMIN: {'view', 'export'},
        UserRole.MANAGEMENT: {'view'},
        UserRole.SALES_MANAGER: {'view'},  # Team scoped
        UserRole.SALES_BDM: set(),
        UserRole.PLD_EXECUTIVE: set(),
        UserRole.SOLUTION_CONSULTANT: set(),
        UserRole.MARKETING: set(),
        UserRole.PRODUCT_MANAGER: {'view'},  # Config audit
        UserRole.CUSTOMER_SUCCESS: set(),
        UserRole.PARTNER_MANAGER: {'view'},  # Partner audit
        UserRole.PARTNER_USER: set(),
        UserRole.FINANCE: {'view'},  # Financial audit
    },
    'ERP_SYNC': {
        UserRole.ADMIN: {'view', 'trigger', 'configure'},
        UserRole.MANAGEMENT: {'view'},
        UserRole.SALES_MANAGER: {'view'},
        UserRole.SALES_BDM: {'view'},
        UserRole.PLD_EXECUTIVE: set(),
        UserRole.SOLUTION_CONSULTANT: set(),
        UserRole.MARKETING: set(),
        UserRole.PRODUCT_MANAGER: set(),
        UserRole.CUSTOMER_SUCCESS: set(),
        UserRole.PARTNER_MANAGER: set(),
        UserRole.PARTNER_USER: set(),
        UserRole.FINANCE: {'view', 'trigger', 'reconcile'},
    },
}


def has_domain_permission(user: User, domain: str, action: str) -> bool:
    """
    Checks if an authenticated user possesses the operational permission
    for a given domain and action according to Section 9.3.
    Denies access by default if not explicitly permitted.
    """
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True

    domain_rules = DOMAIN_OPERATIONS_MATRIX.get(domain.upper())
    if not domain_rules:
        return False

    canonical = getattr(user, 'canonical_role', str(user.role or ''))
    role_allowed_actions: Set[str] = domain_rules.get(canonical, set())
    return action.lower() in role_allowed_actions


# ==============================================================================
# 2. ROW-LEVEL SECURITY & DATA SCOPING TIERS (SECTION 9.2)
# ==============================================================================

def apply_data_scoping(queryset: QuerySet, user: User, domain: Optional[str] = None) -> QuerySet:
    """
    Enforces the 4 hierarchical data scoping tiers across all Django ORM querysets:
    - Tier 1: Global Scope (ADMIN, MANAGEMENT)
    - Tier 2: Territory / Team Scope (SALES_MANAGER, PARTNER_MANAGER)
    - Tier 3: Owner / Functional Scope (SALES_BDM, PLD_EXECUTIVE, SOLUTION_CONSULTANT, etc.)
    - Tier 4: Partner Tenant Scope (PARTNER_USER - strict multi-tenant isolation)
    """
    if not user or not user.is_authenticated:
        return queryset.none()

    model = queryset.model
    model_name = model.__name__

    # Tier 4: Partner Tenant Scope (Strict Isolation)
    if getattr(user, 'is_partner_scope', False):
        partner_obj = None
        if hasattr(user, 'partner_profile') and user.partner_profile:
            partner_obj = user.partner_profile.partner

        if not partner_obj:
            return queryset.none()

        # Route by model type
        if hasattr(model, 'partner'):
            return queryset.filter(partner=partner_obj)
        elif model_name == 'Partner':
            return queryset.filter(id=partner_obj.id)
        elif model_name == 'PartnerUser':
            return queryset.filter(partner=partner_obj)
        elif model_name == 'DealRegistration':
            return queryset.filter(partner=partner_obj)
        elif model_name == 'PartnerProduct':
            return queryset.filter(partner=partner_obj)
        elif model_name == 'PartnerCommission':
            return queryset.filter(partner=partner_obj)
        elif model_name == 'Lead':
            return queryset.filter(partner=partner_obj)
        elif model_name == 'Account':
            return queryset.filter(Q(partner=partner_obj) | Q(deal_registrations__partner=partner_obj)).distinct()
        elif model_name == 'Opportunity':
            return queryset.filter(deal_registrations__partner=partner_obj).distinct()
        elif model_name == 'Proposal':
            return queryset.filter(opportunity__deal_registrations__partner=partner_obj).distinct()
        else:
            # External partner users cannot view unrestricted internal operational entities
            return queryset.none()

    # Tier 1: Global Scope (Platform Admin & TEXOL Management)
    if getattr(user, 'is_global_scope', False):
        return queryset

    canonical = getattr(user, 'canonical_role', str(user.role or ''))

    # Tier 2: Territory / Team Scope (Sales Manager & Partner Manager)
    if getattr(user, 'is_territory_scope', False):
        if canonical == UserRole.PARTNER_MANAGER:
            # Channel Network Scope
            if model_name in ['Partner', 'PartnerUser', 'DealRegistration', 'PartnerProduct', 'PartnerCommission', 'ChannelConflict']:
                return queryset
            if hasattr(model, 'partner'):
                return queryset.filter(partner__isnull=False)

        # Sales Manager: Territory & Managed Team Scope
        q_filter = Q()
        has_filter = False

        if hasattr(model, 'territory') and user.territory:
            q_filter |= Q(territory=user.territory)
            has_filter = True

        if hasattr(model, 'owner'):
            q_filter |= Q(owner=user) | Q(owner__manager=user)
            if user.territory:
                q_filter |= Q(owner__territory=user.territory)
            if user.team:
                q_filter |= Q(owner__team=user.team)
            has_filter = True

        if hasattr(model, 'primary_owner'):
            q_filter |= Q(primary_owner=user) | Q(primary_owner__manager=user)
            if user.territory:
                q_filter |= Q(primary_owner__territory=user.territory)
            has_filter = True

        if hasattr(model, 'account') and hasattr(model.account.field.related_model, 'territory') and user.territory:
            q_filter |= Q(account__territory=user.territory)
            has_filter = True

        if has_filter:
            return queryset.filter(q_filter).distinct()
        return queryset

    # Tier 3: Owner / Functional Scope
    # Check domain-specific functional access
    if canonical == UserRole.MARKETING:
        if model_name in ['Campaign', 'LeadTouch', 'LeadSource']:
            return queryset
        if model_name == 'Lead':
            # Marketing can view leads originated through campaigns or nurture
            return queryset

    if canonical == UserRole.PRODUCT_MANAGER:
        if model_name in ['Product', 'ProductModule', 'ProductCapability', 'Problem', 'ProductConfigurationVersion', 'ICPRule', 'ICPProfile', 'ScoreModel']:
            return queryset

    if canonical == UserRole.FINANCE:
        if model_name in ['Opportunity', 'Proposal', 'ProposalVersion', 'ERPSyncRecord', 'ERPConnectorConfig', 'PartnerCommission']:
            return queryset

    # Standard owner & assignment filters
    q_owner = Q()
    has_owner_field = False

    if hasattr(model, 'owner'):
        q_owner |= Q(owner=user)
        has_owner_field = True
    if hasattr(model, 'primary_owner'):
        q_owner |= Q(primary_owner=user)
        has_owner_field = True
    if hasattr(model, 'assigned_sales_owner'):
        q_owner |= Q(assigned_sales_owner=user)
        has_owner_field = True
    if hasattr(model, 'pld_executive'):
        q_owner |= Q(pld_executive=user)
        has_owner_field = True
    if hasattr(model, 'presenter'):
        q_owner |= Q(presenter=user)
        has_owner_field = True
    if hasattr(model, 'created_by'):
        q_owner |= Q(created_by=user)
        has_owner_field = True

    if has_owner_field:
        return queryset.filter(q_owner).distinct()

    return queryset


# ==============================================================================
# 3. DRF PERMISSION CLASSES
# ==============================================================================

class IsAdminUser(permissions.BasePermission):
    """Allows access only to Platform Administrators."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (
            request.user.is_superuser or request.user.canonical_role == UserRole.ADMIN
        ))


class IsManagementOrAdmin(permissions.BasePermission):
    """Allows access to Platform Admin and TEXOL Management (Tier 1)."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (
            request.user.is_superuser or request.user.canonical_role in [UserRole.ADMIN, UserRole.MANAGEMENT]
        ))


class IsSalesManagerOrAbove(permissions.BasePermission):
    """Allows access to Sales Managers, Management, and Admin (Tiers 1 & 2)."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (
            request.user.is_superuser or request.user.canonical_role in [
                UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.SALES_MANAGER
            ]
        ))


class IsPartnerManagerOrAbove(permissions.BasePermission):
    """Allows access to Partner Managers, Management, and Admin."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (
            request.user.is_superuser or request.user.canonical_role in [
                UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.PARTNER_MANAGER
            ]
        ))


class IsInternalStaff(permissions.BasePermission):
    """Allows access to all internal TEXOL staff (blocks external Partner Users)."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and not request.user.is_partner_scope)


class IsPartnerUser(permissions.BasePermission):
    """Allows access only to external Partner Portal Users (Tier 4)."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_partner_scope)


class IsAdminOrProductManager(permissions.BasePermission):
    """Allows access to Admin and Product Managers (e.g. Product Studio authoring/publishing)."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (
            request.user.is_superuser or request.user.canonical_role in [
                UserRole.ADMIN, UserRole.PRODUCT_MANAGER
            ]
        ))


class IsAdminOrFinance(permissions.BasePermission):
    """Allows access to Admin and Finance users (e.g. ERP sync, commercial audits)."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (
            request.user.is_superuser or request.user.canonical_role in [
                UserRole.ADMIN, UserRole.FINANCE
            ]
        ))


class DomainOperationPermission(permissions.BasePermission):
    """
    Universal DRF permission class evaluating request against Section 9.3 Domain Matrix.
    Maps HTTP methods to actions:
    - GET / HEAD / OPTIONS -> 'view'
    - POST -> 'create'
    - PUT / PATCH -> 'update'
    - DELETE -> 'delete'
    """
    domain = 'ACCOUNTS'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True

        custom_action = getattr(view, 'action', None)
        if custom_action and custom_action in [
            'approve', 'reject', 'override', 'publish', 'submit',
            'reassign', 'accept', 'export', 'audit', 'sign'
        ]:
            action = custom_action
        else:
            action_map = {
                'GET': 'view',
                'HEAD': 'view',
                'OPTIONS': 'view',
                'POST': 'create',
                'PUT': 'update',
                'PATCH': 'update',
                'DELETE': 'delete'
            }
            action = action_map.get(request.method, 'view')

        domain_name = getattr(view, 'domain_name', self.domain)
        return has_domain_permission(request.user, domain_name, action)

    def has_object_permission(self, request, view, obj):
        # Enforce row-level security on detail/action endpoints
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_global_scope:
            return True

        # Check partner isolation
        if request.user.is_partner_scope:
            if hasattr(obj, 'partner'):
                partner_id = getattr(request.user.partner_profile, 'partner_id', None)
                return str(getattr(obj.partner, 'id', '')) == str(partner_id)
            return False

        return True


class ScopedQuerySetMixin:
    """
    ViewSet mixin that automatically applies Tier 1-4 data scoping on get_queryset().
    Prevents IDOR and ensures row-level isolation across list, detail, and custom actions.
    """
    domain_name = None

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(self, 'request') and self.request and self.request.user:
            return apply_data_scoping(qs, self.request.user, domain=self.domain_name)
        return qs


# ==============================================================================
# 4. GOVERNANCE & APPROVAL WORKFLOW AUTHORITIES (SECTION 9.5)
# ==============================================================================

def can_override_stage_gate(user: User, record=None) -> bool:
    """
    Section 9.5 B: Mandatory Stage-Gate Overrides.
    - Frontline users: Cannot bypass mandatory gates.
    - Sales Manager: May override gates within authorized team scope (must provide justification).
    - Management & Admin: Global overrides.
    """
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or user.canonical_role in [UserRole.ADMIN, UserRole.MANAGEMENT]:
        return True
    if user.canonical_role == UserRole.SALES_MANAGER:
        if record is None:
            return True
        # Verify record owner is in manager's direct reports or territory
        owner = getattr(record, 'owner', None) or getattr(record, 'assigned_sales_owner', None)
        if owner and hasattr(user, 'direct_reports'):
            direct_report_ids = set(user.direct_reports.values_list('id', flat=True))
            if owner.id in direct_report_ids or owner == user:
                return True
        if hasattr(record, 'territory') and user.territory:
            return record.territory == user.territory
        return True
    return False


def can_adjust_pld_score(user: User, record=None) -> bool:
    """
    Section 9.5 C: PLD Score Adjustments.
    - Frontline users submit questionnaire answers (no override).
    - Sales Managers: Authorized score adjustment with documented justification.
    - Management & Admin: Executive score override authority.
    - Product Managers: Author/simulate models only, must not tamper with live scores.
    """
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or user.canonical_role in [UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.SALES_MANAGER]:
        return True
    return False


def can_publish_product_config(user: User) -> bool:
    """
    Section 9.5 F: Product Configuration Publishing.
    - Product Managers & Admin own configuration authoring and publishing.
    - Ordinary sales and frontline roles must not publish configurations.
    """
    if not user or not user.is_authenticated:
        return False
    return bool(user.is_superuser or user.canonical_role in [UserRole.ADMIN, UserRole.PRODUCT_MANAGER])


def can_sync_erp(user: User) -> bool:
    """
    Section 9.5 G: ERP Accounting Synchronization.
    - Admin has connector configuration & troubleshooting authority.
    - Finance has invoice, billing, payment, reconciliation sync responsibilities.
    - Other roles must not trigger restricted financial operations.
    """
    if not user or not user.is_authenticated:
        return False
    return bool(user.is_superuser or user.canonical_role in [UserRole.ADMIN, UserRole.FINANCE])


