from rest_framework import serializers
from apps.accounts.models import Account, AccountAttribute, Contact, AccountProduct


class AccountAttributeSerializer(serializers.ModelSerializer):
    product_code = serializers.ReadOnlyField(source='product.code')

    class Meta:
        model = AccountAttribute
        fields = ['id', 'account', 'product', 'product_code', 'attribute_key', 'attribute_value']


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = [
            'id', 'account', 'first_name', 'last_name', 'designation',
            'email', 'phone', 'mobile', 'linkedin_url', 'role_type',
            'decision_level', 'preferred_channel', 'is_primary'
        ]


class AccountProductSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_code = serializers.ReadOnlyField(source='product.code')
    account_name = serializers.ReadOnlyField(source='account.company_name')

    class Meta:
        model = AccountProduct
        fields = [
            'id', 'account', 'account_name', 'product', 'product_name', 'product_code',
            'status', 'contract_value', 'arr_mrr', 'renewal_date', 'health_score'
        ]


class AccountSerializer(serializers.ModelSerializer):
    contacts = ContactSerializer(many=True, read_only=True)
    custom_attributes = AccountAttributeSerializer(many=True, read_only=True)
    product_relationships = AccountProductSerializer(many=True, read_only=True)
    primary_owner_name = serializers.ReadOnlyField(source='primary_owner.get_full_name')
    partner_name = serializers.ReadOnlyField(source='partner.account.company_name')

    class Meta:
        model = Account
        fields = [
            'id', 'company_name', 'legal_name', 'trade_name', 'account_type',
            'industry', 'sub_industry', 'country', 'state', 'city', 'territory', 'address',
            'company_size_band', 'website', 'domain', 'phone',
            'employees_count', 'distribution_centers_count',
            'is_target_account', 'target_tier', 'source', 'partner', 'partner_name',
            'primary_owner', 'primary_owner_name', 'last_activity_at',
            'next_activity_due_at', 'next_action_description',
            'contacts', 'custom_attributes', 'product_relationships'
        ]

    def _sync_industry(self, industry_name):
        if industry_name and isinstance(industry_name, str) and industry_name.strip():
            try:
                import re
                from apps.core.models import Industry
                name = industry_name.strip()
                code = re.sub(r'[^A-Z0-9_]+', '_', name.upper()).strip('_')
                Industry.objects.get_or_create(
                    name=name,
                    defaults={'code': code or 'INDUSTRY', 'is_active': True}
                )
            except Exception:
                pass

    def create(self, validated_data):
        industry = validated_data.get('industry')
        self._sync_industry(industry)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        industry = validated_data.get('industry')
        if industry:
            self._sync_industry(industry)
        return super().update(instance, validated_data)

