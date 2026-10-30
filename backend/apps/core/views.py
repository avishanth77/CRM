from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from apps.core.models import Territory, Industry
from apps.core.serializers import TerritorySerializer, IndustrySerializer
from apps.authentication.models import User, UserRole
from apps.audit_logging.models import AuditLog, AuditAction


def is_admin_or_management(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    canonical = getattr(user, 'canonical_role', getattr(user, 'role', ''))
    return canonical in [UserRole.ADMIN, UserRole.MANAGEMENT]


class TerritoryViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for Master Territories / Geographic Regions.
    Read: Available to all authenticated CRM staff for dropdowns and scoping.
    Write: Restricted to Platform Administrators and TEXOL Management.
    """
    queryset = Territory.objects.all().select_related('regional_manager')
    serializer_class = TerritorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Territory.objects.all().select_related('regional_manager')
        active_only = self.request.query_params.get('active_only')
        if active_only and active_only.lower() in ['true', '1']:
            qs = qs.filter(is_active=True)
        return qs.order_by('sort_order', 'name')

    def perform_create(self, serializer):
        user = self.request.user
        if not is_admin_or_management(user):
            raise permissions.exceptions.PermissionDenied(
                "Only Platform Administrators and Management can create territories."
            )
        territory = serializer.save()

        # If regional manager is assigned, synchronize manager's territory field
        if territory.regional_manager:
            territory.regional_manager.territory = territory.name
            territory.regional_manager.save(update_fields=['territory'])

    def perform_update(self, serializer):
        user = self.request.user
        if not is_admin_or_management(user):
            raise permissions.exceptions.PermissionDenied(
                "Only Platform Administrators and Management can update territories."
            )
        old_territory = self.get_object()
        old_name = old_territory.name
        old_manager = old_territory.regional_manager

        territory = serializer.save()

        # If territory name changed, update all users referencing old territory name
        if old_name != territory.name:
            User.objects.filter(territory=old_name).update(territory=territory.name)

        # If regional manager changed or assigned, sync manager's territory
        if territory.regional_manager:
            territory.regional_manager.territory = territory.name
            territory.regional_manager.save(update_fields=['territory'])

    def perform_destroy(self, instance):
        user = self.request.user
        if not is_admin_or_management(user):
            raise permissions.exceptions.PermissionDenied(
                "Only Platform Administrators can delete territories."
            )
        instance.delete()


class IndustryViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for Master Industries & Vertical Sectors.
    Read: Available to all authenticated CRM staff for lead intake, qualification, and scoping.
    Write: Available to all authenticated users so sales reps can add new industries dynamically while creating leads.
    """
    queryset = Industry.objects.all()
    serializer_class = IndustrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Industry.objects.all()
        include_inactive = self.request.query_params.get('include_inactive')
        if not (include_inactive and include_inactive.lower() in ['true', '1']):
            qs = qs.filter(is_active=True)
        return qs.order_by('sort_order', 'name')

