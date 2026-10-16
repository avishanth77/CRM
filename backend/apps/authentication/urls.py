from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.authentication.views import (
    UserViewSet, login_view, logout_view,
    current_user_view, password_change_view,
    staff_list_create_view, staff_detail_view,
    CustomTokenObtainPairView
)
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

router = DefaultRouter()
router.register('users', UserViewSet, basename='user')

urlpatterns = [
    path('auth/login/', login_view, name='auth-login'),
    path('auth/logout/', logout_view, name='auth-logout'),
    path('auth/me/', current_user_view, name='auth-me'),
    path('auth/password-change/', password_change_view, name='auth-password-change'),
    path('auth/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('admin/staff/', staff_list_create_view, name='admin-staff-list-create'),
    path('admin/staff/<uuid:user_id>/', staff_detail_view, name='admin-staff-detail'),
    path('', include(router.urls)),
]

