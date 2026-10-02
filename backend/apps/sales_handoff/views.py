from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.sales_handoff.models import SQLHandoff, HandoffStatus
from apps.sales_handoff.serializers import SQLHandoffSerializer
from apps.opportunities.models import Opportunity, OpportunityProduct, OpportunityType, OpportunityStatus
from apps.pld_engine.models import PipelineType


class SQLHandoffViewSet(viewsets.ModelViewSet):
    queryset = SQLHandoff.objects.all().select_related('lead__account', 'product', 'pld_executive', 'assigned_sales_owner')
    serializer_class = SQLHandoffSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=True, methods=['post'], url_path='accept')
    def accept(self, request, pk=None):
        handoff = self.get_object()
        if handoff.status != HandoffStatus.PENDING:
            return Response({'error': f"Handoff is already {handoff.status}"}, status=status.HTTP_400_BAD_REQUEST)

        handoff.status = HandoffStatus.ACCEPTED
        handoff.decision_date = timezone.now()
        handoff.save(update_fields=['status', 'decision_date'])

        # Transition Lead to CONVERTED
        lead = handoff.lead
        lead.status = 'CONVERTED'
        lead.save(update_fields=['status'])

        # Auto-create commercial Opportunity with carried-forward PLD & Discovery details
        opp_config = handoff.product.configurations.filter(status='PUBLISHED').first()
        initial_opp_stage = None
        if opp_config:
            initial_opp_stage = opp_config.stages.filter(pipeline_type=PipelineType.OPPORTUNITY).first()

        # Extract carried-forward technical and evaluation data
        latest_assessment = lead.assessments.filter(product=handoff.product).order_by('-assessed_at').first()
        latest_poc = lead.pocs.filter(status='COMPLETED').first()
        latest_discovery = lead.discoveries.first()

        dm_name = None
        if lead.contact:
            dm_name = f"{lead.contact.first_name} {lead.contact.last_name or ''} ({lead.contact.get_role_type_display() if hasattr(lead.contact, 'get_role_type_display') else lead.contact.role_type})".strip()

        poc_summary = None
        if latest_poc:
            poc_summary = f"Success | Users: {latest_poc.users_count} | Results: {str(latest_poc.result_metrics)}"

        erp_val = None
        erp_attr = lead.account.custom_attributes.filter(attribute_key__in=['primary_erp', 'erp_system', 'erp']).first()
        if erp_attr:
            erp_val = str(erp_attr.attribute_value)

        next_due = timezone.now() + timezone.timedelta(days=3)

        opp = Opportunity.objects.create(
            account=lead.account,
            primary_contact=lead.contact,
            owner=handoff.assigned_sales_owner or (request.user if request.user.is_authenticated else None),
            sql_handoff=handoff,
            opportunity_type=OpportunityType.NEW,
            stage=initial_opp_stage,
            status=OpportunityStatus.OPEN,
            currency='USD',
            probability_pct=50,
            pld_score=latest_assessment.pld_score if latest_assessment else None,
            sql_date=timezone.now().date(),
            decision_maker=dm_name,
            implementation_scope=latest_poc.scope_description if latest_poc else (latest_discovery.business_impact_summary if latest_discovery else None),
            erp_system=erp_val,
            poc_result=poc_summary,
            next_activity_due_at=next_due,
            next_action_description="Initial Opportunity Review & Commercial Discovery"
        )

        OpportunityProduct.objects.create(
            opportunity=opp,
            product=handoff.product,
            quantity=1,
            unit_price=0.00,
            total_amount=0.00
        )

        return Response({
            'message': 'SQL Handoff accepted. Opportunity created successfully with full evaluation thread.',
            'opportunity_id': opp.id,
            'handoff': SQLHandoffSerializer(handoff).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        handoff = self.get_object()
        reason = request.data.get('rejection_reason')
        return_target = request.data.get('return_target', 'NURTURE').upper()

        if not reason:
            return Response({'error': 'Rejection reason is mandatory when declining an SQL handoff'}, status=status.HTTP_400_BAD_REQUEST)

        handoff.status = HandoffStatus.REJECTED
        handoff.decision_date = timezone.now()
        handoff.rejection_reason = reason
        handoff.save(update_fields=['status', 'decision_date', 'rejection_reason'])

        lead = handoff.lead
        from_stage = lead.current_stage
        target_stage = None

        config_version = handoff.product.configurations.filter(status='PUBLISHED').first()

        if return_target == 'DISCOVERY':
            lead.status = 'DISCOVERY'
            if config_version:
                target_stage = config_version.stages.filter(stage_name__icontains='Discovery').first()
        elif return_target == 'PLD':
            lead.status = 'QUALIFICATION'
            if config_version:
                target_stage = config_version.stages.filter(stage_name__icontains='PLD').first()
        else:
            return_target = 'NURTURE'
            lead.status = 'NURTURE'
            lead.nurture_reason = f"Sales Rejected SQL: {reason}"

        if target_stage:
            lead.current_stage = target_stage

        lead.save(update_fields=['status', 'current_stage', 'nurture_reason'])

        # Record Stage History Rollback
        from apps.workflows.models import StageHistory
        StageHistory.objects.create(
            record_type='LEAD',
            record_id=lead.id,
            from_stage=from_stage,
            to_stage=target_stage or from_stage,
            transition_reason=f"Sales Rejected SQL Handoff: {reason} [Routed to: {return_target}]",
            is_override=True,
            changed_by=request.user if request.user.is_authenticated else None
        )

        return Response({
            'message': f"SQL Handoff rejected and returned to {return_target}.",
            'return_target': return_target,
            'handoff': SQLHandoffSerializer(handoff).data
        }, status=status.HTTP_200_OK)
