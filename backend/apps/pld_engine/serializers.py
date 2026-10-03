from rest_framework import serializers
from apps.pld_engine.models import (
    ProductConfigurationVersion, ICPProfile, ICPRule, ScoreModel,
    QuestionnaireTemplate, QuestionnaireQuestion, QuestionAnswerOption,
    PipelineStage, StageGate
)


class StageGateSerializer(serializers.ModelSerializer):
    class Meta:
        model = StageGate
        fields = ['id', 'pipeline_stage', 'gate_code', 'gate_name', 'condition_rules', 'is_mandatory']


class PipelineStageSerializer(serializers.ModelSerializer):
    gates = StageGateSerializer(many=True, read_only=True)

    class Meta:
        model = PipelineStage
        fields = ['id', 'config_version', 'pipeline_type', 'stage_code', 'stage_name', 'sequence_order', 'is_required', 'gates']


class ICPRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ICPRule
        fields = [
            'id', 'config_version', 'profile', 'rule_type', 'field_name',
            'operator', 'target_value', 'weight', 'points', 'is_mandatory',
            'is_active', 'description', 'failure_reason'
        ]


class ICPProfileSerializer(serializers.ModelSerializer):
    rules = ICPRuleSerializer(many=True, read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.CharField(source='product.code', read_only=True)

    class Meta:
        model = ICPProfile
        fields = [
            'id', 'product', 'product_name', 'product_code', 'config_version',
            'name', 'version_number', 'is_active', 'description', 'rules'
        ]


class ScoreModelSerializer(serializers.ModelSerializer):
    dimension_display = serializers.CharField(source='get_dimension_name_display', read_only=True)

    class Meta:
        model = ScoreModel
        fields = [
            'id', 'config_version', 'dimension_name', 'dimension_display',
            'weight_percentage', 'input_mapping', 'thresholds', 'is_active'
        ]


class QuestionAnswerOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionAnswerOption
        fields = ['id', 'question', 'label', 'value', 'points', 'order', 'is_active']


class QuestionnaireQuestionSerializer(serializers.ModelSerializer):
    options = QuestionAnswerOptionSerializer(many=True, read_only=True)

    class Meta:
        model = QuestionnaireQuestion
        fields = [
            'id', 'template', 'code', 'question_text', 'question_type',
            'order', 'is_required', 'is_active', 'feeds_dimension',
            'dimension_weight_points', 'help_text', 'options'
        ]


class QuestionnaireTemplateSerializer(serializers.ModelSerializer):
    questions = QuestionnaireQuestionSerializer(many=True, read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = QuestionnaireTemplate
        fields = [
            'id', 'config_version', 'product', 'product_name', 'stage_code',
            'title', 'version_number', 'is_active', 'schema_json', 'questions'
        ]


class ProductConfigurationVersionSerializer(serializers.ModelSerializer):
    stages = PipelineStageSerializer(many=True, read_only=True)
    icp_rules = ICPRuleSerializer(many=True, read_only=True)
    score_models = ScoreModelSerializer(many=True, read_only=True)
    questionnaires = QuestionnaireTemplateSerializer(many=True, read_only=True)

    class Meta:
        model = ProductConfigurationVersion
        fields = [
            'id', 'product', 'version_number', 'status', 'published_at',
            'notes', 'stages', 'icp_rules', 'score_models', 'questionnaires'
        ]
