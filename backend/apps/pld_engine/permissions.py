from rest_framework import permissions
from apps.authentication.models import UserRole
from apps.authentication.backends import get_request_user, is_management_or_admin


class IsAdminOrProductManager(permissions.BasePermission):
    """
    Allows full edit access only to Admins and Product Managers.
    Read-only for all other authenticated users.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = get_request_user(request)
        if not user:
            return False
        if user.is_staff or user.is_superuser:
            return True
        return getattr(user, 'role', None) in [UserRole.ADMIN, UserRole.PRODUCT_MANAGER]


class CanOverridePLDScore(permissions.BasePermission):
    """
    Allows score override only to Admins, TEXOL Management, and Sales Managers.
    Staff members (Sales reps/BDMs) are strictly forbidden from overriding scores.
    """
    def has_permission(self, request, view):
        user = get_request_user(request)
        if not user:
            return False
        return is_management_or_admin(user)
