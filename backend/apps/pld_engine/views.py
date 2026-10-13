from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.pld_engine.models import (
    ProductConfigurationVersion, ICPProfile, ICPRule, ScoreModel,
    QuestionnaireTemplate, QuestionnaireQuestion, QuestionAnswerOption,
    PipelineStage, StageGate
)
from apps.pld_engine.serializers import (
    ProductConfigurationVersionSerializer, PipelineStageSerializer,
    StageGateSerializer, ICPProfileSerializer, ICPRuleSerializer,
    ScoreModelSerializer, QuestionnaireTemplateSerializer,
    QuestionnaireQuestionSerializer, QuestionAnswerOptionSerializer
)
from apps.pld_assessments.models import AccountProductAssessment, ScoreClassification
from apps.pld_assessments.serializers import AccountProductAssessmentSerializer
from apps.pld_engine.services import ICPEvaluator, PLDScoreCalculator, GateValidator
from apps.pld_engine.permissions import IsAdminOrProductManager, CanOverridePLDScore
from django.db.models import Q
from apps.authentication.backends import get_request_user, is_sales_staff, is_management_or_admin
from apps.accounts.models import Account
from apps.products.models import Product
from apps.leads.models import Lead


class ProductConfigurationVersionViewSet(viewsets.ModelViewSet):
    queryset = ProductConfigurationVersion.objects.all().prefetch_related(
        'stages__gates', 'icp_rules', 'score_models', 'questionnaires__questions__options'
    )
    serializer_class = ProductConfigurationVersionSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['post'], url_path='evaluate-icp')
    def evaluate_icp(self, request):
        user = get_request_user(request)
        account_id = request.data.get('account_id')
        product_id = request.data.get('product_id')
        lead_id = request.data.get('lead_id')

        try:
            account = Account.objects.get(id=account_id)
            product = Product.objects.get(id=product_id)
        except (Account.DoesNotExist, Product.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        config_version = product.configurations.filter(status='PUBLISHED').first() or product.configurations.first()
        if not config_version:
            return Response({'error': 'No configuration found for this product'}, status=status.HTTP_400_BAD_REQUEST)

        lead = Lead.objects.filter(id=lead_id).first() if lead_id else None
        if not lead and account and product:
            lead = account.leads.filter(primary_product=product).first()
        if lead and is_sales_staff(user) and lead.owner_id and lead.owner_id != getattr(user, 'id', None):
            return Response({'error': 'Lead not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        res = ICPEvaluator.evaluate(
            account=account,
            product=product,
            config_version=config_version,
            lead=lead,
            user=user
        )
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='evaluate-pld-score')
    def evaluate_pld_score(self, request):
        user = get_request_user(request)
        assessment_id = request.data.get('assessment_id')
        dimension_inputs = request.data.get('answers', {})

        try:
            assessment = AccountProductAssessment.objects.get(id=assessment_id)
        except AccountProductAssessment.DoesNotExist:
            return Response({'error': 'Assessment not found'}, status=status.HTTP_404_NOT_FOUND)

        if assessment.lead and is_sales_staff(user) and assessment.lead.owner_id and assessment.lead.owner_id != getattr(user, 'id', None):
            return Response({'error': 'Assessment not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        res = PLDScoreCalculator.calculate(
            assessment=assessment,
            dimension_inputs=dimension_inputs,
            user=user
        )
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='validate-gate')
    def validate_gate(self, request):
        user = get_request_user(request)
        lead_id = request.data.get('lead_id')
        target_stage_id = request.data.get('target_stage_id')

        try:
            lead = Lead.objects.get(id=lead_id)
            target_stage = PipelineStage.objects.get(id=target_stage_id)
        except (Lead.DoesNotExist, PipelineStage.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        if is_sales_staff(user) and lead.owner_id and lead.owner_id != getattr(user, 'id', None):
            return Response({'error': 'Lead not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        res = GateValidator.validate_lead_stage(lead, target_stage)
        return Response(res, status=status.HTTP_200_OK)


class ICPProfileViewSet(viewsets.ModelViewSet):
    queryset = ICPProfile.objects.all().select_related('product', 'config_version').prefetch_related('rules')
    serializer_class = ICPProfileSerializer
    permission_classes = [IsAdminOrProductManager]

    def get_queryset(self):
        qs = super().get_queryset()
        product_id = self.request.query_params.get('product')
        if product_id:
            qs = qs.filter(product_id=product_id)
        return qs


class ICPRuleViewSet(viewsets.ModelViewSet):
    queryset = ICPRule.objects.all().select_related('config_version', 'profile')
    serializer_class = ICPRuleSerializer
    permission_classes = [IsAdminOrProductManager]

    def get_queryset(self):
        qs = super().get_queryset()
        product_id = self.request.query_params.get('product')
        config_version_id = self.request.query_params.get('config_version')
        profile_id = self.request.query_params.get('profile')
        rule_type = self.request.query_params.get('rule_type')
        if product_id:
            qs = qs.filter(Q(config_version__product_id=product_id) | Q(profile__product_id=product_id)).distinct()
        if config_version_id:
            qs = qs.filter(config_version_id=config_version_id)
        if profile_id:
            qs = qs.filter(profile_id=profile_id)
        if rule_type:
            qs = qs.filter(rule_type=rule_type)
        return qs


class ScoreModelViewSet(viewsets.ModelViewSet):
    queryset = ScoreModel.objects.all().select_related('config_version')
    serializer_class = ScoreModelSerializer
    permission_classes = [IsAdminOrProductManager]

    def get_queryset(self):
        qs = super().get_queryset()
        config_version_id = self.request.query_params.get('config_version')
        if config_version_id:
            qs = qs.filter(config_version_id=config_version_id)
        return qs


class QuestionnaireTemplateViewSet(viewsets.ModelViewSet):
    queryset = QuestionnaireTemplate.objects.all().select_related('config_version', 'product').prefetch_related('questions__options')
    serializer_class = QuestionnaireTemplateSerializer
    permission_classes = [IsAdminOrProductManager]

    def get_queryset(self):
        qs = super().get_queryset()
        product_id = self.request.query_params.get('product')
        config_version_id = self.request.query_params.get('config_version')
        stage_code = self.request.query_params.get('stage_code')
        if product_id:
            qs = qs.filter(product_id=product_id)
        if config_version_id:
            qs = qs.filter(config_version_id=config_version_id)
        if stage_code:
            qs = qs.filter(stage_code=stage_code)
        return qs

    @action(detail=False, methods=['get'], url_path='product/(?P<product_id>[^/.]+)')
    def for_product(self, request, product_id=None):
        template = QuestionnaireTemplate.objects.filter(
            product_id=product_id, is_active=True
        ).prefetch_related('questions__options').first()
        if not template:
            # Fallback to product configurations
            product = Product.objects.filter(id=product_id).first()
            if product:
                config = product.configurations.filter(status='PUBLISHED').first() or product.configurations.first()
                if config:
                    template = config.questionnaires.first()

        if not template:
            return Response({'error': 'No qualification questionnaire template found for this product'}, status=status.HTTP_404_NOT_FOUND)

        return Response(QuestionnaireTemplateSerializer(template).data, status=status.HTTP_200_OK)


class QuestionnaireQuestionViewSet(viewsets.ModelViewSet):
    queryset = QuestionnaireQuestion.objects.all().select_related('template').prefetch_related('options')
    serializer_class = QuestionnaireQuestionSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        template_id = self.request.query_params.get('template')
        if template_id:
            qs = qs.filter(template_id=template_id)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        if 'template_id' in data and 'template' not in data:
            data['template'] = data['template_id']
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({'message': 'Question deleted successfully'}, status=status.HTTP_200_OK)


class QuestionAnswerOptionViewSet(viewsets.ModelViewSet):
    queryset = QuestionAnswerOption.objects.all().select_related('question')
    serializer_class = QuestionAnswerOptionSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        if 'question_id' in data and 'question' not in data:
            data['question'] = data['question_id']
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({'message': 'Answer option deleted successfully'}, status=status.HTTP_200_OK)


class PipelineStageViewSet(viewsets.ModelViewSet):
    queryset = PipelineStage.objects.all().prefetch_related('gates')
    serializer_class = PipelineStageSerializer
    permission_classes = [permissions.AllowAny]


class StageGateViewSet(viewsets.ModelViewSet):
    queryset = StageGate.objects.all()
    serializer_class = StageGateSerializer
    permission_classes = [permissions.AllowAny]


# Dedicated REST endpoints (Requirement 21)
class ICPEndpointViewSet(viewsets.ViewSet):
    """
    Dedicated ICP REST APIs:
    - GET  /api/v1/icp/
    - POST /api/v1/icp/evaluate/
    - GET  /api/v1/icp/rules/
    - GET  /api/v1/icp/profiles/
    - GET  /api/v1/icp/assessments/
    """
    permission_classes = [permissions.AllowAny]

    def list(self, request):
        return Response({
            "message": "TEXOL ICP Engine API v1",
            "endpoints": [
                "/api/v1/icp/evaluate/",
                "/api/v1/icp/rules/",
                "/api/v1/icp/profiles/",
                "/api/v1/icp/assessments/"
            ]
        })

    @action(detail=False, methods=['post'], url_path='evaluate')
    def evaluate(self, request):
        user = get_request_user(request)
        account_id = request.data.get('account_id')
        product_id = request.data.get('product_id')
        lead_id = request.data.get('lead_id')

        try:
            account = Account.objects.get(id=account_id)
            product = Product.objects.get(id=product_id)
        except (Account.DoesNotExist, Product.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        config_version = product.configurations.filter(status='PUBLISHED').first() or product.configurations.first()
        lead = Lead.objects.filter(id=lead_id).first() if lead_id else None
        if lead and is_sales_staff(user) and lead.owner_id and lead.owner_id != getattr(user, 'id', None):
            return Response({'error': 'Lead not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        res = ICPEvaluator.evaluate(
            account=account,
            product=product,
            config_version=config_version,
            lead=lead,
            user=user
        )
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='rules')
    def rules(self, request):
        product_id = request.query_params.get('product')
        profile_id = request.query_params.get('profile')
        qs = ICPRule.objects.filter(is_active=True)
        if product_id:
            qs = qs.filter(Q(config_version__product_id=product_id) | Q(profile__product_id=product_id))
        if profile_id:
            qs = qs.filter(profile_id=profile_id)
        return Response(ICPRuleSerializer(qs.distinct(), many=True).data)

    @action(detail=False, methods=['get'], url_path='profiles')
    def profiles(self, request):
        product_id = request.query_params.get('product')
        qs = ICPProfile.objects.filter(is_active=True)
        if product_id:
            qs = qs.filter(product_id=product_id)
        return Response(ICPProfileSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'], url_path='assessments')
    def assessments(self, request):
        user = get_request_user(request)
        qs = AccountProductAssessment.objects.all().select_related('account', 'product')
        if is_sales_staff(user):
            qs = qs.filter(Q(lead__owner=user) | Q(assessed_by=user))
        account_id = request.query_params.get('account')
        product_id = request.query_params.get('product')
        lead_id = request.query_params.get('lead')
        if account_id:
            qs = qs.filter(account_id=account_id)
        if product_id:
            qs = qs.filter(product_id=product_id)
        if lead_id:
            qs = qs.filter(lead_id=lead_id)
        return Response(AccountProductAssessmentSerializer(qs, many=True).data)


class PLDEndpointViewSet(viewsets.ViewSet):
    """
    Dedicated PLD Qualification & Scoring REST APIs:
    - GET  /api/v1/pld/
    - POST /api/v1/pld/score/
    - POST /api/v1/pld/assess/
    - POST /api/v1/pld/override/
    - GET  /api/v1/pld/assessments/
    - GET  /api/v1/pld/models/
    """
    permission_classes = [permissions.AllowAny]

    def list(self, request):
        return Response({
            "message": "TEXOL PLD Qualification Engine API v1",
            "endpoints": [
                "/api/v1/pld/score/",
                "/api/v1/pld/assess/",
                "/api/v1/pld/override/",
                "/api/v1/pld/assessments/",
                "/api/v1/pld/models/"
            ]
        })

    @action(detail=False, methods=['post'], url_path='score')
    def score(self, request):
        user = get_request_user(request)
        assessment_id = request.data.get('assessment_id')
        dimension_inputs = request.data.get('answers', {})

        try:
            assessment = AccountProductAssessment.objects.get(id=assessment_id)
        except AccountProductAssessment.DoesNotExist:
            return Response({'error': 'Assessment not found'}, status=status.HTTP_404_NOT_FOUND)

        if assessment.lead and is_sales_staff(user) and assessment.lead.owner_id and assessment.lead.owner_id != getattr(user, 'id', None):
            return Response({'error': 'Assessment not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        res = PLDScoreCalculator.calculate(
            assessment=assessment,
            dimension_inputs=dimension_inputs,
            user=user
        )
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='assess')
    def assess(self, request):
        user = get_request_user(request)
        # Full one-step ICP + PLD assessment
        account_id = request.data.get('account_id')
        product_id = request.data.get('product_id')
        lead_id = request.data.get('lead_id')
        answers = request.data.get('answers', {})

        try:
            account = Account.objects.get(id=account_id)
            product = Product.objects.get(id=product_id)
        except (Account.DoesNotExist, Product.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        config_version = product.configurations.filter(status='PUBLISHED').first() or product.configurations.first()
        lead = Lead.objects.filter(id=lead_id).first() if lead_id else None
        if lead and is_sales_staff(user) and lead.owner_id and lead.owner_id != getattr(user, 'id', None):
            return Response({'error': 'Lead not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        icp_res = ICPEvaluator.evaluate(
            account=account, product=product, config_version=config_version,
            lead=lead, user=user
        )
        assessment = AccountProductAssessment.objects.get(id=icp_res['assessment_id'])
        score_res = PLDScoreCalculator.calculate(
            assessment=assessment, dimension_inputs=answers,
            user=user
        )

        return Response({
            "icp": icp_res,
            "pld_score": score_res,
            "assessment": AccountProductAssessmentSerializer(assessment).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='override', permission_classes=[CanOverridePLDScore])
    def override_score(self, request):
        user = get_request_user(request)
        if not is_management_or_admin(user):
            return Response({'error': 'Staff members are not authorized to override PLD scores.'}, status=status.HTTP_403_FORBIDDEN)

        assessment_id = request.data.get('assessment_id')
        new_score = request.data.get('pld_score')
        new_classification = request.data.get('score_classification')
        reason = request.data.get('override_reason')

        if not reason or not str(reason).strip():
            return Response(
                {'error': 'A documented override reason is mandatory to override an assessment.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            assessment = AccountProductAssessment.objects.get(id=assessment_id)
        except AccountProductAssessment.DoesNotExist:
            return Response({'error': 'Assessment not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            updated_assessment = PLDScoreCalculator.override(
                assessment=assessment,
                new_score=new_score,
                new_classification=new_classification,
                reason=reason,
                user=user
            )
            return Response({
                "message": "PLD score manually overridden with documented audit reason.",
                "assessment": AccountProductAssessmentSerializer(updated_assessment).data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='assessments')
    def assessments(self, request):
        user = get_request_user(request)
        qs = AccountProductAssessment.objects.all().select_related('account', 'product')
        if is_sales_staff(user):
            qs = qs.filter(Q(lead__owner=user) | Q(assessed_by=user))
        return Response(AccountProductAssessmentSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'], url_path='models')
    def models(self, request):
        product_id = request.query_params.get('product')
        qs = ScoreModel.objects.filter(is_active=True)
        if product_id:
            qs = qs.filter(config_version__product_id=product_id)
        return Response(ScoreModelSerializer(qs, many=True).data)
