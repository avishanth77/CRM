from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.discovery.views import (
    DiscoveryViewSet, DiscoveryProblemViewSet,
    DiscoveryProblemMappingViewSet, DiscoveryStakeholderViewSet
)

router = DefaultRouter()
router.register(r'discoveries', DiscoveryViewSet, basename='discovery')
router.register(r'discovery-problems', DiscoveryProblemViewSet, basename='discovery-problem')
router.register(r'discovery-mappings', DiscoveryProblemMappingViewSet, basename='discovery-mapping')
router.register(r'discovery-stakeholders', DiscoveryStakeholderViewSet, basename='discovery-stakeholder')

urlpatterns = [
    path('', include(router.urls)),
]
