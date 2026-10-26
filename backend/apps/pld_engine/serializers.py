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

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        if data.get('rule_type') == 'FIT_CRITERIA':
            data['rule_type'] = 'FIT'
        if data.get('operator') == 'EXACT':
            data['operator'] = 'EQ'
        if 'weight' in data and 'points' not in data:
            data['points'] = data['weight']
        if not data.get('config_version') and data.get('profile'):
            try:
                prof = ICPProfile.objects.get(id=data['profile'])
                if prof.config_version_id:
                    data['config_version'] = str(prof.config_version_id)
                elif prof.product:
                    cfg = prof.product.configurations.first()
                    if cfg:
                        data['config_version'] = str(cfg.id)
            except Exception:
                pass
        elif not data.get('config_version') and data.get('product'):
            try:
                from apps.products.models import Product
                prod = Product.objects.get(id=data['product'])
                cfg = prod.configurations.first()
                if cfg:
                    data['config_version'] = str(cfg.id)
            except Exception:
                pass
        return super().to_internal_value(data)


class ICPProfileSerializer(serializers.ModelSerializer):
    rules = ICPRuleSerializer(many=True, read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.CharField(source='product.code', read_only=True)

    class Meta:
        model = ICPProfile
        fields = [
            'id', 'product', 'product_name', 'product_code', 'config_version',
            'name', 'version_number', 'is_active', 'pass_threshold', 'description', 'rules'
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
    score_value = serializers.IntegerField(source='points', required=False)
    code = serializers.CharField(source='value', required=False)

    class Meta:
        model = QuestionAnswerOption
        fields = ['id', 'question', 'label', 'value', 'code', 'points', 'score_value', 'order', 'is_active']

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'score_value' in data and 'points' not in data:
            data['points'] = data['score_value']
        if 'code' in data and 'value' not in data:
            data['value'] = data['code']
        if 'value' not in data and 'label' in data:
            data['value'] = data['label']
        if 'points' not in data:
            data['points'] = 50
        return super().to_internal_value(data)


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
