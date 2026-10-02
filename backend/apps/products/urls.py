from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.products.views import ProductViewSet, ProductModuleViewSet, ProductCapabilityViewSet, ProblemViewSet

router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')
router.register(r'modules', ProductModuleViewSet, basename='module')
router.register(r'capabilities', ProductCapabilityViewSet, basename='capability')
router.register(r'problems', ProblemViewSet, basename='problem')

urlpatterns = [
    path('', include(router.urls)),
]
