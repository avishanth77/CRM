import uuid
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel
from apps.accounts.models import Account
from apps.products.models import Product
from apps.pld_engine.models import ProductConfigurationVersion, ScoreDimension
from apps.leads.models import Lead


class ScoreClassification(models.TextChoices):
    NURTURE = 'NURTURE', 'Nurture (0-30)'
    DEVELOPMENT = 'DEVELOPMENT', 'PLD Development (31-60)'
    QUALIFIED = 'QUALIFIED', 'Qualified PLD (61-80)'
    HIGH_PRIORITY = 'HIGH_PRIORITY', 'High Priority (81-100)'


class ICPResultStatus(models.TextChoices):
    PASS = 'PASS', 'Pass'
    FAIL = 'FAIL', 'Fail'
    PENDING = 'PENDING', 'Pending Information'
    REVIEW_REQUIRED = 'REVIEW_REQUIRED', 'Review Required'


class AccountProductAssessment(BaseModel):
    """
    Stores the exact result of an ICP check and PLD Score evaluation per Account x Product.
    Pinned to an immutable config_version_id so evaluation results are 100% reproducible.
    """
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="assessments")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="assessments")
    config_version = models.ForeignKey(
        ProductConfigurationVersion,
        on_delete=models.PROTECT,
        related_name="assessments"
    )
    lead = models.ForeignKey(
        Lead,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assessments"
    )

    # ICP Evaluation
    icp_result = models.CharField(
        max_length=32,
        choices=ICPResultStatus.choices,
        default=ICPResultStatus.PENDING,
        db_index=True
    )
    icp_knockout_passed = models.BooleanField(default=True)
    icp_fit_score = models.PositiveIntegerField(default=0)
    icp_rule_version = models.PositiveIntegerField(default=1)
    icp_reasons = models.JSONField(
        default=list,
        blank=True,
        help_text="Detailed reasons for knockout failures or fit score contributions"
    )
    icp_evidence = models.JSONField(
        default=dict,
        blank=True,
        help_text="Snapshot of account attributes evaluated against ICP rules"
    )
    icp_breakdown = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured breakdown: what_we_know, what_is_missing, why_result_occurred, what_to_do_next"
    )

    # PLD Score Evaluation
    pld_score = models.PositiveIntegerField(default=0)
    score_model_version = models.PositiveIntegerField(default=1)
    score_classification = models.CharField(
        max_length=32,
        choices=ScoreClassification.choices,
        default=ScoreClassification.NURTURE
    )
    pld_breakdown = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured breakdown: what_is_known, what_is_missing, why_score_exists, what_to_do_next"
    )
    questionnaire_answers = models.JSONField(
        default=dict,
        blank=True,
        help_text="Captured answers from the qualification questionnaire"
    )

    # Override tracking
    is_overridden = models.BooleanField(default=False)
    original_pld_score = models.PositiveIntegerField(null=True, blank=True)
    override_reason = models.TextField(blank=True, null=True)
    overridden_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="overridden_assessments"
    )
    overridden_at = models.DateTimeField(null=True, blank=True)

    # Qualification History
    qualification_history = models.JSONField(
        default=list,
        blank=True,
        help_text="Historical record of all calculations, overrides, and gate checks"
    )

    assessed_at = models.DateTimeField(auto_now=True)
    assessed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="performed_assessments"
    )

    class Meta:
        ordering = ['-assessed_at']

    def __str__(self):
        return f"{self.account.company_name} - {self.product.code} [ICP: {self.icp_result} | PLD: {self.pld_score}]"


class ScoreAssessment(BaseModel):
    """
    Itemized dimension-level score breakdown for an assessment.
    Stores raw inputs, calculated points, and documented evidence for explainability.
    """
    assessment = models.ForeignKey(
        AccountProductAssessment,
        on_delete=models.CASCADE,
        related_name="dimension_breakdown"
    )
    dimension_name = models.CharField(max_length=32, choices=ScoreDimension.choices)
    input_value = models.JSONField(
        default=dict,
        help_text="User answers / raw metrics captured during evaluation"
    )
    raw_score = models.PositiveIntegerField(default=0, help_text="Normalized 0-100 dimension score")
    weight_percentage = models.PositiveIntegerField(default=0)
    weighted_score = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    evidence_text = models.TextField(blank=True, null=True)
    explanation = models.CharField(max_length=255, blank=True, null=True)
    rule_version = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ('assessment', 'dimension_name')

    def __str__(self):
        return f"{self.assessment}: {self.dimension_name} = {self.weighted_score}"
