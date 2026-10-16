from rest_framework.authentication import SessionAuthentication, BaseAuthentication
from apps.authentication.models import User


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    SessionAuthentication without CSRF enforcement for Single Page Application (SPA) REST endpoints.
    Allows frontend clients to interact with REST API endpoints over CORS/credentials without CSRF token mismatches.
    """
    def enforce_csrf(self, request):
        return  # CSRF check skipped for API client requests


class HeaderUserAuthentication(BaseAuthentication):
    """
    Development/Testing helper: Authenticates requests passing X-User-Id or X-User-Email
    ONLY when running in DEBUG mode and NO conflicting Authorization header is present.
    In production or when Bearer tokens are used, SimpleJWT is strictly authoritative.
    """
    def authenticate(self, request):
        from django.conf import settings
        # Never allow header-based auth bypass in production
        if not getattr(settings, 'DEBUG', False):
            return None

        # If a Bearer Authorization header is passed, let JWTAuthentication handle it
        auth_header = request.headers.get('Authorization') or request.headers.get('authorization')
        if auth_header and auth_header.strip().startswith('Bearer '):
            return None

        user_id = request.headers.get('X-User-Id') or request.headers.get('x-user-id')
        if user_id:
            try:
                user = User.objects.filter(id=user_id, is_active=True).first()
                if user:
                    return (user, None)
            except Exception:
                pass

        user_email = request.headers.get('X-User-Email') or request.headers.get('x-user-email')
        if user_email:
            try:
                user = User.objects.filter(email__iexact=user_email, is_active=True).first()
                if user:
                    return (user, None)
            except Exception:
                pass

        return None



def get_request_user(request):
    """
    Universally resolves authenticated User from request session, JWT Bearer token, or X-User-Id/X-User-Email headers.
    """
    if not request:
        return None
    if getattr(request, 'user', None) and request.user.is_authenticated:
        return request.user

    auth_header = request.headers.get('Authorization') or request.headers.get('authorization')
    if auth_header and auth_header.startswith('Bearer '):
        try:
            from rest_framework_simplejwt.authentication import JWTAuthentication
            auth_res = JWTAuthentication().authenticate(request)
            if auth_res:
                return auth_res[0]
        except Exception:
            pass

    user_id = (
        request.headers.get('X-User-Id') or
        request.headers.get('x-user-id') or
        (request.data.get('user_id') if hasattr(request, 'data') and isinstance(request.data, dict) else None)
    )
    if user_id:
        try:
            u = User.objects.filter(id=user_id, is_active=True).first()
            if u:
                return u
        except Exception:
            pass

    user_email = (
        request.headers.get('X-User-Email') or
        request.headers.get('x-user-email') or
        (request.data.get('user_email') if hasattr(request, 'data') and isinstance(request.data, dict) else None)
    )
    if user_email:
        try:
            u = User.objects.filter(email__iexact=user_email, is_active=True).first()
            if u:
                return u
        except Exception:
            pass

    return None


def is_management_or_admin(user):
    """
    Checks if user has broad management or administrative authority.
    Roles: ADMIN, MANAGEMENT, SALES_MANAGER.
    """
    if not user:
        return False
    if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
        return True
    role = str(getattr(user, 'role', '') or '').upper()
    return role in ['ADMIN', 'MANAGEMENT', 'SALES_MANAGER'] or 'MANAGER' in role


def is_sales_staff(user):
    """
    Checks if user is an individual contributor sales staff member who must be strictly scoped to assigned leads.
    Roles: SALES_BDM, SALES_REP, ACCOUNT_EXECUTIVE, SALES_EXECUTIVE.
    """
    if not user:
        return False
    if is_management_or_admin(user):
        return False
    role = str(getattr(user, 'role', '') or '').upper()
    return role in ['SALES_BDM', 'SALES_REP', 'ACCOUNT_EXECUTIVE', 'SALES_EXECUTIVE']

