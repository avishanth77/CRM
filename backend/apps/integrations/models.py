import uuid
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel
from apps.products.models import Product
from apps.leads.models import Lead, Campaign, LeadTouch
from apps.accounts.models import Account


class CommChannel(models.TextChoices):
    EMAIL = 'EMAIL', 'Email'
    WHATSAPP = 'WHATSAPP', 'WhatsApp'
    IN_APP_ALERT = 'IN_APP_ALERT', 'In-App System Notification'


class CommStatus(models.TextChoices):
    QUEUED = 'QUEUED', 'Queued'
    SENT = 'SENT', 'Sent'
    DELIVERED = 'DELIVERED', 'Delivered'
    READ = 'READ', 'Read / Opened'
    FAILED = 'FAILED', 'Failed'


class CommunicationMessage(BaseModel):
    """
    Unified communication record for Email & WhatsApp adapters.
    """
    channel = models.CharField(max_length=16, choices=CommChannel.choices, default=CommChannel.EMAIL)
    recipient_name = models.CharField(max_length=128)
    recipient_address = models.CharField(max_length=255, help_text="Email address or WhatsApp phone with E.164 country code")
    lead = models.ForeignKey(Lead, on_delete=models.SET_NULL, null=True, blank=True, related_name="communications")
    account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name="communications")
    template_code = models.CharField(max_length=64, help_text="e.g. SQL_STAGE_ALERT, LEAD_CONFIRMATION, POC_SUMMARY")
    subject = models.CharField(max_length=255, blank=True, default='')
    body = models.TextField()
    status = models.CharField(max_length=16, choices=CommStatus.choices, default=CommStatus.SENT)
    provider = models.CharField(max_length=64, default='MockAdapter')
    provider_message_id = models.CharField(max_length=128, blank=True, default='')
    delivered_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.channel}] to {self.recipient_address} - {self.status}"


class ERPSystem(models.TextChoices):
    ODOO = 'ODOO', 'Odoo 17/18 Enterprise'
    SAP_BUSINESS_ONE = 'SAP_B1', 'SAP Business One'
    MS_DYNAMICS = 'MS_DYNAMICS', 'Microsoft Dynamics 365 Finance & Ops'
    ZATCA_E_INVOICE = 'ZATCA', 'ZATCA Compliance Gateway'


class ERPSyncStatus(models.TextChoices):
    SUCCESS = 'SUCCESS', 'Synchronized'
    PENDING_REVIEW = 'PENDING_REVIEW', 'Pending Review'
    CONFLICT_DETECTED = 'CONFLICT_DETECTED', 'Conflict Detected'
    FAILED = 'FAILED', 'Failed'


class ERPConnectorConfig(BaseModel):
    """
    Configuration for ERP customer master and transactional synchronization.
    """
    system_type = models.CharField(max_length=32, choices=ERPSystem.choices, default=ERPSystem.ODOO)
    system_name = models.CharField(max_length=128)
    base_endpoint = models.URLField(max_length=255)
    auth_mode = models.CharField(
        max_length=32,
        choices=[('API_KEY', 'API Key'), ('OAUTH2', 'OAuth2 Token'), ('BASIC', 'Basic Auth')],
        default='API_KEY'
    )
    api_key_masked = models.CharField(max_length=64, default='sk_erp_••••••••••8941')
    is_active = models.BooleanField(default=True)
    auto_sync_on_won = models.BooleanField(default=True, help_text="Auto-push to ERP when Opportunity reaches Won")
    last_sync_timestamp = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.system_name} ({self.system_type})"


class ERPSyncRecord(BaseModel):
    """
    Audit log of bi-directional synchronization events between CRM and ERP.
    """
    connector = models.ForeignKey(ERPConnectorConfig, on_delete=models.CASCADE, related_name="sync_logs")
    entity_type = models.CharField(
        max_length=32,
        choices=[('CUSTOMER_ACCOUNT', 'Customer Account'), ('SALES_ORDER', 'Sales Order / Contract'), ('INVOICE', 'Invoice')],
        default='CUSTOMER_ACCOUNT'
    )
    direction = models.CharField(
        max_length=32,
        choices=[('CRM_TO_ERP', 'Outbound: CRM → ERP'), ('ERP_TO_CRM', 'Inbound: ERP → CRM')],
        default='CRM_TO_ERP'
    )
    crm_entity_id = models.UUIDField()
    crm_entity_name = models.CharField(max_length=255)
    erp_reference_id = models.CharField(max_length=128, blank=True, default='')
    status = models.CharField(max_length=32, choices=ERPSyncStatus.choices, default=ERPSyncStatus.SUCCESS)
    conflict_details = models.TextField(blank=True, default='')
    payload = models.JSONField(default=dict)
    response_payload = models.JSONField(default=dict)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"ERP Sync: {self.crm_entity_name} [{self.status}]"
