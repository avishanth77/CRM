from rest_framework import serializers
from apps.activities.models import (
    Activity, Task, Notification,
    SLADefinition, SLATracker,
    AutomationRule, AutomationExecutionLog
)


class ActivitySerializer(serializers.ModelSerializer):
    performed_by_name = serializers.ReadOnlyField(source='performed_by.get_full_name')
    account_name = serializers.ReadOnlyField(source='account.company_name')
    contact_name = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()
    opportunity_name = serializers.SerializerMethodField()
    partner_name = serializers.ReadOnlyField(source='partner.account.company_name')
    next_action_status = serializers.ReadOnlyField()

    class Meta:
        model = Activity
        fields = [
            'id', 'account', 'account_name', 'contact', 'contact_name',
            'lead', 'lead_name', 'opportunity', 'opportunity_name',
            'proposal', 'discovery', 'demo', 'poc',
            'partner', 'partner_name', 'deal_registration',
            'activity_type', 'custom_activity_type', 'subject', 'description_notes',
            'conducted_at', 'duration_minutes', 'status', 'priority',
            'outcome_notes', 'next_action_description', 'next_action_due_at',
            'next_action_status', 'performed_by', 'performed_by_name',
            'assigned_to', 'created_by', 'created_at', 'updated_at'
        ]

    def get_contact_name(self, obj):
        contact = getattr(obj, 'contact', None)
        if contact:
            return f"{contact.first_name} {contact.last_name or ''}".strip()
        return None

    def get_lead_name(self, obj):
        lead = getattr(obj, 'lead', None)
        if lead and getattr(lead, 'account', None):
            return f"Lead #{str(lead.id)[:8]} ({lead.account.company_name})"
        return None

    def get_opportunity_name(self, obj):
        opportunity = getattr(obj, 'opportunity', None)
        if opportunity and getattr(opportunity, 'account', None):
            return f"Opp #{str(opportunity.id)[:8]} ({opportunity.account.company_name})"
        return None


class TaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.ReadOnlyField(source='assigned_to.get_full_name')
    related_lead_title = serializers.SerializerMethodField()
    related_account_name = serializers.ReadOnlyField(source='related_account.company_name')
    is_overdue = serializers.ReadOnlyField()

    class Meta:
        model = Task
        fields = [
            'id', 'assigned_to', 'assigned_to_name', 'created_by',
            'related_lead', 'related_lead_title',
            'related_opportunity', 'related_account', 'related_account_name',
            'related_contact', 'related_discovery', 'related_demo',
            'related_poc', 'related_proposal', 'related_handoff',
            'source_activity', 'title', 'description',
            'task_type', 'priority', 'due_date',
            'status', 'is_completed', 'is_overdue', 'completed_at', 'created_at'
        ]

    def get_related_lead_title(self, obj):
        related_lead = getattr(obj, 'related_lead', None)
        if related_lead and getattr(related_lead, 'account', None):
            product_code = getattr(getattr(related_lead, 'primary_product', None), 'code', '')
            return f"{related_lead.account.company_name} [{product_code}]"
        return None


class NotificationSerializer(serializers.ModelSerializer):
    recipient_name = serializers.ReadOnlyField(source='recipient.get_full_name')
    recipient_email = serializers.ReadOnlyField(source='recipient.email')

    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'recipient_name', 'recipient_email',
            'title', 'message', 'notification_type', 'priority',
            'is_read', 'read_at', 'related_entity_type', 'related_entity_id',
            'action_url', 'email_dispatched', 'created_at'
        ]


class SLADefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SLADefinition
        fields = [
            'id', 'name', 'entity_type', 'target_duration_hours',
            'warning_threshold_pct', 'escalation_role', 'escalation_action',
            'is_active', 'description', 'created_at'
        ]


class SLATrackerSerializer(serializers.ModelSerializer):
    definition_name = serializers.ReadOnlyField(source='definition.name')
    assigned_user_name = serializers.ReadOnlyField(source='assigned_user.get_full_name')
    remaining_hours = serializers.ReadOnlyField()

    class Meta:
        model = SLATracker
        fields = [
            'id', 'definition', 'definition_name', 'entity_type', 'entity_id',
            'assigned_user', 'assigned_user_name', 'start_time', 'due_time',
            'completed_time', 'status', 'remaining_hours', 'is_escalated',
            'escalated_at', 'created_at'
        ]


class AutomationRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationRule
        fields = [
            'id', 'name', 'trigger_type', 'is_active',
            'conditions_json', 'action_type', 'action_config_json',
            'last_run_at', 'execution_count', 'created_at'
        ]


class AutomationExecutionLogSerializer(serializers.ModelSerializer):
    rule_name = serializers.ReadOnlyField(source='rule.name')

    class Meta:
        model = AutomationExecutionLog
        fields = [
            'id', 'rule', 'rule_name', 'trigger_event',
            'target_entity_type', 'target_entity_id',
            'status', 'details', 'executed_at'
        ]
