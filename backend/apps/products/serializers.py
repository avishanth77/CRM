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
    modules = ProductModuleSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = ['id', 'code', 'name', 'category', 'description', 'status', 'modules']


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
