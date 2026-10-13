from django.core.exceptions import ValidationError, PermissionDenied
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.opportunities.models import (
    Opportunity, OpportunityProduct, OpportunityModule,
    OpportunityCapability, Proposal, ProposalVersion, ProposalItem,
    ApprovalRule, OpportunityStatus, ProposalStatus
)
from apps.opportunities.serializers import (
    OpportunitySerializer, OpportunityProductSerializer,
    OpportunityModuleSerializer, OpportunityCapabilitySerializer,
    ProposalSerializer, ProposalVersionSerializer, ProposalItemSerializer,
    ApprovalRuleSerializer
)
from apps.opportunities.services import OpportunityService, ProposalService
from apps.sales_handoff.models import SQLHandoff, HandoffStatus
from django.utils import timezone
from apps.pld_engine.models import PipelineStage
from apps.accounts.models import AccountProduct, AccountProductStatus, AccountType
from apps.activities.models import Activity
from apps.activities.serializers import ActivitySerializer
from apps.workflows.models import StageHistory
from apps.audit_logging.models import AuditLog
from apps.audit_logging.serializers import AuditLogSerializer
from apps.authentication.models import User, UserRole
from apps.authentication.backends import get_request_user, is_management_or_admin, is_sales_staff


class OpportunityViewSet(viewsets.ModelViewSet):
    serializer_class = OpportunitySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        user = get_request_user(self.request)
        partner = None
        if user and (getattr(user, 'is_partner_user', False) or getattr(user, 'role', None) == 'PARTNER_USER'):
            partner_prof = getattr(user, 'partner_profile', None)
            partner = partner_prof.partner if partner_prof else None

        qs = Opportunity.objects.all().prefetch_related(
            'product_lines__product',
            'selected_modules__module',
            'required_capabilities__capability',
            'proposals',
            'partner_influences__partner'
        ).select_related('account', 'owner', 'stage', 'product', 'primary_contact')

        if partner:
            qs = qs.filter(
                Q(account__deal_registrations__partner=partner) |
                Q(partner_influences__partner=partner) |
                Q(sql_handoff__lead__partner=partner)
            ).distinct()

        if is_sales_staff(user):
            qs = qs.filter(owner=user)

        return qs

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
            send_stage_email = request.data.get('send_stage_email', True)
            custom_subject = request.data.get('custom_email_subject') or request.data.get('subject')
            custom_body = request.data.get('custom_email_body') or request.data.get('body')
            custom_recipient_email = request.data.get('custom_recipient_email') or request.data.get('recipient_email')

            opp = OpportunityService.transition_stage(
                opportunity=opp,
                target_stage=target_stage,
                reason=reason,
                user=request.user if request.user.is_authenticated else None,
                send_stage_email=send_stage_email,
                custom_subject=custom_subject,
                custom_body=custom_body,
                custom_recipient_email=custom_recipient_email
            )
            return Response({
                'message': f"Stage updated to {target_stage.stage_name}.",
                'opportunity': OpportunitySerializer(opp).data
            }, status=status.HTTP_200_OK)
        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({'error': str(ex)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='stage-email-preview')
    def stage_email_preview(self, request, pk=None):
        """
        Returns preview of the stage completion email that will be sent to the customer for this opportunity.
        """
        opp = self.get_object()
        stage_id = request.query_params.get('stage_id')
        stage = None
        if stage_id:
            stage = PipelineStage.objects.filter(id=stage_id).first()
        if not stage:
            stage = opp.stage or 'OPP_PROPOSAL'
        status_override = request.query_params.get('status')
        from apps.integrations.stage_notifications import CustomerStageEmailService
        preview = CustomerStageEmailService.get_stage_email_preview(
            record=opp,
            stage=stage,
            status_override=status_override
        )
        return Response(preview, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='send-stage-email')
    def send_stage_email(self, request, pk=None):
        """
        Manually trigger / resend customer stage notification email for this opportunity.
        """
        opp = self.get_object()
        stage_id = request.data.get('stage_id')
        stage = None
        if stage_id:
            stage = PipelineStage.objects.filter(id=stage_id).first()
        if not stage:
            stage = opp.stage or 'OPP_PROPOSAL'
        custom_subject = request.data.get('subject') or request.data.get('custom_subject')
        custom_body = request.data.get('body') or request.data.get('custom_body')
        custom_recipient = request.data.get('recipient_email') or request.data.get('custom_recipient_email')
        status_override = request.data.get('status')

        from apps.integrations.stage_notifications import CustomerStageEmailService
        res = CustomerStageEmailService.send_stage_email(
            record=opp,
            stage=stage,
            user=request.user if request.user.is_authenticated else None,
            custom_subject=custom_subject,
            custom_body=custom_body,
            custom_recipient_email=custom_recipient,
            status_override=status_override
        )
        return Response(res, status=status.HTTP_200_OK)

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
        user = get_request_user(request)
        try:
            latest_proposal = opp.proposals.order_by('-version_number', '-created_at').first()
            opp = ProposalService.mark_opportunity_won(
                opportunity=opp,
                final_proposal=latest_proposal,
                user=user
            )

            # Auto-create or promote AccountProduct relationship to CUSTOMER
            if opp.product:
                AccountProduct.objects.update_or_create(
                    account=opp.account,
                    product=opp.product,
                    defaults={
                        'status': AccountProductStatus.CUSTOMER,
                        'contract_value': opp.total_contract_value,
                        'arr_mrr': opp.arr_mrr or opp.arr or opp.total_contract_value
                    }
                )
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
        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({'error': str(ex)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='mark-lost')
    def mark_lost(self, request, pk=None):
        opp = self.get_object()
        category = request.data.get('loss_reason_category')
        notes = request.data.get('loss_reason_notes', '')
        competitor = request.data.get('competitor', '')

        if not category:
            return Response({'error': 'Loss reason category is required'}, status=status.HTTP_400_BAD_REQUEST)

        user = get_request_user(request)
        try:
            opp = ProposalService.mark_opportunity_lost(
                opportunity=opp,
                loss_reason_category=category,
                loss_reason_notes=notes,
                competitor=competitor,
                user=user
            )

            # Automated Customer Notification Email for Closed Lost
            try:
                from apps.integrations.stage_notifications import CustomerStageEmailService
                CustomerStageEmailService.send_stage_email(
                    record=opp,
                    stage='OPP_CLOSED_LOST',
                    user=user,
                    status_override='LOST'
                )
            except Exception as email_err:
                import logging
                logging.getLogger(__name__).warning(f"Opportunity lost customer email failed: {email_err}")

            return Response(OpportunitySerializer(opp).data, status=status.HTTP_200_OK)
        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({'error': str(ex)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='to-negotiation')
    def to_negotiation(self, request, pk=None):
        opp = self.get_object()
        reason = request.data.get('reason', '')
        try:
            opp = ProposalService.transition_to_negotiation(
                opportunity=opp,
                user=request.user if request.user.is_authenticated else None,
                reason=reason
            )
            return Response({
                'message': 'Opportunity transitioned to Negotiation stage.',
                'opportunity': OpportunitySerializer(opp).data
            }, status=status.HTTP_200_OK)
        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
    @action(detail=True, methods=['post'], url_path='re-engage')
    def re_engage(self, request, pk=None):
        opp = self.get_object()
        target_stage_code = request.data.get('stage_code', 'OPP_NEGOTIATION')
        reason = request.data.get('reason', 'Customer requested re-evaluation / competitor contract review.')

        stage = PipelineStage.objects.filter(stage_code__in=[target_stage_code, 'OPP_NEGOTIATION', 'NEGOTIATION']).first()
        opp.status = OpportunityStatus.OPEN
        if stage:
            opp.stage = stage
        opp.loss_reason_category = None
        opp.save(update_fields=['status', 'stage', 'loss_reason_category'])

        user = get_request_user(request)
        StageHistory.objects.create(
            record_type='OPPORTUNITY',
            record_id=opp.id,
            to_stage=stage,
            transition_reason=f"Opportunity revived from Nurture pool: {reason}",
            changed_by=user if user and user.is_authenticated else None
        )
        return Response({
            'message': 'Opportunity reopened successfully.',
            'opportunity': OpportunitySerializer(opp).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get', 'post'], url_path='proposals')
    def opportunity_proposals(self, request, pk=None):
        opp = self.get_object()
        if request.method == 'GET':
            proposals = opp.proposals.all().order_by('-created_at')
            return Response(ProposalSerializer(proposals, many=True).data, status=status.HTTP_200_OK)
        elif request.method == 'POST':
            try:
                proposal = ProposalService.create_proposal(
                    opportunity=opp,
                    data=request.data,
                    user=request.user if request.user.is_authenticated else None
                )
                return Response(ProposalSerializer(proposal).data, status=status.HTTP_201_CREATED)
            except ValidationError as ve:
                return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as ex:
                return Response({'error': str(ex)}, status=status.HTTP_400_BAD_REQUEST)


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
    serializer_class = ProposalSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Proposal.objects.all().prefetch_related('versions__items')
        user = get_request_user(self.request)
        if is_sales_staff(user):
            qs = qs.filter(Q(owner=user) | Q(opportunity__owner=user))
        opp_id = self.request.query_params.get('opportunity')
        if opp_id:
            qs = qs.filter(opportunity_id=opp_id)
        account_id = self.request.query_params.get('account')
        if account_id:
            qs = qs.filter(account_id=account_id)
        return qs

    def create(self, request, *args, **kwargs):
        user = get_request_user(request)
        opp_id = request.data.get('opportunity')
        if not opp_id:
            return Response({'error': 'Opportunity ID is required to generate a proposal.'}, status=status.HTTP_400_BAD_REQUEST)
        opp = Opportunity.objects.filter(id=opp_id).first()
        if not opp:
            return Response({'error': f'Opportunity {opp_id} not found.'}, status=status.HTTP_404_NOT_FOUND)
        if is_sales_staff(user) and opp.owner_id != getattr(user, 'id', None):
            return Response({'error': 'Permission denied. You can only create proposals for your own opportunities.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            proposal = ProposalService.create_proposal(
                opportunity=opp,
                data=request.data,
                user=request.user if request.user.is_authenticated else None
            )
            return Response(ProposalSerializer(proposal).data, status=status.HTTP_201_CREATED)
        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({'error': str(ex)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='create-version')
    def create_version(self, request, pk=None):
        proposal = self.get_object()
        try:
            new_version = ProposalService.create_new_version(
                proposal=proposal,
                data=request.data,
                user=request.user if request.user.is_authenticated else None
            )
            return Response({
                'message': f"Proposal version {new_version.version_number} created successfully.",
                'proposal': ProposalSerializer(proposal).data,
                'version': ProposalVersionSerializer(new_version).data
            }, status=status.HTTP_201_CREATED)
        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({'error': str(ex)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='send')
    def send_proposal(self, request, pk=None):
        proposal = self.get_object()
        version_num = request.data.get('version_number', proposal.version_number)
        version = proposal.versions.filter(version_number=version_num).first()
        if not version:
            return Response({'error': f"Proposal version {version_num} not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            version = ProposalService.send_proposal(
                proposal_version=version,
                user=request.user if request.user.is_authenticated else None,
                recipient_email=request.data.get('recipient_email'),
                next_action_description=request.data.get('next_action_description'),
                next_action_due_at=request.data.get('next_activity_due_at')
            )
            return Response({
                'message': f"Proposal {proposal.proposal_number} v{version.version_number} sent successfully to client.",
                'proposal': ProposalSerializer(proposal).data
            }, status=status.HTTP_200_OK)
        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({'error': str(ex)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='request-approval')
    def request_approval(self, request, pk=None):
        proposal = self.get_object()
        version_num = request.data.get('version_number', proposal.version_number)
        version = proposal.versions.filter(version_number=version_num).first()
        if not version:
            return Response({'error': f"Proposal version {version_num} not found."}, status=status.HTTP_404_NOT_FOUND)

        reason = request.data.get('reason', '')
        version = ProposalService.request_approval(
            proposal_version=version,
            reason=reason,
            user=request.user if request.user.is_authenticated else None
        )
        return Response({
            'message': 'Proposal submitted for commercial management approval.',
            'proposal': ProposalSerializer(proposal).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        proposal = self.get_object()
        version_num = request.data.get('version_number', proposal.version_number)
        version = proposal.versions.filter(version_number=version_num).first()
        if not version:
            return Response({'error': f"Proposal version {version_num} not found."}, status=status.HTTP_404_NOT_FOUND)

        user = get_request_user(request)
        try:
            version = ProposalService.approve_proposal(
                proposal_version=version,
                user=user,
                comments=request.data.get('comments', '')
            )
            # Re-fetch proposal with preloaded relationships to ensure latest status is serialized
            fresh_proposal = Proposal.objects.prefetch_related('versions__items').get(id=proposal.id)
            return Response({
                'message': f"Proposal version {version.version_number} approved successfully.",
                'proposal': ProposalSerializer(fresh_proposal).data
            }, status=status.HTTP_200_OK)
        except PermissionDenied as pd:
            return Response({'error': str(pd)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({'error': str(ex)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        proposal = self.get_object()
        version_num = request.data.get('version_number', proposal.version_number)
        version = proposal.versions.filter(version_number=version_num).first()
        if not version:
            return Response({'error': f"Proposal version {version_num} not found."}, status=status.HTTP_404_NOT_FOUND)

        user = get_request_user(request)
        reason = request.data.get('rejection_reason')
        try:
            version = ProposalService.reject_proposal(
                proposal_version=version,
                user=user,
                rejection_reason=reason
            )
            fresh_proposal = Proposal.objects.prefetch_related('versions__items').get(id=proposal.id)
            return Response({
                'message': f"Proposal version {version.version_number} rejected.",
                'proposal': ProposalSerializer(fresh_proposal).data
            }, status=status.HTTP_200_OK)
        except PermissionDenied as pd:
            return Response({'error': str(pd)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({'error': str(ex)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='expire')
    def expire(self, request, pk=None):
        proposal = self.get_object()
        version_num = request.data.get('version_number', proposal.version_number)
        version = proposal.versions.filter(version_number=version_num).first()
        if not version:
            return Response({'error': f"Proposal version {version_num} not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            version = ProposalService.mark_expired(
                proposal_version=version,
                user=request.user if request.user.is_authenticated else None
            )
            return Response({
                'message': f"Proposal version {version.version_number} marked as expired.",
                'proposal': ProposalSerializer(proposal).data
            }, status=status.HTTP_200_OK)
        except Exception as ex:
            return Response({'error': str(ex)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='history')
    def history(self, request, pk=None):
        proposal = self.get_object()
        v_ids = list(proposal.versions.values_list('id', flat=True))
        logs = AuditLog.objects.filter(
            entity_id__in=[proposal.id] + v_ids
        ).order_by('-timestamp')
        return Response(AuditLogSerializer(logs, many=True).data, status=status.HTTP_200_OK)


class ProposalVersionViewSet(viewsets.ModelViewSet):
    queryset = ProposalVersion.objects.all().prefetch_related('items')
    serializer_class = ProposalVersionSerializer
    permission_classes = [permissions.AllowAny]


class ProposalItemViewSet(viewsets.ModelViewSet):
    queryset = ProposalItem.objects.all()
    serializer_class = ProposalItemSerializer
    permission_classes = [permissions.AllowAny]


class ApprovalRuleViewSet(viewsets.ModelViewSet):
    queryset = ApprovalRule.objects.all().order_by('approval_sequence', '-created_at')
    serializer_class = ApprovalRuleSerializer
    permission_classes = [permissions.AllowAny]
