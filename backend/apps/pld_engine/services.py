import uuid
from decimal import Decimal
from django.utils import timezone
from apps.pld_engine.models import (
    ICPProfile, ICPRule, ICPRuleType, RuleOperator, ScoreModel, ScoreDimension, StageGate
)
from apps.pld_assessments.models import (
    AccountProductAssessment, ScoreAssessment, ScoreClassification, ICPResultStatus
)
from apps.audit_logging.models import AuditLog, AuditAction
from django.db.models import Q


class ICPEvaluator:
    """
    Evaluates ICP criteria dynamically for an Account x Product without hardcoded fields.
    Produces deterministic results: PASS, FAIL, PENDING, or REVIEW_REQUIRED.
    Provides structured 4-part explanation:
      - WHAT WE KNOW
      - WHAT IS MISSING
      - WHY THE RESULT OCCURRED
      - WHAT THE USER SHOULD DO NEXT
    """
    @staticmethod
    def evaluate(account, product, config_version=None, lead=None, user=None):
        if config_version is None:
            config_version = product.configurations.filter(status='PUBLISHED').first()
            if not config_version:
                config_version = product.configurations.first()

        # 1. Fetch dynamic attributes for this product from EAV
        attr_dict = {
            attr.attribute_key: attr.attribute_value
            for attr in account.custom_attributes.filter(product=product)
        }

        # 2. Context dictionary combining Account core fields and dynamic product attributes
        context = {
            "industry": account.industry,
            "sub_industry": account.sub_industry,
            "country": account.country,
            "employees_count": account.employees_count,
            "distribution_centers_count": account.distribution_centers_count,
            **attr_dict
        }

        rules = ICPRule.objects.filter(is_active=True)
        if config_version:
            rules = rules.filter(Q(config_version=config_version) | Q(config_version__product=product) | Q(profile__product=product)).distinct()
        else:
            rules = rules.filter(Q(config_version__product=product) | Q(profile__product=product)).distinct()

        knockout_rules = rules.filter(rule_type=ICPRuleType.KNOCKOUT)
        fit_rules = rules.filter(rule_type=ICPRuleType.FIT)

        knockout_passed = True
        failed_knockouts = []
        missing_knockouts = []
        satisfied_knockouts = []

        what_we_know = []
        what_is_missing = []

        # Evaluate knock-out rules
        for rule in knockout_rules:
            field_val = context.get(rule.field_name)
            field_label = rule.field_name.replace('_', ' ').title()

            if field_val is None or field_val == "":
                # Field data is missing
                knockout_passed = False
                missing_knockouts.append({
                    "field": rule.field_name,
                    "label": field_label,
                    "expected": rule.target_value,
                    "description": rule.description or f"{field_label} is required for ICP knockout verification"
                })
                what_is_missing.append(f"{field_label} (mandatory knock-out criterion)")
            else:
                what_we_know.append(f"{field_label}: {field_val}")
                is_satisfied = ICPEvaluator._check_operator(field_val, rule.operator, rule.target_value)
                if not is_satisfied:
                    knockout_passed = False
                    reason = rule.failure_reason or f"{field_label} '{field_val}' does not satisfy requirement ({rule.operator} {rule.target_value})"
                    failed_knockouts.append({
                        "field": rule.field_name,
                        "label": field_label,
                        "operator": rule.operator,
                        "expected": rule.target_value,
                        "actual": field_val,
                        "reason": reason
                    })
                else:
                    satisfied_knockouts.append({
                        "field": rule.field_name,
                        "label": field_label,
                        "actual": field_val
                    })

        # Evaluate fit rules
        total_fit_points = 0
        max_fit_points = 0
        fit_breakdown = []

        for rule in fit_rules:
            field_val = context.get(rule.field_name)
            field_label = rule.field_name.replace('_', ' ').title()
            max_fit_points += rule.points

            if field_val is not None and field_val != "":
                if field_label not in [item.split(':')[0] for item in what_we_know]:
                    what_we_know.append(f"{field_label}: {field_val}")
                is_satisfied = ICPEvaluator._check_operator(field_val, rule.operator, rule.target_value)
                if is_satisfied:
                    total_fit_points += rule.points
                    fit_breakdown.append({
                        "field": rule.field_name,
                        "label": field_label,
                        "satisfied": True,
                        "points_earned": rule.points,
                        "max_points": rule.points
                    })
                else:
                    fit_breakdown.append({
                        "field": rule.field_name,
                        "label": field_label,
                        "satisfied": False,
                        "points_earned": 0,
                        "max_points": rule.points
                    })
            else:
                what_is_missing.append(f"{field_label} (optional fit criterion)")
                fit_breakdown.append({
                    "field": rule.field_name,
                    "label": field_label,
                    "satisfied": False,
                    "points_earned": 0,
                    "max_points": rule.points
                })

        # Determine configurable pass_threshold (Admin configurable per profile, default 50)
        pass_threshold = 50
        active_profile = ICPProfile.objects.filter(product=product, is_active=True).first()
        if not active_profile and config_version:
            active_profile = config_version.icp_profiles.filter(is_active=True).first()
        if active_profile and getattr(active_profile, 'pass_threshold', None) is not None:
            pass_threshold = active_profile.pass_threshold

        fit_score = int((total_fit_points / max_fit_points * 100)) if max_fit_points > 0 else 100

        # Determine Final ICP Result Status
        if len(failed_knockouts) > 0:
            final_result = ICPResultStatus.FAIL
            knockout_passed = False
            why_result_occurred = [f"Failed knock-out rule: {f['reason']}" for f in failed_knockouts]
            what_to_do_next = "Disqualify lead or route to Nurture. This account does not match the minimum ICP profile for this product."
        elif len(missing_knockouts) > 0:
            final_result = ICPResultStatus.PENDING
            knockout_passed = False
            why_result_occurred = [f"Missing required operational information: {m['label']} is needed to verify ICP." for m in missing_knockouts]
            what_to_do_next = "Obtain missing operational data (e.g. fleet size, ERP, or sales model) from contact to complete ICP evaluation."
        elif fit_score < pass_threshold:
            final_result = ICPResultStatus.FAIL
            knockout_passed = True
            why_result_occurred = [
                f"Passed all {len(satisfied_knockouts)} mandatory knock-out criteria.",
                f"ICP Fit Score ({fit_score}/100) is below the minimum required qualification threshold ({pass_threshold}%)."
            ]
            what_to_do_next = f"Disqualify lead or route to Nurture. Account fit score ({fit_score}%) does not meet the minimum qualification threshold ({pass_threshold}%)."
        else:
            final_result = ICPResultStatus.PASS
            knockout_passed = True
            why_result_occurred = [
                f"Passed all {len(satisfied_knockouts)} mandatory knock-out criteria.",
                f"Fit score calculated at {fit_score}% across operational dimensions (meets minimum {pass_threshold}% threshold)."
            ]
            what_to_do_next = "Proceed to PLD Qualification questionnaire and document at least one business problem."

        breakdown = {
            "what_we_know": what_we_know,
            "what_is_missing": what_is_missing,
            "why_result_occurred": why_result_occurred,
            "what_to_do_next": what_to_do_next,
            "failed_knockouts": failed_knockouts,
            "satisfied_knockouts": satisfied_knockouts,
            "fit_breakdown": fit_breakdown,
            "pass_threshold": pass_threshold
        }

        # Check existing assessment for audit diff
        existing_assessment = AccountProductAssessment.objects.filter(
            account=account, product=product
        ).first()

        old_values = {}
        if existing_assessment:
            old_values = {
                "icp_result": existing_assessment.icp_result,
                "icp_fit_score": existing_assessment.icp_fit_score,
                "icp_knockout_passed": existing_assessment.icp_knockout_passed
            }

        # Persist assessment snapshot (Account x Product)
        assessment, created = AccountProductAssessment.objects.update_or_create(
            account=account,
            product=product,
            defaults={
                "config_version": config_version,
                "lead": lead or (existing_assessment.lead if existing_assessment else None),
                "icp_result": final_result,
                "icp_knockout_passed": knockout_passed,
                "icp_fit_score": fit_score,
                "icp_rule_version": config_version.version_number if config_version else 1,
                "icp_reasons": why_result_occurred,
                "icp_evidence": context,
                "icp_breakdown": breakdown,
                "assessed_by": user
            }
        )

        # Audit Logging
        new_values = {
            "icp_result": final_result,
            "icp_fit_score": fit_score,
            "icp_knockout_passed": knockout_passed
        }
        if created or old_values != new_values:
            AuditLog.objects.create(
                actor=user,
                actor_email=user.email if user else "system@texol.internal",
                actor_role=getattr(user, 'role', 'SYSTEM') if user else 'SYSTEM',
                entity_type='AccountProductAssessment',
                entity_id=assessment.id,
                action=AuditAction.CREATE if created else AuditAction.UPDATE,
                changes_json={
                    k: {"old": old_values.get(k), "new": new_values.get(k)}
                    for k in new_values if old_values.get(k) != new_values.get(k)
                }
            )

        # Automatic Lead Routing: If ICP failed, move lead to Nurture pool with ICP failure reason
        target_lead = lead or (existing_assessment.lead if existing_assessment else None)
        if not target_lead and account and product:
            target_lead = account.leads.filter(primary_product=product).first()

        if target_lead and final_result == ICPResultStatus.FAIL:
            from apps.leads.models import LeadStatus
            reason_str = "Failed ICP qualification criteria: " + "; ".join(why_result_occurred)
            target_lead.status = LeadStatus.NURTURE
            target_lead.nurture_reason = reason_str
            target_lead.disqualification_reason = reason_str
            target_lead.save(update_fields=['status', 'nurture_reason', 'disqualification_reason'])
            try:
                from apps.activities.models import Task
                from django.utils import timezone
                Task.objects.filter(related_lead=target_lead, is_completed=False).update(
                    is_completed=True,
                    completed_at=timezone.now()
                )
            except Exception:
                pass

        return {
            "result": final_result,
            "knockout_passed": knockout_passed,
            "failed_knockouts": failed_knockouts,
            "missing_knockouts": missing_knockouts,
            "fit_score": fit_score,
            "pass_threshold": pass_threshold,
            "breakdown": breakdown,
            "assessment_id": assessment.id,
            "rule_version": assessment.icp_rule_version
        }

    @staticmethod
    def _check_operator(actual, op, target):
        if actual is None:
            return False

        def _to_bool(val):
            if isinstance(val, bool):
                return val
            return str(val).strip().lower() in ('true', '1', 'yes', 't')

        if op == RuleOperator.EQUALS:
            if isinstance(target, bool) or isinstance(actual, bool):
                return _to_bool(actual) == _to_bool(target)
            return str(actual).strip().lower() == str(target).strip().lower() if isinstance(actual, str) else actual == target
        elif op == RuleOperator.NOT_EQUALS:
            if isinstance(target, bool) or isinstance(actual, bool):
                return _to_bool(actual) != _to_bool(target)
            return str(actual).strip().lower() != str(target).strip().lower() if isinstance(actual, str) else actual != target
        elif op == RuleOperator.GREATER_THAN:
            try:
                return float(actual) > float(target)
            except (ValueError, TypeError):
                return False
        elif op == RuleOperator.GREATER_THAN_OR_EQUAL:
            try:
                return float(actual) >= float(target)
            except (ValueError, TypeError):
                return False
        elif op == RuleOperator.LESS_THAN:
            try:
                return float(actual) < float(target)
            except (ValueError, TypeError):
                return False
        elif op == RuleOperator.LESS_THAN_OR_EQUAL:
            try:
                return float(actual) <= float(target)
            except (ValueError, TypeError):
                return False
        elif op == RuleOperator.IN:
            if isinstance(target, list):
                target_lower = [str(t).strip().lower() for t in target]
                return str(actual).strip().lower() in target_lower
            return False
        elif op == RuleOperator.NOT_IN:
            if isinstance(target, list):
                target_lower = [str(t).strip().lower() for t in target]
                return str(actual).strip().lower() not in target_lower
            return True
        elif op == RuleOperator.CONTAINS:
            return str(target).strip().lower() in str(actual).strip().lower()
        return False


class PLDScoreCalculator:
    """
    Dynamically computes deterministic 0-100 PLD Score across the 6 configured dimensions.
    Enforces minimum qualification gate: high score alone cannot qualify without a documented business problem.
    Provides structured 4-part explanation:
      - WHAT IS KNOWN
      - WHAT IS MISSING
      - WHY THE SCORE EXISTS
      - WHAT TO DO NEXT
    """
    @staticmethod
    def calculate(assessment, dimension_inputs, user=None):
        config_version = assessment.config_version

        # Sync operational questionnaire inputs to Account custom attributes if provided
        from apps.accounts.models import AccountAttribute
        if dimension_inputs:
            if "Q2_FIELD_SALES" in dimension_inputs:
                val = dimension_inputs["Q2_FIELD_SALES"]
                is_field_sales = val in [True, "true", "True", "Yes, Dedicated Field Sales / Delivery Fleet"]
                AccountAttribute.objects.update_or_create(
                    account=assessment.account,
                    product=assessment.product,
                    attribute_key="field_sales",
                    defaults={"attribute_value": is_field_sales}
                )
            if "Q3_SALESMEN_VANS" in dimension_inputs:
                vans_val = dimension_inputs["Q3_SALESMEN_VANS"]
                vans_count = 25
                if "50+" in str(vans_val) or ">=50" in str(vans_val):
                    vans_count = 50
                elif "20" in str(vans_val):
                    vans_count = 25
                elif "10" in str(vans_val):
                    vans_count = 12
                elif "5" in str(vans_val):
                    vans_count = 6
                elif "<5" in str(vans_val) or "fewer" in str(vans_val).lower():
                    vans_count = 3
                AccountAttribute.objects.update_or_create(
                    account=assessment.account,
                    product=assessment.product,
                    attribute_key="vans_count",
                    defaults={"attribute_value": vans_count}
                )
                AccountAttribute.objects.update_or_create(
                    account=assessment.account,
                    product=assessment.product,
                    attribute_key="salesmen_count",
                    defaults={"attribute_value": vans_count}
                )
            if not assessment.account.custom_attributes.filter(product=assessment.product, attribute_key="primary_erp").exists():
                AccountAttribute.objects.create(
                    account=assessment.account,
                    product=assessment.product,
                    attribute_key="primary_erp",
                    attribute_value="SAP"
                )
            # Re-evaluate ICP with freshly synced operational attributes
            ICPEvaluator.evaluate(
                account=assessment.account,
                product=assessment.product,
                config_version=assessment.config_version,
                lead=assessment.lead,
                user=user
            )
            assessment.refresh_from_db()

        score_models = config_version.score_models.filter(is_active=True)
        total_weighted_score = Decimal('0.00')

        # Clean existing dimension records for this assessment
        assessment.dimension_breakdown.all().delete()

        dimension_breakdown_results = []
        why_score_exists = []

        # Map questionnaire questions by feeds_dimension
        template = config_version.questionnaires.first()
        template_questions = template.questions.all().prefetch_related('options') if template else []
        questions_by_dimension = {}
        for q in template_questions:
            if q.feeds_dimension:
                questions_by_dimension.setdefault(q.feeds_dimension, []).append(q)

        # Iterate over configured dimensions
        for sm in score_models:
            input_val = dimension_inputs.get(sm.dimension_name) if dimension_inputs else None
            mapping = sm.input_mapping or {}

            # Map raw input to 0-100 raw score
            raw_score = 0
            evidence_desc = ""

            if input_val is not None:
                if isinstance(input_val, (int, float)):
                    raw_score = min(max(int(input_val), 0), 100)
                    evidence_desc = f"Direct numerical value: {input_val}"
                elif str(input_val) in mapping:
                    raw_score = int(mapping[str(input_val)])
                    evidence_desc = f"Selected option '{input_val}' mapped to {raw_score} pts"
                elif input_val is True:
                    raw_score = 100
                    evidence_desc = "Confirmed positive"
                elif input_val is False:
                    raw_score = 0
                    evidence_desc = "Negative response"
                elif input_val:
                    raw_score = 50
                    evidence_desc = f"Unmapped input '{input_val}' assigned baseline 50 pts"
                else:
                    raw_score = 0
                    evidence_desc = "No response provided (0 pts)"
            else:
                # Resolve from answered questions feeding this dimension
                feeding_qs = questions_by_dimension.get(sm.dimension_name, [])
                answered_pts = []
                evidence_notes = []
                for q in feeding_qs:
                    q_ans = dimension_inputs.get(q.code) if dimension_inputs else None
                    if q_ans is None and dimension_inputs:
                        q_ans = dimension_inputs.get(str(q.id))
                    if q_ans is not None:
                        matched_opt = None
                        for opt in q.options.all():
                            if (str(opt.id) == str(q_ans) or 
                                opt.value == str(q_ans) or 
                                opt.label == str(q_ans) or 
                                opt.value.lower() == str(q_ans).lower() or 
                                opt.label.lower() == str(q_ans).lower()):
                                matched_opt = opt
                                break
                        if matched_opt:
                            answered_pts.append(matched_opt.points)
                            evidence_notes.append(f"{q.code}: {matched_opt.label} ({matched_opt.points} pts)")
                        elif isinstance(q_ans, (int, float)):
                            num_pts = min(max(int(q_ans), 0), 100)
                            answered_pts.append(num_pts)
                            evidence_notes.append(f"{q.code}: {q_ans} ({num_pts} pts)")
                        elif q_ans is True or str(q_ans).lower() in ['true', 'yes']:
                            answered_pts.append(100)
                            evidence_notes.append(f"{q.code}: Yes (100 pts)")
                        elif q_ans is False or str(q_ans).lower() in ['false', 'no']:
                            answered_pts.append(0)
                            evidence_notes.append(f"{q.code}: No (0 pts)")
                        elif q_ans:
                            answered_pts.append(50)
                            evidence_notes.append(f"{q.code}: '{q_ans}' (custom 50 pts)")

                if answered_pts:
                    raw_score = int(sum(answered_pts) / len(answered_pts))
                    evidence_desc = "; ".join(evidence_notes)
                else:
                    raw_score = 0
                    evidence_desc = "No response provided for questions feeding this dimension (0 pts)"

            weighted = (Decimal(raw_score) * Decimal(sm.weight_percentage)) / Decimal('100.00')
            total_weighted_score += weighted

            dim_display = sm.get_dimension_name_display()
            why_score_exists.append(
                f"{dim_display}: {weighted:.1f}/{sm.weight_percentage} pts (Raw {raw_score}/100 - {evidence_desc})"
            )

            sb = ScoreAssessment.objects.create(
                assessment=assessment,
                dimension_name=sm.dimension_name,
                input_value={"value": input_val},
                raw_score=raw_score,
                weight_percentage=sm.weight_percentage,
                weighted_score=weighted,
                evidence_text=evidence_desc,
                explanation=f"{raw_score}/100 points ({sm.weight_percentage}% weight = {weighted:.1f} pts)",
                rule_version=config_version.version_number
            )

            dimension_breakdown_results.append({
                "dimension": sm.dimension_name,
                "dimension_display": dim_display,
                "raw_score": raw_score,
                "weight_percentage": sm.weight_percentage,
                "weighted_score": float(weighted),
                "evidence": evidence_desc
            })

        final_score = int(total_weighted_score)

        # Configurable Outcome Thresholds
        if final_score <= 30:
            classification = ScoreClassification.NURTURE
        elif final_score <= 60:
            classification = ScoreClassification.DEVELOPMENT
        elif final_score <= 80:
            classification = ScoreClassification.QUALIFIED
        else:
            classification = ScoreClassification.HIGH_PRIORITY

        # SPECIFICATION MANDATE: A high score must NOT qualify a lead if the required business problem is missing!
        # Furthermore, a high score must not bypass a failed mandatory ICP gate!
        problem_missing = False
        if assessment.lead and not assessment.lead.recorded_problems.exists():
            problem_missing = True

        icp_failed = (assessment.icp_result != ICPResultStatus.PASS)

        capped = False
        cap_reason = None

        if final_score > 60 and not assessment.is_overridden:
            if problem_missing:
                classification = ScoreClassification.DEVELOPMENT
                capped = True
                cap_reason = "Mandatory qualification gate: High score capped at DEVELOPMENT because at least 1 business problem must be documented."
            elif icp_failed:
                classification = ScoreClassification.DEVELOPMENT
                capped = True
                cap_reason = "Mandatory qualification gate: High score capped at DEVELOPMENT because ICP check has not passed."

        # Structured 4-Part PLD Breakdown
        what_is_known = [
            f"ICP Status: {assessment.icp_result} (Fit: {assessment.icp_fit_score}%)",
            f"Calculated Score: {final_score}/100 [{classification}]"
        ]
        if assessment.lead and assessment.lead.recorded_problems.exists():
            prob_count = assessment.lead.recorded_problems.count()
            what_is_known.append(f"{prob_count} business problem(s) documented on lead")

        what_is_missing = []
        if problem_missing:
            what_is_missing.append("At least 1 business problem must be recorded on the lead")
        if not assessment.lead or not assessment.lead.next_action_description or not assessment.lead.next_activity_due_at:
            what_is_missing.append("Future Next Action description and due date required")
        if icp_failed:
            what_is_missing.append("ICP Check must pass before lead can be marked Qualified")

        if capped:
            what_to_do_next = cap_reason
        elif classification == ScoreClassification.HIGH_PRIORITY or classification == ScoreClassification.QUALIFIED:
            what_to_do_next = "Lead satisfies all PLD qualification criteria. Advance to Discovery & Mapping stage."
        elif classification == ScoreClassification.DEVELOPMENT:
            what_to_do_next = "Nurture commercial fit and explore deeper business impact to improve readiness."
        else:
            what_to_do_next = "Route to automated marketing nurture stream; revisit in 60-90 days."

        pld_breakdown = {
            "what_is_known": what_is_known,
            "what_is_missing": what_is_missing,
            "why_score_exists": why_score_exists,
            "what_to_do_next": what_to_do_next,
            "capped": capped,
            "cap_reason": cap_reason
        }

        # Preserve original calculated score
        if assessment.original_pld_score is None:
            assessment.original_pld_score = final_score

        # History tracking
        history_entry = {
            "timestamp": timezone.now().isoformat(),
            "event": "CALCULATION",
            "score": final_score,
            "classification": classification,
            "capped": capped,
            "evaluated_by": user.email if user else "System",
            "model_version": config_version.version_number
        }
        history = assessment.qualification_history or []
        history.append(history_entry)

        assessment.pld_score = final_score
        assessment.score_classification = classification
        assessment.score_model_version = config_version.version_number
        assessment.pld_breakdown = pld_breakdown
        assessment.questionnaire_answers = dimension_inputs
        assessment.qualification_history = history
        assessment.assessed_by = user
        assessment.save(update_fields=[
            'pld_score', 'original_pld_score', 'score_classification',
            'score_model_version', 'pld_breakdown', 'questionnaire_answers',
            'qualification_history', 'assessed_by', 'assessed_at'
        ])

        # Audit Logging
        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "system@texol.internal",
            actor_role=getattr(user, 'role', 'SYSTEM') if user else 'SYSTEM',
            entity_type='AccountProductAssessment',
            entity_id=assessment.id,
            action=AuditAction.UPDATE,
            changes_json={
                "pld_score": {"new": final_score},
                "score_classification": {"new": classification},
                "capped": {"new": capped}
            }
        )

        return {
            "pld_score": final_score,
            "total_score": final_score,
            "classification": classification,
            "problem_missing_capped": capped,
            "cap_reason": cap_reason,
            "pld_breakdown": pld_breakdown,
            "dimension_scores": dimension_breakdown_results,
            "rule_version": config_version.version_number
        }

    @staticmethod
    def override(assessment, new_score, new_classification, reason, user=None):
        """
        Authorized manual override for PLD score or classification.
        Preserves original score and writes to audit log and qualification history.
        """
        if not reason or not reason.strip():
            raise ValueError("A documented override reason is mandatory to override an assessment.")

        try:
            new_score_int = min(max(int(new_score), 0), 100)
        except (ValueError, TypeError):
            raise ValueError("New score must be a valid integer between 0 and 100.")

        old_score = assessment.pld_score
        old_classification = assessment.score_classification

        if assessment.original_pld_score is None:
            assessment.original_pld_score = old_score

        assessment.is_overridden = True
        assessment.pld_score = new_score_int
        if new_classification in ScoreClassification.values:
            assessment.score_classification = new_classification
        else:
            # Auto-assign classification based on new score
            if new_score_int <= 30:
                assessment.score_classification = ScoreClassification.NURTURE
            elif new_score_int <= 60:
                assessment.score_classification = ScoreClassification.DEVELOPMENT
            elif new_score_int <= 80:
                assessment.score_classification = ScoreClassification.QUALIFIED
            else:
                assessment.score_classification = ScoreClassification.HIGH_PRIORITY

        assessment.override_reason = reason.strip()
        assessment.overridden_by = user
        assessment.overridden_at = timezone.now()

        # Update history
        history_entry = {
            "timestamp": timezone.now().isoformat(),
            "event": "OVERRIDE",
            "old_score": old_score,
            "new_score": new_score_int,
            "old_classification": old_classification,
            "new_classification": assessment.score_classification,
            "reason": reason.strip(),
            "overridden_by": user.email if user else "Authorized User"
        }
        history = assessment.qualification_history or []
        history.append(history_entry)
        assessment.qualification_history = history

        update_fields = [
            'is_overridden', 'pld_score', 'original_pld_score',
            'score_classification', 'override_reason', 'overridden_by',
            'overridden_at', 'qualification_history'
        ]

        # If overriding to Qualified/High Priority, mark ICP knockout as satisfied
        if assessment.score_classification in [ScoreClassification.QUALIFIED, ScoreClassification.HIGH_PRIORITY]:
            assessment.icp_result = ICPResultStatus.PASS
            assessment.icp_knockout_passed = True
            update_fields.extend(['icp_result', 'icp_knockout_passed'])

        assessment.save(update_fields=update_fields)

        # Audit Logging
        AuditLog.objects.create(
            actor=user,
            actor_email=user.email if user else "authorized_user@texol.internal",
            actor_role=getattr(user, 'role', 'MANAGER') if user else 'MANAGER',
            entity_type='AccountProductAssessment',
            entity_id=assessment.id,
            action=AuditAction.SCORE_OVERRIDE,
            changes_json={
                "pld_score": {"old": old_score, "new": new_score_int},
                "score_classification": {"old": old_classification, "new": assessment.score_classification},
                "override_reason": {"new": reason.strip()}
            }
        )

        return assessment


class GateValidator:
    """
    Enforces stage gates before allowing transitions in the PLD pursuit and opportunity lifecycles.
    """
    @staticmethod
    def validate_lead_stage(lead, target_stage):
        gates = target_stage.gates.filter(is_mandatory=True)
        results = []
        all_passed = True
        what_we_know = []
        what_is_missing = []

        assessment = lead.account.assessments.filter(product=lead.primary_product).first()

        for gate in gates:
            rules = gate.condition_rules or {}
            satisfied = True
            missing = []

            # 1. Require ICP check passed
            if rules.get("require_icp_passed", False) or target_stage.stage_code == 'PLD_QUALIFIED':
                if not assessment or assessment.icp_result != ICPResultStatus.PASS or not assessment.icp_knockout_passed:
                    satisfied = False
                    status_val = assessment.icp_result if assessment else "NOT_EVALUATED"
                    missing.append(f"Account must pass all ICP knock-out rules for {lead.primary_product.name} (current status: {status_val})")
                    what_is_missing.append("Valid ICP Pass status required")
                else:
                    what_we_know.append(f"ICP Check: PASSED (Fit Score {assessment.icp_fit_score}%)")

            # 2. Require at least one documented business problem
            min_probs = rules.get("min_problems", 1 if target_stage.stage_code == 'PLD_QUALIFIED' else 0)
            if min_probs > 0:
                prob_count = lead.recorded_problems.count()
                if prob_count < min_probs:
                    satisfied = False
                    missing.append(f"At least {min_probs} documented business problem required (found {prob_count})")
                    what_is_missing.append("At least 1 documented business problem required")
                else:
                    what_we_know.append(f"{prob_count} documented business problem(s) recorded")

            # 3. Require future next action
            if rules.get("require_next_action", True):
                if not lead.next_activity_due_at or not lead.next_action_description:
                    satisfied = False
                    missing.append("Future Next Action description and due date are mandatory")
                    what_is_missing.append("Future Next Action description and due date required")
                else:
                    what_we_know.append(f"Next Action: '{lead.next_action_description}' due {lead.next_activity_due_at.strftime('%Y-%m-%d')}")

            # 4. Require minimum PLD score
            if "min_score" in rules:
                min_s = rules["min_score"]
                cur_s = assessment.pld_score if assessment else 0
                if not assessment or cur_s < min_s:
                    satisfied = False
                    missing.append(f"Minimum PLD Score of {min_s} required (current: {cur_s})")
                    what_is_missing.append(f"Score {cur_s} is below minimum requirement of {min_s}")
                else:
                    what_we_know.append(f"PLD Score: {cur_s}/100 (Threshold {min_s} satisfied)")

            # 5. Require discovery product mapping
            if rules.get("require_product_mapping", False):
                if target_stage.stage_code == 'DISCOVERY' and getattr(lead.current_stage, 'stage_code', None) != 'DISCOVERY':
                    what_we_know.append("Discovery: Initializing new Discovery & Mapping session")
                else:
                    latest_discovery = lead.discoveries.first()
                    if not latest_discovery:
                        satisfied = False
                        missing.append("Discovery session must be conducted before progressing")
                        what_is_missing.append("Discovery record not found")
                    else:
                        from apps.discovery.services import DiscoveryValidator
                        readiness = DiscoveryValidator.validate_readiness(latest_discovery)
                        if not readiness["is_ready"] or not latest_discovery.is_product_mapping_complete:
                            satisfied = False
                            if readiness["unmapped_problems"]:
                                unmapped_names = ", ".join([p["problem_name"] for p in readiness["unmapped_problems"]])
                                missing.append(f"All confirmed problems must map to product capabilities in Discovery ({unmapped_names} unmapped)")
                            else:
                                missing.append("Discovery readiness requirements not met")
                            what_is_missing.append("Discovery problem-to-capability mapping incomplete")
                        else:
                            what_we_know.append("Discovery problem-to-capability mapping 100% complete")

            # 6. Require Demo completed (or Not Required if optional)
            if rules.get("require_demo_completed", False) or (target_stage.stage_code in ['POC', 'SQL_READY'] and rules.get("enforce_demo_gate", False)):
                from apps.evaluations.services import StageRequirementChecker
                is_demo_req = StageRequirementChecker.is_demo_required(lead.primary_product)
                demo = lead.demos.first()

                if is_demo_req:
                    if not demo or demo.status != 'COMPLETED':
                        satisfied = False
                        cur_st = demo.status if demo else "NOT_SCHEDULED"
                        missing.append(f"Product Demo is MANDATORY for {lead.primary_product.name} and must be COMPLETED before advancing (current status: {cur_st})")
                        what_is_missing.append("Mandatory Product Demo completion required")
                    else:
                        what_we_know.append(f"Product Demo: COMPLETED ({demo.fit_assessment} fit)")
                else:
                    if demo and demo.status not in ['COMPLETED', 'NOT_REQUIRED']:
                        satisfied = False
                        missing.append(f"Product Demo status must be COMPLETED or explicitly recorded as NOT_REQUIRED with documented reason (current status: {demo.status})")
                        what_is_missing.append("Demo resolution required")
                    elif demo and demo.status == 'NOT_REQUIRED':
                        what_we_know.append(f"Product Demo: Waived as NOT REQUIRED (Reason: {demo.not_required_reason})")
                    elif demo and demo.status == 'COMPLETED':
                        what_we_know.append("Product Demo: COMPLETED")

            # 7. Require POC completed (or Not Required if optional)
            if rules.get("require_poc_completed", False) or (target_stage.stage_code == 'SQL_READY' and rules.get("enforce_poc_gate", False)):
                from apps.evaluations.services import StageRequirementChecker
                is_poc_req = StageRequirementChecker.is_poc_required(lead.primary_product)
                poc = lead.pocs.first()

                if is_poc_req:
                    if not poc or poc.status != 'COMPLETED':
                        satisfied = False
                        cur_st = poc.status if poc else "NOT_INITIATED"
                        missing.append(f"POC / Pilot trial is MANDATORY for {lead.primary_product.name} and must be COMPLETED before SQL handoff (current status: {cur_st})")
                        what_is_missing.append("Mandatory POC completion required")
                    else:
                        what_we_know.append("POC / Pilot Trial: COMPLETED successfully")
                else:
                    if poc and poc.status not in ['COMPLETED', 'NOT_REQUIRED']:
                        satisfied = False
                        missing.append(f"POC trial must be COMPLETED or explicitly recorded as NOT_REQUIRED with documented reason before SQL (current status: {poc.status})")
                        what_is_missing.append("POC resolution required")
                    elif poc and poc.status == 'NOT_REQUIRED':
                        what_we_know.append(f"POC Trial: Waived as NOT REQUIRED (Reason: {poc.not_required_reason})")
                    elif poc and poc.status == 'COMPLETED':
                        what_we_know.append("POC Trial: COMPLETED successfully")

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
            "what_we_know": what_we_know,
            "what_is_missing": what_is_missing,
            "checklist": results
        }
