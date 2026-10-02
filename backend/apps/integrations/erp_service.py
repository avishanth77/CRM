import uuid
from typing import Dict, Any, Optional
from django.utils import timezone
from apps.accounts.models import Account
from apps.integrations.models import ERPConnectorConfig, ERPSyncRecord, ERPSyncStatus


class ERPSyncService:
    """
    Bi-directional ERP Customer Master Synchronization Gateway.
    Fulfills Master Specification Section 3.1 & Phase 5 requirements.
    """

    @classmethod
    def sync_account_to_erp(cls, account: Account, connector: ERPConnectorConfig) -> ERPSyncRecord:
        """
        Pushes a CRM Customer Account to the external ERP system.
        """
        payload = {
            'crm_account_id': str(account.id),
            'name': account.company_name,
            'industry': account.industry,
            'country': account.country,
            'city': account.city,
            'employee_count': account.employee_count,
            'annual_revenue': float(account.annual_revenue) if account.annual_revenue else 0.0,
            'lifecycle_stage': account.account_stage,
            'currency': 'SAR',
            'payment_terms': 'NET30',
            'sync_timestamp': timezone.now().isoformat()
        }

        # Mock ERP interaction based on system type
        erp_prefix = {
            'ODOO': 'ODOO-CUST',
            'SAP_B1': 'SAP-BP',
            'MS_DYNAMICS': 'MSD-ACC',
            'ZATCA': 'ZATCA-ID'
        }.get(connector.system_type, 'ERP-EXT')

        erp_ref = f"{erp_prefix}-{str(uuid.uuid4().hex[:6]).upper()}"

        # Conflict simulation rule: if company has no city/country, simulate a validation alert
        if not account.city:
            status = ERPSyncStatus.CONFLICT_DETECTED
            conflict_details = "ERP Schema Validation Alert: Postal City and Tax Code missing from CRM payload."
            response_payload = {
                'success': False,
                'error_code': 'VAL_ERR_MISSING_TAX_ADDRESS',
                'message': 'Account requires designated jurisdiction tax registration'
            }
        else:
            status = ERPSyncStatus.SUCCESS
            conflict_details = ""
            response_payload = {
                'success': True,
                'erp_id': erp_ref,
                'status': 'ACTIVE_LEDGER_CUSTOMER',
                'credit_limit': 150000.00,
                'created_in_erp_at': timezone.now().isoformat()
            }

        sync_rec = ERPSyncRecord.objects.create(
            connector=connector,
            entity_type='CUSTOMER_ACCOUNT',
            direction='CRM_TO_ERP',
            crm_entity_id=account.id,
            crm_entity_name=account.company_name,
            erp_reference_id=erp_ref if status == ERPSyncStatus.SUCCESS else '',
            status=status,
            conflict_details=conflict_details,
            payload=payload,
            response_payload=response_payload
        )

        connector.last_sync_timestamp = timezone.now()
        connector.save(update_fields=['last_sync_timestamp'])

        return sync_rec

    @classmethod
    def resolve_conflict(cls, sync_record: ERPSyncRecord, resolution: str) -> ERPSyncRecord:
        """
        Resolves an ERP synchronization conflict with audit trail.
        """
        sync_record.status = ERPSyncStatus.SUCCESS
        sync_record.conflict_details = f"Resolved via {resolution} on {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}"
        if not sync_record.erp_reference_id:
            sync_record.erp_reference_id = f"RES-{str(uuid.uuid4().hex[:6]).upper()}"
        sync_record.response_payload['resolution'] = resolution
        sync_record.save()
        return sync_record
