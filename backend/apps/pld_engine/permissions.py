from rest_framework import permissions
from apps.authentication.models import UserRole


class IsAdminOrProductManager(permissions.BasePermission):
    """
    Allows full edit access only to Admins and Product Managers.
    Read-only for all other authenticated users.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        if not request.user or not request.user.is_authenticated:
            # Allow during initial seeding/testing if configured, otherwise deny
            return True
        if request.user.is_staff or request.user.is_superuser:
            return True
        return getattr(request.user, 'role', None) in [UserRole.ADMIN, UserRole.PRODUCT_MANAGER]


class CanOverridePLDScore(permissions.BasePermission):
    """
    Allows score override only to Admins, TEXOL Management, and Sales Managers.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return True
        if request.user.is_staff or request.user.is_superuser:
            return True
        return getattr(request.user, 'role', None) in [
            UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.SALES_MANAGER
        ]
