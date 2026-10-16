import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  RotateCcw, DollarSign, Target, ShieldAlert,
  Search, RefreshCw, ExternalLink,
  TrendingDown, BookOpen, Layers, X,
  CheckCircle2, ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import type { Opportunity, Lead, Product } from '../services/api';
import { inAppAlert } from './common/InAppAlert';

export type NurtureTabType = 'LOST_OPPORTUNITIES' | 'ICP_FAILED' | 'NURTURE_LEADS' | 'INTELLIGENCE_MATRIX';

export const ICP_FAILURE_ISSUES = [
  { id: 'FLEET_COUNT', label: 'Fleet Size Knockout: Delivery van fleet below minimum required threshold (< 5 vans)' },
  { id: 'TARGET_SECTOR', label: 'Target Sector Knockout: Industry outside target distribution sectors (FMCG, Bakery, F&B, Dairy, Frozen Food, Wholesale Distribution)' },
  { id: 'FIELD_SALES', label: 'Operations Model Knockout: Organization does not operate a direct field sales or van delivery fleet' },
  { id: 'ERP_SYSTEM', label: 'ERP Prerequisite Knockout: Missing enterprise ERP infrastructure or incompatible with field sync' },
  { id: 'TELEMATICS', label: 'Telematics / Route Hardware: No vehicle telematics or mobile delivery tracking hardware' },
  { id: 'CUSTOM', label: 'Custom ICP Failure Issue (Specify detailed reason below)' },
];

interface NurtureWorkspaceProps {
  selectedProductFilter?: string;
  initialTab?: NurtureTabType;
  onNavigateToAccount?: (accId: string) => void;
  onNavigateToOpportunity?: (oppId: string) => void;
  onNavigateToNegotiation?: (oppId: string) => void;
  onNavigateToLead?: (lead: Lead) => void;
}

export const NurtureWorkspace: React.FC<NurtureWorkspaceProps> = ({
  selectedProductFilter = 'ALL',
  initialTab,
  onNavigateToAccount,
  onNavigateToOpportunity,
  onNavigateToNegotiation,
  onNavigateToLead
}) => {
  const [lostOpportunities, setLostOpportunities] = useState<Opportunity[]>([]);
  const [nurtureLeads, setNurtureLeads] = useState<Lead[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [evaluatingLeadId, setEvaluatingLeadId] = useState<string | null>(null);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<NurtureTabType>(initialTab || 'LOST_OPPORTUNITIES');
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState<string>(selectedProductFilter);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Modals
  const [showReviveModal, setShowReviveModal] = useState(false);
  const [selectedOppToRevive, setSelectedOppToRevive] = useState<Opportunity | null>(null);
  const [reviveReason, setReviveReason] = useState('Customer re-opened evaluation following competitor SLA failure.');
  const [reviveTargetStage, setReviveTargetStage] = useState('OPP_NEGOTIATION');

  // Add Failed Lead to Pool Modal State
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [availableActiveLeads, setAvailableActiveLeads] = useState<Lead[]>([]);
  const [selectedLeadIdToAdd, setSelectedLeadIdToAdd] = useState('');
  const [addLeadPresetReason, setAddLeadPresetReason] = useState('FAILED_ICP');
  const [selectedIcpIssue, setSelectedIcpIssue] = useState('FLEET_COUNT');
  const [addLeadCustomReason, setAddLeadCustomReason] = useState('');
  const [addLeadStatus, setAddLeadStatus] = useState<'NURTURE' | 'DISQUALIFIED'>('DISQUALIFIED');
  const [restoredNotification, setRestoredNotification] = useState<{ lead: Lead; companyName: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [oppRes, leadRes, prodRes] = await Promise.all([
        api.getOpportunities({ status: 'LOST' }),
        api.getLeads(),
        api.getProducts()
      ]);

      // Strictly ensure only CLOSED-LOST deals enter the lostOpportunities state.
      // WON and ACTIVE deals must NEVER appear in the nurture / closed-lost pool!
      const rawOpps: Opportunity[] = oppRes.results || [];
      const lostDeals = rawOpps.filter(o => o.status === 'LOST');
      setLostOpportunities(lostDeals);
      // Filter leads that are in NURTURE or DISQUALIFIED status
      // Leads restored to ACTIVE status belong in the active PLD queue!
      const allLeads = leadRes.results || [];
      const nLeads = allLeads.filter(l => l.status === 'NURTURE' || l.status === 'DISQUALIFIED');
      setNurtureLeads(nLeads);
      setAvailableActiveLeads(allLeads.filter(l => l.status === 'ACTIVE'));
      setProducts(prodRes.results || []);
    } catch (err: any) {
      console.error(err);
      inAppAlert.error(err?.message || 'Failed to load Nurture pool data.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLeadToPool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadIdToAdd) {
      inAppAlert.warning('Please select an active lead to add to the pool.');
      return;
    }

    const isIcpFailure = addLeadPresetReason === 'FAILED_ICP' || activeTab === 'ICP_FAILED';
    let finalReason = '';

    if (isIcpFailure) {
      const issueOption = ICP_FAILURE_ISSUES.find(o => o.id === selectedIcpIssue);
      const issueText = issueOption?.id === 'CUSTOM' ? '' : (issueOption?.label || '');
      const notes = addLeadCustomReason.trim();
      finalReason = issueText ? (notes ? `${issueText}. Notes: ${notes}` : issueText) : (notes || 'Failed mandatory ICP knockout criteria.');
    } else {
      finalReason = addLeadCustomReason.trim() || (
        addLeadPresetReason === 'NO_BUDGET' ? 'No immediate commercial budget allocated; postponed to next fiscal cycle.' :
        addLeadPresetReason === 'INFRASTRUCTURE' ? 'Prerequisite enterprise ERP / telematics infrastructure not ready.' :
        addLeadPresetReason === 'COMPETITOR' ? 'Contract locked with competitor; queued for win-back timing.' :
        'Lead disqualified during PLD qualification stage.'
      );
    }

    setSubmitting(true);
    try {
      const res = await api.moveToNurturePool(selectedLeadIdToAdd, {
        reason: finalReason,
        status: isIcpFailure ? 'DISQUALIFIED' : addLeadStatus,
        is_icp_failure: isIcpFailure
      });
      inAppAlert.success(res.message || `Lead successfully added to ${isIcpFailure ? 'ICP Failed' : 'Nurture'} Pool!`);
      setShowAddLeadModal(false);
      setSelectedLeadIdToAdd('');
      setAddLeadCustomReason('');
      await loadData();
      if (isIcpFailure) {
        setActiveTab('ICP_FAILED');
      }
    } catch (err: any) {
      inAppAlert.error(err.message || 'Failed to add lead to pool.');
    } finally {
      setSubmitting(false);
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

  // Filtered Opportunities
  const filteredLostOpportunities = useMemo(() => {
    return lostOpportunities.filter(o => {
      // Safety guard: Only deals with status === 'LOST' can appear in the closed-lost pool
      if (o.status !== 'LOST') return false;
      const acc = (o.account_name || '').toLowerCase();
      const comp = (o.competitor || '').toLowerCase();
      const reason = (o.loss_reason_notes || o.loss_reason_category || '').toLowerCase();
      const pCode = (o.product_code || '').toUpperCase();
      const matchesSearch = !searchQuery || acc.includes(searchQuery.toLowerCase()) || comp.includes(searchQuery.toLowerCase()) || reason.includes(searchQuery.toLowerCase());
      const matchesProduct = productFilter === 'ALL' || pCode === productFilter.toUpperCase() || o.product === productFilter;
      return matchesSearch && matchesProduct;
    });
  }, [lostOpportunities, searchQuery, productFilter]);

  // Helper to identify ICP knockout failures
  const isIcpFailedLead = (lead: Lead) => {
    // If explicitly ACTIVE, lead has been restored to active pipeline and is NEVER in ICP Failed!
    if (lead.status === 'ACTIVE') {
      return false;
    }
    // If explicitly qualified / passed, it is NEVER an ICP failed lead
    if (String(lead.icp_result).toUpperCase() === 'PASS' && lead.icp_knockout_passed === true) {
      return false;
    }
    if (String(lead.icp_result).toUpperCase() === 'FAIL') return true;
    if (lead.icp_knockout_passed === false) return true;
    const combined = ((lead.disqualification_reason || '') + ' ' + (lead.nurture_reason || '')).toLowerCase();
    if (combined.includes('icp') || combined.includes('knockout') || combined.includes('failed icp')) return true;
    return false;
  };

  const icpFailedLeads = useMemo(() => {
    return nurtureLeads.filter(l => isIcpFailedLead(l));
  }, [nurtureLeads]);

  const generalNurtureLeads = useMemo(() => {
    return nurtureLeads.filter(l => !isIcpFailedLead(l));
  }, [nurtureLeads]);

  // Filtered ICP Failed Leads
  const filteredIcpFailedLeads = useMemo(() => {
    return icpFailedLeads.filter(l => {
      const acc = (l.account_name || '').toLowerCase();
      const contact = (l.contact_name || '').toLowerCase();
      const reason = ((l.disqualification_reason || '') + ' ' + (l.nurture_reason || '') + ' ' + ((l.icp_reasons || []).join(' '))).toLowerCase();
      const pCode = (l.primary_product_code || '').toUpperCase();
      const matchesSearch = !searchQuery || acc.includes(searchQuery.toLowerCase()) || contact.includes(searchQuery.toLowerCase()) || reason.includes(searchQuery.toLowerCase());
      const matchesProduct = productFilter === 'ALL' || pCode === productFilter.toUpperCase() || l.primary_product === productFilter;
      return matchesSearch && matchesProduct;
    });
  }, [icpFailedLeads, searchQuery, productFilter]);

  // Filtered General Nurture Leads
  const filteredNurtureLeads = useMemo(() => {
    return generalNurtureLeads.filter(l => {
      const acc = (l.account_name || '').toLowerCase();
      const contact = (l.contact_name || '').toLowerCase();
      const reason = ((l.disqualification_reason || '') + ' ' + (l.nurture_reason || '')).toLowerCase();
      const pCode = (l.primary_product_code || '').toUpperCase();
      const matchesSearch = !searchQuery || acc.includes(searchQuery.toLowerCase()) || contact.includes(searchQuery.toLowerCase()) || reason.includes(searchQuery.toLowerCase());
      const matchesProduct = productFilter === 'ALL' || pCode === productFilter.toUpperCase() || l.primary_product === productFilter;
      return matchesSearch && matchesProduct;
    });
  }, [generalNurtureLeads, searchQuery, productFilter]);

  // KPI Calculations
  const totalLostValue = useMemo(() => {
    return lostOpportunities
      .filter(o => o.status === 'LOST')
      .reduce((acc, curr) => acc + Number(curr.total_contract_value || curr.arr || 0), 0);
  }, [lostOpportunities]);

  const topCompetitor = useMemo(() => {
    const counts: Record<string, number> = {};
    lostOpportunities.filter(o => o.status === 'LOST').forEach(o => {
      const c = (o.competitor || '').trim();
      if (c) counts[c] = (counts[c] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : 'None Recorded';
  }, [lostOpportunities]);

  const topLossCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    lostOpportunities.filter(o => o.status === 'LOST').forEach(o => {
      const cat = o.loss_reason_category || 'UNSPECIFIED';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : 'N/A';
  }, [lostOpportunities]);

  // Handlers
  const handleOpenRevive = (opp: Opportunity) => {
    setSelectedOppToRevive(opp);
    setReviveReason(`Customer re-opened evaluation for ${opp.account_name}. Budget / competitor contract reconsidered.`);
    setReviveTargetStage('OPP_NEGOTIATION');
    setShowReviveModal(true);
  };

  const handleConfirmRevive = async () => {
    if (!selectedOppToRevive) return;
    setSubmitting(true);
    try {
      const res = await api.reEngageOpportunity(selectedOppToRevive.id, {
        reason: reviveReason,
        stage_code: reviveTargetStage
      });
      inAppAlert.success(res.message || `Opportunity revived successfully! Returned to active pipeline.`);
      setShowReviveModal(false);
      loadData();
      if (onNavigateToNegotiation && res.opportunity?.id) {
        onNavigateToNegotiation(res.opportunity.id);
      } else if (onNavigateToOpportunity && res.opportunity?.id) {
        onNavigateToOpportunity(res.opportunity.id);
      }
    } catch (err: any) {
      console.error(err);
      inAppAlert.error(err?.message || 'Failed to revive opportunity.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreLead = async (leadId: string, companyName: string) => {
    setSubmitting(true);
    try {
      const res = await api.restoreNurtureLead(leadId);
      inAppAlert.success(res.message || `Lead for "${companyName}" restored to active pursuit queue!`);
      if (res.lead) {
        setRestoredNotification({ lead: res.lead, companyName });
      }
      await loadData();
    } catch (err: any) {
      console.error(err);
      inAppAlert.error(err?.message || 'Failed to restore lead.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReEvaluateLeadICP = async (lead: Lead) => {
    setEvaluatingLeadId(lead.id);
    try {
      const res = await api.evaluateICP(lead.account, lead.primary_product, lead.id);
      if (res.result === 'PASS') {
        inAppAlert.success(`ICP Passed! Fit Score: ${res.fit_score}/100. Restoring lead to active pipeline...`);
        const restoreRes = await api.restoreNurtureLead(lead.id);
        inAppAlert.success(`Lead "${lead.account_name}" has been restored to active PLD queue!`);
        if (restoreRes.lead) {
          setRestoredNotification({ lead: restoreRes.lead, companyName: lead.account_name });
        }
      } else if (res.result === 'PENDING') {
        inAppAlert.warning(`ICP Evaluation Pending: Missing required operational information for ${lead.account_name}.`);
      } else {
        const failureMsg = res.reasons?.join('; ') || 'Account does not meet mandatory knock-out criteria.';
        inAppAlert.error(`ICP Knockout Failed: ${failureMsg}`);
      }
      await loadData();
    } catch (err: any) {
      console.error(err);
      inAppAlert.error(err.message || 'Failed to re-evaluate ICP.');
    } finally {
      setEvaluatingLeadId(null);
    }
  };

  return (
    <div className="workspace-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Restored Lead Destination Notice Banner */}
      {restoredNotification && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 4px 16px rgba(16, 185, 129, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                Lead "{restoredNotification.companyName}" Restored to Active Pursuit!
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Moved to: <strong style={{ color: 'var(--primary)' }}>PLD Work Queue (Queue tab)</strong> &amp; high-priority outreach task assigned in <strong style={{ color: 'var(--primary)' }}>My Work Queue</strong>.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onNavigateToLead && (
              <button
                onClick={() => {
                  onNavigateToLead(restoredNotification.lead);
                  setRestoredNotification(null);
                }}
                className="btn btn-primary"
                style={{
                  padding: '8px 16px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  borderColor: '#059669',
                  cursor: 'pointer'
                }}
              >
                View in Active PLD Queue <ArrowRight size={14} />
              </button>
            )}
            <button
              onClick={() => setRestoredNotification(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px'
              }}
              title="Dismiss"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.12)', borderRadius: '10px', color: '#ef4444' }}>
              <RotateCcw size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Nurture & Win-Back Intelligence Pool
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Closed-lost deal intelligence, disqualified lead incubation, competitor displace playbooks, and 1-click win-back re-engagement.
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

      {/* Top KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: 'var(--bg-surface)', padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
            <span>Lost Pipeline Value</span>
            <DollarSign size={18} style={{ color: '#ef4444' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: 'var(--text-primary)' }}>
            ${totalLostValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Closed-lost deals eligible for win-back
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
            <span>Nurture Pool Candidates</span>
            <Target size={18} style={{ color: 'var(--primary)' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: 'var(--text-primary)' }}>
            {filteredLostOpportunities.length + nurtureLeads.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {filteredIcpFailedLeads.length} ICP Failed • {filteredNurtureLeads.length} Disqualified • {filteredLostOpportunities.length} Lost Deals
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
            <span>Winning Competitor</span>
            <ShieldAlert size={18} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '10px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {topCompetitor}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Primary incumbent displacement target
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
            <span>Dominant Loss Reason</span>
            <TrendingDown size={18} style={{ color: '#6366f1' }} />
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '10px', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
            {topLossCategory.replace(/_/g, ' ')}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Key objection category to overcome
          </div>
        </div>
      </div>

      {/* Tabs and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('LOST_OPPORTUNITIES')}
            style={{
              padding: '10px 16px',
              borderBottom: activeTab === 'LOST_OPPORTUNITIES' ? '3px solid #ef4444' : '3px solid transparent',
              background: 'none',
              borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              fontWeight: 700,
              fontSize: '0.92rem',
              color: activeTab === 'LOST_OPPORTUNITIES' ? '#ef4444' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <RotateCcw size={17} />
            Closed-Lost Deals ({filteredLostOpportunities.length})
          </button>

          <button
            onClick={() => setActiveTab('ICP_FAILED')}
            style={{
              padding: '10px 16px',
              borderBottom: activeTab === 'ICP_FAILED' ? '3px solid #ef4444' : '3px solid transparent',
              background: 'none',
              borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              fontWeight: 700,
              fontSize: '0.92rem',
              color: activeTab === 'ICP_FAILED' ? '#ef4444' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <ShieldAlert size={17} />
            ICP Failed ({filteredIcpFailedLeads.length})
          </button>

          <button
            onClick={() => setActiveTab('NURTURE_LEADS')}
            style={{
              padding: '10px 16px',
              borderBottom: activeTab === 'NURTURE_LEADS' ? '3px solid var(--primary)' : '3px solid transparent',
              background: 'none',
              borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              fontWeight: 700,
              fontSize: '0.92rem',
              color: activeTab === 'NURTURE_LEADS' ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <Target size={17} />
            Disqualified & Nurture Leads ({filteredNurtureLeads.length})
          </button>

          <button
            onClick={() => setActiveTab('INTELLIGENCE_MATRIX')}
            style={{
              padding: '10px 16px',
              borderBottom: activeTab === 'INTELLIGENCE_MATRIX' ? '3px solid #10b981' : '3px solid transparent',
              background: 'none',
              borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              fontWeight: 700,
              fontSize: '0.92rem',
              color: activeTab === 'INTELLIGENCE_MATRIX' ? '#10b981' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <BookOpen size={17} />
            Competitor Intelligence & Win-Back Playbooks
          </button>
        </div>

        <div style={{ position: 'relative', minWidth: '260px', paddingBottom: '8px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search deals, competitors, or reasons..."
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

      {/* Tab 1: CLOSED-LOST OPPORTUNITIES */}
      {activeTab === 'LOST_OPPORTUNITIES' && (
        <div>
          {filteredLostOpportunities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <RotateCcw size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px', opacity: 0.5 }} />
              <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>No Closed-Lost Deals Found</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '450px', margin: '8px auto 0' }}>
                Deals marked as Closed Lost in the Commercial Negotiation stage are cataloged here with competitor intelligence for win-back campaigns.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
              {filteredLostOpportunities.map(opp => (
                <div
                  key={opp.id}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                          {opp.account_name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                            CLOSED LOST
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: 'rgba(79, 70, 229, 0.08)', color: 'var(--primary)' }}>
                            {opp.product_name || opp.pricing_plan || 'VanForces PLD'}
                          </span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Deal Value</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          ${Number(opp.total_contract_value || opp.arr || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Root Cause Intelligence Box */}
                    <div style={{ background: 'var(--bg-subtle, rgba(0,0,0,0.02))', padding: '12px', borderRadius: '10px', margin: '14px 0', border: '1px solid rgba(0,0,0,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Loss Reason Category:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{(opp.loss_reason_category || 'UNSPECIFIED').replace(/_/g, ' ')}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Winning Competitor:</span>
                        <strong style={{ color: '#ef4444' }}>{opp.competitor || 'None Specified'}</strong>
                      </div>
                      {opp.loss_reason_notes && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px', borderTop: '1px dashed var(--border)', paddingTop: '6px', fontStyle: 'italic' }}>
                          "{opp.loss_reason_notes}"
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                    <button
                      onClick={() => handleOpenRevive(opp)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
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
                      <RotateCcw size={14} /> Re-Engage & Revive
                    </button>

                    {onNavigateToAccount && (
                      <button
                        onClick={() => onNavigateToAccount(opp.account)}
                        title="View Account 360"
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        <ExternalLink size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: ICP FAILED LEADS */}
      {activeTab === 'ICP_FAILED' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', fontWeight: 800, fontSize: '0.75rem' }}>
                  AUTOMATIC PLD QUEUE EXCLUSION
                </span>
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '6px 0 0', color: 'var(--text-primary)' }}>
                ICP Failed Leads ({filteredIcpFailedLeads.length})
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Leads that failed mandatory Ideal Customer Profile knockout rules (e.g., minimum fleet size, distribution centers, or operations profile). Automatically removed from the active PLD Work Queue to prevent premature sales outreach.
              </p>
            </div>

            <button
              onClick={() => {
                setAddLeadPresetReason('FAILED_ICP');
                setAddLeadStatus('DISQUALIFIED');
                setShowAddLeadModal(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(239, 68, 68, 0.3)'
              }}
            >
              <ShieldAlert size={15} /> + Add ICP Failed Lead
            </button>
          </div>

          {/* Destination Explainer Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            background: 'rgba(59, 130, 246, 0.06)',
            border: '1px solid rgba(59, 130, 246, 0.22)',
            borderRadius: '10px',
            marginBottom: '18px',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)'
          }}>
            <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Where do leads move when restored?</strong> Restoring an ICP-failed lead overrides the knockout filter, sets status to <span style={{ color: '#10b981', fontWeight: 700 }}>ACTIVE</span>, and routes it directly to the <strong>PLD Work Queue (Queue tab)</strong> with a high-priority outreach task generated in <strong>My Work Queue</strong>.
            </div>
          </div>

          {filteredIcpFailedLeads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <ShieldAlert size={42} style={{ color: '#10b981', marginBottom: '12px', opacity: 0.8 }} />
              <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>No ICP-Failed Leads in Pool</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '480px', margin: '8px auto 16px auto' }}>
                All prospects currently in the system meet mandatory product knockout criteria or have passed ICP evaluation. Inbound leads failing ICP rules will be automatically segregated here.
              </p>
              <button
                onClick={() => {
                  setAddLeadPresetReason('FAILED_ICP');
                  setAddLeadStatus('DISQUALIFIED');
                  setShowAddLeadModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                <ShieldAlert size={14} /> + Add ICP Failed Lead
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
              {filteredIcpFailedLeads.map(lead => {
                const isCurrentlyEvaluating = evaluatingLeadId === lead.id;
                const failureReasons = lead.icp_reasons && lead.icp_reasons.length > 0
                  ? lead.icp_reasons
                  : [(lead as any).disqualification_reason || (lead as any).nurture_reason || 'Failed mandatory knockout criteria for primary product.'];

                return (
                  <div
                    key={lead.id}
                    style={{
                      background: 'var(--bg-surface)',
                      borderRadius: '14px',
                      border: '1px solid var(--border)',
                      borderTop: '3px solid #ef4444',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                    }}
                  >
                    <div>
                      {/* Top Row: Account & Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.08rem', color: 'var(--text-primary)' }}>
                            {lead.account_name}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Contact: {lead.contact_name || lead.contact_email || 'General Inbound'}
                            {lead.contact_designation ? ` (${lead.contact_designation})` : ''}
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '5px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <ShieldAlert size={12} /> ICP FAILED
                          </span>
                          {lead.icp_fit_score !== undefined && lead.icp_fit_score !== null && (
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(100, 116, 139, 0.1)', color: 'var(--text-secondary)' }}>
                              Fit Score: {lead.icp_fit_score}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Product Tag */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: 'rgba(79, 70, 229, 0.08)', color: 'var(--primary)' }}>
                          {lead.primary_product_name || lead.primary_product_code}
                        </span>
                        {lead.owner_name && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            • Rep: {lead.owner_name}
                          </span>
                        )}
                      </div>

                      {/* Knock-Out Failure Intelligence Box */}
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.04)',
                        border: '1px solid rgba(239, 68, 68, 0.18)',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        margin: '12px 0'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, color: '#ef4444', marginBottom: '6px' }}>
                          <ShieldAlert size={14} /> Knock-out Failure Reasons:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {failureReasons.map((reason, idx) => (
                            <li key={idx} style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                              {reason}
                            </li>
                          ))}
                        </ul>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px', borderTop: '1px dashed rgba(239, 68, 68, 0.15)', paddingTop: '6px' }}>
                          Excluded from active PLD Queue until account qualifications or fleet metrics change.
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '8px' }}>
                      <button
                        onClick={() => handleReEvaluateLeadICP(lead)}
                        disabled={submitting || isCurrentlyEvaluating}
                        title="Re-run ICP Knockout validation against latest account data"
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--primary)',
                          background: 'rgba(79, 70, 229, 0.08)',
                          color: 'var(--primary)',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                        }}
                      >
                        <RefreshCw size={13} className={isCurrentlyEvaluating ? 'animate-spin' : ''} />
                        {isCurrentlyEvaluating ? 'Evaluating...' : 'Re-evaluate ICP'}
                      </button>

                      <button
                        onClick={() => handleRestoreLead(lead.id, lead.account_name)}
                        disabled={submitting}
                        title="Manually override and restore lead to active pursuit queue"
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          background: 'rgba(16, 185, 129, 0.1)',
                          color: '#10b981',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                        }}
                      >
                        <RotateCcw size={13} />
                        Restore
                      </button>

                      {onNavigateToAccount && (
                        <button
                          onClick={() => onNavigateToAccount(lead.account)}
                          title="View & Edit Account Attributes (Fleet size, ERP, distribution centers)"
                          style={{
                            padding: '8px 10px',
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

      {/* Tab 2: DISQUALIFIED & NURTURE LEADS */}
      {activeTab === 'NURTURE_LEADS' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Disqualified &amp; Nurture Pool Leads ({filteredNurtureLeads.length})
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                Prospects incubated following ICP knockout failure, lack of budget, or commercial postponement.
              </p>
            </div>
            <button
              onClick={() => setShowAddLeadModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(245, 158, 11, 0.3)'
              }}
            >
              <RotateCcw size={15} /> + Add Failed Lead to Pool
            </button>
          </div>

          {filteredNurtureLeads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <Target size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px', opacity: 0.5 }} />
              <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>No Disqualified Leads in Nurture Pool</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '450px', margin: '8px auto 16px auto' }}>
                Leads disqualified during PLD gate validation or ICP filtering are saved here for timed re-qualification.
              </p>
              <button
                onClick={() => setShowAddLeadModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                <RotateCcw size={14} /> + Add Failed Lead to Pool
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {filteredNurtureLeads.map(lead => (
                <div
                  key={lead.id}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                          {lead.account_name}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Contact: {lead.contact_name || lead.contact_email || 'General Inbound'}
                        </div>
                      </div>

                      <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                        {lead.status}
                      </span>
                    </div>

                    <div style={{ background: 'var(--bg-subtle, rgba(0,0,0,0.02))', padding: '12px', borderRadius: '10px', margin: '14px 0' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Product Interest:</div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {lead.primary_product_name || lead.primary_product_code}
                      </div>

                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>Disqualification Rationale:</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginTop: '2px', fontStyle: 'italic' }}>
                        {(lead as any).disqualification_reason || (lead as any).nurture_reason || 'ICP / Budget criteria not satisfied at initial contact.'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                    <button
                      onClick={() => handleRestoreLead(lead.id, lead.account_name)}
                      disabled={submitting}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
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
                      <RotateCcw size={14} /> Restore to Active Pursuit
                    </button>

                    {onNavigateToAccount && (
                      <button
                        onClick={() => onNavigateToAccount(lead.account)}
                        title="View Account 360"
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        <ExternalLink size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: WIN-BACK PLAYBOOKS & COMPETITOR MATRIX */}
      {activeTab === 'INTELLIGENCE_MATRIX' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Playbooks Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '14px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                  <DollarSign size={20} />
                </div>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Price & Budget Objections</h4>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.45', margin: 0 }}>
                Trigger ROI & TCO benchmark report showing fuel and manual audit leakage savings. Offer 2-year ramp-up pricing or quarterly payment terms to bypass capex constraints.
              </p>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '14px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                  <ShieldAlert size={20} />
                </div>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Competitor Incumbent Locking</h4>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.45', margin: 0 }}>
                Set automated 90-day pre-expiry renewal calendar alert. Emphasize native offline-first mobile sync and zero-latency route optimization advantages over legacy ERP tools.
              </p>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '14px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary)' }}>
                  <Layers size={20} />
                </div>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Product Capability Gaps</h4>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.45', margin: 0 }}>
                Cross-reference requested capabilities with the PLD Configuration Version roadmap in Engine Studio. Auto-notify sales rep when the required module reaches Published status.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* REVIVE MODAL (Frosted semi-transparent centered modal) */}
      {showReviveModal && selectedOppToRevive && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '500px', width: '100%', margin: 'auto', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Re-Engage & Revive Opportunity
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {selectedOppToRevive.account_name} • Deal Value: ${Number(selectedOppToRevive.total_contract_value || 0).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowReviveModal(false)}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-scroll-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: '1 1 auto' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                  Target Active Pipeline Stage
                </label>
                <select
                  value={reviveTargetStage}
                  onChange={e => setReviveTargetStage(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="OPP_NEGOTIATION">Commercial Negotiation Stage</option>
                  <option value="OPP_PROPOSAL">Proposal & Quote Stage</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                  Revival Justification & Intelligence Notes
                </label>
                <textarea
                  rows={4}
                  value={reviveReason}
                  onChange={e => setReviveReason(e.target.value)}
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

              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px', borderRadius: '8px', fontSize: '0.8rem', color: '#10b981' }}>
                ✓ <em>Reviving will clear Closed-Lost status, log an audit trail entry, and restore the deal into the active sales pipeline.</em>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-surface-elevated)' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowReviveModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmRevive}
                disabled={submitting}
              >
                {submitting ? 'Reopening...' : 'Confirm & Revive Deal'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal 2: Add Failed Lead to Pool */}
      {showAddLeadModal && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay">
          <div className="modal-card" style={{ width: '100%', maxWidth: '540px', margin: 'auto', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header-accent" style={{ background: (addLeadPresetReason === 'FAILED_ICP' || activeTab === 'ICP_FAILED') ? 'linear-gradient(90deg, #ef4444, #dc2626)' : 'linear-gradient(90deg, #f59e0b, #d97706)' }} />
            <div className="modal-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {(addLeadPresetReason === 'FAILED_ICP' || activeTab === 'ICP_FAILED') ? (
                  <ShieldAlert size={22} color="#ef4444" />
                ) : (
                  <RotateCcw size={22} color="#f59e0b" />
                )}
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    {(addLeadPresetReason === 'FAILED_ICP' || activeTab === 'ICP_FAILED') ? 'Record ICP Knockout Failure' : 'Add Failed Lead to Nurture Pool'}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                    {(addLeadPresetReason === 'FAILED_ICP' || activeTab === 'ICP_FAILED')
                      ? 'Exclude lead from active PLD Queue and document mandatory knockout failure criteria'
                      : 'Incubate stalled lead for timed re-qualification and future win-back'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowAddLeadModal(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddLeadToPool} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, margin: 0 }}>
              <div className="modal-scroll-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', flex: '1 1 auto' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Select Active Lead to Evaluate / Segregate *
                  </label>
                  {availableActiveLeads.length === 0 ? (
                    <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px' }}>
                      No active leads currently available to add.
                    </div>
                  ) : (
                    <select
                      className="form-select"
                      required
                      value={selectedLeadIdToAdd}
                      onChange={e => setSelectedLeadIdToAdd(e.target.value)}
                      style={{ width: '100%', marginTop: '4px' }}
                    >
                      <option value="">-- Choose Active Lead --</option>
                      {availableActiveLeads.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.account_name} ({l.primary_product_name || l.primary_product_code}) — Owner: {l.owner_name || 'Unassigned'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Pool Category / Disposition Status *
                  </label>
                  <select
                    className="form-select"
                    value={addLeadStatus}
                    onChange={e => setAddLeadStatus(e.target.value as any)}
                    style={{ width: '100%', marginTop: '4px' }}
                  >
                    <option value="DISQUALIFIED">Disqualified (Unfit for Product / Knockout Failed)</option>
                    <option value="NURTURE">Nurture Pool (Timed Re-qualification Incubation)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Failure / Disqualification Rationale Category *
                  </label>
                  <select
                    className="form-select"
                    value={addLeadPresetReason}
                    onChange={e => setAddLeadPresetReason(e.target.value)}
                    style={{ width: '100%', marginTop: '4px' }}
                  >
                    <option value="FAILED_ICP">Failed ICP Knockout Criteria (Fleet size, van count, or operations model)</option>
                    <option value="NO_BUDGET">No Immediate Budget / Project Postponed to Next Fiscal Cycle</option>
                    <option value="INFRASTRUCTURE">Prerequisite System / ERP Not Ready for Modern PLD Deployment</option>
                    <option value="COMPETITOR">Competitor Contract Locked (Target for Win-Back Playbook)</option>
                    <option value="CUSTOM">Custom Rationale (Specify below)</option>
                  </select>
                </div>

                {/* Specific ICP Knockout Issues Selection */}
                {(addLeadPresetReason === 'FAILED_ICP' || activeTab === 'ICP_FAILED') && (
                  <div style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.25)'
                  }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <ShieldAlert size={14} /> Mandatory ICP Knockout Issue / Criterion *
                    </label>
                    <select
                      className="form-select"
                      value={selectedIcpIssue}
                      onChange={e => setSelectedIcpIssue(e.target.value)}
                      style={{ width: '100%', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                    >
                      {ICP_FAILURE_ISSUES.map(issue => (
                        <option key={issue.id} value={issue.id}>
                          {issue.label}
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      ⚡ Recorded on Account Product Assessment as a Knockout Failure reason and displayed in the ICP Failed Intelligence Box.
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {(addLeadPresetReason === 'FAILED_ICP' || activeTab === 'ICP_FAILED')
                      ? 'Additional Knockout Notes / Context'
                      : 'Detailed Incubation Notes'}
                  </label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={addLeadCustomReason}
                    onChange={e => setAddLeadCustomReason(e.target.value)}
                    placeholder={(addLeadPresetReason === 'FAILED_ICP' || activeTab === 'ICP_FAILED')
                      ? "e.g., Prospect currently operates 2 delivery vans; plan to procure 8 more in Q3 next year..."
                      : "Document specific customer context, competitor details, or conditions required for future revival..."}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-surface-elevated)' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowAddLeadModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || availableActiveLeads.length === 0}
                  style={{
                    background: (addLeadPresetReason === 'FAILED_ICP' || activeTab === 'ICP_FAILED')
                      ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                      : 'linear-gradient(135deg, #f59e0b, #d97706)',
                    borderColor: (addLeadPresetReason === 'FAILED_ICP' || activeTab === 'ICP_FAILED')
                      ? '#dc2626'
                      : '#d97706',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {submitting ? <RefreshCw className="animate-spin" size={15} /> : <RotateCcw size={15} />}
                  {submitting
                    ? 'Processing...'
                    : (addLeadPresetReason === 'FAILED_ICP' || activeTab === 'ICP_FAILED')
                      ? 'Confirm ICP Knockout & Segregate'
                      : 'Confirm & Add to Pool'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
