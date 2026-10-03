from django.utils import timezone
from django.core.exceptions import ValidationError
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.evaluations.models import (
    Demo, DemoParticipant, DemoUseCaseMapping,
    POC, POCParticipant, POCSuccessCriterion
)
from apps.evaluations.serializers import (
    DemoSerializer, DemoParticipantSerializer, DemoUseCaseMappingSerializer,
    POCSerializer, POCParticipantSerializer, POCSuccessCriterionSerializer
)
from apps.evaluations.services import DemoService, DemoValidator, POCService, POCValidator
from apps.audit_logging.models import AuditLog, AuditAction


class DemoViewSet(viewsets.ModelViewSet):
    queryset = Demo.objects.all().select_related(
        'account', 'lead', 'discovery', 'opportunity', 'product', 'presenter'
    ).prefetch_related(
        'participants__contact', 'participants__user',
        'use_cases__discovery_problem__problem',
        'use_cases__capability__module'
    )
    serializer_class = DemoSerializer
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
        demo = serializer.save(presenter=serializer.validated_data.get('presenter') or user)

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.CREATE,
            entity_type='Demo',
            entity_id=demo.id,
            changes_json={
                "account": demo.account.company_name,
                "lead": str(demo.lead_id),
                "scheduled_at": demo.scheduled_at.isoformat() if demo.scheduled_at else None
            }
        )

    @action(detail=True, methods=['get'], url_path='readiness')
    def readiness(self, request, pk=None):
        demo = self.get_object()
        readiness_data = DemoValidator.validate_readiness(demo)
        return Response(readiness_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='complete')
    def complete(self, request, pk=None):
        demo = self.get_object()
        user = request.user if request.user.is_authenticated else None

        feedback = request.data.get('customer_feedback')
        objections = request.data.get('objections_raised')
        questions = request.data.get('customer_questions')
        response_text = request.data.get('customer_response')
        fit = request.data.get('fit_assessment')
        next_action = request.data.get('next_action_description')
        next_action_due = request.data.get('next_action_due_at')

        try:
            res = DemoService.complete_demo(
                demo=demo,
                user=user,
                customer_feedback=feedback,
                objections_raised=objections,
                customer_questions=questions,
                customer_response=response_text,
                fit_assessment=fit,
                next_action_description=next_action,
                next_action_due_at=next_action_due
            )
            demo.refresh_from_db()
            return Response({
                "message": res["message"],
                "demo": DemoSerializer(demo).data
            }, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response(e.message_dict if hasattr(e, 'message_dict') else {'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='mark-not-required')
    def mark_not_required(self, request, pk=None):
        demo = self.get_object()
        user = request.user if request.user.is_authenticated else None
        reason = request.data.get('reason')

        try:
            res = DemoService.mark_demo_not_required(demo, reason, user=user)
            demo.refresh_from_db()
            return Response({
                "message": res["message"],
                "demo": DemoSerializer(demo).data
            }, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response(e.message_dict if hasattr(e, 'message_dict') else {'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='not-required')
    def not_required(self, request, pk=None):
        return self.mark_not_required(request, pk)

    @action(detail=True, methods=['post'], url_path='add-participant')
    def add_participant(self, request, pk=None):
        demo = self.get_object()
        user = request.user if request.user.is_authenticated else None

        participant = DemoService.add_participant(
            demo=demo,
            contact_id=request.data.get('contact_id'),
            user_id=request.data.get('user_id'),
            name=request.data.get('name', ''),
            email=request.data.get('email', ''),
            participant_type=request.data.get('participant_type', 'CUSTOMER'),
            role_title=request.data.get('role_title', ''),
            notes=request.data.get('notes', ''),
            user=user
        )
        return Response(DemoParticipantSerializer(participant).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='map-use-case')
    def map_use_case(self, request, pk=None):
        demo = self.get_object()
        user = request.user if request.user.is_authenticated else None

        mapping = DemoService.map_use_case(
            demo=demo,
            discovery_problem_id=request.data.get('discovery_problem_id'),
            capability_id=request.data.get('capability_id'),
            module_id=request.data.get('module_id'),
            notes=request.data.get('notes', ''),
            was_demonstrated=request.data.get('was_demonstrated', True),
            user=user
        )
        return Response(DemoUseCaseMappingSerializer(mapping).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='unmap-use-case')
    def unmap_use_case(self, request, pk=None):
        demo = self.get_object()
        use_case_id = request.data.get('use_case_id')
        mapping = demo.use_cases.filter(id=use_case_id).first()
        if mapping:
            mapping.delete()
            return Response({"message": "Use case mapping removed."}, status=status.HTTP_200_OK)
        return Response({"error": "Use case mapping not found"}, status=status.HTTP_404_NOT_FOUND)


class DemoParticipantViewSet(viewsets.ModelViewSet):
    queryset = DemoParticipant.objects.all().select_related('demo', 'contact', 'user')
    serializer_class = DemoParticipantSerializer
    permission_classes = [permissions.AllowAny]


class DemoUseCaseMappingViewSet(viewsets.ModelViewSet):
    queryset = DemoUseCaseMapping.objects.all().select_related(
        'demo', 'discovery_problem', 'module', 'capability'
    )
    serializer_class = DemoUseCaseMappingSerializer
    permission_classes = [permissions.AllowAny]


class POCViewSet(viewsets.ModelViewSet):
    queryset = POC.objects.all().select_related(
        'account', 'lead', 'discovery', 'opportunity', 'product', 'owner'
    ).prefetch_related(
        'participants__contact', 'participants__user',
        'criteria_items'
    )
    serializer_class = POCSerializer
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
        poc = serializer.save(owner=serializer.validated_data.get('owner') or user)

        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.sa",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else "SYSTEM",
            action=AuditAction.CREATE,
            entity_type='POC',
            entity_id=poc.id,
            changes_json={
                "account": poc.account.company_name,
                "lead": str(poc.lead_id),
                "scope": poc.scope_description
            }
        )

    @action(detail=True, methods=['get'], url_path='readiness')
    def readiness(self, request, pk=None):
        poc = self.get_object()
        readiness_data = POCValidator.validate_readiness(poc)
        return Response(readiness_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='complete')
    def complete(self, request, pk=None):
        poc = self.get_object()
        user = request.user if request.user.is_authenticated else None

        result_metrics = request.data.get('result_metrics', {})
        results_summary = request.data.get('results_summary', '')
        feedback = request.data.get('customer_feedback', '')
        is_successful = request.data.get('is_successful', True)
        next_action = request.data.get('next_action_description')
        next_action_due = request.data.get('next_action_due_at')

        try:
            res = POCService.complete_poc(
                poc=poc,
                user=user,
                result_metrics=result_metrics,
                results_summary=results_summary,
                customer_feedback=feedback,
                is_successful=is_successful,
                next_action_description=next_action,
                next_action_due_at=next_action_due
            )
            poc.refresh_from_db()
            return Response({
                "message": res["message"],
                "poc": POCSerializer(poc).data
            }, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response(e.message_dict if hasattr(e, 'message_dict') else {'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='mark-not-required')
    def mark_not_required(self, request, pk=None):
        poc = self.get_object()
        user = request.user if request.user.is_authenticated else None
        reason = request.data.get('reason')

        try:
            res = POCService.mark_poc_not_required(poc, reason, user=user)
            poc.refresh_from_db()
            return Response({
                "message": res["message"],
                "poc": POCSerializer(poc).data
            }, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response(e.message_dict if hasattr(e, 'message_dict') else {'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='not-required')
    def not_required(self, request, pk=None):
        return self.mark_not_required(request, pk)

    @action(detail=True, methods=['post'], url_path='add-participant')
    def add_participant(self, request, pk=None):
        poc = self.get_object()
        user = request.user if request.user.is_authenticated else None

        participant = POCService.add_participant(
            poc=poc,
            contact_id=request.data.get('contact_id'),
            user_id=request.data.get('user_id'),
            name=request.data.get('name', ''),
            email=request.data.get('email', ''),
            participant_type=request.data.get('participant_type', 'CUSTOMER'),
            role_title=request.data.get('role_title', ''),
            notes=request.data.get('notes', ''),
            user=user
        )
        return Response(POCParticipantSerializer(participant).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='add-criterion')
    def add_criterion(self, request, pk=None):
        poc = self.get_object()
        user = request.user if request.user.is_authenticated else None

        crit = POCService.add_success_criterion(
            poc=poc,
            name=request.data.get('name', 'Success Criterion'),
            baseline=request.data.get('measurement_baseline', ''),
            target=request.data.get('expected_target', ''),
            actual=request.data.get('actual_result', ''),
            is_met=request.data.get('is_met', False),
            category=request.data.get('category', 'PERFORMANCE'),
            notes=request.data.get('notes', ''),
            user=user
        )
        return Response(POCSuccessCriterionSerializer(crit).data, status=status.HTTP_201_CREATED)


class POCParticipantViewSet(viewsets.ModelViewSet):
    queryset = POCParticipant.objects.all().select_related('poc', 'contact', 'user')
    serializer_class = POCParticipantSerializer
    permission_classes = [permissions.AllowAny]


class POCSuccessCriterionViewSet(viewsets.ModelViewSet):
    queryset = POCSuccessCriterion.objects.all().select_related('poc')
    serializer_class = POCSuccessCriterionSerializer
    permission_classes = [permissions.AllowAny]
