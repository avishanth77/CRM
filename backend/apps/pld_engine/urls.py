from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.pld_engine.views import (
    ProductConfigurationVersionViewSet, PipelineStageViewSet,
    StageGateViewSet, QuestionnaireTemplateViewSet,
    QuestionnaireQuestionViewSet, QuestionAnswerOptionViewSet,
    ICPProfileViewSet, ICPRuleViewSet, ScoreModelViewSet,
    ICPEndpointViewSet, PLDEndpointViewSet
)

router = DefaultRouter()
router.register(r'configurations', ProductConfigurationVersionViewSet, basename='configuration')
router.register(r'product-configs', ProductConfigurationVersionViewSet, basename='product-config')
router.register(r'stages', PipelineStageViewSet, basename='stage')
router.register(r'gates', StageGateViewSet, basename='gate')
router.register(r'questionnaires', QuestionnaireTemplateViewSet, basename='questionnaire')
router.register(r'questionnaire-questions', QuestionnaireQuestionViewSet, basename='questionnaire-question')
router.register(r'question-options', QuestionAnswerOptionViewSet, basename='question-option')
router.register(r'icp-profiles', ICPProfileViewSet, basename='icp-profile')
router.register(r'icp-rules', ICPRuleViewSet, basename='icp-rule')
router.register(r'score-models', ScoreModelViewSet, basename='score-model')
router.register(r'icp', ICPEndpointViewSet, basename='icp-api')
router.register(r'pld', PLDEndpointViewSet, basename='pld-api')

urlpatterns = [
    path('', include(router.urls)),
]
