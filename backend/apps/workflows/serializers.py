from rest_framework import serializers
from apps.workflows.models import Approval, StageHistory


class ApprovalSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.ReadOnlyField(source='requested_by.get_full_name')
    approver_name = serializers.ReadOnlyField(source='approver.get_full_name')

    class Meta:
        model = Approval
        fields = [
            'id', 'record_type', 'record_id', 'approval_type',
            'requested_by', 'requested_by_name',
            'approver', 'approver_name', 'status',
            'justification_notes', 'decision_notes',
            'decision_date', 'created_at'
        ]


class StageHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.ReadOnlyField(source='changed_by.get_full_name')
    from_stage_name = serializers.ReadOnlyField(source='from_stage.stage_name')
    to_stage_name = serializers.ReadOnlyField(source='to_stage.stage_name')

    class Meta:
        model = StageHistory
        fields = [
            'id', 'record_type', 'record_id', 'from_stage', 'from_stage_name',
            'to_stage', 'to_stage_name', 'transition_reason', 'is_override',
            'changed_by', 'changed_by_name', 'created_at'
        ]
