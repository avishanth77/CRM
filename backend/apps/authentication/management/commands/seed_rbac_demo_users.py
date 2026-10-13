from django.core.management.base import BaseCommand
from apps.authentication.models import User, UserRole


DEMO_USERS = [
    {
        'username': 'management',
        'email': 'management@texol.com',
        'first_name': 'Khalid',
        'last_name': 'Al-Hassan',
        'role': UserRole.MANAGEMENT,
        'territory': 'Global HQ',
        'phone': '+966 50 111 2222',
        'is_staff': False,
        'is_superuser': False,
    },
    {
        'username': 'sales_manager',
        'email': 'sales.manager@texol.com',
        'first_name': 'Omar',
        'last_name': 'Al-Fahad',
        'role': UserRole.SALES_MANAGER,
        'territory': 'Riyadh & Central Province',
        'phone': '+966 50 222 3333',
        'is_staff': False,
        'is_superuser': False,
    },
    {
        'username': 'sales_ae',
        'email': 'sales.ae@texol.com',
        'first_name': 'Zaid',
        'last_name': 'Al-Harbi',
        'role': UserRole.SALES_BDM,
        'territory': 'Riyadh & Central Province',
        'phone': '+966 50 333 4444',
        'is_staff': False,
        'is_superuser': False,
    },
    {
        'username': 'pld_exec',
        'email': 'pld.exec@texol.com',
        'first_name': 'Fatima',
        'last_name': 'Al-Otaibi',
        'role': UserRole.PLD_EXECUTIVE,
        'territory': 'Kingdom-Wide Inbound',
        'phone': '+966 50 444 5555',
        'is_staff': False,
        'is_superuser': False,
    },
    {
        'username': 'solution_consultant',
        'email': 'solution.consultant@texol.com',
        'first_name': 'Yousef',
        'last_name': 'Al-Mutawa',
        'role': UserRole.SOLUTION_CONSULTANT,
        'territory': 'Presales Technical Operations',
        'phone': '+966 50 555 6666',
        'is_staff': False,
        'is_superuser': False,
    },
    {
        'username': 'product_manager',
        'email': 'product.manager@texol.com',
        'first_name': 'Noura',
        'last_name': 'Al-Dosari',
        'role': UserRole.PRODUCT_MANAGER,
        'territory': 'Product Operations & Architecture',
        'phone': '+966 50 666 7777',
        'is_staff': False,
        'is_superuser': False,
    },
    {
        'username': 'partner_manager',
        'email': 'partner.manager@texol.com',
        'first_name': 'Faisal',
        'last_name': 'Al-Qasim',
        'role': UserRole.PARTNER_MANAGER,
        'territory': 'Channel & Alliance Partnerships',
        'phone': '+966 50 777 8888',
        'is_staff': False,
        'is_superuser': False,
    },
    {
        'username': 'customer_success',
        'email': 'customer.success@texol.com',
        'first_name': 'Reem',
        'last_name': 'Al-Shamrani',
        'role': UserRole.CUSTOMER_SUCCESS,
        'territory': 'Post-Sale Customer Retention',
        'phone': '+966 50 888 9999',
        'is_staff': False,
        'is_superuser': False,
    },
    {
        'username': 'marketing',
        'email': 'marketing@texol.com',
        'first_name': 'Layla',
        'last_name': 'Al-Subaie',
        'role': UserRole.MARKETING,
        'territory': 'Growth & Demand Generation',
        'phone': '+966 50 999 0000',
        'is_staff': False,
        'is_superuser': False,
    },
    {
        'username': 'finance',
        'email': 'finance@texol.com',
        'first_name': 'Majid',
        'last_name': 'Al-Ghamdi',
        'role': UserRole.FINANCE,
        'territory': 'Finance & Commercial Operations',
        'phone': '+966 50 123 7890',
        'is_staff': False,
        'is_superuser': False,
    },
]

DEMO_PASSWORD = 'TexolDemo2026!'


class Command(BaseCommand):
    help = 'Seeds standard RBAC demo accounts for each documented commercial role'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Seeding RBAC demo accounts..."))
        created_count = 0
        updated_count = 0

        for user_data in DEMO_USERS:
            email = user_data['email']
            user, created = User.objects.get_or_create(
                email__iexact=email,
                defaults={
                    'username': user_data['username'],
                    'email': email,
                    'first_name': user_data['first_name'],
                    'last_name': user_data['last_name'],
                    'role': user_data['role'],
                    'territory': user_data['territory'],
                    'phone': user_data['phone'],
                    'is_staff': user_data['is_staff'],
                    'is_superuser': user_data['is_superuser'],
                    'is_partner_user': False,
                    'is_active': True,
                }
            )

            user.set_password(DEMO_PASSWORD)
            user.role = user_data['role']
            user.first_name = user_data['first_name']
            user.last_name = user_data['last_name']
            user.territory = user_data['territory']
            user.phone = user_data['phone']
            user.is_staff = user_data['is_staff']
            user.is_superuser = user_data['is_superuser']
            user.is_active = True
            user.save()

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"  [+] Created {user_data['role']}: {email}"))
            else:
                updated_count += 1
                self.stdout.write(self.style.SUCCESS(f"  [*] Updated {user_data['role']}: {email}"))

        self.stdout.write(self.style.SUCCESS(
            f"\nDone! Seeded {created_count + updated_count} RBAC demo users with password '{DEMO_PASSWORD}'."
        ))
