from rest_framework import serializers
from apps.authentication.models import User, UserRole

ROLE_WORKSPACE_PERMISSIONS = {
    'ADMIN': [
        'dashboard', 'work-queue', 'account-360', 'queue', 'discovery', 'demo', 
        'poc', 'sql', 'opportunities', 'proposals', 'negotiation', 'customer-lifecycle', 'nurture-pool', 'partners', 'studio', 
        'audit', 'attribution', 'leakage', 'communications', 'erp', 'staff-partners'
    ],
    'MANAGEMENT': [
        'dashboard', 'work-queue', 'account-360', 'queue', 'discovery', 'demo', 'poc',
        'sql', 'opportunities', 'proposals', 'negotiation', 'customer-lifecycle', 'nurture-pool', 'attribution', 'leakage', 'audit', 'partners',
        'communications'
    ],
    'SALES_MANAGER': [
        'dashboard', 'work-queue', 'account-360', 'queue', 'discovery', 'demo', 'poc',
        'sql', 'opportunities', 'proposals', 'negotiation', 'customer-lifecycle', 'nurture-pool', 'leakage', 'communications', 'audit'
    ],
    'SALES_BDM': [
        'work-queue', 'account-360', 'discovery', 'demo', 'poc', 'sql', 
        'opportunities', 'proposals', 'negotiation', 'customer-lifecycle', 'nurture-pool', 'communications'
    ],
    'ACCOUNT_EXECUTIVE': [
        'work-queue', 'account-360', 'discovery', 'demo', 'poc', 'sql', 
        'opportunities', 'proposals', 'negotiation', 'customer-lifecycle', 'nurture-pool', 'communications'
    ],
    'PLD_EXECUTIVE': [
        'work-queue', 'account-360', 'queue', 'discovery', 'demo', 
        'sql', 'communications'
    ],
    'SDR': [
        'work-queue', 'account-360', 'queue', 'discovery', 'demo', 
        'sql', 'communications'
    ],
    'SOLUTION_CONSULTANT': [
        'work-queue', 'account-360', 'discovery', 'demo', 'poc', 
        'sql', 'communications'
    ],
    'SOLUTIONS_CONSULTANT': [
        'work-queue', 'account-360', 'discovery', 'demo', 'poc', 
        'sql', 'communications'
    ],
    'PRODUCT_MANAGER': [
        'studio', 'dashboard', 'work-queue', 'account-360', 'queue',
        'discovery', 'demo', 'poc'
    ],
    'PARTNER_MANAGER': [
        'partners', 'dashboard', 'staff-partners', 'work-queue', 'account-360',
        'opportunities', 'proposals', 'negotiation', 'customer-lifecycle', 'attribution'
    ],
    'CUSTOMER_SUCCESS': [
        'account-360', 'work-queue', 'customer-lifecycle', 'communications', 'dashboard', 'opportunities'
    ],
    'MARKETING': [
        'dashboard', 'attribution', 'leakage', 'nurture-pool', 'work-queue', 'account-360', 'communications'
    ],
    'FINANCE': [
        'dashboard', 'opportunities', 'proposals', 'negotiation', 'erp', 'account-360', 'audit'
    ],
    'DEPLOYMENT_ENGINEER': [
        'work-queue', 'poc', 'demo', 'discovery', 'communications'
    ],
    'PARTNER_USER': [
        'partners'
    ]
}

ROLE_CAPABILITIES = {
    'ADMIN': {
        'can_override_scores': True,
        'can_accept_sql': True,
        'can_publish_configs': True,
        'can_sync_erp': True,
        'can_view_audit': True,
        'can_manage_partners': True,
        'can_edit_proposals': True,
        'can_negotiate': True,
    },
    'MANAGEMENT': {
        'can_override_scores': True,
        'can_accept_sql': True,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': True,
        'can_manage_partners': True,
        'can_edit_proposals': True,
        'can_negotiate': True,
    },
    'SALES_MANAGER': {
        'can_override_scores': True,
        'can_accept_sql': True,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': True,
        'can_manage_partners': True,
        'can_edit_proposals': True,
        'can_negotiate': True,
    },
    'SALES_BDM': {
        'can_override_scores': False,
        'can_accept_sql': True,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': False,
        'can_manage_partners': False,
        'can_edit_proposals': True,
        'can_negotiate': True,
    },
    'ACCOUNT_EXECUTIVE': {
        'can_override_scores': False,
        'can_accept_sql': True,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': False,
        'can_manage_partners': False,
        'can_edit_proposals': True,
        'can_negotiate': True,
    },
    'PLD_EXECUTIVE': {
        'can_override_scores': False,
        'can_accept_sql': False,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': False,
        'can_manage_partners': False,
        'can_edit_proposals': False,
    },
    'SDR': {
        'can_override_scores': False,
        'can_accept_sql': False,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': False,
        'can_manage_partners': False,
        'can_edit_proposals': False,
    },
    'SOLUTION_CONSULTANT': {
        'can_override_scores': False,
        'can_accept_sql': False,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': False,
        'can_manage_partners': False,
        'can_edit_proposals': False,
    },
    'SOLUTIONS_CONSULTANT': {
        'can_override_scores': False,
        'can_accept_sql': False,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': False,
        'can_manage_partners': False,
        'can_edit_proposals': False,
    },
    'PRODUCT_MANAGER': {
        'can_override_scores': False,
        'can_accept_sql': False,
        'can_publish_configs': True,
        'can_sync_erp': False,
        'can_view_audit': True,
        'can_manage_partners': False,
        'can_edit_proposals': False,
    },
    'PARTNER_MANAGER': {
        'can_override_scores': False,
        'can_accept_sql': False,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': True,
        'can_manage_partners': True,
        'can_edit_proposals': False,
    },
    'CUSTOMER_SUCCESS': {
        'can_override_scores': False,
        'can_accept_sql': False,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': False,
        'can_manage_partners': False,
        'can_edit_proposals': False,
    },
    'MARKETING': {
        'can_override_scores': False,
        'can_accept_sql': False,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': False,
        'can_manage_partners': False,
        'can_edit_proposals': False,
    },
    'FINANCE': {
        'can_override_scores': False,
        'can_accept_sql': False,
        'can_publish_configs': False,
        'can_sync_erp': True,
        'can_view_audit': True,
        'can_manage_partners': False,
        'can_edit_proposals': False,
    },
    'PARTNER_USER': {
        'can_override_scores': False,
        'can_accept_sql': False,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': False,
        'can_manage_partners': False,
        'can_edit_proposals': False,
    }
}

class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    allowed_workspaces = serializers.SerializerMethodField()
    capabilities = serializers.SerializerMethodField()
    partner_details = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'name', 'role', 'role_display', 'is_superuser',
            'is_partner_user', 'territory', 'phone',
            'allowed_workspaces', 'capabilities', 'partner_details'
        ]

    def get_name(self, obj):
        full = f"{obj.first_name} {obj.last_name}".strip()
        return full or obj.username or obj.email.split('@')[0]

    def get_allowed_workspaces(self, obj):
        if obj.is_superuser or obj.role == 'ADMIN':
            return ROLE_WORKSPACE_PERMISSIONS['ADMIN']
        return ROLE_WORKSPACE_PERMISSIONS.get(obj.role, ['work-queue'])

    def get_capabilities(self, obj):
        if obj.is_superuser or obj.role == 'ADMIN':
            return ROLE_CAPABILITIES['ADMIN']
        return ROLE_CAPABILITIES.get(obj.role, ROLE_CAPABILITIES.get('PLD_EXECUTIVE', {}))

    def get_partner_details(self, obj):
        if hasattr(obj, 'partner_profile') and obj.partner_profile:
            p_profile = obj.partner_profile
            return {
                'partner_id': str(p_profile.partner.id),
                'partner_name': p_profile.partner.account.company_name,
                'partner_role': p_profile.partner_role,
            }
        return None


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)
