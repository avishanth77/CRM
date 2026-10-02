from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.pld_assessments.models import AccountProductAssessment, ScoreAssessment, ScoreClassification
from apps.pld_assessments.serializers import AccountProductAssessmentSerializer, ScoreAssessmentSerializer


class AccountProductAssessmentViewSet(viewsets.ModelViewSet):
    queryset = AccountProductAssessment.objects.all().select_related(
        'account', 'product', 'config_version', 'lead', 'assessed_by', 'overridden_by'
    ).prefetch_related('dimension_breakdown')
    serializer_class = AccountProductAssessmentSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        account_id = self.request.query_params.get('account')
        lead_id = self.request.query_params.get('lead')
        product_id = self.request.query_params.get('product')

        if account_id:
            qs = qs.filter(account_id=account_id)
        if lead_id:
            qs = qs.filter(lead_id=lead_id)
        if product_id:
            qs = qs.filter(product_id=product_id)
        return qs

    @action(detail=True, methods=['post'], url_path='override')
    def override(self, request, pk=None):
        """
        Authorized manual override for PLD score or classification.
        Mandatory override reason required for governance and auditability.
        """
        assessment = self.get_object()
        reason = request.data.get('override_reason')
        new_classification = request.data.get('score_classification')
        new_score = request.data.get('pld_score')

        if not reason:
            return Response(
                {'error': 'A documented override reason is mandatory to override an assessment'},
                status=status.HTTP_400_BAD_REQUEST
            )

        assessment.is_overridden = True
        assessment.override_reason = reason
        assessment.overridden_by = request.user if request.user.is_authenticated else None

        if new_classification and new_classification in ScoreClassification.values:
            assessment.score_classification = new_classification
        if new_score is not None:
            try:
                assessment.pld_score = min(max(int(new_score), 0), 100)
            except (ValueError, TypeError):
                pass

        assessment.save(update_fields=[
            'is_overridden', 'override_reason', 'overridden_by',
            'score_classification', 'pld_score'
        ])

        return Response({
            'message': 'Assessment manually overridden with documented audit reason',
            'assessment': AccountProductAssessmentSerializer(assessment).data
        }, status=status.HTTP_200_OK)


class ScoreAssessmentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ScoreAssessment.objects.all()
    serializer_class = ScoreAssessmentSerializer
    permission_classes = [permissions.AllowAny]
