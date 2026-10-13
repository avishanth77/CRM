from rest_framework import serializers
from apps.leads.models import Lead, LeadProductInterest, LeadTouch, LeadProblem, LeadSource, Campaign
from apps.products.serializers import ProblemSerializer


class LeadSourceSerializer(serializers.ModelSerializer):
    code = serializers.CharField(max_length=64, required=False)

    class Meta:
        model = LeadSource
        fields = ['id', 'code', 'name', 'is_active']

    def validate(self, attrs):
        name = attrs.get('name')
        if not attrs.get('code') and name:
            import re
            base_code = re.sub(r'[^A-Z0-9_]+', '_', name.strip().upper()).strip('_')
            if not base_code:
                base_code = 'SOURCE'
            code = base_code
            counter = 1
            while LeadSource.objects.filter(code=code).exists():
                code = f"{base_code}_{counter}"
                counter += 1
            attrs['code'] = code
        return attrs


class CampaignSerializer(serializers.ModelSerializer):
    source_name = serializers.ReadOnlyField(source='source.name')
    product_name = serializers.ReadOnlyField(source='product.name')
    owner_name = serializers.ReadOnlyField(source='owner.get_full_name')

    class Meta:
        model = Campaign
        fields = [
            'id', 'code', 'name', 'campaign_type', 'source', 'source_name',
            'product', 'product_name', 'status', 'owner', 'owner_name',
            'start_date', 'end_date', 'budget', 'actual_cost', 'description', 'created_at'
        ]


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
    recorded_by_name = serializers.ReadOnlyField(source='recorded_by.get_full_name')

    class Meta:
        model = LeadTouch
        fields = [
            'id', 'lead', 'campaign', 'campaign_name', 'partner', 'partner_name',
            'source', 'source_name', 'touch_type', 'touch_date', 'is_first_touch',
            'is_last_touch', 'utm_parameters', 'metadata', 'recorded_by', 'recorded_by_name'
        ]


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
    account_city = serializers.ReadOnlyField(source='account.city')
    account_country = serializers.ReadOnlyField(source='account.country')
    contact_name = serializers.SerializerMethodField()
    contact_email = serializers.ReadOnlyField(source='contact.email')
    contact_phone = serializers.ReadOnlyField(source='contact.phone')
    contact_designation = serializers.ReadOnlyField(source='contact.designation')
    primary_product_name = serializers.ReadOnlyField(source='primary_product.name')
    primary_product_code = serializers.ReadOnlyField(source='primary_product.code')
    current_stage_name = serializers.ReadOnlyField(source='current_stage.stage_name')
    current_stage_code = serializers.ReadOnlyField(source='current_stage.stage_code')
    owner_name = serializers.ReadOnlyField(source='owner.get_full_name')
    owner_email = serializers.ReadOnlyField(source='owner.email')
    partner_name = serializers.ReadOnlyField(source='partner.account.company_name')
    source_name = serializers.ReadOnlyField(source='source.name')
    domain = serializers.ReadOnlyField(source='account.domain')
    industry = serializers.ReadOnlyField(source='account.industry')
    employees_count = serializers.ReadOnlyField(source='account.employees_count')
    is_target_account = serializers.ReadOnlyField(source='account.is_target_account')
    target_tier = serializers.ReadOnlyField(source='account.target_tier')

    pld_score = serializers.SerializerMethodField()
    score_classification = serializers.SerializerMethodField()
    icp_knockout_passed = serializers.SerializerMethodField()
    icp_result = serializers.SerializerMethodField()
    icp_fit_score = serializers.SerializerMethodField()
    icp_reasons = serializers.SerializerMethodField()

    product_interests = LeadProductInterestSerializer(many=True, read_only=True)
    recorded_problems = LeadProblemSerializer(many=True, read_only=True)
    touches = LeadTouchSerializer(many=True, read_only=True)
    icp_attributes = serializers.DictField(required=False, write_only=True)

    class Meta:
        model = Lead
        fields = [
            'id', 'account', 'account_name', 'account_city', 'account_country',
            'domain', 'industry', 'employees_count', 'is_target_account', 'target_tier',
            'contact', 'contact_name',
            'contact_email', 'contact_phone', 'contact_designation',
            'primary_product', 'primary_product_name', 'primary_product_code',
            'source', 'source_name', 'partner', 'partner_name', 'owner', 'owner_name', 'owner_email',
            'current_stage', 'current_stage_name', 'current_stage_code',
            'status', 'nurture_reason', 'disqualification_reason',
            'pld_score', 'score_classification', 'icp_knockout_passed',
            'icp_result', 'icp_fit_score', 'icp_reasons',
            'last_activity_at', 'next_activity_due_at', 'next_action_description',
            'estimated_opportunity_value', 'timeline_expectation',
            'product_interests', 'recorded_problems', 'touches', 'created_at', 'updated_at',
            'icp_attributes'
        ]

    def create(self, validated_data):
        icp_attributes = validated_data.pop('icp_attributes', None)
        instance = super().create(validated_data)
        if icp_attributes and instance.account and instance.primary_product and isinstance(icp_attributes, dict):
            from apps.accounts.models import AccountAttribute
            for k, v in icp_attributes.items():
                if v is not None:
                    AccountAttribute.objects.update_or_create(
                        account=instance.account,
                        product=instance.primary_product,
                        attribute_key=k,
                        defaults={'attribute_value': v}
                    )
        return instance

    def _get_latest_assessment(self, obj):
        ass = obj.assessments.order_by('-assessed_at').first()
        if not ass and obj.account and obj.primary_product:
            ass = obj.account.assessments.filter(product=obj.primary_product).order_by('-assessed_at').first()
        return ass

    def get_contact_name(self, obj):
        if obj.contact:
            full = f"{obj.contact.first_name} {obj.contact.last_name or ''}".strip()
            return full or obj.contact.first_name
        return None

    def get_pld_score(self, obj):
        ass = self._get_latest_assessment(obj)
        return ass.pld_score if ass else None

    def get_score_classification(self, obj):
        ass = self._get_latest_assessment(obj)
        return ass.score_classification if ass else None

    def get_icp_knockout_passed(self, obj):
        ass = self._get_latest_assessment(obj)
        return ass.icp_knockout_passed if ass else None

    def get_icp_result(self, obj):
        ass = self._get_latest_assessment(obj)
        return ass.icp_result if ass else None

    def get_icp_fit_score(self, obj):
        ass = self._get_latest_assessment(obj)
        return ass.icp_fit_score if ass else None

    def get_icp_reasons(self, obj):
        ass = self._get_latest_assessment(obj)
        return ass.icp_reasons if ass else []
