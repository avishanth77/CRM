from rest_framework import serializers
from apps.pld_assessments.models import AccountProductAssessment, ScoreAssessment


class ScoreAssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScoreAssessment
        fields = [
            'id', 'dimension_name', 'input_value', 'raw_score',
            'weight_percentage', 'weighted_score', 'evidence_text'
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
            'icp_knockout_passed', 'icp_fit_score',
            'pld_score', 'score_classification',
            'is_overridden', 'override_reason', 'overridden_by', 'overridden_by_name',
            'assessed_at', 'assessed_by', 'assessed_by_name',
            'dimension_breakdown'
        ]
