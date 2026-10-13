from rest_framework import serializers
from apps.partners.models import (
    Partner, PartnerTypeMaster, PartnerUser, PartnerProduct,
    PartnerTerritory, PartnerCertification, DealRegistration,
    ChannelConflict, PartnerCommission, PartnerInfluence,
    PartnerChannelConfig
)
from apps.authentication.models import UserRole


class PartnerTypeMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartnerTypeMaster
        fields = ['id', 'code', 'name', 'description', 'is_active', 'is_default']


class PartnerTerritorySerializer(serializers.ModelSerializer):
    partner_name = serializers.ReadOnlyField(source='partner.account.company_name')

    class Meta:
        model = PartnerTerritory
        fields = ['id', 'partner', 'partner_name', 'territory', 'is_primary', 'is_exclusive', 'status', 'created_at']


class PartnerCertificationSerializer(serializers.ModelSerializer):
    partner_name = serializers.ReadOnlyField(source='partner.account.company_name')
    product_name = serializers.ReadOnlyField(source='product.name')

    class Meta:
        model = PartnerCertification
        fields = [
            'id', 'partner', 'partner_name', 'certification_name', 'product',
            'product_name', 'status', 'issue_date', 'expiry_date',
            'credential_id', 'evidence_url', 'notes', 'created_at'
        ]


class PartnerProductSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_code = serializers.ReadOnlyField(source='product.code')

    class Meta:
        model = PartnerProduct
        fields = [
            'id', 'partner', 'product', 'product_name', 'product_code',
            'authorization_status', 'territory', 'commission_rate_pct',
            'valid_from', 'valid_to'
        ]


class PartnerUserSerializer(serializers.ModelSerializer):
    user_email = serializers.ReadOnlyField(source='user.email')
    user_full_name = serializers.ReadOnlyField(source='user.get_full_name')

    class Meta:
        model = PartnerUser
        fields = ['id', 'partner', 'user', 'user_email', 'user_full_name', 'partner_role', 'is_active', 'created_at']


class PartnerSerializer(serializers.ModelSerializer):
    account = serializers.PrimaryKeyRelatedField(read_only=True)
    company_name = serializers.ReadOnlyField(source='account.company_name')
    domain = serializers.ReadOnlyField(source='account.domain')
    partner_manager_name = serializers.ReadOnlyField(source='partner_manager.get_full_name')
    partner_type_name = serializers.ReadOnlyField(source='partner_type_display_name')
    authorized_products = PartnerProductSerializer(many=True, read_only=True)
    territory_authorizations = PartnerTerritorySerializer(many=True, read_only=True)
    certifications = PartnerCertificationSerializer(many=True, read_only=True)
    users = PartnerUserSerializer(many=True, read_only=True)

    class Meta:
        model = Partner
        fields = [
            'id', 'account', 'company_name', 'domain', 'partner_code', 'partner_type',
            'partner_type_master', 'partner_type_name', 'territory',
            'authorized_territories', 'territory_authorizations',
            'status', 'status_change_date', 'status_change_reason',
            'partner_manager', 'partner_manager_name', 'notes',
            'authorized_products', 'certifications', 'users', 'created_at', 'updated_at'
        ]

    def update(self, instance, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'data'):
            company_name = request.data.get('company_name')
            domain = request.data.get('domain')
            if company_name and instance.account:
                instance.account.company_name = str(company_name).strip()
                instance.account.save(update_fields=['company_name'])
            if domain and instance.account:
                instance.account.domain = str(domain).strip()
                instance.account.save(update_fields=['domain'])
        return super().update(instance, validated_data)


class DealRegistrationSerializer(serializers.ModelSerializer):
    partner_name = serializers.ReadOnlyField(source='partner.account.company_name')
    customer_name = serializers.ReadOnlyField(source='customer_account.company_name')
    product_name = serializers.ReadOnlyField(source='product.name')
    registered_by_name = serializers.ReadOnlyField(source='registered_by.get_full_name')
    reviewed_by_name = serializers.ReadOnlyField(source='reviewed_by.get_full_name')
    contact_name = serializers.ReadOnlyField(source='contact.first_name')

    class Meta:
        model = DealRegistration
        fields = [
            'id', 'partner', 'partner_name', 'registered_by', 'registered_by_name',
            'customer_account', 'customer_name', 'contact', 'contact_name',
            'product', 'product_name', 'territory', 'expected_deal_value',
            'expected_close_date', 'evidence_notes', 'protection_expiry_date',
            'status', 'rejection_reason', 'reviewed_by', 'reviewed_by_name',
            'reviewed_at', 'opportunity', 'created_at', 'updated_at'
        ]


class ChannelConflictSerializer(serializers.ModelSerializer):
    partner_name = serializers.ReadOnlyField(source='partner.account.company_name')
    competing_partner_name = serializers.ReadOnlyField(source='competing_partner.account.company_name')
    customer_name = serializers.ReadOnlyField(source='customer_account.company_name')
    product_name = serializers.ReadOnlyField(source='product.name')
    reviewer_name = serializers.ReadOnlyField(source='reviewer.get_full_name')

    class Meta:
        model = ChannelConflict
        fields = [
            'id', 'conflict_type', 'partner', 'partner_name', 'competing_partner',
            'competing_partner_name', 'deal_registration', 'lead', 'opportunity',
            'customer_account', 'customer_name', 'product', 'product_name',
            'status', 'conflict_details', 'reviewer', 'reviewer_name',
            'decision', 'decision_reason', 'resolved_at', 'created_at'
        ]


class PartnerCommissionSerializer(serializers.ModelSerializer):
    partner_name = serializers.ReadOnlyField(source='partner.account.company_name')
    opportunity_name = serializers.ReadOnlyField(source='opportunity.name')
    approved_by_name = serializers.ReadOnlyField(source='approved_by.get_full_name')

    class Meta:
        model = PartnerCommission
        fields = [
            'id', 'partner', 'partner_name', 'opportunity', 'opportunity_name',
            'deal_registration', 'revenue_basis', 'commission_rate_pct',
            'commission_amount', 'currency', 'rule_reference', 'calculation_basis',
            'payment_status', 'approval_status', 'approved_by', 'approved_by_name',
            'approved_at', 'paid_at', 'notes', 'created_at'
        ]


class PartnerInfluenceSerializer(serializers.ModelSerializer):
    partner_name = serializers.ReadOnlyField(source='partner.account.company_name')
    opportunity_name = serializers.ReadOnlyField(source='opportunity.name')
    recorded_by_name = serializers.ReadOnlyField(source='recorded_by.get_full_name')

    class Meta:
        model = PartnerInfluence
        fields = [
            'id', 'opportunity', 'opportunity_name', 'partner', 'partner_name',
            'influence_type', 'influence_pct', 'influence_date', 'status',
            'recorded_by', 'recorded_by_name', 'notes', 'created_at'
        ]


class PartnerChannelConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartnerChannelConfig
        fields = [
            'id', 'default_protection_days', 'allow_grace_period_days',
            'conflict_auto_flag', 'attribution_default_model',
            'partner_attribution_weight_pct', 'notes', 'updated_at'
        ]
