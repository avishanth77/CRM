from rest_framework import viewsets, permissions, status, exceptions
from django.db.models import Q
from apps.audit_logging.models import AuditLog
from apps.audit_logging.serializers import AuditLogSerializer
from apps.authentication.models import UserRole


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Universal Field-Level Audit Trail.
    Governed by Section 9.3:
    - ADMIN: Full Access
    - MANAGEMENT: Global Read
    - SALES_MANAGER: Team Scope
    - FINANCE: Financial Audit
    - PRODUCT_MANAGER: Config Audit
    - PARTNER_MANAGER: Partner Audit
    - Other frontline roles & Partner Users: Denied (403 Forbidden)
    """
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['entity_type', 'action', 'entity_id']

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return AuditLog.objects.none()

        if user.is_superuser or user.is_global_scope:
            qs = AuditLog.objects.all()
        else:
            canonical = getattr(user, 'canonical_role', str(user.role or ''))
            if canonical == UserRole.SALES_MANAGER:
                qs = AuditLog.objects.filter(
                    Q(actor=user) | Q(actor__manager=user) | Q(actor__territory=user.territory)
                )
            elif canonical == UserRole.FINANCE:
                qs = AuditLog.objects.filter(
                    entity_type__in=['Proposal', 'ProposalVersion', 'Opportunity', 'ERPSyncRecord', 'PartnerCommission']
                )
            elif canonical == UserRole.PRODUCT_MANAGER:
                qs = AuditLog.objects.filter(
                    entity_type__in=['Product', 'ProductConfigurationVersion', 'ICPRule', 'ScoreModel', 'ProductModule']
                )
            elif canonical == UserRole.PARTNER_MANAGER:
                qs = AuditLog.objects.filter(
                    entity_type__in=['Partner', 'PartnerUser', 'DealRegistration', 'ChannelConflict']
                )
            else:
                # Section 9.3: Frontline and partner roles have no audit access
                raise exceptions.PermissionDenied("You do not have authorization to view universal audit logs.")

        entity_id = self.request.query_params.get('entity_id')
        entity_type = self.request.query_params.get('entity_type')
        action_val = self.request.query_params.get('action')
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        if entity_type:
            qs = qs.filter(entity_type__iexact=entity_type)
        if action_val:
            qs = qs.filter(action=action_val)
        return qs.select_related('actor').order_by('-timestamp')
