from rest_framework import serializers
from apps.activities.models import Activity, Task


class ActivitySerializer(serializers.ModelSerializer):
    performed_by_name = serializers.ReadOnlyField(source='performed_by.get_full_name')
    account_name = serializers.ReadOnlyField(source='account.company_name')
    contact_name = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()
    opportunity_name = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = [
            'id', 'account', 'account_name', 'contact', 'contact_name',
            'lead', 'lead_name', 'opportunity', 'opportunity_name',
            'activity_type', 'subject', 'description_notes',
            'conducted_at', 'outcome_notes',
            'next_action_description', 'next_action_due_at',
            'performed_by', 'performed_by_name', 'created_at'
        ]

    def get_contact_name(self, obj):
        if obj.contact:
            return f"{obj.contact.first_name} {obj.contact.last_name or ''}".strip()
        return None

    def get_lead_name(self, obj):
        if obj.lead and obj.lead.account:
            return f"Lead #{str(obj.lead.id)[:8]} ({obj.lead.account.company_name})"
        return None

    def get_opportunity_name(self, obj):
        if obj.opportunity and obj.opportunity.account:
            return f"Opp #{str(obj.opportunity.id)[:8]} ({obj.opportunity.account.company_name})"
        return None


class TaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.ReadOnlyField(source='assigned_to.get_full_name')
    related_lead_title = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id', 'assigned_to', 'assigned_to_name',
            'related_lead', 'related_lead_title',
            'related_opportunity', 'title', 'description',
            'task_type', 'priority', 'due_date',
            'is_completed', 'completed_at', 'created_at'
        ]

    def get_related_lead_title(self, obj):
        if obj.related_lead and obj.related_lead.account:
            return f"{obj.related_lead.account.company_name} [{obj.related_lead.primary_product.code if obj.related_lead.primary_product else ''}]"
        return None
