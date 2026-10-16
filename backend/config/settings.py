import os
import sys
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# Load environment configuration from .env file
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.environ.get('SECRET_KEY', 'texol-crm-insecure-dev-key-change-in-production')
DEBUG = os.environ.get('DEBUG', 'False').lower() in ('true', '1', 't')
raw_hosts = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1,0.0.0.0')
ALLOWED_HOSTS = [h.strip() for h in raw_hosts.split(',') if h.strip()]
if DEBUG and '*' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('*')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party packages
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'drf_spectacular',

    # Modular TEXOL PLD CRM Apps
    'apps.core',
    'apps.authentication',
    'apps.products',
    'apps.pld_engine',
    'apps.accounts',
    'apps.leads',
    'apps.pld_assessments',
    'apps.discovery',
    'apps.evaluations',
    'apps.sales_handoff',
    'apps.opportunities',
    'apps.partners',
    'apps.activities',
    'apps.workflows',
    'apps.audit_logging',
    'apps.analytics',
    'apps.integrations',
]

AUTH_USER_MODEL = 'authentication.User'

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.audit_logging.middleware.AuditMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'texol_crm'),
        'USER': os.environ.get('DB_USER', 'postgres'),
        'PASSWORD': os.environ.get('DB_PASSWORD', ''),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 25,
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'apps.authentication.backends.HeaderUserAuthentication',
        'apps.authentication.backends.CsrfExemptSessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer', 'JWT'),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'TOKEN_TYPE_CLAIM': 'token_type',
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'TEXOL Configurable PLD CRM Platform API',
    'DESCRIPTION': 'Generic multi-product CRM & PLD Engine REST API for VanForces, TaskForces, EntAura, AL Mawasil, SpeakOrder',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

from corsheaders.defaults import default_headers

CORS_ALLOW_ALL_ORIGINS = os.environ.get('CORS_ALLOW_ALL_ORIGINS', 'True' if DEBUG else 'False').lower() in ('true', '1', 't')
raw_cors = os.environ.get('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173')
CORS_ALLOWED_ORIGINS = [o.strip() for o in raw_cors.split(',') if o.strip()]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = list(default_headers) + [
    'x-user-id',
    'x-user-email',
    'x-user-role',
]

# CSRF Configuration for Single-Page Application (SPA) clients
raw_csrf = os.environ.get('CSRF_TRUSTED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000')
CSRF_TRUSTED_ORIGINS = [o.strip() for o in raw_csrf.split(',') if o.strip()]

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

if not DEBUG:
    SECURE_BROWSER_XSS_FILTER = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_CONTENT_TYPE_NOSNIFF = True
    if os.environ.get('SECURE_SSL_REDIRECT', 'False').lower() in ('true', '1'):
        SECURE_SSL_REDIRECT = True
        SESSION_COOKIE_SECURE = True
        CSRF_COOKIE_SECURE = True
        SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
        SECURE_HSTS_SECONDS = 31536000
        SECURE_HSTS_INCLUDE_SUBDOMAINS = True
        SECURE_HSTS_PRELOAD = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Email Notification Configuration (Console logging in dev / pluggable SMTP)
EMAIL_BACKEND = os.environ.get(
    'EMAIL_BACKEND',
    'django.core.mail.backends.smtp.EmailBackend' if os.environ.get('EMAIL_HOST') and os.environ.get('EMAIL_HOST') != 'localhost' else 'django.core.mail.backends.console.EmailBackend'
)
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'localhost')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True').lower() in ('true', '1', 't')
EMAIL_USE_SSL = os.environ.get('EMAIL_USE_SSL', 'False').lower() in ('true', '1', 't')
EMAIL_TIMEOUT = int(os.environ.get('EMAIL_TIMEOUT', 15))
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', os.environ.get('EMAIL_HOST_USER', 'notifications@texol.com'))

