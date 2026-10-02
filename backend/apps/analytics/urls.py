from django.urls import path
from apps.analytics.views import FunnelAnalyticsView, FunnelLeakageVelocityView

urlpatterns = [
    path('analytics/funnel/', FunnelAnalyticsView.as_view(), name='funnel-analytics'),
    path('analytics/leakage-velocity/', FunnelLeakageVelocityView.as_view(), name='leakage-velocity-analytics'),
]
