import os
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.core.models import Tenant
from apps.authentication.models import User, UserRole
from apps.products.models import Product, ProductStatus, ProductModule, ProductCapability, Problem, ProblemCategory, ProblemCapability
from apps.pld_engine.models import (
    ProductConfigurationVersion, ConfigStatus, ICPProfile, ICPRule, ICPRuleType, RuleOperator,
    ScoreModel, ScoreDimension, QuestionnaireTemplate, QuestionnaireQuestion,
    QuestionAnswerOption, QuestionType, PipelineStage, PipelineType, StageGate
)
from apps.leads.models import LeadSource


class Command(BaseCommand):
    help = 'Seeds initial generic master data and VanForces™ as the first product configuration'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Initializing TEXOL CRM foundation master data..."))

        # 1. Default Tenant
        tenant, _ = Tenant.objects.get_or_create(
            code="TEXOL_INTERNAL",
            defaults={"name": "TEXOL Operating Company"}
        )

        # 2. Default Users
        admin_user, _ = User.objects.get_or_create(
            email="admin@texol.com",
            defaults={
                "username": "admin",
                "first_name": "TEXOL",
                "last_name": "Administrator",
                "role": UserRole.ADMIN,
                "is_staff": True,
                "is_superuser": True,
                "tenant": tenant
            }
        )
        if not admin_user.has_usable_password():
            admin_user.set_password("Admin@Texol2026")
            admin_user.save()

        pld_exec, _ = User.objects.get_or_create(
            email="aslam.pld@texol.com",
            defaults={
                "username": "aslam_pld",
                "first_name": "Aslam",
                "last_name": "Khan",
                "role": UserRole.PLD_EXECUTIVE,
                "tenant": tenant,
                "territory": "Saudi Arabia / Riyadh"
            }
        )
        if not pld_exec.has_usable_password():
            pld_exec.set_password("Texol@2026")
            pld_exec.save()

        sales_mgr, _ = User.objects.get_or_create(
            email="sales.manager@texol.com",
            defaults={
                "username": "sales_manager",
                "first_name": "Tariq",
                "last_name": "Al-Mansoor",
                "role": UserRole.SALES_MANAGER,
                "tenant": tenant,
                "territory": "GCC"
            }
        )
        if not sales_mgr.has_usable_password():
            sales_mgr.set_password("Texol@2026")
            sales_mgr.save()

        # 3. Lead Sources
        sources = [
            ("WEBSITE", "Website Inbound Form"),
            ("LINKEDIN", "LinkedIn Campaign / InMail"),
            ("WHATSAPP", "WhatsApp Direct Inquiry"),
            ("PARTNER", "Authorized Partner Deal"),
            ("REFERRAL", "Customer Referral"),
            ("EXHIBITION", "Trade Exhibition / Event"),
            ("OUTBOUND", "Outbound Cold Outreach"),
        ]
        for code, name in sources:
            LeadSource.objects.get_or_create(code=code, defaults={"name": name, "tenant": tenant})

        # 4. Universal Problem Library
        problems_data = [
            ("PROB_SALES_PROD", ProblemCategory.SALES, "Low Field Sales Productivity", "Sales reps spend excessive time on manual order entry, paperwork, and reconciliation.", "HIGH"),
            ("PROB_MISSED_ORDERS", ProblemCategory.SALES, "Missed Outlet Orders", "Orders are lost or delayed due to lack of real-time catalog and inventory visibility in vans.", "HIGH"),
            ("PROB_OUTLET_COVERAGE", ProblemCategory.DISTRIBUTION, "Low Outlet Coverage & Route Deviation", "Field drivers do not follow planned beat schedules, leaving high-value retail outlets unvisited.", "CRITICAL"),
            ("PROB_VAN_STOCK_LEAK", ProblemCategory.OPERATIONS, "Van Inventory Shrinkage & Duplication", "Mismatch between physical van inventory and central warehouse stock causing stockouts and losses.", "HIGH"),
            ("PROB_MANUAL_REPORTING", ProblemCategory.MANAGEMENT, "Slow Manual Reporting & Low Visibility", "Management receives sales performance summaries days late, hindering timely operational decisions.", "MEDIUM"),
            ("PROB_ERP_DUPLICATION", ProblemCategory.INTEGRATION, "ERP Re-entry & Duplicate Invoicing", "Orders captured on paper must be manually re-keyed into ERP systems, leading to errors.", "CRITICAL"),
        ]
        problem_objs = {}
        for code, cat, name, desc, sev in problems_data:
            prob, _ = Problem.objects.get_or_create(
                code=code,
                defaults={"category": cat, "name": name, "description": desc, "default_severity": sev, "tenant": tenant}
            )
            problem_objs[code] = prob

        # 5. VanForces Product Master
        vanforces, _ = Product.objects.get_or_create(
            code="VANFORCES",
            defaults={
                "name": "VanForces™",
                "category": "Van Sales & Distribution Automation",
                "description": "Product-Led Field Sales and Mobile Distribution Operating System",
                "status": ProductStatus.ACTIVE,
                "owner": admin_user,
                "tenant": tenant
            }
        )

        # 6. VanForces Modules
        modules_data = [
            ("VAN_SALES", "Van Sales & Mobile Invoicing", "On-the-spot order capture, bill printing, and digital signature"),
            ("ROUTE_MGMT", "Route Planning & Adherence", "GPS beat planning, geofenced outlet check-ins, and turn-by-turn routing"),
            ("OUTLET_MGMT", "Outlet & Customer Coverage", "Comprehensive retail customer profiling, classification, and geolocation"),
            ("VAN_INVENTORY", "Van Stock & Load Management", "Real-time truck load tracking, returns, and transfer reconciliations"),
            ("COLLECTIONS", "Payments & Credit Control", "Cash, check, and digital payment collections with credit limit enforcement"),
            ("ERP_GATEWAY", "ERP Integration Gateway", "Bi-directional synchronization with SAP, Odoo, and Microsoft Dynamics"),
        ]
        module_objs = {}
        for code, name, desc in modules_data:
            m, _ = ProductModule.objects.get_or_create(
                product=vanforces,
                code=code,
                defaults={"name": name, "description": desc, "tenant": tenant}
            )
            module_objs[code] = m

        # 7. VanForces Capabilities
        capabilities_data = [
            ("CAP_MOBILE_INVOICING", "VAN_SALES", "Instant Mobile Invoicing & Receipt Printing", "Generates compliant invoices directly on mobile Bluetooth printers."),
            ("CAP_ROUTE_GEOFENCE", "ROUTE_MGMT", "Route Planning with Geofence Verification", "Locks order capture until driver is within 50m of outlet coordinates."),
            ("CAP_OUTLET_AUDIT", "OUTLET_MGMT", "Outlet Visit Verification & Photo Audit", "Verifies shelf presence, competitor stock, and visit duration."),
            ("CAP_VAN_STOCK_SYNC", "VAN_INVENTORY", "Real-time Van Stock Tracking", "Live stock deductions per SKU upon invoice issuance."),
            ("CAP_ERP_AUTO_POST", "ERP_GATEWAY", "Real-time ERP Sales Invoice Posting", "Automatically posts validated van invoices to customer ERP backend."),
        ]
        cap_objs = {}
        for code, m_code, name, desc in capabilities_data:
            cap, _ = ProductCapability.objects.get_or_create(
                product=vanforces,
                module=module_objs[m_code],
                code=code,
                defaults={"name": name, "description": desc, "tenant": tenant}
            )
            cap_objs[code] = cap

        # 8. Problem -> Capability Mappings
        mappings = [
            ("PROB_SALES_PROD", "CAP_MOBILE_INVOICING", "+25% salesman daily order output"),
            ("PROB_MISSED_ORDERS", "CAP_MOBILE_INVOICING", "-90% missed order occurrences"),
            ("PROB_OUTLET_COVERAGE", "CAP_ROUTE_GEOFENCE", "+20% outlet daily coverage"),
            ("PROB_OUTLET_COVERAGE", "CAP_OUTLET_AUDIT", "100% verified outlet attendance"),
            ("PROB_VAN_STOCK_LEAK", "CAP_VAN_STOCK_SYNC", "<0.5% van inventory variance"),
            ("PROB_ERP_DUPLICATION", "CAP_ERP_AUTO_POST", "Zero manual invoice re-entry"),
        ]
        for prob_code, cap_code, impact in mappings:
            ProblemCapability.objects.get_or_create(
                problem=problem_objs[prob_code],
                capability=cap_objs[cap_code],
                defaults={"expected_kpi_impact": impact, "tenant": tenant}
            )

        # 9. VanForces Configuration Version 1 (Published)
        config_v1, _ = ProductConfigurationVersion.objects.get_or_create(
            product=vanforces,
            version_number=1,
            defaults={
                "status": ConfigStatus.PUBLISHED,
                "published_at": timezone.now(),
                "published_by": admin_user,
                "notes": "Baseline VanForces PLD qualification configuration v1.1",
                "tenant": tenant
            }
        )

        # 10. ICP Profile & Rules for VanForces v1
        icp_profile, _ = ICPProfile.objects.get_or_create(
            product=vanforces,
            config_version=config_v1,
            version_number=1,
            defaults={
                "name": "VanForces Standard Distribution Profile",
                "description": "Baseline ICP rules for FMCG, Bakery & Food distributors in GCC",
                "is_active": True,
                "pass_threshold": 50,
                "tenant": tenant
            }
        )

        # Knockout Rules
        ICPRule.objects.get_or_create(
            config_version=config_v1,
            field_name="industry",
            rule_type=ICPRuleType.KNOCKOUT,
            defaults={
                "profile": icp_profile,
                "operator": RuleOperator.IN,
                "target_value": ["FMCG", "Bakery", "Food & Beverage", "Dairy", "Frozen Food", "Wholesale Distribution"],
                "is_mandatory": True,
                "is_active": True,
                "description": "Target distribution industry sector",
                "failure_reason": "Account industry is outside target distribution sectors (FMCG, Bakery, F&B, Dairy, Frozen Food, Wholesale Distribution)",
                "tenant": tenant
            }
        )
        ICPRule.objects.get_or_create(
            config_version=config_v1,
            field_name="field_sales",
            rule_type=ICPRuleType.KNOCKOUT,
            defaults={
                "profile": icp_profile,
                "operator": RuleOperator.EQUALS,
                "target_value": True,
                "is_mandatory": True,
                "is_active": True,
                "description": "Must operate field sales or van delivery teams",
                "failure_reason": "Company does not operate a direct field sales or van distribution model",
                "tenant": tenant
            }
        )
        # Fit Rules
        ICPRule.objects.get_or_create(
            config_version=config_v1,
            field_name="employees_count",
            rule_type=ICPRuleType.FIT,
            defaults={
                "profile": icp_profile,
                "operator": RuleOperator.GREATER_THAN_OR_EQUAL,
                "target_value": 20,
                "weight": 20,
                "points": 20,
                "is_active": True,
                "description": "Company size >= 20 employees",
                "tenant": tenant
            }
        )
        ICPRule.objects.get_or_create(
            config_version=config_v1,
            field_name="salesmen_count",
            rule_type=ICPRuleType.FIT,
            defaults={
                "profile": icp_profile,
                "operator": RuleOperator.GREATER_THAN_OR_EQUAL,
                "target_value": 10,
                "weight": 30,
                "points": 30,
                "is_active": True,
                "description": "Field sales force >= 10 salesmen",
                "tenant": tenant
            }
        )
        ICPRule.objects.get_or_create(
            config_version=config_v1,
            field_name="vans_count",
            rule_type=ICPRuleType.FIT,
            defaults={
                "profile": icp_profile,
                "operator": RuleOperator.GREATER_THAN_OR_EQUAL,
                "target_value": 5,
                "weight": 30,
                "points": 30,
                "is_active": True,
                "description": "Van fleet size >= 5 active delivery vans",
                "tenant": tenant
            }
        )
        ICPRule.objects.get_or_create(
            config_version=config_v1,
            field_name="primary_erp",
            rule_type=ICPRuleType.FIT,
            defaults={
                "profile": icp_profile,
                "operator": RuleOperator.IN,
                "target_value": ["SAP", "SAP S/4HANA", "Odoo", "Microsoft Dynamics", "Oracle", "Tally"],
                "weight": 20,
                "points": 20,
                "is_active": True,
                "description": "Supported enterprise ERP back-office system",
                "tenant": tenant
            }
        )

        # 11. Score Model Dimensions (Sum = 100%)
        standard_thresholds = {
            "NURTURE": [0, 30],
            "DEVELOPMENT": [31, 60],
            "QUALIFIED": [61, 80],
            "HIGH_PRIORITY": [81, 100]
        }
        score_dimensions = [
            (ScoreDimension.PROBLEM_SEVERITY, 25, {"HIGH": 100, "MEDIUM": 65, "LOW": 30}),
            (ScoreDimension.BUSINESS_VALUE, 20, {">=20%": 100, "10-20%": 75, "<10%": 40}),
            (ScoreDimension.DECISION_ACCESS, 15, {"DECISION_MAKER": 100, "CHAMPION": 75, "INFLUENCER": 45, "USER": 20}),
            (ScoreDimension.TIMELINE, 10, {"<3 months": 100, "3-6 months": 70, "6-12 months": 40, ">12 months": 10}),
            (ScoreDimension.TECHNICAL_FIT, 15, {"STANDARD_ERP": 100, "CUSTOM_ERP": 70, "NO_ERP": 35}),
            (ScoreDimension.COMMERCIAL_POTENTIAL, 15, {">=50 vans": 100, "20-49 vans": 80, "10-19 vans": 60, "<10 vans": 30}),
        ]
        for dim, weight, mapping in score_dimensions:
            ScoreModel.objects.get_or_create(
                config_version=config_v1,
                dimension_name=dim,
                defaults={
                    "weight_percentage": weight,
                    "input_mapping": mapping,
                    "thresholds": standard_thresholds,
                    "is_active": True,
                    "tenant": tenant
                }
            )

        # 12. Dynamic Questionnaire Template — Full 15-Question Specification for VanForces (v1.1)
        questions_definitions = [
            {
                "code": "Q1_DISTRIBUTION_BIZ",
                "text": "Is this an active distribution or wholesale trading business?",
                "type": QuestionType.BOOLEAN,
                "feeds": ScoreDimension.TECHNICAL_FIT,
                "order": 1,
                "options": [
                    ("Yes, Wholesale / B2B Distribution", "true", 100),
                    ("No, Retail Only / Non-Distribution", "false", 0)
                ]
            },
            {
                "code": "Q2_FIELD_SALES",
                "text": "Does the company deploy field sales representatives or van delivery drivers?",
                "type": QuestionType.BOOLEAN,
                "feeds": ScoreDimension.TECHNICAL_FIT,
                "order": 2,
                "options": [
                    ("Yes, Dedicated Field Sales / Delivery Fleet", "true", 100),
                    ("No, In-store / Showroom Only", "false", 0)
                ]
            },
            {
                "code": "Q3_SALESMEN_VANS",
                "text": "How many active salesmen and delivery vans operate on routes daily?",
                "type": QuestionType.CHOICE,
                "feeds": ScoreDimension.COMMERCIAL_POTENTIAL,
                "order": 3,
                "options": [
                    ("50+ Active Vans & Salesmen", ">=50 vans", 100),
                    ("20 to 49 Vans", "20-49 vans", 80),
                    ("10 to 19 Vans", "10-19 vans", 60),
                    ("5 to 9 Vans", "5-9 vans", 40),
                    ("Fewer than 5 Vans", "<5 vans", 20)
                ]
            },
            {
                "code": "Q4_OUTLETS_CUSTOMERS",
                "text": "How many active retail customer outlets are serviced per month?",
                "type": QuestionType.CHOICE,
                "feeds": ScoreDimension.COMMERCIAL_POTENTIAL,
                "order": 4,
                "options": [
                    ("2,000+ Retail Outlets", ">=2000 outlets", 100),
                    ("500 to 1,999 Outlets", "500-1999 outlets", 80),
                    ("100 to 499 Outlets", "100-499 outlets", 60),
                    ("Fewer than 100 Outlets", "<100 outlets", 30)
                ]
            },
            {
                "code": "Q5_ORDER_CAPTURE",
                "text": "How are customer sales orders currently captured in the field?",
                "type": QuestionType.CHOICE,
                "feeds": ScoreDimension.TECHNICAL_FIT,
                "order": 5,
                "options": [
                    ("Mobile Handheld Terminal / Sales App", "MOBILE_APP", 90),
                    ("Phone Calls / WhatsApp Messages", "WHATSAPP", 60),
                    ("Paper Carbon-Copy Order Books", "PAPER", 40),
                    ("Driver End-of-Day Memory / Unrecorded", "NONE", 20)
                ]
            },
            {
                "code": "Q6_ROUTE_PLANNING",
                "text": "How are delivery routes planned and assigned to drivers?",
                "type": QuestionType.CHOICE,
                "feeds": ScoreDimension.PROBLEM_SEVERITY,
                "order": 6,
                "options": [
                    ("Driver Discretion / No Structured Route", "DRIVER_CHOICE", 100),
                    ("Static Fixed Excel Route Lists", "EXCEL", 70),
                    ("Basic Weekly Paper Sequence", "PAPER_SEQUENCE", 50),
                    ("Automated Dynamic Route Optimizer", "DYNAMIC_OPTIMIZER", 20)
                ]
            },
            {
                "code": "Q7_STOCK_CHECKS",
                "text": "How is van inventory and physical mobile stock reconciled?",
                "type": QuestionType.CHOICE,
                "feeds": ScoreDimension.PROBLEM_SEVERITY,
                "order": 7,
                "options": [
                    ("No Formal Stock Check (Driver replenishes blindly)", "NO_STOCK_CHECK", 100),
                    ("Weekly / Monthly Manual Inventory Count", "WEEKLY_MANUAL", 80),
                    ("Daily Morning / Evening Tally Sheet", "DAILY_TALLY", 50),
                    ("Real-time Mobile Barcode Scanning & Live Sync", "REALTIME_BARCODE", 20)
                ]
            },
            {
                "code": "Q8_INVOICES_COLLECTIONS",
                "text": "How are customer invoices and payment collections handled on routes?",
                "type": QuestionType.CHOICE,
                "feeds": ScoreDimension.BUSINESS_VALUE,
                "order": 8,
                "options": [
                    ("Driver Cash with Delayed Bank Reconciliation", "CASH_DELAYED", 100),
                    ("Handwritten Manual Invoices & Carbon Receipts", "MANUAL_RECEIPTS", 80),
                    ("Customer Credit Accounts / Invoiced by Backoffice", "BACKOFFICE_CREDIT", 60),
                    ("Real-time Mobile Invoicing with Bluetooth Printing", "MOBILE_POS", 20)
                ]
            },
            {
                "code": "Q9_BIGGEST_PROBLEM",
                "text": "What is the single biggest operational problem facing field operations?",
                "type": QuestionType.CHOICE,
                "feeds": ScoreDimension.PROBLEM_SEVERITY,
                "order": 9,
                "options": [
                    ("Route Inefficiency & Skipped Retail Outlets", "HIGH", 100),
                    ("Van Stock Leakage & Physical Shrinkage", "HIGH", 95),
                    ("Manual Double-entry of Orders into ERP", "MEDIUM", 75),
                    ("Lack of Salesman Activity Visibility & Geofencing", "MEDIUM", 70),
                    ("Minor Clerical Delays", "LOW", 30)
                ]
            },
            {
                "code": "Q10_BUSINESS_IMPACT",
                "text": "What is the quantified business impact or revenue loss caused by this problem?",
                "type": QuestionType.CHOICE,
                "feeds": ScoreDimension.BUSINESS_VALUE,
                "order": 10,
                "options": [
                    ("High Revenue Loss / Cost Inefficiency (>=20%)", ">=20%", 100),
                    ("Moderate Operational Waste (10% to 20%)", "10-20%", 75),
                    ("Low Operational Delay (<10%)", "<10%", 40),
                    ("Negligible Financial Consequence", "NEGLIGIBLE", 10)
                ]
            },
            {
                "code": "Q11_AFFECTED_PEOPLE",
                "text": "Who in the client organization is directly impacted by these problems?",
                "type": QuestionType.CHOICE,
                "feeds": ScoreDimension.BUSINESS_VALUE,
                "order": 11,
                "options": [
                    ("Entire Commercial Chain: Salesmen, Warehouse & MD", "FULL_CHAIN", 100),
                    ("Van Drivers & Route Supervisors", "DRIVERS_SUPERVISORS", 80),
                    ("Back-office Data Entry Clerks & Accountants", "BACKOFFICE", 60),
                    ("Isolated Individual Drivers", "ISOLATED", 25)
                ]
            },
            {
                "code": "Q12_EVALUATOR",
                "text": "Who is currently championing or evaluating software solutions?",
                "type": QuestionType.CHOICE,
                "feeds": ScoreDimension.DECISION_ACCESS,
                "order": 12,
                "options": [
                    ("Managing Director / Owner", "CHAMPION", 100),
                    ("Sales Director / Commercial VP", "CHAMPION", 90),
                    ("Operations / Supply Chain Manager", "INFLUENCER", 70),
                    ("IT Systems Manager", "TECHNICAL", 60),
                    ("Branch Supervisor / Dispatcher", "USER", 35)
                ]
            },
            {
                "code": "Q13_DECISION_MAKER",
                "text": "Who is the ultimate economic decision maker with final budget authority?",
                "type": QuestionType.CHOICE,
                "feeds": ScoreDimension.DECISION_ACCESS,
                "order": 13,
                "options": [
                    ("CEO / Managing Director / Owner (Direct Access)", "DECISION_MAKER", 100),
                    ("Executive Committee / Board Level", "CHAMPION", 80),
                    ("Sales Director with Authorized Discretionary Budget", "CHAMPION", 75),
                    ("IT / Operations Head without Independent Budget", "INFLUENCER", 45),
                    ("No Decision Maker Identified / Committee Unknown", "USER", 15)
                ]
            },
            {
                "code": "Q14_TIMELINE",
                "text": "What is the expected project implementation timeline?",
                "type": QuestionType.CHOICE,
                "feeds": ScoreDimension.TIMELINE,
                "order": 14,
                "options": [
                    ("Immediate Rollout (<3 months)", "<3 months", 100),
                    ("Within Next Quarter (3 to 6 months)", "3-6 months", 70),
                    ("Fiscal Year Horizon (6 to 12 months)", "6-12 months", 40),
                    ("Exploratory / Unscheduled (>12 months)", ">12 months", 10)
                ]
            },
            {
                "code": "Q15_BUDGET_PROJECT",
                "text": "Is there an approved commercial budget or allocated project fund?",
                "type": QuestionType.CHOICE,
                "feeds": ScoreDimension.COMMERCIAL_POTENTIAL,
                "order": 15,
                "options": [
                    ("Fully Approved Project Budget", "APPROVED_BUDGET", 100),
                    ("Budget in Formal Approval Workflow", "PENDING_APPROVAL", 75),
                    ("Department Discretionary / Contingency Budget", "CONTINGENCY", 50),
                    ("No Budget Allocated / Exploratory Inquiry", "NO_BUDGET", 20)
                ]
            }
        ]

        # Convert to schema_json for backward compatibility
        questionnaire_schema = []
        for q in questions_definitions:
            questionnaire_schema.append({
                "id": q["code"],
                "text": q["text"],
                "type": "boolean" if q["type"] == QuestionType.BOOLEAN else "choice",
                "feeds_dimension": q["feeds"],
                "options": [opt[0] for opt in q["options"]]
            })

        template_obj, _ = QuestionnaireTemplate.objects.update_or_create(
            config_version=config_v1,
            stage_code="PLD_QUALIFICATION",
            defaults={
                "product": vanforces,
                "title": "VanForces™ PLD Qualification Questionnaire (15-Dimension)",
                "version_number": 1,
                "is_active": True,
                "schema_json": questionnaire_schema,
                "tenant": tenant
            }
        )

        # Create Question and Answer Option records
        for q_def in questions_definitions:
            q_rec, _ = QuestionnaireQuestion.objects.update_or_create(
                template=template_obj,
                code=q_def["code"],
                defaults={
                    "question_text": q_def["text"],
                    "question_type": q_def["type"],
                    "order": q_def["order"],
                    "is_required": True,
                    "is_active": True,
                    "feeds_dimension": q_def["feeds"],
                    "tenant": tenant
                }
            )
            for opt_idx, (opt_label, opt_val, opt_pts) in enumerate(q_def["options"]):
                QuestionAnswerOption.objects.update_or_create(
                    question=q_rec,
                    value=opt_val,
                    defaults={
                        "label": opt_label,
                        "points": opt_pts,
                        "order": opt_idx + 1,
                        "is_active": True,
                        "tenant": tenant
                    }
                )

        # 13. Pipeline Stages & Gates (Pursuit Pipeline)
        stages_data = [
            ("NEW", "New Lead", 1, True, "Lead captured from marketing, partner, or direct intake"),
            ("ICP_CHECK", "ICP Check", 2, True, "Automatic knock-out and fit score evaluation"),
            ("CONTACTING", "Contacting & Queue", 3, True, "PLD executive actively attempting initial conversation"),
            ("PLD_QUALIFIED", "PLD Qualified", 4, True, "Documented business problem and PLD score >= 60"),
            ("DISCOVERY", "Discovery & Mapping", 5, True, "In-depth discovery session and problem-capability mapping"),
            ("DEMO", "Product Demo", 6, True, "Customized van sales workflow demonstration against client pain points"),
            ("POC", "POC / Pilot Trial", 7, False, "Optional trial in selected territory/vans (marked optional in v1 pipeline)"),
            ("SQL_READY", "SQL Ready Gate", 8, True, "All qualification gates verified; ready for Sales Acceptance"),
            ("SALES_ACCEPTED", "Sales Accepted", 9, True, "Sales owner accepts commercial ownership"),
        ]
        stage_objs = {}
        for code, name, seq, is_req, desc in stages_data:
            stg, _ = PipelineStage.objects.get_or_create(
                config_version=config_v1,
                pipeline_type=PipelineType.PURSUIT,
                stage_code=code,
                defaults={"stage_name": name, "sequence_order": seq, "is_required": is_req, "tenant": tenant}
            )
            stage_objs[code] = stg

        # Stage Gates
        StageGate.objects.get_or_create(
            pipeline_stage=stage_objs["PLD_QUALIFIED"],
            gate_code="GATE_PROBLEM_DOCUMENTED",
            defaults={
                "gate_name": "At Least 1 Problem & Next Action Documented",
                "condition_rules": {"min_problems": 1, "min_score": 60, "require_next_action": True},
                "is_mandatory": True,
                "tenant": tenant
            }
        )
        StageGate.objects.get_or_create(
            pipeline_stage=stage_objs["DISCOVERY"],
            gate_code="GATE_MAPPING_COMPLETE",
            defaults={
                "gate_name": "Discovery Problem-Capability Mapping Complete",
                "condition_rules": {"require_product_mapping": True, "require_stakeholders": True},
                "is_mandatory": True,
                "tenant": tenant
            }
        )
        StageGate.objects.get_or_create(
            pipeline_stage=stage_objs["DEMO"],
            gate_code="GATE_DEMO_FEEDBACK",
            defaults={
                "gate_name": "Demo Feedback & Next Action Recorded",
                "condition_rules": {"require_feedback": True, "require_next_action": True},
                "is_mandatory": True,
                "tenant": tenant
            }
        )
        StageGate.objects.get_or_create(
            pipeline_stage=stage_objs["SQL_READY"],
            gate_code="GATE_SQL_READINESS_CHECKLIST",
            defaults={
                "gate_name": "SQL Readiness Gate: Problem, Solution, Timeline, Decision, Value",
                "condition_rules": {
                    "require_icp_passed": True,
                    "require_problem_impact": True,
                    "require_solution_mapped": True,
                    "require_decision_maker": True,
                    "require_timeline": True,
                    "require_estimated_value": True
                },
                "is_mandatory": True,
                "tenant": tenant
            }
        )

        self.stdout.write(self.style.SUCCESS("[OK] Successfully seeded TEXOL CRM Master Data and VanForces Configuration v1.0!"))
