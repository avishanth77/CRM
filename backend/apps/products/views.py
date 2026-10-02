from rest_framework import viewsets, permissions
from apps.products.models import Product, ProductModule, ProductCapability, Problem, ProblemCapability
from apps.products.serializers import (
    ProductSerializer, ProductModuleSerializer, ProductCapabilitySerializer,
    ProblemSerializer, ProblemCapabilitySerializer
)


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().prefetch_related('modules__capabilities')
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]


class ProductModuleViewSet(viewsets.ModelViewSet):
    queryset = ProductModule.objects.all().prefetch_related('capabilities')
    serializer_class = ProductModuleSerializer
    permission_classes = [permissions.AllowAny]


class ProductCapabilityViewSet(viewsets.ModelViewSet):
    queryset = ProductCapability.objects.all()
    serializer_class = ProductCapabilitySerializer
    permission_classes = [permissions.AllowAny]


class ProblemViewSet(viewsets.ModelViewSet):
    queryset = Problem.objects.all().prefetch_related('capability_mappings__capability__module')
    serializer_class = ProblemSerializer
    permission_classes = [permissions.AllowAny]
