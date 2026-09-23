from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Lead
from .permissions import IsLeadOwnerOrManager
from .serializers import LeadSerializer
from .models import Lead, LeadSource
from .serializers import LeadSerializer, LeadSourceSerializer



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