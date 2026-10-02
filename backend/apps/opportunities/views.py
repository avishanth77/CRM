from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.opportunities.models import Opportunity, OpportunityProduct, Proposal, OpportunityStatus
from apps.opportunities.serializers import OpportunitySerializer, OpportunityProductSerializer, ProposalSerializer
from apps.accounts.models import AccountProduct, AccountProductStatus


class OpportunityViewSet(viewsets.ModelViewSet):
    queryset = Opportunity.objects.all().prefetch_related('product_lines__product', 'proposals').select_related('account', 'owner', 'stage')
    serializer_class = OpportunitySerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=True, methods=['post'], url_path='mark-won')
    def mark_won(self, request, pk=None):
        opp = self.get_object()
        opp.status = OpportunityStatus.WON
        opp.save(update_fields=['status'])

        # Auto-create or promote AccountProduct relationship to CUSTOMER
        for line in opp.product_lines.all():
            AccountProduct.objects.update_or_create(
                account=opp.account,
                product=line.product,
                defaults={
                    'status': AccountProductStatus.CUSTOMER,
                    'contract_value': line.total_amount,
                    'arr_mrr': opp.arr_mrr
                }
            )

        return Response({
            'message': 'Opportunity won. Customer account product relationship established.',
            'opportunity': OpportunitySerializer(opp).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='mark-lost')
    def mark_lost(self, request, pk=None):
        opp = self.get_object()
        category = request.data.get('loss_reason_category')
        notes = request.data.get('loss_reason_notes')

        if not category:
            return Response({'error': 'Loss reason category is required'}, status=status.HTTP_400_BAD_REQUEST)

        opp.status = OpportunityStatus.LOST
        opp.loss_reason_category = category
        opp.loss_reason_notes = notes
        opp.save(update_fields=['status', 'loss_reason_category', 'loss_reason_notes'])

        return Response(OpportunitySerializer(opp).data, status=status.HTTP_200_OK)


class OpportunityProductViewSet(viewsets.ModelViewSet):
    queryset = OpportunityProduct.objects.all()
    serializer_class = OpportunityProductSerializer
    permission_classes = [permissions.AllowAny]


class ProposalViewSet(viewsets.ModelViewSet):
    queryset = Proposal.objects.all()
    serializer_class = ProposalSerializer
    permission_classes = [permissions.AllowAny]
