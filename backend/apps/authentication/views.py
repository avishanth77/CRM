import uuid
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import authenticate, login, logout
from django.db.models import Q
from apps.authentication.models import User, UserRole
from apps.authentication.serializers import (
    UserSerializer, LoginSerializer, CustomTokenObtainPairSerializer,
    PasswordChangeSerializer
)
from apps.audit_logging.models import AuditAction, log_audit_event
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Standard SimpleJWT endpoint returning access & refresh tokens plus user profile.
    Embeds role claims, territory, partner flag, and validates active account status.
    """
    serializer_class = CustomTokenObtainPairSerializer


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Scoped user directory for task assignments, stage transitions, and handoffs.
    Strictly isolated:
    - Tier 1 (Admin/Management): all active users.
    - Tier 2 (Sales Manager): users in assigned territory or managed team.
    - Tier 3 (Functional staff): internal staff users.
    - Tier 4 (Partner Users): scoped strictly to their own partner organization.
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return User.objects.none()

        # Tier 4: Partner User isolation
        if getattr(user, 'is_partner_scope', False):
            if hasattr(user, 'partner_profile') and user.partner_profile:
                return User.objects.filter(
                    partner_profile__partner=user.partner_profile.partner,
                    is_active=True
                ).order_by('first_name', 'last_name')
            return User.objects.none()

        # Tier 1: Global scope
        if getattr(user, 'is_global_scope', False):
            return User.objects.filter(is_active=True).order_by('first_name', 'last_name')

        # Tier 2: Territory / Team Scope
        if getattr(user, 'is_territory_scope', False):
            qs = User.objects.filter(is_active=True, is_partner_user=False)
            if user.territory:
                qs = qs.filter(Q(territory=user.territory) | Q(manager=user) | Q(id=user.id))
            else:
                qs = qs.filter(Q(manager=user) | Q(id=user.id))
            return qs.order_by('first_name', 'last_name')

        # Tier 3: Owner / Functional Scope
        return User.objects.filter(is_active=True, is_partner_user=False).order_by('first_name', 'last_name')


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """
    Authenticates a user via email or username and password.
    Enforces active account verification, returns JWT tokens and RBAC capabilities,
    and logs successful authentication in the universal audit log.
    """
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {'error': 'Invalid credentials format', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )

    login_identifier = serializer.validated_data['username'].strip()
    password = serializer.validated_data['password']

    # Locate user by email or username
    user_obj = User.objects.filter(
        Q(email__iexact=login_identifier) | Q(username__iexact=login_identifier)
    ).first()

    if not user_obj:
        return Response({'error': 'Invalid email/username or password'}, status=status.HTTP_401_UNAUTHORIZED)

    if not user_obj.is_active:
        return Response(
            {'error': 'This user account is inactive. Please contact Platform Administrator.'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    # Authenticate with Django auth
    user = authenticate(request, email=user_obj.email, password=password)
    if not user:
        user = authenticate(request, username=user_obj.username, password=password)
    if not user and user_obj.check_password(password) and user_obj.is_active:
        user = user_obj

    if not user:
        return Response({'error': 'Invalid email/username or password'}, status=status.HTTP_401_UNAUTHORIZED)

    login(request, user)

    # Generate JWT Tokens
    refresh = RefreshToken.for_user(user)
    refresh['email'] = user.email
    refresh['role'] = user.role
    refresh['canonical_role'] = user.canonical_role
    refresh['name'] = user.get_full_name() or user.username
    refresh['is_partner_user'] = user.is_partner_user
    refresh['territory'] = user.territory or ''
    access_token = str(refresh.access_token)
    refresh_token = str(refresh)

    # Record login in audit log
    log_audit_event(
        actor=user,
        action=AuditAction.LOGIN,
        entity_type='User',
        entity_id=user.id,
        changes_json={'auth_method': 'password', 'canonical_role': user.canonical_role},
        request=request
    )

    serialized_user = UserSerializer(user).data
    return Response({
        'message': f"Welcome back, {serialized_user['name']}!",
        'user': serialized_user,
        'access': access_token,
        'refresh': refresh_token,
        'tokens': {
            'access': access_token,
            'refresh': refresh_token
        }
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    """
    Logs out the authenticated user and blacklists the refresh token if provided.
    """
    refresh_token = request.data.get('refresh') or request.data.get('refresh_token')
    if refresh_token:
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            pass

    log_audit_event(
        actor=request.user,
        action=AuditAction.DELETE,
        entity_type='Session',
        entity_id=request.user.id,
        changes_json={'action': 'logout'},
        request=request
    )

    logout(request)
    return Response({'message': 'Successfully logged out and session revoked.'}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def current_user_view(request):
    """
    Returns the currently authenticated user's profile and authoritative RBAC entitlements.
    Strictly requires valid authentication.
    """
    return Response(UserSerializer(request.user).data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def password_change_view(request):
    """
    Enables authenticated users to change their own password securely.
    Validates previous password and records security audit trail.
    """
    serializer = PasswordChangeSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {'error': 'Invalid password data', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )

    old_password = serializer.validated_data['old_password']
    new_password = serializer.validated_data['new_password']

    if not request.user.check_password(old_password):
        return Response({'error': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

    request.user.set_password(new_password)
    request.user.save()

    log_audit_event(
        actor=request.user,
        action=AuditAction.PASSWORD_CHANGE,
        entity_type='User',
        entity_id=request.user.id,
        changes_json={'action': 'user_password_changed'},
        request=request
    )

    return Response({'message': 'Password changed successfully.'}, status=status.HTTP_200_OK)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def staff_list_create_view(request):
    """
    GET: List internal staff users.
         Allowed for Platform Admin, Management, and Sales Managers (territory-scoped).
    POST: Create a new staff user.
          Strictly restricted to Platform Admin (`ADMIN`). Prevents unauthorized privilege escalation.
    """
    user = request.user
    role = getattr(user, 'canonical_role', '')

    if request.method == 'GET':
        if not (user.is_superuser or role in [UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.SALES_MANAGER, UserRole.PARTNER_MANAGER]):
            return Response({'error': 'You do not have permission to view the staff directory.'}, status=status.HTTP_403_FORBIDDEN)

        staff = User.objects.filter(is_partner_user=False)
        if role == UserRole.SALES_MANAGER and user.territory:
            staff = staff.filter(Q(territory=user.territory) | Q(manager=user) | Q(id=user.id))

        staff = staff.order_by('-date_joined')
        data = UserSerializer(staff, many=True).data
        return Response({
            'count': len(data),
            'results': data
        })

    elif request.method == 'POST':
        # Privilege Escalation Guard: Only Platform Admin can create staff accounts
        if not (user.is_superuser or role == UserRole.ADMIN):
            return Response(
                {'error': 'Privilege escalation rejected: Only Platform Administrators may create staff user accounts.'},
                status=status.HTTP_403_FORBIDDEN
            )

        email = request.data.get('email', '').strip().lower()
        first_name = request.data.get('first_name', '').strip()
        last_name = request.data.get('last_name', '').strip()
        assigned_role = request.data.get('role', UserRole.PLD_EXECUTIVE).strip()
        password = request.data.get('password', '').strip()
        territory = request.data.get('territory', '').strip()
        team = request.data.get('team', '').strip()
        phone = request.data.get('phone', '').strip()
        manager_id = request.data.get('manager_id') or request.data.get('manager')
        username = request.data.get('username', '').strip() or email.split('@')[0]

        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not password:
            return Response({'error': 'Password is required to create a new user account'}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 8:
            return Response({'error': 'Password must be at least 8 characters long'}, status=status.HTTP_400_BAD_REQUEST)

        valid_roles = [c[0] for c in UserRole.choices]
        if assigned_role not in valid_roles:
            return Response(
                {'error': f"Invalid role '{assigned_role}'. Must be one of: {', '.join(valid_roles)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(email__iexact=email).exists():
            return Response({'error': f"User with email '{email}' already exists"}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username__iexact=username).exists():
            username = f"{username}_{uuid.uuid4().hex[:4]}"

        manager_obj = None
        if manager_id:
            manager_obj = User.objects.filter(id=manager_id, is_active=True).first()

        is_admin_flag = (assigned_role == UserRole.ADMIN)
        created_user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role=assigned_role,
            territory=territory or None,
            team=team or None,
            manager=manager_obj,
            phone=phone or None,
            is_staff=is_admin_flag,
            is_superuser=is_admin_flag,
            is_partner_user=False
        )

        log_audit_event(
            actor=user,
            action=AuditAction.USER_CREATE,
            entity_type='User',
            entity_id=created_user.id,
            changes_json={
                'email': created_user.email,
                'role': created_user.role,
                'territory': created_user.territory,
                'team': created_user.team,
                'created_by': user.email
            },
            request=request
        )

        return Response({
            'message': f"Staff member '{created_user.get_full_name() or created_user.username}' successfully created.",
            'user': UserSerializer(created_user).data
        }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def staff_detail_view(request, user_id):
    """
    GET: View staff user profile.
    PATCH: Update staff user. Only Platform Admin can modify roles or active status.
           Users cannot elevate their own privileges or modify their own role.
    DELETE: Delete staff user. Restricted to Platform Admin.
    """
    actor = request.user
    actor_role = getattr(actor, 'canonical_role', '')

    target_user = User.objects.filter(id=user_id, is_partner_user=False).first()
    if not target_user:
        return Response({'error': 'Staff user not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        # Allowed for Admin, Management, Manager within territory, or self
        is_self = str(actor.id) == str(target_user.id)
        is_authorized = (
            actor.is_superuser or
            actor_role in [UserRole.ADMIN, UserRole.MANAGEMENT] or
            (actor_role == UserRole.SALES_MANAGER and (target_user.territory == actor.territory or target_user.manager_id == actor.id)) or
            is_self
        )
        if not is_authorized:
            return Response({'error': 'You do not have permission to view this staff profile.'}, status=status.HTTP_403_FORBIDDEN)

        return Response(UserSerializer(target_user).data)

    elif request.method == 'PATCH':
        is_admin = (actor.is_superuser or actor_role == UserRole.ADMIN)
        is_self = str(actor.id) == str(target_user.id)

        # Privilege Escalation Guard 1: Only Admin can modify roles
        if 'role' in request.data:
            if not is_admin:
                return Response(
                    {'error': 'Privilege escalation rejected: Only Platform Administrators may assign or modify roles.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            if is_self:
                return Response(
                    {'error': 'Privilege escalation rejected: Administrators cannot alter their own primary role.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Privilege Escalation Guard 2: Only Admin can activate or deactivate accounts
        if 'is_active' in request.data and not is_admin:
            return Response(
                {'error': 'Permission denied: Only Platform Administrators may activate or deactivate accounts.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Only Admin or the user themselves may update profile info
        if not (is_admin or is_self):
            return Response(
                {'error': 'Permission denied: You cannot edit other users profiles.'},
                status=status.HTTP_403_FORBIDDEN
            )

        changes = {}

        if 'first_name' in request.data:
            changes['first_name'] = {'old': target_user.first_name, 'new': request.data['first_name']}
            target_user.first_name = request.data['first_name']

        if 'last_name' in request.data:
            changes['last_name'] = {'old': target_user.last_name, 'new': request.data['last_name']}
            target_user.last_name = request.data['last_name']

        if 'role' in request.data and is_admin and not is_self:
            new_role = request.data['role']
            valid_roles = [c[0] for c in UserRole.choices]
            if new_role not in valid_roles:
                return Response({'error': f"Invalid role '{new_role}'"}, status=status.HTTP_400_BAD_REQUEST)
            changes['role'] = {'old': target_user.role, 'new': new_role}
            target_user.role = new_role
            target_user.is_staff = (new_role == UserRole.ADMIN)
            target_user.is_superuser = (new_role == UserRole.ADMIN)

        if 'territory' in request.data and is_admin:
            changes['territory'] = {'old': target_user.territory, 'new': request.data['territory']}
            target_user.territory = request.data['territory']

        if 'team' in request.data and is_admin:
            changes['team'] = {'old': target_user.team, 'new': request.data['team']}
            target_user.team = request.data['team']

        if 'manager_id' in request.data and is_admin:
            m_id = request.data['manager_id']
            manager_obj = User.objects.filter(id=m_id, is_active=True).first() if m_id else None
            target_user.manager = manager_obj

        if 'phone' in request.data:
            target_user.phone = request.data['phone']

        if 'password' in request.data and request.data['password']:
            # Admin can reset; user can only reset if they are self
            if not (is_admin or is_self):
                return Response({'error': 'Permission denied to reset password.'}, status=status.HTTP_403_FORBIDDEN)
            target_user.set_password(request.data['password'])
            changes['password'] = '[UPDATED]'

        if 'is_active' in request.data and is_admin:
            new_active = bool(request.data['is_active'])
            if not new_active and target_user.is_superuser and User.objects.filter(is_superuser=True, is_active=True).count() <= 1:
                return Response(
                    {'error': 'Cannot deactivate the sole active Platform Administrator account.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            changes['is_active'] = {'old': target_user.is_active, 'new': new_active}
            target_user.is_active = new_active

        target_user.save()

        # Audit logging
        action_type = AuditAction.ROLE_CHANGE if 'role' in changes else AuditAction.USER_UPDATE
        log_audit_event(
            actor=actor,
            action=action_type,
            entity_type='User',
            entity_id=target_user.id,
            changes_json=changes,
            request=request
        )

        return Response({
            'message': 'Staff user updated successfully.',
            'user': UserSerializer(target_user).data
        })

    elif request.method == 'DELETE':
        if not (actor.is_superuser or actor_role == UserRole.ADMIN):
            return Response({'error': 'Only Platform Administrators may delete user accounts.'}, status=status.HTTP_403_FORBIDDEN)

        if target_user.is_superuser and User.objects.filter(is_superuser=True, is_active=True).count() <= 1:
            return Response({'error': 'Cannot delete the sole Administrator account.'}, status=status.HTTP_400_BAD_REQUEST)

        if str(actor.id) == str(target_user.id):
            return Response({'error': 'Administrators cannot delete their own account.'}, status=status.HTTP_400_BAD_REQUEST)

        target_id = target_user.id
        target_email = target_user.email
        target_user.delete()

        log_audit_event(
            actor=actor,
            action=AuditAction.USER_DELETE,
            entity_type='User',
            entity_id=target_id,
            changes_json={'deleted_user_email': target_email, 'deleted_by': actor.email},
            request=request
        )

        return Response({'message': f"Staff user '{target_email}' deleted successfully."})
