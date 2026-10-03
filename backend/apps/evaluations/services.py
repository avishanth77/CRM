import uuid
from datetime import timedelta
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()
from apps.evaluations.models import (
    Demo, DemoStatus, DemoParticipant, DemoUseCaseMapping,
    POC, POCStatus, POCParticipant, POCSuccessCriterion
)
from apps.products.models import Product, ProductModule, ProductCapability
from apps.pld_engine.models import PipelineStage, PipelineType
from apps.accounts.models import Contact
from apps.audit_logging.models import AuditLog, AuditAction


class StageRequirementChecker:
    """
    Evaluates whether Demo or POC stage is REQUIRED or OPTIONAL for a given Product / Pipeline.
    Prevents hard-coding: decisions are driven dynamically by the product's pipeline configuration.
    """
    @staticmethod
    def get_stage_config(product, stage_code):
        if not product:
            return None
        config = product.configurations.filter(status='PUBLISHED').first() or product.configurations.first()
        if not config:
            return None
        return config.stages.filter(stage_code__iexact=stage_code).first()

    @classmethod
    def is_demo_required(cls, product):
        stage = cls.get_stage_config(product, "DEMO")
        if not stage:
            return True  # Default to required if unconfigured
        return stage.is_required

    @classmethod
    def is_poc_required(cls, product):
        stage = cls.get_stage_config(product, "POC")
        if not stage:
            return False  # In VanForces v1, POC is optional trial
        return stage.is_required


class DemoValidator:
    """
    Validates readiness gate criteria for completing a Demo.
    Mandatory minimums per specification:
      1. Participants: Customer or internal participants documented
      2. Mapped Use Case: At least 1 use case / capability / problem demonstrated
      3. Customer Feedback: Documented post-demo feedback
      4. Next Action: Documented next commercial / technical action and due date
    """
    @staticmethod
    def validate_readiness(demo):
        checklist = []
        missing_fields = []
        is_ready = True

        # Gate 1: Participants
        has_participants = demo.participants.exists() or bool(demo.participants_notes and demo.participants_notes.strip())
        if not has_participants:
            is_ready = False
            missing_fields.append("Participants (Customer or Internal)")
            checklist.append({
                "gate_code": "DEMO_PARTICIPANTS",
                "name": "Demo Participants",
                "description": "Customer stakeholders and internal presenter must be recorded.",
                "status": "MISSING",
                "is_mandatory": True,
                "missing_fields": ["participants"]
            })
        else:
            checklist.append({
                "gate_code": "DEMO_PARTICIPANTS",
                "name": "Demo Participants",
                "description": f"{demo.participants.count()} participant(s) registered.",
                "status": "COMPLETED",
                "is_mandatory": True,
                "missing_fields": []
            })

        # Gate 2: Mapped Use Cases
        has_use_cases = demo.use_cases.exists() or (isinstance(demo.demonstrated_use_cases, list) and len(demo.demonstrated_use_cases) > 0)
        if not has_use_cases:
            is_ready = False
            missing_fields.append("Demonstrated Use Case / Product Capabilities")
            checklist.append({
                "gate_code": "DEMO_USE_CASES",
                "name": "Mapped Use Cases",
                "description": "Demonstrated customer problems and product capabilities must be linked.",
                "status": "BLOCKED",
                "is_mandatory": True,
                "missing_fields": ["use_cases"]
            })
        else:
            checklist.append({
                "gate_code": "DEMO_USE_CASES",
                "name": "Mapped Use Cases",
                "description": f"{demo.use_cases.count()} capability use case(s) mapped.",
                "status": "COMPLETED",
                "is_mandatory": True,
                "missing_fields": []
            })

        # Gate 3: Customer Feedback
        has_feedback = bool(demo.customer_feedback and demo.customer_feedback.strip())
        if not has_feedback:
            is_ready = False
            missing_fields.append("Customer Feedback")
            checklist.append({
                "gate_code": "DEMO_FEEDBACK",
                "name": "Customer Feedback & Objections",
                "description": "Post-demo customer reaction, objections, or questions must be captured.",
                "status": "MISSING",
                "is_mandatory": True,
                "missing_fields": ["customer_feedback"]
            })
        else:
            checklist.append({
                "gate_code": "DEMO_FEEDBACK",
                "name": "Customer Feedback & Objections",
                "description": "Customer feedback and evaluation recorded.",
                "status": "COMPLETED",
                "is_mandatory": True,
                "missing_fields": []
            })

        # Gate 4: Mandatory Next Action
        has_next_action = bool(demo.next_action_description and demo.next_action_description.strip() and demo.next_action_due_at)
        if not has_next_action:
            is_ready = False
            missing_fields.append("Mandatory Next Action and Scheduled Due Date")
            checklist.append({
                "gate_code": "DEMO_NEXT_ACTION",
                "name": "Mandatory Next Action",
                "description": "Follow-up activity description and due date required.",
                "status": "MISSING",
                "is_mandatory": True,
                "missing_fields": ["next_action_description", "next_action_due_at"]
            })
        else:
            checklist.append({
                "gate_code": "DEMO_NEXT_ACTION",
                "name": "Mandatory Next Action",
                "description": f"Next: '{demo.next_action_description}' due {demo.next_action_due_at.strftime('%Y-%m-%d')}.",
                "status": "COMPLETED",
                "is_mandatory": True,
                "missing_fields": []
            })

        return {
            "is_ready": is_ready,
            "status": "READY" if is_ready else "NOT_READY",
            "checklist": checklist,
            "missing_fields": missing_fields
        }


class DemoService:
    """
    Handles Demo lifecycle, use-case mapping, participant linking, feedback capture, and completion gates.
    """
    @staticmethod
    def create_or_init_demo(lead, account=None, discovery=None, product=None, user=None, scheduled_at=None, presenter=None):
        if not account:
            account = lead.account
        if not product:
            product = lead.primary_product or (discovery.product if discovery else None)
        if not scheduled_at:
            scheduled_at = timezone.now() + timedelta(days=2)

        tenant = (lead.tenant if lead else None) or (account.tenant if account else None)
        demo = Demo.objects.filter(lead=lead, account=account, discovery=discovery).first()
        created = False
        if not demo:
            demo = Demo.objects.create(
                lead=lead,
                account=account,
                discovery=discovery,
                product=product,
                presenter=presenter or user,
                scheduled_at=scheduled_at,
                status=DemoStatus.SCHEDULED,
                next_action_description=lead.next_action_description or "Conduct technical demonstration",
                next_action_due_at=lead.next_activity_due_at or (scheduled_at + timedelta(days=1)),
                tenant=tenant
            )
            created = True
        elif not demo.tenant and tenant:
            demo.tenant = tenant
            demo.save(update_fields=['tenant'])

        # Traceability: Auto-populate use case mappings from Discovery Problem Mappings without re-entry!
        if discovery:
            for dp in discovery.problems.filter(is_confirmed=True):
                for pm in dp.capability_mappings.all():
                    if not DemoUseCaseMapping.objects.filter(demo=demo, discovery_problem=dp, capability=pm.capability).exists():
                        DemoUseCaseMapping.objects.create(
                            demo=demo,
                            discovery_problem=dp,
                            capability=pm.capability,
                            module=pm.capability.module,
                            notes=f"Expected KPI: {pm.expected_kpi_impact}",
                            was_demonstrated=True,
                            tenant=tenant
                        )

            # Auto-populate customer participants from Discovery Stakeholders
            for sh in discovery.stakeholders.all():
                if not DemoParticipant.objects.filter(demo=demo, contact=sh.contact).exists():
                    DemoParticipant.objects.create(
                        demo=demo,
                        contact=sh.contact,
                        name=f"{sh.contact.first_name} {sh.contact.last_name or ''}".strip(),
                        email=sh.contact.email,
                        participant_type='CUSTOMER',
                        role_title=sh.decision_role or sh.role_name,
                        attended=True,
                        tenant=tenant
                    )

        # Include presenter as internal participant
        if demo.presenter:
            if not DemoParticipant.objects.filter(demo=demo, user=demo.presenter).exists():
                DemoParticipant.objects.create(
                    demo=demo,
                    user=demo.presenter,
                    name=demo.presenter.get_full_name() or demo.presenter.username,
                    email=demo.presenter.email,
                    participant_type='INTERNAL',
                    role_title='Solutions Presenter',
                    attended=True,
                    tenant=tenant
                )

        if created:
            AuditLog.objects.create(
                actor=user,
                actor_email=user.email if user else "system@texol.sa",
                actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
                action=AuditAction.CREATE,
                entity_type='Demo',
                entity_id=demo.id,
                changes_json={
                    "account": account.company_name,
                    "lead": str(lead.id),
                    "product": product.name if product else None,
                    "scheduled_at": scheduled_at.isoformat()
                }
            )

        return demo

    @staticmethod
    def add_participant(demo, contact_id=None, user_id=None, name='', email='', participant_type='CUSTOMER', role_title='', notes='', user=None):
        contact = Contact.objects.filter(id=contact_id).first() if contact_id else None
        target_user = User.objects.filter(id=user_id).first() if user_id else None

        if contact:
            name = name or f"{contact.first_name} {contact.last_name or ''}".strip()
            email = email or contact.email

        participant = DemoParticipant.objects.create(
            demo=demo,
            contact=contact,
            user=target_user,
            name=name,
            email=email,
            participant_type=participant_type,
            role_title=role_title,
            notes=notes,
            attended=True,
            tenant=demo.tenant
        )

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.UPDATE,
            entity_type='Demo',
            entity_id=demo.id,
            changes_json={"action": "add_participant", "name": name, "type": participant_type}
        )
        return participant

    @staticmethod
    def map_use_case(demo, discovery_problem_id=None, capability_id=None, module_id=None, notes='', was_demonstrated=True, user=None):
        dp = DiscoveryProblem.objects.filter(id=discovery_problem_id).first() if discovery_problem_id else None
        cap = ProductCapability.objects.filter(id=capability_id).first() if capability_id else None
        mod = ProductModule.objects.filter(id=module_id).first() if module_id else (cap.module if cap else None)

        mapping, _ = DemoUseCaseMapping.objects.update_or_create(
            demo=demo,
            discovery_problem=dp,
            capability=cap,
            defaults={
                'module': mod,
                'notes': notes,
                'was_demonstrated': was_demonstrated,
                'tenant': demo.tenant
            }
        )

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.UPDATE,
            entity_type='Demo',
            entity_id=demo.id,
            changes_json={
                "action": "map_use_case",
                "problem": dp.refined_statement if dp else None,
                "capability": cap.name if cap else None
            }
        )
        return mapping

    @staticmethod
    def complete_demo(demo, user=None, customer_feedback=None, objections_raised=None, customer_questions=None, customer_response=None, fit_assessment=None, next_action_description=None, next_action_due_at=None):
        if customer_feedback:
            demo.customer_feedback = customer_feedback
        if objections_raised is not None:
            demo.objections_raised = objections_raised
        if customer_questions is not None:
            demo.customer_questions = customer_questions
        if customer_response is not None:
            demo.customer_response = customer_response
        if fit_assessment:
            demo.fit_assessment = fit_assessment
        if next_action_description:
            demo.next_action_description = next_action_description
        if next_action_due_at:
            demo.next_action_due_at = next_action_due_at

        # Enforce Backend Readiness Gate
        readiness = DemoValidator.validate_readiness(demo)
        if not readiness["is_ready"]:
            missing_str = ", ".join(readiness["missing_fields"])
            raise ValidationError({
                "error": f"Demo completion is blocked. Missing mandatory items: {missing_str}",
                "checklist": readiness["checklist"],
                "missing_fields": readiness["missing_fields"]
            })

        demo.status = DemoStatus.COMPLETED
        demo.conducted_at = timezone.now()
        demo.save()

        # Update lead's next action
        if demo.lead and demo.next_action_description:
            demo.lead.next_action_description = demo.next_action_description
            demo.lead.next_activity_due_at = demo.next_action_due_at
            demo.lead.save(update_fields=['next_action_description', 'next_activity_due_at'])

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.UPDATE,
            entity_type='Demo',
            entity_id=demo.id,
            changes_json={
                "status": DemoStatus.COMPLETED,
                "fit_assessment": demo.fit_assessment,
                "next_action": demo.next_action_description
            }
        )

        return {
            "message": f"Demo for {demo.account.company_name} successfully COMPLETED with all gates verified.",
            "demo": demo
        }

    @staticmethod
    def mark_demo_not_required(demo, reason, user=None):
        if not reason or not reason.strip():
            raise ValidationError({"error": "A documented business reason is mandatory when marking Demo as Not Required."})

        # Verify whether product pipeline allows optional Demo
        product = demo.product or (demo.lead.primary_product if demo.lead else None)
        if product and StageRequirementChecker.is_demo_required(product):
            # If the pipeline marks Demo as strictly mandatory
            raise ValidationError({
                "error": f"Demo is configured as MANDATORY for {product.name} pipeline and cannot be waived without executive approval."
            })

        demo.status = DemoStatus.NOT_REQUIRED
        demo.not_required_reason = reason.strip()
        demo.save(update_fields=['status', 'not_required_reason'])

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.UPDATE,
            entity_type='Demo',
            entity_id=demo.id,
            changes_json={
                "status": DemoStatus.NOT_REQUIRED,
                "reason": reason.strip()
            }
        )

        return {
            "message": "Demo stage officially recorded as NOT REQUIRED with documented audit reason.",
            "demo": demo
        }


class POCValidator:
    """
    Validates readiness gate criteria for completing a Proof of Concept / Pilot.
    Mandatory minimums per specification:
      1. Scope: Clear pilot parameters and boundaries
      2. Owner: Assigned internal POC owner
      3. Start & End Dates: Valid trial duration
      4. Success Criteria: Agreed measurement criteria
      5. Results: Documented result metrics and summary
      6. Customer Feedback: Customer evaluation
      7. Next Action: Commercial next action
    """
    @staticmethod
    def validate_readiness(poc):
        checklist = []
        missing_fields = []
        is_ready = True

        # Gate 1: Scope
        has_scope = bool(poc.scope_description and poc.scope_description.strip())
        if not has_scope:
            is_ready = False
            missing_fields.append("Pilot Scope & Boundaries")
            checklist.append({
                "gate_code": "POC_SCOPE",
                "name": "Pilot Scope Description",
                "description": "Defined routes, users, outlets, and module parameters.",
                "status": "MISSING",
                "is_mandatory": True,
                "missing_fields": ["scope_description"]
            })
        else:
            checklist.append({
                "gate_code": "POC_SCOPE",
                "name": "Pilot Scope Description",
                "description": "Trial scope and geographical boundaries documented.",
                "status": "COMPLETED",
                "is_mandatory": True,
                "missing_fields": []
            })

        # Gate 2: Owner
        has_owner = bool(poc.owner)
        if not has_owner:
            is_ready = False
            missing_fields.append("Assigned POC Owner")
            checklist.append({
                "gate_code": "POC_OWNER",
                "name": "POC Owner",
                "description": "Technical/sales owner accountable for trial delivery.",
                "status": "MISSING",
                "is_mandatory": True,
                "missing_fields": ["owner"]
            })
        else:
            checklist.append({
                "gate_code": "POC_OWNER",
                "name": "POC Owner",
                "description": f"Managed by {poc.owner.get_full_name() or poc.owner.username}.",
                "status": "COMPLETED",
                "is_mandatory": True,
                "missing_fields": []
            })

        # Gate 3: Start and End Dates
        has_dates = bool(poc.start_date and poc.end_date and poc.start_date <= poc.end_date)
        if not has_dates:
            is_ready = False
            missing_fields.append("Valid Pilot Timeline (Start & End Dates)")
            checklist.append({
                "gate_code": "POC_DATES",
                "name": "Trial Timeline",
                "description": "Scheduled pilot start and completion dates.",
                "status": "MISSING",
                "is_mandatory": True,
                "missing_fields": ["start_date", "end_date"]
            })
        else:
            checklist.append({
                "gate_code": "POC_DATES",
                "name": "Trial Timeline",
                "description": f"{poc.start_date} to {poc.end_date}.",
                "status": "COMPLETED",
                "is_mandatory": True,
                "missing_fields": []
            })

        # Gate 4: Success Criteria
        has_criteria = poc.criteria_items.exists() or (isinstance(poc.success_criteria, list) and len(poc.success_criteria) > 0)
        if not has_criteria:
            is_ready = False
            missing_fields.append("Measurable Success Criteria")
            checklist.append({
                "gate_code": "POC_CRITERIA",
                "name": "Agreed Success Criteria",
                "description": "At least 1 measurable KPI target defining pilot success.",
                "status": "BLOCKED",
                "is_mandatory": True,
                "missing_fields": ["success_criteria"]
            })
        else:
            checklist.append({
                "gate_code": "POC_CRITERIA",
                "name": "Agreed Success Criteria",
                "description": f"{poc.criteria_items.count()} success criterion item(s) defined.",
                "status": "COMPLETED",
                "is_mandatory": True,
                "missing_fields": []
            })

        # Gate 5: Results Metrics
        has_results = bool(
            (isinstance(poc.result_metrics, dict) and len(poc.result_metrics) > 0) or
            (poc.results_summary and poc.results_summary.strip())
        )
        if not has_results:
            is_ready = False
            missing_fields.append("Measured Result Metrics & Target Variance")
            checklist.append({
                "gate_code": "POC_RESULTS",
                "name": "Measured Trial Results",
                "description": "Verified KPI outcomes achieved during pilot.",
                "status": "MISSING",
                "is_mandatory": True,
                "missing_fields": ["result_metrics"]
            })
        else:
            checklist.append({
                "gate_code": "POC_RESULTS",
                "name": "Measured Trial Results",
                "description": "Trial results verified and quantified.",
                "status": "COMPLETED",
                "is_mandatory": True,
                "missing_fields": []
            })

        # Gate 6: Customer Feedback
        has_feedback = bool(poc.customer_feedback and poc.customer_feedback.strip())
        if not has_feedback:
            is_ready = False
            missing_fields.append("Customer Trial Feedback & Evaluation")
            checklist.append({
                "gate_code": "POC_FEEDBACK",
                "name": "Customer Feedback",
                "description": "Documented client feedback following pilot conclusion.",
                "status": "MISSING",
                "is_mandatory": True,
                "missing_fields": ["customer_feedback"]
            })
        else:
            checklist.append({
                "gate_code": "POC_FEEDBACK",
                "name": "Customer Feedback",
                "description": "Customer feedback and sign-off recorded.",
                "status": "COMPLETED",
                "is_mandatory": True,
                "missing_fields": []
            })

        return {
            "is_ready": is_ready,
            "status": "READY" if is_ready else "NOT_READY",
            "checklist": checklist,
            "missing_fields": missing_fields
        }


class POCService:
    """
    Manages Proof of Concept trial lifecycle, baseline & target tracking, result verification, and completion gates.
    """
    @staticmethod
    def create_or_init_poc(lead, account=None, discovery=None, product=None, owner=None, scope_description='', geography='', users_count=5, start_date=None, end_date=None, user=None):
        if not account:
            account = lead.account
        if not product:
            product = lead.primary_product or (discovery.product if discovery else None)
        if not start_date:
            start_date = timezone.now().date()
        if not end_date:
            end_date = start_date + timedelta(days=30)
        if not owner:
            owner = user

        if not scope_description:
            scope_description = f"30-day operational pilot evaluating {product.name if product else 'VanForces'} across {users_count} van drivers."

        tenant = (lead.tenant if lead else None) or (account.tenant if account else None)
        poc = POC.objects.filter(lead=lead, account=account).first()
        created = False
        if not poc:
            poc = POC.objects.create(
                lead=lead,
                account=account,
                discovery=discovery,
                product=product,
                owner=owner,
                scope_description=scope_description,
                geography_coverage=geography or "Riyadh Central Distribution Fleet",
                users_count=users_count,
                start_date=start_date,
                end_date=end_date,
                status=POCStatus.PLANNED,
                next_action_description="Begin pilot onboarding and handheld terminal configuration",
                next_action_due_at=timezone.now() + timedelta(days=2),
                tenant=tenant
            )
            created = True
        elif not poc.tenant and tenant:
            poc.tenant = tenant
            poc.save(update_fields=['tenant'])

        # Traceability: Auto-seed Success Criteria from Discovery Problem expected KPIs
        if discovery:
            for dp in discovery.problems.filter(is_confirmed=True):
                for pm in dp.capability_mappings.all():
                    name_crit = f"{pm.capability.name} Efficiency"
                    if not POCSuccessCriterion.objects.filter(poc=poc, name=name_crit).exists():
                        POCSuccessCriterion.objects.create(
                            poc=poc,
                            name=name_crit,
                            category='OPERATIONAL',
                            measurement_baseline=dp.impact_description or "Legacy manual delay",
                            expected_target=pm.expected_kpi_impact or "Automated reconciliation",
                            is_met=False,
                            tenant=tenant
                        )

            # Auto-seed participants from Discovery Stakeholders
            for sh in discovery.stakeholders.all():
                if not POCParticipant.objects.filter(poc=poc, contact=sh.contact).exists():
                    POCParticipant.objects.create(
                        poc=poc,
                        contact=sh.contact,
                        name=f"{sh.contact.first_name} {sh.contact.last_name or ''}".strip(),
                        email=sh.contact.email,
                        participant_type='CUSTOMER',
                        role_title=sh.decision_role or sh.role_name,
                        tenant=tenant
                    )

        if created:
            AuditLog.objects.create(
                actor=user,
                actor_email=user.email if user else "system@texol.sa",
                actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
                action=AuditAction.CREATE,
                entity_type='POC',
                entity_id=poc.id,
                changes_json={
                    "account": account.company_name,
                    "lead": str(lead.id),
                    "product": product.name if product else None,
                    "scope": scope_description,
                    "duration_days": (end_date - start_date).days
                }
            )

        return poc

    @staticmethod
    def add_participant(poc, contact_id=None, user_id=None, name='', email='', participant_type='CUSTOMER', role_title='', notes='', user=None):
        contact = Contact.objects.filter(id=contact_id).first() if contact_id else None
        target_user = User.objects.filter(id=user_id).first() if user_id else None

        if contact:
            name = name or f"{contact.first_name} {contact.last_name or ''}".strip()
            email = email or contact.email

        participant = POCParticipant.objects.create(
            poc=poc,
            contact=contact,
            user=target_user,
            name=name,
            email=email,
            participant_type=participant_type,
            role_title=role_title,
            notes=notes,
            tenant=poc.tenant
        )

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.UPDATE,
            entity_type='POC',
            entity_id=poc.id,
            changes_json={"action": "add_participant", "name": name, "type": participant_type}
        )
        return participant

    @staticmethod
    def add_success_criterion(poc, name, baseline, target, actual='', is_met=False, category='PERFORMANCE', notes='', user=None):
        crit = POCSuccessCriterion.objects.create(
            poc=poc,
            name=name,
            category=category,
            measurement_baseline=baseline,
            expected_target=target,
            actual_result=actual,
            is_met=is_met,
            notes=notes,
            tenant=poc.tenant
        )

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.UPDATE,
            entity_type='POC',
            entity_id=poc.id,
            changes_json={"action": "add_success_criterion", "criterion": name, "target": target}
        )
        return crit

    @staticmethod
    def complete_poc(poc, user=None, result_metrics=None, results_summary=None, customer_feedback=None, is_successful=True, next_action_description=None, next_action_due_at=None):
        if result_metrics is not None:
            poc.result_metrics = result_metrics
        if results_summary:
            poc.results_summary = results_summary
        if customer_feedback:
            poc.customer_feedback = customer_feedback
        if next_action_description:
            poc.next_action_description = next_action_description
        if next_action_due_at:
            poc.next_action_due_at = next_action_due_at

        # Enforce Backend Readiness Gate
        readiness = POCValidator.validate_readiness(poc)
        if not readiness["is_ready"]:
            missing_str = ", ".join(readiness["missing_fields"])
            raise ValidationError({
                "error": f"POC completion is blocked. Missing mandatory items: {missing_str}",
                "checklist": readiness["checklist"],
                "missing_fields": readiness["missing_fields"]
            })

        poc.status = POCStatus.COMPLETED if is_successful else POCStatus.FAILED
        poc.completed_at = timezone.now()
        poc.save()

        # Update lead's next action
        if poc.lead and poc.next_action_description:
            poc.lead.next_action_description = poc.next_action_description
            poc.lead.next_activity_due_at = poc.next_action_due_at
            poc.lead.save(update_fields=['next_action_description', 'next_activity_due_at'])

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.UPDATE,
            entity_type='POC',
            entity_id=poc.id,
            changes_json={
                "status": poc.status,
                "is_successful": is_successful,
                "results_summary": poc.results_summary
            }
        )

        return {
            "message": f"POC for {poc.account.company_name} successfully {poc.status}.",
            "poc": poc
        }

    @staticmethod
    def mark_poc_not_required(poc, reason, user=None):
        if not reason or not reason.strip():
            raise ValidationError({"error": "A documented business reason is mandatory when waiving POC as Not Required."})

        # Verify whether product pipeline allows optional POC
        product = poc.product or (poc.lead.primary_product if poc.lead else None)
        if product and StageRequirementChecker.is_poc_required(product):
            raise ValidationError({
                "error": f"POC is configured as MANDATORY for {product.name} pipeline and cannot be waived without executive approval."
            })

        poc.status = POCStatus.NOT_REQUIRED
        poc.not_required_reason = reason.strip()
        poc.save(update_fields=['status', 'not_required_reason'])

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.UPDATE,
            entity_type='POC',
            entity_id=poc.id,
            changes_json={
                "status": POCStatus.NOT_REQUIRED,
                "reason": reason.strip()
            }
        )

        return {
            "message": "POC trial officially recorded as NOT REQUIRED with documented audit reason.",
            "poc": poc
        }
