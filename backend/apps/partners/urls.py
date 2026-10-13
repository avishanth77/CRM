from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.partners.views import (
    PartnerViewSet, PartnerTypeMasterViewSet, PartnerUserViewSet,
    PartnerProductViewSet, PartnerTerritoryViewSet,
    PartnerCertificationViewSet, DealRegistrationViewSet,
    ChannelConflictViewSet, PartnerInfluenceViewSet,
    PartnerCommissionViewSet, PartnerChannelConfigView,
    PartnerPortalDashboardView
)

router = DefaultRouter()
router.register(r'partners', PartnerViewSet, basename='partner')
router.register(r'partner-types', PartnerTypeMasterViewSet, basename='partner-type')
router.register(r'partner-users', PartnerUserViewSet, basename='partner-user')
router.register(r'partner-products', PartnerProductViewSet, basename='partner-product')
router.register(r'partner-territories', PartnerTerritoryViewSet, basename='partner-territory')
router.register(r'partner-certifications', PartnerCertificationViewSet, basename='partner-certification')
router.register(r'deal-registrations', DealRegistrationViewSet, basename='deal-registration')
router.register(r'channel-conflicts', ChannelConflictViewSet, basename='channel-conflict')
router.register(r'partner-influences', PartnerInfluenceViewSet, basename='partner-influence')
router.register(r'partner-commissions', PartnerCommissionViewSet, basename='partner-commission')

urlpatterns = [
    path('partner-portal/dashboard/', PartnerPortalDashboardView.as_view(), name='partner-portal-dashboard'),
    path('partner-channel-config/', PartnerChannelConfigView.as_view(), name='partner-channel-config'),
    path('', include(router.urls)),
]
