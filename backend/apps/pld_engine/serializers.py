from rest_framework import serializers
from apps.pld_engine.models import (
    ProductConfigurationVersion, ICPRule, ScoreModel,
    QuestionnaireTemplate, PipelineStage, StageGate
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
        fields = ['id', 'config_version', 'rule_type', 'field_name', 'operator', 'target_value', 'weight', 'points', 'is_mandatory']


class ScoreModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScoreModel
        fields = ['id', 'config_version', 'dimension_name', 'weight_percentage', 'input_mapping', 'is_active']


class QuestionnaireTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionnaireTemplate
        fields = ['id', 'config_version', 'stage_code', 'title', 'schema_json']


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
