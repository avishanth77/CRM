from django.utils import timezone
from datetime import timedelta
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.partners.models import (
    Partner, PartnerUser, PartnerProduct, DealRegistration,
    PartnerCommission, PartnerInfluence, DealRegistrationStatus
)
from apps.partners.serializers import (
    PartnerSerializer, PartnerProductSerializer,
    DealRegistrationSerializer, PartnerCommissionSerializer,
    PartnerInfluenceSerializer
)
from apps.leads.models import Lead, LeadTouch
from apps.accounts.models import AccountProduct


class PartnerViewSet(viewsets.ModelViewSet):
    queryset = Partner.objects.all().select_related('account', 'partner_manager').prefetch_related('authorized_products__product', 'users')
    serializer_class = PartnerSerializer
    permission_classes = [permissions.AllowAny]


class PartnerProductViewSet(viewsets.ModelViewSet):
    queryset = PartnerProduct.objects.all().select_related('partner__account', 'product')
    serializer_class = PartnerProductSerializer
    permission_classes = [permissions.AllowAny]


class DealRegistrationViewSet(viewsets.ModelViewSet):
    queryset = DealRegistration.objects.all().select_related('partner__account', 'customer_account', 'product')
    serializer_class = DealRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        customer_id = request.data.get('customer_account')
        product_id = request.data.get('product')
        partner_id = request.data.get('partner')

        # 1. Conflict & Duplicate Protection Check
        existing_conflict = DealRegistration.objects.filter(
            customer_account_id=customer_id,
            product_id=product_id,
            status=DealRegistrationStatus.ACCEPTED,
            protection_expiry_date__gte=timezone.now().date()
        ).first()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        deal_reg = serializer.save()

        if existing_conflict:
            # Conflict detected: Flag for managerial review
            deal_reg.status = DealRegistrationStatus.UNDER_REVIEW
            deal_reg.rejection_reason = f"Conflict: Deal already protected for {existing_conflict.partner.account.company_name} until {existing_conflict.protection_expiry_date}"
            deal_reg.save(update_fields=['status', 'rejection_reason'])
            return Response({
                'message': 'Registration submitted under Manager Review due to existing partner protection.',
                'conflict': True,
                'registration': DealRegistrationSerializer(deal_reg).data
            }, status=status.HTTP_201_CREATED)

        return Response({
            'message': 'Deal registration submitted successfully.',
            'conflict': False,
            'registration': DealRegistrationSerializer(deal_reg).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='accept')
    def accept(self, request, pk=None):
        reg = self.get_object()
        days_protection = int(request.data.get('protection_days', 90))

        reg.status = DealRegistrationStatus.ACCEPTED
        reg.protection_expiry_date = timezone.now().date() + timedelta(days=days_protection)
        reg.save(update_fields=['status', 'protection_expiry_date'])

        # Auto-create attributed Lead Touch for multi-touch attribution
        lead = Lead.objects.filter(account=reg.customer_account, primary_product=reg.product).first()
        if lead:
            LeadTouch.objects.create(
                lead=lead,
                partner=reg.partner,
                touch_type='Registered Partner Deal',
                utm_parameters={'deal_registration_id': str(reg.id)}
            )

        return Response({
            'message': f"Deal registration accepted. Protected exclusivity active for {days_protection} days.",
            'registration': DealRegistrationSerializer(reg).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        reg = self.get_object()
        reason = request.data.get('reason')
        if not reason:
            return Response({'error': 'Rejection reason is required'}, status=status.HTTP_400_BAD_REQUEST)

        reg.status = DealRegistrationStatus.REJECTED
        reg.rejection_reason = reason
        reg.save(update_fields=['status', 'rejection_reason'])

        return Response({
            'message': 'Deal registration rejected.',
            'registration': DealRegistrationSerializer(reg).data
        }, status=status.HTTP_200_OK)


class PartnerCommissionViewSet(viewsets.ModelViewSet):
    queryset = PartnerCommission.objects.all().select_related('partner__account', 'opportunity__account')
    serializer_class = PartnerCommissionSerializer
    permission_classes = [permissions.AllowAny]


class PartnerPortalDashboardView(APIView):
    """
    Dedicated endpoint serving Partner Portal metrics for the logged-in or requested partner.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        partner_id = request.query_params.get('partner_id')
        partner = Partner.objects.filter(id=partner_id).first() if partner_id else Partner.objects.first()

        if not partner:
            return Response({'error': 'No partner found'}, status=status.HTTP_404_NOT_FOUND)

        deals = DealRegistration.objects.filter(partner=partner)
        total_registered = deals.count()
        accepted_deals = deals.filter(status=DealRegistrationStatus.ACCEPTED).count()
        
        commissions = PartnerCommission.objects.filter(partner=partner)
        total_commission_accrued = sum(c.commission_amount for c in commissions)

        authorized_products = [
            {
                "product_name": pp.product.name,
                "product_code": pp.product.code,
                "status": pp.authorization_status,
                "commission_rate": float(pp.commission_rate_pct)
            }
            for pp in partner.authorized_products.all()
        ]

        return Response({
            "partner_name": partner.account.company_name,
            "partner_code": partner.partner_code,
            "territory": partner.territory,
            "metrics": {
                "registered_deals_count": total_registered,
                "accepted_deals_count": accepted_deals,
                "pipeline_estimate": float(sum(d.expected_deal_value for d in deals)),
                "total_commission_accrued": float(total_commission_accrued)
            },
            "authorized_products": authorized_products,
            "recent_registrations": DealRegistrationSerializer(deals[:10], many=True).data
        })
