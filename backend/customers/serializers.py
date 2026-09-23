from rest_framework import serializers

from .models import Customer


class CustomerSerializer(serializers.ModelSerializer):

    converted_by_name = serializers.CharField(
        source="converted_by.username",
        read_only=True,
    )

    lead_id = serializers.IntegerField(
        source="lead.id",
        read_only=True,
    )

    class Meta:
        model = Customer

        fields = [
            "id",
            "lead_id",
            "name",
            "phone",
            "email",
            "company_name",
            "converted_by",
            "converted_by_name",
            "converted_at",
        ]

        read_only_fields = [
            "id",
            "lead_id",
            "converted_by",
            "converted_by_name",
            "converted_at",
        ]