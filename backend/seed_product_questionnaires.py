import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.products.models import Product
from apps.pld_engine.models import (
    ProductConfigurationVersion, ConfigStatus,
    ICPProfile, ScoreDimension,
    QuestionnaireTemplate, QuestionnaireQuestion, QuestionAnswerOption, QuestionType
)
from django.utils import timezone

def seed_all_product_questionnaires():
    print("Seeding distinct Qualification Questionnaire Templates & Questions for all products...")

    products = {p.code: p for p in Product.objects.all()}
    print(f"Loaded {len(products)} products: {list(products.keys())}")

    # Helper to ensure published config version exists
    def get_or_create_config(product):
        config = product.configurations.filter(status=ConfigStatus.PUBLISHED).first()
        if not config:
            config = product.configurations.first()
        if not config:
            config = ProductConfigurationVersion.objects.create(
                product=product,
                version_number=1,
                status=ConfigStatus.PUBLISHED,
                published_at=timezone.now(),
                notes=f"Initial Published Configuration for {product.name}"
            )
        return config

    def get_or_create_profile(product, config):
        profile = product.icp_profiles.filter(is_active=True).first()
        if not profile:
            profile = ICPProfile.objects.create(
                product=product,
                config_version=config,
                name=f"{product.name} Standard ICP Profile",
                version_number=1,
                is_active=True,
                description=f"Primary commercial qualification profile for {product.name}"
            )
        return profile

    # =========================================================================
    # 1. AL MAWASIL (ZATCA E-Invoicing & Tax Compliance Suite)
    # =========================================================================
    if 'AL_MAWASIL' in products:
        p = products['AL_MAWASIL']
        cfg = get_or_create_config(p)
        get_or_create_profile(p, cfg)

        template, created = QuestionnaireTemplate.objects.get_or_create(
            product=p,
            stage_code="PLD_QUALIFICATION",
            defaults={
                'config_version': cfg,
                'title': "AL Mawasil™ ZATCA E-Invoicing & Tax Compliance Qualification Questionnaire",
                'version_number': 1,
                'is_active': True,
                'schema_json': []
            }
        )
        if not created:
            template.title = "AL Mawasil™ ZATCA E-Invoicing & Tax Compliance Qualification Questionnaire"
            template.config_version = cfg
            template.is_active = True
            template.save()

        # Define AL Mawasil questions
        al_questions = [
            {
                'code': 'AM_Q1_TAX_REGISTRATION',
                'text': 'Is the organization a VAT-registered enterprise in Saudi Arabia subject to ZATCA regulations?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.TECHNICAL_FIT,
                'weight': 10,
                'order': 1,
                'options': [
                    ('Yes, Large Taxpayer (>SAR 50M Turnover - Phase 2 Wave 1-5)', 'LARGE_TAXPAYER', 100),
                    ('Yes, Medium Taxpayer (SAR 10M-50M - Phase 2 Wave 6-10)', 'MEDIUM_TAXPAYER', 85),
                    ('Yes, Small Enterprise (<SAR 10M - Standard Phase 2)', 'SMALL_TAXPAYER', 65),
                    ('Non-Saudi or Non-VAT Registered Business', 'NON_VAT', 0),
                ]
            },
            {
                'code': 'AM_Q2_MONTHLY_INVOICE_VOL',
                'text': 'What is the average monthly volume of B2B and B2C tax invoices generated?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.COMMERCIAL_POTENTIAL,
                'weight': 10,
                'order': 2,
                'options': [
                    ('50,000+ Invoices/month (High-Volume Enterprise Clearance)', 'VOL_50K_PLUS', 100),
                    ('10,000 to 49,999 Invoices/month', 'VOL_10K_50K', 85),
                    ('2,000 to 9,999 Invoices/month', 'VOL_2K_10K', 65),
                    ('Fewer than 2,000 Invoices/month', 'VOL_UNDER_2K', 35),
                ]
            },
            {
                'code': 'AM_Q3_ERP_CORE',
                'text': 'Which primary ERP or core accounting system currently generates sales invoices?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.TECHNICAL_FIT,
                'weight': 10,
                'order': 3,
                'options': [
                    ('SAP ERP (ECC / S4HANA Direct RFC / REST)', 'SAP', 95),
                    ('Oracle Fusion / NetSuite / E-Business Suite', 'ORACLE', 90),
                    ('Microsoft Dynamics 365 (F&O / Business Central)', 'DYNAMICS', 85),
                    ('Odoo / Custom In-house Legacy ERP', 'ODOO_CUSTOM', 60),
                    ('Manual Excel / Standalone Desktop Invoicing', 'MANUAL_EXCEL', 30),
                ]
            },
            {
                'code': 'AM_Q4_COMPLIANCE_STATUS',
                'text': 'What is the current ZATCA Fatoorah Phase 2 integration status?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.PROBLEM_SEVERITY,
                'weight': 10,
                'order': 4,
                'options': [
                    ('Impending Deadline: Active ZATCA notification with pending penalties', 'PENALTIES_IMPENDING', 100),
                    ('Approaching integration wave deadline within 60 days', 'DEADLINE_60_DAYS', 85),
                    ('Using fragile custom scripts with recurring rejection errors', 'CUSTOM_SCRIPTS_FAILING', 70),
                    ('Phase 1 Only (QR code without cryptographic stamping)', 'PHASE_1_ONLY', 50),
                ]
            },
            {
                'code': 'AM_Q5_INVOICE_TYPES',
                'text': 'Does the business issue Standard Tax Invoices (B2B) or Simplified Invoices (B2C)?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.TECHNICAL_FIT,
                'weight': 10,
                'order': 5,
                'options': [
                    ('Both B2B Clearance API and B2C Reporting API within 24h', 'BOTH_B2B_B2C', 100),
                    ('B2B Standard Tax Invoices Only (Pre-clearance before dispatch)', 'B2B_ONLY', 80),
                    ('B2C Simplified Invoices with Cryptographic QR Code Only', 'B2C_ONLY', 60),
                    ('Internal Nominal Invoices Only', 'NOMINAL_ONLY', 20),
                ]
            },
            {
                'code': 'AM_Q6_AUDIT_EXPOSURE',
                'text': 'Has the company experienced ZATCA invoice rejections or tax audit notices?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.PROBLEM_SEVERITY,
                'weight': 10,
                'order': 6,
                'options': [
                    ('Active fines or audit notice received from tax authority', 'ACTIVE_FINES', 100),
                    ('Frequent XML schema rejection / CSID certificate renewal failures', 'XML_REJECTIONS', 80),
                    ('Heavy manual rework during monthly VAT filing cycles', 'MANUAL_REWORK', 55),
                    ('No prior penalties, seeking proactive regulatory compliance', 'PROACTIVE', 30),
                ]
            },
            {
                'code': 'AM_Q7_BUSINESS_IMPACT',
                'text': 'What is the estimated financial and commercial exposure from non-compliance?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.BUSINESS_VALUE,
                'weight': 10,
                'order': 7,
                'options': [
                    ('Severe Risk: Commercial shipment stop / statutory fines (>=SAR 500k)', 'IMPACT_HIGH', 100),
                    ('High Risk: Customer payment withholding & clearance friction (SAR 100k-500k)', 'IMPACT_MED', 75),
                    ('Moderate: Heavy manual IT maintenance overhead (<SAR 100k)', 'IMPACT_LOW', 45),
                    ('Negligible direct financial exposure', 'IMPACT_NEGLIGIBLE', 15),
                ]
            },
            {
                'code': 'AM_Q8_DECISION_ACCESS',
                'text': 'Who is leading the compliance vendor selection and holds final sign-off authority?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.DECISION_ACCESS,
                'weight': 10,
                'order': 8,
                'options': [
                    ('CFO / Chief Financial Officer / Board of Directors (Direct Authority)', 'CFO_DIRECT', 100),
                    ('Head of Tax & Compliance with Authorized Budget', 'TAX_DIRECTOR', 85),
                    ('CIO / IT Applications Director without Dedicated Budget', 'IT_DIRECTOR', 60),
                    ('Junior Tax Accountant / Evaluator without authority', 'ACCOUNTANT', 25),
                ]
            },
            {
                'code': 'AM_Q9_ROLLOUT_TIMELINE',
                'text': 'What is the required go-live timeline for live ZATCA sandbox & production onboarding?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.TIMELINE,
                'weight': 10,
                'order': 9,
                'options': [
                    ('Immediate (within 30 days - urgent statutory wave deadline)', 'IMMEDIATE_30D', 100),
                    ('Within 60 to 90 days (next scheduled integration wave)', 'WAVE_60_90D', 80),
                    ('Within 6 months (fiscal half-year)', 'HALF_YEAR', 50),
                    ('Exploratory / Greater than 6 months', 'EXPLORATORY', 20),
                ]
            }
        ]

        # Sync questions and options
        for q_data in al_questions:
            q, _ = QuestionnaireQuestion.objects.update_or_create(
                template=template,
                code=q_data['code'],
                defaults={
                    'question_text': q_data['text'],
                    'question_type': q_data['type'],
                    'feeds_dimension': q_data['dim'],
                    'dimension_weight_points': q_data['weight'],
                    'order': q_data['order'],
                    'is_required': True,
                    'is_active': True
                }
            )
            for opt_idx, (opt_label, opt_val, opt_pts) in enumerate(q_data['options'], start=1):
                QuestionAnswerOption.objects.update_or_create(
                    question=q,
                    value=opt_val,
                    defaults={
                        'label': opt_label,
                        'points': opt_pts,
                        'order': opt_idx,
                        'is_active': True
                    }
                )
        print(f"[OK] AL Mawasil: Configured template '{template.title}' with {len(al_questions)} questions.")

    # =========================================================================
    # 2. ENTAURA.AI (Enterprise Context & Decision Intelligence Layer)
    # =========================================================================
    if 'ENTAURA' in products:
        p = products['ENTAURA']
        cfg = get_or_create_config(p)
        get_or_create_profile(p, cfg)

        template, created = QuestionnaireTemplate.objects.get_or_create(
            product=p,
            stage_code="PLD_QUALIFICATION",
            defaults={
                'config_version': cfg,
                'title': "EntAura.AI™ Enterprise Context & Decision Intelligence Qualification Questionnaire",
                'version_number': 1,
                'is_active': True,
                'schema_json': []
            }
        )
        if not created:
            template.title = "EntAura.AI™ Enterprise Context & Decision Intelligence Qualification Questionnaire"
            template.config_version = cfg
            template.is_active = True
            template.save()

        entaura_questions = [
            {
                'code': 'EA_Q1_ENTERPRISE_DATA_SOURCES',
                'text': 'How many distinct enterprise data repositories does the organization operate?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.TECHNICAL_FIT,
                'weight': 10,
                'order': 1,
                'options': [
                    ('5+ Systems (ERP, CRM, SharePoint/DMS, Data Lake, HRIS)', 'REPOS_5_PLUS', 100),
                    ('3 to 4 Disparate Enterprise Applications', 'REPOS_3_4', 80),
                    ('1 to 2 Core Platforms', 'REPOS_1_2', 50),
                    ('Single Isolated Database / Monolith', 'REPOS_SINGLE', 20),
                ]
            },
            {
                'code': 'EA_Q2_AI_ACCURACY_RISK',
                'text': 'Has the organization experienced LLM hallucinations or lack of enterprise context in AI pilots?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.PROBLEM_SEVERITY,
                'weight': 10,
                'order': 2,
                'options': [
                    ('Critical: AI pilots blocked due to hallucinations and untrusted outputs', 'HALLUCINATIONS_BLOCKING', 100),
                    ('High Friction: Generic ChatGPT/Copilot lacks proprietary business context', 'GENERIC_COPILOT_FAILS', 85),
                    ('Moderate: Manual copy-pasting of context required for every query', 'MANUAL_CONTEXT', 60),
                    ('No previous AI pilots, starting fresh context architecture', 'NEW_EXPLORATION', 35),
                ]
            },
            {
                'code': 'EA_Q3_KNOWLEDGE_SILOS',
                'text': 'How much time do executives and knowledge workers spend searching for cross-silo data?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.PROBLEM_SEVERITY,
                'weight': 10,
                'order': 3,
                'options': [
                    ('8+ Hours/week per knowledge worker across disconnected systems', 'HOURS_8_PLUS', 100),
                    ('4 to 7 Hours/week searching through SharePoint and ERP reports', 'HOURS_4_7', 75),
                    ('1 to 3 Hours/week', 'HOURS_1_3', 45),
                    ('Minimal search friction reported', 'HOURS_MINIMAL', 20),
                ]
            },
            {
                'code': 'EA_Q4_DATA_SOVEREIGNTY',
                'text': 'What are the organization\'s data privacy and residency requirements?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.TECHNICAL_FIT,
                'weight': 10,
                'order': 4,
                'options': [
                    ('Strict On-Premises / Private Cloud in Saudi Arabia (SDAIA / NCA compliant)', 'SOVEREIGN_ONPREM', 100),
                    ('Regional Dedicated Cloud VPC (Oracle/AWS/Azure Saudi Regions)', 'SOVEREIGN_REGIONAL', 85),
                    ('Standard Public Multi-Tenant Cloud with encryption', 'SOVEREIGN_PUBLIC', 60),
                    ('No specific data residency restrictions', 'SOVEREIGN_NONE', 30),
                ]
            },
            {
                'code': 'EA_Q5_KNOWLEDGE_USERS',
                'text': 'How many knowledge workers, managers, and analysts will use EntAura.AI?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.COMMERCIAL_POTENTIAL,
                'weight': 10,
                'order': 5,
                'options': [
                    ('500+ Enterprise Knowledge Workers', 'USERS_500_PLUS', 100),
                    ('150 to 499 Users', 'USERS_150_499', 80),
                    ('50 to 149 Users', 'USERS_50_149', 60),
                    ('Fewer than 50 Users', 'USERS_UNDER_50', 30),
                ]
            },
            {
                'code': 'EA_Q6_BUSINESS_VALUE',
                'text': 'What is the quantified annual financial return expected from autonomous decision intelligence?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.BUSINESS_VALUE,
                'weight': 10,
                'order': 6,
                'options': [
                    ('Over SAR 1,000,000 annual productivity savings & faster revenue actions', 'SAVINGS_1M_PLUS', 100),
                    ('SAR 300,000 to SAR 1,000,000 annual productivity gain', 'SAVINGS_300K_1M', 75),
                    ('Under SAR 300,000', 'SAVINGS_UNDER_300K', 45),
                    ('Non-quantified innovation initiative', 'SAVINGS_UNQUANTIFIED', 20),
                ]
            },
            {
                'code': 'EA_Q7_DECISION_ACCESS',
                'text': 'Who is sponsoring and championing the enterprise context AI initiative?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.DECISION_ACCESS,
                'weight': 10,
                'order': 7,
                'options': [
                    ('CEO / Chief Digital Officer / CIO (Direct Executive Sponsorship)', 'EXECUTIVE_SPONSOR', 100),
                    ('Head of Enterprise Architecture / Head of Analytics', 'ARCHITECT_SPONSOR', 80),
                    ('Innovation Manager without discretionary budget', 'INNOVATION_MGR', 40),
                    ('Individual Data Scientist / Developer', 'DEV_EVALUATOR', 20),
                ]
            },
            {
                'code': 'EA_Q8_TIMELINE',
                'text': 'What is the target deployment timeline for the Enterprise Context Layer?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.TIMELINE,
                'weight': 10,
                'order': 8,
                'options': [
                    ('Immediate production pilot within 60-90 days', 'PILOT_60_90D', 100),
                    ('Within 3 to 6 months', 'TIMELINE_3_6M', 75),
                    ('Strategic roadmap (6 to 12 months)', 'TIMELINE_6_12M', 45),
                    ('Unscheduled exploratory evaluation (>12 months)', 'TIMELINE_UNSCHEDULED', 15),
                ]
            }
        ]

        for q_data in entaura_questions:
            q, _ = QuestionnaireQuestion.objects.update_or_create(
                template=template,
                code=q_data['code'],
                defaults={
                    'question_text': q_data['text'],
                    'question_type': q_data['type'],
                    'feeds_dimension': q_data['dim'],
                    'dimension_weight_points': q_data['weight'],
                    'order': q_data['order'],
                    'is_required': True,
                    'is_active': True
                }
            )
            for opt_idx, (opt_label, opt_val, opt_pts) in enumerate(q_data['options'], start=1):
                QuestionAnswerOption.objects.update_or_create(
                    question=q,
                    value=opt_val,
                    defaults={
                        'label': opt_label,
                        'points': opt_pts,
                        'order': opt_idx,
                        'is_active': True
                    }
                )
        print(f"[OK] EntAura.AI: Configured template '{template.title}' with {len(entaura_questions)} questions.")

    # =========================================================================
    # 3. SPEAKORDER (Voice & WhatsApp Automated Order Capture)
    # =========================================================================
    if 'SPEAKORDER' in products:
        p = products['SPEAKORDER']
        cfg = get_or_create_config(p)
        get_or_create_profile(p, cfg)

        template, created = QuestionnaireTemplate.objects.get_or_create(
            product=p,
            stage_code="PLD_QUALIFICATION",
            defaults={
                'config_version': cfg,
                'title': "SpeakOrder™ Multilingual Voice & WhatsApp Order Automation Qualification Questionnaire",
                'version_number': 1,
                'is_active': True,
                'schema_json': []
            }
        )
        if not created:
            template.title = "SpeakOrder™ Multilingual Voice & WhatsApp Order Automation Qualification Questionnaire"
            template.config_version = cfg
            template.is_active = True
            template.save()

        speakorder_questions = [
            {
                'code': 'SO_Q1_DAILY_ORDER_VOLUME',
                'text': 'What is the daily B2B sales order volume received from dealers, outlets, or merchants?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.COMMERCIAL_POTENTIAL,
                'weight': 10,
                'order': 1,
                'options': [
                    ('500+ Orders daily (Large FMCG / Wholesale Distribution Hub)', 'ORDERS_500_PLUS', 100),
                    ('150 to 499 Orders daily (Regional Wholesaler / Distributor)', 'ORDERS_150_499', 80),
                    ('50 to 149 Orders daily', 'ORDERS_50_149', 60),
                    ('Fewer than 50 Orders daily', 'ORDERS_UNDER_50', 30),
                ]
            },
            {
                'code': 'SO_Q2_INTAKE_CHANNELS',
                'text': 'How do customer merchants and branch operators currently transmit purchase orders?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.PROBLEM_SEVERITY,
                'weight': 10,
                'order': 2,
                'options': [
                    ('Chaotic WhatsApp voice notes & photos of handwritten paper order lists', 'WHATSAPP_VOICE_HANDWRITTEN', 100),
                    ('Incoming phone calls to order desk / call center clerks', 'PHONE_CALLS', 85),
                    ('Unstructured text WhatsApp messages requiring manual ERP typing', 'WHATSAPP_TEXT', 65),
                    ('Existing B2B Web Portal (suffering from low merchant adoption)', 'PORTAL_LOW_ADOPTION', 45),
                ]
            },
            {
                'code': 'SO_Q3_ORDER_ERRORS',
                'text': 'What is the frequency of order entry mistakes, wrong SKUs, or dispatch delays?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.PROBLEM_SEVERITY,
                'weight': 10,
                'order': 3,
                'options': [
                    ('High (>10% order error rate, causing expensive returns and customer friction)', 'ERRORS_HIGH_10', 100),
                    ('Moderate (5% to 10% errors, frequent order confirmation callbacks)', 'ERRORS_MED_5_10', 75),
                    ('Low (2% to 5% errors)', 'ERRORS_LOW_2_5', 40),
                    ('Negligible error rate (<2%)', 'ERRORS_NEGLIGIBLE', 15),
                ]
            },
            {
                'code': 'SO_Q4_MULTILINGUAL_NEEDS',
                'text': 'What languages and spoken dialects do ordering merchants and sales agents use?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.TECHNICAL_FIT,
                'weight': 10,
                'order': 4,
                'options': [
                    ('Multilingual: Saudi/Gulf Arabic, Egyptian, Urdu, Hindi, English', 'MULTILINGUAL_ARABIC_URDU_EN', 100),
                    ('Spoken Arabic dialects only (Najdi, Hejazi, Egyptian)', 'ARABIC_DIALECTS_ONLY', 85),
                    ('Standard Arabic and English only', 'ARABIC_ENGLISH_ONLY', 70),
                    ('English only', 'ENGLISH_ONLY', 40),
                ]
            },
            {
                'code': 'SO_Q5_ORDER_ENTRY_CLERKS',
                'text': 'How many dedicated data entry operators or call desk agents manually type orders?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.BUSINESS_VALUE,
                'weight': 10,
                'order': 5,
                'options': [
                    ('10+ Full-time Order Entry Clerks', 'CLERKS_10_PLUS', 100),
                    ('5 to 9 Full-time Clerks', 'CLERKS_5_9', 80),
                    ('2 to 4 Clerks', 'CLERKS_2_4', 55),
                    ('1 Clerk or part-time staff', 'CLERKS_1_PARTTIME', 25),
                ]
            },
            {
                'code': 'SO_Q6_ERP_INTEGRATION',
                'text': 'Which ERP or accounting system should SpeakOrder post confirmed sales orders into?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.TECHNICAL_FIT,
                'weight': 10,
                'order': 6,
                'options': [
                    ('SAP / Oracle / Microsoft Dynamics / VanForces API', 'TIER1_ERP', 100),
                    ('Odoo / QuickBooks / Zoho Books', 'MID_ERP', 80),
                    ('Custom SQL Database / Local ERP', 'CUSTOM_SQL', 60),
                    ('No ERP (Export to Excel / CSV)', 'NO_ERP_EXCEL', 30),
                ]
            },
            {
                'code': 'SO_Q7_DECISION_ACCESS',
                'text': 'Who is evaluating the voice and conversational order capture automation?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.DECISION_ACCESS,
                'weight': 10,
                'order': 7,
                'options': [
                    ('Managing Director / VP Sales / Chief Commercial Officer (Direct Sign-off)', 'CCO_MD_DIRECT', 100),
                    ('Customer Service / Operations Director', 'OPS_DIRECTOR', 80),
                    ('Warehouse Dispatch Manager', 'WAREHOUSE_MGR', 50),
                    ('Order Desk Supervisor without budget', 'SUPERVISOR', 25),
                ]
            },
            {
                'code': 'SO_Q8_TIMELINE',
                'text': 'What is the target rollout timeline for merchant voice ordering?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.TIMELINE,
                'weight': 10,
                'order': 8,
                'options': [
                    ('Immediate pilot launch within 30-45 days', 'PILOT_30_45D', 100),
                    ('Within 90 days (next sales quarter)', 'QUARTER_90D', 80),
                    ('Within 6 months', 'HALF_YEAR', 50),
                    ('Exploratory (>6 months)', 'EXPLORATORY', 20),
                ]
            }
        ]

        for q_data in speakorder_questions:
            q, _ = QuestionnaireQuestion.objects.update_or_create(
                template=template,
                code=q_data['code'],
                defaults={
                    'question_text': q_data['text'],
                    'question_type': q_data['type'],
                    'feeds_dimension': q_data['dim'],
                    'dimension_weight_points': q_data['weight'],
                    'order': q_data['order'],
                    'is_required': True,
                    'is_active': True
                }
            )
            for opt_idx, (opt_label, opt_val, opt_pts) in enumerate(q_data['options'], start=1):
                QuestionAnswerOption.objects.update_or_create(
                    question=q,
                    value=opt_val,
                    defaults={
                        'label': opt_label,
                        'points': opt_pts,
                        'order': opt_idx,
                        'is_active': True
                    }
                )
        print(f"[OK] SpeakOrder: Configured template '{template.title}' with {len(speakorder_questions)} questions.")

    # =========================================================================
    # 4. TASKFORCES ERP (Enterprise HR, Payroll & Workforce Automation)
    # =========================================================================
    if 'TASKFORCES' in products:
        p = products['TASKFORCES']
        cfg = get_or_create_config(p)
        get_or_create_profile(p, cfg)

        template, created = QuestionnaireTemplate.objects.get_or_create(
            product=p,
            stage_code="PLD_QUALIFICATION",
            defaults={
                'config_version': cfg,
                'title': "TaskForces™ Enterprise HR, Payroll & Workforce Automation Qualification Questionnaire",
                'version_number': 1,
                'is_active': True,
                'schema_json': []
            }
        )
        if not created:
            template.title = "TaskForces™ Enterprise HR, Payroll & Workforce Automation Qualification Questionnaire"
            template.config_version = cfg
            template.is_active = True
            template.save()

        taskforces_questions = [
            {
                'code': 'TF_Q1_EMPLOYEE_HEADCOUNT',
                'text': 'What is the total active employee headcount across all entities and branches?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.COMMERCIAL_POTENTIAL,
                'weight': 10,
                'order': 1,
                'options': [
                    ('1,000+ Employees across multi-entity enterprise', 'EMPLOYEES_1000_PLUS', 100),
                    ('300 to 999 Employees (Medium Enterprise)', 'EMPLOYEES_300_999', 85),
                    ('100 to 299 Employees', 'EMPLOYEES_100_299', 65),
                    ('Fewer than 100 Employees', 'EMPLOYEES_UNDER_100', 35),
                ]
            },
            {
                'code': 'TF_Q2_PAYROLL_COMPLEXITY',
                'text': 'How many legal entities, multi-tier pay structures, and rotating shifts are managed?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.TECHNICAL_FIT,
                'weight': 10,
                'order': 2,
                'options': [
                    ('Multiple CRs/Entities, complex shift premiums, commissions & deductions', 'COMPLEX_MULTI_ENTITY', 100),
                    ('Single Company with 3+ Rotating Shift Patterns & Overtime', 'SINGLE_SHIFT_PATTERNS', 80),
                    ('Single Company with Standard Fixed Hours', 'SINGLE_STANDARD', 50),
                    ('Flat Hourly / Daily Wage without Complex Rules', 'FLAT_WAGE', 25),
                ]
            },
            {
                'code': 'TF_Q3_WPS_MUDAD_COMPLIANCE',
                'text': 'How is monthly WPS (Wage Protection System) and Mudad payroll compliance handled?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.PROBLEM_SEVERITY,
                'weight': 10,
                'order': 3,
                'options': [
                    ('Manual Excel generation with frequent bank SIF rejections and Mudad warnings', 'WPS_EXCEL_FAILURES', 100),
                    ('High monthly stress reconciling biometric punches with payroll bank file', 'WPS_STRESS_RECONCILE', 80),
                    ('Semi-automated through outsourced payroll bureau', 'WPS_OUTSOURCED', 60),
                    ('Fully automated compliant ERP pipeline', 'WPS_AUTOMATED', 25),
                ]
            },
            {
                'code': 'TF_Q4_GOVERNMENT_LIFECYCLE',
                'text': 'How are Muqeem, Qiwa, GOSI, and Iqama expiry renewals tracked?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.PROBLEM_SEVERITY,
                'weight': 10,
                'order': 4,
                'options': [
                    ('Manual spreadsheets resulting in expired documents and Ministry of Labor fines', 'DOC_SPREADSHEETS_FINES', 100),
                    ('Dedicated HR officer manually logging into government portals daily', 'DOC_MANUAL_LOGINS', 75),
                    ('Basic calendar reminders without automated workflow', 'DOC_CALENDAR_REMINDERS', 50),
                    ('Centralized proactive automated compliance alerts', 'DOC_AUTOMATED_ALERTS', 20),
                ]
            },
            {
                'code': 'TF_Q5_ATTENDANCE_HARDWARE',
                'text': 'What biometric or time-attendance hardware is currently deployed?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.TECHNICAL_FIT,
                'weight': 10,
                'order': 5,
                'options': [
                    ('Multiple ZKTeco / Facial Recognition devices across distributed sites', 'BIO_MULTI_DEVICE_ZK', 100),
                    ('Mobile GPS Geofenced Clock-in for field technicians & drivers', 'BIO_MOBILE_GPS', 90),
                    ('Single head-office fingerprint scanner', 'BIO_SINGLE_OFFICE', 60),
                    ('Paper sign-in sheets / Manual attendance registers', 'BIO_PAPER_SHEETS', 35),
                ]
            },
            {
                'code': 'TF_Q6_END_OF_SERVICE',
                'text': 'How is Saudi Labor Law End of Service Benefit (EOSB) calculated and accrued?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.BUSINESS_VALUE,
                'weight': 10,
                'order': 6,
                'options': [
                    ('Complex manual calculation with high dispute risk on resignation/termination', 'EOSB_MANUAL_DISPUTES', 100),
                    ('Spreadsheet formula with manual adjustments for unutilized leave balance', 'EOSB_SPREADSHEET', 75),
                    ('Basic standalone accounting module', 'EOSB_ACCOUNTING_MODULE', 45),
                    ('Fully automated compliant ledger accrual', 'EOSB_COMPLIANT_LEDGER', 20),
                ]
            },
            {
                'code': 'TF_Q7_DECISION_ACCESS',
                'text': 'Who is championing and evaluating the enterprise HR & payroll transformation?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.DECISION_ACCESS,
                'weight': 10,
                'order': 7,
                'options': [
                    ('Group HR Director / Chief Human Resources Officer / CFO (Direct Authority)', 'CHRO_CFO_DIRECT', 100),
                    ('Senior HR Operations Manager / Payroll Controller', 'HR_OPS_MGR', 80),
                    ('IT Manager supporting HR systems', 'IT_MGR_SUPPORT', 60),
                    ('HR Specialist / Payroll Clerk without budget', 'HR_CLERK', 30),
                ]
            },
            {
                'code': 'TF_Q8_TIMELINE',
                'text': 'What is the implementation and payroll cutoff target date?',
                'type': QuestionType.CHOICE,
                'dim': ScoreDimension.TIMELINE,
                'weight': 10,
                'order': 8,
                'options': [
                    ('Next Payroll Cycle (<60 days - Urgent cutover)', 'CUTOVER_60D', 100),
                    ('Next Fiscal Quarter', 'NEXT_QUARTER', 80),
                    ('Next Fiscal Year', 'NEXT_YEAR', 45),
                    ('Exploratory evaluation (>12 months)', 'EXPLORATORY', 20),
                ]
            }
        ]

        for q_data in taskforces_questions:
            q, _ = QuestionnaireQuestion.objects.update_or_create(
                template=template,
                code=q_data['code'],
                defaults={
                    'question_text': q_data['text'],
                    'question_type': q_data['type'],
                    'feeds_dimension': q_data['dim'],
                    'dimension_weight_points': q_data['weight'],
                    'order': q_data['order'],
                    'is_required': True,
                    'is_active': True
                }
            )
            for opt_idx, (opt_label, opt_val, opt_pts) in enumerate(q_data['options'], start=1):
                QuestionAnswerOption.objects.update_or_create(
                    question=q,
                    value=opt_val,
                    defaults={
                        'label': opt_label,
                        'points': opt_pts,
                        'order': opt_idx,
                        'is_active': True
                    }
                )
        print(f"[OK] TaskForces ERP: Configured template '{template.title}' with {len(taskforces_questions)} questions.")

    print("\nSUCCESS: All product-specific qualification questionnaire templates & questions seeded successfully!")

if __name__ == '__main__':
    seed_all_product_questionnaires()
