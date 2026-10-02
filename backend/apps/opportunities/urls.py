from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.opportunities.views import OpportunityViewSet, OpportunityProductViewSet, ProposalViewSet

router = DefaultRouter()
router.register(r'opportunities', OpportunityViewSet, basename='opportunity')
router.register(r'opportunity-products', OpportunityProductViewSet, basename='opportunity-product')
router.register(r'proposals', ProposalViewSet, basename='proposal')

urlpatterns = [
    path('', include(router.urls)),
]
