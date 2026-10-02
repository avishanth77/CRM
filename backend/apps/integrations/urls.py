from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.integrations.views import (
    CampaignViewSet, LeadTouchViewSet, AttributionAnalyticsView,
    InboundWebhookLeadView, CommunicationViewSet, ERPConnectorViewSet, ERPSyncRecordViewSet
)

router = DefaultRouter()
router.register(r'campaigns', CampaignViewSet, basename='campaign')
router.register(r'lead-touches', LeadTouchViewSet, basename='lead-touch')
router.register(r'communications', CommunicationViewSet, basename='communication')
router.register(r'erp-connectors', ERPConnectorViewSet, basename='erp-connector')
router.register(r'erp-sync-logs', ERPSyncRecordViewSet, basename='erp-sync-log')

urlpatterns = [
    path('integrations/attribution/', AttributionAnalyticsView.as_view(), name='attribution-analytics'),
    path('integrations/inbound-lead/', InboundWebhookLeadView.as_view(), name='inbound-lead-webhook'),
    path('', include(router.urls)),
]
