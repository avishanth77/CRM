from rest_framework import serializers
from apps.discovery.models import Discovery, DiscoveryProblem
from apps.products.serializers import ProblemSerializer


class DiscoveryProblemSerializer(serializers.ModelSerializer):
    problem_detail = ProblemSerializer(source='problem', read_only=True)

    class Meta:
        model = DiscoveryProblem
        fields = [
            'id', 'discovery', 'problem', 'problem_detail',
            'lead_problem', 'severity', 'frequency',
            'impact_description', 'quantified_loss_value'
        ]


class DiscoverySerializer(serializers.ModelSerializer):
    problems = DiscoveryProblemSerializer(many=True, read_only=True)
    account_name = serializers.ReadOnlyField(source='account.company_name')
    conducted_by_name = serializers.ReadOnlyField(source='conducted_by.get_full_name')

    class Meta:
        model = Discovery
        fields = [
            'id', 'lead', 'account', 'account_name', 'conducted_by',
            'conducted_by_name', 'current_process_notes', 'business_impact_summary',
            'stakeholders_involved_notes', 'decision_process_notes',
            'timeline_notes', 'budget_notes', 'technical_constraints_notes',
            'is_product_mapping_complete', 'completed_at', 'problems'
        ]
