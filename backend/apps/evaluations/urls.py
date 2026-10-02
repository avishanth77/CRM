from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.evaluations.views import DemoViewSet, POCViewSet

router = DefaultRouter()
router.register(r'demos', DemoViewSet, basename='demo')
router.register(r'pocs', POCViewSet, basename='poc')

urlpatterns = [
    path('', include(router.urls)),
]
