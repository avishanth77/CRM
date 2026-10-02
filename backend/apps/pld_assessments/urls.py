from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.pld_assessments.views import AccountProductAssessmentViewSet, ScoreAssessmentViewSet

router = DefaultRouter()
router.register(r'assessments', AccountProductAssessmentViewSet, basename='assessment')
router.register(r'score-breakdowns', ScoreAssessmentViewSet, basename='score-breakdown')

urlpatterns = [
    path('', include(router.urls)),
]
