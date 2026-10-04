from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.opportunities.views import (
    OpportunityViewSet, OpportunityProductViewSet,
    OpportunityModuleViewSet, OpportunityCapabilityViewSet,
    ProposalViewSet, ProposalVersionViewSet,
    ProposalItemViewSet, ApprovalRuleViewSet
)

router = DefaultRouter()
router.register(r'opportunities', OpportunityViewSet, basename='opportunity')
router.register(r'opportunity-products', OpportunityProductViewSet, basename='opportunity-product')
router.register(r'opportunity-modules', OpportunityModuleViewSet, basename='opportunity-module')
router.register(r'opportunity-capabilities', OpportunityCapabilityViewSet, basename='opportunity-capability')
router.register(r'proposals', ProposalViewSet, basename='proposal')
router.register(r'proposal-versions', ProposalVersionViewSet, basename='proposal-version')
router.register(r'proposal-items', ProposalItemViewSet, basename='proposal-item')
router.register(r'approval-rules', ApprovalRuleViewSet, basename='approval-rule')

urlpatterns = [
    path('', include(router.urls)),
]
