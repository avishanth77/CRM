from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.accounts.models import Account, AccountAttribute, Contact, AccountProduct
from apps.accounts.serializers import (
    AccountSerializer, ContactSerializer,
    AccountAttributeSerializer, AccountProductSerializer
)
from apps.products.models import Product


class AccountViewSet(viewsets.ModelViewSet):
    queryset = Account.objects.all().prefetch_related('contacts', 'custom_attributes', 'product_relationships')
    serializer_class = AccountSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=True, methods=['post'], url_path='upsert-attributes')
    def upsert_attributes(self, request, pk=None):
        account = self.get_object()
        product_id = request.data.get('product_id')
        attributes = request.data.get('attributes', {})

        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

        for key, val in attributes.items():
            AccountAttribute.objects.update_or_create(
                account=account,
                product=product,
                attribute_key=key,
                defaults={'attribute_value': val}
            )

        return Response({'message': 'Attributes saved successfully'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='create-renewal-opportunity')
    def create_renewal_opportunity(self, request, pk=None):
        from apps.opportunities.models import Opportunity, OpportunityProduct, OpportunityType, OpportunityStatus
        from apps.opportunities.serializers import OpportunitySerializer
        from apps.pld_engine.models import PipelineStage, ProductConfigurationVersion, PipelineType
        from apps.accounts.models import AccountProductStatus
        from apps.authentication.models import User
        from decimal import Decimal
        from django.utils import timezone

        account = self.get_object()
        product_id = request.data.get('product_id')
        opp_type = request.data.get('opportunity_type', 'RENEWAL').upper()
        if opp_type not in ['RENEWAL', 'EXPANSION']:
            opp_type = 'RENEWAL'

        raw_val = request.data.get('value', request.data.get('contract_value', 0))
        try:
            value = Decimal(str(raw_val or 0))
        except Exception:
            value = Decimal('0.00')

        term_months = int(request.data.get('term_months', 12))
        notes = request.data.get('notes', '')

        product = None
        if product_id:
            try:
                product = Product.objects.get(id=product_id)
            except Product.DoesNotExist:
                return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)
        if not product:
            ac_prod = account.product_relationships.first()
            if ac_prod:
                product = ac_prod.product
            else:
                product = Product.objects.first()

        primary_contact = account.contacts.filter(is_primary=True).first() or account.contacts.first()

        user = None
        if request.user and request.user.is_authenticated:
            user = request.user
        else:
            user_id = request.headers.get('X-User-Id') or request.headers.get('x-user-id') or request.data.get('user_id')
            if user_id:
                user = User.objects.filter(id=user_id, is_active=True).first()
            if not user:
                user = account.primary_owner or User.objects.filter(is_active=True).first()

        stage = PipelineStage.objects.filter(stage_code__in=['OPP_PROPOSAL', 'PROPOSAL', 'OPP_NEGOTIATION', 'NEGOTIATION']).first()
        if not stage:
            cfg = None
            if product:
                cfg = product.configurations.filter(status='PUBLISHED').first() or product.configurations.first()
            if not cfg:
                cfg = ProductConfigurationVersion.objects.first()
            stage = PipelineStage.objects.create(
                config_version=cfg,
                stage_code='OPP_PROPOSAL',
                stage_name='Proposal & Negotiation',
                pipeline_type=PipelineType.OPPORTUNITY,
                sequence_order=50
            )

        opp = Opportunity.objects.create(
            account=account,
            primary_contact=primary_contact,
            owner=user,
            opportunity_type=OpportunityType.RENEWAL if opp_type == 'RENEWAL' else OpportunityType.EXPANSION,
            stage=stage,
            status=OpportunityStatus.OPEN,
            product=product,
            total_contract_value=value,
            arr=value,
            arr_mrr=value,
            contract_term_months=term_months,
            expected_close_date=timezone.now().date() + timezone.timedelta(days=term_months * 30),
            pricing_plan=f"{product.code if product else 'TEXOL'} {opp_type.title()} Contract",
            implementation_scope=notes
        )

        if product:
            OpportunityProduct.objects.create(
                opportunity=opp,
                product=product,
                quantity=1,
                unit_price=value,
                total_amount=value
            )
            ac_prod = AccountProduct.objects.filter(account=account, product=product).first()
            if ac_prod and opp_type == 'EXPANSION':
                ac_prod.status = AccountProductStatus.EXPANSION
                ac_prod.save(update_fields=['status'])

        return Response({
            'message': f'{opp_type.title()} opportunity successfully initiated.',
            'opportunity': OpportunitySerializer(opp).data
        }, status=status.HTTP_201_CREATED)


class ContactViewSet(viewsets.ModelViewSet):
    queryset = Contact.objects.all()
    serializer_class = ContactSerializer
    permission_classes = [permissions.AllowAny]


class AccountAttributeViewSet(viewsets.ModelViewSet):
    queryset = AccountAttribute.objects.all()
    serializer_class = AccountAttributeSerializer
    permission_classes = [permissions.AllowAny]


class AccountProductViewSet(viewsets.ModelViewSet):
    queryset = AccountProduct.objects.all()
    serializer_class = AccountProductSerializer
    permission_classes = [permissions.AllowAny]
