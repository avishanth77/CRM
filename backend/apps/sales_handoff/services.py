import uuid
from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from django.core.exceptions import ValidationError, PermissionDenied
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()

from apps.sales_handoff.models import SQLHandoff, HandoffStatus
from apps.leads.models import Lead, LeadStatus, LeadProblem
from apps.products.models import Product
from apps.accounts.models import Account, Contact, ContactRoleType
from apps.discovery.models import Discovery, DiscoveryProblem, DiscoveryProblemMapping, DiscoveryStakeholder
from apps.evaluations.models import Demo, DemoStatus, POC, POCStatus
from apps.evaluations.services import StageRequirementChecker
from apps.audit_logging.models import AuditLog, AuditAction
from apps.workflows.models import StageHistory
from apps.pld_engine.models import PipelineType


class SQLReadinessValidator:
    """
    Evaluates the 9 mandatory qualification gates for SQL readiness:
      1. ICP Confirmed
      2. Business Problem Confirmed
      3. Problem Impact Documented
      4. Solution / Capability Identified
      5. Decision Maker / Buying Process Documented
      6. Timeline Documented
      7. Next Commercial Action Documented
      8. Opportunity Value Documented
      9. POC Result Documented (if POC required)
    """
    @classmethod
    def validate_readiness(cls, lead, estimated_value=None):
        checklist = []
        missing_gates = []
        what_we_know = []
        what_is_missing = []
        is_ready = True

        # Gate 1: ICP Confirmed
        latest_assessment = lead.assessments.filter(product=lead.primary_product).order_by('-assessed_at').first()
        icp_passed = False
        icp_evidence = ""
        if latest_assessment and (latest_assessment.icp_result == 'PASS' or getattr(latest_assessment, 'icp_knockout_passed', False) or getattr(latest_assessment, 'is_knockout_passed', False)):
            icp_passed = True
            fit_val = getattr(latest_assessment, 'icp_fit_score', getattr(latest_assessment, 'fit_score', 0))
            icp_evidence = f"ICP Fit Score: {fit_val}% (Status: PASS)"
        elif lead.account and (getattr(lead.account, 'target_tier', None) or getattr(lead.account, 'tier', None)):
            tier_val = getattr(lead.account, 'target_tier', None) or getattr(lead.account, 'tier', None)
            icp_passed = True
            icp_evidence = f"Target Account Tier {tier_val} ICP Approved"

        if not icp_passed:
            is_ready = False
            missing_gates.append("ICP Confirmed")
            what_is_missing.append("Account ICP qualification pending or failed knock-out rules")
            checklist.append({
                "gate_code": "ICP_CONFIRMED",
                "name": "ICP Confirmed",
                "status": "FAIL",
                "is_mandatory": True,
                "description": "Account must pass product ICP knock-out rules and fit threshold.",
                "evidence": icp_evidence or "No passing ICP assessment found"
            })
        else:
            what_we_know.append(f"ICP Confirmed: {icp_evidence}")
            checklist.append({
                "gate_code": "ICP_CONFIRMED",
                "name": "ICP Confirmed",
                "status": "PASS",
                "is_mandatory": True,
                "description": "Account matches target product ICP criteria.",
                "evidence": icp_evidence
            })

        # Gate 2: Business Problem Confirmed
        confirmed_problems = []
        latest_discovery = lead.discoveries.first()
        if latest_discovery:
            confirmed_problems = list(latest_discovery.problems.filter(is_confirmed=True))
        if not confirmed_problems:
            confirmed_problems = list(lead.recorded_problems.all())

        if not confirmed_problems:
            is_ready = False
            missing_gates.append("Business Problem Confirmed")
            what_is_missing.append("At least 1 confirmed customer business problem is required")
            checklist.append({
                "gate_code": "PROBLEM_CONFIRMED",
                "name": "Business Problem Confirmed",
                "status": "MISSING",
                "is_mandatory": True,
                "description": "Specific client operational or financial problem must be validated.",
                "evidence": "No confirmed business problems on file"
            })
        else:
            prob_names = [getattr(p, 'refined_statement', None) or (p.problem.name if hasattr(p, 'problem') and p.problem else str(p)) for p in confirmed_problems]
            what_we_know.append(f"{len(confirmed_problems)} Confirmed Problem(s): {', '.join(prob_names[:2])}")
            checklist.append({
                "gate_code": "PROBLEM_CONFIRMED",
                "name": "Business Problem Confirmed",
                "status": "PASS",
                "is_mandatory": True,
                "description": "Customer business problems confirmed and prioritized.",
                "evidence": f"{len(confirmed_problems)} problem(s) confirmed: {', '.join(prob_names[:2])}"
            })

        # Gate 3: Problem Impact Documented
        has_impact = False
        impact_evidence = ""
        for p in confirmed_problems:
            impact_desc = getattr(p, 'impact_description', None) or getattr(p, 'business_impact', None)
            if impact_desc and impact_desc.strip():
                has_impact = True
                impact_evidence = impact_desc
                break
        if not has_impact and latest_discovery and latest_discovery.business_impact_summary:
            has_impact = True
            impact_evidence = latest_discovery.business_impact_summary

        if not has_impact:
            is_ready = False
            missing_gates.append("Problem Impact Documented")
            what_is_missing.append("Quantified financial or operational business impact required")
            checklist.append({
                "gate_code": "IMPACT_DOCUMENTED",
                "name": "Problem Impact Documented",
                "status": "MISSING",
                "is_mandatory": True,
                "description": "Financial cost, operational delay, or revenue impact must be captured.",
                "evidence": "Missing documented business impact"
            })
        else:
            what_we_know.append(f"Business Impact: {impact_evidence[:80]}")
            checklist.append({
                "gate_code": "IMPACT_DOCUMENTED",
                "name": "Problem Impact Documented",
                "status": "PASS",
                "is_mandatory": True,
                "description": "Quantified business impact documented.",
                "evidence": impact_evidence
            })

        # Gate 4: Solution / Capability Identified
        has_capability = False
        cap_evidence = ""
        if latest_discovery and latest_discovery.is_product_mapping_complete:
            mappings_count = DiscoveryProblemMapping.objects.filter(discovery_problem__discovery=latest_discovery).count()
            if mappings_count > 0:
                has_capability = True
                cap_evidence = f"{mappings_count} capability mapping(s) completed in Discovery"
        if not has_capability:
            demo = lead.demos.filter(status=DemoStatus.COMPLETED).first()
            if demo and demo.use_cases.exists():
                has_capability = True
                cap_evidence = f"{demo.use_cases.count()} capability use-case(s) demonstrated"

        if not has_capability:
            is_ready = False
            missing_gates.append("Solution / Capability Identified")
            what_is_missing.append("Customer problems must map to specific product capabilities")
            checklist.append({
                "gate_code": "CAPABILITY_IDENTIFIED",
                "name": "Solution / Capability Identified",
                "status": "MISSING",
                "is_mandatory": True,
                "description": "Specific product capabilities addressing problems must be mapped.",
                "evidence": "No product capability mappings identified"
            })
        else:
            what_we_know.append(f"Product Capability: {cap_evidence}")
            checklist.append({
                "gate_code": "CAPABILITY_IDENTIFIED",
                "name": "Solution / Capability Identified",
                "status": "PASS",
                "is_mandatory": True,
                "description": "Product capabilities identified and validated.",
                "evidence": cap_evidence
            })

        # Gate 5: Decision Maker / Buying Process Documented
        has_dm = False
        dm_evidence = ""
        if lead.contact and lead.contact.role_type in [ContactRoleType.DECISION_MAKER, ContactRoleType.CHAMPION, ContactRoleType.FINANCE]:
            has_dm = True
            dm_evidence = f"Lead Contact: {lead.contact.first_name} {lead.contact.last_name or ''} ({lead.contact.get_role_type_display()})"
        elif latest_discovery:
            dm_stakeholder = latest_discovery.stakeholders.filter(decision_role__in=['DECISION_MAKER', 'ECONOMIC_BUYER']).first()
            if dm_stakeholder:
                has_dm = True
                dm_evidence = f"Stakeholder: {dm_stakeholder.contact.first_name} ({dm_stakeholder.get_decision_role_display()})"
            elif latest_discovery.decision_process_notes and latest_discovery.decision_process_notes.strip():
                has_dm = True
                dm_evidence = f"Buying Process: {latest_discovery.decision_process_notes[:60]}"

        if not has_dm:
            is_ready = False
            missing_gates.append("Decision Maker / Buying Process Documented")
            what_is_missing.append("Economic decision maker or buying committee process must be recorded")
            checklist.append({
                "gate_code": "DECISION_MAKER_DOCUMENTED",
                "name": "Decision Maker / Buying Process Documented",
                "status": "MISSING",
                "is_mandatory": True,
                "description": "Authorized economic buyer or formal decision-making process required.",
                "evidence": "No decision maker identified"
            })
        else:
            what_we_know.append(f"Decision Access: {dm_evidence}")
            checklist.append({
                "gate_code": "DECISION_MAKER_DOCUMENTED",
                "name": "Decision Maker / Buying Process Documented",
                "status": "PASS",
                "is_mandatory": True,
                "description": "Decision maker access and buying process verified.",
                "evidence": dm_evidence
            })

        # Gate 6: Timeline Documented
        has_timeline = False
        timeline_evidence = ""
        if latest_discovery and (latest_discovery.expected_decision_date or latest_discovery.expected_implementation_date):
            has_timeline = True
            dt_str = latest_discovery.expected_decision_date.strftime('%Y-%m-%d') if latest_discovery.expected_decision_date else ''
            timeline_evidence = f"Expected Decision: {dt_str}"
        elif latest_discovery and latest_discovery.timeline_notes and latest_discovery.timeline_notes.strip():
            has_timeline = True
            timeline_evidence = latest_discovery.timeline_notes[:60]
        elif lead.timeline_expectation and lead.timeline_expectation.strip():
            has_timeline = True
            timeline_evidence = lead.timeline_expectation

        if not has_timeline:
            is_ready = False
            missing_gates.append("Timeline Documented")
            what_is_missing.append("Expected purchase decision date or implementation timeline required")
            checklist.append({
                "gate_code": "TIMELINE_DOCUMENTED",
                "name": "Timeline Documented",
                "status": "MISSING",
                "is_mandatory": True,
                "description": "Procurement or go-live timeline expectation must be on file.",
                "evidence": "No timeline documented"
            })
        else:
            what_we_know.append(f"Timeline: {timeline_evidence}")
            checklist.append({
                "gate_code": "TIMELINE_DOCUMENTED",
                "name": "Timeline Documented",
                "status": "PASS",
                "is_mandatory": True,
                "description": "Procurement decision timeline recorded.",
                "evidence": timeline_evidence
            })

        # Gate 7: Next Commercial Action Documented
        has_next_action = bool(lead.next_action_description and lead.next_action_description.strip() and lead.next_activity_due_at)
        if not has_next_action:
            is_ready = False
            missing_gates.append("Next Commercial Action Documented")
            what_is_missing.append("Future next action description and scheduled due date are mandatory")
            checklist.append({
                "gate_code": "NEXT_ACTION_DOCUMENTED",
                "name": "Next Commercial Action Documented",
                "status": "MISSING",
                "is_mandatory": True,
                "description": "Must have an active scheduled commercial activity with future due date.",
                "evidence": "No next activity scheduled"
            })
        else:
            due_str = lead.next_activity_due_at.strftime('%Y-%m-%d')
            what_we_know.append(f"Next Commercial Action: '{lead.next_action_description}' (Due: {due_str})")
            checklist.append({
                "gate_code": "NEXT_ACTION_DOCUMENTED",
                "name": "Next Commercial Action Documented",
                "status": "PASS",
                "is_mandatory": True,
                "description": "Future commercial follow-up scheduled.",
                "evidence": f"'{lead.next_action_description}' due {due_str}"
            })

        # Gate 8: Opportunity Value Documented
        val = estimated_value if estimated_value is not None else lead.estimated_opportunity_value
        if val is None or Decimal(str(val)) <= 0:
            # Check if handoff exists with value
            handoff = getattr(lead, 'sql_handoffs', None)
            if handoff and handoff.filter(estimated_value__gt=0).exists():
                val = handoff.filter(estimated_value__gt=0).first().estimated_value

        has_value = bool(val and Decimal(str(val)) > 0)
        if not has_value:
            is_ready = False
            missing_gates.append("Opportunity Value Documented")
            what_is_missing.append("Estimated opportunity value ($ / SAR) is required for Sales Acceptance")
            checklist.append({
                "gate_code": "OPPORTUNITY_VALUE_DOCUMENTED",
                "name": "Opportunity Value Documented",
                "status": "MISSING",
                "is_mandatory": True,
                "description": "Estimated commercial deal value must be specified (> 0).",
                "evidence": "Estimated value is 0 or unassigned"
            })
        else:
            what_we_know.append(f"Opportunity Value: {val} USD")
            checklist.append({
                "gate_code": "OPPORTUNITY_VALUE_DOCUMENTED",
                "name": "Opportunity Value Documented",
                "status": "PASS",
                "is_mandatory": True,
                "description": "Commercial contract value estimated.",
                "evidence": f"{val} USD"
            })

        # Gate 9: POC Result Documented IF POC Was Required
        is_poc_required = StageRequirementChecker.is_poc_required(lead.primary_product)
        poc = lead.pocs.first()
        poc_satisfied = True
        poc_evidence = ""

        if is_poc_required:
            if not poc or poc.status != POCStatus.COMPLETED:
                is_ready = False
                poc_satisfied = False
                cur_st = poc.status if poc else "NOT_INITIATED"
                missing_gates.append("Required POC Result Documented")
                what_is_missing.append(f"POC trial is MANDATORY for {lead.primary_product.name} and must be COMPLETED with verified results (current status: {cur_st})")
                checklist.append({
                    "gate_code": "POC_RESULT_DOCUMENTED",
                    "name": "POC Result Documented",
                    "status": "BLOCKED",
                    "is_mandatory": True,
                    "description": "Mandatory POC pilot trial must achieve completed verified results.",
                    "evidence": f"POC status: {cur_st}"
                })
            else:
                poc_evidence = f"POC COMPLETED ({poc.results_summary or 'Verified KPIs'})"
                what_we_know.append(f"POC Outcome: {poc_evidence}")
                checklist.append({
                    "gate_code": "POC_RESULT_DOCUMENTED",
                    "name": "POC Result Documented",
                    "status": "PASS",
                    "is_mandatory": True,
                    "description": "Mandatory pilot trial completed with verified customer benchmarks.",
                    "evidence": poc_evidence
                })
        else:
            # POC is optional: if present, must be either COMPLETED or NOT_REQUIRED
            if poc and poc.status not in [POCStatus.COMPLETED, POCStatus.NOT_REQUIRED]:
                is_ready = False
                poc_satisfied = False
                missing_gates.append("Active POC Resolution")
                what_is_missing.append(f"Optional POC trial was initiated and must be COMPLETED or marked NOT_REQUIRED with reason (current status: {poc.status})")
                checklist.append({
                    "gate_code": "POC_RESULT_DOCUMENTED",
                    "name": "POC Result Documented",
                    "status": "BLOCKED",
                    "is_mandatory": True,
                    "description": "Active pilot trial must conclude before SQL handoff.",
                    "evidence": f"POC in progress: {poc.status}"
                })
            elif poc and poc.status == POCStatus.NOT_REQUIRED:
                poc_evidence = f"Waived as NOT REQUIRED: {poc.not_required_reason}"
                what_we_know.append(f"POC Status: {poc_evidence}")
                checklist.append({
                    "gate_code": "POC_RESULT_DOCUMENTED",
                    "name": "POC Result Documented",
                    "status": "PASS",
                    "is_mandatory": False,
                    "description": "Optional pilot trial waived with documented governance reason.",
                    "evidence": poc_evidence
                })
            elif poc and poc.status == POCStatus.COMPLETED:
                poc_evidence = f"Trial COMPLETED ({poc.results_summary or 'Success'})"
                what_we_know.append(f"POC Status: {poc_evidence}")
                checklist.append({
                    "gate_code": "POC_RESULT_DOCUMENTED",
                    "name": "POC Result Documented",
                    "status": "PASS",
                    "is_mandatory": False,
                    "description": "Pilot trial concluded with documented results.",
                    "evidence": poc_evidence
                })
            else:
                what_we_know.append("POC Trial: Optional stage not required for this product")
                checklist.append({
                    "gate_code": "POC_RESULT_DOCUMENTED",
                    "name": "POC Result Documented",
                    "status": "PASS",
                    "is_mandatory": False,
                    "description": "Pilot trial is optional and was not mandated.",
                    "evidence": "Optional for pipeline configuration"
                })

        return {
            "is_ready": is_ready,
            "status": "READY" if is_ready else "NOT_READY",
            "checklist": checklist,
            "missing_gates": missing_gates,
            "what_we_know": what_we_know,
            "what_is_missing": what_is_missing
        }


class SQLHandoffService:
    """
    Manages the complete SQL Readiness, Submission, Sales Acceptance SLA, Ownership Transfer, and Rejection lifecycle.
    """
    AUTHORIZED_OVERRIDE_ROLES = [
        'ADMIN', 'SUPERADMIN', 'SYSTEM_ADMIN', 'SALES_DIRECTOR', 'VP_SALES',
        'HEAD_OF_SALES', 'PLD_DIRECTOR', 'MANAGER', 'SALES_MANAGER', 'MANAGEMENT'
    ]

    @classmethod
    def check_override_permission(cls, user):
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.is_staff:
            return True
        user_role = getattr(user, 'role', '').upper()
        return (
            user_role in cls.AUTHORIZED_OVERRIDE_ROLES or
            'MANAGER' in user_role or
            user_role in ['MANAGEMENT', 'ADMIN', 'SALES_MANAGER']
        )

    @classmethod
    def submit_sql(cls, lead, user, assigned_sales_owner=None, estimated_value=None, currency='USD', sla_hours=48, is_override=False, override_reason=None):
        """
        Submits a qualified Lead for formal Sales Acceptance.
        Validates the 9 qualification gates. If incomplete, strictly blocks submission unless an authorized override is applied.
        """
        # 1. Prevent duplicate active submissions
        existing_pending = SQLHandoff.objects.filter(lead=lead, status=HandoffStatus.PENDING).first()
        if existing_pending:
            raise ValidationError(f"An active pending SQL Handoff (#{str(existing_pending.id)[:8]}) already exists for this lead.")

        # Update estimated value on lead if provided
        if estimated_value is not None:
            lead.estimated_opportunity_value = Decimal(str(estimated_value))
            lead.save(update_fields=['estimated_opportunity_value'])

        # 2. Enforce Backend Readiness Validation
        readiness = SQLReadinessValidator.validate_readiness(lead, estimated_value=lead.estimated_opportunity_value)

        original_gate_results = {}
        if not readiness["is_ready"]:
            if not is_override:
                missing_str = ", ".join(readiness["missing_gates"])
                raise ValidationError(f"SQL Readiness blocked: Mandatory qualification gates incomplete. Missing: {missing_str}")

            # 3. Handle Authorized Override Governance
            if not cls.check_override_permission(user):
                raise PermissionDenied("User does not have authorization to approve an SQL readiness override.")

            if not override_reason or not override_reason.strip():
                raise ValidationError("An auditable override reason is mandatory when bypassing incomplete qualification gates.")

            original_gate_results = {
                "missing_gates": readiness["missing_gates"],
                "checklist": readiness["checklist"],
                "bypassed_at": timezone.now().isoformat()
            }

        # 4. Resolve assigned sales owner
        if not assigned_sales_owner:
            assigned_sales_owner = User.objects.filter(role__in=['ACCOUNT_EXECUTIVE', 'SALES_REP', 'SALES_DIRECTOR']).first() or user

        # 5. Create SQL Handoff Record
        submitted_at = timezone.now()
        sla_expires_at = submitted_at + timedelta(hours=sla_hours)
        final_val = lead.estimated_opportunity_value or Decimal('0.00')

        handoff = SQLHandoff.objects.create(
            lead=lead,
            account=lead.account,
            product=lead.primary_product,
            pld_executive=user,
            assigned_sales_owner=assigned_sales_owner,
            estimated_value=final_val,
            currency=currency,
            readiness_status='OVERRIDDEN' if is_override else 'READY',
            qualification_evidence={
                "what_we_know": readiness["what_we_know"],
                "what_is_missing": readiness["what_is_missing"]
            },
            gate_audit_results=readiness["checklist"],
            is_override=is_override,
            override_reason=override_reason.strip() if override_reason else None,
            override_approved_by=user if is_override else None,
            override_approved_at=timezone.now() if is_override else None,
            original_gate_results=original_gate_results,
            sla_duration_hours=sla_hours,
            sql_ready_at=submitted_at,
            submitted_at=submitted_at,
            sla_expires_at=sla_expires_at,
            status=HandoffStatus.PENDING,
            tenant=lead.tenant
        )

        # 6. Update Lead stage to SQL_READY
        from_stage = lead.current_stage
        config = lead.primary_product.configurations.filter(status='PUBLISHED').first() or lead.primary_product.configurations.first()
        target_stage = None
        if config:
            target_stage = config.stages.filter(stage_code__iexact='SQL_READY').first()

        if target_stage:
            lead.current_stage = target_stage
            lead.save(update_fields=['current_stage'])

        # 7. Record Stage History
        StageHistory.objects.create(
            record_type='LEAD',
            record_id=lead.id,
            from_stage=from_stage,
            to_stage=target_stage or from_stage,
            transition_reason="Qualified for Sales Acceptance Handoff" + (f" (Authorized Override: {override_reason})" if is_override else ""),
            is_override=is_override,
            override_approved_by=user if is_override else None,
            changed_by=user,
            tenant=lead.tenant
        )

        # 8. Record Universal Audit Log
        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.CREATE,
            entity_type='SQLHandoff',
            entity_id=handoff.id,
            changes_json={
                "lead": str(lead.id),
                "account": lead.account.company_name,
                "product": lead.primary_product.name,
                "estimated_value": str(final_val),
                "assigned_sales_owner": assigned_sales_owner.get_full_name() or assigned_sales_owner.username,
                "is_override": is_override,
                "override_reason": override_reason
            }
        )

        return handoff

    @classmethod
    def accept_sql(cls, handoff, user, new_sales_owner=None):
        """
        Receiving Sales owner accepts the SQL handoff.
        Transfers ownership, stops SLA timer, marks handoff ACCEPTED, and creates the Opportunity.
        """
        if handoff.status != HandoffStatus.PENDING:
            raise ValidationError(f"Cannot accept SQL handoff with status '{handoff.status}'. Only PENDING handoffs can be accepted.")

        lead = handoff.lead
        previous_owner = lead.owner
        new_owner = new_sales_owner or handoff.assigned_sales_owner or user

        # 1. Update Handoff record
        decision_time = timezone.now()
        handoff.status = HandoffStatus.ACCEPTED
        handoff.decision_date = decision_time
        handoff.previous_owner = previous_owner
        handoff.assigned_sales_owner = new_owner
        handoff.ownership_transferred_at = decision_time
        handoff.save(update_fields=['status', 'decision_date', 'previous_owner', 'assigned_sales_owner', 'ownership_transferred_at'])

        # 2. Ownership Transfer on Lead
        lead.owner = new_owner
        lead.status = LeadStatus.CONVERTED
        lead.save(update_fields=['owner', 'status'])

        # 3. Create Commercial Opportunity via OpportunityService
        from apps.opportunities.services import OpportunityService
        opp = OpportunityService.create_from_accepted_sql(handoff, user=user, owner=new_owner)

        # 4. Record Stage History
        StageHistory.objects.create(
            record_type='LEAD',
            record_id=lead.id,
            from_stage=lead.current_stage,
            to_stage=lead.current_stage,
            transition_reason=f"Sales Accepted SQL Handoff. Converted to Opportunity #{str(opp.id)[:8]}.",
            changed_by=user,
            tenant=lead.tenant
        )

        # 5. Universal Audit Log
        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.SALES_ACCEPT,
            entity_type='SQLHandoff',
            entity_id=handoff.id,
            changes_json={
                "action": "accept_sql",
                "previous_owner": previous_owner.username if previous_owner else "None",
                "new_owner": new_owner.username if new_owner else "None",
                "opportunity_id": str(opp.id),
                "total_contract_value": str(opp.total_contract_value)
            }
        )

        return {
            "handoff": handoff,
            "opportunity": opp,
            "message": f"SQL Handoff accepted. Opportunity #{str(opp.id)[:8]} successfully created."
        }

    @classmethod
    def reject_sql(cls, handoff, reason, return_target='NURTURE', user=None):
        """
        Receiving Sales owner declines the SQL handoff with a mandatory rejection reason.
        Reverts pursuit to configured return state without creating an opportunity.
        """
        if handoff.status != HandoffStatus.PENDING:
            raise ValidationError(f"Cannot reject SQL handoff with status '{handoff.status}'. Only PENDING handoffs can be rejected.")

        if not reason or not reason.strip():
            raise ValidationError("Rejection reason is mandatory when declining an SQL handoff.")

        return_target = (return_target or 'NURTURE').upper()
        decision_time = timezone.now()

        handoff.status = HandoffStatus.REJECTED
        handoff.decision_date = decision_time
        handoff.rejection_reason = reason.strip()
        handoff.save(update_fields=['status', 'decision_date', 'rejection_reason'])

        # Return lead to target state
        lead = handoff.lead
        from_stage = lead.current_stage
        target_stage = None
        config = handoff.product.configurations.filter(status='PUBLISHED').first()

        if return_target == 'DISCOVERY':
            lead.status = LeadStatus.ACTIVE
            if config:
                target_stage = config.stages.filter(stage_code__iexact='DISCOVERY').first()
        elif return_target == 'PLD':
            lead.status = LeadStatus.ACTIVE
            if config:
                target_stage = config.stages.filter(stage_code__in=['PLD_QUALIFIED', 'QUALIFICATION']).first()
        else:
            return_target = 'NURTURE'
            lead.status = LeadStatus.NURTURE
            lead.nurture_reason = f"Sales Rejected SQL: {reason.strip()}"

        if target_stage:
            lead.current_stage = target_stage

        lead.save(update_fields=['status', 'current_stage', 'nurture_reason'])

        # Record Stage History Rollback
        StageHistory.objects.create(
            record_type='LEAD',
            record_id=lead.id,
            from_stage=from_stage,
            to_stage=target_stage or from_stage,
            transition_reason=f"Sales Rejected SQL Handoff: {reason.strip()} [Returned to {return_target}]",
            is_override=True,
            changed_by=user,
            tenant=lead.tenant
        )

        # Universal Audit Log
        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.SALES_REJECT,
            entity_type='SQLHandoff',
            entity_id=handoff.id,
            changes_json={
                "action": "reject_sql",
                "rejection_reason": reason.strip(),
                "return_target": return_target
            }
        )

        return {
            "handoff": handoff,
            "return_target": return_target,
            "message": f"SQL Handoff rejected and returned to {return_target}."
        }
