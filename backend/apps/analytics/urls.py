from django.urls import path
from apps.analytics.views import (
    ExecutiveAnalyticsView,
    PLDAnalyticsView,
    SalesAnalyticsView,
    MarketingAnalyticsView,
    ProductAnalyticsView,
    PartnerAnalyticsView,
    ActivitySLAAnalyticsView,
    FunnelConversionAnalyticsView,
    OwnerPerformanceAnalyticsView,
    ReportTableView,
    ReportCSVExportView,
    AttributionReportView,
    FunnelAnalyticsView,
    FunnelLeakageVelocityView
)

urlpatterns = [
    # Phase 10 Analytics Dashboards
    path('analytics/executive/', ExecutiveAnalyticsView.as_view(), name='executive-analytics'),
    path('analytics/pld/', PLDAnalyticsView.as_view(), name='pld-analytics'),
    path('analytics/sales/', SalesAnalyticsView.as_view(), name='sales-analytics'),
    path('analytics/marketing/', MarketingAnalyticsView.as_view(), name='marketing-analytics'),
    path('analytics/product/', ProductAnalyticsView.as_view(), name='product-analytics'),
    path('analytics/partner/', PartnerAnalyticsView.as_view(), name='partner-analytics'),
    path('analytics/activity-sla/', ActivitySLAAnalyticsView.as_view(), name='activity-sla-analytics'),
    path('analytics/funnel-conversions/', FunnelConversionAnalyticsView.as_view(), name='funnel-conversions-analytics'),
    path('analytics/owners/', OwnerPerformanceAnalyticsView.as_view(), name='owner-performance-analytics'),

    # Phase 10 Reporting & CSV Export
    path('analytics/reports/', ReportTableView.as_view(), name='reports-table'),
    path('analytics/reports/export/', ReportCSVExportView.as_view(), name='reports-csv-export'),
    path('analytics/attribution-report/', AttributionReportView.as_view(), name='attribution-report'),

    # Backward compatibility
    path('analytics/funnel/', FunnelAnalyticsView.as_view(), name='funnel-analytics'),
    path('analytics/leakage-velocity/', FunnelLeakageVelocityView.as_view(), name='leakage-velocity-analytics'),
]
