from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.core.views import TerritoryViewSet, IndustryViewSet

router = DefaultRouter()
router.register(r'territories', TerritoryViewSet, basename='territory')
router.register(r'regions', TerritoryViewSet, basename='region')
router.register(r'industries', IndustryViewSet, basename='industry')

urlpatterns = [
    path('', include(router.urls)),
]
