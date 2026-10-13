from django.utils import timezone
from django.core.exceptions import ValidationError
from apps.discovery.models import (
    Discovery, DiscoveryProblem, DiscoveryProblemMapping,
    DiscoveryStakeholder, DiscoveryStatus
)
from apps.products.models import Problem, ProductCapability, ProblemCapability
from apps.accounts.models import Contact
from apps.audit_logging.models import AuditLog, AuditAction


class DiscoveryValidator:
    """
    Validates Discovery readiness against TEXOL CRM Section 13 & 14 gates:
    - Current process documented
    - Confirmed problem documented
    - Business impact captured
    - Stakeholders identified
    - EVERY confirmed problem must have at least one Product Capability mapping
    - Future next action scheduled
    """

    @staticmethod
    def validate_readiness(discovery: Discovery) -> dict:
        confirmed_problems = discovery.problems.filter(is_confirmed=True).select_related('problem').prefetch_related('capability_mappings')
        
        # 1. Current Process Check
        has_current_process = bool(discovery.current_process_notes and discovery.current_process_notes.strip())

        # 2. Confirmed Problems Check
        has_problems = confirmed_problems.exists()

        # 3. Business Impact Check
        has_overall_impact = bool(discovery.business_impact_summary and discovery.business_impact_summary.strip())
        problems_with_impact = [p for p in confirmed_problems if bool(p.impact_description and p.impact_description.strip())]
        has_business_impact = has_overall_impact or (has_problems and len(problems_with_impact) == len(confirmed_problems))

        # 4. Stakeholders Check
        has_stakeholder_records = discovery.stakeholders.exists()
        has_stakeholder_notes = bool(discovery.stakeholders_involved_notes and discovery.stakeholders_involved_notes.strip())
        has_stakeholders = has_stakeholder_records or has_stakeholder_notes

        # 5. Product Capability Mapping Check (CRITICAL: Every confirmed problem must be mapped)
        unmapped_problems = []
        for dp in confirmed_problems:
            if not dp.capability_mappings.exists():
                unmapped_problems.append({
                    "problem_id": str(dp.id),
                    "problem_name": dp.problem.name
                })
        has_product_mapping = (has_problems and len(unmapped_problems) == 0)

        # 6. Next Action Check
        has_next_action = bool(
            (discovery.next_action_description and discovery.next_activity_due_at) or
            (discovery.lead and discovery.lead.next_action_description and discovery.lead.next_activity_due_at)
        )

        # Build checklist
        checklist = [
            {
                "gate_code": "CURRENT_PROCESS",
                "gate_name": "Current Process Documented",
                "name": "Current Process Documented",
                "description": "Operational workflow & systems documented" if has_current_process else "Current process notes are required",
                "status": "COMPLETED" if has_current_process else "MISSING",
                "is_mandatory": True,
                "satisfied": has_current_process,
                "details": "Operational workflow & systems documented" if has_current_process else "Current process notes are required",
                "missing_fields": [] if has_current_process else ["Section 1 Operational Process Notes"]
            },
            {
                "gate_code": "CONFIRMED_PROBLEMS",
                "gate_name": "Documented Business Problems",
                "name": "Documented Business Problems",
                "description": f"{confirmed_problems.count()} confirmed problem(s) documented" if has_problems else "At least 1 confirmed problem required",
                "status": "COMPLETED" if has_problems else "MISSING",
                "is_mandatory": True,
                "satisfied": has_problems,
                "details": f"{confirmed_problems.count()} confirmed problem(s) documented" if has_problems else "At least 1 confirmed problem required",
                "missing_fields": [] if has_problems else ["Confirmed Business Problems"]
            },
            {
                "gate_code": "BUSINESS_IMPACT",
                "gate_name": "Business Impact Captured",
                "name": "Business Impact Captured",
                "description": "Financial & operational impact captured" if has_business_impact else "Problem business impact description required",
                "status": "COMPLETED" if has_business_impact else "MISSING",
                "is_mandatory": True,
                "satisfied": has_business_impact,
                "details": "Financial & operational impact captured" if has_business_impact else "Problem business impact description required",
                "missing_fields": [] if has_business_impact else ["Quantified Business Impact Summary"]
            },
            {
                "gate_code": "STAKEHOLDERS",
                "gate_name": "Stakeholders & Buying Committee",
                "name": "Stakeholders & Buying Committee",
                "description": f"{discovery.stakeholders.count()} stakeholder(s) identified" if has_stakeholder_records else ("Stakeholder notes captured" if has_stakeholders else "At least 1 stakeholder or committee note required"),
                "status": "COMPLETED" if has_stakeholders else "MISSING",
                "is_mandatory": True,
                "satisfied": has_stakeholders,
                "details": f"{discovery.stakeholders.count()} stakeholder(s) identified" if has_stakeholder_records else ("Stakeholder notes captured" if has_stakeholders else "At least 1 stakeholder or committee note required"),
                "missing_fields": [] if has_stakeholders else ["Stakeholder Records or Committee Notes"]
            },
            {
                "gate_code": "PRODUCT_MAPPING",
                "gate_name": "Product Capability Mapping",
                "name": "Product Capability Mapping",
                "description": "All confirmed problems mapped to product capabilities" if has_product_mapping else (
                    f"{len(unmapped_problems)} problem(s) unmapped" if unmapped_problems else "No problems to map"
                ),
                "status": "COMPLETED" if has_product_mapping else "MISSING",
                "is_mandatory": True,
                "satisfied": has_product_mapping,
                "details": "All confirmed problems mapped to product capabilities" if has_product_mapping else (
                    f"{len(unmapped_problems)} problem(s) unmapped: {', '.join([p['problem_name'] for p in unmapped_problems])}" if unmapped_problems else "No problems to map"
                ),
                "missing_fields": [p['problem_name'][:45] + ('...' if len(p['problem_name']) > 45 else '') for p in unmapped_problems] if unmapped_problems else ([] if has_product_mapping else ["Problem Capability Mapping"])
            },
            {
                "gate_code": "NEXT_ACTION",
                "gate_name": "Scheduled Next Action",
                "name": "Scheduled Next Action",
                "description": "Future action and due date scheduled" if has_next_action else "Future next action and due date required",
                "status": "COMPLETED" if has_next_action else "MISSING",
                "is_mandatory": True,
                "satisfied": has_next_action,
                "details": "Future action and due date scheduled" if has_next_action else "Future next action and due date required",
                "missing_fields": [] if has_next_action else ["Scheduled Next Action & Due Date"]
            }
        ]

        all_passed = all(item["satisfied"] for item in checklist)

        return {
            "is_ready": all_passed,
            "status": "READY" if all_passed else "NOT_READY",
            "checklist": checklist,
            "unmapped_problems": unmapped_problems
        }


class DiscoveryService:
    """
    Orchestrates Discovery lifecycle, problem carry-forward, capability mapping, and completion.
    """

    @staticmethod
    def carry_forward_lead_problems(discovery: Discovery) -> int:
        """
        TEXOL SPECIFICATION MANDATE:
        Existing Lead Problems MUST automatically carry into Discovery without re-entry.
        Original LeadProblem information is referenced and preserved.
        """
        if not discovery.lead:
            return 0

        created_count = 0
        lead_problems = discovery.lead.recorded_problems.all().select_related('problem')

        for lp in lead_problems:
            dp, created = DiscoveryProblem.objects.get_or_create(
                discovery=discovery,
                problem=lp.problem,
                defaults={
                    'lead_problem': lp,
                    'refined_statement': lp.problem.name,
                    'category': lp.category,
                    'severity': lp.severity,
                    'frequency': lp.frequency,
                    'impact_description': lp.business_impact or lp.notes or 'Documented during PLD Qualification',
                    'affected_teams': lp.affected_users,
                    'evidence': lp.evidence,
                    'notes': lp.notes,
                    'is_confirmed': True
                }
            )

            if created:
                created_count += 1

                # Auto-seed default mappings from master library if defined
                target_product = discovery.product or discovery.lead.primary_product
                if target_product:
                    defaults = ProblemCapability.objects.filter(
                        problem=lp.problem,
                        capability__product=target_product
                    ).select_related('capability')

                    for d in defaults:
                        DiscoveryProblemMapping.objects.get_or_create(
                            discovery_problem=dp,
                            capability=d.capability,
                            defaults={
                                'expected_kpi_impact': d.expected_kpi_impact or 'Targeted operational efficiency gain'
                            }
                        )

        return created_count

    @staticmethod
    def map_problem_capability(discovery_problem: DiscoveryProblem, capability: ProductCapability, expected_kpi_impact: str = '', notes: str = '', user=None):
        """
        Maps a DiscoveryProblem to a ProductCapability (many-to-many relationship).
        """
        mapping, created = DiscoveryProblemMapping.objects.update_or_create(
            discovery_problem=discovery_problem,
            capability=capability,
            defaults={
                'expected_kpi_impact': expected_kpi_impact,
                'notes': notes
            }
        )

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.UPDATE if not created else AuditAction.CREATE,
            entity_type='DiscoveryProblemMapping',
            entity_id=mapping.id,
            changes_json={
                "problem": discovery_problem.problem.name,
                "capability": capability.name,
                "expected_kpi_impact": expected_kpi_impact
            }
        )

        # Check if discovery now has all problems mapped
        readiness = DiscoveryValidator.validate_readiness(discovery_problem.discovery)
        mapping_gate_passed = len(readiness["unmapped_problems"]) == 0
        if mapping_gate_passed != discovery_problem.discovery.is_product_mapping_complete:
            discovery_problem.discovery.is_product_mapping_complete = mapping_gate_passed
            discovery_problem.discovery.save(update_fields=['is_product_mapping_complete'])

        return mapping

    @staticmethod
    def unmap_problem_capability(discovery_problem: DiscoveryProblem, capability_id: str, user=None):
        """
        Removes a capability mapping from a discovery problem.
        """
        mapping = DiscoveryProblemMapping.objects.filter(
            discovery_problem=discovery_problem,
            capability_id=capability_id
        ).first()

        if mapping:
            AuditLog.objects.create(
                actor=user,
                actor_email=user.email if user else "system@texol.sa",
                actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
                action=AuditAction.DELETE,
                entity_type='DiscoveryProblemMapping',
                entity_id=mapping.id,
                changes_json={
                    "deleted": True,
                    "problem": discovery_problem.problem.name,
                    "capability": mapping.capability.name
                }
            )
            mapping.delete()

        # Update mapping gate status on discovery
        readiness = DiscoveryValidator.validate_readiness(discovery_problem.discovery)
        mapping_gate_passed = len(readiness["unmapped_problems"]) == 0
        discovery_problem.discovery.is_product_mapping_complete = mapping_gate_passed
        discovery_problem.discovery.save(update_fields=['is_product_mapping_complete'])

    @staticmethod
    def complete_discovery(discovery: Discovery, user=None) -> dict:
        """
        Completes the Discovery workspace after verifying the mandatory gates.
        """
        readiness = DiscoveryValidator.validate_readiness(discovery)

        if not readiness["is_ready"]:
            failed_gates = [c["gate_name"] + f" ({c['details']})" for c in readiness["checklist"] if not c["satisfied"]]
            raise ValidationError({
                "error": "Discovery cannot be completed because mandatory gate requirements are missing.",
                "missing_requirements": failed_gates,
                "checklist": readiness["checklist"],
                "unmapped_problems": readiness["unmapped_problems"]
            })

        old_status = discovery.status
        discovery.status = DiscoveryStatus.COMPLETED
        discovery.is_product_mapping_complete = True
        discovery.completed_at = timezone.now()
        discovery.save(update_fields=['status', 'is_product_mapping_complete', 'completed_at'])

        demo_id = None
        if discovery.lead:
            # Advance lead pipeline stage to DEMO if available
            from apps.pld_engine.models import PipelineStage, PipelineType
            demo_stage = PipelineStage.objects.filter(
                pipeline_type=PipelineType.PURSUIT,
                stage_code='DEMO'
            ).first()
            if not demo_stage:
                demo_stage = PipelineStage.objects.filter(
                    stage_name__icontains='Demo'
                ).first()
            if demo_stage and discovery.lead.current_stage != demo_stage:
                discovery.lead.current_stage = demo_stage
                discovery.lead.save(update_fields=['current_stage'])

            # Automatically initialize Demo session with all mapped use cases carried over
            from apps.evaluations.services import DemoService
            demo = DemoService.create_or_init_demo(
                lead=discovery.lead,
                account=discovery.account,
                discovery=discovery,
                product=discovery.product or discovery.lead.primary_product,
                user=user
            )
            if demo:
                demo_id = str(demo.id)

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.UPDATE,
            entity_type='Discovery',
            entity_id=discovery.id,
            changes_json={
                "status": {"old": old_status, "new": DiscoveryStatus.COMPLETED},
                "completed_at": discovery.completed_at.isoformat(),
                "is_product_mapping_complete": True,
                "demo_id": demo_id
            }
        )

        return {
            "message": "Discovery completed successfully with all problem-to-capability mappings verified.",
            "discovery_id": str(discovery.id),
            "completed_at": discovery.completed_at.isoformat(),
            "demo_id": demo_id
        }
