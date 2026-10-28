import uuid
import logging
import threading
from typing import Dict, Any, Optional, Tuple
from django.utils import timezone
from django.conf import settings
from django.core.mail import send_mail
from django.db import close_old_connections

from apps.integrations.models import CommunicationMessage, CommChannel, CommStatus
from apps.activities.models import Activity, ActivityType, ActivityStatus, ActivityPriority
from apps.accounts.models import Account, Contact
from apps.leads.models import Lead, LeadStatus
from apps.opportunities.models import Opportunity
from apps.pld_engine.models import PipelineStage

logger = logging.getLogger(__name__)


CUSTOMER_STAGE_TEMPLATES: Dict[str, Dict[str, str]] = {
    'NEW': {
        'code': 'NEW',
        'stage_name': 'Inquiry Registration',
        'subject': 'Welcome to TEXOL - Your inquiry for {product_name} is confirmed [{company_name}]',
        'body': (
            "Dear {recipient_name},\n\n"
            "Thank you for contacting TEXOL. We have successfully registered your commercial inquiry "
            "for {product_name}.\n\n"
            "Inquiry Details:\n"
            "• Organization: {company_name}\n"
            "• Evaluated Solution: {product_name}\n"
            "• Reference: {reference_id}\n"
            "• Assigned Commercial Specialist: {sales_rep_name} ({sales_rep_email})\n\n"
            "Our team is currently reviewing your operational profile to ensure an optimal solution fit. "
            "We will reach out shortly to schedule an initial consultation.\n\n"
            "Warm regards,\n"
            "TEXOL Commercial Operations Team\n"
            "https://texol.com"
        )
    },
    'ICP_CHECK': {
        'code': 'ICP_CHECK',
        'stage_name': 'ICP Qualification',
        'subject': 'Qualification Confirmed: {company_name} meets criteria for {product_name}',
        'body': (
            "Dear {recipient_name},\n\n"
            "We are pleased to inform you that {company_name} has cleared our initial operational qualification "
            "and Ideal Customer Profile (ICP) criteria for {product_name}.\n\n"
            "Assessment Summary:\n"
            "• Company: {company_name}\n"
            "• Solution: {product_name}\n"
            "• Status: Operational Criteria Verified & Approved\n"
            "• Solution Lead: {sales_rep_name}\n\n"
            "Our solution architecture team has confirmed operational compatibility. Your dedicated specialist "
            "will be in touch to schedule an introductory discovery session.\n\n"
            "Best regards,\n"
            "{sales_rep_name}\n"
            "TEXOL Solutions Engineering"
        )
    },
    'CONTACTING': {
        'code': 'CONTACTING',
        'stage_name': 'Initial Outreach & Consultation',
        'subject': 'Consultation Scheduled - Exploring {product_name} for {company_name}',
        'body': (
            "Dear {recipient_name},\n\n"
            "Thank you for speaking with our team. Your account has been scheduled for an initial consultation "
            "regarding {product_name}.\n\n"
            "Engagement Overview:\n"
            "• Organization: {company_name}\n"
            "• Primary Contact: {recipient_name}\n"
            "• Solution Focus: {product_name}\n"
            "• Lead Advisor: {sales_rep_name} ({sales_rep_email})\n\n"
            "During this session, we will align on your primary distribution challenges and operational goals.\n\n"
            "Best regards,\n"
            "TEXOL Presales Team"
        )
    },
    'PLD_QUALIFIED': {
        'code': 'PLD_QUALIFIED',
        'stage_name': 'Problem-Led Discovery Qualified',
        'subject': 'Qualification Milestone: Problem-Led Discovery for {company_name}',
        'body': (
            "Dear {recipient_name},\n\n"
            "Congratulations! {company_name} has officially advanced to the Problem-Led Discovery (PLD) phase "
            "for {product_name}.\n\n"
            "Milestone Summary:\n"
            "• Account: {company_name}\n"
            "• Product: {product_name}\n"
            "• Milestone: PLD Stage Gate Cleared\n"
            "• Advisor: {sales_rep_name}\n\n"
            "In this next step, our presales architects will conduct an in-depth operational workflow review to "
            "map high-impact opportunities for route optimization and leakage prevention.\n\n"
            "Best regards,\n"
            "TEXOL Solution Architecture"
        )
    },
    'DISCOVERY': {
        'code': 'DISCOVERY',
        'stage_name': 'Discovery & Workflow Mapping',
        'subject': 'Discovery Session Summary & Solution Blueprint for {company_name}',
        'body': (
            "Dear {recipient_name},\n\n"
            "Thank you for your active participation in our Problem-Led Discovery session.\n\n"
            "Discovery Summary:\n"
            "• Company: {company_name}\n"
            "• Solution Evaluated: {product_name}\n"
            "• Focus Areas: Field workflow automation, dispatch reconciliation, operational visibility\n"
            "• Next Milestone: Tailored Demonstration addressing your prioritized challenges\n\n"
            "Our solution team is now configuring a customized demonstration environment modeling your exact field "
            "and warehouse workflows.\n\n"
            "Warm regards,\n"
            "{sales_rep_name}\n"
            "TEXOL Presales Team"
        )
    },
    'DEMO': {
        'code': 'DEMO',
        'stage_name': 'Product Demonstration',
        'subject': '{product_name} Demonstration Recap & Evaluation Findings [{company_name}]',
        'body': (
            "Dear {recipient_name},\n\n"
            "Thank you for attending today's live product demonstration of {product_name}.\n\n"
            "Session Highlights:\n"
            "• Account: {company_name}\n"
            "• Solution Demonstrated: {product_name}\n"
            "• Workflows Covered: Real-time route execution, mobile van invoicing, cash settlement, and ERP synchronization\n"
            "• Next Step: Scoping the Proof of Concept (POC) / Pilot Trial\n\n"
            "Please feel free to share any feedback or follow-up technical questions with our team.\n\n"
            "Best regards,\n"
            "{sales_rep_name}\n"
            "TEXOL Solution Consulting"
        )
    },
    'POC': {
        'code': 'POC',
        'stage_name': 'Proof of Concept / Pilot Trial',
        'subject': 'POC Trial Concluded: Success Benchmark Report for {company_name}',
        'body': (
            "Dear {recipient_name},\n\n"
            "We are pleased to report that the Proof of Concept (POC) evaluation trial for {company_name} "
            "evaluating {product_name} has successfully concluded.\n\n"
            "Trial Highlights:\n"
            "• Account: {company_name}\n"
            "• Product Evaluated: {product_name}\n"
            "• Result: Key Operational Success Criteria and Benchmark Metrics Achieved\n"
            "• Next Action: Transition to Commercial Licensing & Proposal Issuance\n\n"
            "We would like to thank your operational team for their dedication throughout the trial. Our commercial "
            "team will present the formal production agreement shortly.\n\n"
            "Best regards,\n"
            "{sales_rep_name}\n"
            "TEXOL Solution Delivery"
        )
    },
    'SQL_READY': {
        'code': 'SQL_READY',
        'stage_name': 'Sales Qualified Lead Gate',
        'subject': 'Milestone Cleared: Sales Qualified Status for {company_name}',
        'body': (
            "Dear {recipient_name},\n\n"
            "We are pleased to announce that {company_name} has officially satisfied all technical and feasibility "
            "gates for {product_name}, clearing our Sales Qualified Lead (SQL) readiness gate.\n\n"
            "Account Status:\n"
            "• Account: {company_name}\n"
            "• Product: {product_name}\n"
            "• Commercial Gate: SQL Readiness Cleared\n"
            "• Enterprise Account Executive: {sales_rep_name} ({sales_rep_email})\n\n"
            "Your dedicated Enterprise Account Executive has been assigned to initiate executive commercial engagement "
            "and tailor your deployment agreement.\n\n"
            "Best regards,\n"
            "TEXOL Commercial Operations"
        )
    },
    'SALES_ACCEPTED': {
        'code': 'SALES_ACCEPTED',
        'stage_name': 'Sales Handoff Accepted',
        'subject': 'Meet Your Enterprise Account Team - {product_name} [{company_name}]',
        'body': (
            "Dear {recipient_name},\n\n"
            "Welcome to the commercial engagement phase for {product_name}.\n\n"
            "Your Dedicated Team:\n"
            "• Account: {company_name}\n"
            "• Enterprise Account Executive: {sales_rep_name}\n"
            "• Email: {sales_rep_email}\n"
            "• Next Deliverable: Enterprise Commercial Proposal & Pricing Review\n\n"
            "Your Account Executive will contact you shortly to review the proposed licensing scope, rollout timeline, "
            "and contract terms.\n\n"
            "Best regards,\n"
            "TEXOL Enterprise Sales"
        )
    },
    'OPP_PROPOSAL': {
        'code': 'OPP_PROPOSAL',
        'stage_name': 'Commercial Proposal Delivered',
        'subject': 'Formal Commercial Proposal Delivered for {company_name} - {product_name}',
        'body': (
            "Dear {recipient_name},\n\n"
            "We are pleased to deliver the formal Commercial Proposal and Licensing Scope for {company_name}'s "
            "adoption of {product_name}.\n\n"
            "Proposal Overview:\n"
            "• Customer: {company_name}\n"
            "• Solution: {product_name}\n"
            "• Scope: Enterprise Software Licensing, Professional Implementation & 24/7 Support\n"
            "• Account Executive: {sales_rep_name} ({sales_rep_email})\n\n"
            "Please review the attached proposal. We would be delighted to schedule a walkthrough call to address "
            "any questions.\n\n"
            "Best regards,\n"
            "{sales_rep_name}\n"
            "TEXOL Commercial Advisory"
        )
    },
    'OPP_NEGOTIATION': {
        'code': 'OPP_NEGOTIATION',
        'stage_name': 'Commercial Negotiation',
        'subject': 'Commercial Negotiation & Terms Finalization for {company_name}',
        'body': (
            "Dear {recipient_name},\n\n"
            "Thank you for our productive discussions regarding the commercial terms for {product_name}.\n\n"
            "Negotiation Summary:\n"
            "• Organization: {company_name}\n"
            "• Product: {product_name}\n"
            "• Status: Final Commercial Review & Terms Alignment\n"
            "• Lead Negotiator: {sales_rep_name}\n\n"
            "We are finalizing the master services agreement reflecting the agreed schedule and terms. "
            "The final contracts will be transmitted for electronic execution.\n\n"
            "Best regards,\n"
            "{sales_rep_name}\n"
            "TEXOL Commercial Operations"
        )
    },
    'OPP_CLOSED_WON': {
        'code': 'OPP_CLOSED_WON',
        'stage_name': 'Closed Won - Onboarding Kickoff',
        'subject': 'Welcome to TEXOL! Implementation & Onboarding Kickoff [{company_name}]',
        'body': (
            "Dear {recipient_name},\n\n"
            "On behalf of the entire TEXOL team, welcome to the TEXOL family! We are thrilled to partner with "
            "{company_name} on your digital transformation with {product_name}.\n\n"
            "Partnership Overview:\n"
            "• Customer Account: {company_name}\n"
            "• Contract Status: Closed Won / Executed\n"
            "• Solution: {product_name}\n"
            "• Primary Contact: {recipient_name}\n\n"
            "Our Customer Success and Implementation specialists have initiated onboarding preparation. "
            "You will receive an invitation to our implementation kickoff workshop within 24 hours.\n\n"
            "Thank you for placing your trust in TEXOL.\n\n"
            "Warm regards,\n"
            "TEXOL Executive Leadership & Customer Success Team\n"
            "https://texol.com"
        )
    },
    'OPP_CLOSED_LOST': {
        'code': 'OPP_CLOSED_LOST',
        'stage_name': 'Closed Lost',
        'subject': 'Thank you for evaluating {product_name} - Future Collaboration [{company_name}]',
        'body': (
            "Dear {recipient_name},\n\n"
            "Thank you for taking the time to evaluate {product_name} for {company_name}. While we understand "
            "this is not the right time for a deployment, we sincerely appreciate the opportunity to collaborate with your team.\n\n"
            "We will keep your operational profile on file and look forward to staying connected as your future business "
            "priorities evolve.\n\n"
            "Best regards,\n"
            "{sales_rep_name}\n"
            "TEXOL Commercial Operations"
        )
    },
    'NURTURE': {
        'code': 'NURTURE',
        'stage_name': 'Nurture & Win-Back Pool',
        'subject': 'Staying in Touch with TEXOL - Updates & Insights for {company_name}',
        'body': (
            "Dear {recipient_name},\n\n"
            "Thank you for your interest in {product_name}. While active evaluation is currently paused, we want "
            "to ensure {company_name} has ongoing access to our industry insights and product updates.\n\n"
            "We will keep you informed of major releases and best practices in field operations. Please feel free "
            "to reach out whenever your timeline is ready to resume.\n\n"
            "Warm regards,\n"
            "TEXOL Client Relations Team"
        )
    },
    'DISQUALIFIED': {
        'code': 'DISQUALIFIED',
        'stage_name': 'Evaluation Status Update',
        'subject': 'TEXOL Solution Fit Assessment Update for {company_name}',
        'body': (
            "Dear {recipient_name},\n\n"
            "Thank you for evaluating TEXOL solutions. Based on our operational assessment, {product_name} does not "
            "currently align with your immediate fleet or software configuration.\n\n"
            "We have archived this evaluation file for now. Should your technical prerequisites change in the future, "
            "we would welcome the opportunity to re-evaluate.\n\n"
            "Best regards,\n"
            "TEXOL Commercial Advisory"
        )
    }
}


class CustomerStageEmailService:
    """
    Automated and manual customer email notification service.
    Fires on every pipeline stage transition across Pursuit (Lead) and Opportunity lifecycles.
    Dual-persists to CommunicationMessage (Omni-channel hub) and Activity Stream.
    """

    @classmethod
    def resolve_recipient(cls, record: Any) -> Tuple[str, Optional[str], Optional[Contact]]:
        """
        Extracts primary recipient name, email address, and Contact instance.
        Follows hierarchical resolution across record, primary contacts, and account contacts.
        """
        contact: Optional[Contact] = None
        recipient_name = "Valued Customer"
        recipient_email: Optional[str] = None
        account: Optional[Account] = getattr(record, 'account', None)

        if isinstance(record, Lead):
            contact = record.contact
            if not contact and account:
                contact = account.contacts.filter(is_primary=True).first() or account.contacts.exclude(email__isnull=True).exclude(email='').first()
        elif isinstance(record, Opportunity):
            contact = record.primary_contact
            if not contact and getattr(record, 'lead', None):
                contact = record.lead.contact
            if not contact and account:
                contact = account.contacts.filter(is_primary=True).first() or account.contacts.exclude(email__isnull=True).exclude(email='').first()

        if contact:
            name_parts = [contact.first_name, contact.last_name]
            full_name = " ".join([p for p in name_parts if p]).strip()
            recipient_name = full_name or contact.designation or (account.company_name if account else "Valued Customer")
            recipient_email = contact.email
        elif account:
            recipient_name = f"{account.company_name} Stakeholder"

        return recipient_name, recipient_email, contact

    @classmethod
    def resolve_template_key(cls, stage: Any, status_override: Optional[str] = None) -> str:
        """
        Maps a PipelineStage, stage code, or status string to a CUSTOMER_STAGE_TEMPLATES key.
        """
        if status_override:
            upper_status = status_override.upper().replace('STAGE_', '')
            if upper_status in CUSTOMER_STAGE_TEMPLATES:
                return upper_status
            if upper_status in ('NURTURE', 'DISQUALIFIED'):
                return upper_status
            if upper_status == 'WON':
                return 'OPP_CLOSED_WON'
            if upper_status == 'LOST':
                return 'OPP_CLOSED_LOST'
            for k in CUSTOMER_STAGE_TEMPLATES.keys():
                if k in upper_status or upper_status in k:
                    return k

        raw_code = ''
        if isinstance(stage, PipelineStage):
            raw_code = stage.stage_code.upper()
        elif isinstance(stage, str):
            raw_code = stage.upper()
        elif hasattr(stage, 'stage_code'):
            raw_code = getattr(stage, 'stage_code').upper()

        if raw_code in CUSTOMER_STAGE_TEMPLATES:
            return raw_code

        # Fuzzy matching against standard milestones
        if 'DISCOVERY' in raw_code:
            return 'DISCOVERY'
        if 'DEMO' in raw_code:
            return 'DEMO'
        if 'POC' in raw_code:
            return 'POC'
        if 'SQL' in raw_code or 'GATE' in raw_code:
            return 'SQL_READY'
        if 'ACCEPT' in raw_code or 'HANDOFF' in raw_code:
            return 'SALES_ACCEPTED'
        if 'PROPOSAL' in raw_code:
            return 'OPP_PROPOSAL'
        if 'NEGOTIAT' in raw_code:
            return 'OPP_NEGOTIATION'
        if 'WON' in raw_code:
            return 'OPP_CLOSED_WON'
        if 'LOST' in raw_code:
            return 'OPP_CLOSED_LOST'
        if 'ICP' in raw_code:
            return 'ICP_CHECK'
        if 'CONTACT' in raw_code:
            return 'CONTACTING'
        if 'QUALIF' in raw_code:
            return 'PLD_QUALIFIED'
        if 'NEW' in raw_code:
            return 'NEW'

        return 'NEW'

    @classmethod
    def build_context(cls, record: Any, stage: Any, user: Any = None, status_override: Optional[str] = None) -> Dict[str, Any]:
        """
        Constructs replacement variables for templates.
        """
        recipient_name, recipient_email, contact = cls.resolve_recipient(record)
        account = getattr(record, 'account', None)
        company_name = account.company_name if account else "Valued Enterprise"

        # Product resolution
        product_name = "TEXOL Enterprise Platform"
        if isinstance(record, Lead) and record.primary_product:
            product_name = record.primary_product.name
        elif isinstance(record, Opportunity) and record.product:
            product_name = record.product.name

        # Sales rep / owner resolution
        owner = getattr(record, 'owner', None) or user
        sales_rep_name = "TEXOL Commercial Specialist"
        sales_rep_email = "commercial@texol.com"
        if owner and hasattr(owner, 'get_full_name'):
            full_name = owner.get_full_name() or getattr(owner, 'username', '')
            if full_name:
                sales_rep_name = full_name
            if getattr(owner, 'email', None):
                sales_rep_email = owner.email

        # Reference ID
        ref_id = f"REF-{str(record.id)[:8].upper()}" if hasattr(record, 'id') else "TEXOL-REF"

        template_key = cls.resolve_template_key(stage, status_override)
        template = CUSTOMER_STAGE_TEMPLATES.get(template_key, CUSTOMER_STAGE_TEMPLATES['NEW'])
        stage_name = getattr(stage, 'stage_name', None) or template['stage_name']

        return {
            'recipient_name': recipient_name,
            'recipient_email': recipient_email,
            'contact': contact,
            'company_name': company_name,
            'product_name': product_name,
            'sales_rep_name': sales_rep_name,
            'sales_rep_email': sales_rep_email,
            'reference_id': ref_id,
            'stage_name': stage_name,
            'template_key': template_key,
            'template': template
        }

    @classmethod
    def get_stage_email_preview(
        cls,
        record: Any,
        stage: Any,
        status_override: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Returns interpolated subject, body, and recipient information without sending.
        """
        context = cls.build_context(record, stage, status_override=status_override)
        template = context['template']
        subject = template['subject'].format(**context)
        body = template['body'].format(**context)

        return {
            'template_code': context['template_key'],
            'stage_name': context['stage_name'],
            'recipient_name': context['recipient_name'],
            'recipient_email': context['recipient_email'],
            'has_recipient_email': bool(context['recipient_email']),
            'company_name': context['company_name'],
            'product_name': context['product_name'],
            'sales_rep_name': context['sales_rep_name'],
            'sales_rep_email': context['sales_rep_email'],
            'subject': subject,
            'body': body
        }

    @classmethod
    def send_stage_email(
        cls,
        record: Any,
        stage: Any,
        user: Any = None,
        custom_subject: Optional[str] = None,
        custom_body: Optional[str] = None,
        custom_recipient_email: Optional[str] = None,
        status_override: Optional[str] = None,
        async_send: bool = True
    ) -> Dict[str, Any]:
        """
        Renders, dispatches (via Django email in a background worker thread to prevent HTTP delay),
        and persists stage completion customer email. Dual-records in CommunicationMessage and Activity.
        """
        context = cls.build_context(record, stage, user=user, status_override=status_override)
        template = context['template']

        subject = custom_subject or template['subject'].format(**context)
        body = custom_body or template['body'].format(**context)
        recipient_email = custom_recipient_email or context['recipient_email']
        recipient_name = context['recipient_name']
        account = getattr(record, 'account', None)
        lead = record if isinstance(record, Lead) else getattr(record, 'lead', None)
        opp = record if isinstance(record, Opportunity) else None
        contact = context.get('contact')

        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'notifications@texol.com')

        email_sent = False
        error_msg = ""
        comm_status = CommStatus.QUEUED if (recipient_email and async_send) else (CommStatus.DELIVERED if recipient_email else CommStatus.FAILED)

        if not recipient_email:
            error_msg = "Customer contact email address not found on record. Logged for sales rep review."

        # 1. Record in CommunicationMessage (Unified Omni-Channel Ledger)
        comm_msg = CommunicationMessage.objects.create(
            channel=CommChannel.EMAIL,
            recipient_name=recipient_name[:128],
            recipient_address=(recipient_email or "MISSING_CUSTOMER_EMAIL")[:255],
            lead=lead,
            account=account,
            template_code=f"STAGE_{context['template_key']}"[:64],
            subject=subject[:255],
            body=body,
            status=comm_status,
            provider='TEXOL Automated Stage Dispatcher',
            provider_message_id=f"stg_{uuid.uuid4().hex[:12]}",
            delivered_at=None,
            error_message=error_msg
        )

        # 2. Record in Activity (Unified Lead/Account/Opportunity Activity Stream)
        try:
            Activity.objects.create(
                account=account,
                contact=contact,
                lead=lead,
                opportunity=opp,
                activity_type=ActivityType.EMAIL,
                subject=f"Stage Email: {context['stage_name']} [{recipient_name}]"[:255],
                description_notes=body,
                conducted_at=timezone.now(),
                status=ActivityStatus.COMPLETED,
                outcome_notes=(
                    f"Customer notified via email upon completion of '{context['stage_name']}' stage. "
                    f"Recipient: {recipient_email or 'No email provided'}."
                ),
                performed_by=user if (user and hasattr(user, 'is_authenticated') and user.is_authenticated) else None,
                created_by=user if (user and hasattr(user, 'is_authenticated') and user.is_authenticated) else None
            )
        except Exception as act_err:
            logger.warning(f"Activity stream recording failed for stage notification: {str(act_err)}")

        # 3. Dispatch Email (Background Thread to prevent freezing the HTTP request)
        if recipient_email:
            if async_send:
                def _dispatch_worker(msg_id, subj, msg_text, from_addr, to_addr):
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
                        logger.warning(f"Stage email background delivery failed for {to_addr}: {exc}")
                        CommunicationMessage.objects.filter(id=msg_id).update(
                            status=CommStatus.FAILED,
                            error_message=str(exc)
                        )
                    finally:
                        close_old_connections()

                worker_thread = threading.Thread(
                    target=_dispatch_worker,
                    args=(comm_msg.id, subject, body, from_email, recipient_email),
                    daemon=True
                )
                worker_thread.start()
                email_sent = True
            else:
                try:
                    send_mail(
                        subject=subject,
                        message=body,
                        from_email=from_email,
                        recipient_list=[recipient_email],
                        fail_silently=False
                    )
                    email_sent = True
                    comm_msg.status = CommStatus.DELIVERED
                    comm_msg.delivered_at = timezone.now()
                    comm_msg.save(update_fields=['status', 'delivered_at'])
                except Exception as e:
                    logger.warning(f"Stage email delivery encountered warning for {recipient_email}: {str(e)}")
                    error_msg = str(e)
                    comm_msg.status = CommStatus.FAILED
                    comm_msg.error_message = error_msg
                    comm_msg.save(update_fields=['status', 'error_message'])

        return {
            'success': True if recipient_email else False,
            'email_sent': email_sent,
            'message_id': str(comm_msg.id),
            'status': comm_msg.status,
            'recipient_name': recipient_name,
            'recipient_email': recipient_email,
            'subject': subject,
            'stage_code': context['template_key'],
            'stage_name': context['stage_name'],
            'error_message': error_msg
        }
