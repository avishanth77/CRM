import uuid
from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated

from apps.integrations.models import CommunicationMessage, ERPConnectorConfig, ERPSyncRecord
from apps.integrations.serializers import (
    CampaignSerializer, LeadTouchSerializer, CommunicationMessageSerializer,
    ERPConnectorConfigSerializer, ERPSyncRecordSerializer
)
from apps.integrations.attribution_engine import MultiTouchAttributionEngine, AttributionModelType
from apps.integrations.adapters import EmailNotificationAdapter, WhatsAppNotificationAdapter, NotificationTemplates
from apps.integrations.erp_service import ERPSyncService
from apps.accounts.models import Account, Contact, AccountAttribute
from apps.activities.models import Activity, ActivityType, ActivityStatus
from apps.leads.models import Lead, LeadProductInterest, LeadStatus, Campaign, LeadTouch, LeadSource
from apps.products.models import Product
from apps.pld_engine.services import ICPEvaluator
from apps.authentication.permissions import IsAdminOrFinance, can_sync_erp
from apps.audit_logging.models import AuditLog, AuditAction
from apps.leads.services import ingest_website_lead


class CampaignViewSet(viewsets.ModelViewSet):
    queryset = Campaign.objects.all()
    serializer_class = CampaignSerializer
    permission_classes = [IsAuthenticated]


class LeadTouchViewSet(viewsets.ModelViewSet):
    queryset = LeadTouch.objects.select_related('lead', 'campaign', 'partner', 'source').all()
    serializer_class = LeadTouchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        lead_id = self.request.query_params.get('lead_id')
        if lead_id:
            qs = qs.filter(lead_id=lead_id)
        campaign_id = self.request.query_params.get('campaign_id')
        if campaign_id:
            qs = qs.filter(campaign_id=campaign_id)
        return qs


class AttributionAnalyticsView(APIView):
    """
    Computes multi-touch campaign attribution across different algorithms
    (First Touch, Last Touch, Linear, W-Shaped, Partner-Weighted).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        model_type = request.query_params.get('model', AttributionModelType.W_SHAPED).upper()
        if model_type not in [
            AttributionModelType.FIRST_TOUCH,
            AttributionModelType.LAST_TOUCH,
            AttributionModelType.LINEAR,
            AttributionModelType.W_SHAPED,
            AttributionModelType.PARTNER_WEIGHTED
        ]:
            model_type = AttributionModelType.W_SHAPED

        data = MultiTouchAttributionEngine.calculate_attribution(model_type=model_type)
        return Response(data)


class InboundWebhookLeadView(APIView):
    """
    Public webhook endpoint receiving marketing campaign form fills, website inquiries, or partner submissions.
    Supports product-specific websites (VanForces, Al Mawasil, TaskForces, SpeakOrder, EntAura).
    Delegates to the unified lead ingestion service with automatic territory resolution, domain extraction,
    and Inbound Triage queue routing.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        lead, response_payload = ingest_website_lead(
            data=request.data,
            request_meta=request.META
        )
        return Response(response_payload, status=status.HTTP_201_CREATED)



class CommunicationViewSet(viewsets.ModelViewSet):
    queryset = CommunicationMessage.objects.select_related('lead', 'account').all()
    serializer_class = CommunicationMessageSerializer
    permission_classes = [AllowAny]

    @action(detail=False, methods=['get'], url_path='stage-templates')
    def list_stage_templates(self, request):
        """
        Returns all registered stage completion notification email templates.
        """
        from apps.integrations.stage_notifications import CUSTOMER_STAGE_TEMPLATES
        templates_data = [
            {
                'key': k,
                'stage_name': v['stage_name'],
                'subject': v['subject'],
                'body_preview': v['body'][:160] + '...'
            }
            for k, v in CUSTOMER_STAGE_TEMPLATES.items()
        ]
        return Response(templates_data)

    @action(detail=False, methods=['post'], url_path='send-test')
    def send_test_message(self, request):
        channel = request.data.get('channel', 'EMAIL')
        recipient = request.data.get('recipient')
        template_key = request.data.get('template', 'SQL_READY')
        lead_id = request.data.get('lead_id')

        if not recipient:
            return Response({'error': 'recipient is required'}, status=status.HTTP_400_BAD_REQUEST)

        lead = Lead.objects.filter(id=lead_id).first() if lead_id else Lead.objects.first()
        account = lead.account if lead else Account.objects.first()

        # Check if template is one of the customer stage completion templates
        from apps.integrations.stage_notifications import CUSTOMER_STAGE_TEMPLATES, CustomerStageEmailService
        normalized_key = template_key.replace('STAGE_', '')
        custom_subject = request.data.get('subject')
        custom_body = request.data.get('body')
        if normalized_key in CUSTOMER_STAGE_TEMPLATES:
            if channel == 'EMAIL':
                res = CustomerStageEmailService.send_stage_email(
                    record=lead or account,
                    stage=normalized_key,
                    user=request.user if request.user.is_authenticated else None,
                    custom_subject=custom_subject,
                    custom_body=custom_body,
                    custom_recipient_email=recipient
                )
                rendered_body = custom_body or res.get('body')
                if not rendered_body and (lead or account):
                    try:
                        ctx = CustomerStageEmailService.build_context(lead or account, normalized_key)
                        rendered_body = ctx['template']['body'].format(**ctx)
                    except Exception:
                        rendered_body = ''
                return Response({
                    'success': res.get('success', True),
                    'message_id': res.get('message_id'),
                    'channel': 'EMAIL',
                    'status': res.get('status'),
                    'subject': res.get('subject'),
                    'body': rendered_body or ''
                }, status=status.HTTP_201_CREATED)

        template_map = {
            'SQL_READY': NotificationTemplates.SQL_READY,
            'DEAL_PROTECTION_CONFIRMED': NotificationTemplates.DEAL_PROTECTION_CONFIRMED,
            'POC_COMPLETED': NotificationTemplates.POC_COMPLETED,
        }
        template = template_map.get(template_key, NotificationTemplates.SQL_READY)

        context = {
            'recipient_name': 'Commercial Stakeholder',
            'company_name': lead.account.company_name if lead and lead.account else 'Al-Rashid Food Co.',
            'customer_name': account.company_name if account else 'Al-Rashid Food Co.',
            'partner_name': 'KAT IT Solutions',
            'product_name': 'VanForces™ Route Execution',
            'score': 84,
            'classification': 'QUALIFIED',
            'problem_impact': 'SAR 42,000 monthly leakage in order sync duplication',
            'expected_timeline': 'Q4 2026',
            'value': 95000.00,
            'expiry_date': 'December 31, 2026'
        }

        if channel == 'WHATSAPP':
            adapter = WhatsAppNotificationAdapter()
            msg = adapter.send(phone_number=recipient, template=template, context=context, lead=lead, account=account)
        else:
            adapter = EmailNotificationAdapter()
            msg = adapter.send(recipient=recipient, template=template, context=context, lead=lead, account=account)

        return Response({
            'success': msg.status != CommStatus.FAILED,
            'message_id': str(msg.id),
            'channel': msg.channel,
            'status': msg.status,
            'subject': msg.subject,
            'body': msg.body,
            'error': msg.error_message if msg.status == CommStatus.FAILED else None
        }, status=status.HTTP_201_CREATED if msg.status != CommStatus.FAILED else status.HTTP_200_OK)


class ERPConnectorViewSet(viewsets.ModelViewSet):
    queryset = ERPConnectorConfig.objects.all()
    serializer_class = ERPConnectorConfigSerializer
    permission_classes = [IsAuthenticated, IsAdminOrFinance]

    @action(detail=True, methods=['post'], url_path='sync-account')
    def sync_account(self, request, pk=None):
        user = getattr(request, 'user', None)
        if not can_sync_erp(user):
            return Response(
                {'error': 'Permission denied: Only Platform Administrators and Finance roles are authorized for ERP sync operations.'},
                status=status.HTTP_403_FORBIDDEN
            )

        connector = self.get_object()
        account_id = request.data.get('account_id')
        account = Account.objects.filter(id=account_id).first() if account_id else Account.objects.first()

        if not account:
            return Response({'error': 'No account available for ERP sync'}, status=status.HTTP_400_BAD_REQUEST)

        sync_record = ERPSyncService.sync_account_to_erp(account=account, connector=connector)

        AuditLog.objects.create(
            actor=user,
            actor_email=getattr(user, 'email', ''),
            actor_role=getattr(user, 'canonical_role', ''),
            action=AuditAction.ERP_SYNC,
            entity_type='ERPSyncRecord',
            entity_id=sync_record.id,
            changes_json={
                'connector': connector.system_name,
                'account': account.company_name,
                'status': sync_record.status
            }
        )

        return Response(ERPSyncRecordSerializer(sync_record).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='resolve-conflict')
    def resolve_conflict(self, request):
        user = getattr(request, 'user', None)
        if not can_sync_erp(user):
            return Response(
                {'error': 'Permission denied: Only Platform Administrators and Finance roles are authorized for ERP sync operations.'},
                status=status.HTTP_403_FORBIDDEN
            )

        record_id = request.data.get('sync_record_id')
        resolution = request.data.get('resolution', 'CRM_WINS')
        sync_record = ERPSyncRecord.objects.filter(id=record_id).first()

        if not sync_record:
            return Response({'error': 'Sync record not found'}, status=status.HTTP_404_NOT_FOUND)

        resolved = ERPSyncService.resolve_conflict(sync_record, resolution)

        AuditLog.objects.create(
            actor=user,
            actor_email=getattr(user, 'email', ''),
            actor_role=getattr(user, 'canonical_role', ''),
            action=AuditAction.ERP_SYNC,
            entity_type='ERPSyncRecord',
            entity_id=sync_record.id,
            changes_json={
                'resolution': resolution,
                'status': resolved.sync_status
            }
        )

        return Response(ERPSyncRecordSerializer(resolved).data, status=status.HTTP_200_OK)


class ERPSyncRecordViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ERPSyncRecord.objects.select_related('connector').all()
    serializer_class = ERPSyncRecordSerializer
    permission_classes = [IsAuthenticated, IsAdminOrFinance]
