from rest_framework import serializers
from apps.leads.models import Lead, LeadProductInterest, LeadTouch, LeadProblem, LeadSource, Campaign
from apps.products.serializers import ProblemSerializer


class LeadSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadSource
        fields = ['id', 'code', 'name', 'is_active']


class CampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campaign
        fields = ['id', 'code', 'name', 'campaign_type', 'start_date', 'end_date', 'budget']


class LeadProductInterestSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_code = serializers.ReadOnlyField(source='product.code')

    class Meta:
        model = LeadProductInterest
        fields = ['id', 'lead', 'product', 'product_name', 'product_code', 'interest_level', 'is_primary', 'evidence_notes']


class LeadTouchSerializer(serializers.ModelSerializer):
    source_name = serializers.ReadOnlyField(source='source.name')
    campaign_name = serializers.ReadOnlyField(source='campaign.name')
    partner_name = serializers.ReadOnlyField(source='partner.account.company_name')

    class Meta:
        model = LeadTouch
        fields = ['id', 'lead', 'campaign', 'campaign_name', 'partner', 'partner_name', 'source', 'source_name', 'touch_type', 'touch_date', 'utm_parameters']


class LeadProblemSerializer(serializers.ModelSerializer):
    problem_detail = ProblemSerializer(source='problem', read_only=True)

    class Meta:
        model = LeadProblem
        fields = [
            'id', 'lead', 'problem', 'problem_detail', 'category',
            'severity', 'frequency', 'business_impact', 'affected_users',
            'evidence', 'notes'
        ]


class LeadSerializer(serializers.ModelSerializer):
    account_name = serializers.ReadOnlyField(source='account.company_name')
    contact_name = serializers.ReadOnlyField(source='contact.first_name')
    primary_product_name = serializers.ReadOnlyField(source='primary_product.name')
    primary_product_code = serializers.ReadOnlyField(source='primary_product.code')
    current_stage_name = serializers.ReadOnlyField(source='current_stage.stage_name')
    current_stage_code = serializers.ReadOnlyField(source='current_stage.stage_code')
    owner_name = serializers.ReadOnlyField(source='owner.get_full_name')

    product_interests = LeadProductInterestSerializer(many=True, read_only=True)
    recorded_problems = LeadProblemSerializer(many=True, read_only=True)
    touches = LeadTouchSerializer(many=True, read_only=True)

    class Meta:
        model = Lead
        fields = [
            'id', 'account', 'account_name', 'contact', 'contact_name',
            'primary_product', 'primary_product_name', 'primary_product_code',
            'source', 'partner', 'owner', 'owner_name',
            'current_stage', 'current_stage_name', 'current_stage_code',
            'status', 'nurture_reason', 'disqualification_reason',
            'last_activity_at', 'next_activity_due_at', 'next_action_description',
            'product_interests', 'recorded_problems', 'touches', 'created_at'
        ]
