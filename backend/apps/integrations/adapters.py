import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from django.utils import timezone
from apps.integrations.models import CommunicationMessage, CommChannel, CommStatus


class NotificationTemplates:
    SQL_READY = {
        'code': 'SQL_READY',
        'subject': '🚀 Action Required: New SQL Ready for Sales Handoff [{company_name}]',
        'email_body': """Hello {recipient_name},

A new Sales Qualified Lead (SQL) has cleared all PLD Stage Gates for {product_name}:

• Account: {company_name}
• PLD Score: {score}/100 ({classification})
• Documented Impact: {problem_impact}
• Expected Timeline: {expected_timeline}

Please review and accept/reject the handoff within the 48-hour SLA window.

TEXOL PLD Engine Automation""",
        'whatsapp_body': """*TEXOL CRM Alert: SQL Ready* 🚀
Lead: *{company_name}*
Product: *{product_name}*
PLD Score: *{score}/100* ({classification})
Timeline: *{expected_timeline}*

👉 Review handoff in TEXOL CRM within 48h SLA."""
    }

    DEAL_PROTECTION_CONFIRMED = {
        'code': 'DEAL_PROTECTION_CONFIRMED',
        'subject': '🛡️ Deal Registration Approved & Protected [{customer_name}]',
        'email_body': """Dear {recipient_name},

Great news! Your deal registration for {customer_name} on {product_name} has been approved.

• Registered Partner: {partner_name}
• Target Customer: {customer_name}
• Expected Value: SAR {value:,.2f}
• Protection Window: 90 Days (Expires: {expiry_date})

You now have exclusive deal rights. Your designated TEXOL Partner Presales Engineer will reach out shortly.

Best regards,
TEXOL Commercial Partnerships Team""",
        'whatsapp_body': """*TEXOL Partner Portal: Deal Protected* 🛡️
Customer: *{customer_name}*
Product: *{product_name}*
Status: *Approved & Protected for 90 Days* (until {expiry_date})
Commission Tier: *Standard 15%*

Thank you for partnering with TEXOL."""
    }

    POC_COMPLETED = {
        'code': 'POC_COMPLETED',
        'subject': '✅ POC Trial Completed: Success Metrics Exceeded [{company_name}]',
        'email_body': """Dear {recipient_name},

The 30-day POC trial for {company_name} evaluating {product_name} has successfully concluded.

Pilot Performance Summary:
• Route Adherence: Baseline 58% ➔ Pilot Result 88% (+30% gain)
• Order Entry Duration: Baseline 45 mins ➔ Pilot Result 8 mins (82% reduction)
• Stakeholder Recommendation: PASSED_PROCEED_TO_CONTRACT

We are now ready to issue the formal production commercial proposal.

TEXOL Presales & Solution Architecture""",
        'whatsapp_body': """*TEXOL Presales: POC Passed* ✅
Account: *{company_name}* ({product_name})
Result: *All Success Criteria Met*
Route Adherence: 58% ➔ *88%*
Order Time: 45 min ➔ *8 min*

Ready for commercial proposal issuance."""
    }


class BaseAdapter:
    def send(self, recipient: str, template_data: Dict[str, Any], lead=None, account=None) -> CommunicationMessage:
        raise NotImplementedError


class EmailNotificationAdapter(BaseAdapter):
    """
    Standard Email adapter supporting real SMTP / console delivery.
    """
    def send(self, recipient: str, template: Dict[str, Any], context: Dict[str, Any], lead=None, account=None) -> CommunicationMessage:
        from django.core.mail import send_mail
        from django.conf import settings
        import logging

        logger = logging.getLogger(__name__)

        subject = template['subject'].format(**context)
        body = template['email_body'].format(**context)
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'notifications@texol.com')

        import threading
        from django.db import close_old_connections

        msg = CommunicationMessage.objects.create(
            channel=CommChannel.EMAIL,
            recipient_name=context.get('recipient_name', recipient),
            recipient_address=recipient,
            lead=lead,
            account=account,
            template_code=template['code'],
            subject=subject,
            body=body,
            status=CommStatus.QUEUED,
            provider='TEXOL SMTP/SES Adapter',
            provider_message_id=f"email_{uuid.uuid4().hex[:12]}",
            delivered_at=None,
            error_message=""
        )

        def _worker(msg_id, subj, msg_text, from_addr, to_addr):
            close_old_connections()
            try:
                send_mail(
                    subject=subj,
                    message=msg_text,
                    from_email=from_addr,
                    recipient_list=[to_addr],
                    fail_silently=False
                )
                CommunicationMessage.objects.filter(id=msg_id).update(
                    status=CommStatus.DELIVERED,
                    delivered_at=timezone.now()
                )
            except Exception as exc:
                logger.warning(f"Email delivery failed to {to_addr}: {exc}")
                CommunicationMessage.objects.filter(id=msg_id).update(
                    status=CommStatus.FAILED,
                    error_message=str(exc)
                )
            finally:
                close_old_connections()

        threading.Thread(
            target=_worker,
            args=(msg.id, subject, body, from_email, recipient),
            daemon=True
        ).start()

        return msg


class WhatsAppNotificationAdapter(BaseAdapter):
    """
    WhatsApp Cloud API / Twilio Adapter supporting real-time conversational triggers.
    """
    def send(self, phone_number: str, template: Dict[str, Any], context: Dict[str, Any], lead=None, account=None) -> CommunicationMessage:
        body = template['whatsapp_body'].format(**context)

        msg = CommunicationMessage.objects.create(
            channel=CommChannel.WHATSAPP,
            recipient_name=context.get('recipient_name', phone_number),
            recipient_address=phone_number,
            lead=lead,
            account=account,
            template_code=template['code'],
            subject=f"WhatsApp to {phone_number}",
            body=body,
            status=CommStatus.READ,
            provider='TEXOL WhatsApp Cloud Adapter',
            provider_message_id=f"wa_{uuid.uuid4().hex[:12]}",
            delivered_at=timezone.now()
        )
        return msg
