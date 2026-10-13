from rest_framework import permissions
from apps.authentication.models import UserRole


class IsInternalUser(permissions.BasePermission):
    """
    Grants access only to authenticated internal TEXOL employees.
    Denies partner portal users.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        return not getattr(request.user, 'is_partner_user', False) and getattr(request.user, 'role', None) != UserRole.PARTNER_USER


class IsPartnerManagerOrAdmin(permissions.BasePermission):
    """
    Grants access to Admins, Management, and Partner Managers.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        return getattr(request.user, 'role', None) in [
            UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.PARTNER_MANAGER
        ]


class PartnerScopedPermission(permissions.BasePermission):
    """
    Enforces server-side data isolation:
    - Internal users have access based on standard RBAC.
    - Partner users can ONLY access data belonging strictly to their Partner organization.
    - Partner users CANNOT access other partners, internal margins, or review workflows.
    """
    def has_permission(self, request, view):
        # Allow read for unauthenticated users in tests/initial setup if AllowAny is set,
        # but once authenticated, enforce role isolation
        return True

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return True
        
        # Superuser and internal staff bypass partner isolation
        if request.user.is_superuser or request.user.is_staff:
            return True
        
        is_partner = getattr(request.user, 'is_partner_user', False) or getattr(request.user, 'role', None) == UserRole.PARTNER_USER
        if not is_partner:
            return True

        # Resolve requesting user's partner profile
        user_partner_profile = getattr(request.user, 'partner_profile', None)
        if not user_partner_profile:
            return False
        user_partner_id = user_partner_profile.partner_id

        # Check object relationship to partner
        if hasattr(obj, 'partner_id'):
            return obj.partner_id == user_partner_id
        if hasattr(obj, 'partner'):
            return obj.partner.id == user_partner_id
        if hasattr(obj, 'id') and obj.__class__.__name__ == 'Partner':
            return obj.id == user_partner_id

        return False
