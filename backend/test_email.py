"""
TEXOL CRM - Email Configuration & Delivery Test Utility
Usage:
    python test_email.py [recipient_email]

Example:
    python test_email.py test@example.com
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / '.env')
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from django.core.mail import send_mail, get_connection

def test_email(recipient=None):
    backend = getattr(settings, 'EMAIL_BACKEND', '')
    host = getattr(settings, 'EMAIL_HOST', '')
    port = getattr(settings, 'EMAIL_PORT', '')
    user = getattr(settings, 'EMAIL_HOST_USER', '')
    tls = getattr(settings, 'EMAIL_USE_TLS', False)
    ssl = getattr(settings, 'EMAIL_USE_SSL', False)
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'notifications@texol.com')

    target_recipient = recipient or user or 'test@example.com'

    print("=" * 65)
    print("TEXOL CRM - EMAIL CONFIGURATION DIAGNOSTIC")
    print("=" * 65)
    print(f"EMAIL_BACKEND      : {backend}")
    print(f"EMAIL_HOST         : {host or '(Not set - using console fallback)'}")
    print(f"EMAIL_PORT         : {port}")
    print(f"EMAIL_HOST_USER    : {user or '(Not set)'}")
    print(f"EMAIL_USE_TLS      : {tls}")
    print(f"EMAIL_USE_SSL      : {ssl}")
    print(f"DEFAULT_FROM_EMAIL : {from_email}")
    print(f"TARGET RECIPIENT   : {target_recipient}")
    print("-" * 65)

    if 'console' in backend.lower():
        print("[INFO] MODE: CONSOLE BACKEND")
        print("Emails will print directly to the terminal rather than sending over the internet.")
        print("To send REAL emails to inboxes:")
        print("  1. Open backend/.env")
        print("  2. Set EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend")
        print("  3. Set EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD")
        print("-" * 65)

    print(f"Attempting to dispatch test email to: {target_recipient} ...")
    try:
        connection = get_connection()
        connection.open()
        print("[SUCCESS] Connection opened successfully.")
        
        sent = send_mail(
            subject="[TEXOL CRM] Email Subsystem Test Notification",
            message=(
                "Hello,\n\n"
                "This is a test notification confirming that the TEXOL CRM Email Delivery "
                "Subsystem is properly configured and operational.\n\n"
                "TEXOL CRM Commercial Operations"
            ),
            from_email=from_email,
            recipient_list=[target_recipient],
            fail_silently=False
        )
        print(f"[SUCCESS] Email dispatched successfully! (Sent count: {sent})")
        return True
    except Exception as exc:
        print("[FAILED] Email dispatch FAILED!")
        print(f"Error Type: {type(exc).__name__}")
        print(f"Error Message: {str(exc)}")
        print("\nTroubleshooting tips:")
        if "Authentication" in type(exc).__name__ or "Username and Password not accepted" in str(exc):
            print("  * If using Gmail: You must generate a 16-character 'App Password' at:")
            print("    https://myaccount.google.com/apppasswords (Requires 2FA enabled).")
            print("    Do NOT use your regular Google account password.")
        elif "ConnectionRefused" in type(exc).__name__ or "timed out" in str(exc):
            print("  * Verify EMAIL_HOST and EMAIL_PORT (typically 587 for TLS, 465 for SSL).")
            print("  * Ensure your firewall or network allows outbound connections on that port.")
        return False

if __name__ == '__main__':
    recipient_arg = sys.argv[1] if len(sys.argv) > 1 else None
    success = test_email(recipient_arg)
    sys.exit(0 if success else 1)
