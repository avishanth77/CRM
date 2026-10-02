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
