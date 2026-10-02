from rest_framework import serializers
from apps.sales_handoff.models import SQLHandoff


class SQLHandoffSerializer(serializers.ModelSerializer):
    company_name = serializers.ReadOnlyField(source='lead.account.company_name')
    product_name = serializers.ReadOnlyField(source='product.name')
    pld_executive_name = serializers.ReadOnlyField(source='pld_executive.get_full_name')
    sales_owner_name = serializers.ReadOnlyField(source='assigned_sales_owner.get_full_name')

    class Meta:
        model = SQLHandoff
        fields = [
            'id', 'lead', 'company_name', 'product', 'product_name',
            'pld_executive', 'pld_executive_name',
            'assigned_sales_owner', 'sales_owner_name',
            'gate_audit_results', 'sla_expires_at', 'status',
            'decision_date', 'rejection_reason', 'created_at'
        ]
