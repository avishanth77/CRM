from rest_framework import serializers
from apps.sales_handoff.models import SQLHandoff


class SQLHandoffSerializer(serializers.ModelSerializer):
    company_name = serializers.ReadOnlyField(source='lead.account.company_name')
    contact_name = serializers.ReadOnlyField(source='lead.contact.first_name')
    product_name = serializers.ReadOnlyField(source='product.name')
    pld_executive_name = serializers.ReadOnlyField(source='pld_executive.get_full_name')
    sales_owner_name = serializers.ReadOnlyField(source='assigned_sales_owner.get_full_name')
    previous_owner_name = serializers.ReadOnlyField(source='previous_owner.get_full_name')
    override_approved_by_name = serializers.ReadOnlyField(source='override_approved_by.get_full_name')
    is_sla_overdue = serializers.ReadOnlyField()
    sla_remaining_hours = serializers.ReadOnlyField()
    opportunity_id = serializers.SerializerMethodField()

    def get_opportunity_id(self, obj):
        if hasattr(obj, 'converted_opportunity') and obj.converted_opportunity:
            return str(obj.converted_opportunity.id)
        return None

    class Meta:
        model = SQLHandoff
        fields = [
            'id', 'lead', 'account', 'company_name', 'contact_name',
            'product', 'product_name',
            'pld_executive', 'pld_executive_name',
            'assigned_sales_owner', 'sales_owner_name',
            'previous_owner', 'previous_owner_name', 'ownership_transferred_at',
            'estimated_value', 'currency', 'readiness_status',
            'qualification_evidence', 'gate_audit_results',
            'is_override', 'override_reason', 'override_approved_by', 'override_approved_by_name',
            'override_approved_at', 'original_gate_results',
            'sla_duration_hours', 'sql_ready_at', 'submitted_at', 'sla_expires_at',
            'is_sla_overdue', 'sla_remaining_hours',
            'status', 'decision_date', 'rejection_reason',
            'opportunity_id', 'created_at', 'updated_at'
        ]
