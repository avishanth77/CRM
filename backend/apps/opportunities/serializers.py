from rest_framework import serializers
from apps.opportunities.models import Opportunity, OpportunityProduct, OpportunityCapability, Proposal


class OpportunityProductSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_code = serializers.ReadOnlyField(source='product.code')

    class Meta:
        model = OpportunityProduct
        fields = ['id', 'opportunity', 'product', 'product_name', 'product_code', 'quantity', 'unit_price', 'total_amount', 'term_months']


class ProposalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proposal
        fields = [
            'id', 'opportunity', 'version_number', 'proposal_document_url',
            'gross_amount', 'discount_pct', 'net_amount', 'valid_until',
            'status', 'approval_required_flag'
        ]


class OpportunitySerializer(serializers.ModelSerializer):
    account_name = serializers.ReadOnlyField(source='account.company_name')
    primary_contact_name = serializers.ReadOnlyField(source='primary_contact.first_name')
    owner_name = serializers.ReadOnlyField(source='owner.get_full_name')
    stage_name = serializers.ReadOnlyField(source='stage.stage_name')

    product_lines = OpportunityProductSerializer(many=True, read_only=True)
    proposals = ProposalSerializer(many=True, read_only=True)

    class Meta:
        model = Opportunity
        fields = [
            'id', 'account', 'account_name', 'primary_contact', 'primary_contact_name',
            'owner', 'owner_name', 'sql_handoff', 'opportunity_type',
            'stage', 'stage_name', 'status', 'total_contract_value', 'arr_mrr',
            'pricing_plan', 'seat_units_count', 'contract_term_months',
            'currency', 'probability_pct', 'expected_close_date',
            'pld_score', 'sql_date', 'decision_maker', 'implementation_scope',
            'erp_system', 'integration_requirements', 'poc_result',
            'competitor', 'loss_reason_category', 'loss_reason_notes',
            'last_activity_at', 'next_activity_due_at', 'next_action_description',
            'product_lines', 'proposals', 'created_at'
        ]
