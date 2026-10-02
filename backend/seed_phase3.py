import os
import django
from decimal import Decimal
from datetime import date, timedelta
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import Account
from apps.products.models import Product
from apps.leads.models import Lead, Campaign, LeadTouch, LeadSource
from apps.partners.models import Partner
from apps.opportunities.models import Opportunity
from apps.integrations.models import (
    ERPConnectorConfig, ERPSyncRecord, ERPSyncStatus,
    CommunicationMessage, CommChannel, CommStatus
)


def seed():
    print("[*] Starting Phase 3 Data Seeding...")

    # 1. Seed Campaigns
    p_van = Product.objects.filter(code='VANFORCES').first()
    p_erp = Product.objects.filter(code='TASKFORCES_ERP').first()

    c1, _ = Campaign.objects.get_or_create(
        code='CMP-2026-VAN-Q4',
        defaults={
            'name': 'VanForces GCC FMCG Digital Push Q4',
            'campaign_type': 'Google Ads / Search',
            'start_date': date(2026, 9, 1),
            'end_date': date(2026, 12, 31),
            'budget': Decimal('25000.00'),
        }
    )

    c2, _ = Campaign.objects.get_or_create(
        code='CMP-2026-ERP-GITEX',
        defaults={
            'name': 'GITEX Global 2026 ERP & Multi-Product Showcase',
            'campaign_type': 'Trade Show / Expo',
            'start_date': date(2026, 10, 10),
            'end_date': date(2026, 10, 16),
            'budget': Decimal('40000.00'),
        }
    )

    c3, _ = Campaign.objects.get_or_create(
        code='CMP-2026-PARTNER-KAT',
        defaults={
            'name': 'KAT IT Solutions VanForces Co-Marketing',
            'campaign_type': 'Partner Co-Marketing',
            'start_date': date(2026, 8, 1),
            'end_date': date(2026, 11, 30),
            'budget': Decimal('15000.00'),
        }
    )

    c4, _ = Campaign.objects.get_or_create(
        code='CMP-2026-WA-OUTREACH',
        defaults={
            'name': 'Direct WhatsApp Outreach - Bakery & Dairy Chains',
            'campaign_type': 'WhatsApp Broadcast',
            'start_date': date(2026, 9, 15),
            'end_date': date(2026, 12, 15),
            'budget': Decimal('10000.00'),
        }
    )
    print("  [OK] Campaigns seeded (4 total)")

    # 2. Seed Lead Touches
    src_web, _ = LeadSource.objects.get_or_create(code='WEBSITE', defaults={'name': 'Website Demo Request'})
    src_partner, _ = LeadSource.objects.get_or_create(code='PARTNER', defaults={'name': 'Partner Referral'})
    src_wa, _ = LeadSource.objects.get_or_create(code='WHATSAPP', defaults={'name': 'WhatsApp Direct'})
    partner_kat = Partner.objects.first()

    leads = Lead.objects.all()
    if leads.exists():
        lead1 = leads.first()
        LeadTouch.objects.get_or_create(
            lead=lead1,
            campaign=c1,
            touch_type='First Touch: Google Search Ad Click',
            defaults={
                'source': src_web,
                'utm_parameters': {'utm_source': 'google', 'utm_medium': 'cpc', 'utm_campaign': 'gcc_vanforces_q4'}
            }
        )
        LeadTouch.objects.get_or_create(
            lead=lead1,
            campaign=c1,
            touch_type='Content Download: Van Fleet ROI Whitepaper',
            defaults={
                'source': src_web,
                'utm_parameters': {'utm_source': 'google', 'utm_medium': 'cpc', 'asset': 'roi_whitepaper'}
            }
        )
        LeadTouch.objects.get_or_create(
            lead=lead1,
            partner=partner_kat,
            touch_type='Partner Intro Call & Technical Architecture Review',
            defaults={
                'source': src_partner,
                'utm_parameters': {'partner_id': str(partner_kat.id) if partner_kat else ''}
            }
        )
        print(f"  [OK] Multi-touch points registered for lead: {lead1.account.company_name}")

    if leads.count() > 1:
        lead2 = leads[1]
        LeadTouch.objects.get_or_create(
            lead=lead2,
            campaign=c4,
            touch_type='Inbound WhatsApp Inquiry: Fleet Order Sync',
            defaults={
                'source': src_wa,
                'utm_parameters': {'channel': 'whatsapp', 'campaign': 'wa_bakery_gcc'}
            }
        )
        LeadTouch.objects.get_or_create(
            lead=lead2,
            campaign=c2,
            touch_type='GITEX Stand Live Demo & Problem Mapping',
            defaults={
                'source': src_web,
                'utm_parameters': {'event': 'GITEX_2026', 'stand': 'H6-22'}
            }
        )
        print(f"  [OK] Multi-touch points registered for lead: {lead2.account.company_name}")

    # 3. Seed ERP Connectors
    erp1, _ = ERPConnectorConfig.objects.get_or_create(
        system_name='Odoo 17 Enterprise ERP',
        defaults={
            'system_type': 'ODOO',
            'base_endpoint': 'https://odoo-erp.texol-demo.com/api/v2',
            'auth_mode': 'API_KEY',
            'api_key_masked': 'sk_live_odoo_••••••••9102',
            'is_active': True,
            'auto_sync_on_won': True,
            'last_sync_timestamp': timezone.now() - timedelta(hours=2)
        }
    )

    erp2, _ = ERPConnectorConfig.objects.get_or_create(
        system_name='SAP Business One HANA',
        defaults={
            'system_type': 'SAP_B1',
            'base_endpoint': 'https://sap-b1.texol-demo.com/b1s/v1',
            'auth_mode': 'OAUTH2',
            'api_key_masked': 'oauth_sap_••••••••4812',
            'is_active': True,
            'auto_sync_on_won': True,
            'last_sync_timestamp': timezone.now() - timedelta(hours=6)
        }
    )

    erp3, _ = ERPConnectorConfig.objects.get_or_create(
        system_name='Microsoft Dynamics 365 Finance',
        defaults={
            'system_type': 'MS_DYNAMICS',
            'base_endpoint': 'https://dynamics365.texol-demo.com/data',
            'auth_mode': 'API_KEY',
            'api_key_masked': 'msd_live_••••••••3319',
            'is_active': False,
            'auto_sync_on_won': False,
            'last_sync_timestamp': None
        }
    )
    print("  [OK] ERP Connectors seeded (Odoo, SAP B1, MS Dynamics)")

    # 4. Seed ERP Sync Logs
    acc1 = Account.objects.first()
    if acc1:
        ERPSyncRecord.objects.get_or_create(
            connector=erp1,
            crm_entity_id=acc1.id,
            defaults={
                'entity_type': 'CUSTOMER_ACCOUNT',
                'direction': 'CRM_TO_ERP',
                'crm_entity_name': acc1.company_name,
                'erp_reference_id': 'ODOO-CUST-8819',
                'status': ERPSyncStatus.SUCCESS,
                'payload': {
                    'name': acc1.company_name,
                    'industry': acc1.industry,
                    'city': acc1.city,
                    'currency': 'SAR',
                    'credit_limit': 150000.00
                },
                'response_payload': {
                    'success': True,
                    'erp_id': 'ODOO-CUST-8819',
                    'ledger_status': 'ACTIVE'
                }
            }
        )

    accs = Account.objects.all()
    if accs.count() > 1:
        acc2 = accs[1]
        ERPSyncRecord.objects.get_or_create(
            connector=erp2,
            crm_entity_id=acc2.id,
            defaults={
                'entity_type': 'CUSTOMER_ACCOUNT',
                'direction': 'CRM_TO_ERP',
                'crm_entity_name': acc2.company_name,
                'erp_reference_id': 'SAP-BP-Pending',
                'status': ERPSyncStatus.CONFLICT_DETECTED,
                'conflict_details': 'Tax VAT ID Mismatch: External SAP tax registry requires 15-digit ZATCA VAT number.',
                'payload': {
                    'name': acc2.company_name,
                    'tax_number': '300012345600003'
                },
                'response_payload': {
                    'error_code': 'VAT_VALIDATION_FAILURE',
                    'message': 'VAT ID not verified against ZATCA portal'
                }
            }
        )
    print("  [OK] ERP Sync Audit Records seeded")

    # 5. Seed Communication Messages (Email & WhatsApp Logs)
    CommunicationMessage.objects.get_or_create(
        recipient_address='operations@alrashidfood.sa',
        template_code='SQL_READY',
        defaults={
            'channel': CommChannel.EMAIL,
            'recipient_name': 'Tariq Al-Mansoor (VP Supply Chain)',
            'subject': 'Action Required: SQL Handoff Cleared for Al-Rashid Food Co. [VanForces™]',
            'body': 'Stage Gate 3 cleared with PLD Score 84/100. Van sales integration scope approved.',
            'status': CommStatus.DELIVERED,
            'provider': 'TEXOL SES Email Adapter',
            'provider_message_id': 'msg_ses_894101',
            'delivered_at': timezone.now() - timedelta(minutes=45)
        }
    )

    CommunicationMessage.objects.get_or_create(
        recipient_address='+966501234567',
        template_code='POC_COMPLETED',
        defaults={
            'channel': CommChannel.WHATSAPP,
            'recipient_name': 'Faisal Al-Harbi (Fleet Director)',
            'subject': 'WhatsApp Notification to +966501234567',
            'body': 'VanForces™ 30-Day POC Completed: Route adherence improved from 58% to 88%. Commercial proposal generated.',
            'status': CommStatus.READ,
            'provider': 'TEXOL WhatsApp Cloud Adapter',
            'provider_message_id': 'wa_msg_992144',
            'delivered_at': timezone.now() - timedelta(minutes=30)
        }
    )
    print("  [OK] Communications seeded (Email & WhatsApp)")

    print("[SUCCESS] Phase 3 data seeding finished successfully!")


if __name__ == '__main__':
    seed()
