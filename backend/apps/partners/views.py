from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Q
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.partners.models import (
    Partner, PartnerTypeMaster, PartnerUser, PartnerProduct,
    PartnerTerritory, PartnerCertification, DealRegistration,
    DealRegistrationStatus, ChannelConflict, PartnerCommission,
    PartnerInfluence, PartnerChannelConfig, PartnerStatus
)
from apps.partners.serializers import (
    PartnerSerializer, PartnerTypeMasterSerializer, PartnerUserSerializer,
    PartnerProductSerializer, PartnerTerritorySerializer,
    PartnerCertificationSerializer, DealRegistrationSerializer,
    ChannelConflictSerializer, PartnerCommissionSerializer,
    PartnerInfluenceSerializer, PartnerChannelConfigSerializer
)
from apps.partners.services import (
    PartnerLifecycleService, PartnerAuthorizationService,
    DealRegistrationService, ChannelConflictService,
    PartnerInfluenceService, PartnerCommissionService
)
from apps.partners.permissions import IsInternalUser, PartnerScopedPermission
from apps.authentication.models import UserRole
from apps.leads.models import Lead
from apps.opportunities.models import Opportunity, OpportunityStatus
from apps.accounts.models import Account
from apps.products.models import Product


def get_user_partner(user_or_request):
    """Returns the partner organization linked to the user if partner user, else None."""
    if not user_or_request:
        return None
    user = user_or_request
    if hasattr(user_or_request, 'headers') or hasattr(user_or_request, 'META'):
        from apps.authentication.backends import get_request_user
        user = get_request_user(user_or_request)
    if not user:
        return None
    if getattr(user, 'is_partner_user', False) or getattr(user, 'role', None) == UserRole.PARTNER_USER:
        profile = getattr(user, 'partner_profile', None)
        return profile.partner if profile else None
    return None


class PartnerTypeMasterViewSet(viewsets.ModelViewSet):
    """
    Configurable Master Data for Partner Types.
    """
    queryset = PartnerTypeMaster.objects.all()
    serializer_class = PartnerTypeMasterSerializer
    permission_classes = [permissions.AllowAny]


class PartnerViewSet(viewsets.ModelViewSet):
    """
    Partner organization master viewset.
    Strictly scopes partner users to their own organization.
    """
    serializer_class = PartnerSerializer
    permission_classes = [PartnerScopedPermission]

    def get_queryset(self):
        user = self.request.user if self.request.user.is_authenticated else None
        partner = get_user_partner(user)
        qs = Partner.objects.all().select_related(
            'account', 'partner_manager', 'partner_type_master'
        ).prefetch_related(
            'authorized_products__product',
            'territory_authorizations',
            'certifications__product',
            'users__user'
        )
        if partner:
            return qs.filter(id=partner.id)
        return qs

    @action(detail=False, methods=['post'], url_path='admin-create')
    def admin_create(self, request):
        """
        Allows Admin to register a Partner organization and primary Partner user in one atomic action.
        """
        company_name = request.data.get('company_name', '').strip()
        domain = request.data.get('domain', '').strip()
        partner_code = request.data.get('partner_code', '').strip().upper()
        partner_type = request.data.get('partner_type', 'ERP').strip()
        territory = request.data.get('territory', 'Saudi Arabia').strip()
        status_val = request.data.get('status', 'ACTIVE').strip()

        # Primary user
        contact_name = request.data.get('contact_name', '').strip()
        contact_email = request.data.get('contact_email', '').strip().lower()
        contact_password = request.data.get('contact_password', '').strip()
        partner_role = request.data.get('partner_role', 'SALES').strip()

        if not company_name:
            return Response({'error': 'Company name is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not partner_code:
            return Response({'error': 'Partner code is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if contact_email and not contact_password:
            return Response({'error': 'Password is required when creating a primary partner user.'}, status=status.HTTP_400_BAD_REQUEST)
        if contact_password and len(contact_password) < 8:
            return Response({'error': 'Password must be at least 8 characters long.'}, status=status.HTTP_400_BAD_REQUEST)

        if Partner.objects.filter(partner_code=partner_code).exists():
            return Response({'error': f"Partner with code '{partner_code}' already exists."}, status=status.HTTP_400_BAD_REQUEST)

        # Create or find Account
        from apps.accounts.models import Account, AccountType, Contact
        from apps.authentication.models import User
        import uuid

        account_domain = domain or f"{partner_code.lower()}.partner.texol"
        account = Account.objects.filter(Q(company_name__iexact=company_name) | Q(domain__iexact=account_domain)).first()
        if not account:
            account = Account.objects.create(
                company_name=company_name,
                domain=account_domain,
                industry="IT Services & Distribution",
                account_type=AccountType.PARTNER,
                country=territory
            )

        # Create Partner organization
        partner = Partner.objects.create(
            account=account,
            partner_code=partner_code,
            partner_type=partner_type,
            territory=territory,
            status=status_val
        )

        # Create primary partner user if email provided
        if contact_email:
            name_parts = contact_name.split(' ') if contact_name else ['Partner', 'User']
            first_name = name_parts[0]
            last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else 'Admin'
            username = contact_email.split('@')[0]
            if User.objects.filter(username__iexact=username).exists():
                username = f"{username}_{uuid.uuid4().hex[:4]}"

            pu_user = User.objects.filter(email__iexact=contact_email).first()
            if not pu_user:
                pu_user = User.objects.create_user(
                    username=username,
                    email=contact_email,
                    password=contact_password,
                    first_name=first_name,
                    last_name=last_name,
                    role=UserRole.PARTNER_USER,
                    is_partner_user=True,
                    territory=territory
                )
            else:
                pu_user.role = UserRole.PARTNER_USER
                pu_user.is_partner_user = True
                pu_user.save()

            PartnerUser.objects.update_or_create(
                user=pu_user,
                partner=partner,
                defaults={'partner_role': partner_role, 'is_active': True}
            )

            Contact.objects.get_or_create(
                account=account,
                email=contact_email,
                defaults={
                    'first_name': first_name,
                    'last_name': last_name,
                    'designation': f"Partner {partner_role}",
                    'role_type': 'DECISION_MAKER',
                    'is_primary': True
                }
            )

        return Response({
            'message': f"Partner organization '{company_name}' successfully registered.",
            'partner': PartnerSerializer(partner).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='add-user')
    def add_user(self, request, pk=None):
        """
        Adds a new user to an existing partner organization.
        """
        partner = self.get_object()
        from apps.authentication.models import User
        import uuid

        first_name = request.data.get('first_name', '').strip()
        last_name = request.data.get('last_name', '').strip()
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '').strip()
        partner_role = request.data.get('partner_role', 'SALES').strip()

        if not email:
            return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not password:
            return Response({'error': 'Password is required to create a partner user.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 8:
            return Response({'error': 'Password must be at least 8 characters long.'}, status=status.HTTP_400_BAD_REQUEST)

        username = email.split('@')[0]
        if User.objects.filter(username__iexact=username).exists():
            username = f"{username}_{uuid.uuid4().hex[:4]}"

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role=UserRole.PARTNER_USER,
                is_partner_user=True,
                territory=partner.territory
            )
        else:
            user.role = UserRole.PARTNER_USER
            user.is_partner_user = True
            user.save()

        pu, _ = PartnerUser.objects.update_or_create(
            user=user,
            partner=partner,
            defaults={'partner_role': partner_role, 'is_active': True}
        )

        return Response({
            'message': f"User '{email}' successfully added to {partner.account.company_name}.",
            'partner': PartnerSerializer(partner).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='transition-status')
    def transition_status(self, request, pk=None):
        partner = self.get_object()
        to_status = request.data.get('status')
        reason = request.data.get('reason')

        # Partner users cannot change their own partner status
        if get_user_partner(request.user):
            return Response(
                {'error': 'Partner users are not permitted to change partner organization status.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if not to_status or to_status not in PartnerStatus.values:
            return Response(
                {'error': f"Invalid status '{to_status}'. Must be one of {PartnerStatus.values}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            updated_partner = PartnerLifecycleService.transition_status(
                partner=partner,
                to_status=to_status,
                user=request.user if request.user.is_authenticated else None,
                reason=reason
            )
            return Response({
                'message': f"Partner status transitioned to {to_status}.",
                'partner': PartnerSerializer(updated_partner).data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        partner = serializer.save()
        from apps.audit_logging.models import AuditLog, AuditAction
        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else 'system@texol.com',
            actor_role=getattr(user, 'role', 'SYSTEM') if user else 'SYSTEM',
            entity_type='Partner',
            entity_id=partner.id,
            action=AuditAction.UPDATE,
            changes_json={'updated_partner': partner.account.company_name}
        )

    def destroy(self, request, *args, **kwargs):
        partner = self.get_object()
        if get_user_partner(request.user) or getattr(request.user, 'is_partner_user', False):
            return Response(
                {'error': 'Permission Denied: Partner users cannot delete partner organizations.'},
                status=status.HTTP_403_FORBIDDEN
            )

        user = request.user if request.user.is_authenticated else None
        company_name = partner.account.company_name if partner.account else partner.partner_code

        # Deactivate associated partner portal users so login is prohibited
        partner.users.update(is_active=False)
        from apps.authentication.models import User
        for pu in partner.users.all():
            if pu.user:
                pu.user.is_active = False
                pu.user.save(update_fields=['is_active'])

        partner.status = PartnerStatus.INACTIVE
        partner.status_change_reason = f"Deleted by {user.email if user else 'Admin'}"
        partner.save(update_fields=['status', 'status_change_reason'])
        partner.delete()

        from apps.audit_logging.models import AuditLog, AuditAction
        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else 'system@texol.com',
            actor_role=getattr(user, 'role', 'SYSTEM') if user else 'SYSTEM',
            entity_type='Partner',
            entity_id=partner.id,
            action=AuditAction.DELETE,
            changes_json={'deleted_partner': company_name}
        )

        return Response({
            'message': f"Partner organization '{company_name}' has been deleted successfully."
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='deactivate')
    def deactivate(self, request, pk=None):
        partner = self.get_object()
        if get_user_partner(request.user) or getattr(request.user, 'is_partner_user', False):
            return Response(
                {'error': 'Permission Denied: Partner users cannot deactivate partner organizations.'},
                status=status.HTTP_403_FORBIDDEN
            )

        reason = request.data.get('reason') or "Deactivated by Administrator"
        updated_partner = PartnerLifecycleService.transition_status(
            partner=partner,
            to_status=PartnerStatus.INACTIVE,
            user=request.user if request.user.is_authenticated else None,
            reason=reason
        )

        # Deactivate linked partner users
        updated_partner.users.update(is_active=False)
        from apps.authentication.models import User
        for pu in updated_partner.users.all():
            if pu.user:
                pu.user.is_active = False
                pu.user.save(update_fields=['is_active'])

        return Response({
            'message': f"Partner organization '{updated_partner.account.company_name}' deactivated successfully.",
            'partner': PartnerSerializer(updated_partner).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='activate')
    def activate(self, request, pk=None):
        partner = self.get_object()
        if get_user_partner(request.user) or getattr(request.user, 'is_partner_user', False):
            return Response(
                {'error': 'Permission Denied: Partner users cannot activate partner organizations.'},
                status=status.HTTP_403_FORBIDDEN
            )

        reason = request.data.get('reason') or "Re-activated by Administrator"
        updated_partner = PartnerLifecycleService.transition_status(
            partner=partner,
            to_status=PartnerStatus.ACTIVE,
            user=request.user if request.user.is_authenticated else None,
            reason=reason
        )

        # Re-activate linked partner users
        updated_partner.users.update(is_active=True)
        from apps.authentication.models import User
        for pu in updated_partner.users.all():
            if pu.user:
                pu.user.is_active = True
                pu.user.save(update_fields=['is_active'])

        return Response({
            'message': f"Partner organization '{updated_partner.account.company_name}' activated successfully.",
            'partner': PartnerSerializer(updated_partner).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='authorize-product')
    def authorize_product(self, request, pk=None):
        partner = self.get_object()
        if get_user_partner(request.user):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        product_id = request.data.get('product')
        status_val = request.data.get('status', 'AUTHORIZED')
        territory = request.data.get('territory')
        commission_rate = request.data.get('commission_rate_pct', 15.0)
        valid_from = request.data.get('valid_from')
        valid_to = request.data.get('valid_to')

        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

        pp = PartnerAuthorizationService.authorize_product(
            partner=partner,
            product=product,
            status=status_val,
            territory=territory,
            commission_rate=commission_rate,
            valid_from=valid_from,
            valid_to=valid_to,
            user=request.user if request.user.is_authenticated else None
        )
        return Response(PartnerProductSerializer(pp).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='authorize-territory')
    def authorize_territory(self, request, pk=None):
        partner = self.get_object()
        if get_user_partner(request.user):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        territory = request.data.get('territory')
        is_primary = request.data.get('is_primary', False)
        is_exclusive = request.data.get('is_exclusive', False)

        if not territory:
            return Response({'error': 'Territory is required'}, status=status.HTTP_400_BAD_REQUEST)

        pt = PartnerAuthorizationService.authorize_territory(
            partner=partner,
            territory=territory,
            is_primary=is_primary,
            is_exclusive=is_exclusive,
            user=request.user if request.user.is_authenticated else None
        )
        return Response(PartnerTerritorySerializer(pt).data, status=status.HTTP_201_CREATED)


class PartnerUserViewSet(viewsets.ModelViewSet):
    serializer_class = PartnerUserSerializer
    permission_classes = [PartnerScopedPermission]

    def get_queryset(self):
        user = self.request.user if self.request.user.is_authenticated else None
        partner = get_user_partner(user)
        qs = PartnerUser.objects.all().select_related('partner__account', 'user')
        if partner:
            return qs.filter(partner=partner)
        return qs


class PartnerProductViewSet(viewsets.ModelViewSet):
    serializer_class = PartnerProductSerializer
    permission_classes = [PartnerScopedPermission]

    def get_queryset(self):
        user = self.request.user if self.request.user.is_authenticated else None
        partner = get_user_partner(user)
        qs = PartnerProduct.objects.all().select_related('partner__account', 'product')
        if partner:
            return qs.filter(partner=partner)
        return qs


class PartnerTerritoryViewSet(viewsets.ModelViewSet):
    serializer_class = PartnerTerritorySerializer
    permission_classes = [PartnerScopedPermission]

    def get_queryset(self):
        user = self.request.user if self.request.user.is_authenticated else None
        partner = get_user_partner(user)
        qs = PartnerTerritory.objects.all().select_related('partner__account')
        if partner:
            return qs.filter(partner=partner)
        return qs


class PartnerCertificationViewSet(viewsets.ModelViewSet):
    serializer_class = PartnerCertificationSerializer
    permission_classes = [PartnerScopedPermission]

    def get_queryset(self):
        user = self.request.user if self.request.user.is_authenticated else None
        partner = get_user_partner(user)
        qs = PartnerCertification.objects.all().select_related('partner__account', 'product')
        if partner:
            return qs.filter(partner=partner)
        return qs


class DealRegistrationViewSet(viewsets.ModelViewSet):
    serializer_class = DealRegistrationSerializer
    permission_classes = [PartnerScopedPermission]

    def get_queryset(self):
        from apps.authentication.backends import get_request_user
        user = get_request_user(self.request) or (self.request.user if self.request.user.is_authenticated else None)
        partner = get_user_partner(user)
        partner_id = self.request.query_params.get('partner_id') or self.request.query_params.get('partner')
        qs = DealRegistration.objects.all().select_related(
            'partner__account', 'customer_account', 'contact', 'product',
            'registered_by', 'reviewed_by'
        )
        if partner:
            return qs.filter(partner=partner)
        elif partner_id:
            return qs.filter(partner_id=partner_id)
        return qs

    def create(self, request, *args, **kwargs):
        from apps.authentication.backends import get_request_user
        user = get_request_user(request) or (request.user if request.user.is_authenticated else None)
        user_partner = get_user_partner(user)

        partner_id = request.data.get('partner') or request.data.get('partner_id')
        if user_partner:
            partner = user_partner
        elif partner_id:
            partner = Partner.objects.filter(id=partner_id).first()
        else:
            partner = Partner.objects.first()

        if not partner:
            return Response({'error': 'Valid partner organisation is required.'}, status=status.HTTP_400_BAD_REQUEST)

        customer_id = request.data.get('customer_account')
        customer_account = Account.objects.filter(id=customer_id).first()
        if not customer_account:
            return Response({'error': 'Valid customer account is required.'}, status=status.HTTP_400_BAD_REQUEST)

        product_id = request.data.get('product')
        product = Product.objects.filter(id=product_id).first()
        if not product:
            return Response({'error': 'Valid product is required.'}, status=status.HTTP_400_BAD_REQUEST)

        expected_val = request.data.get('expected_deal_value', 0.00)
        expected_close = request.data.get('expected_close_date')
        evidence = request.data.get('evidence_notes', '')
        territory = request.data.get('territory') or partner.territory

        try:
            deal_reg, conflict_obj, msg = DealRegistrationService.submit_registration(
                partner=partner,
                customer_account=customer_account,
                product=product,
                registered_by=user,
                territory=territory,
                expected_deal_value=expected_val,
                expected_close_date=expected_close,
                evidence_notes=evidence
            )
            return Response({
                'message': msg,
                'conflict': conflict_obj is not None,
                'registration': DealRegistrationSerializer(deal_reg).data
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='accept')
    def accept(self, request, pk=None):
        return self.approve(request, pk)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        # Enforce server-side isolation: partner users cannot approve registrations!
        if get_user_partner(request.user) or getattr(request.user, 'is_partner_user', False) or getattr(request.user, 'role', None) == UserRole.PARTNER_USER:
            return Response(
                {'error': 'Permission Denied: Partner users cannot approve deal registrations.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if request.user.is_authenticated:
            is_allowed = (
                request.user.is_superuser or
                request.user.is_staff or
                getattr(request.user, 'role', None) in [UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.PARTNER_MANAGER, UserRole.SALES_MANAGER]
            )
            if not is_allowed:
                return Response(
                    {'error': 'Permission Denied: Only Channel Partner Managers and authorized managers can approve deal registrations.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        reg = self.get_object()
        days_protection = request.data.get('protection_days')
        if days_protection is not None:
            days_protection = int(days_protection)

        try:
            reg = DealRegistrationService.approve_registration(
                deal_reg=reg,
                approver=request.user if request.user.is_authenticated else None,
                protection_days=days_protection
            )
            return Response({
                'message': f"Deal registration accepted. Protected exclusivity active until {reg.protection_expiry_date}.",
                'registration': DealRegistrationSerializer(reg).data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        # Enforce server-side isolation: partner users cannot reject registrations!
        if get_user_partner(request.user) or getattr(request.user, 'is_partner_user', False) or getattr(request.user, 'role', None) == UserRole.PARTNER_USER:
            return Response(
                {'error': 'Permission Denied: Partner users cannot reject deal registrations.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if request.user.is_authenticated:
            is_allowed = (
                request.user.is_superuser or
                request.user.is_staff or
                getattr(request.user, 'role', None) in [UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.PARTNER_MANAGER, UserRole.SALES_MANAGER]
            )
            if not is_allowed:
                return Response(
                    {'error': 'Permission Denied: Only Channel Partner Managers and authorized managers can reject deal registrations.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        reg = self.get_object()
        reason = request.data.get('reason')
        if not reason or not reason.strip():
            return Response({'error': 'Rejection reason is strictly required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            reg = DealRegistrationService.reject_registration(
                deal_reg=reg,
                rejector=request.user if request.user.is_authenticated else None,
                reason=reason
            )
            return Response({
                'message': 'Deal registration rejected.',
                'registration': DealRegistrationSerializer(reg).data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ChannelConflictViewSet(viewsets.ModelViewSet):
    serializer_class = ChannelConflictSerializer
    permission_classes = [PartnerScopedPermission]

    def get_queryset(self):
        user = self.request.user if self.request.user.is_authenticated else None
        partner = get_user_partner(user)
        qs = ChannelConflict.objects.all().select_related(
            'partner__account', 'competing_partner__account',
            'customer_account', 'product', 'reviewer'
        )
        if partner:
            return qs.filter(Q(partner=partner) | Q(competing_partner=partner))
        return qs

    @action(detail=True, methods=['post'], url_path='resolve')
    def resolve(self, request, pk=None):
        if get_user_partner(request.user):
            return Response({'error': 'Partner users cannot resolve channel conflicts.'}, status=status.HTTP_403_FORBIDDEN)

        conflict = self.get_object()
        decision = request.data.get('decision')
        reason = request.data.get('decision_reason')

        if not decision or not reason:
            return Response({'error': 'decision and decision_reason are both required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            conflict = ChannelConflictService.resolve_conflict(
                conflict=conflict,
                reviewer=request.user if request.user.is_authenticated else None,
                decision=decision,
                decision_reason=reason
            )
            return Response({
                'message': 'Channel conflict resolved successfully.',
                'conflict': ChannelConflictSerializer(conflict).data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PartnerInfluenceViewSet(viewsets.ModelViewSet):
    serializer_class = PartnerInfluenceSerializer
    permission_classes = [PartnerScopedPermission]

    def get_queryset(self):
        user = self.request.user if self.request.user.is_authenticated else None
        partner = get_user_partner(user)
        qs = PartnerInfluence.objects.all().select_related('partner__account', 'opportunity', 'recorded_by')
        if partner:
            return qs.filter(partner=partner)
        return qs

    def create(self, request, *args, **kwargs):
        opportunity_id = request.data.get('opportunity')
        partner_id = request.data.get('partner')
        influence_type = request.data.get('influence_type', 'ORIGINATOR')
        influence_pct = int(request.data.get('influence_pct', 100))
        notes = request.data.get('notes', '')

        opp = Opportunity.objects.filter(id=opportunity_id).first()
        if not opp:
            return Response({'error': 'Opportunity not found'}, status=status.HTTP_404_NOT_FOUND)

        partner = Partner.objects.filter(id=partner_id).first()
        if not partner:
            return Response({'error': 'Partner not found'}, status=status.HTTP_404_NOT_FOUND)

        inf = PartnerInfluenceService.record_influence(
            opportunity=opp,
            partner=partner,
            influence_type=influence_type,
            influence_pct=influence_pct,
            notes=notes,
            user=request.user if request.user.is_authenticated else None
        )
        return Response(PartnerInfluenceSerializer(inf).data, status=status.HTTP_201_CREATED)


class PartnerCommissionViewSet(viewsets.ModelViewSet):
    serializer_class = PartnerCommissionSerializer
    permission_classes = [PartnerScopedPermission]

    def get_queryset(self):
        user = self.request.user if self.request.user.is_authenticated else None
        partner = get_user_partner(user)
        qs = PartnerCommission.objects.all().select_related('partner__account', 'opportunity', 'approved_by')
        if partner:
            return qs.filter(partner=partner)
        return qs

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        if get_user_partner(request.user):
            return Response({'error': 'Partner users cannot approve commissions.'}, status=status.HTTP_403_FORBIDDEN)

        comm = self.get_object()
        comm = PartnerCommissionService.approve_commission(comm, request.user if request.user.is_authenticated else None)
        return Response(PartnerCommissionSerializer(comm).data, status=status.HTTP_200_OK)


class PartnerChannelConfigView(APIView):
    """
    Configurable protection period, conflict rules, and attribution model.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        cfg = PartnerChannelConfig.get_config()
        return Response(PartnerChannelConfigSerializer(cfg).data, status=status.HTTP_200_OK)

    def put(self, request):
        return self.patch(request)

    def patch(self, request):
        if get_user_partner(request.user):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        cfg = PartnerChannelConfig.get_config()
        serializer = PartnerChannelConfigSerializer(cfg, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class PartnerPortalDashboardView(APIView):
    """
    Dedicated endpoint serving Partner Portal metrics for the logged-in or requested partner.
    Strictly isolated for partner users.
    Uses REAL database metrics only (NO FAKE DATA).
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from apps.authentication.backends import get_request_user
        user = get_request_user(request) or (request.user if request.user.is_authenticated else None)
        user_partner = get_user_partner(user)

        partner_id = request.query_params.get('partner_id')
        if user_partner:
            partner = user_partner
        elif partner_id:
            partner = Partner.objects.filter(id=partner_id).first()
        else:
            partner = Partner.objects.first()

        if not partner:
            return Response({'error': 'No partner organization found.'}, status=status.HTTP_404_NOT_FOUND)

        deals = DealRegistration.objects.filter(partner=partner).select_related('customer_account', 'product')
        total_registered = deals.count()
        accepted_deals = deals.filter(status=DealRegistrationStatus.ACCEPTED).count()
        under_review_deals = deals.filter(status=DealRegistrationStatus.UNDER_REVIEW).count()
        rejected_deals = deals.filter(status=DealRegistrationStatus.REJECTED).count()

        # Pipeline calculation from real registrations and partner-influenced opportunities
        pipeline_val = sum(d.expected_deal_value for d in deals)
        
        # Real partner opportunities
        partner_opps = Opportunity.objects.filter(
            Q(account__deal_registrations__partner=partner) | Q(partner_influences__partner=partner)
        ).distinct()
        won_revenue = partner_opps.filter(status=OpportunityStatus.WON).aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')

        commissions = PartnerCommission.objects.filter(partner=partner)
        total_commission_accrued = commissions.aggregate(s=Sum('commission_amount'))['s'] or Decimal('0.00')
        total_commission_approved = commissions.filter(approval_status='APPROVED').aggregate(s=Sum('commission_amount'))['s'] or Decimal('0.00')
        total_commission_paid = commissions.filter(payment_status='PAID').aggregate(s=Sum('commission_amount'))['s'] or Decimal('0.00')

        # Permitted Leads
        permitted_leads = Lead.objects.filter(partner=partner).select_related('account', 'primary_product')[:10]
        leads_data = [
            {
                "id": str(ld.id),
                "customer_name": ld.account.company_name,
                "product_name": ld.primary_product.name,
                "status": ld.status,
                "estimated_value": float(ld.estimated_opportunity_value or 0),
                "created_at": str(ld.created_at)
            }
            for ld in permitted_leads
        ]

        authorized_products = [
            {
                "product_id": str(pp.product.id),
                "product_name": pp.product.name,
                "product_code": pp.product.code,
                "status": pp.authorization_status,
                "territory": pp.territory,
                "commission_rate": float(pp.commission_rate_pct),
                "valid_from": str(pp.valid_from),
                "valid_to": str(pp.valid_to) if pp.valid_to else None
            }
            for pp in partner.authorized_products.all().select_related('product')
        ]

        authorized_territories = [
            {
                "id": str(pt.id),
                "territory": pt.territory,
                "is_primary": pt.is_primary,
                "is_exclusive": pt.is_exclusive,
                "status": pt.status
            }
            for pt in partner.territory_authorizations.all()
        ]

        certifications = [
            {
                "id": str(c.id),
                "certification_name": c.certification_name,
                "product_name": c.product.name if c.product else "All Products",
                "status": c.status,
                "issue_date": str(c.issue_date),
                "expiry_date": str(c.expiry_date) if c.expiry_date else None,
                "credential_id": c.credential_id
            }
            for c in partner.certifications.all().select_related('product')
        ]

        return Response({
            "partner_id": str(partner.id),
            "partner_name": partner.account.company_name,
            "partner_code": partner.partner_code,
            "partner_type": partner.partner_type,
            "partner_type_name": partner.partner_type_display_name,
            "territory": partner.territory,
            "status": partner.status,
            "metrics": {
                "registered_deals_count": total_registered,
                "accepted_deals_count": accepted_deals,
                "under_review_deals_count": under_review_deals,
                "rejected_deals_count": rejected_deals,
                "pipeline_estimate": float(pipeline_val),
                "won_revenue": float(won_revenue),
                "total_commission_accrued": float(total_commission_accrued),
                "total_commission_approved": float(total_commission_approved),
                "total_commission_paid": float(total_commission_paid)
            },
            "authorized_products": authorized_products,
            "authorized_territories": authorized_territories,
            "certifications": certifications,
            "recent_registrations": DealRegistrationSerializer(deals[:10], many=True).data,
            "permitted_leads": leads_data
        })
