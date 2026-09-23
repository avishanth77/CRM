from rest_framework.routers import DefaultRouter

from .views import (
    LeadViewSet,
    LeadSourceViewSet,
    FollowUpViewSet,
    LeadActivityViewSet,
    ActivityLogViewSet,
)


router = DefaultRouter()

router.register(
    "leads",
    LeadViewSet,
    basename="lead",
)

router.register(
    "lead-sources",
    LeadSourceViewSet,
    basename="lead-source",
)

router.register(
    "followups",
    FollowUpViewSet,
    basename="followup",
)

router.register(
    "activities",
    LeadActivityViewSet,
    basename="activity",


)
router.register(
    "activity-logs",
    ActivityLogViewSet,
    basename="activity-log",
)
urlpatterns = router.urls