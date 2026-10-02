from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.discovery.models import Discovery, DiscoveryProblem
from apps.discovery.serializers import DiscoverySerializer, DiscoveryProblemSerializer
from apps.products.models import ProblemCapability


class DiscoveryViewSet(viewsets.ModelViewSet):
    queryset = Discovery.objects.all().prefetch_related('problems__problem__capability_mappings')
    serializer_class = DiscoverySerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        discovery = serializer.save(conducted_by=user)

        # TEXOL SPECIFICATION: Carry forward confirmed lead problems into Discovery automatically
        if discovery.lead:
            for lp in discovery.lead.recorded_problems.all():
                DiscoveryProblem.objects.get_or_create(
                    discovery=discovery,
                    problem=lp.problem,
                    defaults={
                        'lead_problem': lp,
                        'impact_description': lp.notes or 'Carried forward from PLD Qualification',
                        'severity': 'HIGH'
                    }
                )

    @action(detail=True, methods=['post'], url_path='complete-mapping')
    def complete_mapping(self, request, pk=None):
        discovery = self.get_object()
        problems = discovery.problems.all()

        if not problems.exists():
            return Response({'error': 'Cannot complete mapping without at least one documented problem'}, status=status.HTTP_400_BAD_REQUEST)

        unmapped = []
        for dp in problems:
            has_mapping = ProblemCapability.objects.filter(
                problem=dp.problem,
                capability__product=discovery.lead.primary_product
            ).exists()
            if not has_mapping:
                unmapped.append(dp.problem.name)

        if unmapped:
            return Response({
                'error': 'The following problems do not map to any capability in ' + discovery.lead.primary_product.name,
                'unmapped_problems': unmapped
            }, status=status.HTTP_400_BAD_REQUEST)

        discovery.is_product_mapping_complete = True
        discovery.completed_at = timezone.now()
        discovery.save(update_fields=['is_product_mapping_complete', 'completed_at'])

        return Response({
            'message': 'Product mapping gate verified and completed successfully',
            'discovery': DiscoverySerializer(discovery).data
        }, status=status.HTTP_200_OK)


class DiscoveryProblemViewSet(viewsets.ModelViewSet):
    queryset = DiscoveryProblem.objects.all()
    serializer_class = DiscoveryProblemSerializer
    permission_classes = [permissions.AllowAny]
