from rest_framework import serializers
from apps.products.models import Product, ProductModule, ProductCapability, Problem, ProblemCapability


class ProductCapabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCapability
        fields = ['id', 'product', 'module', 'code', 'name', 'description', 'is_active']


class ProductModuleSerializer(serializers.ModelSerializer):
    capabilities = ProductCapabilitySerializer(many=True, read_only=True)

    class Meta:
        model = ProductModule
        fields = ['id', 'product', 'code', 'name', 'description', 'is_active', 'capabilities']


class ProductSerializer(serializers.ModelSerializer):
    code = serializers.CharField(max_length=64, required=False)
    modules = ProductModuleSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = ['id', 'code', 'name', 'category', 'description', 'status', 'modules']

    def validate(self, attrs):
        name = attrs.get('name')
        if name:
            attrs['name'] = name.strip()
        code = attrs.get('code')
        instance_id = self.instance.id if self.instance else None

        if not code and name:
            import re
            base_code = re.sub(r'[^A-Z0-9_]+', '_', name.strip().upper()).strip('_')
            if not base_code:
                base_code = 'PRODUCT'
            code = base_code
            counter = 1
            while Product.objects.filter(code=code).exclude(id=instance_id).exists():
                code = f"{base_code}_{counter}"
                counter += 1
            attrs['code'] = code
        elif code:
            code = code.strip().upper()
            if Product.objects.filter(code=code).exclude(id=instance_id).exists():
                raise serializers.ValidationError({"code": f"A product with code '{code}' already exists."})
            attrs['code'] = code
        return attrs


class ProblemCapabilitySerializer(serializers.ModelSerializer):
    capability_name = serializers.ReadOnlyField(source='capability.name')
    module_name = serializers.ReadOnlyField(source='capability.module.name')
    product_name = serializers.ReadOnlyField(source='capability.product.name')

    class Meta:
        model = ProblemCapability
        fields = ['id', 'problem', 'capability', 'capability_name', 'module_name', 'product_name', 'expected_kpi_impact']


class ProblemSerializer(serializers.ModelSerializer):
    capability_mappings = ProblemCapabilitySerializer(many=True, read_only=True)

    class Meta:
        model = Problem
        fields = ['id', 'code', 'category', 'name', 'description', 'default_severity', 'capability_mappings']
