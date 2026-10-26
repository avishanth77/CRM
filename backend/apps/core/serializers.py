import re
from rest_framework import serializers
from apps.core.models import Territory
from apps.authentication.models import User


class TerritorySerializer(serializers.ModelSerializer):
    code = serializers.CharField(max_length=64, required=False)
    regional_manager_name = serializers.SerializerMethodField()
    regional_manager_email = serializers.SerializerMethodField()

    class Meta:
        model = Territory
        fields = [
            'id', 'name', 'code', 'country', 'regional_manager',
            'regional_manager_name', 'regional_manager_email',
            'description', 'is_active', 'sort_order', 'created_at', 'updated_at'
        ]

    def get_regional_manager_name(self, obj):
        if obj.regional_manager:
            return obj.regional_manager.get_full_name() or obj.regional_manager.username
        return None

    def get_regional_manager_email(self, obj):
        if obj.regional_manager:
            return obj.regional_manager.email
        return None

    def validate(self, attrs):
        name = attrs.get('name')
        if not attrs.get('code') and name:
            base_code = re.sub(r'[^A-Z0-9_]+', '_', name.strip().upper()).strip('_')
            if not base_code:
                base_code = 'TERRITORY'
            code = base_code
            counter = 1
            while Territory.objects.filter(code=code).exclude(id=self.instance.id if self.instance else None).exists():
                code = f"{base_code}_{counter}"
                counter += 1
            attrs['code'] = code
        return attrs
