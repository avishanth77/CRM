from django.core.management.base import BaseCommand
from apps.activities.services import AutomationService


class Command(BaseCommand):
    help = 'Executes all scheduled CRM automations and evaluates SLA trackers.'

    def handle(self, *args, **options):
        self.stdout.write("Starting CRM Automation & SLA Engine run...")
        results = AutomationService.run_all_automations()
        self.stdout.write(self.style.SUCCESS(f"CRM Automations completed successfully: {results}"))
