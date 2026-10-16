import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Users, DollarSign, Activity, AlertTriangle, CheckCircle2,
  Calendar, ArrowUpRight, RefreshCw, Search,
  Building, Sparkles, Layers,
  ExternalLink, Server, X
} from 'lucide-react';
import { api } from '../services/api';
import type { AccountProduct, Product, Opportunity } from '../services/api';
import { inAppAlert } from './common/InAppAlert';

interface CustomerLifecycleWorkspaceProps {
  initialAccountId?: string;
  selectedProductFilter?: string;
  onNavigateToAccount?: (accId: string) => void;
  onNavigateToOpportunity?: (oppId: string) => void;
}

interface OnboardingMilestoneState {
  erpConnected: boolean;
  masterDataLoaded: boolean;
  trainingDone: boolean;
  goLiveAccepted: boolean;
  notes?: string;
}

export const CustomerLifecycleWorkspace: React.FC<CustomerLifecycleWorkspaceProps> = ({
  initialAccountId: _initialAccountId,
  selectedProductFilter = 'ALL',
  onNavigateToAccount,
  onNavigateToOpportunity
}) => {
  const [accountProducts, setAccountProducts] = useState<AccountProduct[]>([]);
  const [_accounts, setAccounts] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [wonOpportunities, setWonOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'ONBOARDING' | 'HEALTH_TELEMETRY' | 'RENEWALS_EXPANSION'>('HEALTH_TELEMETRY');
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState<string>(selectedProductFilter);

  // Modals
  const [showTelemetryModal, setShowTelemetryModal] = useState(false);
  const [selectedAccountProduct, setSelectedAccountProduct] = useState<AccountProduct | null>(null);
  const [editHealthScore, setEditHealthScore] = useState<number>(100);
  const [editStatus, setEditStatus] = useState<'CUSTOMER' | 'EXPANSION' | 'INACTIVE'>('CUSTOMER');

  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [renewalType, setRenewalType] = useState<'RENEWAL' | 'EXPANSION'>('RENEWAL');
  const [renewalAccountId, setRenewalAccountId] = useState<string>('');
  const [renewalProductId, setRenewalProductId] = useState<string>('');
  const [renewalValue, setRenewalValue] = useState<number>(0);
  const [renewalTermMonths, setRenewalTermMonths] = useState<number>(12);
  const [renewalNotes, setRenewalNotes] = useState<string>('');

  // Local storage cache for mockable Onboarding milestone tracking
  const [milestones, setMilestones] = useState<Record<string, OnboardingMilestoneState>>(() => {
    try {
      const saved = localStorage.getItem('texol_onboarding_milestones');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const saveMilestones = (accId: string, updated: OnboardingMilestoneState) => {
    const next = { ...milestones, [accId]: updated };
    setMilestones(next);
    try {
      localStorage.setItem('texol_onboarding_milestones', JSON.stringify(next));
    } catch {}
    inAppAlert.success('Onboarding milestone state updated.');
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [apRes, accRes, prodRes, oppRes] = await Promise.all([
        api.getAccountProducts(),
        api.getAccounts(),
        api.getProducts(),
        api.getOpportunities({ status: 'WON' })
      ]);
      setAccountProducts(apRes.results || []);
      setAccounts(accRes.results || []);
      setProducts(prodRes.results || []);
      setWonOpportunities((oppRes.results || []).filter(o => o.status === 'WON'));
    } catch (err: any) {
      console.error(err);
      inAppAlert.error(err?.message || 'Failed to load customer lifecycle data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedProductFilter) {
      setProductFilter(selectedProductFilter);
    }
  }, [selectedProductFilter]);

  // Filtered Account Products
  const filteredAccountProducts = useMemo(() => {
    return accountProducts.filter(ap => {
      const accName = (ap.account_name || '').toLowerCase();
      const pCode = (ap.product_code || '').toUpperCase();
      const pName = (ap.product_name || '').toLowerCase();
      const matchesSearch = !searchQuery || accName.includes(searchQuery.toLowerCase()) || pName.includes(searchQuery.toLowerCase());
      const matchesProduct = productFilter === 'ALL' || pCode === productFilter.toUpperCase() || ap.product === productFilter;
      return matchesSearch && matchesProduct;
    });
  }, [accountProducts, searchQuery, productFilter]);

  // KPI Calculations
  const activeCustomers = useMemo(() => {
    return accountProducts.filter(ap => ap.status === 'CUSTOMER' || ap.status === 'EXPANSION');
  }, [accountProducts]);

  const totalArr = useMemo(() => {
    return activeCustomers.reduce((acc, curr) => acc + Number(curr.arr_mrr || curr.contract_value || 0), 0);
  }, [activeCustomers]);

  const avgHealthScore = useMemo(() => {
    if (activeCustomers.length === 0) return 100;
    const sum = activeCustomers.reduce((acc, curr) => acc + (curr.health_score ?? 100), 0);
    return Math.round(sum / activeCustomers.length);
  }, [activeCustomers]);

  const renewalsDue90Days = useMemo(() => {
    const now = new Date();
    const threshold = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    return activeCustomers.filter(ap => {
      if (!ap.renewal_date) return false;
      const rDate = new Date(ap.renewal_date);
      return rDate >= now && rDate <= threshold;
    }).length;
  }, [activeCustomers]);

  // Open Telemetry Modal
  const handleOpenTelemetry = (ap: AccountProduct) => {
    setSelectedAccountProduct(ap);
    setEditHealthScore(ap.health_score ?? 100);
    setEditStatus((ap.status as any) || 'CUSTOMER');
    setShowTelemetryModal(true);
  };

  // Submit Telemetry Modal
  const handleSaveTelemetry = async () => {
    if (!selectedAccountProduct) return;
    setSubmitting(true);
    try {
      const updated = await api.updateAccountProduct(selectedAccountProduct.id, {
        health_score: editHealthScore,
        status: editStatus
      });
      setAccountProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
      inAppAlert.success(`Telemetry and health score updated for ${selectedAccountProduct.account_name || 'Customer'}.`);
      setShowTelemetryModal(false);
    } catch (err: any) {
      console.error(err);
      inAppAlert.error(err?.message || 'Failed to update telemetry.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Renewal Modal
  const handleOpenRenewal = (ap: AccountProduct, type: 'RENEWAL' | 'EXPANSION') => {
    setRenewalType(type);
    setRenewalAccountId(ap.account);
    setRenewalProductId(ap.product);
    setRenewalValue(Number(ap.arr_mrr || ap.contract_value || 10000));
    setRenewalTermMonths(12);
    setRenewalNotes(type === 'RENEWAL' ? 'Annual renewal contract renegotiation.' : 'Expansion seat count and advanced modules rollout.');
    setShowRenewalModal(true);
  };

  // Submit Renewal Opportunity
  const handleCreateRenewalOpportunity = async () => {
    if (!renewalAccountId) return;
    setSubmitting(true);
    try {
      const res = await api.createRenewalOpportunity(renewalAccountId, {
        product_id: renewalProductId,
        opportunity_type: renewalType,
        value: renewalValue,
        term_months: renewalTermMonths,
        notes: renewalNotes
      });
      inAppAlert.success(res.message || `${renewalType} opportunity created successfully!`);
      setShowRenewalModal(false);
      loadData();
      if (onNavigateToOpportunity && res.opportunity?.id) {
        onNavigateToOpportunity(res.opportunity.id);
      }
    } catch (err: any) {
      console.error(err);
      inAppAlert.error(err?.message || 'Failed to create renewal opportunity.');
    } finally {
      setSubmitting(false);
    }
  };

  const getHealthBadge = (score: number) => {
    if (score >= 80) return { label: 'Optimal', bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981' };
    if (score >= 60) return { label: 'Stable', bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' };
    return { label: 'At Risk', bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' };
  };

  return (
    <div className="workspace-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', background: 'rgba(79, 70, 229, 0.12)', borderRadius: '10px', color: 'var(--primary)' }}>
              <Layers size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Customer Lifecycle & Expansion Workspace
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Closed-Won account onboarding milestones, telemetry health tracking, and automated renewal triggers.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select
            value={productFilter}
            onChange={e => setProductFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.88rem'
            }}
          >
            <option value="ALL">All Products</option>
            {products.map(p => (
              <option key={p.id} value={p.code}>{p.name} ({p.code})</option>
            ))}
          </select>

          <button
            onClick={loadData}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.88rem'
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: 'var(--bg-surface)', padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
            <span>Active Customers</span>
            <Users size={18} style={{ color: 'var(--primary)' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: 'var(--text-primary)' }}>
            {activeCustomers.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#10b981', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={13} /> Contracted live relationships
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
            <span>Contracted ARR</span>
            <DollarSign size={18} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: 'var(--text-primary)' }}>
            ${totalArr.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Annual recurring revenue pool
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
            <span>Average Health Score</span>
            <Activity size={18} style={{ color: avgHealthScore >= 80 ? '#10b981' : avgHealthScore >= 60 ? '#f59e0b' : '#ef4444' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: avgHealthScore >= 80 ? '#10b981' : avgHealthScore >= 60 ? '#f59e0b' : '#ef4444' }}>
            {avgHealthScore}%
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Adoption telemetry across fleet
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
            <span>Renewals in &lt;90 Days</span>
            <Calendar size={18} style={{ color: renewalsDue90Days > 0 ? '#f59e0b' : 'var(--text-muted)' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: renewalsDue90Days > 0 ? '#f59e0b' : 'var(--text-primary)' }}>
            {renewalsDue90Days}
          </div>
          <div style={{ fontSize: '0.78rem', color: renewalsDue90Days > 0 ? '#f59e0b' : 'var(--text-muted)', marginTop: '4px' }}>
            High-priority renewal triggers
          </div>
        </div>
      </div>

      {/* Tabs and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('HEALTH_TELEMETRY')}
            style={{
              padding: '10px 16px',
              borderBottom: activeTab === 'HEALTH_TELEMETRY' ? '3px solid var(--primary)' : '3px solid transparent',
              background: 'none',
              borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              fontWeight: 700,
              fontSize: '0.92rem',
              color: activeTab === 'HEALTH_TELEMETRY' ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <Activity size={17} />
            Adoption Health & Telemetry ({filteredAccountProducts.length})
          </button>

          <button
            onClick={() => setActiveTab('ONBOARDING')}
            style={{
              padding: '10px 16px',
              borderBottom: activeTab === 'ONBOARDING' ? '3px solid var(--primary)' : '3px solid transparent',
              background: 'none',
              borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              fontWeight: 700,
              fontSize: '0.92rem',
              color: activeTab === 'ONBOARDING' ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <Server size={17} />
            Onboarding & Implementation Milestones ({wonOpportunities.length})
          </button>

          <button
            onClick={() => setActiveTab('RENEWALS_EXPANSION')}
            style={{
              padding: '10px 16px',
              borderBottom: activeTab === 'RENEWALS_EXPANSION' ? '3px solid var(--primary)' : '3px solid transparent',
              background: 'none',
              borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              fontWeight: 700,
              fontSize: '0.92rem',
              color: activeTab === 'RENEWALS_EXPANSION' ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <ArrowUpRight size={17} />
            Renewals & Expansion Opportunities
          </button>
        </div>

        <div style={{ position: 'relative', minWidth: '260px', paddingBottom: '8px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search accounts or products..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              padding: '7px 12px 7px 34px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              width: '100%',
              fontSize: '0.85rem'
            }}
          />
        </div>
      </div>

      {/* Tab Content 1: ADOPTION HEALTH & TELEMETRY */}
      {activeTab === 'HEALTH_TELEMETRY' && (
        <div>
          {filteredAccountProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <Layers size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px', opacity: 0.5 }} />
              <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>No Customer Products Found</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '450px', margin: '8px auto 0' }}>
                When deals are marked as Closed Won in the Commercial Negotiation stage, accounts automatically transition into Active Customers here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {filteredAccountProducts.map(ap => {
                const badge = getHealthBadge(ap.health_score ?? 100);
                return (
                  <div
                    key={ap.id}
                    style={{
                      background: 'var(--bg-surface)',
                      borderRadius: '14px',
                      border: '1px solid var(--border)',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                            {ap.account_name || 'Customer Account'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary)' }}>
                              {ap.product_code || ap.product_name || 'PRODUCT'}
                            </span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: ap.status === 'EXPANSION' ? 'rgba(147, 51, 234, 0.12)' : 'rgba(16, 185, 129, 0.12)', color: ap.status === 'EXPANSION' ? '#9333ea' : '#10b981' }}>
                              {ap.status}
                            </span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: badge.bg, color: badge.color }}>
                            {badge.label} ({ap.health_score ?? 100}%)
                          </span>
                        </div>
                      </div>

                      {/* Health Score Meter */}
                      <div style={{ margin: '14px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          <span>Telemetry & Adoption Level</span>
                          <span style={{ fontWeight: 700, color: badge.color }}>{ap.health_score ?? 100} / 100</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(0, ap.health_score ?? 100))}%`,
                              height: '100%',
                              background: badge.color,
                              transition: 'width 0.3s ease'
                            }}
                          />
                        </div>
                      </div>

                      {/* Commercial Details */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--bg-subtle, rgba(0,0,0,0.02))', padding: '10px 12px', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '16px' }}>
                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Contract Value / ARR</div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            ${Number(ap.arr_mrr || ap.contract_value || 0).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Renewal Date</div>
                          <div style={{ fontWeight: 700, color: ap.renewal_date ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {ap.renewal_date ? new Date(ap.renewal_date).toLocaleDateString() : 'Annual Rolling'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                      <button
                        onClick={() => handleOpenTelemetry(ap)}
                        style={{
                          flex: 1,
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                        }}
                      >
                        <Activity size={14} /> Telemetry
                      </button>

                      <button
                        onClick={() => handleOpenRenewal(ap, 'RENEWAL')}
                        style={{
                          padding: '7px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          background: 'rgba(16, 185, 129, 0.08)',
                          color: '#10b981',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        <Calendar size={14} /> Renew
                      </button>

                      <button
                        onClick={() => handleOpenRenewal(ap, 'EXPANSION')}
                        style={{
                          padding: '7px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(79, 70, 229, 0.4)',
                          background: 'rgba(79, 70, 229, 0.08)',
                          color: 'var(--primary)',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        <ArrowUpRight size={14} /> Expand
                      </button>

                      {onNavigateToAccount && (
                        <button
                          onClick={() => onNavigateToAccount(ap.account)}
                          title="View in Account 360"
                          style={{
                            padding: '7px 9px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-surface)',
                            color: 'var(--text-muted)',
                            cursor: 'pointer'
                          }}
                        >
                          <ExternalLink size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Content 2: ONBOARDING & IMPLEMENTATION MILESTONES */}
      {activeTab === 'ONBOARDING' && (
        <div>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '16px 20px', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              Closed-Won Customer Implementation Gateways
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Tracks technical deployment from contract execution through ERP master data ingestion, mobile user enablement, and final go-live acceptance.
            </p>
          </div>

          {wonOpportunities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <Server size={36} style={{ color: 'var(--text-muted)', marginBottom: '10px', opacity: 0.6 }} />
              <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>No Closed-Won Deals Awaiting Onboarding</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
                Deals transitioned to Closed Won will populate this onboarding gateway immediately.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {wonOpportunities.map(opp => {
                const accId = opp.account;
                const mState = milestones[accId] || {
                  erpConnected: !!opp.erp_system,
                  masterDataLoaded: false,
                  trainingDone: false,
                  goLiveAccepted: false
                };

                const completedCount = [mState.erpConnected, mState.masterDataLoaded, mState.trainingDone, mState.goLiveAccepted].filter(Boolean).length;
                const progressPct = Math.round((completedCount / 4) * 100);

                return (
                  <div
                    key={opp.id}
                    style={{
                      background: 'var(--bg-surface)',
                      borderRadius: '14px',
                      border: '1px solid var(--border)',
                      padding: '20px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {opp.account_name}
                          </h3>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                            CLOSED WON
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Product: <strong>{opp.product_name || opp.pricing_plan || 'VanForces PLD'}</strong> • Scope: {opp.seat_units_count} Seats • ERP: <strong>{opp.erp_system || 'SAP / Legacy'}</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rollout Progress</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: progressPct === 100 ? '#10b981' : 'var(--primary)' }}>
                            {progressPct}% ({completedCount}/4)
                          </div>
                        </div>

                        {onNavigateToAccount && (
                          <button
                            onClick={() => onNavigateToAccount(opp.account)}
                            style={{
                              padding: '7px 12px',
                              borderRadius: '8px',
                              border: '1px solid var(--border)',
                              background: 'var(--bg-surface)',
                              color: 'var(--text-primary)',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                          >
                            <Building size={14} /> Account 360
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 4 Implementation Milestone Checkpoints */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                      <div
                        onClick={() => saveMilestones(accId, { ...mState, erpConnected: !mState.erpConnected })}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          border: mState.erpConnected ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border)',
                          background: mState.erpConnected ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-subtle, rgba(0,0,0,0.01))',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '10px'
                        }}
                      >
                        <CheckCircle2 size={18} color={mState.erpConnected ? '#10b981' : 'var(--text-muted)'} />
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>1. ERP Connector Sync</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>BAPI/RFC/OData endpoint hooked</div>
                        </div>
                      </div>

                      <div
                        onClick={() => saveMilestones(accId, { ...mState, masterDataLoaded: !mState.masterDataLoaded })}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          border: mState.masterDataLoaded ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border)',
                          background: mState.masterDataLoaded ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-subtle, rgba(0,0,0,0.01))',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '10px'
                        }}
                      >
                        <CheckCircle2 size={18} color={mState.masterDataLoaded ? '#10b981' : 'var(--text-muted)'} />
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>2. Master Data Ingested</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vans, SKUs, Outlets uploaded</div>
                        </div>
                      </div>

                      <div
                        onClick={() => saveMilestones(accId, { ...mState, trainingDone: !mState.trainingDone })}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          border: mState.trainingDone ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border)',
                          background: mState.trainingDone ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-subtle, rgba(0,0,0,0.01))',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '10px'
                        }}
                      >
                        <CheckCircle2 size={18} color={mState.trainingDone ? '#10b981' : 'var(--text-muted)'} />
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>3. Field Staff Trained</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Handheld device certification</div>
                        </div>
                      </div>

                      <div
                        onClick={() => saveMilestones(accId, { ...mState, goLiveAccepted: !mState.goLiveAccepted })}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          border: mState.goLiveAccepted ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border)',
                          background: mState.goLiveAccepted ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-subtle, rgba(0,0,0,0.01))',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '10px'
                        }}
                      >
                        <CheckCircle2 size={18} color={mState.goLiveAccepted ? '#10b981' : 'var(--text-muted)'} />
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>4. Production Go-Live</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sign-off & SLA monitoring active</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Content 3: RENEWALS & EXPANSION OPPORTUNITIES */}
      {activeTab === 'RENEWALS_EXPANSION' && (
        <div>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '16px 20px', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              Proactive Contract Renewals & Cross-Sell Expansion Pipeline
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Trigger annual contract renewals before expiration or cross-sell additional PLD modules to healthy customer accounts.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
            {filteredAccountProducts.map(ap => {
              const score = ap.health_score ?? 100;
              const isHighHealth = score >= 80;
              const isAtRisk = score < 60;

              return (
                <div
                  key={ap.id}
                  style={{
                    background: 'var(--bg-surface)',
                    borderRadius: '14px',
                    border: '1px solid var(--border)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {ap.account_name || 'Account'}
                        </h4>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Current Product: <strong>{ap.product_code || ap.product_name}</strong>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current ARR</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          ${Number(ap.arr_mrr || ap.contract_value || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Recommendation Badge */}
                    <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                      {isHighHealth && (
                        <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(79, 70, 229, 0.08)', border: '1px solid rgba(79, 70, 229, 0.2)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--primary)' }}>
                          <Sparkles size={16} />
                          <span><strong>Expansion Candidate:</strong> High health ({score}%). Ready for cross-sell or seat pack upsell.</span>
                        </div>
                      )}
                      {isAtRisk && (
                        <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#ef4444' }}>
                          <AlertTriangle size={16} />
                          <span><strong>Renewal At Risk:</strong> Low adoption ({score}%). CS intervention recommended before renewal.</span>
                        </div>
                      )}
                      {!isHighHealth && !isAtRisk && (
                        <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#f59e0b' }}>
                          <CheckCircle2 size={16} />
                          <span><strong>Standard Renewal:</strong> Customer stable ({score}%). Propose annual contract renewal.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                    <button
                      onClick={() => handleOpenRenewal(ap, 'RENEWAL')}
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: '#10b981',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                      }}
                    >
                      <Calendar size={15} /> Initiate Renewal
                    </button>

                    <button
                      onClick={() => handleOpenRenewal(ap, 'EXPANSION')}
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--primary)',
                        background: 'var(--primary)',
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                      }}
                    >
                      <ArrowUpRight size={15} /> Initiate Expansion
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: Telemetry & Health Score Update (Frosted semi-transparent centered modal) */}
      {showTelemetryModal && selectedAccountProduct && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '480px', width: '100%', margin: 'auto', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Update Adoption Telemetry
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {selectedAccountProduct.account_name} • {selectedAccountProduct.product_code}
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowTelemetryModal(false)}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-scroll-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: '1 1 auto' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                  Account Lifecycle Status
                </label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="CUSTOMER">Active Customer</option>
                  <option value="EXPANSION">Expansion Candidate</option>
                  <option value="INACTIVE">Inactive / Churned</option>
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Adoption Health Score ({editHealthScore}%)
                  </label>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', ...getHealthBadge(editHealthScore) }}>
                    {getHealthBadge(editHealthScore).label}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={editHealthScore}
                  onChange={e => setEditHealthScore(Number(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <span>0% (Critical Attrition)</span>
                  <span>50%</span>
                  <span>100% (High Adoption)</span>
                </div>
              </div>

              <div style={{ background: 'var(--bg-subtle, rgba(0,0,0,0.02))', padding: '12px', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                💡 <em>Higher health scores automatically flag this account as an Expansion candidate for upselling modules or additional seat licenses.</em>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-surface-elevated)' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowTelemetryModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveTelemetry}
                disabled={submitting}
              >
                {submitting ? 'Saving...' : 'Save Telemetry'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: Initiate Renewal / Expansion Opportunity */}
      {showRenewalModal && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '520px', width: '100%', margin: 'auto', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Initiate {renewalType === 'RENEWAL' ? 'Contract Renewal' : 'Expansion Deal'}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Creates an opportunity with carried forward technical context and commercial targets.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowRenewalModal(false)}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-scroll-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: '1 1 auto' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                  Opportunity Type
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setRenewalType('RENEWAL')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: renewalType === 'RENEWAL' ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: renewalType === 'RENEWAL' ? 'rgba(79, 70, 229, 0.08)' : 'var(--bg-surface)',
                      color: renewalType === 'RENEWAL' ? 'var(--primary)' : 'var(--text-primary)',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Contract Renewal
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenewalType('EXPANSION')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: renewalType === 'EXPANSION' ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: renewalType === 'EXPANSION' ? 'rgba(79, 70, 229, 0.08)' : 'var(--bg-surface)',
                      color: renewalType === 'EXPANSION' ? 'var(--primary)' : 'var(--text-primary)',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Expansion / Upsell
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                  Product
                </label>
                <select
                  value={renewalProductId}
                  onChange={e => setRenewalProductId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)'
                  }}
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                    Target Value ($)
                  </label>
                  <input
                    type="number"
                    value={renewalValue}
                    onChange={e => setRenewalValue(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                    Term (Months)
                  </label>
                  <input
                    type="number"
                    value={renewalTermMonths}
                    onChange={e => setRenewalTermMonths(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                  Rationale & Scope Notes
                </label>
                <textarea
                  rows={3}
                  value={renewalNotes}
                  onChange={e => setRenewalNotes(e.target.value)}
                  placeholder="Notes regarding renewal terms or expansion scope..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-surface-elevated)' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowRenewalModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateRenewalOpportunity}
                disabled={submitting}
              >
                {submitting ? 'Creating...' : `Create ${renewalType === 'RENEWAL' ? 'Renewal' : 'Expansion'} Deal`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
