from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from apps.authentication.backends import get_request_user, is_sales_staff
from apps.pld_assessments.models import AccountProductAssessment, ScoreAssessment, ScoreClassification
from apps.pld_assessments.serializers import AccountProductAssessmentSerializer, ScoreAssessmentSerializer
from apps.pld_engine.services import PLDScoreCalculator
from apps.pld_engine.permissions import CanOverridePLDScore


class AccountProductAssessmentViewSet(viewsets.ModelViewSet):
    queryset = AccountProductAssessment.objects.all().select_related(
        'account', 'product', 'config_version', 'lead', 'assessed_by', 'overridden_by'
    ).prefetch_related('dimension_breakdown')
    serializer_class = AccountProductAssessmentSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        user = get_request_user(self.request)
        if is_sales_staff(user):
            qs = qs.filter(Q(lead__owner=user) | Q(assessed_by=user))

        account_id = self.request.query_params.get('account')
        lead_id = self.request.query_params.get('lead')
        product_id = self.request.query_params.get('product')
        icp_result = self.request.query_params.get('icp_result')

        if account_id:
            qs = qs.filter(account_id=account_id)
        if lead_id:
            qs = qs.filter(lead_id=lead_id)
        if product_id:
            qs = qs.filter(product_id=product_id)
        if icp_result:
            qs = qs.filter(icp_result=icp_result)
        return qs

    @action(detail=True, methods=['post'], url_path='override', permission_classes=[CanOverridePLDScore])
    def override(self, request, pk=None):
        """
        Authorized manual override for PLD score or classification.
        Mandatory override reason required for governance and auditability.
        """
        assessment = self.get_object()
        reason = request.data.get('override_reason')
        new_classification = request.data.get('score_classification')
        new_score = request.data.get('pld_score')

        if not reason or not str(reason).strip():
            return Response(
                {'error': 'A documented override reason is mandatory to override an assessment.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_score is None:
            new_score = assessment.pld_score

        try:
            updated = PLDScoreCalculator.override(
                assessment=assessment,
                new_score=new_score,
                new_classification=new_classification,
                reason=reason,
                user=request.user if request.user.is_authenticated else None
            )
            return Response({
                'message': 'Assessment manually overridden with documented audit reason',
                'assessment': AccountProductAssessmentSerializer(updated).data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ScoreAssessmentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ScoreAssessment.objects.all().select_related('assessment')
    serializer_class = ScoreAssessmentSerializer
    permission_classes = [permissions.AllowAny]
