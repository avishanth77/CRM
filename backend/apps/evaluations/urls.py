from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.evaluations.views import (
    DemoViewSet, DemoParticipantViewSet, DemoUseCaseMappingViewSet,
    POCViewSet, POCParticipantViewSet, POCSuccessCriterionViewSet
)

router = DefaultRouter()
router.register(r'demos', DemoViewSet, basename='demo')
router.register(r'demo-participants', DemoParticipantViewSet, basename='demo-participant')
router.register(r'demo-use-cases', DemoUseCaseMappingViewSet, basename='demo-use-case')
router.register(r'pocs', POCViewSet, basename='poc')
router.register(r'poc-participants', POCParticipantViewSet, basename='poc-participant')
router.register(r'poc-criteria', POCSuccessCriterionViewSet, basename='poc-criterion')

urlpatterns = [
    path('', include(router.urls)),
]
