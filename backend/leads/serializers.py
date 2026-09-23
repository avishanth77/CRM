from rest_framework import serializers

from .models import Lead, LeadSource


class LeadSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadSource
        fields = [
            "id",
            "name",
            "description",
            "is_active",
        ]


from rest_framework import serializers

from .models import Lead, LeadSource


class LeadSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadSource
        fields = [
            "id",
            "name",
            "description",
            "is_active",
        ]


class LeadSerializer(serializers.ModelSerializer):

    source_name = serializers.CharField(
        source="source.name",
        read_only=True
    )

    assigned_to_name = serializers.CharField(
        source="assigned_to.username",
        read_only=True
    )

    class Meta:
        model = Lead

        fields = [
            "id",
            "name",
            "phone",
            "email",
            "company_name",
            "source",
            "source_name",
            "status",
            "priority",
            "assigned_to",
            "assigned_to_name",
            "expected_value",
            "lost_reason",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "source_name",
            "assigned_to_name",
        ]

    def validate_phone(self, value):

        queryset = Lead.objects.filter(
            phone=value
        )

        if self.instance:
            queryset = queryset.exclude(
                pk=self.instance.pk
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "A lead with this phone number already exists."
            )

        return value

    def validate_email(self, value):

        if value:
            value = value.lower()

        return value

    def validate(self, attrs):

        request = self.context.get("request")
        user = request.user if request else None

        current_status = (
            self.instance.status
            if self.instance
            else Lead.Status.NEW
        )

        new_status = attrs.get(
            "status",
            current_status
        )

        lost_reason = attrs.get(
            "lost_reason",
            self.instance.lost_reason
            if self.instance
            else ""
        )

        # --------------------------------
        # LOST LEAD VALIDATION
        # --------------------------------

        if new_status == Lead.Status.LOST:

            if not lost_reason.strip():
                raise serializers.ValidationError({
                    "lost_reason":
                    "Lost leads must include a reason."
                })

        # --------------------------------
        # EXECUTIVE ASSIGNMENT PROTECTION
        # --------------------------------

        if "assigned_to" in attrs:

            new_assignee = attrs["assigned_to"]

            if user and user.role == "EXECUTIVE":

                # Executive cannot assign leads
                if (
                    self.instance
                    and self.instance.assigned_to_id
                    != new_assignee.id
                ):
                    raise serializers.ValidationError({
                        "assigned_to":
                        "Executives cannot reassign leads."
                    })

        # --------------------------------
        # STATUS TRANSITION VALIDATION
        # --------------------------------

        allowed_transitions = {
            Lead.Status.NEW: [
                Lead.Status.CONTACTED,
                Lead.Status.LOST,
            ],

            Lead.Status.CONTACTED: [
                Lead.Status.DEMO_SCHEDULED,
                Lead.Status.NEGOTIATION,
                Lead.Status.WON,
                Lead.Status.LOST,
            ],

            Lead.Status.DEMO_SCHEDULED: [
                Lead.Status.NEGOTIATION,
                Lead.Status.WON,
                Lead.Status.LOST,
            ],

            Lead.Status.NEGOTIATION: [
                Lead.Status.WON,
                Lead.Status.LOST,
            ],

            Lead.Status.WON: [],

            Lead.Status.LOST: [],
        }

        if (
            self.instance
            and new_status != current_status
            and new_status not in
            allowed_transitions.get(
                current_status,
                []
            )
        ):
            raise serializers.ValidationError({
                "status": (
                    f"Cannot change status from "
                    f"{current_status} to {new_status}."
                )
            })

        return attrs
    source_name = serializers.CharField(
        source="source.name",
        read_only=True
    )

    assigned_to_name = serializers.CharField(
        source="assigned_to.username",
        read_only=True
    )

    class Meta:
        model = Lead

        fields = [
            "id",
            "name",
            "phone",
            "email",
            "company_name",
            "source",
            "source_name",
            "status",
            "priority",
            "assigned_to",
            "assigned_to_name",
            "expected_value",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "source_name",
            "assigned_to_name",
        ]

    def validate_phone(self, value):
        """
        Prevent duplicate phone numbers among leads.
        """

        queryset = Lead.objects.filter(
            phone=value
        )

        # During update, don't compare the lead with itself.
        if self.instance:
            queryset = queryset.exclude(
                pk=self.instance.pk
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "A lead with this phone number already exists."
            )

        return value

    def validate_email(self, value):
        """
        Basic email validation is already handled
        by Django's EmailField.
        """

        if value:
            value = value.lower()

        return value

    def validate(self, attrs):

        status = attrs.get(
            "status",
            self.instance.status if self.instance else None
        )
    
        lost_reason = attrs.get(
            "lost_reason",
            self.instance.lost_reason
            if self.instance
            else ""
        )
    
        if status == Lead.Status.LOST and not lost_reason.strip():
            raise serializers.ValidationError({
                "lost_reason": (
                    "Lost leads must include a reason."
                )
            })
    
        return attrs