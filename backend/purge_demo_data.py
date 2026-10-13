"""
Utility script to purge all demo and operational transactional data from TEXOL CRM.
Preserves all master data, catalog definitions, scoring models, questionnaire templates,
pipeline stages, SLA/automation rules, tenant settings, and internal staff user accounts.
"""
import os
import sys
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import transaction
from django.contrib.admin.models import LogEntry
from django.contrib.sessions.models import Session
from apps.authentication.models import User

# Import all operational models to purge
from apps.integrations.models import CommunicationMessage, ERPSyncRecord
from apps.audit_logging.models import AuditLog
from apps.workflows.models import StageHistory, Approval
from apps.activities.models import (
    Activity, Task, Notification, SLATracker, AutomationExecutionLog
)
from apps.opportunities.models import (
    Opportunity, OpportunityProduct, OpportunityModule,
    OpportunityCapability, Proposal, ProposalVersion, ProposalItem
)
from apps.sales_handoff.models import SQLHandoff
from apps.evaluations.models import (
    Demo, DemoParticipant, DemoUseCaseMapping,
    POC, POCSuccessCriterion, POCParticipant
)
from apps.discovery.models import (
    Discovery, DiscoveryProblem, DiscoveryProblemMapping, DiscoveryStakeholder
)
from apps.pld_assessments.models import ScoreAssessment, AccountProductAssessment
from apps.leads.models import Lead, LeadTouch, LeadProblem, LeadProductInterest, Campaign
from apps.accounts.models import Account, AccountProduct, AccountAttribute, Contact
from apps.partners.models import (
    Partner, PartnerUser, PartnerProduct, PartnerTerritory,
    PartnerCertification, DealRegistration, ChannelConflict,
    PartnerInfluence, PartnerCommission
)

MODELS_TO_PURGE = [
    # Sessions
    Session,
    # Admin logs
    LogEntry,
    # Integrations
    CommunicationMessage,
    ERPSyncRecord,
    # Audit & Workflow
    AuditLog,
    StageHistory,
    Approval,
    # Activities
    AutomationExecutionLog,
    SLATracker,
    Notification,
    Task,
    Activity,
    # Proposals & Opportunity sub-items
    ProposalItem,
    ProposalVersion,
    Proposal,
    OpportunityCapability,
    OpportunityModule,
    OpportunityProduct,
    Opportunity,
    # Sales Handoff
    SQLHandoff,
    # Evaluations & Presales
    DemoUseCaseMapping,
    DemoParticipant,
    Demo,
    POCSuccessCriterion,
    POCParticipant,
    POC,
    # Discovery
    DiscoveryProblemMapping,
    DiscoveryStakeholder,
    DiscoveryProblem,
    Discovery,
    # PLD Assessments
    ScoreAssessment,
    AccountProductAssessment,
    # Leads
    LeadProblem,
    LeadTouch,
    LeadProductInterest,
    Lead,
    Campaign,
    # Partners (deals/commissions)
    DealRegistration,
    ChannelConflict,
    PartnerInfluence,
    PartnerCommission,
    PartnerCertification,
    PartnerTerritory,
    PartnerProduct,
    PartnerUser,
    Partner,
    # Accounts & Contacts
    AccountProduct,
    AccountAttribute,
    Contact,
    Account,
]

def purge_demo_data(dry_run=False):
    print("=" * 60)
    print(f"TEXOL CRM Demo Data Purge {'[DRY RUN]' if dry_run else '[LIVE EXECUTION]'}")
    print("=" * 60)

    summary = []
    
    with transaction.atomic():
        for model in MODELS_TO_PURGE:
            manager = getattr(model, 'all_objects', model.objects)
            count = manager.count()
            model_name = f"{model._meta.app_label}.{model.__name__}"
            if count > 0:
                print(f"Purging {count:4d} records from {model_name}...")
                if not dry_run:
                    # Perform deletion
                    deleted_info = manager.all().delete()
                    summary.append((model_name, count))
                else:
                    summary.append((model_name, count))
            else:
                print(f"        0 records in {model_name} (already clean)")

        # Clean up test partner user accounts while strictly preserving internal staff accounts
        partner_users = User.objects.filter(role='PARTNER_USER')
        pu_count = partner_users.count()
        if pu_count > 0:
            print(f"Purging {pu_count:4d} test partner portal user accounts from authentication.User...")
            if not dry_run:
                partner_users.delete()
            summary.append(('authentication.User (PARTNER_USER)', pu_count))
        else:
            print("        0 test partner user accounts (already clean)")

        if dry_run:
            print("\nDry run complete. No records were modified.")
        else:
            print("\nPurge completed successfully.")

    print("\nPurge Summary:")
    print("-" * 40)
    total_purged = sum(c for _, c in summary)
    for model_name, count in summary:
        print(f" - {model_name}: {count} records removed")
    print(f"Total operational records removed: {total_purged}")
    print("-" * 40)

if __name__ == '__main__':
    dry_run = '--dry-run' in sys.argv
    purge_demo_data(dry_run=dry_run)
