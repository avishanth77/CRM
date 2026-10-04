from rest_framework import serializers
from apps.opportunities.models import (
    Opportunity, OpportunityProduct, OpportunityModule,
    OpportunityCapability, Proposal, ProposalVersion, ProposalItem,
    ApprovalRule, ApprovalRuleType, ProposalStatus
)
from apps.workflows.models import Approval, ApprovalStatus, ApprovalType


class ProposalItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_code = serializers.ReadOnlyField(source='product.code')
    module_name = serializers.ReadOnlyField(source='module.name')
    capability_name = serializers.ReadOnlyField(source='capability.name')

    class Meta:
        model = ProposalItem
        fields = [
            'id', 'proposal_version', 'product', 'product_name', 'product_code',
            'module', 'module_name', 'capability', 'capability_name',
            'description', 'quantity', 'unit_price', 'discount_pct',
            'discount_amount', 'line_total', 'created_at'
        ]


class ProposalVersionSerializer(serializers.ModelSerializer):
    items = ProposalItemSerializer(many=True, read_only=True)
    created_by_name = serializers.ReadOnlyField(source='created_by.get_full_name')
    sent_by_name = serializers.ReadOnlyField(source='sent_by.get_full_name')
    is_expired = serializers.ReadOnlyField()
    approval_status = serializers.ReadOnlyField(source='approval_request.status')
    approval_approver_name = serializers.ReadOnlyField(source='approval_request.approver.get_full_name')
    approval_decision_notes = serializers.ReadOnlyField(source='approval_request.decision_notes')
    approval_decision_date = serializers.ReadOnlyField(source='approval_request.decision_date')
    approval_justification = serializers.ReadOnlyField(source='approval_request.justification_notes')

    class Meta:
        model = ProposalVersion
        fields = [
            'id', 'proposal', 'version_number', 'status', 'currency',
            'valid_from', 'valid_until', 'is_expired',
            'gross_amount', 'discount_pct', 'discount_amount', 'discount_reason',
            'tax_pct', 'tax_amount', 'net_amount',
            'contract_term_months', 'payment_terms', 'approval_required_flag',
            'approval_request', 'approval_status', 'approval_approver_name',
            'approval_decision_notes', 'approval_decision_date', 'approval_justification',
            'proposal_document_url', 'created_by', 'created_by_name',
            'sent_at', 'sent_by', 'sent_by_name', 'sent_to',
            'approved_at', 'rejected_at', 'notes', 'items', 'created_at', 'updated_at'
        ]


class ProposalSerializer(serializers.ModelSerializer):
    account_name = serializers.ReadOnlyField(source='account.company_name')
    primary_contact_name = serializers.ReadOnlyField(source='primary_contact.first_name')
    primary_contact_email = serializers.ReadOnlyField(source='primary_contact.email')
    product_name = serializers.ReadOnlyField(source='product.name')
    owner_name = serializers.ReadOnlyField(source='owner.get_full_name')
    is_expired = serializers.ReadOnlyField()
    versions = ProposalVersionSerializer(many=True, read_only=True)
    current_version = serializers.SerializerMethodField()

    class Meta:
        model = Proposal
        fields = [
            'id', 'opportunity', 'account', 'account_name',
            'primary_contact', 'primary_contact_name', 'primary_contact_email',
            'product', 'product_name', 'proposal_number', 'title',
            'owner', 'owner_name', 'version_number', 'status', 'currency',
            'valid_from', 'valid_until', 'is_expired',
            'gross_amount', 'discount_pct', 'discount_amount', 'discount_reason',
            'tax_pct', 'tax_amount', 'net_amount',
            'contract_term_months', 'payment_terms', 'approval_required_flag',
            'proposal_document_url', 'sent_at', 'sent_by', 'sent_to',
            'approved_at', 'rejected_at', 'notes', 'current_version', 'versions',
            'created_at', 'updated_at'
        ]

    def get_current_version(self, obj):
        v = obj.versions.filter(version_number=obj.version_number).first() or obj.versions.order_by('-version_number').first()
        return ProposalVersionSerializer(v).data if v else None


class ApprovalRuleSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')

    class Meta:
        model = ApprovalRule
        fields = [
            'id', 'rule_name', 'rule_type', 'product', 'product_name',
            'threshold_value', 'approver_role', 'approval_sequence',
            'is_active', 'description', 'created_at'
        ]


class OpportunityProductSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_code = serializers.ReadOnlyField(source='product.code')

    class Meta:
        model = OpportunityProduct
        fields = ['id', 'opportunity', 'product', 'product_name', 'product_code', 'quantity', 'unit_price', 'total_amount', 'term_months']


class OpportunityModuleSerializer(serializers.ModelSerializer):
    module_name = serializers.ReadOnlyField(source='module.name')
    module_code = serializers.ReadOnlyField(source='module.code')

    class Meta:
        model = OpportunityModule
        fields = ['id', 'opportunity', 'module', 'module_name', 'module_code', 'is_included', 'notes']


class OpportunityCapabilitySerializer(serializers.ModelSerializer):
    capability_name = serializers.ReadOnlyField(source='capability.name')
    capability_code = serializers.ReadOnlyField(source='capability.code')
    module_name = serializers.ReadOnlyField(source='capability.module.name')

    class Meta:
        model = OpportunityCapability
        fields = ['id', 'opportunity', 'capability', 'capability_name', 'capability_code', 'module_name']


class OpportunitySerializer(serializers.ModelSerializer):
    account_name = serializers.ReadOnlyField(source='account.company_name')
    primary_contact_name = serializers.ReadOnlyField(source='primary_contact.first_name')
    owner_name = serializers.ReadOnlyField(source='owner.get_full_name')
    stage_name = serializers.ReadOnlyField(source='stage.stage_name')
    stage_code = serializers.ReadOnlyField(source='stage.stage_code')
    product_name = serializers.ReadOnlyField(source='product.name')
    product_code = serializers.ReadOnlyField(source='product.code')

    product_lines = OpportunityProductSerializer(many=True, read_only=True)
    selected_modules = OpportunityModuleSerializer(many=True, read_only=True)
    required_capabilities = OpportunityCapabilitySerializer(many=True, read_only=True)
    proposals = ProposalSerializer(many=True, read_only=True)

    class Meta:
        model = Opportunity
        fields = [
            'id', 'account', 'account_name', 'primary_contact', 'primary_contact_name',
            'owner', 'owner_name', 'sql_handoff', 'opportunity_type',
            'stage', 'stage_name', 'stage_code', 'status',
            'product', 'product_name', 'product_code',
            'total_contract_value', 'arr', 'mrr', 'arr_mrr',
            'pricing_plan', 'seat_units_count', 'contract_term_months',
            'currency', 'probability_pct', 'expected_close_date',
            'pld_score', 'sql_date', 'decision_maker', 'implementation_scope',
            'erp_system', 'integration_requirements', 'poc_result',
            'competitor', 'loss_reason_category', 'loss_reason_notes',
            'last_activity_at', 'next_activity_due_at', 'next_action_description',
            'product_lines', 'selected_modules', 'required_capabilities',
            'proposals', 'created_at', 'updated_at'
        ]
