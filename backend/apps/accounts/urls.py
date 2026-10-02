from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.accounts.views import (
    AccountViewSet, ContactViewSet,
    AccountAttributeViewSet, AccountProductViewSet
)

router = DefaultRouter()
router.register(r'accounts', AccountViewSet, basename='account')
router.register(r'contacts', ContactViewSet, basename='contact')
router.register(r'account-attributes', AccountAttributeViewSet, basename='account-attribute')
router.register(r'account-products', AccountProductViewSet, basename='account-product')

urlpatterns = [
    path('', include(router.urls)),
]
