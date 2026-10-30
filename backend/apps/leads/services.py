import logging
from typing import Dict, Any, Optional, Tuple
from django.utils import timezone
from apps.leads.models import Lead, LeadProductInterest, LeadTouch, LeadSource, Campaign, LeadStatus
from apps.accounts.models import Account, Contact, AccountAttribute
from apps.products.models import Product
from apps.core.models import Territory
from apps.activities.models import Activity, ActivityType, ActivityStatus

logger = logging.getLogger(__name__)


# Known city to territory mapping for KSA and GCC regions
CITY_TERRITORY_MAPPING = {
    # Central / Riyadh
    'riyadh': 'Central / Riyadh',
    'al-kharj': 'Central / Riyadh',
    'alkharj': 'Central / Riyadh',
    'kharj': 'Central / Riyadh',
    'buraidah': 'Central / Riyadh',
    'buraydah': 'Central / Riyadh',
    'unaizah': 'Central / Riyadh',
    'qassim': 'Central / Riyadh',
    'al-qassim': 'Central / Riyadh',
    'hail': 'Central / Riyadh',
    'diriyah': 'Central / Riyadh',
    'al-diriyah': 'Central / Riyadh',

    # Western / Jeddah & Makkah
    'jeddah': 'Western / Jeddah & Makkah',
    'makkah': 'Western / Jeddah & Makkah',
    'mecca': 'Western / Jeddah & Makkah',
    'medina': 'Western / Jeddah & Makkah',
    'madinah': 'Western / Jeddah & Makkah',
    'al-madinah': 'Western / Jeddah & Makkah',
    'yanbu': 'Western / Jeddah & Makkah',
    'taif': 'Western / Jeddah & Makkah',
    'al-taif': 'Western / Jeddah & Makkah',
    'rabigh': 'Western / Jeddah & Makkah',

    # Eastern / Dammam & Khobar
    'dammam': 'Eastern / Dammam & Khobar',
    'khobar': 'Eastern / Dammam & Khobar',
    'al-khobar': 'Eastern / Dammam & Khobar',
    'alkhobar': 'Eastern / Dammam & Khobar',
    'dhahran': 'Eastern / Dammam & Khobar',
    'jubail': 'Eastern / Dammam & Khobar',
    'al-jubail': 'Eastern / Dammam & Khobar',
    'al-ahsa': 'Eastern / Dammam & Khobar',
    'alahsa': 'Eastern / Dammam & Khobar',
    'hofuf': 'Eastern / Dammam & Khobar',
    'hufuf': 'Eastern / Dammam & Khobar',
    'qatif': 'Eastern / Dammam & Khobar',
    'al-qatif': 'Eastern / Dammam & Khobar',
    'ras tanura': 'Eastern / Dammam & Khobar',

    # Southern / Asir & Jazan
    'abha': 'Southern / Asir & Jazan',
    'khamis mushait': 'Southern / Asir & Jazan',
    'khamis mushayt': 'Southern / Asir & Jazan',
    'asir': 'Southern / Asir & Jazan',
    'jazan': 'Southern / Asir & Jazan',
    'jizan': 'Southern / Asir & Jazan',
    'najran': 'Southern / Asir & Jazan',
    'bisha': 'Southern / Asir & Jazan',
    'al-baha': 'Southern / Asir & Jazan',
    'baha': 'Southern / Asir & Jazan',

    # Northern / Tabuk & Al-Jouf
    'tabuk': 'Northern / Tabuk & Al-Jouf',
    'al-jouf': 'Northern / Tabuk & Al-Jouf',
    'al jouf': 'Northern / Tabuk & Al-Jouf',
    'jouf': 'Northern / Tabuk & Al-Jouf',
    'sakaka': 'Northern / Tabuk & Al-Jouf',
    'arar': 'Northern / Tabuk & Al-Jouf',
    'turaif': 'Northern / Tabuk & Al-Jouf',
    'qurayyat': 'Northern / Tabuk & Al-Jouf',

    # UAE / GCC
    'dubai': 'UAE / GCC Regional Hub',
    'abu dhabi': 'UAE / GCC Regional Hub',
    'sharjah': 'UAE / GCC Regional Hub',
    'ajman': 'UAE / GCC Regional Hub',
    'doha': 'UAE / GCC Regional Hub',
    'manama': 'UAE / GCC Regional Hub',
    'kuwait': 'UAE / GCC Regional Hub',
    'kuwait city': 'UAE / GCC Regional Hub',
    'muscat': 'UAE / GCC Regional Hub',
}


def resolve_territory(territory_input: Optional[str] = None, city: Optional[str] = None, country: Optional[str] = None) -> Optional[str]:
    """
    Intelligently resolves the matching canonical Territory name:
    1. If explicit territory provided: checks against active Territory models.
    2. If city provided: checks against known regional city mappings and DB matches.
    3. If country is non-Saudi GCC (UAE, Qatar, Kuwait, Bahrain, Oman): maps to GCC Hub.
    4. Fallbacks to closest DB Territory or None.
    """
    active_territories = list(Territory.objects.filter(is_active=True))

    # 1. Direct territory input resolution
    if territory_input and str(territory_input).strip():
        t_clean = str(territory_input).strip()
        t_lower = t_clean.lower()
        # Exact name or code match
        for t in active_territories:
            if t.name.lower() == t_lower or t.code.lower() == t_lower:
                return t.name
        # Partial substring match (e.g. "Riyadh", "Central", "Western", "Eastern", "Jeddah")
        for t in active_territories:
            if t_lower in t.name.lower() or t_lower in t.code.lower():
                return t.name

    # 2. City-based inference
    if city and str(city).strip():
        c_clean = str(city).strip().lower()
        if c_clean in CITY_TERRITORY_MAPPING:
            mapped_name = CITY_TERRITORY_MAPPING[c_clean]
            # Verify if this territory exists in active territories
            for t in active_territories:
                if t.name.lower() == mapped_name.lower():
                    return t.name
            return mapped_name

        # Check if city name is mentioned in Territory name or description
        for t in active_territories:
            if c_clean in t.name.lower() or (t.description and c_clean in t.description.lower()):
                return t.name

    # 3. Country-based inference (GCC regional hub)
    if country and str(country).strip():
        co_clean = str(country).strip().lower()
        if any(gcc_co in co_clean for gcc_co in ['uae', 'united arab emirates', 'dubai', 'qatar', 'kuwait', 'bahrain', 'oman']):
            for t in active_territories:
                if 'gcc' in t.name.lower() or 'uae' in t.name.lower():
                    return t.name

    # 4. If territory_input was provided as string but didn't match DB, return cleaned string
    if territory_input and str(territory_input).strip():
        return str(territory_input).strip()

    return None


def extract_domain_from_email_or_url(email: Optional[str] = None, website_url: Optional[str] = None) -> Optional[str]:
    """Extracts a clean domain name from email or website URL."""
    if website_url and str(website_url).strip():
        url = str(website_url).strip().lower()
        url = url.replace('https://', '').replace('http://', '').replace('www.', '')
        domain = url.split('/')[0].split('?')[0].split(':')[0]
        if domain and '.' in domain:
            return domain

    if email and '@' in email:
        domain = email.split('@')[-1].strip().lower()
        # Filter generic consumer email providers
        generic_providers = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'mail.com']
        if domain not in generic_providers and '.' in domain:
            return domain

    return None


def ingest_website_lead(data: Dict[str, Any], request_meta: Optional[Dict[str, Any]] = None) -> Tuple[Lead, Dict[str, Any]]:
    """
    Core intake engine for product website lead generation.
    Handles:
    - Account resolution/creation with domain & territory
    - Contact resolution/creation
    - Product resolution (VanForces, Al Mawasil, SpeakOrder, TaskForces, EntAura, etc.)
    - Territory / Regional scoping
    - Source and marketing campaign attribution
    - Multi-touch touchpoint registration
    - Inquiry activity logging
    - Operational ICP attributes caching
    - Sets owner=None to place in Inbound Triage queue
    """
    request_meta = request_meta or {}

    # Extract names and identifiers
    contact_name = (
        data.get('contact_name') or 
        data.get('name') or 
        data.get('full_name') or 
        f"{data.get('first_name', '')} {data.get('last_name', '')}".strip() or 
        'Website Inbound Lead'
    )
    email = (data.get('email') or data.get('contact_email') or data.get('work_email') or '').strip().lower()
    phone = (data.get('phone') or data.get('ph_number') or data.get('phone_number') or data.get('contact_phone') or data.get('mobile') or '').strip()
    designation = (data.get('designation') or data.get('job_title') or data.get('role') or 'Commercial Stakeholder').strip()

    # Company name resolution
    company_name = (data.get('company_name') or data.get('company') or data.get('business_name') or data.get('organization') or '').strip()
    domain = (data.get('domain') or extract_domain_from_email_or_url(email, data.get('website_url')) or '').strip().lower()

    if not company_name:
        if domain:
            # Derive nice company name from domain (e.g. al-madina.com -> Al Madina)
            domain_base = domain.split('.')[0].replace('-', ' ').replace('_', ' ')
            company_name = domain_base.title()
        else:
            company_name = f"{contact_name}'s Organization"

    city = (data.get('city') or data.get('place') or data.get('location') or data.get('account_city') or '').strip()
    state = (data.get('state') or data.get('province') or data.get('account_state') or '').strip()
    country = (data.get('country') or data.get('account_country') or 'Saudi Arabia').strip()
    industry = (data.get('industry') or 'Distribution & Wholesale').strip()
    if industry:
        try:
            import re
            from apps.core.models import Industry
            ind_code = re.sub(r'[^A-Z0-9_]+', '_', industry.upper()).strip('_')
            Industry.objects.get_or_create(
                name=industry,
                defaults={'code': ind_code or 'INDUSTRY', 'is_active': True}
            )
        except Exception:
            pass
    
    try:
        employees_count = int(data.get('employees_count') or data.get('employee_count') or data.get('employees') or 100)
    except (ValueError, TypeError):
        employees_count = 100

    # Resolve Territory / Region
    territory = resolve_territory(
        territory_input=data.get('territory') or data.get('region'),
        city=city,
        country=country
    )

    # 1. Resolve or create Account
    account = None
    if domain:
        account = Account.objects.filter(domain__iexact=domain).first()
    if not account and company_name:
        account = Account.objects.filter(company_name__iexact=company_name).first()

    if not account:
        account = Account.objects.create(
            company_name=company_name,
            domain=domain or None,
            industry=industry,
            employees_count=employees_count,
            country=country,
            state=state or None,
            city=city or None,
            territory=territory,
            address=data.get('address') or data.get('street_address') or None,
            website=data.get('website_url') or None,
            phone=phone or None,
            source='Product Website Form'
        )
    else:
        # Update existing account with territory if not set
        fields_to_update = []
        if territory and not account.territory:
            account.territory = territory
            fields_to_update.append('territory')
        if state and not account.state:
            account.state = state
            fields_to_update.append('state')
        if city and not account.city:
            account.city = city
            fields_to_update.append('city')
        if (data.get('address') or data.get('street_address')) and not account.address:
            account.address = data.get('address') or data.get('street_address')
            fields_to_update.append('address')
        if domain and not account.domain:
            account.domain = domain
            fields_to_update.append('domain')
        if fields_to_update:
            account.save(update_fields=fields_to_update)

    # 2. Resolve or create Contact
    first_name = contact_name.split()[0] if contact_name else 'Lead'
    last_name = ' '.join(contact_name.split()[1:]) if ' ' in contact_name else ''
    contact = None
    if email:
        contact = Contact.objects.filter(email__iexact=email, account=account).first()
        if not contact:
            contact = Contact.objects.filter(email__iexact=email).first()

    if not contact:
        contact = Contact.objects.create(
            account=account,
            first_name=first_name,
            last_name=last_name or None,
            email=email or f"info@{domain or 'inbound-prospect.com'}",
            phone=phone or None,
            designation=designation or None,
            is_primary=True
        )
    else:
        if phone and not contact.phone:
            contact.phone = phone
            contact.save(update_fields=['phone'])

    # 3. Resolve Target Product
    product_query = (
        data.get('product_code') or 
        data.get('product') or 
        data.get('product_name') or 
        'VANFORCES'
    ).strip()

    product = Product.objects.filter(code__iexact=product_query).first()
    if not product:
        product = Product.objects.filter(name__icontains=product_query).first()
    if not product:
        product = Product.objects.first()

    # 4. Resolve LeadSource
    utm_source = (data.get('utm_source') or 'website').strip().lower()
    source_code = utm_source.upper()
    source, _ = LeadSource.objects.get_or_create(
        code=source_code,
        defaults={'name': f"{utm_source.title()} Inbound"}
    )

    # 5. Format Next Action Description
    message = (data.get('message') or data.get('inquiry') or data.get('notes') or data.get('comments') or '').strip()
    if message:
        action_desc = f"Awaiting Sales Assignment | Website Inquiry: {message[:120]}"
    else:
        action_desc = f"Awaiting Sales Assignment by Admin ({product.name if product else 'Product'})"

    # 6. Create Lead (Unassigned owner=None for triage queue)
    lead = Lead.objects.create(
        account=account,
        contact=contact,
        primary_product=product,
        source=source,
        territory=territory,
        owner=None,
        status=LeadStatus.ACTIVE,
        next_action_description=action_desc[:255],
        next_activity_due_at=timezone.now(),
        estimated_opportunity_value=data.get('estimated_opportunity_value') or data.get('estimated_budget') or None
    )

    # 7. Create Primary Product Interest
    LeadProductInterest.objects.create(
        lead=lead,
        product=product,
        is_primary=True,
        interest_level='HIGH',
        evidence_notes=f"Inbound lead generated from product website: {product.name if product else ''}"
    )

    # 8. Save Custom Operational Attributes
    known_attr_keys = [
        'vans_count', 'salesmen_count', 'primary_erp', 'field_sales',
        'outlets_count', 'skus_count', 'monthly_invoices', 'vat_registered',
        'daily_orders', 'employees_count', 'distribution_centers_count'
    ]
    attrs_to_save = {}
    if isinstance(data.get('icp_attributes'), dict):
        attrs_to_save.update(data.get('icp_attributes'))
    if isinstance(data.get('attributes'), dict):
        attrs_to_save.update(data.get('attributes'))
    for key in known_attr_keys:
        if key in data and key not in attrs_to_save:
            attrs_to_save[key] = data[key]

    for attr_k, attr_v in attrs_to_save.items():
        if attr_v is not None and attr_v != '':
            AccountAttribute.objects.update_or_create(
                account=account,
                product=product,
                attribute_key=attr_k,
                defaults={'attribute_value': attr_v}
            )

    # 9. Attribution Campaign & Multi-touch Touchpoint
    utm_campaign = (data.get('utm_campaign') or 'product_website_inquiry').strip()
    utm_medium = (data.get('utm_medium') or 'contact_form').strip()
    campaign = None
    if utm_campaign:
        campaign, _ = Campaign.objects.get_or_create(
            code=utm_campaign,
            defaults={
                'name': utm_campaign.replace('_', ' ').replace('-', ' ').title(),
                'source': source,
                'product': product,
                'campaign_type': utm_medium
            }
        )

    touch_metadata = {
        'utm_source': utm_source,
        'utm_medium': utm_medium,
        'utm_campaign': utm_campaign,
        'utm_term': data.get('utm_term'),
        'utm_content': data.get('utm_content'),
        'website_url': data.get('website_url'),
        'referrer': data.get('referrer') or request_meta.get('HTTP_REFERER'),
        'ip_address': request_meta.get('REMOTE_ADDR'),
        'user_agent': request_meta.get('HTTP_USER_AGENT'),
        'product_code': product.code if product else None,
        'territory': territory
    }
    if message:
        touch_metadata['inquiry_message'] = message

    touch = LeadTouch.objects.create(
        lead=lead,
        campaign=campaign,
        source=source,
        touch_type=f'Inbound Website {product.name if product else "Inquiry"}',
        utm_parameters=touch_metadata,
        is_first_touch=True
    )

    # 10. Record Initial Prospect Activity
    if message:
        Activity.objects.create(
            account=account,
            contact=contact,
            lead=lead,
            activity_type=ActivityType.EMAIL,
            subject=f"Website Lead Inquiry for {product.name if product else 'Product'}",
            description_notes=message,
            status=ActivityStatus.COMPLETED,
            outcome_notes="Captured via Product Website Contact Webhook",
            next_action_description="Follow up on website inquiry & assign sales representative",
            priority='HIGH'
        )

    response_payload = {
        'success': True,
        'message': f"Inbound lead successfully registered for {company_name} [{product.code if product else 'CRM'}]. Placed in Triage Queue for sales assignment.",
        'lead_id': str(lead.id),
        'lead_reference': f"LEAD-{str(lead.id)[:8].upper()}",
        'account_id': str(account.id),
        'company_name': company_name,
        'contact_name': contact_name,
        'contact_email': contact.email if contact else email,
        'product_code': product.code if product else None,
        'product_name': product.name if product else None,
        'territory': territory,
        'touch_id': str(touch.id),
        'owner_assigned': False,
        'triage_status': 'PENDING_ASSIGNMENT',
        'created_at': lead.created_at.isoformat()
    }

    return lead, response_payload
