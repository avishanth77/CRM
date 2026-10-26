from django.core.management.base import BaseCommand
from apps.core.models import Territory
from apps.authentication.models import User, UserRole

DEFAULT_TERRITORIES = [
    {
        'name': 'Riyadh & Central Province',
        'code': 'RIYADH_CENTRAL',
        'country': 'Saudi Arabia',
        'description': 'Central commercial hub including Riyadh capital metropolitan area, Qassim, and Al-Kharj.',
        'sort_order': 1,
    },
    {
        'name': 'Jeddah & Western Province',
        'code': 'JEDDAH_WESTERN',
        'country': 'Saudi Arabia',
        'description': 'Western commercial corridor including Jeddah port, Mecca, Medina, and Yanbu.',
        'sort_order': 2,
    },
    {
        'name': 'Dammam & Eastern Province',
        'code': 'DAMMAM_EASTERN',
        'country': 'Saudi Arabia',
        'description': 'Eastern industrial and logistics hub including Dammam, Khobar, Jubail industrial city, and Al-Ahsa.',
        'sort_order': 3,
    },
    {
        'name': 'Southern Province',
        'code': 'SOUTHERN',
        'country': 'Saudi Arabia',
        'description': 'Southern commercial territory including Abha, Khamis Mushait, Jazan, and Najran.',
        'sort_order': 4,
    },
    {
        'name': 'Northern Province',
        'code': 'NORTHERN',
        'country': 'Saudi Arabia',
        'description': 'Northern distribution region including Tabuk, Hail, Al-Jouf, and Arar.',
        'sort_order': 5,
    },
    {
        'name': 'GCC & International',
        'code': 'GCC_INTL',
        'country': 'GCC',
        'description': 'GCC and regional cross-border commercial markets including UAE, Bahrain, Kuwait, Oman, and Qatar.',
        'sort_order': 6,
    },
]

class Command(BaseCommand):
    help = "Seed standard business territories and assign regional sales managers"

    def handle(self, *args, **options):
        self.stdout.write("Seeding master territories and regions...")

        # Find default sales manager if available
        sales_manager = User.objects.filter(role=UserRole.SALES_MANAGER).first()

        created_count = 0
        updated_count = 0

        for item in DEFAULT_TERRITORIES:
            terr, created = Territory.objects.get_or_create(
                code=item['code'],
                defaults={
                    'name': item['name'],
                    'country': item['country'],
                    'description': item['description'],
                    'sort_order': item['sort_order'],
                    'is_active': True,
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

            # Auto-assign central territory to demo sales manager if available
            if item['code'] == 'RIYADH_CENTRAL' and sales_manager and not terr.regional_manager:
                terr.regional_manager = sales_manager
                terr.save(update_fields=['regional_manager'])
                if not sales_manager.territory:
                    sales_manager.territory = terr.name
                    sales_manager.save(update_fields=['territory'])

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded territories: {created_count} created, {updated_count} existing."
            )
        )
