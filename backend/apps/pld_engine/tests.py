from django.test import TestCase
from apps.products.models import Product
from apps.accounts.models import Account, AccountAttribute
from apps.pld_engine.models import (
    ProductConfigurationVersion, ICPProfile, ICPRule, ICPRuleType, RuleOperator
)
from apps.pld_engine.services import ICPEvaluator
from apps.pld_assessments.models import ICPResultStatus


class ICPEvaluationThresholdTests(TestCase):
    def setUp(self):
        self.product = Product.objects.create(
            name="VanForces Route Execution",
            code="VANFORCES",
            category="DISTRIBUTION"
        )
        self.config_v1 = ProductConfigurationVersion.objects.create(
            product=self.product,
            version_number=1,
            status='PUBLISHED'
        )
        self.icp_profile = ICPProfile.objects.create(
            product=self.product,
            config_version=self.config_v1,
            name="VanForces ICP Profile",
            version_number=1,
            is_active=True,
            pass_threshold=50  # Default 50% threshold
        )

        # Mandatory Knock-out: field_sales == True
        self.ko_rule = ICPRule.objects.create(
            config_version=self.config_v1,
            profile=self.icp_profile,
            field_name="field_sales",
            rule_type=ICPRuleType.KNOCKOUT,
            operator=RuleOperator.EQUALS,
            target_value=True,
            is_mandatory=True,
            is_active=True
        )

        # Fit Rule 1: vans_count >= 5 (50 points)
        self.fit_vans = ICPRule.objects.create(
            config_version=self.config_v1,
            profile=self.icp_profile,
            field_name="vans_count",
            rule_type=ICPRuleType.FIT,
            operator=RuleOperator.GREATER_THAN_OR_EQUAL,
            target_value=5,
            points=50,
            weight=50,
            is_active=True
        )

        # Fit Rule 2: salesmen_count >= 10 (50 points)
        self.fit_salesmen = ICPRule.objects.create(
            config_version=self.config_v1,
            profile=self.icp_profile,
            field_name="salesmen_count",
            rule_type=ICPRuleType.FIT,
            operator=RuleOperator.GREATER_THAN_OR_EQUAL,
            target_value=10,
            points=50,
            weight=50,
            is_active=True
        )

    def test_low_fit_score_fails_icp_even_if_knockouts_pass(self):
        """
        When knockout passes (field_sales=True) but operational fit score is low
        (e.g., vans_count < 5 and salesmen_count < 10 -> fit_score = 0%),
        ICP result MUST be FAIL instead of PASS.
        """
        account = Account.objects.create(
            company_name="Low Fit Trading Est",
            industry="Wholesale Distribution"
        )
        AccountAttribute.objects.create(
            account=account, product=self.product, attribute_key="field_sales", attribute_value=True
        )
        AccountAttribute.objects.create(
            account=account, product=self.product, attribute_key="vans_count", attribute_value=2  # Below 5
        )
        AccountAttribute.objects.create(
            account=account, product=self.product, attribute_key="salesmen_count", attribute_value=3  # Below 10
        )

        res = ICPEvaluator.evaluate(account=account, product=self.product)

        self.assertEqual(res['result'], ICPResultStatus.FAIL)
        self.assertTrue(res['knockout_passed'])
        self.assertEqual(res['fit_score'], 0)
        self.assertEqual(res['pass_threshold'], 50)
        self.assertTrue(any('below the minimum required qualification threshold' in r for r in res['breakdown']['why_result_occurred']))

    def test_satisfying_threshold_passes_icp(self):
        """
        When knockout passes and fit score meets/exceeds pass_threshold (50%),
        ICP result MUST be PASS.
        """
        account = Account.objects.create(
            company_name="Good Fit Logistics",
            industry="Wholesale Distribution"
        )
        AccountAttribute.objects.create(
            account=account, product=self.product, attribute_key="field_sales", attribute_value=True
        )
        AccountAttribute.objects.create(
            account=account, product=self.product, attribute_key="vans_count", attribute_value=8  # Meets 50 pts
        )
        AccountAttribute.objects.create(
            account=account, product=self.product, attribute_key="salesmen_count", attribute_value=3  # 0 pts
        )

        res = ICPEvaluator.evaluate(account=account, product=self.product)

        self.assertEqual(res['result'], ICPResultStatus.PASS)
        self.assertTrue(res['knockout_passed'])
        self.assertEqual(res['fit_score'], 50)
        self.assertEqual(res['pass_threshold'], 50)

    def test_admin_custom_threshold_configuration(self):
        """
        Admin can adjust pass_threshold. If raised to 70%, 50% score fails.
        If lowered to 20%, 50% score passes.
        """
        account = Account.objects.create(
            company_name="Custom Threshold Test",
            industry="Wholesale Distribution"
        )
        AccountAttribute.objects.create(
            account=account, product=self.product, attribute_key="field_sales", attribute_value=True
        )
        AccountAttribute.objects.create(
            account=account, product=self.product, attribute_key="vans_count", attribute_value=8  # 50 pts
        )

        # Admin raises threshold to 75%
        self.icp_profile.pass_threshold = 75
        self.icp_profile.save()

        res_strict = ICPEvaluator.evaluate(account=account, product=self.product)
        self.assertEqual(res_strict['result'], ICPResultStatus.FAIL)
        self.assertEqual(res_strict['pass_threshold'], 75)

        # Admin lowers threshold to 30%
        self.icp_profile.pass_threshold = 30
        self.icp_profile.save()

        res_lenient = ICPEvaluator.evaluate(account=account, product=self.product)
        self.assertEqual(res_lenient['result'], ICPResultStatus.PASS)
        self.assertEqual(res_lenient['pass_threshold'], 30)
