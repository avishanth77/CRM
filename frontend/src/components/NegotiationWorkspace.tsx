import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Handshake, DollarSign, TrendingUp, XCircle,
  FileText, Clock, ShieldCheck,
  Building, Edit3, Plus, RefreshCw, ArrowRight,
  Award, X, MessageSquare, History, Tag, Printer
} from 'lucide-react';
import { api } from '../services/api';
import type { Opportunity, Proposal } from '../services/api';
import { UnifiedActivityTimeline } from './UnifiedActivityTimeline';
import { inAppAlert } from './common/InAppAlert';
import { CommercialInvoiceModal } from './CommercialInvoiceModal';

interface NegotiationWorkspaceProps {
  initialOpportunityId?: string;
  selectedProductFilter?: string;
  onNavigateToProposal?: (oppId: string) => void;
  onNavigateToAccount?: (accId: string) => void;
}

export const NegotiationWorkspace: React.FC<NegotiationWorkspaceProps> = ({
  initialOpportunityId,
  selectedProductFilter = 'ALL',
  onNavigateToProposal,
  onNavigateToAccount
}) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [stageHistories, setStageHistories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Active view filters
  const [statusFilter, setStatusFilter] = useState<'NEGOTIATION_ONLY' | 'ALL_ACTIVE' | 'WON' | 'LOST' | 'ALL'>('NEGOTIATION_ONLY');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'COMMERCIALS' | 'CONCESSIONS' | 'OBJECTIONS' | 'ACTIVITIES' | 'AUDIT'>('COMMERCIALS');

  // Modals
  const [showEditCommercialsModal, setShowEditCommercialsModal] = useState(false);
  const [showWonModal, setShowWonModal] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Commercial Terms Edit Form
  const [editTcv, setEditTcv] = useState<number>(0);
  const [editArr, setEditArr] = useState<number>(0);
  const [editMrr, setEditMrr] = useState<number>(0);
  const [editPlan, setEditPlan] = useState('');
  const [editSeats, setEditSeats] = useState(1);
  const [editTermMonths, setEditTermMonths] = useState(12);
  const [editPaymentTerms, setEditPaymentTerms] = useState('Net 30 Days');
  const [editProbability, setEditProbability] = useState(70);
  const [editCloseDate, setEditCloseDate] = useState('');

  // Closed Lost Form
  const [lossCategory, setLossCategory] = useState('PRICE_BUDGET');
  const [lossCompetitor, setLossCompetitor] = useState('');
  const [lossNotes, setLossNotes] = useState('');

  // Advance to Negotiation Form
  const [advanceRationale, setAdvanceRationale] = useState('Formal client review completed; entering commercial terms & pricing negotiation.');

  // Fetch all opportunities
  const loadOpportunities = async () => {
    setLoading(true);
    try {
      const res = await api.getOpportunities();
      const list = res.results || [];
      setOpportunities(list);

      // Select initial or first matching opportunity
      if (initialOpportunityId) {
        const found = list.find(o => o.id === initialOpportunityId);
        if (found) {
          setSelectedOpportunity(found);
          loadOpportunityContext(found.id);
          return;
        }
      }

      // Default selection preference: in negotiation, then any open
      if (!selectedOpportunity || !list.find(o => o.id === selectedOpportunity.id)) {
        const negoDeals = list.filter(o => o.stage_code === 'OPP_NEGOTIATION' || o.stage_name?.includes('Negotiation'));
        if (negoDeals.length > 0) {
          setSelectedOpportunity(negoDeals[0]);
          loadOpportunityContext(negoDeals[0].id);
        } else if (list.length > 0) {
          setSelectedOpportunity(list[0]);
          loadOpportunityContext(list[0].id);
        } else {
          setSelectedOpportunity(null);
        }
      } else {
        const refreshed = list.find(o => o.id === selectedOpportunity.id);
        if (refreshed) {
          setSelectedOpportunity(refreshed);
          loadOpportunityContext(refreshed.id);
        }
      }
    } catch (err: any) {
      console.error('Failed to load opportunities in negotiation', err);
      inAppAlert.error(err?.message || 'Failed to load opportunities.');
    } finally {
      setLoading(false);
    }
  };

  const loadOpportunityContext = async (oppId: string) => {
    try {
      const [propsRes, histRes] = await Promise.all([
        api.getOpportunityProposals(oppId).catch(() => []),
        api.getOpportunityHistory(oppId).catch(() => [])
      ]);
      setProposals(propsRes || []);
      setStageHistories(histRes || []);
    } catch (err) {
      console.error('Error fetching proposal context', err);
    }
  };

  useEffect(() => {
    loadOpportunities();
  }, [initialOpportunityId]);

  // Open edit modal and populate state
  const handleOpenEditCommercials = (opp: Opportunity) => {
    setEditTcv(Number(opp.total_contract_value) || 0);
    setEditArr(Number(opp.arr) || Number(opp.arr_mrr) || 0);
    setEditMrr(Number(opp.mrr) || 0);
    setEditPlan(opp.pricing_plan || 'Enterprise License Tier');
    setEditSeats(opp.seat_units_count || 1);
    setEditTermMonths(opp.contract_term_months || 12);
    setEditPaymentTerms('Net 30 Days');
    setEditProbability(opp.probability_pct ?? 70);
    setEditCloseDate(opp.expected_close_date || '');
    setShowEditCommercialsModal(true);
  };

  const handleSaveCommercials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpportunity) return;
    setSubmitting(true);
    try {
      const payload: Partial<Opportunity> & { payment_terms?: string } = {
        total_contract_value: editTcv,
        arr: editArr,
        mrr: editMrr,
        arr_mrr: editArr,
        pricing_plan: editPlan,
        seat_units_count: editSeats,
        contract_term_months: editTermMonths,
        probability_pct: editProbability,
        expected_close_date: editCloseDate || undefined,
        payment_terms: editPaymentTerms
      };
      const res = await api.updateOpportunityCommercials(selectedOpportunity.id, payload);
      inAppAlert.success(res.message || 'Negotiation commercial terms successfully updated.');
      setShowEditCommercialsModal(false);
      loadOpportunities();
    } catch (err: any) {
      inAppAlert.error(err?.message || 'Failed to update commercial terms.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdvanceToNegotiation = async () => {
    if (!selectedOpportunity) return;
    setSubmitting(true);
    try {
      const res = await api.transitionOpportunityToNegotiation(selectedOpportunity.id, advanceRationale);
      inAppAlert.success(res.message || 'Opportunity transitioned into Commercial Negotiation stage.');
      setShowAdvanceModal(false);
      loadOpportunities();
    } catch (err: any) {
      inAppAlert.error(err?.message || 'Failed to advance to negotiation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkWon = async () => {
    if (!selectedOpportunity) return;
    setSubmitting(true);
    try {
      const res = await api.markOpportunityWon(selectedOpportunity.id);
      inAppAlert.success(res.message || 'Deal Closed Won! Account promoted to Customer status.');
      setShowWonModal(false);
      loadOpportunities();
    } catch (err: any) {
      inAppAlert.error(err?.message || 'Failed to close deal as Won.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkLost = async () => {
    if (!selectedOpportunity) return;
    if (!lossCategory) {
      inAppAlert.warning('Loss reason category is required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.markOpportunityLost(selectedOpportunity.id, lossCategory, lossNotes, lossCompetitor);
      inAppAlert.success('Opportunity marked as Closed Lost and routed for PLD nurture.');
      setShowLostModal(false);
      setLossNotes('');
      setLossCompetitor('');
      loadOpportunities();
    } catch (err: any) {
      inAppAlert.error(err?.message || 'Failed to close deal as Lost.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter opportunities
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter(opp => {
      // Product Scope Filter
      if (selectedProductFilter !== 'ALL') {
        const matchesProduct = opp.product_code === selectedProductFilter || opp.product === selectedProductFilter;
        if (!matchesProduct) return false;
      }

      // Stage / Status Filter
      const isNegotiation = opp.stage_code === 'OPP_NEGOTIATION' || opp.stage_name?.includes('Negotiation');
      if (statusFilter === 'NEGOTIATION_ONLY' && !isNegotiation) return false;
      if (statusFilter === 'ALL_ACTIVE' && opp.status !== 'OPEN') return false;
      if (statusFilter === 'WON' && opp.status !== 'WON') return false;
      if (statusFilter === 'LOST' && opp.status !== 'LOST') return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const accMatch = opp.account_name?.toLowerCase().includes(q);
        const contactMatch = opp.primary_contact_name?.toLowerCase().includes(q);
        const prodMatch = opp.product_name?.toLowerCase().includes(q);
        const ownerMatch = opp.owner_name?.toLowerCase().includes(q);
        if (!accMatch && !contactMatch && !prodMatch && !ownerMatch) return false;
      }

      return true;
    });
  }, [opportunities, selectedProductFilter, statusFilter, searchQuery]);

  // Aggregate Metrics for Active Negotiations
  const negotiationMetrics = useMemo(() => {
    const negoList = opportunities.filter(o => o.stage_code === 'OPP_NEGOTIATION' || o.stage_name?.includes('Negotiation'));
    const totalPipelineValue = negoList.reduce((acc, o) => acc + (Number(o.total_contract_value) || 0), 0);
    const avgWinProb = negoList.length > 0
      ? Math.round(negoList.reduce((acc, o) => acc + (o.probability_pct ?? 50), 0) / negoList.length)
      : 0;
    const totalWon = opportunities.filter(o => o.status === 'WON').length;
    const totalClosed = opportunities.filter(o => o.status === 'WON' || o.status === 'LOST').length;
    const winRate = totalClosed > 0 ? Math.round((totalWon / totalClosed) * 100) : 0;

    return {
      activeNegotiationCount: negoList.length,
      totalPipelineValue,
      avgWinProb,
      totalWon,
      winRate
    };
  }, [opportunities]);

  const isCurrentInNegotiation = selectedOpportunity && (
    selectedOpportunity.stage_code === 'OPP_NEGOTIATION' ||
    selectedOpportunity.stage_name?.includes('Negotiation')
  );

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '100%' }}>
      {/* 1. Header & Stage Breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(245, 158, 11, 0.35)'
            }}>
              <Handshake size={22} color="#FFFFFF" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Commercial Negotiation Stage
              </h1>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Pipeline Pipeline Stage: <strong>PROPOSAL → NEGOTIATION → WON / LOST</strong>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn btn-outline"
            onClick={loadOpportunities}
            disabled={loading}
            style={{ fontSize: '0.82rem', padding: '8px 12px' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh Pipeline
          </button>
        </div>
      </div>

      {/* 2. Commercial KPI Metrics Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active In Negotiation</span>
            <Handshake size={16} color="var(--warning)" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {negotiationMetrics.activeNegotiationCount} <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>deals</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Under executive buyer review</div>
        </div>

        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Negotiation Contract Value</span>
            <DollarSign size={16} color="var(--success)" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--success)' }}>
            {negotiationMetrics.totalPipelineValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>USD</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pending commercial sign-off</div>
        </div>

        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Average Win Probability</span>
            <TrendingUp size={16} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>
            {negotiationMetrics.avgWinProb}%
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Weighted close confidence</div>
        </div>

        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Won Conversion Rate</span>
            <Award size={16} color="#10B981" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10B981' }}>
            {negotiationMetrics.winRate}%
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{negotiationMetrics.totalWon} deals closed won to date</div>
        </div>
      </div>

      {/* 3. Main Workspace Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left Side: Negotiation Deal Selector */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Deals In Pipeline ({filteredOpportunities.length})
            </div>

            {/* Status Filter Tabs */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface-elevated)', padding: '4px', borderRadius: '8px', marginBottom: '10px' }}>
              <button
                onClick={() => setStatusFilter('NEGOTIATION_ONLY')}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  border: 'none',
                  background: statusFilter === 'NEGOTIATION_ONLY' ? 'var(--primary)' : 'transparent',
                  color: statusFilter === 'NEGOTIATION_ONLY' ? '#FFFFFF' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                In Negotiation
              </button>
              <button
                onClick={() => setStatusFilter('ALL_ACTIVE')}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  border: 'none',
                  background: statusFilter === 'ALL_ACTIVE' ? 'var(--primary)' : 'transparent',
                  color: statusFilter === 'ALL_ACTIVE' ? '#FFFFFF' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                All Open
              </button>
              <button
                onClick={() => setStatusFilter('WON')}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  border: 'none',
                  background: statusFilter === 'WON' ? 'var(--primary)' : 'transparent',
                  color: statusFilter === 'WON' ? '#FFFFFF' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                Won
              </button>
              <button
                onClick={() => setStatusFilter('ALL')}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  border: 'none',
                  background: statusFilter === 'ALL' ? 'var(--primary)' : 'transparent',
                  color: statusFilter === 'ALL' ? '#FFFFFF' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                All
              </button>
            </div>

            {/* Search Input */}
            <input
              type="text"
              placeholder="Search by company, contact, or product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '7px 10px',
                fontSize: '0.78rem',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          {/* Deal Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredOpportunities.length === 0 ? (
              <div style={{ padding: '28px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No opportunities found matching filter.
              </div>
            ) : (
              filteredOpportunities.map(opp => {
                const isSelected = selectedOpportunity?.id === opp.id;
                const isNego = opp.stage_code === 'OPP_NEGOTIATION' || opp.stage_name?.includes('Negotiation');
                return (
                  <div
                    key={opp.id}
                    onClick={() => {
                      setSelectedOpportunity(opp);
                      loadOpportunityContext(opp.id);
                    }}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                      background: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {opp.account_name}
                      </div>
                      <span className={`badge ${
                        opp.status === 'WON' ? 'badge-success' :
                        opp.status === 'LOST' ? 'badge-danger' :
                        isNego ? 'badge-warning' : 'badge-neutral'
                      }`} style={{ fontSize: '0.65rem' }}>
                        {opp.status === 'WON' ? 'CLOSED WON' :
                         opp.status === 'LOST' ? 'CLOSED LOST' :
                         isNego ? 'NEGOTIATING' : (opp.stage_name || 'OPEN')}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      {opp.product_name || 'Multi-Product'} • {opp.primary_contact_name || 'No Primary Contact'}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--success)' }}>
                        {opp.currency || 'USD'} {Number(opp.total_contract_value).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Prob: <span style={{ color: 'var(--primary)' }}>{opp.probability_pct ?? 50}%</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Detailed Negotiation Command Center */}
        {selectedOpportunity ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Top Deal Banner */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2
                      onClick={() => onNavigateToAccount && onNavigateToAccount(selectedOpportunity.account)}
                      style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, cursor: onNavigateToAccount ? 'pointer' : 'default' }}
                      title={onNavigateToAccount ? 'View in Account 360' : undefined}
                    >
                      {selectedOpportunity.account_name}
                    </h2>
                    {onNavigateToAccount && (
                      <button
                        className="btn btn-outline"
                        onClick={() => onNavigateToAccount(selectedOpportunity.account)}
                        style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                        title="View Account 360"
                      >
                        <Building size={12} />
                        Account 360
                      </button>
                    )}
                    <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                      {selectedOpportunity.product_name || 'VanForces Suite'}
                    </span>
                    <span className={`badge ${
                      selectedOpportunity.status === 'WON' ? 'badge-success' :
                      selectedOpportunity.status === 'LOST' ? 'badge-danger' :
                      isCurrentInNegotiation ? 'badge-warning' : 'badge-neutral'
                    }`}>
                      {selectedOpportunity.status === 'WON' ? 'Closed Won' :
                       selectedOpportunity.status === 'LOST' ? 'Closed Lost' :
                       isCurrentInNegotiation ? 'Commercial Negotiation Stage' : (selectedOpportunity.stage_name || 'In Progress')}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Deal Owner: <strong>{selectedOpportunity.owner_name || 'Sales Representative'}</strong> • 
                    Type: <strong>{selectedOpportunity.opportunity_type || 'NEW BUSINESS'}</strong> • 
                    Target Close Date: <strong>{selectedOpportunity.expected_close_date || 'Not set'}</strong>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {!isCurrentInNegotiation && selectedOpportunity.status === 'OPEN' && (
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowAdvanceModal(true)}
                      style={{ background: 'var(--warning)', borderColor: 'var(--warning)', fontSize: '0.82rem' }}
                    >
                      <ArrowRight size={15} />
                      Advance to Negotiation
                    </button>
                  )}

                  {selectedOpportunity.status === 'OPEN' && (
                    <>
                      <button
                        className="btn btn-outline"
                        onClick={() => handleOpenEditCommercials(selectedOpportunity)}
                        style={{ fontSize: '0.82rem' }}
                      >
                        <Edit3 size={15} />
                        Update Commercials
                      </button>

                      <button
                        className="btn btn-outline"
                        onClick={() => setShowLostModal(true)}
                        style={{ color: 'var(--error)', borderColor: 'var(--error)', fontSize: '0.82rem' }}
                      >
                        <XCircle size={15} />
                        Mark Lost
                      </button>

                      <button
                        className="btn btn-primary"
                        onClick={() => setShowWonModal(true)}
                        style={{ background: '#10B981', borderColor: '#10B981', fontSize: '0.82rem' }}
                      >
                        <Award size={15} />
                        Close Deal (Won)
                      </button>
                    </>
                  )}

                  <button
                    className="btn btn-primary"
                    onClick={() => setShowInvoiceModal(true)}
                    style={{
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      borderColor: '#047857',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)'
                    }}
                    title="Print the final commercial tax invoice after negotiation"
                  >
                    <Printer size={15} />
                    Print Final Invoice
                  </button>

                  {onNavigateToProposal && (
                    <button
                      className="btn btn-outline"
                      onClick={() => onNavigateToProposal(selectedOpportunity.id)}
                      style={{ fontSize: '0.82rem' }}
                    >
                      <FileText size={15} />
                      Proposal Workspace
                    </button>
                  )}
                </div>
              </div>

              {/* Commercial High-Level Snapshot Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', background: 'var(--bg-surface-elevated)', padding: '14px', borderRadius: '10px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>TOTAL CONTRACT VALUE</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--success)', marginTop: '2px' }}>
                    {selectedOpportunity.currency} {Number(selectedOpportunity.total_contract_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>ARR / MRR</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {selectedOpportunity.currency} {Number(selectedOpportunity.arr || selectedOpportunity.arr_mrr || 0).toLocaleString()} / yr
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>SEATS / LICENSES</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {selectedOpportunity.seat_units_count || 1} units ({selectedOpportunity.contract_term_months || 12} mo)
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>WIN PROBABILITY</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>
                    {selectedOpportunity.probability_pct ?? 70}%
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>LINKED PROPOSALS</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {proposals.length} versions issued
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Sub-Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
              <button
                className={`btn ${activeTab === 'COMMERCIALS' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveTab('COMMERCIALS')}
                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
              >
                <DollarSign size={14} />
                Commercial Terms &amp; Pricing
              </button>

              <button
                className={`btn ${activeTab === 'CONCESSIONS' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveTab('CONCESSIONS')}
                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
              >
                <Tag size={14} />
                Proposal Concessions &amp; Versions ({proposals.length})
              </button>

              <button
                className={`btn ${activeTab === 'OBJECTIONS' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveTab('OBJECTIONS')}
                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
              >
                <ShieldCheck size={14} />
                Buying Committee &amp; Scope
              </button>

              <button
                className={`btn ${activeTab === 'ACTIVITIES' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveTab('ACTIVITIES')}
                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
              >
                <MessageSquare size={14} />
                Negotiation Activity Log
              </button>

              <button
                className={`btn ${activeTab === 'AUDIT' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveTab('AUDIT')}
                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
              >
                <History size={14} />
                Stage Audit Trail ({stageHistories.length})
              </button>
            </div>

            {/* TAB 1: COMMERCIAL TERMS & PRICING */}
            {activeTab === 'COMMERCIALS' && (
              <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Commercial Contract Terms Breakdown
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Adjust negotiated price point, licensing structure, payment milestones, and revenue allocation.
                    </p>
                  </div>
                  <button
                    className="btn btn-outline"
                    onClick={() => handleOpenEditCommercials(selectedOpportunity)}
                    style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  >
                    <Edit3 size={14} />
                    Edit Terms
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  <div style={{ padding: '14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>PRICING PLAN &amp; MODEL</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                      {selectedOpportunity.pricing_plan || 'Enterprise Tier Subscription'}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Currency: {selectedOpportunity.currency}
                    </div>
                  </div>

                  <div style={{ padding: '14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>CONTRACT DURATION</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                      {selectedOpportunity.contract_term_months || 12} Months Commitment
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Annual license with renewal clause
                    </div>
                  </div>

                  <div style={{ padding: '14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>DEPLOYMENT SEAT VOLUME</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                      {selectedOpportunity.seat_units_count || 1} Registered Devices / Users
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Per seat unit metric
                    </div>
                  </div>

                  <div style={{ padding: '14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>EXPECTED CLOSE DATE</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                      {selectedOpportunity.expected_close_date || 'Pending Schedule'}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Commercial SLA target
                    </div>
                  </div>
                </div>

                {/* Multi-Product Line Items if Present */}
                {selectedOpportunity.product_lines && selectedOpportunity.product_lines.length > 0 && (
                  <div>
                    <h4 style={{ margin: '8px 0 6px 0', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Product Scope Line Items
                    </h4>
                    <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '6px 8px' }}>Product</th>
                          <th style={{ padding: '6px 8px' }}>Quantity</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOpportunity.product_lines.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '8px', fontWeight: 600 }}>{item.product_name}</td>
                            <td style={{ padding: '8px' }}>{item.quantity}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                              {selectedOpportunity.currency} {Number(item.total_amount).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: PROPOSAL CONCESSIONS & VERSIONS */}
            {activeTab === 'CONCESSIONS' && (
              <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Proposal Revisions &amp; Concession History
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Track negotiated price modifications, discount justifications, and internal governance approvals.
                    </p>
                  </div>

                  {onNavigateToProposal && (
                    <button
                      className="btn btn-primary"
                      onClick={() => onNavigateToProposal(selectedOpportunity.id)}
                      style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                    >
                      <Plus size={14} />
                      Issue Revised Proposal
                    </button>
                  )}
                </div>

                {proposals.length === 0 ? (
                  <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No proposal records linked to this opportunity yet.
                    {onNavigateToProposal && (
                      <div style={{ marginTop: '8px' }}>
                        <button className="btn btn-outline" onClick={() => onNavigateToProposal(selectedOpportunity.id)} style={{ fontSize: '0.78rem' }}>
                          Draft Initial Proposal
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {proposals.map(prop => (
                      <div
                        key={prop.id}
                        style={{
                          padding: '16px',
                          background: 'var(--bg-surface)',
                          borderRadius: '8px',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                              {prop.proposal_number || 'Proposal'} • {prop.title || 'Standard Commercial Quotation'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Version: <strong>v{prop.version_number}</strong> • Created: {new Date(prop.created_at).toLocaleDateString()}
                            </div>
                          </div>

                          <span className={`badge ${
                            prop.status === 'ACCEPTED' ? 'badge-success' :
                            prop.status === 'APPROVED' ? 'badge-info' :
                            prop.status === 'SENT' ? 'badge-primary' :
                            prop.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'
                          }`}>
                            {prop.status}
                          </span>
                        </div>

                        {/* Financial Snapshot */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '0.78rem', background: 'var(--bg-surface-elevated)', padding: '10px 14px', borderRadius: '6px' }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Gross Amount:</span>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                              {prop.currency} {Number(prop.gross_amount).toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Negotiated Discount:</span>
                            <div style={{ fontWeight: 700, color: Number(prop.discount_amount) > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
                              {prop.discount_pct}% (-{prop.currency} {Number(prop.discount_amount).toLocaleString()})
                            </div>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>VAT / Tax:</span>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                              {prop.tax_pct}% (+{prop.currency} {Number(prop.tax_amount).toLocaleString()})
                            </div>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Final Net Quote:</span>
                            <div style={{ fontWeight: 800, color: 'var(--success)' }}>
                              {prop.currency} {Number(prop.net_amount).toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {prop.discount_reason && (
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', background: 'rgba(245, 158, 11, 0.08)', padding: '8px 12px', borderRadius: '6px' }}>
                            <strong>Concession Rationale:</strong> {prop.discount_reason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: BUYING COMMITTEE & SCOPE */}
            {activeTab === 'OBJECTIONS' && (
              <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Buying Committee &amp; Carried-Forward Technical Fit
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                  <div style={{ padding: '14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>ECONOMIC DECISION MAKER</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                      {selectedOpportunity.decision_maker || selectedOpportunity.primary_contact_name || 'Designated CFO / MD'}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Authorized financial signatory
                    </div>
                  </div>

                  <div style={{ padding: '14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>ERP BACKEND SYSTEM</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                      {selectedOpportunity.erp_system || 'Standard REST API / None Specified'}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Customer host enterprise system
                    </div>
                  </div>
                </div>

                {selectedOpportunity.implementation_scope && (
                  <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Agreed Implementation Scope</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{selectedOpportunity.implementation_scope}</div>
                  </div>
                )}

                {selectedOpportunity.poc_result && (
                  <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Carried-Forward POC / Pilot Result</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{selectedOpportunity.poc_result}</div>
                  </div>
                )}

                {selectedOpportunity.competitor && (
                  <div style={{ padding: '12px 14px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', border: '1px solid var(--error)', fontSize: '0.8rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--error)', marginBottom: '2px' }}>Competitor In Play</div>
                    <div style={{ color: 'var(--text-primary)' }}>{selectedOpportunity.competitor}</div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: NEGOTIATION ACTIVITIES & TIMELINE */}
            {activeTab === 'ACTIVITIES' && (
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Commercial Negotiation Meeting History &amp; Actions
                </h3>
                <UnifiedActivityTimeline
                  entityType="opportunity"
                  entityId={selectedOpportunity.id}
                  entityName={selectedOpportunity.account_name}
                  onActivityLogged={() => loadOpportunities()}
                />
              </div>
            )}

            {/* TAB 5: STAGE TRANSITION AUDIT TRAIL */}
            {activeTab === 'AUDIT' && (
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Stage History &amp; Transition Audit Trail
                </h3>
                {stageHistories.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No stage transitions recorded yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {stageHistories.map((hist, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '12px 16px',
                          background: 'var(--bg-surface)',
                          borderRadius: '8px',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                              {hist.from_stage || 'NEW'} → {hist.to_stage || 'IN PROGRESS'}
                            </span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {hist.changed_by || 'Commercial Sales User'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {hist.transition_reason || 'Normal progression in commercial pipeline.'}
                          </div>
                        </div>

                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                          <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          {new Date(hist.changed_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Handshake size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Select an Opportunity</div>
            <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
              Choose a deal from the left pipeline list to manage terms, concessions, and closure.
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: ADVANCE TO NEGOTIATION */}
      {showAdvanceModal && selectedOpportunity && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '480px', width: '100%', margin: 'auto', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Handshake size={20} color="var(--warning)" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Advance to Commercial Negotiation
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowAdvanceModal(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-scroll-body" style={{ padding: '20px 24px', overflowY: 'auto', flex: '1 1 auto' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px', marginTop: 0 }}>
                Moving <strong>{selectedOpportunity.account_name}</strong> into the formal Commercial Negotiation stage locks in baseline terms and enables concession tracking.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Transition Rationale &amp; Key Focus Areas
                </label>
                <textarea
                  rows={3}
                  value={advanceRationale}
                  onChange={(e) => setAdvanceRationale(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    fontSize: '0.82rem',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-surface-elevated)' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowAdvanceModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleAdvanceToNegotiation} disabled={submitting}>
                {submitting ? 'Advancing...' : 'Confirm Stage Entry'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: EDIT COMMERCIAL TERMS */}
      {showEditCommercialsModal && selectedOpportunity && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '540px', width: '100%', margin: 'auto', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Edit3 size={20} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Update Negotiated Commercial Terms
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowEditCommercialsModal(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCommercials} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, margin: 0 }}>
              <div className="modal-scroll-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: '1 1 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Total Contract Value (TCV) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editTcv}
                      onChange={(e) => setEditTcv(Number(e.target.value))}
                      style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Annual Recurring (ARR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editArr}
                      onChange={(e) => setEditArr(Number(e.target.value))}
                      style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Seat Units / Licenses
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editSeats}
                      onChange={(e) => setEditSeats(Number(e.target.value))}
                      style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Term (Months)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editTermMonths}
                      onChange={(e) => setEditTermMonths(Number(e.target.value))}
                      style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Win Probability (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editProbability}
                      onChange={(e) => setEditProbability(Number(e.target.value))}
                      style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Target Close Date
                    </label>
                    <input
                      type="date"
                      value={editCloseDate}
                      onChange={(e) => setEditCloseDate(e.target.value)}
                      style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Pricing Plan Descriptor
                  </label>
                  <input
                    type="text"
                    value={editPlan}
                    onChange={(e) => setEditPlan(e.target.value)}
                    placeholder="e.g. Enterprise Tier with Custom Connectors"
                    style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Negotiated Payment Terms
                  </label>
                  <input
                    type="text"
                    value={editPaymentTerms}
                    onChange={(e) => setEditPaymentTerms(e.target.value)}
                    placeholder="e.g. Net 30 Days, 50% Advance / 50% Go-Live"
                    style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-surface-elevated)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowEditCommercialsModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Commercial Terms'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 3: MARK CLOSED WON */}
      {showWonModal && selectedOpportunity && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '480px', width: '100%', margin: 'auto', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Award size={22} color="#10B981" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Close Deal as WON
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowWonModal(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-scroll-body" style={{ padding: '20px 24px', overflowY: 'auto', flex: '1 1 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10B981',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px'
                }}>
                  <Award size={32} />
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Marking <strong>{selectedOpportunity.account_name}</strong> as Won will finalize the contract and convert the account to official <strong>Customer</strong> status.
                </p>
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: '14px', borderRadius: '8px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Final Contract Value:</span>
                  <span style={{ fontWeight: 800, color: '#10B981' }}>
                    {selectedOpportunity.currency} {Number(selectedOpportunity.total_contract_value).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Product Scope:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedOpportunity.product_name}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Customer Onboarding:</span>
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>Automated Account Promotion</span>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-surface-elevated)' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowWonModal(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleMarkWon}
                disabled={submitting}
                style={{ background: '#10B981', borderColor: '#10B981' }}
              >
                {submitting ? 'Closing Won...' : 'Confirm Closed Won'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 4: MARK CLOSED LOST */}
      {showLostModal && selectedOpportunity && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '500px', width: '100%', margin: 'auto', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <XCircle size={20} color="var(--error)" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Mark Opportunity as Closed Lost
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowLostModal(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-scroll-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: '1 1 auto' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                Mandatory loss categorization ensures root cause feedback feeds into product capability development and marketing nurture.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Loss Reason Category *
                </label>
                <select
                  value={lossCategory}
                  onChange={(e) => setLossCategory(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                >
                  <option value="PRICE_BUDGET">Price / Budget Constraints (Too Expensive)</option>
                  <option value="COMPETITOR_CHOSEN">Competitor Selected</option>
                  <option value="PROJECT_POSTPONED">Project Postponed / Timing Stalled</option>
                  <option value="PRODUCT_GAP">Product Capability Gap / Missing Feature</option>
                  <option value="LEADERSHIP_DECISION">Executive / Leadership Disapproval</option>
                  <option value="PROCUREMENT_LEGAL">Procurement / Legal Terms Block</option>
                </select>
              </div>

              {lossCategory === 'COMPETITOR_CHOSEN' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Winning Competitor Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SAP S/4HANA, Geotab, FleetComplete"
                    value={lossCompetitor}
                    onChange={(e) => setLossCompetitor(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Detailed Loss Rationale &amp; PLD Learnings
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain buyer objections, feedback on pricing, and nurture follow-up timeline..."
                  value={lossNotes}
                  onChange={(e) => setLossNotes(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-surface-elevated)' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowLostModal(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleMarkLost}
                disabled={submitting}
                style={{ background: 'var(--error)', borderColor: 'var(--error)' }}
              >
                {submitting ? 'Recording...' : 'Confirm Closed Lost'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Final Commercial Invoice Modal (Print Ready) */}
      <CommercialInvoiceModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        opportunity={selectedOpportunity}
        proposal={proposals.length > 0 ? proposals[0] : null}
      />
    </div>
  );
};
