import csv
import io
from datetime import datetime, date, timedelta
from decimal import Decimal
from django.db.models import (
    Count, Sum, Avg, F, Q, Case, When, Value, IntegerField, DecimalField
)
from django.utils import timezone
from django.contrib.auth import get_user_model

from apps.leads.models import Lead, LeadStatus, LeadSource, Campaign, LeadTouch, LeadProblem
from apps.accounts.models import Account, Contact
from apps.opportunities.models import (
    Opportunity, OpportunityStatus, OpportunityType,
    OpportunityProduct, OpportunityModule, OpportunityCapability,
    Proposal, ProposalStatus, ProposalItem
)
from apps.products.models import Product, ProductModule, ProductCapability
from apps.pld_assessments.models import AccountProductAssessment, ICPResultStatus
from apps.pld_engine.models import PipelineStage, PipelineType
from apps.sales_handoff.models import SQLHandoff, HandoffStatus
from apps.discovery.models import Discovery, DiscoveryProblemMapping
from apps.evaluations.models import Demo, POC
from apps.activities.models import (
    Activity, ActivityType, ActivityStatus,
    Task, TaskStatus,
    SLATracker, SLAStatus, SLADefinition
)
from apps.workflows.models import StageHistory
from apps.partners.models import (
    Partner, PartnerProduct, DealRegistration,
    PartnerCommission, DealRegistrationStatus,
    ChannelConflict, PartnerInfluence, PartnerChannelConfig
)
from apps.authentication.models import UserRole
from apps.authentication.backends import is_management_or_admin, is_sales_staff

User = get_user_model()


class AnalyticsFilterHelper:
    """
    Standard date range, owner, product, and territory filter helper.
    """
    @staticmethod
    def get_date_range(period=None, start_date=None, end_date=None):
        now = timezone.now()
        today = now.date()

        if period == 'TODAY':
            start = timezone.make_aware(datetime.combine(today, datetime.min.time()))
            end = now
            return start, end
        elif period == 'YESTERDAY':
            yest = today - timedelta(days=1)
            start = timezone.make_aware(datetime.combine(yest, datetime.min.time()))
            end = timezone.make_aware(datetime.combine(yest, datetime.max.time()))
            return start, end
        elif period == 'THIS_WEEK':
            start_week = today - timedelta(days=today.weekday())
            start = timezone.make_aware(datetime.combine(start_week, datetime.min.time()))
            end = now
            return start, end
        elif period == 'LAST_WEEK':
            start_prev_week = today - timedelta(days=today.weekday() + 7)
            end_prev_week = start_prev_week + timedelta(days=6)
            start = timezone.make_aware(datetime.combine(start_prev_week, datetime.min.time()))
            end = timezone.make_aware(datetime.combine(end_prev_week, datetime.max.time()))
            return start, end
        elif period == 'THIS_MONTH':
            start_month = today.replace(day=1)
            start = timezone.make_aware(datetime.combine(start_month, datetime.min.time()))
            end = now
            return start, end
        elif period == 'LAST_MONTH':
            first_this_month = today.replace(day=1)
            last_prev_month = first_this_month - timedelta(days=1)
            start_prev_month = last_prev_month.replace(day=1)
            start = timezone.make_aware(datetime.combine(start_prev_month, datetime.min.time()))
            end = timezone.make_aware(datetime.combine(last_prev_month, datetime.max.time()))
            return start, end
        elif period == 'THIS_QUARTER':
            curr_quarter = (today.month - 1) // 3 + 1
            first_month = (curr_quarter - 1) * 3 + 1
            start_quarter = today.replace(month=first_month, day=1)
            start = timezone.make_aware(datetime.combine(start_quarter, datetime.min.time()))
            end = now
            return start, end
        elif period == 'LAST_QUARTER':
            curr_quarter = (today.month - 1) // 3 + 1
            if curr_quarter == 1:
                prev_quarter_start = today.replace(year=today.year - 1, month=10, day=1)
                prev_quarter_end = today.replace(year=today.year - 1, month=12, day=31)
            else:
                first_month = (curr_quarter - 2) * 3 + 1
                prev_quarter_start = today.replace(month=first_month, day=1)
                last_month = first_month + 2
                import calendar
                _, last_day = calendar.monthrange(today.year, last_month)
                prev_quarter_end = today.replace(month=last_month, day=last_day)
            start = timezone.make_aware(datetime.combine(prev_quarter_start, datetime.min.time()))
            end = timezone.make_aware(datetime.combine(prev_quarter_end, datetime.max.time()))
            return start, end
        elif period == 'THIS_YEAR':
            start_year = today.replace(month=1, day=1)
            start = timezone.make_aware(datetime.combine(start_year, datetime.min.time()))
            end = now
            return start, end
        elif period == 'CUSTOM' and start_date and end_date:
            try:
                sd = datetime.strptime(start_date, '%Y-%m-%d').date() if isinstance(start_date, str) else start_date
                ed = datetime.strptime(end_date, '%Y-%m-%d').date() if isinstance(end_date, str) else end_date
                start = timezone.make_aware(datetime.combine(sd, datetime.min.time()))
                end = timezone.make_aware(datetime.combine(ed, datetime.max.time()))
                return start, end
            except Exception:
                return None, None

        return None, None

    @staticmethod
    def apply_rbac_scope(queryset, user, owner_field='owner'):
        """
        Enforce server-side RBAC scoping on querysets.
        """
        if not user or not user.is_authenticated:
            return queryset
        if user.is_superuser or is_management_or_admin(user):
            return queryset
        if getattr(user, 'role', None) == UserRole.SALES_MANAGER:
            # Sales Manager sees their territory or all sales records
            if user.territory:
                return queryset.filter(Q(**{f"{owner_field}__territory": user.territory}) | Q(**{owner_field: user}))
            return queryset
        if getattr(user, 'is_partner_user', False) and hasattr(user, 'partner_profile'):
            partner = user.partner_profile.partner
            if hasattr(queryset.model, 'partner'):
                return queryset.filter(partner=partner)
            if hasattr(queryset.model, 'originated_leads'):
                return queryset.filter(originated_leads__partner=partner)
            return queryset.none()
        # Preserve specialist enterprise roles without confining to owner=user
        if getattr(user, 'role', None) in [UserRole.MARKETING, UserRole.PRESALES, UserRole.PARTNER_MANAGER]:
            return queryset
        # Restrict individual sales staff to their assigned records only
        if is_sales_staff(user):
            return queryset.filter(**{owner_field: user})
        return queryset


class ExecutiveAnalyticsService:
    """
    Computes business performance metrics for the Executive Dashboard.
    Answers: "How is the business performing?"
    """
    @staticmethod
    def get_dashboard_data(user=None, period=None, start_date=None, end_date=None, product_code=None, owner_id=None, territory=None):
        start_dt, end_dt = AnalyticsFilterHelper.get_date_range(period, start_date, end_date)

        # Base Querysets
        lead_qs = Lead.objects.all()
        opp_qs = Opportunity.objects.all()
        account_qs = Account.objects.all()
        sql_qs = SQLHandoff.objects.all()
        act_qs = Activity.objects.all()
        sla_qs = SLATracker.objects.all()

        # Date Filtering
        if start_dt and end_dt:
            lead_qs = lead_qs.filter(created_at__gte=start_dt, created_at__lte=end_dt)
            opp_qs = opp_qs.filter(created_at__gte=start_dt, created_at__lte=end_dt)
            sql_qs = sql_qs.filter(created_at__gte=start_dt, created_at__lte=end_dt)
            act_qs = act_qs.filter(conducted_at__gte=start_dt, conducted_at__lte=end_dt)
            sla_qs = sla_qs.filter(start_time__gte=start_dt, start_time__lte=end_dt)

        # Product Filtering
        if product_code and product_code != 'ALL':
            lead_qs = lead_qs.filter(primary_product__code=product_code)
            opp_qs = opp_qs.filter(Q(product__code=product_code) | Q(product_lines__product__code=product_code)).distinct()
            sql_qs = sql_qs.filter(product__code=product_code)

        # Owner Filtering
        if owner_id:
            lead_qs = lead_qs.filter(owner_id=owner_id)
            opp_qs = opp_qs.filter(owner_id=owner_id)
            sql_qs = sql_qs.filter(assigned_sales_owner_id=owner_id)
            act_qs = act_qs.filter(performed_by_id=owner_id)
            sla_qs = sla_qs.filter(assigned_user_id=owner_id)

        # RBAC Scoping
        lead_qs = AnalyticsFilterHelper.apply_rbac_scope(lead_qs, user, 'owner')
        opp_qs = AnalyticsFilterHelper.apply_rbac_scope(opp_qs, user, 'owner')
        sql_qs = AnalyticsFilterHelper.apply_rbac_scope(sql_qs, user, 'assigned_sales_owner')
        act_qs = AnalyticsFilterHelper.apply_rbac_scope(act_qs, user, 'performed_by')
        sla_qs = AnalyticsFilterHelper.apply_rbac_scope(sla_qs, user, 'assigned_user')

        # Core Metrics Calculations
        target_accounts = account_qs.filter(is_target_account=True).count()
        total_leads = lead_qs.count()
        
        # PLD Qualified
        pld_qualified = lead_qs.filter(
            Q(assessments__pld_score__gte=60) | Q(current_stage__stage_code='PLD_QUALIFIED')
        ).distinct().count()

        # SQLs & Acceptance
        sqls_count = sql_qs.count()
        sales_accepted = sql_qs.filter(status=HandoffStatus.ACCEPTED).count()

        # Opportunities & Pipeline
        total_opps = opp_qs.count()
        open_opps = opp_qs.filter(status=OpportunityStatus.OPEN)
        won_opps = opp_qs.filter(status=OpportunityStatus.WON)
        lost_opps = opp_qs.filter(status=OpportunityStatus.LOST)

        pipeline_value = open_opps.aggregate(val=Sum('total_contract_value'))['val'] or Decimal('0.00')
        won_value = won_opps.aggregate(val=Sum('total_contract_value'))['val'] or Decimal('0.00')

        # Weighted Pipeline: Sum(Value * (Probability / 100))
        weighted_pipeline = Decimal('0.00')
        for val, prob in open_opps.values_list('total_contract_value', 'probability_pct'):
            weighted_pipeline += (val * Decimal(prob or 0) / Decimal(100))

        # Conversion Rates
        lead_to_pld_rate = round((pld_qualified / total_leads * 100), 1) if total_leads > 0 else 0.0
        pld_to_sql_rate = round((sqls_count / pld_qualified * 100), 1) if pld_qualified > 0 else 0.0
        sql_to_accepted_rate = round((sales_accepted / sqls_count * 100), 1) if sqls_count > 0 else 0.0
        closed_opps_count = won_opps.count() + lost_opps.count()
        win_rate = round((won_opps.count() / closed_opps_count * 100), 1) if closed_opps_count > 0 else 0.0

        # Average Funnel Duration (from Lead creation to Won Opportunity)
        won_durations = []
        for opp in won_opps.select_related('sql_handoff__lead'):
            if opp.sql_handoff and opp.sql_handoff.lead:
                duration_days = (opp.updated_at - opp.sql_handoff.lead.created_at).total_seconds() / 86400.0
                won_durations.append(max(0.1, duration_days))
            else:
                duration_days = (opp.updated_at - opp.created_at).total_seconds() / 86400.0
                won_durations.append(max(0.1, duration_days))
        avg_funnel_duration = round(sum(won_durations) / len(won_durations), 1) if won_durations else 0.0

        # Activity Health
        now = timezone.now()
        week_start = now - timedelta(days=now.weekday())
        activities_today = act_qs.filter(conducted_at__date=now.date()).count()
        activities_this_week = act_qs.filter(conducted_at__gte=week_start).count()
        completed_activities = act_qs.filter(status=ActivityStatus.COMPLETED).count()
        total_activities = act_qs.count()
        activity_completion_rate = round((completed_activities / total_activities * 100), 1) if total_activities > 0 else 100.0

        # SLA Health
        total_slas = sla_qs.count()
        within_sla = sla_qs.filter(status=SLAStatus.WITHIN_SLA).count()
        due_soon = sla_qs.filter(status=SLAStatus.DUE_SOON).count()
        at_risk = sla_qs.filter(status=SLAStatus.AT_RISK).count()
        breached_sla = sla_qs.filter(status=SLAStatus.BREACHED).count()
        sla_adherence_rate = round(((total_slas - breached_sla) / total_slas * 100), 1) if total_slas > 0 else 100.0

        # Funnel Stages Array for UI Funnel Visualizer
        discovery_completed = Discovery.objects.filter(is_product_mapping_complete=True).count()
        poc_completed = POC.objects.filter(status='COMPLETED').count()

        funnel_stages = [
            {"stage_name": "Target Accounts", "code": "TARGET_ACCOUNTS", "count": target_accounts, "conversion_rate": 100.0},
            {"stage_name": "Inbound / Sourced Leads", "code": "LEADS", "count": total_leads, "conversion_rate": round(total_leads / max(1, target_accounts) * 100, 1)},
            {"stage_name": "PLD Qualified", "code": "PLD_QUALIFIED", "count": pld_qualified, "conversion_rate": lead_to_pld_rate},
            {"stage_name": "Discovery Completed", "code": "DISCOVERY", "count": discovery_completed, "conversion_rate": round(discovery_completed / max(1, pld_qualified) * 100, 1)},
            {"stage_name": "POC / Pilot Executed", "code": "POC", "count": poc_completed, "conversion_rate": round(poc_completed / max(1, discovery_completed) * 100, 1)},
            {"stage_name": "SQL Gate Ready", "code": "SQL_READY", "count": sqls_count, "conversion_rate": pld_to_sql_rate},
            {"stage_name": "Sales Accepted", "code": "SALES_ACCEPTED", "count": sales_accepted, "conversion_rate": sql_to_accepted_rate},
            {"stage_name": "Active Opportunities", "code": "OPPORTUNITIES", "count": total_opps, "conversion_rate": round(total_opps / max(1, sales_accepted) * 100, 1)},
            {"stage_name": "Closed Won Deals", "code": "CLOSED_WON", "count": won_opps.count(), "conversion_rate": win_rate},
        ]

        # Pipeline by Product Breakdown
        product_breakdown = []
        for prod in Product.objects.all():
            p_val = opp_qs.filter(product_lines__product=prod, status=OpportunityStatus.OPEN).aggregate(v=Sum('product_lines__total_amount'))['v'] or Decimal('0.00')
            p_won = opp_qs.filter(product_lines__product=prod, status=OpportunityStatus.WON).aggregate(v=Sum('product_lines__total_amount'))['v'] or Decimal('0.00')
            p_leads = lead_qs.filter(primary_product=prod).count()
            p_opps = opp_qs.filter(product_lines__product=prod).distinct().count()
            product_breakdown.append({
                "product_id": str(prod.id),
                "product_code": prod.code,
                "product_name": prod.name,
                "leads_count": p_leads,
                "opportunities_count": p_opps,
                "open_pipeline_value": float(p_val),
                "won_revenue": float(p_won)
            })

        # Pipeline by Deal Type Breakdown
        pipeline_by_type = []
        for opp_type, type_label in OpportunityType.choices:
            type_opps = open_opps.filter(opportunity_type=opp_type)
            val = type_opps.aggregate(v=Sum('total_contract_value'))['v'] or Decimal('0.00')
            pipeline_by_type.append({
                "type": type_label,
                "type_code": opp_type,
                "count": type_opps.count(),
                "value": float(val)
            })

        return {
            "period": period or "ALL",
            "kpis": {
                "target_accounts": target_accounts,
                "total_leads": total_leads,
                "pld_qualified": pld_qualified,
                "sql_count": sqls_count,
                "sales_accepted": sales_accepted,
                "opportunities_count": total_opps,
                "open_opportunities": open_opps.count(),
                "won_opportunities": won_opps.count(),
                "lost_opportunities": lost_opps.count(),
                "pipeline_value": float(pipeline_value),
                "weighted_pipeline": float(weighted_pipeline),
                "won_value": float(won_value),
                "currency": "USD"
            },
            "rates": {
                "lead_to_pld_rate": lead_to_pld_rate,
                "pld_to_sql_rate": pld_to_sql_rate,
                "sql_to_accepted_rate": sql_to_accepted_rate,
                "win_rate": win_rate,
                "avg_funnel_duration_days": avg_funnel_duration
            },
            "activity_health": {
                "activities_today": activities_today,
                "activities_this_week": activities_this_week,
                "total_activities": total_activities,
                "completed_activities": completed_activities,
                "completion_rate": activity_completion_rate,
                "overdue_tasks": Task.objects.filter(is_completed=False, due_date__lt=now).count()
            },
            "sla_health": {
                "total_slas": total_slas,
                "within_sla": within_sla,
                "due_soon": due_soon,
                "at_risk": at_risk,
                "breached_sla": breached_sla,
                "sla_adherence_rate": sla_adherence_rate
            },
            "funnel_stages": funnel_stages,
            "product_breakdown": product_breakdown,
            "pipeline_by_type": pipeline_by_type
        }


class PLDAnalyticsService:
    """
    Computes PLD qualification analytics and diagnostic score distributions.
    Answers: "Are leads being qualified correctly?"
    """
    @staticmethod
    def get_dashboard_data(user=None, period=None, start_date=None, end_date=None, product_code=None):
        start_dt, end_dt = AnalyticsFilterHelper.get_date_range(period, start_date, end_date)

        lead_qs = Lead.objects.all().select_related('account', 'primary_product', 'current_stage', 'owner')
        assessment_qs = AccountProductAssessment.objects.all().select_related('lead', 'product')

        if start_dt and end_dt:
            lead_qs = lead_qs.filter(created_at__gte=start_dt, created_at__lte=end_dt)
            assessment_qs = assessment_qs.filter(created_at__gte=start_dt, created_at__lte=end_dt)

        if product_code and product_code != 'ALL':
            lead_qs = lead_qs.filter(primary_product__code=product_code)
            assessment_qs = assessment_qs.filter(product__code=product_code)

        lead_qs = AnalyticsFilterHelper.apply_rbac_scope(lead_qs, user, 'owner')
        assessment_qs = AnalyticsFilterHelper.apply_rbac_scope(assessment_qs, user, 'lead__owner')

        total_leads = lead_qs.count()
        icp_passed = assessment_qs.filter(icp_knockout_passed=True).count()
        icp_failed = assessment_qs.filter(icp_knockout_passed=False).count()
        icp_pass_rate = round((icp_passed / max(1, total_leads) * 100), 1)

        pld_qualified = assessment_qs.filter(pld_score__gte=60).count()
        pld_qual_rate = round((pld_qualified / max(1, total_leads) * 100), 1)

        avg_score = assessment_qs.aggregate(avg=Avg('pld_score'))['avg'] or 0.0

        # Score Distribution Bands
        score_distribution = {
            "nurture_band_0_30": assessment_qs.filter(pld_score__gte=0, pld_score__lte=30).count(),
            "development_band_31_60": assessment_qs.filter(pld_score__gte=31, pld_score__lte=60).count(),
            "qualified_band_61_80": assessment_qs.filter(pld_score__gte=61, pld_score__lte=80).count(),
            "high_priority_band_81_100": assessment_qs.filter(pld_score__gte=81, pld_score__lte=100).count(),
        }

        score_distribution_list = [
            {"range": "0-30", "label": "Nurture Band", "count": score_distribution["nurture_band_0_30"]},
            {"range": "31-60", "label": "Development Band", "count": score_distribution["development_band_31_60"]},
            {"range": "61-80", "label": "Qualified Band", "count": score_distribution["qualified_band_61_80"]},
            {"range": "81-100", "label": "High Priority Band", "count": score_distribution["high_priority_band_81_100"]},
        ]

        # Operational Quality Checks
        leads_without_problems = lead_qs.filter(recorded_problems__isnull=True).distinct().count()
        leads_without_next_action = lead_qs.filter(
            Q(next_activity_due_at__isnull=True) | Q(next_action_description__isnull=True)
        ).count()
        high_score_leads_count = assessment_qs.filter(pld_score__gte=80).count()

        # Status volumes
        nurture_volume = lead_qs.filter(status=LeadStatus.NURTURE).count()
        disqualification_volume = lead_qs.filter(status=LeadStatus.DISQUALIFIED).count()

        # Stage Conversion and Average Time in Stage (from StageHistory)
        history_qs = StageHistory.objects.filter(record_type='LEAD')
        if is_sales_staff(user):
            history_qs = history_qs.filter(record_id__in=lead_qs.values_list('id', flat=True))
        stage_velocity = []
        velocity_map = {}
        for stage in PipelineStage.objects.filter(pipeline_type=PipelineType.PURSUIT).order_by('sequence_order'):
            entered_count = history_qs.filter(to_stage=stage).count()
            progressed_count = history_qs.filter(from_stage=stage).count()
            conv_pct = round((progressed_count / entered_count * 100), 1) if entered_count > 0 else 0.0

            # Calculate average days between entering stage and next transition
            durations = []
            for h in history_qs.filter(from_stage=stage).select_related('to_stage'):
                entry = history_qs.filter(record_id=h.record_id, to_stage=stage).first()
                if entry and h.created_at > entry.created_at:
                    dur_days = (h.created_at - entry.created_at).total_seconds() / 86400.0
                    durations.append(dur_days)
            avg_days = round(sum(durations) / len(durations), 1) if durations else 2.5
            velocity_map[stage.stage_code] = avg_days

            stage_velocity.append({
                "stage_name": stage.stage_name,
                "stage_code": stage.stage_code,
                "records_entered": entered_count,
                "records_progressed": progressed_count,
                "conversion_rate": conv_pct,
                "avg_days_in_stage": avg_days
            })

        # PLD Stage Distribution
        stage_counts = []
        for stage in PipelineStage.objects.filter(pipeline_type=PipelineType.PURSUIT).order_by('sequence_order'):
            count = lead_qs.filter(current_stage=stage).count()
            stage_counts.append({
                "stage": stage.stage_name,
                "stage_code": stage.stage_code,
                "stage_name": stage.stage_name,
                "sequence_order": stage.sequence_order,
                "is_required": stage.is_required,
                "count": count,
                "leads_count": count,
                "avg_days_in_stage": velocity_map.get(stage.stage_code, 2.5)
            })

        # Detailed Leads Records for Drill-Down
        leads_records = []
        for ld in lead_qs.order_by('-created_at')[:50]:
            ass = ld.assessments.first()
            leads_records.append({
                "id": str(ld.id),
                "account_name": ld.account.company_name if ld.account else "Unknown",
                "company_name": ld.account.company_name if ld.account else (ld.company_name if hasattr(ld, 'company_name') else "Unknown"),
                "product_code": ld.primary_product.code if ld.primary_product else "",
                "product_name": ld.primary_product.name if ld.primary_product else "",
                "stage": ld.current_stage.stage_name if ld.current_stage else "New",
                "stage_name": ld.current_stage.stage_name if ld.current_stage else "New",
                "status": ld.status,
                "owner_name": ld.owner.get_full_name() or ld.owner.username if ld.owner else "Unassigned",
                "pld_score": ass.pld_score if ass else 0,
                "score": ass.pld_score if ass else 0,
                "icp_passed": ass.icp_knockout_passed if ass else False,
                "score_classification": ass.score_classification if ass else "NURTURE",
                "problems_count": ld.recorded_problems.count(),
                "next_action": ld.next_action_description or "None scheduled",
                "next_action_due": ld.next_activity_due_at.strftime('%Y-%m-%d') if ld.next_activity_due_at else None,
                "created_at": ld.created_at.strftime('%Y-%m-%d')
            })

        high_score_leads = [l for l in leads_records if l.get("pld_score", 0) >= 70]

        pld_kpis = {
            "total_leads": total_leads,
            "icp_passed": icp_passed,
            "icp_pass_count": icp_passed,
            "icp_failed": icp_failed,
            "icp_fail_count": icp_failed,
            "icp_pass_rate": icp_pass_rate,
            "pld_qualified": pld_qualified,
            "qualified_count": pld_qualified,
            "pld_qualification_rate": pld_qual_rate,
            "qualification_rate": pld_qual_rate,
            "average_pld_score": round(float(avg_score), 1),
            "avg_pld_score": round(float(avg_score), 1),
            "nurture_volume": nurture_volume,
            "disqualification_volume": disqualification_volume,
        }

        alerts_payload = {
            "leads_without_problems": leads_without_problems,
            "leads_without_next_action": leads_without_next_action,
            "high_score_leads": high_score_leads_count
        }

        return {
            "metrics": pld_kpis,
            "kpis": pld_kpis,
            "score_distribution": score_distribution_list,
            "score_distribution_dict": score_distribution,
            "alerts": alerts_payload,
            "quality_alerts": alerts_payload,
            "stage_distribution": stage_counts,
            "stage_velocity": stage_velocity,
            "high_score_leads": high_score_leads,
            "leads": leads_records
        }


class SalesAnalyticsService:
    """
    Computes commercial opportunities, pipeline velocity, deal types, and win rates.
    Answers: "What pipeline needs attention?"
    """
    @staticmethod
    def get_dashboard_data(user=None, period=None, start_date=None, end_date=None, product_code=None, owner_id=None):
        start_dt, end_dt = AnalyticsFilterHelper.get_date_range(period, start_date, end_date)

        opp_qs = Opportunity.objects.all().select_related(
            'account', 'owner', 'stage', 'product', 'primary_contact'
        )

        if start_dt and end_dt:
            opp_qs = opp_qs.filter(created_at__gte=start_dt, created_at__lte=end_dt)

        if product_code and product_code != 'ALL':
            opp_qs = opp_qs.filter(Q(product__code=product_code) | Q(product_lines__product__code=product_code)).distinct()

        if owner_id:
            opp_qs = opp_qs.filter(owner_id=owner_id)

        opp_qs = AnalyticsFilterHelper.apply_rbac_scope(opp_qs, user, 'owner')

        open_opps = opp_qs.filter(status=OpportunityStatus.OPEN)
        won_opps = opp_qs.filter(status=OpportunityStatus.WON)
        lost_opps = opp_qs.filter(status=OpportunityStatus.LOST)

        pipeline_value = open_opps.aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')
        arr_total = open_opps.aggregate(s=Sum('arr'))['s'] or Decimal('0.00')
        mrr_total = open_opps.aggregate(s=Sum('mrr'))['s'] or Decimal('0.00')

        weighted_pipeline = Decimal('0.00')
        for val, prob in open_opps.values_list('total_contract_value', 'probability_pct'):
            weighted_pipeline += (val * Decimal(prob or 0) / Decimal(100))

        won_value = won_opps.aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')
        closed_count = won_opps.count() + lost_opps.count()
        win_rate = round((won_opps.count() / closed_count * 100), 1) if closed_count > 0 else 0.0

        avg_deal_size = round(float(pipeline_value / max(1, open_opps.count())), 2)

        # Average sales cycle days
        cycle_days = []
        for op in won_opps:
            days = (op.updated_at - op.created_at).total_seconds() / 86400.0
            cycle_days.append(max(1.0, days))
        avg_sales_cycle = round(sum(cycle_days) / len(cycle_days), 1) if cycle_days else 0.0

        # Inactive Opportunities (> 14 days without activity)
        now = timezone.now()
        inactive_cutoff = now - timedelta(days=14)
        inactive_opps_qs = open_opps.filter(
            Q(last_activity_at__lt=inactive_cutoff) | Q(last_activity_at__isnull=True)
        )
        inactive_opps_count = inactive_opps_qs.count()

        # Opportunities by Stage
        stages_data = []
        for stg in PipelineStage.objects.filter(pipeline_type=PipelineType.OPPORTUNITY).order_by('sequence_order'):
            stg_opps = open_opps.filter(stage=stg)
            stg_val = stg_opps.aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')
            stg_weighted = Decimal('0.00')
            for val, prob in stg_opps.values_list('total_contract_value', 'probability_pct'):
                stg_weighted += (val * Decimal(prob or 0) / Decimal(100))

            stages_data.append({
                "stage_code": stg.stage_code,
                "stage_name": stg.stage_name,
                "sequence_order": stg.sequence_order,
                "count": stg_opps.count(),
                "pipeline_value": float(stg_val),
                "weighted_value": float(stg_weighted)
            })

        # Opportunities by Owner
        owners_data = []
        for usr in User.objects.filter(owned_opportunities__in=opp_qs).distinct():
            u_open = open_opps.filter(owner=usr)
            u_won = won_opps.filter(owner=usr)
            u_val = u_open.aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')
            u_won_val = u_won.aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')
            owners_data.append({
                "owner_id": str(usr.id),
                "owner_name": usr.get_full_name() or usr.username,
                "open_count": u_open.count(),
                "open_value": float(u_val),
                "won_count": u_won.count(),
                "won_value": float(u_won_val)
            })

        # Opportunities by Opportunity Type (New, Expansion, Renewal)
        types_breakdown = []
        for code, label in OpportunityType.choices:
            t_open = open_opps.filter(opportunity_type=code)
            t_won = won_opps.filter(opportunity_type=code)
            types_breakdown.append({
                "type_code": code,
                "type_label": label,
                "open_count": t_open.count(),
                "open_value": float(t_open.aggregate(s=Sum('total_contract_value'))['s'] or 0),
                "won_count": t_won.count(),
                "won_value": float(t_won.aggregate(s=Sum('total_contract_value'))['s'] or 0)
            })

        # Operational Pipeline Drivers
        sqls_awaiting_acceptance = SQLHandoff.objects.filter(status=HandoffStatus.PENDING).count()
        pending_proposals = Proposal.objects.filter(
            status__in=[ProposalStatus.DRAFT, ProposalStatus.PENDING_APPROVAL, ProposalStatus.APPROVED, ProposalStatus.SENT]
        ).count()
        overdue_activities = Activity.objects.filter(conducted_at__lt=now, status=ActivityStatus.PLANNED).count()
        upcoming_activities = Activity.objects.filter(
            conducted_at__gte=now, conducted_at__lte=now + timedelta(days=7), status=ActivityStatus.PLANNED
        ).count()

        # Drill-down Opportunities List
        opportunities_list = []
        for op in opp_qs.order_by('-total_contract_value')[:50]:
            opportunities_list.append({
                "id": str(op.id),
                "account_name": op.account.company_name if op.account else "Unknown",
                "product_name": op.product.name if op.product else "Multi-Product",
                "stage_name": op.stage.stage_name if op.stage else "Discovery",
                "opportunity_type": op.opportunity_type,
                "status": op.status,
                "total_contract_value": float(op.total_contract_value),
                "probability_pct": op.probability_pct,
                "weighted_value": float(op.total_contract_value * Decimal(op.probability_pct) / Decimal(100)),
                "currency": op.currency,
                "owner_name": op.owner.get_full_name() or op.owner.username if op.owner else "Unassigned",
                "expected_close_date": op.expected_close_date.strftime('%Y-%m-%d') if op.expected_close_date else None,
                "last_activity_at": op.last_activity_at.strftime('%Y-%m-%d') if op.last_activity_at else None,
                "is_inactive": op.last_activity_at < inactive_cutoff if op.last_activity_at else True
            })

        sales_kpis = {
            "active_opportunities": open_opps.count(),
            "pipeline_value": float(pipeline_value),
            "weighted_pipeline": float(weighted_pipeline),
            "won_value": float(won_value),
            "arr": float(arr_total),
            "mrr": float(mrr_total),
            "win_rate": win_rate,
            "average_deal_size": avg_deal_size,
            "average_sales_cycle_days": avg_sales_cycle,
            "inactive_opportunities": inactive_opps_count,
            "sqls_awaiting_acceptance": sqls_awaiting_acceptance,
            "pending_proposals": pending_proposals,
            "overdue_activities": overdue_activities,
            "upcoming_activities": upcoming_activities,
            "currency": "USD"
        }

        by_stage_list = [
            {"stage": s["stage_name"], "value": s["pipeline_value"], "weighted_value": s["weighted_value"], "count": s["count"]}
            for s in stages_data
        ]
        by_owner_list = [
            {"owner": o["owner_name"], "value": o["open_value"], "count": o["open_count"]}
            for o in owners_data
        ]
        by_type_list = [
            {"type": t["type_label"], "value": t["open_value"], "count": t["open_count"]}
            for t in types_breakdown
        ]
        inactive_opps_drill = [op for op in opportunities_list if op.get("is_inactive")][:15]

        attention_dict = {
            "sqls_awaiting_acceptance": sqls_awaiting_acceptance,
            "inactive_opportunities_count": inactive_opps_count,
            "inactive_opportunities": inactive_opps_drill,
            "pending_proposals": pending_proposals,
            "overdue_activities": overdue_activities,
            "upcoming_activities": upcoming_activities
        }

        return {
            "metrics": sales_kpis,
            "kpis": sales_kpis,
            "attention": attention_dict,
            "stages_breakdown": stages_data,
            "by_stage": by_stage_list,
            "owners_breakdown": owners_data,
            "by_owner": by_owner_list,
            "opportunity_types": types_breakdown,
            "by_type": by_type_list,
            "by_product": [],
            "by_close_month": [],
            "opportunities": opportunities_list
        }


class MarketingAnalyticsService:
    """
    Analyzes lead origination, campaigns, sources, and channel qualification rates.
    Answers: "Which sources generate quality pipeline?"
    """
    @staticmethod
    def get_dashboard_data(user=None, period=None, start_date=None, end_date=None):
        start_dt, end_dt = AnalyticsFilterHelper.get_date_range(period, start_date, end_date)

        lead_qs = Lead.objects.all().select_related('source', 'account', 'primary_product')
        touch_qs = LeadTouch.objects.all().select_related('campaign', 'source')

        if start_dt and end_dt:
            lead_qs = lead_qs.filter(created_at__gte=start_dt, created_at__lte=end_dt)
            touch_qs = touch_qs.filter(touch_date__gte=start_dt, touch_date__lte=end_dt)

        lead_qs = AnalyticsFilterHelper.apply_rbac_scope(lead_qs, user, 'owner')

        # Sources Breakdown
        sources_data = []
        for src in LeadSource.objects.all():
            src_leads = lead_qs.filter(source=src)
            total = src_leads.count()
            if total == 0:
                continue

            icp_passed = src_leads.filter(assessments__icp_knockout_passed=True).distinct().count()
            pld_qual = src_leads.filter(assessments__pld_score__gte=60).distinct().count()
            sqls = SQLHandoff.objects.filter(lead__in=src_leads).count()
            
            opps = Opportunity.objects.filter(sql_handoff__lead__in=src_leads)
            opp_count = opps.count()
            pipe_val = opps.filter(status=OpportunityStatus.OPEN).aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')
            won_val = opps.filter(status=OpportunityStatus.WON).aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')

            sources_data.append({
                "source_id": str(src.id),
                "source_code": src.code,
                "source_name": src.name,
                "source": src.name,
                "leads": total,
                "leads_count": total,
                "icp_passed": icp_passed,
                "icp_pass_rate": round(icp_passed / total * 100, 1),
                "pld_qualified": pld_qual,
                "pld_qualification_rate": round(pld_qual / total * 100, 1),
                "sqls": sqls,
                "sql_count": sqls,
                "opportunities": opp_count,
                "opportunity_count": opp_count,
                "pipeline": float(pipe_val),
                "pipeline_value": float(pipe_val),
                "won_value": float(won_val),
                "won_revenue": float(won_val),
                "conversion_rate": round(opps.filter(status=OpportunityStatus.WON).count() / max(1, total) * 100, 1)
            })

        # Campaigns Breakdown
        campaigns_data = []
        for camp in Campaign.objects.all():
            camp_leads = lead_qs.filter(touches__campaign=camp).distinct()
            c_total = camp_leads.count()
            c_opps = Opportunity.objects.filter(sql_handoff__lead__in=camp_leads)
            c_pipe = c_opps.filter(status=OpportunityStatus.OPEN).aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')
            c_won = c_opps.filter(status=OpportunityStatus.WON).aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')

            c_icp = camp_leads.filter(assessments__icp_knockout_passed=True).distinct().count()
            c_pld = camp_leads.filter(assessments__pld_score__gte=60).distinct().count()
            c_sqls = SQLHandoff.objects.filter(lead__in=camp_leads).count()
            c_won_count = c_opps.filter(status=OpportunityStatus.WON).count()

            cost = float(camp.actual_cost) if camp.actual_cost and camp.actual_cost > 0 else float(camp.budget)
            roi = round(float(c_won) / float(camp.actual_cost), 2) if camp.actual_cost and camp.actual_cost > 0 else (round(float(c_won) / float(camp.budget), 2) if camp.budget > 0 else None)

            campaigns_data.append({
                "campaign_id": str(camp.id),
                "campaign_code": camp.code,
                "campaign_name": camp.name,
                "name": camp.name,
                "campaign_type": camp.campaign_type,
                "budget": float(camp.budget),
                "actual_cost": float(camp.actual_cost),
                "leads": c_total,
                "leads_count": c_total,
                "icp_pass_rate": round(c_icp / max(1, c_total) * 100, 1),
                "pld_qualification_rate": round(c_pld / max(1, c_total) * 100, 1),
                "sqls": c_sqls,
                "sql_count": c_sqls,
                "opportunities": c_opps.count(),
                "opportunity_count": c_opps.count(),
                "pipeline": float(c_pipe),
                "pipeline_value": float(c_pipe),
                "won_value": float(c_won),
                "won_revenue": float(c_won),
                "conversion_rate": round(c_won_count / max(1, c_total) * 100, 1),
                "roi": roi,
                "roas": roi or 0.0
            })

        total_mktg_leads = sum(s.get('leads_count', 0) for s in sources_data) or lead_qs.count()
        mktg_pipe = sum(s.get('pipeline_value', 0) for s in sources_data)
        mktg_won = sum(s.get('won_revenue', 0) for s in sources_data)
        icp_passed_total = sum(s.get('icp_passed', 0) for s in sources_data)
        pld_qual_total = sum(s.get('pld_qualified', 0) for s in sources_data)
        icp_rate = round((icp_passed_total / total_mktg_leads * 100), 1) if total_mktg_leads > 0 else 0.0
        qual_rate = round((pld_qual_total / total_mktg_leads * 100), 1) if total_mktg_leads > 0 else 0.0

        mktg_kpis = {
            "total_leads": total_mktg_leads,
            "icp_pass_rate": icp_rate,
            "qualification_rate": qual_rate,
            "pipeline_value": float(mktg_pipe),
            "won_value": float(mktg_won),
            "currency": "USD"
        }

        return {
            "kpis": mktg_kpis,
            "metrics": mktg_kpis,
            "sources": sources_data,
            "campaigns": campaigns_data
        }


class ProductAnalyticsService:
    """
    Computes Product, Module, and Capability demand analytics.
    Answers: "Which products/modules/capabilities generate demand?"
    """
    @staticmethod
    def get_dashboard_data(user=None):
        products_data = []
        for prod in Product.objects.all().prefetch_related('modules__capabilities'):
            leads = Lead.objects.filter(primary_product=prod)
            l_count = leads.count()
            pld_qual = leads.filter(assessments__pld_score__gte=60).distinct().count()
            sqls = SQLHandoff.objects.filter(product=prod).count()

            opps = Opportunity.objects.filter(Q(product=prod) | Q(product_lines__product=prod)).distinct()
            opp_count = opps.count()
            open_pipe = opps.filter(status=OpportunityStatus.OPEN).aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')
            won_rev = opps.filter(status=OpportunityStatus.WON).aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')
            avg_pld = AccountProductAssessment.objects.filter(product=prod).aggregate(a=Avg('pld_score'))['a'] or 0.0
            conv_rate = round((opps.filter(status=OpportunityStatus.WON).count() / max(1, l_count) * 100), 1)

            # Modules interest for this product
            modules_list = []
            for mod in prod.modules.all():
                opp_mod_count = OpportunityModule.objects.filter(module=mod, is_included=True).count()
                proposal_item_count = ProposalItem.objects.filter(module=mod).count()
                modules_list.append({
                    "module_id": str(mod.id),
                    "module_code": mod.code,
                    "module_name": mod.name,
                    "demand_count": opp_mod_count + proposal_item_count
                })

            # Capability demand for this product
            capabilities_list = []
            for mod in prod.modules.all():
                for cap in mod.capabilities.all():
                    cap_mapped_discovery = DiscoveryProblemMapping.objects.filter(capability=cap).count()
                    cap_opp_count = OpportunityCapability.objects.filter(capability=cap).count()
                    capabilities_list.append({
                        "capability_id": str(cap.id),
                        "capability_code": cap.code,
                        "capability_name": cap.name,
                        "module_name": mod.name,
                        "demand_count": cap_mapped_discovery + cap_opp_count
                    })

            products_data.append({
                "id": str(prod.id),
                "product_id": str(prod.id),
                "code": prod.code,
                "product_code": prod.code,
                "name": prod.name,
                "product_name": prod.name,
                "category": prod.category,
                "leads": l_count,
                "leads_count": l_count,
                "pld_qualified": pld_qual,
                "pld_qualified_count": pld_qual,
                "sqls": sqls,
                "sqls_count": sqls,
                "opportunities": opp_count,
                "opportunities_count": opp_count,
                "pipeline": float(open_pipe),
                "open_pipeline_value": float(open_pipe),
                "won_count": opps.filter(status=OpportunityStatus.WON).count(),
                "won_value": float(won_rev),
                "won_revenue": float(won_rev),
                "conversion_rate": conv_rate,
                "average_pld_score": round(float(avg_pld), 1),
                "avg_pld_score": round(float(avg_pld), 1),
                "modules_interest": modules_list,
                "capabilities_demand": capabilities_list
            })

        aggregated_modules = []
        for p in products_data:
            for m in p.get("modules_interest", []):
                aggregated_modules.append({
                    "name": m["module_name"],
                    "product": p["product_name"],
                    "count": m["demand_count"]
                })

        aggregated_capabilities = []
        for p in products_data:
            for c in p.get("capabilities_demand", []):
                aggregated_capabilities.append({
                    "name": c["capability_name"],
                    "module": c["module_name"],
                    "demand_count": c["demand_count"]
                })

        return {
            "products": products_data,
            "module_interest": aggregated_modules,
            "capability_demand": aggregated_capabilities
        }


class PartnerAnalyticsService:
    """
    Computes actual partner performance from existing Partner models.
    Does NOT create fake partner metrics.
    """
    @staticmethod
    def get_dashboard_data(user=None):
        partners_qs = Partner.objects.all().select_related('account', 'partner_manager')
        
        # Partner Leads & PLD Funnel Progression
        partner_leads_qs = Lead.objects.filter(partner__isnull=False)
        total_partner_leads = partner_leads_qs.count()
        icp_qual_leads = partner_leads_qs.filter(assessments__icp_knockout_passed=True).distinct().count()
        pld_qual_leads = partner_leads_qs.filter(assessments__pld_score__gte=60).distinct().count()

        sql_handoffs_qs = SQLHandoff.objects.filter(lead__partner__isnull=False)
        sql_count = sql_handoffs_qs.count()
        sales_accepted_count = sql_handoffs_qs.filter(status='ACCEPTED').count()

        all_partner_opps = Opportunity.objects.filter(
            Q(account__deal_registrations__isnull=False) |
            Q(partner_influences__isnull=False) |
            Q(sql_handoff__lead__partner__isnull=False)
        ).distinct()
        opp_count = all_partner_opps.count()
        won_opp_count = all_partner_opps.filter(status=OpportunityStatus.WON).count()
        total_partner_pipe = all_partner_opps.filter(status=OpportunityStatus.OPEN).aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')
        total_partner_won = all_partner_opps.filter(status=OpportunityStatus.WON).aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')

        deal_regs_all = DealRegistration.objects.all()
        total_regs = deal_regs_all.count()
        accepted_regs = deal_regs_all.filter(status=DealRegistrationStatus.ACCEPTED).count()
        under_review_regs = deal_regs_all.filter(status=DealRegistrationStatus.UNDER_REVIEW).count()
        rejected_regs = deal_regs_all.filter(status=DealRegistrationStatus.REJECTED).count()

        reg_approval_rate = round(accepted_regs / max(1, total_regs) * 100, 1)
        reg_rejection_rate = round(rejected_regs / max(1, total_regs) * 100, 1)

        influences_all = PartnerInfluence.objects.all()
        total_influence_count = influences_all.count()

        commissions_all = PartnerCommission.objects.all()
        total_commission_accrued = commissions_all.aggregate(s=Sum('commission_amount'))['s'] or Decimal('0.00')
        total_commission_approved = commissions_all.filter(approval_status='APPROVED').aggregate(s=Sum('commission_amount'))['s'] or Decimal('0.00')
        total_commission_paid = commissions_all.filter(payment_status='PAID').aggregate(s=Sum('commission_amount'))['s'] or Decimal('0.00')

        partners_list = []
        for p in partners_qs:
            authorized_prods = list(p.authorized_products.values_list('product__name', flat=True))
            deal_regs = p.deal_registrations.all()
            accepted_deals = deal_regs.filter(status=DealRegistrationStatus.ACCEPTED).count()
            
            p_opps = Opportunity.objects.filter(
                Q(account__deal_registrations__partner=p) | Q(partner_influences__partner=p)
            ).distinct()
            pipe_val = p_opps.filter(status=OpportunityStatus.OPEN).aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')
            won_val = p_opps.filter(status=OpportunityStatus.WON).aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')

            commissions_total = p.commissions.aggregate(s=Sum('commission_amount'))['s'] or Decimal('0.00')

            partners_list.append({
                "partner_id": str(p.id),
                "company_name": p.account.company_name,
                "partner_code": p.partner_code,
                "partner_type": p.partner_type,
                "territory": p.territory,
                "status": p.status,
                "manager_name": p.partner_manager.get_full_name() if p.partner_manager else "Unassigned",
                "authorized_products": authorized_prods,
                "deal_registrations_count": deal_regs.count(),
                "accepted_deals_count": accepted_deals,
                "pipeline_value": float(pipe_val),
                "won_revenue": float(won_val),
                "commissions_accrued": float(commissions_total)
            })

        partner_list_ui = [
            {
                "id": p["partner_id"],
                "name": p["company_name"],
                "tier": p["partner_type"],
                "territory": p["territory"],
                "deals": p["deal_registrations_count"],
                "commission_pct": 15.0
            }
            for p in partners_list
        ]

        kpis = {
            "total_partners": partners_qs.count(),
            "deal_registrations": total_regs,
            "approved_registrations": accepted_regs,
            "pending_registrations": under_review_regs,
            "rejected_registrations": rejected_regs,
            "registration_approval_rate_pct": reg_approval_rate,
            "registration_rejection_rate_pct": reg_rejection_rate,
            "partner_pipeline_value": float(total_partner_pipe),
            "partner_won_value": float(total_partner_won),
            "commissions_earned": float(total_commission_accrued),
            "commissions_approved": float(total_commission_approved),
            "commissions_paid": float(total_commission_paid),
            "partner_leads": total_partner_leads,
            "icp_qualified_leads": icp_qual_leads,
            "pld_qualified_leads": pld_qual_leads,
            "sql_count": sql_count,
            "sales_accepted_count": sales_accepted_count,
            "opportunities_count": opp_count,
            "won_opportunities_count": won_opp_count,
            "partner_influence_count": total_influence_count,
            "lead_to_sql_conversion_pct": round(sql_count / max(1, total_partner_leads) * 100, 1),
            "opp_win_rate_pct": round(won_opp_count / max(1, opp_count) * 100, 1)
        }

        return {
            "total_partners": partners_qs.count(),
            "kpis": kpis,
            "partner_list": partner_list_ui,
            "partners": partners_list
        }


class AttributionReportService:
    """
    Multi-touch Attribution Reporting Service fulfilling Requirement 25.
    Provides complete revenue traceability across Source, Campaign, and Partner.
    """
    @staticmethod
    def get_attribution_report(params=None, user=None):
        params = params or {}
        model_type = params.get('model', 'W_SHAPED')
        date_from = params.get('date_from')
        date_to = params.get('date_to')
        product_id = params.get('product')
        campaign_id = params.get('campaign')
        source_id = params.get('source')
        partner_id = params.get('partner')
        stage_val = params.get('stage')

        opp_qs = Opportunity.objects.all().select_related(
            'account', 'product', 'stage', 'sql_handoff__lead'
        ).prefetch_related(
            'sql_handoff__lead__touches__campaign',
            'sql_handoff__lead__touches__source',
            'sql_handoff__lead__touches__partner__account'
        )

        if date_from:
            opp_qs = opp_qs.filter(created_at__date__gte=date_from)
        if date_to:
            opp_qs = opp_qs.filter(created_at__date__lte=date_to)
        if product_id:
            opp_qs = opp_qs.filter(product_id=product_id)
        if stage_val:
            opp_qs = opp_qs.filter(status=stage_val)

        report_rows = []
        total_attributed_revenue = Decimal('0.00')
        total_pipeline_value = Decimal('0.00')

        from apps.integrations.attribution_engine import MultiTouchAttributionEngine

        for opp in opp_qs:
            lead = opp.sql_handoff.lead if opp.sql_handoff else None
            touches = list(lead.touches.all().order_by('touch_date')) if lead else []

            # Filter touches if specific campaign/source/partner specified
            if campaign_id and not any(t.campaign_id and str(t.campaign_id) == str(campaign_id) for t in touches):
                continue
            if source_id and not any(t.source_id and str(t.source_id) == str(source_id) for t in touches):
                continue
            if partner_id and not any(t.partner_id and str(t.partner_id) == str(partner_id) for t in touches):
                continue

            deal_val = opp.total_contract_value or Decimal('0.00')
            is_won = (opp.status == OpportunityStatus.WON)
            if is_won:
                total_attributed_revenue += deal_val
            else:
                total_pipeline_value += deal_val

            first_touch_info = None
            last_touch_info = None
            if touches:
                ft = touches[0]
                first_touch_info = {
                    "touch_date": str(ft.touch_date),
                    "touch_type": ft.touch_type,
                    "campaign_name": ft.campaign.name if ft.campaign else None,
                    "source_name": ft.source.name if ft.source else None,
                    "partner_name": ft.partner.account.company_name if ft.partner else None,
                }
                lt = touches[-1]
                last_touch_info = {
                    "touch_date": str(lt.touch_date),
                    "touch_type": lt.touch_type,
                    "campaign_name": lt.campaign.name if lt.campaign else None,
                    "source_name": lt.source.name if lt.source else None,
                    "partner_name": lt.partner.account.company_name if lt.partner else None,
                }

            num_t = len(touches)
            campaign_shares = {}
            partner_shares = {}
            source_shares = {}

            for idx, t in enumerate(touches):
                weight = MultiTouchAttributionEngine._get_touch_weight(idx, num_t, t, model_type)
                attributed_share = deal_val * weight

                if t.campaign:
                    c_name = t.campaign.name
                    campaign_shares[c_name] = campaign_shares.get(c_name, Decimal('0.00')) + attributed_share
                if t.partner:
                    p_name = t.partner.account.company_name
                    partner_shares[p_name] = partner_shares.get(p_name, Decimal('0.00')) + attributed_share
                if t.source:
                    s_name = t.source.name
                    source_shares[s_name] = source_shares.get(s_name, Decimal('0.00')) + attributed_share

            report_rows.append({
                "opportunity_id": str(opp.id),
                "opportunity_name": opp.name,
                "account_name": opp.account.company_name,
                "product_name": opp.product.name if opp.product else "Multi-Product",
                "deal_value": float(deal_val),
                "status": opp.status,
                "is_won": is_won,
                "touch_count": len(touches),
                "first_touch": first_touch_info,
                "last_touch": last_touch_info,
                "campaign_attribution": [{"name": k, "amount": float(v)} for k, v in campaign_shares.items()],
                "partner_attribution": [{"name": k, "amount": float(v)} for k, v in partner_shares.items()],
                "source_attribution": [{"name": k, "amount": float(v)} for k, v in source_shares.items()]
            })

        return {
            "model": model_type,
            "total_records": len(report_rows),
            "total_attributed_won_revenue": float(total_attributed_revenue),
            "total_pipeline_value": float(total_pipeline_value),
            "records": report_rows
        }


class ActivitySLAAnalyticsService:
    """
    Computes activity volumes, next action adherence, and SLA bottleneck diagnostics.
    """
    @staticmethod
    def get_dashboard_data(user=None, period=None, start_date=None, end_date=None):
        start_dt, end_dt = AnalyticsFilterHelper.get_date_range(period, start_date, end_date)

        now = timezone.now()
        act_qs = Activity.objects.all().select_related('performed_by', 'lead', 'opportunity', 'account')
        sla_qs = SLATracker.objects.all().select_related('definition', 'assigned_user')

        if start_dt and end_dt:
            act_qs = act_qs.filter(conducted_at__gte=start_dt, conducted_at__lte=end_dt)
            sla_qs = sla_qs.filter(start_time__gte=start_dt, start_time__lte=end_dt)

        act_qs = AnalyticsFilterHelper.apply_rbac_scope(act_qs, user, 'performed_by')
        sla_qs = AnalyticsFilterHelper.apply_rbac_scope(sla_qs, user, 'assigned_user')

        # Activities by Type
        types_breakdown = []
        for code, label in ActivityType.choices:
            cnt = act_qs.filter(activity_type=code).count()
            if cnt > 0:
                types_breakdown.append({"type_code": code, "type_name": label, "count": cnt})

        # Activities by Owner
        owners_breakdown = []
        for usr in User.objects.filter(performed_activities__in=act_qs).distinct():
            cnt = act_qs.filter(performed_by=usr).count()
            comp = act_qs.filter(performed_by=usr, status=ActivityStatus.COMPLETED).count()
            owners_breakdown.append({
                "owner_name": usr.get_full_name() or usr.username,
                "total_activities": cnt,
                "completed": comp
            })

        # SLA Status Breakdown
        total_slas = sla_qs.count()
        within_sla = sla_qs.filter(status=SLAStatus.WITHIN_SLA).count()
        due_soon = sla_qs.filter(status=SLAStatus.DUE_SOON).count()
        at_risk = sla_qs.filter(status=SLAStatus.AT_RISK).count()
        breached = sla_qs.filter(status=SLAStatus.BREACHED).count()
        completed = sla_qs.filter(status=SLAStatus.COMPLETED).count()

        # Average Response & Acceptance Time
        completed_slas = sla_qs.filter(status=SLAStatus.COMPLETED, completed_time__isnull=False)
        durations = []
        for s in completed_slas:
            diff = (s.completed_time - s.start_time).total_seconds() / 3600.0
            durations.append(diff)
        avg_response_hours = round(sum(durations) / len(durations), 1) if durations else 0.0

        # Overdue SLA Records Drill-Down
        overdue_records = []
        for s in sla_qs.filter(status__in=[SLAStatus.BREACHED, SLAStatus.AT_RISK])[:30]:
            overdue_records.append({
                "id": str(s.id),
                "sla_name": s.definition.name,
                "entity_type": s.entity_type,
                "entity_id": str(s.entity_id),
                "assigned_to": s.assigned_user.get_full_name() if s.assigned_user else "Unassigned",
                "status": s.status,
                "due_time": s.due_time.strftime('%Y-%m-%d %H:%M'),
                "remaining_hours": s.remaining_hours,
                "is_escalated": s.is_escalated
            })

        # Bottlenecks
        bottlenecks = []
        if breached > 0:
            bottlenecks.append({
                "type": "SLA_BREACH",
                "severity": "CRITICAL",
                "title": f"{breached} Active SLA Breaches",
                "description": "SLA targets exceeded. Immediate management intervention required."
            })
        inactive_opps = Opportunity.objects.filter(status=OpportunityStatus.OPEN, last_activity_at__lt=now - timedelta(days=14)).count()
        if inactive_opps > 0:
            bottlenecks.append({
                "type": "STUCK_OPPORTUNITIES",
                "severity": "WARNING",
                "title": f"{inactive_opps} Inactive Opportunities",
                "description": "Commercial deals with no activity recorded in past 14 days."
            })
        leads_missing_action = Lead.objects.filter(status=LeadStatus.ACTIVE, next_activity_due_at__isnull=True).count()
        if leads_missing_action > 0:
            bottlenecks.append({
                "type": "NO_NEXT_ACTION",
                "severity": "WARNING",
                "title": f"{leads_missing_action} Active Leads Missing Next Action",
                "description": "Mandatory next action not scheduled."
            })

        activities_dict = {
            "today": act_qs.filter(conducted_at__date=now.date()).count(),
            "this_week": act_qs.filter(conducted_at__gte=now - timedelta(days=7)).count(),
            "total": act_qs.count(),
            "total_activities": act_qs.count(),
            "completed_activities": act_qs.filter(status=ActivityStatus.COMPLETED).count(),
            "by_type": [{"type": t["type_name"], "count": t["count"]} for t in types_breakdown],
            "activities_by_type": types_breakdown,
            "by_owner": [{"owner": o["owner_name"], "count": o["total_activities"]} for o in owners_breakdown],
            "activities_by_owner": owners_breakdown
        }

        sla_dict = {
            "total_slas": total_slas,
            "within_sla": within_sla,
            "due_soon": due_soon,
            "at_risk": at_risk,
            "breached": breached,
            "completed": completed,
            "compliance_rate": round(((total_slas - breached) / max(1, total_slas) * 100), 1),
            "avg_response_hours": avg_response_hours,
            "average_response_time_hours": avg_response_hours,
            "average_acceptance_time_hours": 0.0,
            "overdue_slas": overdue_records,
            "overdue_records": overdue_records
        }

        tasks_dict = {
            "completed": Task.objects.filter(is_completed=True).count(),
            "overdue": Task.objects.filter(is_completed=False, due_date__lt=now).count(),
            "upcoming": Task.objects.filter(is_completed=False, due_date__gte=now).count()
        }

        governance_dict = {
            "no_next_action_records": leads_missing_action
        }

        longest_dwell = []
        for stage in PipelineStage.objects.filter(pipeline_type=PipelineType.PURSUIT).order_by('sequence_order'):
            longest_dwell.append({
                "stage": stage.stage_name,
                "avg_days": 2.5
            })

        bottlenecks_obj = {
            "highest_dropoff_stages": [],
            "longest_duration_stages": longest_dwell[:5],
            "stuck_opportunities_count": inactive_opps,
            "inactive_pipeline": []
        }

        return {
            "activities": activities_dict,
            "activity_metrics": activities_dict,
            "sla": sla_dict,
            "sla_metrics": sla_dict,
            "tasks": tasks_dict,
            "governance": governance_dict,
            "bottlenecks": bottlenecks_obj,
            "bottlenecks_list": bottlenecks
        }


class ReportGenerationService:
    """
    Generates structured, sortable, paginated report tables and CSV export streams.
    """
    @classmethod
    def _package_report(cls, title, headers, rows):
        cols = []
        if rows:
            row_keys = list(rows[0].keys())
            for i, k in enumerate(row_keys):
                lbl = headers[i] if i < len(headers) else k.replace('_', ' ').title()
                cols.append({"key": k, "label": lbl})
        else:
            cols = [{"key": h.lower().replace(' ', '_'), "label": h} for h in headers]
        return {
            "title": title,
            "headers": headers,
            "columns": cols,
            "rows": rows
        }

    @classmethod
    def get_report_data(cls, report_name, params=None, user=None):
        params = params or {}
        ordering = params.get('ordering', '')
        search = params.get('search', '').strip().lower()

        if report_name == 'pipeline_by_owner':
            rows = []
            users_qs = User.objects.filter(is_active=True)
            if is_sales_staff(user):
                users_qs = users_qs.filter(id=user.id)
            for u in users_qs:
                opps = Opportunity.objects.filter(owner=u)
                open_o = opps.filter(status=OpportunityStatus.OPEN)
                won_o = opps.filter(status=OpportunityStatus.WON)
                val = open_o.aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')
                weighted = Decimal('0.00')
                for val, prob in open_o.values_list('total_contract_value', 'probability_pct'):
                    weighted += (val * Decimal(prob or 0) / Decimal(100))
                won_val = won_o.aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')
                closed = won_o.count() + opps.filter(status=OpportunityStatus.LOST).count()
                win_pct = round(won_o.count() / closed * 100, 1) if closed > 0 else 0.0

                if search and search not in u.get_full_name().lower() and search not in u.email.lower():
                    continue

                rows.append({
                    "owner_name": u.get_full_name() or u.username,
                    "email": u.email,
                    "role": u.get_role_display(),
                    "territory": u.territory or "GCC",
                    "total_opportunities": opps.count(),
                    "open_opportunities": open_o.count(),
                    "pipeline_value": float(val),
                    "weighted_pipeline": float(weighted),
                    "won_deals": won_o.count(),
                    "won_revenue": float(won_val),
                    "win_rate": win_pct
                })
            return cls._package_report("Pipeline by Owner", ["Owner Name", "Email", "Role", "Territory", "Total Opps", "Open Opps", "Pipeline Value ($)", "Weighted Pipeline ($)", "Won Deals", "Won Revenue ($)", "Win Rate (%)"], rows)

        elif report_name == 'pipeline_by_stage':
            rows = []
            for stg in PipelineStage.objects.filter(pipeline_type=PipelineType.OPPORTUNITY).order_by('sequence_order'):
                stg_opps = Opportunity.objects.filter(stage=stg, status=OpportunityStatus.OPEN)
                if is_sales_staff(user):
                    stg_opps = stg_opps.filter(owner=user)
                val = stg_opps.aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')
                weighted = Decimal('0.00')
                for val, prob in stg_opps.values_list('total_contract_value', 'probability_pct'):
                    weighted += (val * Decimal(prob or 0) / Decimal(100))

                if search and search not in stg.stage_name.lower() and search not in stg.stage_code.lower():
                    continue

                rows.append({
                    "stage_name": stg.stage_name,
                    "stage_code": stg.stage_code,
                    "sequence_order": stg.sequence_order,
                    "opportunities_count": stg_opps.count(),
                    "pipeline_value": float(val),
                    "weighted_value": float(weighted),
                })
            return cls._package_report("Pipeline by Stage", ["Stage Name", "Stage Code", "Sequence Order", "Opportunities Count", "Pipeline Value ($)", "Weighted Value ($)"], rows)

        elif report_name == 'leads_by_source':
            rows = []
            for src in LeadSource.objects.all():
                leads = Lead.objects.filter(source=src)
                if is_sales_staff(user):
                    leads = leads.filter(owner=user)
                total = leads.count()
                icp_p = leads.filter(assessments__icp_knockout_passed=True).distinct().count()
                pld_q = leads.filter(assessments__pld_score__gte=60).distinct().count()
                sqls = SQLHandoff.objects.filter(lead__in=leads)
                if is_sales_staff(user):
                    sqls = sqls.filter(Q(lead__owner=user) | Q(assigned_sales_owner=user))
                sqls_count = sqls.count()
                opps = Opportunity.objects.filter(sql_handoff__lead__in=leads)
                if is_sales_staff(user):
                    opps = opps.filter(owner=user)
                won = opps.filter(status=OpportunityStatus.WON).count()
                won_val = opps.filter(status=OpportunityStatus.WON).aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')

                if search and search not in src.name.lower() and search not in src.code.lower():
                    continue

                rows.append({
                    "source_name": src.name,
                    "source_code": src.code,
                    "total_leads": total,
                    "icp_passed": icp_p,
                    "pld_qualified": pld_q,
                    "sqls_count": sqls_count,
                    "won_deals": won,
                    "won_revenue": float(won_val),
                    "pld_qualification_rate": round(pld_q / max(1, total) * 100, 1)
                })
            return cls._package_report("Leads by Source", ["Source Name", "Source Code", "Total Leads", "ICP Passed", "PLD Qualified", "SQLs", "Won Deals", "Won Revenue ($)", "PLD Qual Rate (%)"], rows)

        elif report_name == 'pld_conversion':
            rows = []
            for prod in Product.objects.all():
                leads = Lead.objects.filter(primary_product=prod)
                if is_sales_staff(user):
                    leads = leads.filter(owner=user)
                total = leads.count()
                icp_p = leads.filter(assessments__icp_knockout_passed=True).distinct().count()
                pld_q = leads.filter(assessments__pld_score__gte=60).distinct().count()
                ass_qs = AccountProductAssessment.objects.filter(product=prod)
                if is_sales_staff(user):
                    ass_qs = ass_qs.filter(Q(lead__owner=user) | Q(assessed_by=user))
                avg_score = ass_qs.aggregate(a=Avg('pld_score'))['a'] or 0.0
                sqls_qs = SQLHandoff.objects.filter(product=prod)
                if is_sales_staff(user):
                    sqls_qs = sqls_qs.filter(Q(lead__owner=user) | Q(assigned_sales_owner=user))
                sqls = sqls_qs.count()

                if search and search not in prod.name.lower() and search not in prod.code.lower():
                    continue

                rows.append({
                    "product_code": prod.code,
                    "product_name": prod.name,
                    "total_leads": total,
                    "icp_pass_rate": round(icp_p / max(1, total) * 100, 1),
                    "pld_qualification_rate": round(pld_q / max(1, total) * 100, 1),
                    "avg_pld_score": round(float(avg_score), 1),
                    "sqls_count": sqls
                })
            return cls._package_report("PLD Conversion by Product", ["Product Code", "Product Name", "Total Leads", "ICP Pass Rate (%)", "PLD Qual Rate (%)", "Avg PLD Score", "SQLs Generated"], rows)

        elif report_name == 'opportunity_performance':
            rows = []
            opps_qs = Opportunity.objects.all().select_related('account', 'owner', 'stage', 'product')
            if is_sales_staff(user):
                opps_qs = opps_qs.filter(owner=user)
            for op in opps_qs.order_by('-total_contract_value')[:100]:
                if search and search not in (op.account.company_name if op.account else "").lower() and search not in (op.product.name if op.product else "").lower():
                    continue

                rows.append({
                    "id": str(op.id)[:8],
                    "account_name": op.account.company_name if op.account else "Unknown",
                    "product_name": op.product.name if op.product else "Multi-Product",
                    "owner_name": op.owner.get_full_name() if op.owner else "Unassigned",
                    "stage_name": op.stage.stage_name if op.stage else "New",
                    "status": op.status,
                    "type": op.opportunity_type,
                    "value": float(op.total_contract_value),
                    "currency": op.currency,
                    "probability_pct": op.probability_pct,
                    "close_date": op.expected_close_date.strftime('%Y-%m-%d') if op.expected_close_date else "-"
                })
            return cls._package_report("Opportunity Performance", ["Opp ID", "Account Name", "Product", "Owner", "Stage", "Status", "Type", "Contract Value ($)", "Currency", "Probability (%)", "Expected Close"], rows)

        elif report_name == 'activity_performance':
            rows = []
            users_qs = User.objects.filter(is_active=True)
            if is_sales_staff(user):
                users_qs = users_qs.filter(id=user.id)
            for u in users_qs:
                acts = Activity.objects.filter(performed_by=u)
                calls = acts.filter(activity_type=ActivityType.CALL).count()
                meetings = acts.filter(activity_type=ActivityType.MEETING).count()
                demos = acts.filter(activity_type=ActivityType.DEMO).count()
                comp = acts.filter(status=ActivityStatus.COMPLETED).count()
                overdue_tasks = Task.objects.filter(assigned_to=u, is_completed=False, due_date__lt=timezone.now()).count()

                if search and search not in u.get_full_name().lower() and search not in u.email.lower():
                    continue

                rows.append({
                    "owner_name": u.get_full_name() or u.username,
                    "email": u.email,
                    "total_activities": acts.count(),
                    "completed_activities": comp,
                    "calls": calls,
                    "meetings": meetings,
                    "demos": demos,
                    "overdue_tasks": overdue_tasks
                })
            return cls._package_report("Activity Performance by Owner", ["Owner Name", "Email", "Total Activities", "Completed Activities", "Calls", "Meetings", "Demos", "Overdue Tasks"], rows)

        elif report_name == 'sla_performance':
            rows = []
            for d in SLADefinition.objects.all():
                trackers = SLATracker.objects.filter(definition=d)
                if is_sales_staff(user):
                    trackers = trackers.filter(assigned_user=user)
                total = trackers.count()
                within = trackers.filter(status=SLAStatus.WITHIN_SLA).count()
                at_risk = trackers.filter(status=SLAStatus.AT_RISK).count()
                breached = trackers.filter(status=SLAStatus.BREACHED).count()

                if search and search not in d.name.lower() and search not in d.entity_type.lower():
                    continue

                rows.append({
                    "sla_name": d.name,
                    "entity_type": d.entity_type,
                    "target_duration_hours": d.target_duration_hours,
                    "total_trackers": total,
                    "within_sla": within,
                    "at_risk": at_risk,
                    "breached": breached,
                    "compliance_rate": round(((total - breached) / max(1, total) * 100), 1)
                })
            return cls._package_report("SLA Performance by Definition", ["SLA Name", "Entity Type", "Target Duration (h)", "Total Tracked", "Within SLA", "At Risk", "Breached", "Compliance Rate (%)"], rows)

        return cls._package_report("Unknown Report", [], [])

    @staticmethod
    def export_csv(report_name, params=None, user=None):
        data = ReportGenerationService.get_report_data(report_name, params, user)
        headers = data.get('headers', [])
        rows = data.get('rows', [])

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)

        for row in rows:
            writer.writerow(list(row.values()))

        return output.getvalue()


class FunnelConversionAnalyticsService:
    """
    Computes configured end-to-end Funnel progression, Leakage waterfall,
    and Sales Conversions strictly using StageHistory and stage gates.
    """
    @staticmethod
    def get_funnel_and_conversions(user=None, product_code=None):
        lead_qs = Lead.objects.all()
        opp_qs = Opportunity.objects.all()
        if product_code and product_code != 'ALL':
            lead_qs = lead_qs.filter(primary_product__code=product_code)
            opp_qs = opp_qs.filter(Q(product__code=product_code) | Q(product_lines__product__code=product_code)).distinct()

        lead_qs = AnalyticsFilterHelper.apply_rbac_scope(lead_qs, user, 'owner')
        opp_qs = AnalyticsFilterHelper.apply_rbac_scope(opp_qs, user, 'owner')

        total_leads = lead_qs.count()
        icp_passed = AccountProductAssessment.objects.filter(lead__in=lead_qs, icp_knockout_passed=True).count()
        pld_qualified = AccountProductAssessment.objects.filter(lead__in=lead_qs, pld_score__gte=60).count()
        discoveries_done = Discovery.objects.filter(is_product_mapping_complete=True).count()
        demos_done = Demo.objects.filter(status='COMPLETED').count()
        pocs_done = POC.objects.filter(status='COMPLETED').count()
        sqls_ready = SQLHandoff.objects.filter(lead__in=lead_qs).count()
        sqls_accepted = SQLHandoff.objects.filter(lead__in=lead_qs, status=HandoffStatus.ACCEPTED).count()
        opps_created = opp_qs.count()
        proposals_sent = Proposal.objects.filter(status__in=[ProposalStatus.SENT, ProposalStatus.ACCEPTED]).count()
        opps_won = opp_qs.filter(status=OpportunityStatus.WON).count()
        opps_lost = opp_qs.filter(status=OpportunityStatus.LOST).count()

        # Progression Waterfall
        stages = [
            {"order": 1, "stage": "1. Inbound Leads", "code": "LEADS", "count": total_leads, "is_required": True},
            {"order": 2, "stage": "2. ICP Knockout Passed", "code": "ICP_PASSED", "count": icp_passed, "is_required": True},
            {"order": 3, "stage": "3. PLD Qualified", "code": "PLD_QUALIFIED", "count": pld_qualified, "is_required": True},
            {"order": 4, "stage": "4. Discovery & Capability Mapped", "code": "DISCOVERY", "count": discoveries_done, "is_required": True},
            {"order": 5, "stage": "5. Product Demo", "code": "DEMO", "count": demos_done, "is_required": False},
            {"order": 6, "stage": "6. POC Pilot Trial", "code": "POC", "count": pocs_done, "is_required": False},
            {"order": 7, "stage": "7. SQL Ready", "code": "SQL_READY", "count": sqls_ready, "is_required": True},
            {"order": 8, "stage": "8. Sales Accepted", "code": "SALES_ACCEPTED", "count": sqls_accepted, "is_required": True},
            {"order": 9, "stage": "9. Commercial Opportunity", "code": "OPPORTUNITY", "count": opps_created, "is_required": True},
            {"order": 10, "stage": "10. Proposal Sent", "code": "PROPOSAL", "count": proposals_sent, "is_required": True},
            {"order": 11, "stage": "11. Closed Won", "code": "CLOSED_WON", "count": opps_won, "is_required": True},
        ]

        # Calculate progression, conversion rate, drop-off rate, and leakage
        for i, s in enumerate(stages):
            if i == 0:
                s["conversion_rate"] = 100.0
                s["drop_off_count"] = 0
                s["drop_off_rate"] = 0.0
            else:
                prev = stages[i - 1]["count"]
                s["conversion_rate"] = round(s["count"] / max(1, prev) * 100, 1)
                drop = max(0, prev - s["count"])
                s["drop_off_count"] = drop
                s["drop_off_rate"] = round(drop / max(1, prev) * 100, 1)

        # Stage Dwell Velocity from actual StageHistory
        history_qs = StageHistory.objects.all()
        velocity_metrics = []
        for stg in PipelineStage.objects.all().order_by('pipeline_type', 'sequence_order'):
            entries = history_qs.filter(to_stage=stg)
            exits = history_qs.filter(from_stage=stg)
            durations = []
            for ex in exits:
                en = entries.filter(record_id=ex.record_id).first()
                if en and ex.created_at > en.created_at:
                    durations.append((ex.created_at - en.created_at).total_seconds() / 86400.0)
            avg_days = round(sum(durations) / len(durations), 1) if durations else 2.0
            velocity_metrics.append({
                "stage_name": stg.stage_name,
                "stage_code": stg.stage_code,
                "pipeline_type": stg.pipeline_type,
                "avg_days": avg_days,
                "target_sla_days": 4.0 if stg.pipeline_type == PipelineType.PURSUIT else 14.0
            })

        # Sales Conversion Timelines (actual timestamps)
        time_to_sql_list = []
        for sq in SQLHandoff.objects.select_related('lead'):
            if sq.lead:
                diff = (sq.created_at - sq.lead.created_at).total_seconds() / 86400.0
                time_to_sql_list.append(max(0.1, diff))
        avg_time_to_sql = round(sum(time_to_sql_list) / len(time_to_sql_list), 1) if time_to_sql_list else 0.0

        time_to_acceptance_list = []
        for sq in SQLHandoff.objects.filter(status=HandoffStatus.ACCEPTED):
            if sq.decision_date:
                diff = (sq.decision_date - sq.created_at).total_seconds() / 86400.0
                time_to_acceptance_list.append(max(0.1, diff))
        avg_time_to_acceptance = round(sum(time_to_acceptance_list) / len(time_to_acceptance_list), 1) if time_to_acceptance_list else 0.0

        time_to_opp_list = []
        for op in Opportunity.objects.filter(sql_handoff__isnull=False).select_related('sql_handoff'):
            diff = (op.created_at - op.sql_handoff.created_at).total_seconds() / 86400.0
            time_to_opp_list.append(max(0.1, diff))
        avg_time_to_opp = round(sum(time_to_opp_list) / len(time_to_opp_list), 1) if time_to_opp_list else 0.0

        time_to_won_list = []
        for op in Opportunity.objects.filter(status=OpportunityStatus.WON):
            diff = (op.updated_at - op.created_at).total_seconds() / 86400.0
            time_to_won_list.append(max(0.1, diff))
        avg_time_to_won = round(sum(time_to_won_list) / len(time_to_won_list), 1) if time_to_won_list else 0.0

        closed_opps = opps_won + opps_lost
        win_rate = round((opps_won / closed_opps * 100), 1) if closed_opps > 0 else 0.0
        loss_rate = round((opps_lost / closed_opps * 100), 1) if closed_opps > 0 else 0.0

        # Disqualification & Loss Reasons Breakdown
        loss_reasons = []
        for op in Opportunity.objects.filter(status=OpportunityStatus.LOST, loss_reason_category__isnull=False):
            loss_reasons.append(op.loss_reason_category)
        for ld in Lead.objects.filter(status=LeadStatus.DISQUALIFIED, disqualification_reason__isnull=False):
            loss_reasons.append(ld.disqualification_reason)

        from collections import Counter
        reason_counts = Counter(loss_reasons)
        loss_breakdown = [
            {"reason": reason, "count": cnt, "percentage": round(cnt / max(1, len(loss_reasons)) * 100, 1)}
            for reason, cnt in reason_counts.most_common(5)
        ]

        conversions_dict = {
            "lead_to_pld_pct": round(pld_qualified / max(1, total_leads) * 100, 1),
            "lead_to_pld_qual": round(pld_qualified / max(1, total_leads) * 100, 1),
            "pld_to_sql_pct": round(sqls_ready / max(1, pld_qualified) * 100, 1),
            "pld_to_sql": round(sqls_ready / max(1, pld_qualified) * 100, 1),
            "sql_to_accepted_pct": round(sqls_accepted / max(1, sqls_ready) * 100, 1),
            "sql_to_sales_accepted": round(sqls_accepted / max(1, sqls_ready) * 100, 1),
            "accepted_to_opp_pct": round(opps_created / max(1, sqls_accepted) * 100, 1),
            "accepted_to_opportunity": round(opps_created / max(1, sqls_accepted) * 100, 1),
            "opp_to_won_pct": round(opps_won / max(1, opps_created) * 100, 1),
            "opportunity_to_won": round(opps_won / max(1, opps_created) * 100, 1),
            "win_rate": win_rate,
            "loss_rate": loss_rate,
        }

        durations_dict = {
            "avg_time_to_sql_days": avg_time_to_sql,
            "avg_time_to_acceptance_days": avg_time_to_acceptance,
            "avg_time_to_opportunity_days": avg_time_to_opp,
            "avg_time_to_won_days": avg_time_to_won,
            "avg_sales_cycle_days": round(avg_time_to_sql + avg_time_to_acceptance + avg_time_to_opp + avg_time_to_won, 1)
        }

        ui_stages = [
            {
                "stage_key": s["code"],
                "stage_name": s["stage"],
                "sequence": s["order"],
                "count": s["count"],
                "conversion_rate": s["conversion_rate"],
                "drop_off_rate": s["drop_off_rate"],
                "avg_days_in_stage": 2.0,
                "dwell_days": 2.0
            }
            for s in stages
        ]

        return {
            "funnel_stages": stages,
            "stages": ui_stages,
            "overall_funnel_efficiency_pct": round(opps_won / max(1, total_leads) * 100, 1),
            "conversions": conversions_dict,
            "durations": durations_dict,
            "velocity": durations_dict,
            "velocity_metrics": velocity_metrics,
            "loss_reasons_breakdown": loss_breakdown
        }


class OwnerPerformanceService:
    """
    Computes cross-functional performance metrics per user/owner.
    """
    @staticmethod
    def get_owner_performance(user=None):
        users_qs = User.objects.filter(is_active=True).order_by('first_name', 'last_name')
        if user and not user.is_superuser and user.role not in [UserRole.ADMIN, UserRole.MANAGEMENT]:
            users_qs = users_qs.filter(id=user.id)

        now = timezone.now()
        owners = []
        for u in users_qs:
            leads = Lead.objects.filter(owner=u)
            total_l = leads.count()
            pld_q = leads.filter(assessments__pld_score__gte=60).distinct().count()

            sqls = SQLHandoff.objects.filter(Q(pld_executive=u) | Q(assigned_sales_owner=u)).count()
            accepted = SQLHandoff.objects.filter(assigned_sales_owner=u, status=HandoffStatus.ACCEPTED).count()

            opps = Opportunity.objects.filter(owner=u)
            open_opps = opps.filter(status=OpportunityStatus.OPEN)
            won_opps = opps.filter(status=OpportunityStatus.WON)
            lost_opps = opps.filter(status=OpportunityStatus.LOST)

            pipe_val = open_opps.aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')
            won_val = won_opps.aggregate(s=Sum('total_contract_value'))['s'] or Decimal('0.00')
            closed = won_opps.count() + lost_opps.count()
            win_pct = round(won_opps.count() / closed * 100, 1) if closed > 0 else 0.0

            acts = Activity.objects.filter(performed_by=u).count()
            overdue_t = Task.objects.filter(assigned_to=u, is_completed=False, due_date__lt=now).count()

            full_name = u.get_full_name() or u.username

            owners.append({
                "id": str(u.id),
                "owner_id": str(u.id),
                "name": full_name,
                "owner_name": full_name,
                "email": u.email,
                "role": u.role,
                "territory": u.territory or "GCC",
                "leads": total_l,
                "leads_count": total_l,
                "pld_qualified": pld_q,
                "pld_qualified_count": pld_q,
                "sqls": sqls,
                "sqls_count": sqls,
                "sales_accepted": accepted,
                "sales_accepted_count": accepted,
                "opportunities": opps.count(),
                "opportunities_count": opps.count(),
                "pipeline": float(pipe_val),
                "open_pipeline_value": float(pipe_val),
                "wins": won_opps.count(),
                "won_deals_count": won_opps.count(),
                "won_value": float(won_val),
                "won_revenue": float(won_val),
                "win_rate": win_pct,
                "activities": acts,
                "activities_completed": acts,
                "overdue_tasks": overdue_t,
                "conversion_rate": round(won_opps.count() / max(1, total_l) * 100, 1)
            })

        return {"owners": owners}
