from rest_framework import serializers
from apps.evaluations.models import (
    Demo, DemoParticipant, DemoUseCaseMapping,
    POC, POCParticipant, POCSuccessCriterion
)
from apps.evaluations.services import DemoValidator, POCValidator, StageRequirementChecker


class DemoParticipantSerializer(serializers.ModelSerializer):
    contact_name = serializers.SerializerMethodField()
    user_name = serializers.ReadOnlyField(source='user.get_full_name')

    class Meta:
        model = DemoParticipant
        fields = [
            'id', 'demo', 'contact', 'contact_name', 'user', 'user_name',
            'name', 'email', 'participant_type', 'role_title', 'attended',
            'notes', 'created_at'
        ]

    def get_contact_name(self, obj):
        if obj.contact:
            return f"{obj.contact.first_name} {obj.contact.last_name or ''}".strip()
        return obj.name or ''


class DemoUseCaseMappingSerializer(serializers.ModelSerializer):
    problem_name = serializers.SerializerMethodField()
    module_name = serializers.ReadOnlyField(source='module.name')
    capability_name = serializers.ReadOnlyField(source='capability.name')
    capability_code = serializers.ReadOnlyField(source='capability.code')

    class Meta:
        model = DemoUseCaseMapping
        fields = [
            'id', 'demo', 'discovery_problem', 'lead_problem', 'problem_name',
            'module', 'module_name', 'capability', 'capability_name', 'capability_code',
            'notes', 'was_demonstrated', 'created_at'
        ]

    def get_problem_name(self, obj):
        if obj.discovery_problem:
            return obj.discovery_problem.refined_statement or obj.discovery_problem.problem.name
        if obj.lead_problem:
            return obj.lead_problem.problem.name
        return "Custom Scenario"


class DemoSerializer(serializers.ModelSerializer):
    account_name = serializers.ReadOnlyField(source='account.company_name')
    presenter_name = serializers.ReadOnlyField(source='presenter.get_full_name')
    product_name = serializers.SerializerMethodField()
    product_code = serializers.SerializerMethodField()
    participants = DemoParticipantSerializer(many=True, read_only=True)
    use_cases = DemoUseCaseMappingSerializer(many=True, read_only=True)
    readiness = serializers.SerializerMethodField()
    is_required = serializers.SerializerMethodField()

    class Meta:
        model = Demo
        fields = [
            'id', 'account', 'account_name', 'lead', 'discovery', 'opportunity',
            'product', 'product_name', 'product_code', 'presenter', 'presenter_name',
            'scheduled_at', 'conducted_at', 'participants_notes', 'demonstrated_use_cases',
            'customer_feedback', 'objections_raised', 'customer_questions', 'customer_response',
            'fit_assessment', 'status', 'not_required_reason', 'next_action_due_at',
            'next_action_description', 'participants', 'use_cases', 'readiness', 'is_required',
            'created_at', 'updated_at'
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
        return DemoValidator.validate_readiness(obj)

    def get_is_required(self, obj):
        prod = obj.product or (obj.lead.primary_product if obj.lead else None)
        return StageRequirementChecker.is_demo_required(prod)


class POCParticipantSerializer(serializers.ModelSerializer):
    contact_name = serializers.SerializerMethodField()
    user_name = serializers.ReadOnlyField(source='user.get_full_name')

    class Meta:
        model = POCParticipant
        fields = [
            'id', 'poc', 'contact', 'contact_name', 'user', 'user_name',
            'name', 'email', 'participant_type', 'role_title', 'notes',
            'created_at'
        ]

    def get_contact_name(self, obj):
        if obj.contact:
            return f"{obj.contact.first_name} {obj.contact.last_name or ''}".strip()
        return obj.name or ''


class POCSuccessCriterionSerializer(serializers.ModelSerializer):
    class Meta:
        model = POCSuccessCriterion
        fields = [
            'id', 'poc', 'name', 'category', 'measurement_baseline',
            'expected_target', 'actual_result', 'is_met', 'notes',
            'created_at'
        ]


class POCSerializer(serializers.ModelSerializer):
    account_name = serializers.ReadOnlyField(source='account.company_name')
    owner_name = serializers.ReadOnlyField(source='owner.get_full_name')
    product_name = serializers.SerializerMethodField()
    product_code = serializers.SerializerMethodField()
    participants = POCParticipantSerializer(many=True, read_only=True)
    criteria_items = POCSuccessCriterionSerializer(many=True, read_only=True)
    readiness = serializers.SerializerMethodField()
    is_required = serializers.SerializerMethodField()

    class Meta:
        model = POC
        fields = [
            'id', 'account', 'account_name', 'lead', 'discovery', 'opportunity',
            'product', 'product_name', 'product_code', 'owner', 'owner_name',
            'scope_description', 'users_count', 'geography_coverage', 'start_date',
            'end_date', 'success_criteria', 'baseline_metrics', 'baseline_notes',
            'result_metrics', 'results_summary', 'customer_feedback', 'status',
            'not_required_reason', 'completed_at', 'next_action_description',
            'next_action_due_at', 'participants', 'criteria_items', 'readiness',
            'is_required', 'created_at', 'updated_at'
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
        return POCValidator.validate_readiness(obj)

    def get_is_required(self, obj):
        prod = obj.product or (obj.lead.primary_product if obj.lead else None)
        return StageRequirementChecker.is_poc_required(prod)
