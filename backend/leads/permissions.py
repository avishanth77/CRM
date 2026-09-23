from rest_framework.permissions import BasePermission


class IsLeadManager(BasePermission):
    """
    Admin and Manager can manage leads.
    """

    def has_permission(self, request, view):
        user = request.user

        return (
            user.is_authenticated
            and user.role in [
                "ADMIN",
                "MANAGER",
            ]
        )


class IsLeadOwnerOrManager(BasePermission):
    """
    Admin/Manager can access leads.
    Executive can access only assigned leads.
    """

    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user

        if user.role in ["ADMIN", "MANAGER"]:
            return True

        if user.role == "EXECUTIVE":
            return obj.assigned_to == user

        return False
    