from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from django.contrib.auth import authenticate, login, logout
from django.db.models import Q
from apps.authentication.models import User, UserRole
from apps.authentication.serializers import UserSerializer, LoginSerializer


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Lists users for assignments (SDRs, AEs, Managers, etc.)
    """
    queryset = User.objects.filter(is_active=True).order_by('first_name', 'last_name')
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """
    Authenticates a user via email or username and password.
    Returns the user's RBAC profile, allowed workspaces, and capabilities.
    """
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({'error': 'Invalid credentials format', 'details': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    login_identifier = serializer.validated_data['username'].strip()
    password = serializer.validated_data['password']

    # Find user by email or username
    user_obj = User.objects.filter(
        Q(email__iexact=login_identifier) | Q(username__iexact=login_identifier)
    ).first()

    if not user_obj:
        return Response({'error': 'Invalid email/username or password'}, status=status.HTTP_401_UNAUTHORIZED)

    # Authenticate with Django auth (User model has USERNAME_FIELD = 'email')
    user = authenticate(request, email=user_obj.email, password=password)
    if not user:
        user = authenticate(request, username=user_obj.username, password=password)
    if not user and user_obj.check_password(password) and user_obj.is_active:
        user = user_obj

    if not user:
        return Response({'error': 'Invalid email/username or password'}, status=status.HTTP_401_UNAUTHORIZED)

    login(request, user)
    serialized_user = UserSerializer(user).data
    return Response({
        'message': f"Welcome back, {serialized_user['name']}!",
        'user': serialized_user
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def logout_view(request):
    """
    Logs out the current session.
    """
    logout(request)
    return Response({'message': 'Successfully logged out'}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def current_user_view(request):
    """
    Returns the currently authenticated user's profile and RBAC permissions.
    """
    if request.user.is_authenticated:
        return Response(UserSerializer(request.user).data)
    
    return Response({'error': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['GET', 'POST'])
@permission_classes([permissions.AllowAny])
def staff_list_create_view(request):
    """
    GET: List all internal staff users with metrics.
    POST: Admin adds a new staff member (PLD Exec, Sales AE, Manager, Admin, etc.)
    """
    if request.method == 'GET':
        staff = User.objects.filter(is_partner_user=False).order_by('-date_joined')
        data = UserSerializer(staff, many=True).data
        return Response({
            'count': len(data),
            'results': data
        })

    elif request.method == 'POST':
        email = request.data.get('email', '').strip().lower()
        first_name = request.data.get('first_name', '').strip()
        last_name = request.data.get('last_name', '').strip()
        role = request.data.get('role', UserRole.PLD_EXECUTIVE).strip()
        password = request.data.get('password', '').strip()
        territory = request.data.get('territory', '').strip()
        phone = request.data.get('phone', '').strip()
        username = request.data.get('username', '').strip() or email.split('@')[0]

        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not password:
            return Response({'error': 'Password is required to create a new user account'}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 8:
            return Response({'error': 'Password must be at least 8 characters long'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email__iexact=email).exists():
            return Response({'error': f"User with email '{email}' already exists"}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username__iexact=username).exists():
            import uuid
            username = f"{username}_{uuid.uuid4().hex[:4]}"

        is_admin = (role == UserRole.ADMIN)
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role=role,
            territory=territory,
            phone=phone,
            is_staff=is_admin,
            is_superuser=is_admin,
            is_partner_user=False
        )

        return Response({
            'message': f"Staff member '{user.get_full_name() or user.username}' successfully created.",
            'user': UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([permissions.AllowAny])
def staff_detail_view(request, user_id):
    """
    GET, PATCH, DELETE a staff user.
    """
    user = User.objects.filter(id=user_id, is_partner_user=False).first()
    if not user:
        return Response({'error': 'Staff user not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(UserSerializer(user).data)

    elif request.method == 'PATCH':
        if 'first_name' in request.data:
            user.first_name = request.data['first_name']
        if 'last_name' in request.data:
            user.last_name = request.data['last_name']
        if 'role' in request.data:
            user.role = request.data['role']
            if user.role == UserRole.ADMIN:
                user.is_staff = True
                user.is_superuser = True
        if 'territory' in request.data:
            user.territory = request.data['territory']
        if 'phone' in request.data:
            user.phone = request.data['phone']
        if 'password' in request.data and request.data['password']:
            user.set_password(request.data['password'])
        if 'is_active' in request.data:
            user.is_active = request.data['is_active']
        user.save()
        return Response({
            'message': 'Staff user updated successfully.',
            'user': UserSerializer(user).data
        })

    elif request.method == 'DELETE':
        if user.is_superuser and User.objects.filter(is_superuser=True).count() <= 1:
            return Response({'error': 'Cannot delete the sole Administrator account.'}, status=status.HTTP_400_BAD_REQUEST)
        user.delete()
        return Response({'message': 'Staff user deleted successfully.'})

