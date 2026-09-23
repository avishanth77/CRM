from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Customer
from .serializers import CustomerSerializer


class CustomerViewSet(viewsets.ModelViewSet):

    serializer_class = CustomerSerializer
    permission_classes = [
        IsAuthenticated,
    ]

    def get_queryset(self):

        user = self.request.user

        queryset = Customer.objects.select_related(
            "lead",
            "converted_by",
        )

        if user.role in ["ADMIN", "MANAGER"]:
            return queryset.all()

        if user.role == "EXECUTIVE":
            return queryset.filter(
                lead__assigned_to=user
            )

        return queryset.none()