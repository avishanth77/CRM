from rest_framework import viewsets, permissions
from apps.products.models import Product, ProductModule, ProductCapability, Problem, ProblemCapability
from apps.products.serializers import (
    ProductSerializer, ProductModuleSerializer, ProductCapabilitySerializer,
    ProblemSerializer, ProblemCapabilitySerializer
)


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().prefetch_related('modules__capabilities')
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        product = serializer.save()
        from apps.pld_engine.models import ProductConfigurationVersion, ICPProfile, ConfigStatus
        config_version, _ = ProductConfigurationVersion.objects.get_or_create(
            product=product,
            version_number=1,
            defaults={
                'status': ConfigStatus.PUBLISHED,
                'notes': f'Initial default configuration version for {product.name}'
            }
        )
        ICPProfile.objects.get_or_create(
            product=product,
            config_version=config_version,
            defaults={
                'name': f'{product.name} Standard ICP Profile',
                'pass_threshold': 50,
                'is_active': True,
                'description': f'Standard qualification profile for {product.name}'
            }
        )

    def perform_update(self, serializer):
        product = serializer.save()
        from apps.pld_engine.models import ICPProfile
        ICPProfile.objects.filter(product=product).update(description=f'Standard qualification profile for {product.name}')

    def perform_destroy(self, instance):
        leads_count = instance.primary_leads.count()
        if leads_count > 0:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                f"Cannot delete product '{instance.name}' because {leads_count} commercial lead(s) are currently associated with it. Please reassign those leads first or set this product status to 'ARCHIVED'."
            )
        opps_count = instance.opportunity_lines.count()
        if opps_count > 0:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                f"Cannot delete product '{instance.name}' because {opps_count} opportunity deal(s) are associated with it. Please archive the product instead."
            )

        import time
        from apps.pld_engine.models import ProductConfigurationVersion, ICPProfile
        ProductConfigurationVersion.objects.filter(product=instance).delete()
        ICPProfile.objects.filter(product=instance).delete()

        instance.code = f"{instance.code}_DEL_{int(time.time())}"
        instance.save(update_fields=['code'])
        instance.delete()


class ProductModuleViewSet(viewsets.ModelViewSet):
    queryset = ProductModule.objects.all().prefetch_related('capabilities')
    serializer_class = ProductModuleSerializer
    permission_classes = [permissions.IsAuthenticated]


class ProductCapabilityViewSet(viewsets.ModelViewSet):
    queryset = ProductCapability.objects.all()
    serializer_class = ProductCapabilitySerializer
    permission_classes = [permissions.IsAuthenticated]


class ProblemViewSet(viewsets.ModelViewSet):
    queryset = Problem.objects.all().prefetch_related('capability_mappings__capability__module')
    serializer_class = ProblemSerializer
    permission_classes = [permissions.IsAuthenticated]
