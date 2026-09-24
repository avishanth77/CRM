from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response

from .permissions import IsLeadOwnerOrManager

from .models import (
    Lead,
    LeadSource,
    FollowUp,
    LeadActivity,
    ActivityLog,
)

from .serializers import (
    LeadSerializer,
    LeadSourceSerializer,
    FollowUpSerializer,
    LeadActivitySerializer,
    ActivityLogSerializer,
)

from customers.models import Customer
from customers.serializers import CustomerSerializer



class LeadViewSet(viewsets.ModelViewSet):

    serializer_class = LeadSerializer

    permission_classes = [
        IsAuthenticated,
        IsLeadOwnerOrManager,
    ]

    filterset_fields = [
        "status",
        "priority",
        "source",
        "assigned_to",
    ]

    search_fields = [
        "name",
        "phone",
        "email",
        "company_name",
    ]

    ordering_fields = [
        "name",
        "created_at",
        "updated_at",
        "expected_value",
        "priority",
        "status",
    ]

    ordering = [
        "-created_at"
    ]

    def get_queryset(self):

        user = self.request.user

        queryset = Lead.objects.select_related(
            "source",
            "assigned_to",
        )

        if user.role == "ADMIN":
            return queryset.all()

        if user.role == "MANAGER":
            return queryset.all()

        if user.role == "EXECUTIVE":
            return queryset.filter(
                assigned_to=user
            )

        return queryset.none()

    def perform_create(self, serializer):

        user = self.request.user

        # Executive-created leads automatically belong
        # to the executive who created them.
        if user.role == "EXECUTIVE":

            serializer.save(
                assigned_to=user
            )

        else:

            serializer.save()

    def perform_destroy(self, instance):

        # Instead of permanently deleting CRM data,
        # mark it as archived if your model supports it.

        instance.delete()

    @action(
        detail=True,
        methods=["post"],
        url_path="convert",
    )
    def convert(self, request, pk=None):

        lead = self.get_object()

        user = request.user

        # --------------------------------
        # PERMISSION CHECK
        # --------------------------------

        if user.role == "EXECUTIVE":

            if lead.assigned_to_id != user.id:
                return Response(
                    {
                        "detail": (
                            "You can only convert "
                            "your assigned leads."
                        )
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        elif user.role not in ["ADMIN", "MANAGER"]:

            return Response(
                {
                    "detail": "You do not have permission to convert leads."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # --------------------------------
        # STATUS CHECK
        # --------------------------------

        if lead.status != Lead.Status.WON:

            return Response(
                {
                    "detail": (
                        "Only WON leads can be converted "
                        "into customers."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --------------------------------
        # DUPLICATE CHECK
        # --------------------------------

        if hasattr(lead, "customer"):

            return Response(
                {
                    "detail": "This lead has already been converted."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --------------------------------
        # CREATE CUSTOMER
        # --------------------------------

        customer = Customer.objects.create(
            lead=lead,
            name=lead.name,
            phone=lead.phone,
            email=lead.email,
            company_name=lead.company_name,
            converted_by=user,
        )

        ActivityLog.objects.create(
            entity_type="LEAD",
            entity_id=lead.id,
            action="LEAD_CONVERTED",
            old_value=lead.status,
            new_value=f"CUSTOMER:{customer.id}",
            performed_by=user,
        )
        serializer = CustomerSerializer(customer)

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )
    def perform_update(self, serializer):

        lead = self.get_object()

        old_status = lead.status
        old_assigned_to = lead.assigned_to_id
    
        updated_lead = serializer.save()
    
        new_status = updated_lead.status
        new_assigned_to = updated_lead.assigned_to_id
    
        # --------------------------------
        # STATUS CHANGE LOG
        # --------------------------------
    
        if old_status != new_status:
        
            ActivityLog.objects.create(
                entity_type="LEAD",
                entity_id=lead.id,
                action="STATUS_CHANGED",
                old_value=old_status,
                new_value=new_status,
                performed_by=self.request.user,
            )
    
        # --------------------------------
        # ASSIGNMENT CHANGE LOG
        # --------------------------------
    
        if old_assigned_to != new_assigned_to:
        
            ActivityLog.objects.create(
                entity_type="LEAD",
                entity_id=lead.id,
                action="LEAD_ASSIGNED",
                old_value=(
                    str(old_assigned_to)
                    if old_assigned_to
                    else ""
                ),
                new_value=(
                    str(new_assigned_to)
                    if new_assigned_to
                    else ""
                ),
                performed_by=self.request.user,
            )
class LeadSourceViewSet(viewsets.ModelViewSet):

    queryset = LeadSource.objects.all()
    serializer_class = LeadSourceSerializer
    permission_classes = [IsAuthenticated]

    filterset_fields = [
        "is_active",
    ]

    search_fields = [
        "name",
        "description",
    ]

    ordering = [
        "name",
    ]

class FollowUpViewSet(viewsets.ModelViewSet):

    serializer_class = FollowUpSerializer

    permission_classes = [
        IsAuthenticated,
    ]

    def get_queryset(self):

        user = self.request.user

        queryset = FollowUp.objects.select_related(
            "lead",
            "assigned_to",
        )

        if user.role in ["ADMIN", "MANAGER"]:
            return queryset.all()

        if user.role == "EXECUTIVE":
            return queryset.filter(
                assigned_to=user
            )

        return queryset.none()

    def perform_create(self, serializer):

        user = self.request.user

        if user.role == "EXECUTIVE":

            serializer.save(
                assigned_to=user
            )

        else:

            serializer.save()

def perform_update(self, serializer):

    serializer.save()
class LeadActivityViewSet(viewsets.ModelViewSet):

    serializer_class = LeadActivitySerializer

    permission_classes = [
        IsAuthenticated,
    ]

    def get_queryset(self):

        user = self.request.user

        queryset = LeadActivity.objects.select_related(
            "lead",
            "created_by",
        )

        if user.role in ["ADMIN", "MANAGER"]:
            return queryset.all()

        if user.role == "EXECUTIVE":
            return queryset.filter(
                lead__assigned_to=user
            )

        return queryset.none()

    def perform_create(self, serializer):

        user = self.request.user

        lead = serializer.validated_data["lead"]

        if user.role == "EXECUTIVE":

            if lead.assigned_to_id != user.id:
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied(
                    "You can only add activities "
                    "to your assigned leads."
                )

        serializer.save(
            created_by=user
        )

class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):

    serializer_class = ActivityLogSerializer

    permission_classes = [
        IsAuthenticated,
    ]

    def get_queryset(self):

        user = self.request.user

        queryset = ActivityLog.objects.select_related(
            "performed_by",
        )

        if user.role in ["ADMIN", "MANAGER"]:
            return queryset.all()

        if user.role == "EXECUTIVE":
            return queryset.filter(
                performed_by=user
            )

        return queryset.none()