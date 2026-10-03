from rest_framework import serializers
from apps.pld_assessments.models import AccountProductAssessment, ScoreAssessment


class ScoreAssessmentSerializer(serializers.ModelSerializer):
    dimension_display = serializers.CharField(source='get_dimension_name_display', read_only=True)

    class Meta:
        model = ScoreAssessment
        fields = [
            'id', 'dimension_name', 'dimension_display', 'input_value', 'raw_score',
            'weight_percentage', 'weighted_score', 'evidence_text', 'explanation',
            'rule_version'
        ]


class AccountProductAssessmentSerializer(serializers.ModelSerializer):
    dimension_breakdown = ScoreAssessmentSerializer(many=True, read_only=True)
    account_name = serializers.ReadOnlyField(source='account.company_name')
    product_name = serializers.ReadOnlyField(source='product.name')
    product_code = serializers.ReadOnlyField(source='product.code')
    assessed_by_name = serializers.ReadOnlyField(source='assessed_by.get_full_name')
    overridden_by_name = serializers.ReadOnlyField(source='overridden_by.get_full_name')

    class Meta:
        model = AccountProductAssessment
        fields = [
            'id', 'account', 'account_name', 'product', 'product_name', 'product_code',
            'config_version', 'lead',
            'icp_result', 'icp_knockout_passed', 'icp_fit_score', 'icp_rule_version',
            'icp_reasons', 'icp_evidence', 'icp_breakdown',
            'pld_score', 'original_pld_score', 'score_model_version', 'score_classification',
            'pld_breakdown', 'questionnaire_answers', 'qualification_history',
            'is_overridden', 'override_reason', 'overridden_by', 'overridden_by_name', 'overridden_at',
            'assessed_at', 'assessed_by', 'assessed_by_name',
            'dimension_breakdown'
        ]
