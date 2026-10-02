from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.pld_engine.views import (
    ProductConfigurationVersionViewSet, PipelineStageViewSet,
    StageGateViewSet, QuestionnaireTemplateViewSet
)

router = DefaultRouter()
router.register(r'configurations', ProductConfigurationVersionViewSet, basename='configuration')
router.register(r'stages', PipelineStageViewSet, basename='stage')
router.register(r'gates', StageGateViewSet, basename='gate')
router.register(r'questionnaires', QuestionnaireTemplateViewSet, basename='questionnaire')

urlpatterns = [
    path('', include(router.urls)),
]
