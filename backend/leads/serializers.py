from rest_framework import serializers

from .models import (
    Lead,
    LeadSource,
    FollowUp,
    LeadActivity,
    ActivityLog,
)

class LeadSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadSource
        fields = [
            "id",
            "name",
            "description",
            "is_active",
        ]




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

class FollowUpSerializer(serializers.ModelSerializer):

    lead_name = serializers.CharField(
        source="lead.name",
        read_only=True
    )

    assigned_to_name = serializers.CharField(
        source="assigned_to.username",
        read_only=True
    )

    class Meta:
        model = FollowUp

        fields = [
            "id",
            "lead",
            "lead_name",
            "assigned_to",
            "assigned_to_name",
            "follow_up_type",
            "scheduled_at",
            "status",
            "notes",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "lead_name",
            "assigned_to_name",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):

        request = self.context.get("request")
        user = request.user if request else None

        lead = attrs.get("lead")

        # During PATCH, use the existing lead
        if lead is None and self.instance:
            lead = self.instance.lead

        if lead is None:
            raise serializers.ValidationError({
                "lead": "Lead is required."
            })

        # --------------------------------
        # EXECUTIVE LEAD ACCESS
        # --------------------------------

        if user and user.role == "EXECUTIVE":

            if lead.assigned_to_id != user.id:
                raise serializers.ValidationError({
                    "lead": (
                        "You can only create or update "
                        "follow-ups for your assigned leads."
                    )
                })

            # Prevent Executive from assigning
            # the follow-up to another user.
            if "assigned_to" in attrs:

                assigned_user = attrs["assigned_to"]

                if assigned_user.id != user.id:
                    raise serializers.ValidationError({
                        "assigned_to": (
                            "Executives cannot assign "
                            "follow-ups to other users."
                        )
                    })

        # --------------------------------
        # LEAD STATUS
        # --------------------------------

        if lead.status in [
            Lead.Status.WON,
            Lead.Status.LOST,
        ]:
            raise serializers.ValidationError({
                "lead": (
                    "Follow-ups cannot be created or "
                    "updated for Won or Lost leads."
                )
            })

        # --------------------------------
        # COMPLETED FOLLOW-UP
        # --------------------------------

        if self.instance:

            current_status = self.instance.status

            new_status = attrs.get(
                "status",
                current_status
            )

            if current_status == FollowUp.Status.COMPLETED:

                allowed_fields = {
                    "notes",
                }

                changed_fields = set(attrs.keys())

                if not changed_fields.issubset(
                    allowed_fields
                ):
                    raise serializers.ValidationError({
                        "status": (
                            "A completed follow-up "
                            "cannot be rescheduled "
                            "or reopened."
                        )
                    })

        return attrs

class LeadActivitySerializer(serializers.ModelSerializer):

    lead_name = serializers.CharField(
        source="lead.name",
        read_only=True,
    )

    created_by_name = serializers.CharField(
        source="created_by.username",
        read_only=True,
    )

    class Meta:
        model = LeadActivity

        fields = [
            "id",
            "lead",
            "lead_name",
            "created_by",
            "created_by_name",
            "activity_type",
            "description",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "lead_name",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]

    def validate_description(self, value):

        if not value.strip():
            raise serializers.ValidationError(
                "Activity description cannot be empty."
            )

        return value


class ActivityLogSerializer(serializers.ModelSerializer):

    performed_by_name = serializers.CharField(
        source="performed_by.username",
        read_only=True,
    )

    class Meta:
        model = ActivityLog

        fields = [
            "id",
            "entity_type",
            "entity_id",
            "action",
            "old_value",
            "new_value",
            "performed_by",
            "performed_by_name",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "performed_by",
            "performed_by_name",
            "created_at",
        ]