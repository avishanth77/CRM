from rest_framework import serializers
from apps.partners.models import Partner, PartnerUser, PartnerProduct, DealRegistration, PartnerCommission, PartnerInfluence
from apps.accounts.serializers import AccountSerializer


class PartnerProductSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_code = serializers.ReadOnlyField(source='product.code')

    class Meta:
        model = PartnerProduct
        fields = ['id', 'partner', 'product', 'product_name', 'product_code', 'authorization_status', 'territory', 'commission_rate_pct', 'valid_from', 'valid_to']


class PartnerUserSerializer(serializers.ModelSerializer):
    user_email = serializers.ReadOnlyField(source='user.email')
    user_full_name = serializers.ReadOnlyField(source='user.get_full_name')

    class Meta:
        model = PartnerUser
        fields = ['id', 'partner', 'user', 'user_email', 'user_full_name', 'partner_role', 'is_active']


class PartnerSerializer(serializers.ModelSerializer):
    company_name = serializers.ReadOnlyField(source='account.company_name')
    partner_manager_name = serializers.ReadOnlyField(source='partner_manager.get_full_name')
    authorized_products = PartnerProductSerializer(many=True, read_only=True)
    users = PartnerUserSerializer(many=True, read_only=True)

    class Meta:
        model = Partner
        fields = [
            'id', 'account', 'company_name', 'partner_code', 'partner_type',
            'territory', 'status', 'partner_manager', 'partner_manager_name',
            'authorized_products', 'users'
        ]


class DealRegistrationSerializer(serializers.ModelSerializer):
    partner_name = serializers.ReadOnlyField(source='partner.account.company_name')
    customer_name = serializers.ReadOnlyField(source='customer_account.company_name')
    product_name = serializers.ReadOnlyField(source='product.name')

    class Meta:
        model = DealRegistration
        fields = [
            'id', 'partner', 'partner_name', 'registered_by', 'customer_account',
            'customer_name', 'product', 'product_name', 'expected_deal_value',
            'evidence_notes', 'protection_expiry_date', 'status', 'rejection_reason',
            'created_at'
        ]


class PartnerCommissionSerializer(serializers.ModelSerializer):
    partner_name = serializers.ReadOnlyField(source='partner.account.company_name')
    opportunity_name = serializers.ReadOnlyField(source='opportunity.account.company_name')

    class Meta:
        model = PartnerCommission
        fields = [
            'id', 'partner', 'partner_name', 'opportunity', 'opportunity_name',
            'deal_registration', 'commission_amount', 'calculation_basis',
            'payment_status', 'paid_at', 'created_at'
        ]


class PartnerInfluenceSerializer(serializers.ModelSerializer):
    partner_name = serializers.ReadOnlyField(source='partner.account.company_name')

    class Meta:
        model = PartnerInfluence
        fields = ['id', 'opportunity', 'partner', 'partner_name', 'influence_type', 'influence_pct']
