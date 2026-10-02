from rest_framework import serializers
from apps.evaluations.models import Demo, POC


class DemoSerializer(serializers.ModelSerializer):
    account_name = serializers.ReadOnlyField(source='account.company_name')
    presenter_name = serializers.ReadOnlyField(source='presenter.get_full_name')

    class Meta:
        model = Demo
        fields = [
            'id', 'account', 'account_name', 'lead', 'discovery', 'opportunity',
            'presenter', 'presenter_name', 'scheduled_at', 'conducted_at',
            'participants_notes', 'demonstrated_use_cases', 'customer_feedback',
            'objections_raised', 'fit_assessment', 'status', 'not_required_reason',
            'next_action_due_at', 'next_action_description'
        ]


class POCSerializer(serializers.ModelSerializer):
    account_name = serializers.ReadOnlyField(source='account.company_name')
    owner_name = serializers.ReadOnlyField(source='owner.get_full_name')

    class Meta:
        model = POC
        fields = [
            'id', 'account', 'account_name', 'lead', 'discovery', 'opportunity',
            'owner', 'owner_name', 'scope_description', 'users_count',
            'geography_coverage', 'start_date', 'end_date', 'success_criteria',
            'baseline_metrics', 'result_metrics', 'customer_feedback',
            'status', 'not_required_reason'
        ]
