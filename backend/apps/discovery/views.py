from django.utils import timezone
from django.core.exceptions import ValidationError
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.discovery.models import (
    Discovery, DiscoveryProblem, DiscoveryProblemMapping,
    DiscoveryStakeholder, DiscoveryStatus
)
from apps.discovery.serializers import (
    DiscoverySerializer, DiscoveryProblemSerializer,
    DiscoveryProblemMappingSerializer, DiscoveryStakeholderSerializer
)
from apps.discovery.services import DiscoveryService, DiscoveryValidator
from apps.products.models import ProductCapability, ProductModule
from apps.products.serializers import ProductCapabilitySerializer, ProductModuleSerializer
from apps.accounts.models import Contact
from apps.audit_logging.models import AuditLog, AuditAction


class DiscoveryViewSet(viewsets.ModelViewSet):
    queryset = Discovery.objects.all().select_related(
        'lead', 'account', 'product', 'conducted_by'
    ).prefetch_related(
        'problems__problem',
        'problems__lead_problem__problem',
        'problems__capability_mappings__capability__module',
        'stakeholders__contact'
    )
    serializer_class = DiscoverySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        lead_id = self.request.query_params.get('lead')
        account_id = self.request.query_params.get('account')
        product_id = self.request.query_params.get('product')
        status_val = self.request.query_params.get('status')

        if lead_id:
            qs = qs.filter(lead_id=lead_id)
        if account_id:
            qs = qs.filter(account_id=account_id)
        if product_id:
            qs = qs.filter(product_id=product_id)
        if status_val:
            qs = qs.filter(status=status_val)
        return qs

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        discovery = serializer.save(conducted_by=user)

        # TEXOL SPECIFICATION: Carry forward confirmed lead problems into Discovery automatically
        DiscoveryService.carry_forward_lead_problems(discovery)

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.CREATE,
            entity_type='Discovery',
            entity_id=discovery.id,
            changes_json={
                "account": discovery.account.company_name,
                "lead_id": str(discovery.lead.id) if discovery.lead else None,
                "product": discovery.product.name if discovery.product else None
            }
        )

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        old_obj = self.get_object()
        old_values = {
            "current_process_notes": old_obj.current_process_notes,
            "business_impact_summary": old_obj.business_impact_summary,
            "timeline_notes": old_obj.timeline_notes
        }
        discovery = serializer.save()

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.UPDATE,
            entity_type='Discovery',
            entity_id=discovery.id,
            changes_json={
                "old": old_values,
                "new": {
                    "current_process_notes": discovery.current_process_notes,
                    "business_impact_summary": discovery.business_impact_summary,
                    "timeline_notes": discovery.timeline_notes
                }
            }
        )

    @action(detail=True, methods=['get'], url_path='readiness')
    def readiness(self, request, pk=None):
        discovery = self.get_object()
        readiness_data = DiscoveryValidator.validate_readiness(discovery)
        return Response(readiness_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='carry-forward')
    def carry_forward(self, request, pk=None):
        discovery = self.get_object()
        created_count = DiscoveryService.carry_forward_lead_problems(discovery)
        discovery.refresh_from_db()
        return Response({
            'message': f"Carried forward {created_count} problem(s) from PLD Qualification into Discovery.",
            'discovery': DiscoverySerializer(discovery).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='complete')
    def complete(self, request, pk=None):
        discovery = self.get_object()
        user = request.user if request.user.is_authenticated else None

        try:
            res = DiscoveryService.complete_discovery(discovery, user=user)
            discovery.refresh_from_db()
            res['discovery'] = DiscoverySerializer(discovery).data
            return Response(res, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response(e.message_dict if hasattr(e, 'message_dict') else {'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='complete-mapping')
    def complete_mapping(self, request, pk=None):
        # Backward-compatible alias for complete
        return self.complete(request, pk)

    @action(detail=True, methods=['get'], url_path='available-capabilities')
    def available_capabilities(self, request, pk=None):
        discovery = self.get_object()
        product = discovery.product or (discovery.lead.primary_product if discovery.lead else None)

        if not product:
            return Response({'modules': [], 'capabilities': []})

        modules = ProductModule.objects.filter(product=product, is_active=True).prefetch_related('capabilities')
        capabilities = ProductCapability.objects.filter(product=product, is_active=True).select_related('module')

        return Response({
            'product_id': str(product.id),
            'product_name': product.name,
            'product_code': product.code,
            'modules': ProductModuleSerializer(modules, many=True).data,
            'capabilities': ProductCapabilitySerializer(capabilities, many=True).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='add-stakeholder')
    def add_stakeholder(self, request, pk=None):
        discovery = self.get_object()
        contact_id = request.data.get('contact_id')
        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name', '')
        designation = request.data.get('designation', '')
        email = request.data.get('email', '')
        phone = request.data.get('phone', '')
        role_name = request.data.get('role_name', 'Evaluator')
        decision_role = request.data.get('decision_role', 'INFLUENCER')
        responsibility = request.data.get('responsibility', '')
        involvement_level = request.data.get('involvement_level', 'HIGH')
        notes = request.data.get('notes', '')

        contact = None
        if contact_id:
            contact = Contact.objects.filter(id=contact_id).first()
        elif email:
            contact, _ = Contact.objects.get_or_create(
                account=discovery.account,
                email=email,
                defaults={
                    'first_name': first_name or 'Stakeholder',
                    'last_name': last_name,
                    'designation': designation,
                    'phone': phone,
                    'role_type': decision_role
                }
            )
        elif first_name:
            contact = Contact.objects.create(
                account=discovery.account,
                first_name=first_name,
                last_name=last_name,
                designation=designation,
                phone=phone,
                role_type=decision_role
            )

        if not contact:
            return Response({'error': 'Contact identification (contact_id, email, or first_name) is required'}, status=status.HTTP_400_BAD_REQUEST)

        sh, _ = DiscoveryStakeholder.objects.update_or_create(
            discovery=discovery,
            contact=contact,
            defaults={
                'role_name': role_name,
                'decision_role': decision_role,
                'responsibility': responsibility,
                'involvement_level': involvement_level,
                'notes': notes
            }
        )

        return Response(DiscoveryStakeholderSerializer(sh).data, status=status.HTTP_201_CREATED)


class DiscoveryProblemViewSet(viewsets.ModelViewSet):
    queryset = DiscoveryProblem.objects.all().select_related(
        'discovery', 'problem', 'lead_problem'
    ).prefetch_related('capability_mappings__capability__module')
    serializer_class = DiscoveryProblemSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        dp = serializer.save()
        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.CREATE,
            entity_type='DiscoveryProblem',
            entity_id=dp.id,
            changes_json={
                "problem": dp.problem.name,
                "severity": dp.severity,
                "impact": dp.impact_description
            }
        )

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        old_dp = self.get_object()
        old_values = {
            "severity": old_dp.severity,
            "frequency": old_dp.frequency,
            "impact_description": old_dp.impact_description,
            "is_confirmed": old_dp.is_confirmed
        }
        dp = serializer.save()
        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.UPDATE,
            entity_type='DiscoveryProblem',
            entity_id=dp.id,
            changes_json={
                "old": old_values,
                "new": {
                    "severity": dp.severity,
                    "frequency": dp.frequency,
                    "impact_description": dp.impact_description,
                    "is_confirmed": dp.is_confirmed
                }
            }
        )

    @action(detail=True, methods=['post'], url_path='map-capability')
    def map_capability(self, request, pk=None):
        dp = self.get_object()
        capability_id = request.data.get('capability_id')
        expected_kpi_impact = request.data.get('expected_kpi_impact', '')
        notes = request.data.get('notes', '')

        try:
            capability = ProductCapability.objects.get(id=capability_id)
        except ProductCapability.DoesNotExist:
            return Response({'error': 'Product capability not found'}, status=status.HTTP_404_NOT_FOUND)

        mapping = DiscoveryService.map_problem_capability(
            discovery_problem=dp,
            capability=capability,
            expected_kpi_impact=expected_kpi_impact,
            notes=notes,
            user=request.user if request.user.is_authenticated else None
        )

        return Response(DiscoveryProblemMappingSerializer(mapping).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='unmap-capability')
    def unmap_capability(self, request, pk=None):
        dp = self.get_object()
        capability_id = request.data.get('capability_id')

        if not capability_id:
            return Response({'error': 'capability_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        DiscoveryService.unmap_problem_capability(
            discovery_problem=dp,
            capability_id=capability_id,
            user=request.user if request.user.is_authenticated else None
        )

        return Response({'message': 'Capability mapping removed successfully.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='toggle-confirm')
    def toggle_confirm(self, request, pk=None):
        dp = self.get_object()
        is_confirmed = request.data.get('is_confirmed', not dp.is_confirmed)
        dp.is_confirmed = is_confirmed
        dp.save(update_fields=['is_confirmed'])

        # Refresh discovery mapping gate status
        readiness = DiscoveryValidator.validate_readiness(dp.discovery)
        mapping_gate_passed = len(readiness["unmapped_problems"]) == 0
        dp.discovery.is_product_mapping_complete = mapping_gate_passed
        dp.discovery.save(update_fields=['is_product_mapping_complete'])

        return Response(DiscoveryProblemSerializer(dp).data, status=status.HTTP_200_OK)


class DiscoveryProblemMappingViewSet(viewsets.ModelViewSet):
    queryset = DiscoveryProblemMapping.objects.all().select_related(
        'discovery_problem__problem', 'capability__module'
    )
    serializer_class = DiscoveryProblemMappingSerializer
    permission_classes = [permissions.AllowAny]


class DiscoveryStakeholderViewSet(viewsets.ModelViewSet):
    queryset = DiscoveryStakeholder.objects.all().select_related(
        'discovery', 'contact'
    )
    serializer_class = DiscoveryStakeholderSerializer
    permission_classes = [permissions.AllowAny]
