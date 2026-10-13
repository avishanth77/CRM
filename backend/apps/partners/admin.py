"""
Admin registration for Phase 11 — Partner Management, Campaign Attribution, Deal Registration.
"""
from django.contrib import admin
from apps.partners.models import (
    PartnerTypeMaster,
    Partner,
    PartnerUser,
    PartnerProduct,
    PartnerTerritory,
    PartnerCertification,
    DealRegistration,
    ChannelConflict,
    PartnerInfluence,
    PartnerCommission,
    PartnerChannelConfig,
)


# ──────────────────────────────────────────────────────────────────────────────
# INLINE ADMINS
# ──────────────────────────────────────────────────────────────────────────────

class PartnerUserInline(admin.TabularInline):
    model = PartnerUser
    extra = 0
    fields = ('user', 'partner_role', 'is_active')
    raw_id_fields = ('user',)


class PartnerProductInline(admin.TabularInline):
    model = PartnerProduct
    extra = 0
    fields = ('product', 'authorization_status', 'territory', 'commission_rate_pct', 'valid_from', 'valid_to')
    raw_id_fields = ('product',)


class PartnerTerritoryInline(admin.TabularInline):
    model = PartnerTerritory
    extra = 0
    fields = ('territory', 'is_primary', 'is_exclusive', 'status')


class PartnerCertificationInline(admin.TabularInline):
    model = PartnerCertification
    extra = 0
    fields = ('certification_name', 'product', 'status', 'issue_date', 'expiry_date', 'credential_id')
    raw_id_fields = ('product',)


# ──────────────────────────────────────────────────────────────────────────────
# PARTNER TYPE MASTER
# ──────────────────────────────────────────────────────────────────────────────

@admin.register(PartnerTypeMaster)
class PartnerTypeMasterAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'is_active', 'is_default', 'created_at')
    list_filter = ('is_active', 'is_default')
    search_fields = ('code', 'name')
    ordering = ('name',)


# ──────────────────────────────────────────────────────────────────────────────
# PARTNER ORGANISATION
# ──────────────────────────────────────────────────────────────────────────────

@admin.register(Partner)
class PartnerAdmin(admin.ModelAdmin):
    list_display = (
        'account', 'partner_code', 'partner_type', 'partner_type_master',
        'status', 'status_change_date', 'partner_manager', 'created_at'
    )
    list_filter = ('status', 'partner_type', 'partner_type_master')
    search_fields = ('account__company_name', 'partner_code')
    raw_id_fields = ('account', 'partner_manager', 'partner_type_master')
    readonly_fields = ('created_at', 'updated_at', 'status_change_date')
    inlines = [PartnerUserInline, PartnerProductInline, PartnerTerritoryInline, PartnerCertificationInline]
    fieldsets = (
        ('Organisation', {
            'fields': ('account', 'partner_code', 'partner_type', 'partner_type_master', 'partner_manager')
        }),
        ('Lifecycle', {
            'fields': ('status', 'status_change_date', 'status_change_reason')
        }),
        ('Authorisation', {
            'fields': ('territory', 'authorized_territories', 'notes')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


# ──────────────────────────────────────────────────────────────────────────────
# PARTNER USERS
# ──────────────────────────────────────────────────────────────────────────────

@admin.register(PartnerUser)
class PartnerUserAdmin(admin.ModelAdmin):
    list_display = ('user', 'partner', 'partner_role', 'is_active', 'created_at')
    list_filter = ('partner_role', 'is_active')
    search_fields = ('user__email', 'user__first_name', 'partner__account__company_name')
    raw_id_fields = ('user', 'partner')


# ──────────────────────────────────────────────────────────────────────────────
# PARTNER PRODUCT AUTHORIZATION
# ──────────────────────────────────────────────────────────────────────────────

@admin.register(PartnerProduct)
class PartnerProductAdmin(admin.ModelAdmin):
    list_display = ('partner', 'product', 'authorization_status', 'territory', 'commission_rate_pct', 'valid_from', 'valid_to')
    list_filter = ('authorization_status',)
    search_fields = ('partner__account__company_name', 'product__name')
    raw_id_fields = ('partner', 'product')


# ──────────────────────────────────────────────────────────────────────────────
# PARTNER TERRITORY
# ──────────────────────────────────────────────────────────────────────────────

@admin.register(PartnerTerritory)
class PartnerTerritoryAdmin(admin.ModelAdmin):
    list_display = ('partner', 'territory', 'is_primary', 'is_exclusive', 'status')
    list_filter = ('status', 'is_primary', 'is_exclusive')
    search_fields = ('partner__account__company_name', 'territory')
    raw_id_fields = ('partner',)


# ──────────────────────────────────────────────────────────────────────────────
# PARTNER CERTIFICATION
# ──────────────────────────────────────────────────────────────────────────────

@admin.register(PartnerCertification)
class PartnerCertificationAdmin(admin.ModelAdmin):
    list_display = ('partner', 'certification_name', 'product', 'status', 'issue_date', 'expiry_date')
    list_filter = ('status',)
    search_fields = ('partner__account__company_name', 'certification_name', 'credential_id')
    raw_id_fields = ('partner', 'product')


# ──────────────────────────────────────────────────────────────────────────────
# DEAL REGISTRATION
# ──────────────────────────────────────────────────────────────────────────────

@admin.register(DealRegistration)
class DealRegistrationAdmin(admin.ModelAdmin):
    list_display = (
        'partner', 'customer_account', 'product', 'territory',
        'expected_deal_value', 'status', 'reviewed_by', 'reviewed_at', 'created_at'
    )
    list_filter = ('status', 'territory')
    search_fields = (
        'partner__account__company_name', 'customer_account__company_name', 'product__name'
    )
    raw_id_fields = ('partner', 'registered_by', 'customer_account', 'contact', 'product', 'reviewed_by', 'opportunity')
    readonly_fields = ('created_at', 'updated_at', 'reviewed_at')
    fieldsets = (
        ('Registration', {
            'fields': ('partner', 'registered_by', 'customer_account', 'contact', 'product', 'territory')
        }),
        ('Commercial', {
            'fields': ('expected_deal_value', 'expected_close_date', 'evidence_notes', 'protection_expiry_date')
        }),
        ('Review', {
            'fields': ('status', 'rejection_reason', 'reviewed_by', 'reviewed_at', 'opportunity')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


# ──────────────────────────────────────────────────────────────────────────────
# CHANNEL CONFLICT
# ──────────────────────────────────────────────────────────────────────────────

@admin.register(ChannelConflict)
class ChannelConflictAdmin(admin.ModelAdmin):
    list_display = (
        'conflict_type', 'partner', 'competing_partner', 'customer_account',
        'product', 'status', 'decision', 'reviewer', 'resolved_at'
    )
    list_filter = ('conflict_type', 'status', 'decision')
    search_fields = ('partner__account__company_name', 'customer_account__company_name')
    raw_id_fields = ('partner', 'competing_partner', 'deal_registration', 'lead', 'opportunity', 'customer_account', 'product', 'reviewer')
    readonly_fields = ('created_at', 'updated_at', 'resolved_at')


# ──────────────────────────────────────────────────────────────────────────────
# PARTNER INFLUENCE
# ──────────────────────────────────────────────────────────────────────────────

@admin.register(PartnerInfluence)
class PartnerInfluenceAdmin(admin.ModelAdmin):
    list_display = ('partner', 'opportunity', 'influence_type', 'influence_pct', 'influence_date', 'status', 'recorded_by')
    list_filter = ('influence_type', 'status')
    search_fields = ('partner__account__company_name',)
    raw_id_fields = ('partner', 'opportunity', 'recorded_by')


# ──────────────────────────────────────────────────────────────────────────────
# PARTNER COMMISSION
# ──────────────────────────────────────────────────────────────────────────────

@admin.register(PartnerCommission)
class PartnerCommissionAdmin(admin.ModelAdmin):
    list_display = (
        'partner', 'opportunity', 'revenue_basis', 'commission_rate_pct',
        'commission_amount', 'currency', 'payment_status', 'approval_status', 'approved_by'
    )
    list_filter = ('payment_status', 'approval_status', 'currency')
    search_fields = ('partner__account__company_name', 'rule_reference')
    raw_id_fields = ('partner', 'opportunity', 'deal_registration', 'approved_by')
    readonly_fields = ('created_at', 'updated_at', 'approved_at', 'paid_at')


# ──────────────────────────────────────────────────────────────────────────────
# PARTNER CHANNEL CONFIG (SINGLETON-STYLE)
# ──────────────────────────────────────────────────────────────────────────────

@admin.register(PartnerChannelConfig)
class PartnerChannelConfigAdmin(admin.ModelAdmin):
    list_display = (
        'default_protection_days', 'allow_grace_period_days', 'conflict_auto_flag',
        'attribution_default_model', 'partner_attribution_weight_pct'
    )
    readonly_fields = ('created_at', 'updated_at')

    def has_add_permission(self, request):
        # Only allow one config instance
        if self.model.objects.exists():
            return False
        return super().has_add_permission(request)
