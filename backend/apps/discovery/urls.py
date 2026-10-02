from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.discovery.views import DiscoveryViewSet, DiscoveryProblemViewSet

router = DefaultRouter()
router.register(r'discoveries', DiscoveryViewSet, basename='discovery')
router.register(r'discovery-problems', DiscoveryProblemViewSet, basename='discovery-problem')

urlpatterns = [
    path('', include(router.urls)),
]
