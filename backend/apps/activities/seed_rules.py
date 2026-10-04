from apps.activities.models import (
    SLADefinition, SLAEntityType, SLAEscalationAction,
    AutomationRule, AutomationTrigger, AutomationAction
)


def seed_phase9_configuration():
    """
    Seeds standard configurable SLA governance definitions and automation rules.
    Pure configuration metadata -- no fake business records.
    """
    # 1. Configurable SLA Definitions
    sla_configs = [
        {
            'name': 'Lead First Response SLA',
            'entity_type': SLAEntityType.LEAD_RESPONSE,
            'target_duration_hours': 48,
            'warning_threshold_pct': 75,
            'escalation_role': 'SALES_MANAGER',
            'escalation_action': SLAEscalationAction.FULL_ESCALATION,
            'description': 'Requires sales/PLD contact within 48h of lead creation.'
        },
        {
            'name': 'SQL Sales Acceptance SLA',
            'entity_type': SLAEntityType.SQL_ACCEPTANCE,
            'target_duration_hours': 48,
            'warning_threshold_pct': 75,
            'escalation_role': 'SALES_MANAGER',
            'escalation_action': SLAEscalationAction.FULL_ESCALATION,
            'description': 'Formal 48-hour gate for Sales BDM to accept or reject SQL handoff.'
        },
        {
            'name': 'Discovery Follow-up SLA',
            'entity_type': SLAEntityType.FIRST_FOLLOWUP,
            'target_duration_hours': 24,
            'warning_threshold_pct': 75,
            'escalation_role': 'SALES_MANAGER',
            'escalation_action': SLAEscalationAction.NOTIFY_OWNER,
            'description': 'Mandates follow-up within 24h after discovery session.'
        },
        {
            'name': 'Opportunity Inactivity Limit SLA',
            'entity_type': SLAEntityType.OPPORTUNITY_INACTIVITY,
            'target_duration_hours': 336,  # 14 days
            'warning_threshold_pct': 80,
            'escalation_role': 'SALES_MANAGER',
            'escalation_action': SLAEscalationAction.FULL_ESCALATION,
            'description': 'Escalates deals with zero interaction for 14 calendar days.'
        },
        {
            'name': 'Proposal Follow-up SLA',
            'entity_type': SLAEntityType.PROPOSAL_FOLLOWUP,
            'target_duration_hours': 72,  # 3 days
            'warning_threshold_pct': 75,
            'escalation_role': 'SALES_MANAGER',
            'escalation_action': SLAEscalationAction.FULL_ESCALATION,
            'description': 'Requires commercial follow-up within 3 days of proposal issuance.'
        },
        {
            'name': 'Nurture Periodic Review SLA',
            'entity_type': SLAEntityType.NURTURE_REVIEW,
            'target_duration_hours': 720,  # 30 days
            'warning_threshold_pct': 90,
            'escalation_role': 'SALES_MANAGER',
            'escalation_action': SLAEscalationAction.CREATE_TASK,
            'description': 'Prompts re-evaluation of nurtured accounts every 30 days.'
        },
    ]

    for cfg in sla_configs:
        SLADefinition.objects.update_or_create(
            entity_type=cfg['entity_type'],
            defaults=cfg
        )

    # 2. Configurable Automation Rules (All 9 requirements)
    rules_config = [
        {
            'name': 'New Lead Owner Auto-Assignment',
            'trigger_type': AutomationTrigger.ON_LEAD_CREATE,
            'action_type': AutomationAction.ASSIGN_OWNER,
            'action_config_json': {'assignee_role': 'PLD_EXECUTIVE'},
            'conditions_json': {},
            'is_active': True
        },
        {
            'name': 'No-Contact Inactivity Follow-up',
            'trigger_type': AutomationTrigger.SCHEDULED_NO_CONTACT,
            'action_type': AutomationAction.CREATE_TASK,
            'conditions_json': {'max_inactive_hours': 48},
            'action_config_json': {'task_priority': 'HIGH'},
            'is_active': True
        },
        {
            'name': 'Missing Next Action Detection',
            'trigger_type': AutomationTrigger.SCHEDULED_NO_NEXT_ACTION,
            'action_type': AutomationAction.SEND_NOTIFICATION,
            'conditions_json': {},
            'action_config_json': {'priority': 'MEDIUM'},
            'is_active': True
        },
        {
            'name': 'High PLD Score Executive Alert',
            'trigger_type': AutomationTrigger.ON_SCORE_UPDATE,
            'action_type': AutomationAction.SEND_NOTIFICATION,
            'conditions_json': {'min_score': 80},
            'action_config_json': {'notify_role': 'SALES_MANAGER'},
            'is_active': True
        },
        {
            'name': 'POC Completion SQL Review Task',
            'trigger_type': AutomationTrigger.ON_POC_COMPLETE,
            'action_type': AutomationAction.CREATE_TASK,
            'conditions_json': {},
            'action_config_json': {'task_type': 'POC_REVIEW'},
            'is_active': True
        },
        {
            'name': 'Proposal Expiry Warning & Expiration',
            'trigger_type': AutomationTrigger.SCHEDULED_PROPOSAL_EXPIRY,
            'action_type': AutomationAction.MARK_EXPIRED,
            'conditions_json': {'warning_days_before': 3},
            'action_config_json': {},
            'is_active': True
        },
        {
            'name': 'Inactive Opportunity Escalation',
            'trigger_type': AutomationTrigger.SCHEDULED_OPPORTUNITY_INACTIVITY,
            'action_type': AutomationAction.ESCALATE_SLA,
            'conditions_json': {'max_inactive_days': 14},
            'action_config_json': {'task_priority': 'HIGH'},
            'is_active': True
        },
        {
            'name': 'SQL Ready Sales Acceptance SLA Handoff',
            'trigger_type': AutomationTrigger.ON_SQL_READY,
            'action_type': AutomationAction.MULTI_ACTION,
            'conditions_json': {},
            'action_config_json': {'sla_duration_hours': 48},
            'is_active': True
        },
        {
            'name': 'Nurture Re-engagement Evaluation',
            'trigger_type': AutomationTrigger.SCHEDULED_NURTURE_REENGAGEMENT,
            'action_type': AutomationAction.CREATE_TASK,
            'conditions_json': {'reengagement_days': 30},
            'action_config_json': {'task_priority': 'MEDIUM'},
            'is_active': True
        },
    ]

    for r in rules_config:
        AutomationRule.objects.update_or_create(
            trigger_type=r['trigger_type'],
            defaults=r
        )
