from django.core.exceptions import ValidationError
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.opportunities.models import (
    Opportunity, OpportunityProduct, OpportunityModule,
    OpportunityCapability, Proposal, OpportunityStatus
)
from apps.opportunities.serializers import (
    OpportunitySerializer, OpportunityProductSerializer,
    OpportunityModuleSerializer, OpportunityCapabilitySerializer,
    ProposalSerializer
)
from apps.opportunities.services import OpportunityService
from apps.sales_handoff.models import SQLHandoff, HandoffStatus
from apps.pld_engine.models import PipelineStage
from apps.accounts.models import AccountProduct, AccountProductStatus
from apps.activities.models import Activity
from apps.activities.serializers import ActivitySerializer
from apps.workflows.models import StageHistory


class OpportunityViewSet(viewsets.ModelViewSet):
    queryset = Opportunity.objects.all().prefetch_related(
        'product_lines__product',
        'selected_modules__module',
        'required_capabilities__capability',
        'proposals'
    ).select_related('account', 'owner', 'stage', 'product', 'primary_contact')
    serializer_class = OpportunitySerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['post'], url_path='create-from-sql')
    def create_from_sql(self, request):
        """
        Creates an Opportunity strictly from an ACCEPTED SQL handoff.
        """
        handoff_id = request.data.get('sql_handoff_id')
        if not handoff_id:
            return Response({'error': 'sql_handoff_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            handoff = SQLHandoff.objects.select_related('lead__account', 'lead__contact', 'product', 'tenant').get(id=handoff_id)
        except SQLHandoff.DoesNotExist:
            return Response({'error': f"SQL Handoff with id {handoff_id} does not exist"}, status=status.HTTP_404_NOT_FOUND)

        try:
            opp = OpportunityService.create_from_accepted_sql(
                handoff=handoff,
                user=request.user if request.user.is_authenticated else None
            )
            return Response({
                'message': f"Opportunity #{str(opp.id)[:8]} created successfully from SQL Handoff.",
                'opportunity': OpportunitySerializer(opp).data
            }, status=status.HTTP_201_CREATED)
        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({'error': str(ex)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='transition-stage')
    def transition_stage(self, request, pk=None):
        """
        Transitions Opportunity to a new pipeline stage. Enforces mandatory reason for backward moves.
        """
        opp = self.get_object()
        target_stage_id = request.data.get('target_stage_id')
        reason = request.data.get('reason')

        if not target_stage_id:
            return Response({'error': 'target_stage_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_stage = PipelineStage.objects.get(id=target_stage_id)
        except PipelineStage.DoesNotExist:
            return Response({'error': f"Stage with id {target_stage_id} does not exist"}, status=status.HTTP_404_NOT_FOUND)

        try:
            opp = OpportunityService.transition_stage(
                opportunity=opp,
                target_stage=target_stage,
                reason=reason,
                user=request.user if request.user.is_authenticated else None
            )
            return Response({
                'message': f"Stage updated to {target_stage.stage_name}.",
                'opportunity': OpportunitySerializer(opp).data
            }, status=status.HTTP_200_OK)
        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({'error': str(ex)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post', 'patch'], url_path='update-commercials')
    def update_commercials(self, request, pk=None):
        """
        Updates and audits commercial fields (value, ARR, MRR, terms, seats, probability).
        """
        opp = self.get_object()
        try:
            opp = OpportunityService.update_commercial_fields(
                opportunity=opp,
                data=request.data,
                user=request.user if request.user.is_authenticated else None
            )
            return Response({
                'message': 'Commercial details updated successfully.',
                'opportunity': OpportunitySerializer(opp).data
            }, status=status.HTTP_200_OK)
        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({'error': str(ex)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='activities')
    def opportunity_activities(self, request, pk=None):
        """
        Retrieves all activities associated with this opportunity.
        """
        opp = self.get_object()
        activities = Activity.objects.filter(opportunity=opp).order_by('-conducted_at')
        return Response(ActivitySerializer(activities, many=True).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='history')
    def opportunity_history(self, request, pk=None):
        """
        Retrieves complete stage transition history for this opportunity.
        """
        opp = self.get_object()
        histories = StageHistory.objects.filter(record_type='OPPORTUNITY', record_id=opp.id).order_by('-changed_at')
        history_data = [
            {
                'id': str(h.id),
                'from_stage': h.from_stage.stage_name if h.from_stage else None,
                'to_stage': h.to_stage.stage_name if h.to_stage else None,
                'transition_reason': h.transition_reason,
                'is_override': h.is_override,
                'changed_by': h.changed_by.get_full_name() if h.changed_by else "System",
                'changed_at': h.changed_at
            }
            for h in histories
        ]
        return Response(history_data, status=status.HTTP_200_OK)

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


class OpportunityModuleViewSet(viewsets.ModelViewSet):
    queryset = OpportunityModule.objects.all()
    serializer_class = OpportunityModuleSerializer
    permission_classes = [permissions.AllowAny]


class OpportunityCapabilityViewSet(viewsets.ModelViewSet):
    queryset = OpportunityCapability.objects.all()
    serializer_class = OpportunityCapabilitySerializer
    permission_classes = [permissions.AllowAny]


class ProposalViewSet(viewsets.ModelViewSet):
    queryset = Proposal.objects.all()
    serializer_class = ProposalSerializer
    permission_classes = [permissions.AllowAny]
