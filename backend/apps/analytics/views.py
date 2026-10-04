from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.http import HttpResponse

from apps.analytics.services import (
    ExecutiveAnalyticsService,
    PLDAnalyticsService,
    SalesAnalyticsService,
    MarketingAnalyticsService,
    ProductAnalyticsService,
    PartnerAnalyticsService,
    ActivitySLAAnalyticsService,
    ReportGenerationService,
    FunnelConversionAnalyticsService,
    OwnerPerformanceService
)


class ExecutiveAnalyticsView(APIView):
    """
    Executive Dashboard Analytics.
    Answers: "How is the business performing?"
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        period = request.query_params.get('period', 'ALL')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        product_code = request.query_params.get('product')
        owner_id = request.query_params.get('owner')
        territory = request.query_params.get('territory')

        user = request.user if request.user.is_authenticated else None
        data = ExecutiveAnalyticsService.get_dashboard_data(
            user=user,
            period=period,
            start_date=start_date,
            end_date=end_date,
            product_code=product_code,
            owner_id=owner_id,
            territory=territory
        )
        return Response(data, status=status.HTTP_200_OK)


class PLDAnalyticsView(APIView):
    """
    PLD Qualification & Diagnostic Analytics.
    Answers: "Are leads being qualified correctly?"
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        period = request.query_params.get('period', 'ALL')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        product_code = request.query_params.get('product')

        user = request.user if request.user.is_authenticated else None
        data = PLDAnalyticsService.get_dashboard_data(
            user=user,
            period=period,
            start_date=start_date,
            end_date=end_date,
            product_code=product_code
        )
        return Response(data, status=status.HTTP_200_OK)


class SalesAnalyticsView(APIView):
    """
    Commercial Pipeline & Opportunity Analytics.
    Answers: "What pipeline needs attention?"
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        period = request.query_params.get('period', 'ALL')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        product_code = request.query_params.get('product')
        owner_id = request.query_params.get('owner')

        user = request.user if request.user.is_authenticated else None
        data = SalesAnalyticsService.get_dashboard_data(
            user=user,
            period=period,
            start_date=start_date,
            end_date=end_date,
            product_code=product_code,
            owner_id=owner_id
        )
        return Response(data, status=status.HTTP_200_OK)


class MarketingAnalyticsView(APIView):
    """
    Marketing Channels & Campaign Attribution Analytics.
    Answers: "Which sources generate quality pipeline?"
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        period = request.query_params.get('period', 'ALL')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        user = request.user if request.user.is_authenticated else None
        data = MarketingAnalyticsService.get_dashboard_data(
            user=user,
            period=period,
            start_date=start_date,
            end_date=end_date
        )
        return Response(data, status=status.HTTP_200_OK)


class ProductAnalyticsView(APIView):
    """
    Product, Module, and Capability Demand Analytics.
    Answers: "Which products/modules/capabilities generate demand?"
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        user = request.user if request.user.is_authenticated else None
        data = ProductAnalyticsService.get_dashboard_data(user=user)
        return Response(data, status=status.HTTP_200_OK)


class PartnerAnalyticsView(APIView):
    """
    Partner Management Foundation Analytics (Real Database Data).
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        user = request.user if request.user.is_authenticated else None
        data = PartnerAnalyticsService.get_dashboard_data(user=user)
        return Response(data, status=status.HTTP_200_OK)


class ActivitySLAAnalyticsView(APIView):
    """
    Activity and SLA Health & Bottleneck Diagnostics.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        period = request.query_params.get('period', 'ALL')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        user = request.user if request.user.is_authenticated else None
        data = ActivitySLAAnalyticsService.get_dashboard_data(
            user=user,
            period=period,
            start_date=start_date,
            end_date=end_date
        )
        return Response(data, status=status.HTTP_200_OK)


class FunnelConversionAnalyticsView(APIView):
    """
    End-to-End Funnel Progression and Sales Conversion Analytics.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        product_code = request.query_params.get('product')
        user = request.user if request.user.is_authenticated else None
        data = FunnelConversionAnalyticsService.get_funnel_and_conversions(user=user, product_code=product_code)
        return Response(data, status=status.HTTP_200_OK)


class OwnerPerformanceAnalyticsView(APIView):
    """
    Owner Performance across Leads, Opportunities, Wins, and Activities.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        user = request.user if request.user.is_authenticated else None
        data = OwnerPerformanceService.get_owner_performance(user=user)
        return Response(data, status=status.HTTP_200_OK)


class ReportTableView(APIView):
    """
    Structured Reporting Hub for all 7 standard reports with sorting & filtering.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        report_name = request.query_params.get('report', 'pipeline_by_owner')
        user = request.user if request.user.is_authenticated else None
        data = ReportGenerationService.get_report_data(report_name, request.query_params, user=user)
        return Response(data, status=status.HTTP_200_OK)


class ReportCSVExportView(APIView):
    """
    CSV Data Export endpoint for standard reports.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        report_name = request.query_params.get('report', 'pipeline_by_owner')
        user = request.user if request.user.is_authenticated else None
        csv_content = ReportGenerationService.export_csv(report_name, request.query_params, user=user)

        response = HttpResponse(csv_content, content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{report_name}.csv"'
        return response


# ==============================================================================
# BACKWARD COMPATIBILITY ENDPOINTS
# ==============================================================================

class FunnelAnalyticsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        user = request.user if request.user.is_authenticated else None
        data = ExecutiveAnalyticsService.get_dashboard_data(user=user)
        return Response({
            "metrics": {
                "total_leads": data['kpis']['total_leads'],
                "icp_passed": data['kpis']['pld_qualified'],
                "pld_qualified": data['kpis']['pld_qualified'],
                "sql_converted": data['kpis']['sales_accepted'],
                "total_opportunities": data['kpis']['opportunities_count'],
                "won_opportunities": data['kpis']['won_opportunities'],
                "total_won_revenue": data['kpis']['won_value'],
                "total_pipeline_value": data['kpis']['pipeline_value'],
            },
            "rates": {
                "icp_rate": data['rates']['lead_to_pld_rate'],
                "pld_rate": data['rates']['lead_to_pld_rate'],
                "sql_rate": data['rates']['sql_to_accepted_rate'],
                "win_rate": data['rates']['win_rate'],
            },
            "attention_required": {
                "missing_next_actions": data['activity_health']['overdue_tasks'],
                "high_score_leads": data['kpis']['pld_qualified'],
            },
            "product_breakdown": [
                {
                    "product_code": p['product_code'],
                    "product_name": p['product_name'],
                    "leads_count": p['leads_count'],
                    "pipeline_value": p['open_pipeline_value']
                } for p in data['product_breakdown']
            ]
        })


class FunnelLeakageVelocityView(APIView):
    """
    Funnel leakage and velocity using real database calculations.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        user = request.user if request.user.is_authenticated else None
        data = FunnelConversionAnalyticsService.get_funnel_and_conversions(user=user)
        return Response({
            "funnel_stages": [
                {
                    "stage": s["stage"],
                    "count": s["count"],
                    "conversion_rate": s["conversion_rate"],
                    "leakage_count": s["drop_off_count"],
                    "primary_drop_reason": "Non-ICP criteria / Disqualification" if s["order"] <= 3 else "Evaluation stall / Decision postponement"
                } for s in data["funnel_stages"]
            ],
            "overall_funnel_efficiency_pct": data["overall_funnel_efficiency_pct"],
            "average_sales_cycle_days": data["durations"]["avg_sales_cycle_days"],
            "velocity_metrics": [
                {
                    "stage": v["stage_name"],
                    "avg_days": v["avg_days"],
                    "target_sla_days": v["target_sla_days"],
                    "status": "OPTIMAL" if v["avg_days"] <= v["target_sla_days"] else "WARNING"
                } for v in data["velocity_metrics"]
            ],
            "loss_reasons_breakdown": data["loss_reasons_breakdown"]
        })
