from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.sales_handoff.views import SQLHandoffViewSet

router = DefaultRouter()
router.register(r'sql-handoffs', SQLHandoffViewSet, basename='sql-handoff')

urlpatterns = [
    path('', include(router.urls)),
]
