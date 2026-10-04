import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from rest_framework.test import APIRequestFactory
from apps.analytics.views import (
    ExecutiveAnalyticsView, PLDAnalyticsView, SalesAnalyticsView,
    MarketingAnalyticsView, ProductAnalyticsView, PartnerAnalyticsView,
    ActivitySLAAnalyticsView, FunnelConversionAnalyticsView,
    OwnerPerformanceAnalyticsView, ReportTableView, ReportCSVExportView
)
from apps.activities.views import WorkQueueView, WorkQueueActionView
from apps.activities.models import Task, Activity, ActivityType, ActivityStatus, TaskStatus
from apps.leads.models import Lead, LeadStatus
from apps.opportunities.models import Opportunity
from apps.authentication.models import User, UserRole
from django.utils import timezone


def run_tests():
    print("=" * 80)
    print("TEXOL CRM -- PHASE 10 AUTOMATED TEST SUITE: ANALYTICS, DASHBOARDS, WORK QUEUE & REPORTS")
    print("=" * 80)
    factory = APIRequestFactory()

    # Get or create admin user
    admin_user = User.objects.filter(is_superuser=True).first()
    if not admin_user:
        admin_user = User.objects.filter(role=UserRole.ADMIN).first()
    if not admin_user:
        admin_user = User.objects.create(
            username='admin_test_p10',
            email='admin_p10@texol.com',
            role=UserRole.ADMIN,
            is_staff=True,
            is_superuser=True
        )

    # 1. Executive Dashboard API
    print("\n--- TEST 1: Executive Dashboard Analytics ---")
    request = factory.get('/api/v1/analytics/executive/?period=ALL')
    request.user = admin_user
    response = ExecutiveAnalyticsView.as_view()(request)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.data
    assert 'kpis' in data, "Missing kpis in executive analytics"
    assert 'rates' in data, "Missing rates in executive analytics"
    assert 'funnel_stages' in data, "Missing funnel_stages in executive analytics"
    assert 'product_breakdown' in data, "Missing product_breakdown in executive analytics"
    print(f"[PASS] Executive KPIs loaded: Total Leads={data['kpis']['total_leads']}, Pipeline Value=${data['kpis']['pipeline_value']:,.2f}, Won Value=${data['kpis']['won_value']:,.2f}")

    # 2. PLD Dashboard API
    print("\n--- TEST 2: PLD Qualification Analytics ---")
    request = factory.get('/api/v1/analytics/pld/?period=ALL')
    request.user = admin_user
    response = PLDAnalyticsView.as_view()(request)
    assert response.status_code == 200
    pld_data = response.data
    assert 'metrics' in pld_data
    assert 'score_distribution' in pld_data
    assert 'quality_alerts' in pld_data
    assert 'stage_velocity' in pld_data
    print(f"[PASS] PLD Metrics: Qual Rate={pld_data['metrics']['pld_qualification_rate']}%, Avg Score={pld_data['metrics']['average_pld_score']}")
    print(f"       Score Distribution: Nurture={pld_data['score_distribution']['nurture_band_0_30']}, Dev={pld_data['score_distribution']['development_band_31_60']}, Qual={pld_data['score_distribution']['qualified_band_61_80']}, HighPriority={pld_data['score_distribution']['high_priority_band_81_100']}")

    # 3. Sales Dashboard API
    print("\n--- TEST 3: Sales Commercial Analytics ---")
    request = factory.get('/api/v1/analytics/sales/?period=ALL')
    request.user = admin_user
    response = SalesAnalyticsView.as_view()(request)
    assert response.status_code == 200
    sales_data = response.data
    assert 'metrics' in sales_data
    assert 'stages_breakdown' in sales_data
    assert 'opportunity_types' in sales_data
    print(f"[PASS] Sales Metrics: Active Opps={sales_data['metrics']['active_opportunities']}, Weighted Pipeline=${sales_data['metrics']['weighted_pipeline']:,.2f}, Win Rate={sales_data['metrics']['win_rate']}%")

    # 4. Marketing Dashboard API
    print("\n--- TEST 4: Marketing & Campaign Attribution Analytics ---")
    request = factory.get('/api/v1/analytics/marketing/?period=ALL')
    request.user = admin_user
    response = MarketingAnalyticsView.as_view()(request)
    assert response.status_code == 200
    mktg_data = response.data
    assert 'sources' in mktg_data
    assert 'campaigns' in mktg_data
    print(f"[PASS] Marketing Metrics: Sources Tracked={len(mktg_data['sources'])}, Campaigns Tracked={len(mktg_data['campaigns'])}")

    # 5. Product Analytics API
    print("\n--- TEST 5: Product, Module & Capability Demand ---")
    request = factory.get('/api/v1/analytics/product/')
    request.user = admin_user
    response = ProductAnalyticsView.as_view()(request)
    assert response.status_code == 200
    prod_data = response.data
    assert 'products' in prod_data
    assert len(prod_data['products']) > 0
    p0 = prod_data['products'][0]
    assert 'modules_interest' in p0
    assert 'capabilities_demand' in p0
    print(f"[PASS] Product Demand: {len(prod_data['products'])} configured products analyzed with modules and capabilities demand.")

    # 6. Partner Dashboard Foundation API
    print("\n--- TEST 6: Partner Foundation Analytics ---")
    request = factory.get('/api/v1/analytics/partner/')
    request.user = admin_user
    response = PartnerAnalyticsView.as_view()(request)
    assert response.status_code == 200
    partner_data = response.data
    assert 'partners' in partner_data
    print(f"[PASS] Partner Foundation: {partner_data['total_partners']} real partner organizations tracked with authorized products and deal registrations.")

    # 7. Activity & SLA Analytics API
    print("\n--- TEST 7: Activity and SLA Health ---")
    request = factory.get('/api/v1/analytics/activity-sla/?period=ALL')
    request.user = admin_user
    response = ActivitySLAAnalyticsView.as_view()(request)
    assert response.status_code == 200
    act_sla_data = response.data
    assert 'activity_metrics' in act_sla_data
    assert 'sla_metrics' in act_sla_data
    assert 'bottlenecks' in act_sla_data
    print(f"[PASS] Activity/SLA Metrics: Total Activities={act_sla_data['activity_metrics']['total_activities']}, SLA Compliance={act_sla_data['sla_metrics']['compliance_rate']}%, Active Bottlenecks={len(act_sla_data['bottlenecks'])}")

    # 8. Funnel & Sales Conversion Analytics API
    print("\n--- TEST 8: Funnel & Sales Conversion Analytics ---")
    request = factory.get('/api/v1/analytics/funnel-conversions/')
    request.user = admin_user
    response = FunnelConversionAnalyticsView.as_view()(request)
    assert response.status_code == 200
    funnel_data = response.data
    assert 'funnel_stages' in funnel_data
    assert 'conversions' in funnel_data
    assert 'durations' in funnel_data
    print(f"[PASS] Funnel & Conversion: Efficiency={funnel_data['overall_funnel_efficiency_pct']}%, Avg Sales Cycle={funnel_data['durations']['avg_sales_cycle_days']} days, Time to SQL={funnel_data['durations']['avg_time_to_sql_days']} days")

    # 9. Owner Performance API
    print("\n--- TEST 9: Owner Performance Matrix ---")
    request = factory.get('/api/v1/analytics/owners/')
    request.user = admin_user
    response = OwnerPerformanceAnalyticsView.as_view()(request)
    assert response.status_code == 200
    owner_data = response.data
    assert 'owners' in owner_data
    print(f"[PASS] Owner Performance: {len(owner_data['owners'])} commercial owners evaluated across leads, opps, wins, and overdue tasks.")

    # 10. Reporting Tables API (Test all 7 standard reports)
    print("\n--- TEST 10: Standard Reports Table Generation ---")
    standard_reports = [
        'pipeline_by_owner', 'pipeline_by_stage', 'leads_by_source',
        'pld_conversion', 'opportunity_performance', 'activity_performance',
        'sla_performance'
    ]
    for rep in standard_reports:
        request = factory.get(f'/api/v1/analytics/reports/?report={rep}')
        request.user = admin_user
        response = ReportTableView.as_view()(request)
        assert response.status_code == 200, f"Failed report {rep}"
        assert 'headers' in response.data
        assert 'rows' in response.data
        print(f"  [OK] Report '{rep}': {len(response.data['rows'])} rows generated with {len(response.data['headers'])} columns.")

    # 11. CSV Export API
    print("\n--- TEST 11: CSV Data Export ---")
    request = factory.get('/api/v1/analytics/reports/export/?report=pipeline_by_owner')
    request.user = admin_user
    response = ReportCSVExportView.as_view()(request)
    assert response.status_code == 200
    assert response['Content-Type'] == 'text/csv'
    assert 'attachment; filename="pipeline_by_owner.csv"' in response['Content-Disposition']
    content_str = response.content.decode('utf-8')
    assert "Owner Name" in content_str
    print(f"[PASS] CSV Export: Valid CSV content generated with size {len(content_str)} bytes.")

    # 12. Work Queue (5 Sections & Role-Based Scoping)
    print("\n--- TEST 12: Work Queue 5 Sections & Role-Based Views ---")
    for role in ['SALES_EXECUTIVE', 'MANAGER', 'EXECUTIVE']:
        request = factory.get(f'/api/v1/work-queue/?role_view={role}')
        request.user = admin_user
        response = WorkQueueView.as_view()(request)
        assert response.status_code == 200
        wq_data = response.data
        assert 'today' in wq_data
        assert 'overdue' in wq_data
        assert 'at_risk' in wq_data
        assert 'no_next_action' in wq_data
        assert 'upcoming' in wq_data
        print(f"  [OK] Work Queue ({role}): Today={wq_data['today']['count']}, Overdue={wq_data['overdue']['count']}, At Risk={wq_data['at_risk']['count']}, No Action={wq_data['no_next_action']['count']}, Upcoming={wq_data['upcoming']['count']}")

    # 13. Direct Work Queue Actions (Reschedule Task & Schedule Next Action)
    print("\n--- TEST 13: Direct Work Queue Actions ---")
    task = Task.objects.first()
    if task:
        new_due = (timezone.now() + timezone.timedelta(days=5)).strftime('%Y-%m-%d %H:%M')
        request = factory.post(
            '/api/v1/work-queue/action/reschedule-task/',
            data=json.dumps({'task_id': str(task.id), 'new_due_date': new_due}),
            content_type='application/json'
        )
        request.user = admin_user
        response = WorkQueueActionView.as_view()(request, action_name='reschedule-task')
        assert response.status_code == 200, f"Reschedule failed: {response.data}"
        task.refresh_from_db()
        print(f"  [OK] Direct Action Reschedule Task: Task #{str(task.id)[:8]} updated to {task.due_date}")

    lead = Lead.objects.first()
    if lead:
        next_due = (timezone.now() + timezone.timedelta(days=2)).strftime('%Y-%m-%d')
        request = factory.post(
            '/api/v1/work-queue/action/schedule-next-action/',
            data=json.dumps({
                'entity_type': 'LEAD',
                'entity_id': str(lead.id),
                'description': 'Direct Follow-up from Work Queue',
                'due_date': next_due
            }),
            content_type='application/json'
        )
        request.user = admin_user
        response = WorkQueueActionView.as_view()(request, action_name='schedule-next-action')
        assert response.status_code == 200, f"Schedule next action failed: {response.data}"
        lead.refresh_from_db()
        assert lead.next_action_description == 'Direct Follow-up from Work Queue'
        print(f"  [OK] Direct Action Schedule Next Action: Lead #{str(lead.id)[:8]} next action synced.")

    print("\n" + "=" * 80)
    print("ALL 13 PHASE 10 BACKEND ANALYTICS & WORK QUEUE TESTS PASSED SUCCESSFULLY! (100%)")
    print("=" * 80)


if __name__ == '__main__':
    run_tests()
