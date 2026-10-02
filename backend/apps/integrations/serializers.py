from rest_framework import serializers
from apps.leads.models import Campaign, LeadTouch
from apps.integrations.models import CommunicationMessage, ERPConnectorConfig, ERPSyncRecord


class CampaignSerializer(serializers.ModelSerializer):
    touch_count = serializers.IntegerField(source='touches.count', read_only=True)

    class Meta:
        model = Campaign
        fields = [
            'id', 'code', 'name', 'campaign_type', 'budget',
            'start_date', 'end_date', 'touch_count', 'created_at'
        ]


class LeadTouchSerializer(serializers.ModelSerializer):
    campaign_name = serializers.CharField(source='campaign.name', read_only=True)
    company_name = serializers.CharField(source='lead.company_name', read_only=True)
    partner_name = serializers.CharField(source='partner.account.company_name', read_only=True)
    source_name = serializers.CharField(source='source.name', read_only=True)

    class Meta:
        model = LeadTouch
        fields = [
            'id', 'lead', 'company_name', 'campaign', 'campaign_name',
            'partner', 'partner_name', 'source', 'source_name',
            'touch_type', 'touch_date', 'utm_parameters', 'created_at'
        ]


class CommunicationMessageSerializer(serializers.ModelSerializer):
    lead_name = serializers.CharField(source='lead.company_name', read_only=True)
    account_name = serializers.CharField(source='account.company_name', read_only=True)

    class Meta:
        model = CommunicationMessage
        fields = [
            'id', 'channel', 'recipient_name', 'recipient_address',
            'lead', 'lead_name', 'account', 'account_name',
            'template_code', 'subject', 'body', 'status',
            'provider', 'provider_message_id', 'delivered_at', 'error_message',
            'created_at'
        ]


class ERPConnectorConfigSerializer(serializers.ModelSerializer):
    sync_records_count = serializers.IntegerField(source='sync_logs.count', read_only=True)

    class Meta:
        model = ERPConnectorConfig
        fields = [
            'id', 'system_type', 'system_name', 'base_endpoint',
            'auth_mode', 'api_key_masked', 'is_active', 'auto_sync_on_won',
            'last_sync_timestamp', 'sync_records_count', 'created_at'
        ]


class ERPSyncRecordSerializer(serializers.ModelSerializer):
    system_name = serializers.CharField(source='connector.system_name', read_only=True)
    system_type = serializers.CharField(source='connector.system_type', read_only=True)

    class Meta:
        model = ERPSyncRecord
        fields = [
            'id', 'connector', 'system_name', 'system_type',
            'entity_type', 'direction', 'crm_entity_id', 'crm_entity_name',
            'erp_reference_id', 'status', 'conflict_details',
            'payload', 'response_payload', 'created_at'
        ]
