import uuid
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel
from apps.products.models import Product


class ConfigStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    PUBLISHED = 'PUBLISHED', 'Published'
    ARCHIVED = 'ARCHIVED', 'Archived'


class ProductConfigurationVersion(BaseModel):
    """
    Versioned container for all PLD qualification rules, score models, and stage gates.
    Ensures historical assessments remain 100% reproducible and explainable.
    """
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="configurations")
    version_number = models.PositiveIntegerField(default=1)
    status = models.CharField(
        max_length=32,
        choices=ConfigStatus.choices,
        default=ConfigStatus.DRAFT,
        db_index=True
    )
    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="published_configurations"
    )
    notes = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ('product', 'version_number')
        ordering = ['product', '-version_number']

    def __str__(self):
        return f"{self.product.name} v{self.version_number} [{self.status}]"


class ICPProfile(BaseModel):
    """
    ICP Profile representing a configured target customer profile per product.
    Allows managing multiple versions or segments of ICP criteria.
    """
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="icp_profiles")
    config_version = models.ForeignKey(
        ProductConfigurationVersion,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="icp_profiles"
    )
    name = models.CharField(max_length=255, default="Default ICP Profile")
    version_number = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    pass_threshold = models.PositiveIntegerField(
        default=50,
        help_text="Minimum ICP fit score (0-100%) required to PASS ICP qualification"
    )
    description = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['product', '-version_number']

    def __str__(self):
        return f"{self.product.name} ICP Profile v{self.version_number} ({self.name})"


class ICPRuleType(models.TextChoices):
    KNOCKOUT = 'KNOCKOUT', 'Knock-out (Disqualifies Outright)'
    FIT = 'FIT', 'Fit Score (Contributes to ICP Fit %)'


class RuleOperator(models.TextChoices):
    EQUALS = 'EQ', 'Equals'
    NOT_EQUALS = 'NEQ', 'Not Equals'
    GREATER_THAN = 'GT', 'Greater Than'
    GREATER_THAN_OR_EQUAL = 'GTE', 'Greater Than or Equal'
    LESS_THAN = 'LT', 'Less Than'
    LESS_THAN_OR_EQUAL = 'LTE', 'Less Than or Equal'
    IN = 'IN', 'In List'
    NOT_IN = 'NOT_IN', 'Not In List'
    CONTAINS = 'CONTAINS', 'Contains'
    BETWEEN = 'BETWEEN', 'Between Range'


class ICPRule(BaseModel):
    """
    Configurable ICP qualification criteria per product version.
    Separated into knock-out rules and fit score criteria.
    """
    config_version = models.ForeignKey(
        ProductConfigurationVersion,
        on_delete=models.CASCADE,
        related_name="icp_rules"
    )
    profile = models.ForeignKey(
        ICPProfile,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="rules"
    )
    rule_type = models.CharField(max_length=16, choices=ICPRuleType.choices, default=ICPRuleType.FIT)
    field_name = models.CharField(
        max_length=128,
        help_text="Target attribute e.g. industry, employees_count, salesmen_count, vans_count, current_erp"
    )
    operator = models.CharField(max_length=16, choices=RuleOperator.choices, default=RuleOperator.EQUALS)
    target_value = models.JSONField(
        help_text="Target value or array of values (e.g. ['FMCG', 'Bakery'], or 20)"
    )
    weight = models.PositiveIntegerField(
        default=10,
        help_text="Weight for Fit score (ignored for knockout rules)"
    )
    points = models.PositiveIntegerField(default=10)
    is_mandatory = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    description = models.CharField(max_length=255, blank=True, null=True)
    failure_reason = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Human-readable explanation if this rule is not satisfied"
    )

    def __str__(self):
        return f"[{self.rule_type}] {self.field_name} {self.operator} {self.target_value}"


class ScoreDimension(models.TextChoices):
    PROBLEM_SEVERITY = 'PROBLEM_SEVERITY', 'Problem Severity'
    BUSINESS_VALUE = 'BUSINESS_VALUE', 'Business Value'
    DECISION_ACCESS = 'DECISION_ACCESS', 'Decision-Maker Access'
    TIMELINE = 'TIMELINE', 'Timeline'
    TECHNICAL_FIT = 'TECHNICAL_FIT', 'Technical Fit'
    COMMERCIAL_POTENTIAL = 'COMMERCIAL_POTENTIAL', 'Commercial Potential'


class ScoreModel(BaseModel):
    """
    Defines dimension-level weights and mapping tables to convert raw inputs to 0-100 scores.
    """
    config_version = models.ForeignKey(
        ProductConfigurationVersion,
        on_delete=models.CASCADE,
        related_name="score_models"
    )
    dimension_name = models.CharField(max_length=32, choices=ScoreDimension.choices)
    weight_percentage = models.PositiveIntegerField(
        help_text="Weight percentage (all active dimensions sum to 100)"
    )
    input_mapping = models.JSONField(
        default=dict,
        blank=True,
        help_text="Mapping rules, e.g. {'<3 months': 100, '3-6 months': 70, '6-12 months': 40, '>12 months': 10}"
    )
    thresholds = models.JSONField(
        default=dict,
        blank=True,
        help_text="Configurable outcome thresholds e.g. {'NURTURE': [0, 30], 'DEVELOPMENT': [31, 60], 'QUALIFIED': [61, 80], 'HIGH_PRIORITY': [81, 100]}"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('config_version', 'dimension_name')

    def __str__(self):
        return f"{self.get_dimension_name_display()}: {self.weight_percentage}%"


class QuestionnaireTemplate(BaseModel):
    """
    Dynamic product-specific question set rendered in UI forms.
    Answers feed directly into scoring models and stage gate checks.
    """
    config_version = models.ForeignKey(
        ProductConfigurationVersion,
        on_delete=models.CASCADE,
        related_name="questionnaires"
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="questionnaire_templates"
    )
    stage_code = models.CharField(max_length=64, default="PLD_QUALIFICATION")
    title = models.CharField(max_length=255)
    version_number = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    schema_json = models.JSONField(
        default=list,
        help_text="List of questions, answer choices, input types, and feeds_dimension mappings"
    )

    def __str__(self):
        return f"{self.title} ({self.stage_code}) v{self.version_number}"


class QuestionType(models.TextChoices):
    TEXT = 'TEXT', 'Text'
    NUMBER = 'NUMBER', 'Number'
    CHOICE = 'CHOICE', 'Single Choice'
    MULTI_CHOICE = 'MULTI_CHOICE', 'Multiple Choice'
    BOOLEAN = 'BOOLEAN', 'Yes / No'


class QuestionnaireQuestion(BaseModel):
    """
    Individual question within a qualification questionnaire template.
    Feeds directly into dimension scoring.
    """
    template = models.ForeignKey(
        QuestionnaireTemplate,
        on_delete=models.CASCADE,
        related_name="questions"
    )
    code = models.CharField(max_length=64, blank=True, null=True)
    question_text = models.CharField(max_length=500)
    question_type = models.CharField(max_length=32, choices=QuestionType.choices, default=QuestionType.CHOICE)
    order = models.PositiveIntegerField(default=1)
    is_required = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    feeds_dimension = models.CharField(max_length=32, choices=ScoreDimension.choices, null=True, blank=True)
    dimension_weight_points = models.PositiveIntegerField(default=10)
    help_text = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        ordering = ['template', 'order']

    def __str__(self):
        return f"{self.order}. {self.question_text}"


class QuestionAnswerOption(BaseModel):
    """
    Configurable answer option for choice/select questions with mapped score points.
    """
    question = models.ForeignKey(
        QuestionnaireQuestion,
        on_delete=models.CASCADE,
        related_name="options"
    )
    label = models.CharField(max_length=255)
    value = models.CharField(max_length=255)
    points = models.PositiveIntegerField(default=50, help_text="Points awarded towards feeds_dimension (0-100)")
    order = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['question', 'order']

    def __str__(self):
        return f"{self.label} ({self.points} pts)"


class PipelineType(models.TextChoices):
    PURSUIT = 'PURSUIT', 'Pursuit (PLD)'
    OPPORTUNITY = 'OPPORTUNITY', 'Opportunity'
    CUSTOMER = 'CUSTOMER', 'Customer Lifecycle'


class PipelineStage(BaseModel):
    """
    Configurable pipeline stages for a product version.
    Stages can be marked is_required=False (optional; can be skipped with 'Not Required' reason).
    """
    config_version = models.ForeignKey(
        ProductConfigurationVersion,
        on_delete=models.CASCADE,
        related_name="stages"
    )
    pipeline_type = models.CharField(max_length=16, choices=PipelineType.choices, default=PipelineType.PURSUIT)
    stage_code = models.CharField(max_length=64)
    stage_name = models.CharField(max_length=128)
    sequence_order = models.PositiveIntegerField(default=1)
    is_required = models.BooleanField(
        default=True,
        help_text="True if mandatory; False if optional in this product pipeline (e.g. Demo or POC)"
    )

    class Meta:
        ordering = ['pipeline_type', 'sequence_order']
        unique_together = ('config_version', 'pipeline_type', 'stage_code')

    def __str__(self):
        req = "Mandatory" if self.is_required else "Optional"
        return f"[{self.pipeline_type}] {self.sequence_order}. {self.stage_name} ({req})"


class StageGate(BaseModel):
    """
    Evidence-based criteria required before progressing past a stage.
    """
    pipeline_stage = models.ForeignKey(
        PipelineStage,
        on_delete=models.CASCADE,
        related_name="gates"
    )
    gate_code = models.CharField(max_length=64)
    gate_name = models.CharField(max_length=255)
    condition_rules = models.JSONField(
        default=dict,
        help_text="JSON rule defining mandatory fields, problem requirements, score thresholds"
    )
    is_mandatory = models.BooleanField(default=True)

    def __str__(self):
        return f"Gate: {self.gate_name} for {self.pipeline_stage.stage_name}"
