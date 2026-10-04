from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.activities.views import (
    ActivityViewSet, TaskViewSet, NotificationViewSet,
    SLADefinitionViewSet, SLATrackerViewSet, AutomationRuleViewSet,
    WorkQueueView, WorkQueueActionView, OperationalMetricsView
)

router = DefaultRouter()
router.register(r'activities', ActivityViewSet, basename='activity')
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'sla-definitions', SLADefinitionViewSet, basename='sla-definition')
router.register(r'sla-trackers', SLATrackerViewSet, basename='sla-tracker')
router.register(r'automation-rules', AutomationRuleViewSet, basename='automation-rule')

urlpatterns = [
    path('work-queue/', WorkQueueView.as_view(), name='work-queue'),
    path('work-queue/action/<str:action_name>/', WorkQueueActionView.as_view(), name='work-queue-action'),
    path('operational-metrics/', OperationalMetricsView.as_view(), name='operational-metrics'),
    path('', include(router.urls)),
]
