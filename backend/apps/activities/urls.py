from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.activities.views import ActivityViewSet, TaskViewSet

router = DefaultRouter()
router.register(r'activities', ActivityViewSet, basename='activity')
router.register(r'tasks', TaskViewSet, basename='task')

urlpatterns = [
    path('', include(router.urls)),
]
