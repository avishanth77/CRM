from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.leads.views import (
    LeadViewSet, LeadSourceViewSet,
    CampaignViewSet, LeadTouchViewSet,
    WebsiteLeadIngestView
)

router = DefaultRouter()
router.register(r'leads', LeadViewSet, basename='lead')
router.register(r'sources', LeadSourceViewSet, basename='source')
router.register(r'campaigns', CampaignViewSet, basename='campaign')
router.register(r'touches', LeadTouchViewSet, basename='touch')

urlpatterns = [
    path('website-leads/', WebsiteLeadIngestView.as_view(), name='website-leads-direct'),
    path('leads/website/', WebsiteLeadIngestView.as_view(), name='website-lead-intake'),
    path('', include(router.urls)),
]
