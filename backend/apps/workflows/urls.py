from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.workflows.views import ApprovalViewSet, StageHistoryViewSet

router = DefaultRouter()
router.register(r'approvals', ApprovalViewSet, basename='approval')
router.register(r'stage-histories', StageHistoryViewSet, basename='stage-history')

urlpatterns = [
    path('', include(router.urls)),
]
