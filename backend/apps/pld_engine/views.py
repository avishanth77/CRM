from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.pld_engine.models import (
    ProductConfigurationVersion, ICPRule, ScoreModel,
    QuestionnaireTemplate, PipelineStage, StageGate
)
from apps.pld_engine.serializers import (
    ProductConfigurationVersionSerializer, PipelineStageSerializer,
    StageGateSerializer, ICPRuleSerializer, ScoreModelSerializer,
    QuestionnaireTemplateSerializer
)
from apps.pld_engine.services import ICPEvaluator, PLDScoreCalculator, GateValidator
from apps.accounts.models import Account
from apps.products.models import Product
from apps.leads.models import Lead
from apps.pld_assessments.models import AccountProductAssessment


class ProductConfigurationVersionViewSet(viewsets.ModelViewSet):
    queryset = ProductConfigurationVersion.objects.all().prefetch_related(
        'stages__gates', 'icp_rules', 'score_models', 'questionnaires'
    )
    serializer_class = ProductConfigurationVersionSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['post'], url_path='evaluate-icp')
    def evaluate_icp(self, request):
        account_id = request.data.get('account_id')
        product_id = request.data.get('product_id')
        lead_id = request.data.get('lead_id')

        try:
            account = Account.objects.get(id=account_id)
            product = Product.objects.get(id=product_id)
        except (Account.DoesNotExist, Product.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        config_version = product.configurations.filter(status='PUBLISHED').first()
        if not config_version:
            return Response({'error': 'No published configuration found for this product'}, status=status.HTTP_400_BAD_REQUEST)

        lead = Lead.objects.filter(id=lead_id).first() if lead_id else None
        res = ICPEvaluator.evaluate(account, product, config_version, lead=lead, user=request.user if request.user.is_authenticated else None)
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='evaluate-pld-score')
    def evaluate_pld_score(self, request):
        assessment_id = request.data.get('assessment_id')
        dimension_inputs = request.data.get('answers', {})

        try:
            assessment = AccountProductAssessment.objects.get(id=assessment_id)
        except AccountProductAssessment.DoesNotExist:
            return Response({'error': 'Assessment not found'}, status=status.HTTP_404_NOT_FOUND)

        res = PLDScoreCalculator.calculate(
            assessment,
            dimension_inputs,
            user=request.user if request.user.is_authenticated else None
        )
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='validate-gate')
    def validate_gate(self, request):
        lead_id = request.data.get('lead_id')
        target_stage_id = request.data.get('target_stage_id')

        try:
            lead = Lead.objects.get(id=lead_id)
            target_stage = PipelineStage.objects.get(id=target_stage_id)
        except (Lead.DoesNotExist, PipelineStage.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        res = GateValidator.validate_lead_stage(lead, target_stage)
        return Response(res, status=status.HTTP_200_OK)


class PipelineStageViewSet(viewsets.ModelViewSet):
    queryset = PipelineStage.objects.all().prefetch_related('gates')
    serializer_class = PipelineStageSerializer
    permission_classes = [permissions.AllowAny]


class StageGateViewSet(viewsets.ModelViewSet):
    queryset = StageGate.objects.all()
    serializer_class = StageGateSerializer
    permission_classes = [permissions.AllowAny]


class QuestionnaireTemplateViewSet(viewsets.ModelViewSet):
    queryset = QuestionnaireTemplate.objects.all()
    serializer_class = QuestionnaireTemplateSerializer
    permission_classes = [permissions.AllowAny]
