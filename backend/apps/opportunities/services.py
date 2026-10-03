import uuid
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()

from apps.opportunities.models import (
    Opportunity, OpportunityProduct, OpportunityModule,
    OpportunityCapability, OpportunityType, OpportunityStatus
)
from apps.sales_handoff.models import SQLHandoff, HandoffStatus
from apps.pld_engine.models import PipelineType
from apps.audit_logging.models import AuditLog, AuditAction
from apps.workflows.models import StageHistory


class OpportunityService:
    """
    Manages Opportunity creation from accepted SQL handoffs, data carry-forward,
    product/module relationships, commercial field validation, and stage transitions.
    """
    @classmethod
    def create_from_accepted_sql(cls, handoff, user=None, owner=None):
        """
        Creates a new Opportunity strictly from an ACCEPTED SQL handoff.
        Carries forward all evaluation, technical discovery, and commercial context.
        Prevents duplicate creation for the same handoff.
        """
        if handoff.status != HandoffStatus.ACCEPTED:
            raise ValidationError(f"Opportunity creation blocked: SQL Handoff must have status 'ACCEPTED' (current status: '{handoff.status}').")

        # Prevent duplicate opportunity creation
        existing_opp = Opportunity.objects.filter(sql_handoff=handoff).first()
        if existing_opp:
            raise ValidationError(f"An Opportunity (#{str(existing_opp.id)[:8]}) has already been created for this SQL Handoff.")

        lead = handoff.lead
        product = handoff.product

        # Resolve initial opportunity stage from published pipeline configuration
        config = product.configurations.filter(status='PUBLISHED').first() or product.configurations.first()
        initial_stage = None
        if config:
            initial_stage = config.stages.filter(pipeline_type=PipelineType.OPPORTUNITY).order_by('sequence_order').first()

        # Extract carried-forward technical and evaluation details
        latest_assessment = lead.assessments.filter(product=product).order_by('-assessed_at').first()
        latest_discovery = lead.discoveries.first()
        latest_demo = lead.demos.filter(status='COMPLETED').first()
        latest_poc = lead.pocs.filter(status='COMPLETED').first()

        # Decision Maker resolution
        dm_str = None
        if lead.contact:
            role_disp = lead.contact.get_role_type_display() if hasattr(lead.contact, 'get_role_type_display') else lead.contact.role_type
            dm_str = f"{lead.contact.first_name} {lead.contact.last_name or ''} ({role_disp})".strip()
        elif latest_discovery:
            dm_sh = latest_discovery.stakeholders.filter(decision_role__in=['DECISION_MAKER', 'ECONOMIC_BUYER']).first()
            if dm_sh:
                dm_str = f"{dm_sh.contact.first_name} {dm_sh.contact.last_name or ''} ({dm_sh.get_decision_role_display()})".strip()

        # Implementation Scope & ERP System
        impl_scope = ""
        if latest_poc and latest_poc.scope_description:
            impl_scope = latest_poc.scope_description
        elif latest_discovery and latest_discovery.business_impact_summary:
            impl_scope = latest_discovery.business_impact_summary

        erp_str = None
        if lead.account:
            erp_attr = lead.account.custom_attributes.filter(attribute_key__in=['primary_erp', 'erp_system', 'erp']).first()
            if erp_attr:
                erp_str = str(erp_attr.attribute_value)

        # POC Result Summary
        poc_summary_str = None
        if latest_poc:
            poc_summary_str = latest_poc.results_summary or f"Completed pilot across {latest_poc.users_count} users"
        elif latest_demo:
            poc_summary_str = f"Demo Completed: {latest_demo.fit_assessment} fit with {latest_demo.use_cases.count()} demonstrated capabilities"

        # Commercial Values
        val = handoff.estimated_value or lead.estimated_opportunity_value or Decimal('0.00')
        contract_term = 12
        arr_val = val
        mrr_val = (val / Decimal('12')).quantize(Decimal('0.01')) if contract_term == 12 else Decimal('0.00')

        opp = Opportunity.objects.create(
            account=lead.account,
            primary_contact=lead.contact,
            owner=owner or handoff.assigned_sales_owner or user,
            sql_handoff=handoff,
            opportunity_type=OpportunityType.NEW,
            stage=initial_stage,
            status=OpportunityStatus.OPEN,
            product=product,
            total_contract_value=val,
            arr=arr_val,
            mrr=mrr_val,
            arr_mrr=val,
            pricing_plan="Enterprise Annual Subscription",
            seat_units_count=getattr(latest_poc, 'users_count', 15) if latest_poc else 15,
            contract_term_months=contract_term,
            currency=handoff.currency or 'USD',
            probability_pct=50,
            expected_close_date=timezone.now().date() + timedelta(days=60),
            pld_score=latest_assessment.pld_score if latest_assessment else Decimal('85.00'),
            sql_date=timezone.now().date(),
            decision_maker=dm_str,
            implementation_scope=impl_scope,
            erp_system=erp_str or "SAP S/4HANA Cloud",
            integration_requirements="REST API & Webhooks connector for ERP auto-synchronization",
            poc_result=poc_summary_str,
            next_action_description=lead.next_action_description or "Present formal commercial proposal and pricing schedule",
            next_activity_due_at=timezone.now() + timedelta(days=3),
            tenant=lead.tenant
        )

        # Auto-create OpportunityProduct line item
        OpportunityProduct.objects.create(
            opportunity=opp,
            product=product,
            quantity=1,
            unit_price=val,
            total_amount=val,
            term_months=contract_term,
            tenant=lead.tenant
        )

        # Auto-populate OpportunityModule & OpportunityCapability from mapped Discovery & Demo capabilities
        if latest_discovery:
            for dp in latest_discovery.problems.all():
                for pm in dp.capability_mappings.all():
                    cap = pm.capability
                    if cap:
                        if not OpportunityCapability.objects.filter(opportunity=opp, capability=cap).exists():
                            OpportunityCapability.objects.create(
                                opportunity=opp,
                                capability=cap,
                                tenant=lead.tenant
                            )
                        if cap.module:
                            if not OpportunityModule.objects.filter(opportunity=opp, module=cap.module).exists():
                                OpportunityModule.objects.create(
                                    opportunity=opp,
                                    module=cap.module,
                                    is_included=True,
                                    notes=f"Mapped to problem: {dp.problem.name if dp.problem else 'Problem'}",
                                    tenant=lead.tenant
                                )

        # Record Stage History
        if initial_stage:
            StageHistory.objects.create(
                record_type='OPPORTUNITY',
                record_id=opp.id,
                from_stage=None,
                to_stage=initial_stage,
                transition_reason=f"Opportunity created from accepted SQL Handoff #{str(handoff.id)[:8]}",
                changed_by=user,
                tenant=lead.tenant
            )

        # Universal Audit Log
        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.CREATE,
            entity_type='Opportunity',
            entity_id=opp.id,
            changes_json={
                "account": opp.account.company_name,
                "product": product.name,
                "total_contract_value": str(val),
                "sql_handoff": str(handoff.id)
            }
        )

        return opp

    @classmethod
    def transition_stage(cls, opportunity, target_stage, reason=None, user=None):
        """
        Transitions Opportunity to a new stage in the commercial pipeline.
        Enforces explanatory reason if moving backward.
        """
        if not target_stage:
            raise ValidationError("Target stage is required.")

        from_stage = opportunity.stage
        is_backward = False
        if from_stage and target_stage.sequence_order < from_stage.sequence_order:
            is_backward = True
            if not reason or not reason.strip():
                raise ValidationError("Reason is mandatory when moving an opportunity backward in the pipeline.")

        opportunity.stage = target_stage
        opportunity.save(update_fields=['stage'])

        # Record Stage History
        StageHistory.objects.create(
            record_type='OPPORTUNITY',
            record_id=opportunity.id,
            from_stage=from_stage,
            to_stage=target_stage,
            transition_reason=reason or f"Transitioned to {target_stage.stage_name}",
            is_override=is_backward,
            changed_by=user,
            tenant=opportunity.tenant
        )

        # Universal Audit Log
        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.UPDATE,
            entity_type='Opportunity',
            entity_id=opportunity.id,
            changes_json={
                "from_stage": from_stage.stage_name if from_stage else None,
                "to_stage": target_stage.stage_name,
                "is_backward": is_backward,
                "reason": reason
            }
        )

        return opportunity

    @classmethod
    def update_commercial_fields(cls, opportunity, data, user=None):
        """
        Updates and validates commercial values on the Opportunity.
        Logs audit changes for all updated commercial parameters.
        """
        changes = {}
        fields_to_update = []

        if 'total_contract_value' in data:
            new_val = Decimal(str(data['total_contract_value']))
            if new_val < 0:
                raise ValidationError("Total contract value cannot be negative.")
            if opportunity.total_contract_value != new_val:
                changes['total_contract_value'] = {'old': str(opportunity.total_contract_value), 'new': str(new_val)}
                opportunity.total_contract_value = new_val
                fields_to_update.append('total_contract_value')

        if 'arr' in data:
            new_arr = Decimal(str(data['arr']))
            if opportunity.arr != new_arr:
                changes['arr'] = {'old': str(opportunity.arr), 'new': str(new_arr)}
                opportunity.arr = new_arr
                fields_to_update.append('arr')

        if 'mrr' in data:
            new_mrr = Decimal(str(data['mrr']))
            if opportunity.mrr != new_mrr:
                changes['mrr'] = {'old': str(opportunity.mrr), 'new': str(new_mrr)}
                opportunity.mrr = new_mrr
                fields_to_update.append('mrr')

        if 'pricing_plan' in data and data['pricing_plan']:
            if opportunity.pricing_plan != data['pricing_plan']:
                changes['pricing_plan'] = {'old': opportunity.pricing_plan, 'new': data['pricing_plan']}
                opportunity.pricing_plan = data['pricing_plan']
                fields_to_update.append('pricing_plan')

        if 'seat_units_count' in data:
            new_seats = int(data['seat_units_count'])
            if opportunity.seat_units_count != new_seats:
                changes['seat_units_count'] = {'old': opportunity.seat_units_count, 'new': new_seats}
                opportunity.seat_units_count = new_seats
                fields_to_update.append('seat_units_count')

        if 'contract_term_months' in data:
            new_term = int(data['contract_term_months'])
            if opportunity.contract_term_months != new_term:
                changes['contract_term_months'] = {'old': opportunity.contract_term_months, 'new': new_term}
                opportunity.contract_term_months = new_term
                fields_to_update.append('contract_term_months')

        if 'probability_pct' in data:
            new_prob = int(data['probability_pct'])
            if opportunity.probability_pct != new_prob:
                changes['probability_pct'] = {'old': opportunity.probability_pct, 'new': new_prob}
                opportunity.probability_pct = new_prob
                fields_to_update.append('probability_pct')

        if 'expected_close_date' in data and data['expected_close_date']:
            opportunity.expected_close_date = data['expected_close_date']
            fields_to_update.append('expected_close_date')

        if 'next_action_description' in data and data['next_action_description']:
            opportunity.next_action_description = data['next_action_description']
            fields_to_update.append('next_action_description')

        if 'next_activity_due_at' in data and data['next_activity_due_at']:
            opportunity.next_activity_due_at = data['next_activity_due_at']
            fields_to_update.append('next_activity_due_at')

        if fields_to_update:
            opportunity.save(update_fields=fields_to_update)

            if changes:
                AuditLog.objects.create(
                    actor=user,
                    actor_email=user.email if user else "system@texol.sa",
                    actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
                    action=AuditAction.UPDATE,
                    entity_type='Opportunity',
                    entity_id=opportunity.id,
                    changes_json=changes
                )

        return opportunity
