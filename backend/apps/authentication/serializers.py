from rest_framework import serializers
from apps.authentication.models import User, UserRole

ROLE_WORKSPACE_PERMISSIONS = {
    'ADMIN': [
        'dashboard', 'work-queue', 'account-360', 'queue', 'discovery', 'demo', 
        'poc', 'sql', 'opportunities', 'proposals', 'negotiation', 'customer-lifecycle', 'nurture-pool', 'partners', 'studio', 
        'audit', 'attribution', 'leakage', 'communications', 'erp', 'staff-partners', 'admin-leads', 'website-leads'
    ],
    'MANAGEMENT': [
        'dashboard', 'work-queue', 'account-360', 'queue', 'discovery', 'demo', 'poc',
        'sql', 'opportunities', 'proposals', 'negotiation', 'customer-lifecycle', 'nurture-pool', 'attribution', 'leakage', 'audit', 'partners',
        'communications', 'admin-leads', 'website-leads'
    ],
    'SALES_MANAGER': [
        'dashboard', 'work-queue', 'account-360', 'queue', 'discovery', 'demo', 'poc',
        'sql', 'opportunities', 'proposals', 'negotiation', 'customer-lifecycle', 'nurture-pool', 'leakage', 'communications', 'audit', 'admin-leads', 'website-leads'
    ],
    'SALES_BDM': [
        'work-queue', 'account-360', 'queue', 'discovery', 'demo', 'poc', 'sql', 
        'opportunities', 'proposals', 'negotiation', 'customer-lifecycle', 'nurture-pool', 'communications'
    ],
    'ACCOUNT_EXECUTIVE': [
        'work-queue', 'account-360', 'queue', 'discovery', 'demo', 'poc', 'sql', 
        'opportunities', 'proposals', 'negotiation', 'customer-lifecycle', 'nurture-pool', 'communications'
    ],
    'PRESALES': [
        'work-queue', 'account-360', 'queue', 'discovery', 'demo', 'poc', 
        'opportunities', 'sql', 'communications'
    ],
    'PLD_EXECUTIVE': [
        'work-queue', 'account-360', 'queue', 'discovery', 'demo', 'poc', 
        'opportunities', 'sql', 'communications'
    ],
    'SDR': [
        'work-queue', 'account-360', 'queue', 'discovery', 'demo', 
        'sql', 'communications'
    ],
    'SOLUTION_CONSULTANT': [
        'work-queue', 'account-360', 'discovery', 'demo', 'poc', 
        'opportunities', 'sql', 'communications'
    ],
    'SOLUTIONS_CONSULTANT': [
        'work-queue', 'account-360', 'discovery', 'demo', 'poc', 
        'opportunities', 'sql', 'communications'
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
        'can_override_stage_gates': True,
        'can_accept_sql': True,
        'can_publish_configs': True,
        'can_sync_erp': True,
        'can_view_audit': True,
        'can_manage_partners': True,
        'can_edit_proposals': True,
        'can_negotiate': True,
        'can_self_approve_discount_pct': 100.0,
    },
    'MANAGEMENT': {
        'can_override_scores': True,
        'can_override_stage_gates': True,
        'can_accept_sql': True,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': True,
        'can_manage_partners': True,
        'can_edit_proposals': True,
        'can_negotiate': True,
        'can_self_approve_discount_pct': 100.0,
    },
    'SALES_MANAGER': {
        'can_override_scores': True,
        'can_override_stage_gates': True,
        'can_accept_sql': True,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': True,
        'can_manage_partners': True,
        'can_edit_proposals': True,
        'can_negotiate': True,
        'can_self_approve_discount_pct': 25.0,
    },
    'SALES_BDM': {
        'can_override_scores': False,
        'can_override_stage_gates': False,
        'can_accept_sql': True,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': False,
        'can_manage_partners': False,
        'can_edit_proposals': True,
        'can_negotiate': True,
        'can_self_approve_discount_pct': 15.0,
    },
    'ACCOUNT_EXECUTIVE': {
        'can_override_scores': False,
        'can_override_stage_gates': False,
        'can_accept_sql': True,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': False,
        'can_manage_partners': False,
        'can_edit_proposals': True,
        'can_negotiate': True,
        'can_self_approve_discount_pct': 15.0,
    },
    'PRESALES': {
        'can_override_scores': False,
        'can_override_stage_gates': False,
        'can_accept_sql': False,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': False,
        'can_manage_partners': False,
        'can_edit_proposals': False,
        'can_negotiate': False,
        'can_self_approve_discount_pct': 0.0,
        'can_conduct_discovery': True,
        'can_conduct_demo': True,
        'can_lead_poc': True,
        'can_support_opportunity': True,
    },
    'PLD_EXECUTIVE': {
        'can_override_scores': False,
        'can_override_stage_gates': False,
        'can_accept_sql': False,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': False,
        'can_manage_partners': False,
        'can_edit_proposals': False,
        'can_self_approve_discount_pct': 0.0,
    },
    'SDR': {
        'can_override_scores': False,
        'can_override_stage_gates': False,
        'can_accept_sql': False,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': False,
        'can_manage_partners': False,
        'can_edit_proposals': False,
        'can_self_approve_discount_pct': 0.0,
    },
    'SOLUTION_CONSULTANT': {
        'can_override_scores': False,
        'can_override_stage_gates': False,
        'can_accept_sql': False,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': False,
        'can_manage_partners': False,
        'can_edit_proposals': False,
        'can_self_approve_discount_pct': 0.0,
    },
    'SOLUTIONS_CONSULTANT': {
        'can_override_scores': False,
        'can_override_stage_gates': False,
        'can_accept_sql': False,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': False,
        'can_manage_partners': False,
        'can_edit_proposals': False,
        'can_self_approve_discount_pct': 0.0,
    },
    'PRODUCT_MANAGER': {
        'can_override_scores': False,
        'can_override_stage_gates': False,
        'can_accept_sql': False,
        'can_publish_configs': True,
        'can_sync_erp': False,
        'can_view_audit': True,
        'can_manage_partners': False,
        'can_edit_proposals': False,
        'can_self_approve_discount_pct': 0.0,
    },
    'PARTNER_MANAGER': {
        'can_override_scores': False,
        'can_override_stage_gates': False,
        'can_accept_sql': False,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': True,
        'can_manage_partners': True,
        'can_edit_proposals': False,
        'can_self_approve_discount_pct': 0.0,
    },
    'CUSTOMER_SUCCESS': {
        'can_override_scores': False,
        'can_override_stage_gates': False,
        'can_accept_sql': False,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': False,
        'can_manage_partners': False,
        'can_edit_proposals': False,
        'can_self_approve_discount_pct': 0.0,
    },
    'MARKETING': {
        'can_override_scores': False,
        'can_override_stage_gates': False,
        'can_accept_sql': False,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': False,
        'can_manage_partners': False,
        'can_edit_proposals': False,
        'can_self_approve_discount_pct': 0.0,
    },
    'FINANCE': {
        'can_override_scores': False,
        'can_override_stage_gates': False,
        'can_accept_sql': False,
        'can_publish_configs': False,
        'can_sync_erp': True,
        'can_view_audit': True,
        'can_manage_partners': False,
        'can_edit_proposals': False,
        'can_self_approve_discount_pct': 0.0,
    },
    'PARTNER_USER': {
        'can_override_scores': False,
        'can_override_stage_gates': False,
        'can_accept_sql': False,
        'can_publish_configs': False,
        'can_sync_erp': False,
        'can_view_audit': False,
        'can_manage_partners': False,
        'can_edit_proposals': False,
        'can_self_approve_discount_pct': 0.0,
    }
}

class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    canonical_role = serializers.CharField(read_only=True)
    allowed_workspaces = serializers.SerializerMethodField()
    capabilities = serializers.SerializerMethodField()
    partner_details = serializers.SerializerMethodField()
    manager_name = serializers.SerializerMethodField()
    tenant_id = serializers.UUIDField(source='tenant.id', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'name', 'role', 'canonical_role', 'role_display',
            'is_superuser', 'is_staff', 'is_active',
            'is_partner_user', 'territory', 'team', 'manager', 'manager_name',
            'phone', 'tenant_id',
            'allowed_workspaces', 'capabilities', 'partner_details'
        ]
        read_only_fields = ['is_superuser', 'is_staff', 'date_joined', 'last_login']

    def get_name(self, obj):
        full = f"{obj.first_name} {obj.last_name}".strip()
        return full or obj.username or obj.email.split('@')[0]

    def get_allowed_workspaces(self, obj):
        if obj.is_superuser or obj.canonical_role == 'ADMIN':
            return ROLE_WORKSPACE_PERMISSIONS['ADMIN']
        return ROLE_WORKSPACE_PERMISSIONS.get(obj.canonical_role, ROLE_WORKSPACE_PERMISSIONS.get(obj.role, ['work-queue']))

    def get_capabilities(self, obj):
        if obj.is_superuser or obj.canonical_role == 'ADMIN':
            return ROLE_CAPABILITIES['ADMIN']
        return ROLE_CAPABILITIES.get(obj.canonical_role, ROLE_CAPABILITIES.get(obj.role, ROLE_CAPABILITIES.get('PLD_EXECUTIVE', {})))

    def get_partner_details(self, obj):
        if hasattr(obj, 'partner_profile') and obj.partner_profile:
            p_profile = obj.partner_profile
            return {
                'partner_id': str(p_profile.partner.id),
                'partner_name': p_profile.partner.account.company_name,
                'partner_role': p_profile.partner_role,
            }
        return None

    def get_manager_name(self, obj):
        if obj.manager:
            return obj.manager.get_full_name() or obj.manager.username or obj.manager.email
        return None


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=False, write_only=True)
    current_password = serializers.CharField(required=False, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, min_length=8)
    confirm_password = serializers.CharField(required=False, write_only=True, min_length=8)

    def validate(self, attrs):
        old_pwd = attrs.get('old_password') or attrs.get('current_password')
        if not old_pwd:
            raise serializers.ValidationError({'current_password': 'Current password is required.'})
        attrs['old_password'] = old_pwd
        confirm_pwd = attrs.get('confirm_password')
        if confirm_pwd and attrs['new_password'] != confirm_pwd:
            raise serializers.ValidationError({'confirm_password': 'New passwords do not match.'})
        return attrs


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)



from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from django.db.models import Q

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT Token serializer supporting login via email or username,
    embedding user claims in token, and returning user profile in response.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if 'email' in self.fields:
            self.fields['email'].required = False
        self.fields['username'] = serializers.CharField(required=False)

    def validate(self, attrs):
        login_identifier = attrs.get('email') or attrs.get('username') or ''
        login_identifier = login_identifier.strip()
        if not login_identifier:
            raise serializers.ValidationError({'email': 'Email or username is required.'})

        user_obj = User.objects.filter(
            Q(email__iexact=login_identifier) | Q(username__iexact=login_identifier)
        ).first()

        if user_obj:
            if not user_obj.is_active:
                raise AuthenticationFailed('This user account is inactive. Please contact Platform Administrator.')
            attrs[self.username_field] = user_obj.email
        else:
            attrs[self.username_field] = login_identifier

        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['email'] = user.email
        token['role'] = user.role
        token['canonical_role'] = user.canonical_role
        token['name'] = user.get_full_name() or user.username
        token['is_partner_user'] = user.is_partner_user
        token['territory'] = user.territory or ''
        return token

