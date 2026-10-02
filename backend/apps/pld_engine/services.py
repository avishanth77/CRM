from decimal import Decimal
from apps.pld_engine.models import ICPRule, ICPRuleType, RuleOperator, ScoreModel, ScoreDimension, StageGate
from apps.pld_assessments.models import AccountProductAssessment, ScoreAssessment, ScoreClassification


class ICPEvaluator:
    """
    Evaluates ICP criteria dynamically for an Account x Product without hardcoded fields.
    """
    @staticmethod
    def evaluate(account, product, config_version, lead=None, user=None):
        # Fetch dynamic attributes for this product
        attr_dict = {
            attr.attribute_key: attr.attribute_value
            for attr in account.custom_attributes.filter(product=product)
        }

        # Context dictionary combining Account core fields and dynamic product attributes
        context = {
            "industry": account.industry,
            "sub_industry": account.sub_industry,
            "country": account.country,
            "employees_count": account.employees_count,
            "distribution_centers_count": account.distribution_centers_count,
            **attr_dict
        }

        rules = config_version.icp_rules.filter(is_mandatory=True)
        knockout_passed = True
        knockout_failures = []

        total_fit_points = 0
        max_fit_points = 0

        for rule in rules:
            field_val = context.get(rule.field_name)
            is_satisfied = ICPEvaluator._check_operator(field_val, rule.operator, rule.target_value)

            if rule.rule_type == ICPRuleType.KNOCKOUT:
                if not is_satisfied:
                    knockout_passed = False
                    knockout_failures.append({
                        "field": rule.field_name,
                        "operator": rule.operator,
                        "expected": rule.target_value,
                        "actual": field_val
                    })
            else:  # FIT rule
                max_fit_points += rule.points
                if is_satisfied:
                    total_fit_points += rule.points

        fit_score = int((total_fit_points / max_fit_points * 100)) if max_fit_points > 0 else 100

        # Persist assessment snapshot
        assessment, _ = AccountProductAssessment.objects.update_or_create(
            account=account,
            product=product,
            config_version=config_version,
            defaults={
                "lead": lead,
                "icp_knockout_passed": knockout_passed,
                "icp_fit_score": fit_score,
                "assessed_by": user
            }
        )

        return {
            "knockout_passed": knockout_passed,
            "knockout_failures": knockout_failures,
            "fit_score": fit_score,
            "assessment_id": assessment.id
        }

    @staticmethod
    def _check_operator(actual, op, target):
        if actual is None:
            return False
        if op == RuleOperator.EQUALS:
            return actual == target
        elif op == RuleOperator.NOT_EQUALS:
            return actual != target
        elif op == RuleOperator.GREATER_THAN:
            return actual > target
        elif op == RuleOperator.GREATER_THAN_OR_EQUAL:
            return actual >= target
        elif op == RuleOperator.LESS_THAN:
            return actual < target
        elif op == RuleOperator.LESS_THAN_OR_EQUAL:
            return actual <= target
        elif op == RuleOperator.IN:
            return actual in target if isinstance(target, list) else False
        elif op == RuleOperator.NOT_IN:
            return actual not in target if isinstance(target, list) else True
        elif op == RuleOperator.CONTAINS:
            return target in str(actual)
        return False


class PLDScoreCalculator:
    """
    Dynamically computes 0-100 PLD Score across configured dimensions.
    """
    @staticmethod
    def calculate(assessment, dimension_inputs, user=None):
        score_models = assessment.config_version.score_models.filter(is_active=True)
        total_weighted_score = Decimal('0.00')

        # Clean existing dimension records for this assessment
        assessment.dimension_breakdown.all().delete()

        for sm in score_models:
            input_val = dimension_inputs.get(sm.dimension_name)
            mapping = sm.input_mapping or {}

            # Map raw input to 0-100 raw score
            raw_score = 0
            if isinstance(input_val, (int, float)):
                raw_score = min(max(int(input_val), 0), 100)
            elif str(input_val) in mapping:
                raw_score = int(mapping[str(input_val)])
            else:
                raw_score = 50  # Default moderate if unmapped

            weighted = (Decimal(raw_score) * Decimal(sm.weight_percentage)) / Decimal('100.00')
            total_weighted_score += weighted

            ScoreAssessment.objects.create(
                assessment=assessment,
                dimension_name=sm.dimension_name,
                input_value={"value": input_val},
                raw_score=raw_score,
                weight_percentage=sm.weight_percentage,
                weighted_score=weighted,
                evidence_text=f"Calculated from input '{input_val}' with weight {sm.weight_percentage}%"
            )

        final_score = int(total_weighted_score)
        
        # Classification output
        if final_score <= 30:
            classification = ScoreClassification.NURTURE
        elif final_score <= 60:
            classification = ScoreClassification.DEVELOPMENT
        elif final_score <= 80:
            classification = ScoreClassification.QUALIFIED
        else:
            classification = ScoreClassification.HIGH_PRIORITY

        # SPECIFICATION MANDATE: A high score must NOT qualify a lead if the required business problem is missing.
        problem_missing = False
        if assessment.lead and not assessment.lead.recorded_problems.exists():
            problem_missing = True

        if final_score > 60 and problem_missing and not assessment.is_overridden:
            classification = ScoreClassification.DEVELOPMENT

        assessment.pld_score = final_score
        assessment.score_classification = classification
        assessment.assessed_by = user
        assessment.save(update_fields=['pld_score', 'score_classification', 'assessed_by', 'assessed_at'])

        return {
            "pld_score": final_score,
            "classification": classification,
            "problem_missing_capped": (final_score > 60 and problem_missing and not assessment.is_overridden),
            "dimension_scores": [
                {
                    "dimension": d.dimension_name,
                    "raw_score": d.raw_score,
                    "weighted_score": float(d.weighted_score),
                    "weight_percentage": d.weight_percentage
                }
                for d in assessment.dimension_breakdown.all()
            ]
        }


class GateValidator:
    """
    Enforces stage gates before allowing transitions in the PLD pursuit and opportunity lifecycles.
    """
    @staticmethod
    def validate_lead_stage(lead, target_stage):
        gates = target_stage.gates.filter(is_mandatory=True)
        results = []
        all_passed = True

        for gate in gates:
            rules = gate.condition_rules or {}
            satisfied = True
            missing = []

            # 1. Require at least one problem
            if rules.get("min_problems", 0) > 0:
                prob_count = lead.recorded_problems.count()
                if prob_count < rules["min_problems"]:
                    satisfied = False
                    missing.append(f"At least {rules['min_problems']} business problem required (found {prob_count})")

            # 2. Require next action
            if rules.get("require_next_action", False):
                if not lead.next_activity_due_at or not lead.next_action_description:
                    satisfied = False
                    missing.append("Future Next Action description and due date are mandatory")

            # 3. Require minimum score
            if "min_score" in rules:
                assessment = lead.account.assessments.filter(product=lead.primary_product).first()
                if not assessment or assessment.pld_score < rules["min_score"]:
                    satisfied = False
                    current_score = assessment.pld_score if assessment else 0
                    missing.append(f"Minimum PLD Score of {rules['min_score']} required (current: {current_score})")

            # 4. Require discovery product mapping
            if rules.get("require_product_mapping", False):
                latest_discovery = lead.discoveries.first()
                if not latest_discovery or not latest_discovery.is_product_mapping_complete:
                    satisfied = False
                    missing.append("All documented problems must be mapped to product capabilities in Discovery")

            # 5. Require ICP knockout passed
            if rules.get("require_icp_passed", False):
                assessment = lead.account.assessments.filter(product=lead.primary_product).first()
                if not assessment or not assessment.icp_knockout_passed:
                    satisfied = False
                    missing.append("Account must pass all ICP knock-out rules for this product")

            if not satisfied:
                all_passed = False

            results.append({
                "gate_code": gate.gate_code,
                "gate_name": gate.gate_name,
                "is_mandatory": gate.is_mandatory,
                "satisfied": satisfied,
                "missing": missing
            })

        return {
            "all_passed": all_passed,
            "target_stage": target_stage.stage_name,
            "checklist": results
        }
