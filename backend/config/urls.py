from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

api_v1_patterns = [
    path('', include('apps.products.urls')),
    path('', include('apps.pld_engine.urls')),
    path('', include('apps.accounts.urls')),
    path('', include('apps.leads.urls')),
    path('', include('apps.discovery.urls')),
    path('', include('apps.evaluations.urls')),
    path('', include('apps.sales_handoff.urls')),
    path('', include('apps.opportunities.urls')),
    path('', include('apps.partners.urls')),
    path('', include('apps.workflows.urls')),
    path('', include('apps.audit_logging.urls')),
    path('', include('apps.analytics.urls')),
    path('', include('apps.activities.urls')),
    path('', include('apps.pld_assessments.urls')),
    path('', include('apps.integrations.urls')),
    path('', include('apps.authentication.urls')),
]

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include(api_v1_patterns)),

    # OpenAPI 3 Schema & Interactive Swagger UI
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
