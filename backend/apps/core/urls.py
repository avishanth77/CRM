from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.core.views import TerritoryViewSet

router = DefaultRouter()
router.register(r'territories', TerritoryViewSet, basename='territory')
router.register(r'regions', TerritoryViewSet, basename='region')

urlpatterns = [
    path('', include(router.urls)),
]
