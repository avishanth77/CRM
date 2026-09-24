from decimal import Decimal
from datetime import timedelta

from django.db.models import Count, Sum, Avg
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from leads.models import Lead, FollowUp, ActivityLog
from customers.models import Customer


class DashboardView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        user = request.user

        # ==========================================================
        # DATE FILTER
        # ==========================================================

        period = request.query_params.get("period", "all")

        now = timezone.now()

        start_date = None

        if period == "today":

            start_date = now.replace(
                hour=0,
                minute=0,
                second=0,
                microsecond=0
            )

        elif period == "week":

            start_date = now - timedelta(days=7)

        elif period == "month":

            start_date = now - timedelta(days=30)

        elif period == "all":

            start_date = None

        else:

            return Response(
                {
                    "detail": (
                        "Invalid period. "
                        "Use today, week, month, or all."
                    )
                },
                status=400
            )

        # ==========================================================
        # LEADS
        # ==========================================================

        leads = Lead.objects.all()

        if start_date:

            leads = leads.filter(
                created_at__gte=start_date
            )

        # Executive users see only their assigned leads

        if user.role == "EXECUTIVE":

            leads = leads.filter(
                assigned_to=user
            )

        total_leads = leads.count()

        # ==========================================================
        # LEAD STATUS
        # ==========================================================

        new_leads = leads.filter(
            status=Lead.Status.NEW
        ).count()

        contacted_leads = leads.filter(
            status=Lead.Status.CONTACTED
        ).count()

        demo_scheduled_leads = leads.filter(
            status=Lead.Status.DEMO_SCHEDULED
        ).count()

        negotiation_leads = leads.filter(
            status=Lead.Status.NEGOTIATION
        ).count()

        won_leads = leads.filter(
            status=Lead.Status.WON
        ).count()

        lost_leads = leads.filter(
            status=Lead.Status.LOST
        ).count()
        # ==========================================================
        # PERFORMANCE METRICS
        # ==========================================================

        closed_leads = won_leads + lost_leads

        if total_leads > 0:
            conversion_rate = (
                (won_leads / total_leads) * 100
            )
        else:
            conversion_rate = 0


        if closed_leads > 0:
        
            win_rate = (
                (won_leads / closed_leads) * 100
            )

            lost_rate = (
                (lost_leads / closed_leads) * 100
            )

        else:
        
            win_rate = 0

            lost_rate = 0
        # ==========================================================
        # LEAD PRIORITY
        # ==========================================================

        low_priority = leads.filter(
            priority=Lead.Priority.LOW
        ).count()

        medium_priority = leads.filter(
            priority=Lead.Priority.MEDIUM
        ).count()

        high_priority = leads.filter(
            priority=Lead.Priority.HIGH
        ).count()

        # ==========================================================
        # LEAD SOURCES
        # ==========================================================

        source_data = (
            leads
            .values("source__name")
            .annotate(total=Count("id"))
            .order_by("-total")
        )

        lead_sources = []

        for item in source_data:

            lead_sources.append(
                {
                    "source": (
                        item["source__name"]
                        or "Unknown"
                    ),
                    "total": item["total"],
                }
            )

        # ==========================================================
        # ASSIGNED USERS
        # ==========================================================

        assignment_data = (
            leads
            .values(
                "assigned_to__id",
                "assigned_to__username",
            )
            .annotate(total=Count("id"))
            .order_by("-total")
        )

        assigned_users = []

        for item in assignment_data:

            assigned_users.append(
                {
                    "user_id": item["assigned_to__id"],

                    "username": (
                        item["assigned_to__username"]
                        or "Unassigned"
                    ),

                    "total": item["total"],
                }
            )

        # ==========================================================
        # PIPELINE / SALES
        # ==========================================================

        pipeline_data = leads.aggregate(
            total_pipeline=Sum("expected_value"),
            average_value=Avg("expected_value"),
        )

        total_pipeline = (
            pipeline_data["total_pipeline"]
            or Decimal("0")
        )

        average_lead_value = (
            pipeline_data["average_value"]
            or Decimal("0")
        )

        # ==========================================================
        # WON VALUE
        # ==========================================================

        won_data = leads.filter(
            status=Lead.Status.WON
        ).aggregate(
            value=Sum("expected_value")
        )

        won_value = (
            won_data["value"]
            or Decimal("0")
        )

        # ==========================================================
        # LOST VALUE
        # ==========================================================

        lost_data = leads.filter(
            status=Lead.Status.LOST
        ).aggregate(
            value=Sum("expected_value")
        )

        lost_value = (
            lost_data["value"]
            or Decimal("0")
        )

        # ==========================================================
        # OPEN PIPELINE
        # ==========================================================

        open_pipeline = (
            total_pipeline
            - won_value
            - lost_value
        )

        # ==========================================================
        # CUSTOMERS
        # ==========================================================

        customers = Customer.objects.all()

        if user.role == "EXECUTIVE":

            customers = customers.filter(
                lead__assigned_to=user
            )

        total_customers = customers.count()

        # ==========================================================
        # FOLLOW UPS
        # ==========================================================

        followups = FollowUp.objects.all()

        if start_date:

            followups = followups.filter(
                created_at__gte=start_date
            )

        if user.role == "EXECUTIVE":

            followups = followups.filter(
                assigned_to=user
            )

        pending_followups = followups.filter(
            status=FollowUp.Status.PENDING
        ).count()

        completed_followups = followups.filter(
            status=FollowUp.Status.COMPLETED
        ).count()

        cancelled_followups = followups.filter(
            status=FollowUp.Status.CANCELLED
        ).count()

        total_followups = followups.count()

        # ==========================================================
        # RECENT LEADS
        # ==========================================================

        recent_leads_queryset = (
            leads
            .select_related("assigned_to")
            .order_by("-created_at")
        )

        recent_leads = []

        for lead in recent_leads_queryset[:5]:

            recent_leads.append(
                {
                    "id": lead.id,

                    "name": lead.name,

                    "phone": lead.phone,

                    "email": lead.email,

                    "company_name": lead.company_name,

                    "status": lead.status,

                    "priority": lead.priority,

                    "assigned_to": (
                        lead.assigned_to.username
                        if lead.assigned_to
                        else None
                    ),

                    "expected_value": (
                        lead.expected_value
                    ),

                    "created_at": (
                        lead.created_at
                    ),
                }
            )

        # ==========================================================
        # RECENT ACTIVITIES
        # ==========================================================

        recent_activities_queryset = (
            ActivityLog.objects
            .select_related("performed_by")
        )

        if start_date:

            recent_activities_queryset = (
                recent_activities_queryset.filter(
                    created_at__gte=start_date
                )
            )

        if user.role == "EXECUTIVE":

            recent_activities_queryset = (
                recent_activities_queryset.filter(
                    performed_by=user
                )
            )

        recent_activities_queryset = (
            recent_activities_queryset
            .order_by("-created_at")
        )

        recent_activities = []

        for activity in recent_activities_queryset[:10]:

            recent_activities.append(
                {
                    "id": activity.id,

                    "entity_type": (
                        activity.entity_type
                    ),

                    "entity_id": (
                        activity.entity_id
                    ),

                    "action": activity.action,

                    "old_value": (
                        activity.old_value
                    ),

                    "new_value": (
                        activity.new_value
                    ),

                    "performed_by": (
                        activity.performed_by.username
                        if activity.performed_by
                        else None
                    ),

                    "created_at": (
                        activity.created_at
                    ),
                }
            )

        # ==========================================================
        # UPCOMING FOLLOW UPS
        # ==========================================================

        upcoming_followups_queryset = (
            followups
            .filter(
                status=FollowUp.Status.PENDING,
                scheduled_at__gte=timezone.now(),
            )
            .select_related(
                "lead",
                "assigned_to",
            )
            .order_by("scheduled_at")
        )

        upcoming_followups = []

        for followup in upcoming_followups_queryset[:5]:

            upcoming_followups.append(
                {
                    "id": followup.id,

                    "lead_id": followup.lead_id,

                    "lead_name": (
                        followup.lead.name
                    ),

                    "follow_up_type": (
                        followup.follow_up_type
                    ),

                    "scheduled_at": (
                        followup.scheduled_at
                    ),

                    "assigned_to": (
                        followup.assigned_to.username
                        if followup.assigned_to
                        else None
                    ),

                    "notes": followup.notes,
                }
            )

        # ==========================================================
        # RESPONSE
        # ==========================================================

        return Response(
            {

                # ==================================================
                # PERIOD
                # ==================================================

                "period": period,

                # ==================================================
                # SUMMARY
                # ==================================================

                "summary": {

                    "total_leads": total_leads,

                    "total_customers": total_customers,

                    "total_followups": total_followups,

                    "pending_followups": (
                        pending_followups
                    ),

                    "completed_followups": (
                        completed_followups
                    ),

                    "cancelled_followups": (
                        cancelled_followups
                    ),
                },

                # ==================================================
                # LEAD STATUS
                # ==================================================

                "lead_status": {

                    "new": new_leads,

                    "contacted": contacted_leads,

                    "demo_scheduled": (
                        demo_scheduled_leads
                    ),

                    "negotiation": (
                        negotiation_leads
                    ),

                    "won": won_leads,

                    "lost": lost_leads,
                },

                # ==================================================
                # LEAD PRIORITY
                # ==================================================

                "lead_priority": {

                    "low": low_priority,

                    "medium": medium_priority,

                    "high": high_priority,
                },

                # ==================================================
                # LEAD SOURCES
                # ==================================================

                "lead_sources": lead_sources,

                # ==================================================
                # ASSIGNED USERS
                # ==================================================

                "assigned_users": assigned_users,

                # ==================================================
                # SALES
                # ==================================================

                "sales": {
                            
                    "total_pipeline_value": (
                        total_pipeline
                    ),

                    "won_value": (
                        won_value
                    ),

                    "lost_value": (
                        lost_value
                    ),

                    "open_pipeline_value": (
                        open_pipeline
                    ),

                    "average_lead_value": (
                        average_lead_value
                    ),

                    "conversion_rate": round(
                        conversion_rate,
                        2
                    ),

                    "win_rate": round(
                        win_rate,
                        2
                    ),

                    "lost_rate": round(
                        lost_rate,
                        2
                    ),
                },
                # ==================================================
                # FOLLOW UPS
                # ==================================================

                "followups": {

                    "pending": pending_followups,

                    "completed": completed_followups,

                    "cancelled": cancelled_followups,

                    "total": total_followups,
                },

                # ==================================================
                # RECENT LEADS
                # ==================================================

                "recent_leads": recent_leads,

                # ==================================================
                # RECENT ACTIVITIES
                # ==================================================

                "recent_activities": (
                    recent_activities
                ),

                # ==================================================
                # UPCOMING FOLLOW UPS
                # ==================================================

                "upcoming_followups": (
                    upcoming_followups
                ),
            }
        )