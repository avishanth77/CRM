from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.partners.views import (
    PartnerViewSet, PartnerProductViewSet,
    DealRegistrationViewSet, PartnerCommissionViewSet,
    PartnerPortalDashboardView
)

router = DefaultRouter()
router.register(r'partners', PartnerViewSet, basename='partner')
router.register(r'partner-products', PartnerProductViewSet, basename='partner-product')
router.register(r'deal-registrations', DealRegistrationViewSet, basename='deal-registration')
router.register(r'partner-commissions', PartnerCommissionViewSet, basename='partner-commission')

urlpatterns = [
    path('partner-portal/dashboard/', PartnerPortalDashboardView.as_view(), name='partner-portal-dashboard'),
    path('', include(router.urls)),
]
