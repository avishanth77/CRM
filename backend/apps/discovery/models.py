import uuid
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel
from apps.accounts.models import Account
from apps.leads.models import Lead, LeadProblem
from apps.products.models import Problem


class Discovery(BaseModel):
    """
    Discovery session workspace.
    Refines customer problems, current processes, stakeholders, timeline, and product mapping.
    """
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="discoveries")
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="discoveries")
    conducted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conducted_discoveries"
    )

    current_process_notes = models.TextField(blank=True, null=True, help_text="Current operations and systems")
    business_impact_summary = models.TextField(blank=True, null=True, help_text="Overall operational/financial impact")
    stakeholders_involved_notes = models.TextField(blank=True, null=True, help_text="Buying committee / decision influencers")
    decision_process_notes = models.TextField(blank=True, null=True, help_text="Procurement & evaluation process")
    timeline_notes = models.CharField(max_length=255, blank=True, null=True)
    budget_notes = models.CharField(max_length=255, blank=True, null=True)
    technical_constraints_notes = models.TextField(blank=True, null=True)

    # Discovery Completion Gate: Must map all problems to capabilities before Discovery is complete
    is_product_mapping_complete = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Discovery #{str(self.id)[:8]} - {self.account.company_name}"


class DiscoveryProblem(BaseModel):
    """
    Refined problem documentation within Discovery.
    Links back optionally to lead_problem_id to avoid data re-entry.
    """
    discovery = models.ForeignKey(Discovery, on_delete=models.CASCADE, related_name="problems")
    problem = models.ForeignKey(Problem, on_delete=models.CASCADE, related_name="discovery_occurrences")
    lead_problem = models.ForeignKey(
        LeadProblem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="discovery_problems"
    )

    severity = models.CharField(
        max_length=16,
        choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High'), ('CRITICAL', 'Critical')],
        default='HIGH'
    )
    frequency = models.CharField(
        max_length=16,
        choices=[('DAILY', 'Daily'), ('WEEKLY', 'Weekly'), ('MONTHLY', 'Monthly'), ('OCCASIONAL', 'Occasional')],
        default='DAILY'
    )
    impact_description = models.TextField(help_text="Detailed consequence of this problem")
    quantified_loss_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Estimated financial or time loss per month/year"
    )

    class Meta:
        unique_together = ('discovery', 'problem')

    def __str__(self):
        return f"{self.discovery}: {self.problem.name} [{self.severity}]"
