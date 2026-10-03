from rest_framework import serializers
from apps.discovery.models import (
    Discovery, DiscoveryProblem, DiscoveryProblemMapping, DiscoveryStakeholder
)
from apps.products.serializers import ProblemSerializer, ProductCapabilitySerializer
from apps.products.models import ProductCapability
from apps.discovery.services import DiscoveryValidator


class DiscoveryProblemMappingSerializer(serializers.ModelSerializer):
    capability_name = serializers.ReadOnlyField(source='capability.name')
    capability_code = serializers.ReadOnlyField(source='capability.code')
    module_id = serializers.ReadOnlyField(source='capability.module.id')
    module_name = serializers.ReadOnlyField(source='capability.module.name')
    module_code = serializers.ReadOnlyField(source='capability.module.code')

    class Meta:
        model = DiscoveryProblemMapping
        fields = [
            'id', 'discovery_problem', 'capability', 'capability_name',
            'capability_code', 'module_id', 'module_name', 'module_code',
            'expected_kpi_impact', 'notes', 'created_at'
        ]


class DiscoveryStakeholderSerializer(serializers.ModelSerializer):
    contact_name = serializers.SerializerMethodField()
    contact_email = serializers.ReadOnlyField(source='contact.email')
    contact_phone = serializers.ReadOnlyField(source='contact.phone')
    contact_designation = serializers.ReadOnlyField(source='contact.designation')

    class Meta:
        model = DiscoveryStakeholder
        fields = [
            'id', 'discovery', 'contact', 'contact_name', 'contact_email',
            'contact_phone', 'contact_designation', 'role_name', 'decision_role',
            'responsibility', 'involvement_level', 'notes', 'created_at'
        ]

    def get_contact_name(self, obj):
        return f"{obj.contact.first_name} {obj.contact.last_name or ''}".strip()


class DiscoveryProblemSerializer(serializers.ModelSerializer):
    problem_detail = ProblemSerializer(source='problem', read_only=True)
    capability_mappings = DiscoveryProblemMappingSerializer(many=True, read_only=True)
    original_qualification_info = serializers.SerializerMethodField()

    class Meta:
        model = DiscoveryProblem
        fields = [
            'id', 'discovery', 'problem', 'problem_detail',
            'lead_problem', 'refined_statement', 'category', 'severity', 'frequency',
            'impact_description', 'quantified_loss_value', 'affected_teams',
            'evidence', 'notes', 'is_confirmed', 'capability_mappings',
            'original_qualification_info', 'created_at', 'updated_at'
        ]

    def get_original_qualification_info(self, obj):
        """
        TEXOL SPECIFICATION REQUIREMENT:
        Clearly distinguish ORIGINAL QUALIFICATION INFORMATION from DISCOVERY-REFINED INFORMATION.
        """
        lp = obj.lead_problem
        if not lp:
            return None
        return {
            "source_lead_problem_id": str(lp.id),
            "original_problem_name": lp.problem.name,
            "original_category": lp.category,
            "original_severity": lp.severity,
            "original_frequency": lp.frequency,
            "original_business_impact": lp.business_impact,
            "original_affected_users": lp.affected_users,
            "original_evidence": lp.evidence,
            "original_notes": lp.notes,
            "qualified_at": lp.created_at.isoformat() if lp.created_at else None
        }


class DiscoverySerializer(serializers.ModelSerializer):
    problems = DiscoveryProblemSerializer(many=True, read_only=True)
    stakeholders = DiscoveryStakeholderSerializer(many=True, read_only=True)
    account_name = serializers.ReadOnlyField(source='account.company_name')
    product_name = serializers.SerializerMethodField()
    product_code = serializers.SerializerMethodField()
    conducted_by_name = serializers.ReadOnlyField(source='conducted_by.get_full_name')
    readiness = serializers.SerializerMethodField()

    class Meta:
        model = Discovery
        fields = [
            'id', 'lead', 'account', 'account_name', 'product',
            'product_name', 'product_code', 'conducted_by', 'conducted_by_name',
            'status', 'current_process_notes', 'business_impact_summary',
            'stakeholders_involved_notes', 'decision_process_notes',
            'timeline_notes', 'expected_decision_date', 'expected_implementation_date',
            'budget_notes', 'technical_constraints_notes', 'evidence_notes',
            'next_action_description', 'next_activity_due_at', 'last_activity_at',
            'is_product_mapping_complete', 'completed_at',
            'problems', 'stakeholders', 'readiness', 'created_at', 'updated_at'
        ]

    def get_product_name(self, obj):
        if obj.product:
            return obj.product.name
        if obj.lead and obj.lead.primary_product:
            return obj.lead.primary_product.name
        return ''

    def get_product_code(self, obj):
        if obj.product:
            return obj.product.code
        if obj.lead and obj.lead.primary_product:
            return obj.lead.primary_product.code
        return ''

    def get_readiness(self, obj):
        return DiscoveryValidator.validate_readiness(obj)
