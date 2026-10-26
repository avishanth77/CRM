import React, { useState, useEffect } from 'react';
import {
  User, TrendingUp, CheckCircle2, Clock, ShieldCheck, RefreshCw,
  Edit3, Activity as ActivityIcon, AlertCircle, Layers, History, Award, FileText, Handshake, Printer
} from 'lucide-react';
import { api } from '../services/api';
import type { Opportunity } from '../services/api';
import { UnifiedActivityTimeline } from './UnifiedActivityTimeline';
import { Modal } from './common/Modal';
import { CommercialInvoiceModal } from './CommercialInvoiceModal';

interface OpportunityWorkspaceProps {
  initialOpportunityId?: string;
  onNavigateToAccount?: (accountId: string) => void;
  onNavigateToProposal?: (oppId: string) => void;
  onNavigateToNegotiation?: (oppId: string) => void;
}

export const OpportunityWorkspace: React.FC<OpportunityWorkspaceProps> = ({
  initialOpportunityId,
  onNavigateToAccount,
  onNavigateToProposal,
  onNavigateToNegotiation
}) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [stageHistories, setStageHistories] = useState<any[]>([]);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Commercials Modal State
  const [isEditingCommercials, setIsEditingCommercials] = useState(false);
  const [editValue, setEditValue] = useState<number>(0);
  const [editArr, setEditArr] = useState<number>(0);
  const [editMrr, setEditMrr] = useState<number>(0);
  const [editPlan, setEditPlan] = useState<string>('');
  const [editSeats, setEditSeats] = useState<number>(1);
  const [editTerm, setEditTerm] = useState<number>(12);
  const [editProb, setEditProb] = useState<number>(50);
  const [editCloseDate, setEditCloseDate] = useState<string>('');
  const [savingCommercials, setSavingCommercials] = useState(false);

  // Stage Transition Modal State
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [availableStages, setAvailableStages] = useState<any[]>([]);
  const [targetStageId, setTargetStageId] = useState<string>('');
  const [transitionReason, setTransitionReason] = useState<string>('');
  const [transitioning, setTransitioning] = useState(false);

  // New Activity State
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityType, setActivityType] = useState('MEETING');
  const [activitySubject, setActivitySubject] = useState('');
  const [activityOutcome, setActivityOutcome] = useState('');
  const [nextActionDesc, setNextActionDesc] = useState('');
  const [nextActionDue, setNextActionDue] = useState('');
  const [loggingActivity, setLoggingActivity] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ACTIVITIES' | 'HISTORY'>('OVERVIEW');

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const res = await api.getOpportunities();
      const list = res.results || [];
      setOpportunities(list);

      if (initialOpportunityId) {
        const found = list.find((o) => o.id === initialOpportunityId);
        if (found) setSelectedOpportunity(found);
        else if (list.length > 0) setSelectedOpportunity(list[0]);
      } else if (!selectedOpportunity && list.length > 0) {
        setSelectedOpportunity(list[0]);
      } else if (selectedOpportunity) {
        const refreshed = list.find((o) => o.id === selectedOpportunity.id);
        if (refreshed) setSelectedOpportunity(refreshed);
      }
    } catch (err: any) {
      console.error('Failed to load opportunities', err);
      setFeedbackMsg({ type: 'error', text: err?.message || 'Error loading opportunities.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, [initialOpportunityId]);

  useEffect(() => {
    if (initialOpportunityId && opportunities.length > 0) {
      const found = opportunities.find((o) => o.id === initialOpportunityId);
      if (found) {
        setSelectedOpportunity(found);
      }
    }
  }, [initialOpportunityId, opportunities]);

  const fetchOpportunityDetails = async (oppId: string) => {
    try {
      const [acts, hist] = await Promise.all([
        api.getOpportunityActivities(oppId),
        api.getOpportunityHistory(oppId)
      ]);
      setActivities(acts || []);
      setStageHistories(hist || []);
    } catch (err) {
      console.error('Failed to load opportunity activities/history', err);
    }
  };

  useEffect(() => {
    if (selectedOpportunity) {
      setEditValue(Number(selectedOpportunity.total_contract_value));
      setEditArr(Number(selectedOpportunity.arr));
      setEditMrr(Number(selectedOpportunity.mrr));
      setEditPlan(selectedOpportunity.pricing_plan || '');
      setEditSeats(selectedOpportunity.seat_units_count || 1);
      setEditTerm(selectedOpportunity.contract_term_months || 12);
      setEditProb(selectedOpportunity.probability_pct || 50);
      setEditCloseDate(selectedOpportunity.expected_close_date || '');

      fetchOpportunityDetails(selectedOpportunity.id);
    }
  }, [selectedOpportunity?.id]);

  const handleSaveCommercials = async () => {
    if (!selectedOpportunity) return;
    setSavingCommercials(true);
    try {
      const updated = await api.updateOpportunity(selectedOpportunity.id, {
        total_contract_value: editValue,
        arr: editArr,
        mrr: editMrr,
        pricing_plan: editPlan,
        seat_units_count: editSeats,
        contract_term_months: editTerm,
        probability_pct: editProb,
        expected_close_date: editCloseDate || undefined
      });
      setSelectedOpportunity(updated);
      setIsEditingCommercials(false);
      setFeedbackMsg({ type: 'success', text: 'Commercial contract details updated successfully.' });
      fetchOpportunities();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to update commercials.' });
    } finally {
      setSavingCommercials(false);
    }
  };

  const handleTransitionStage = async () => {
    if (!selectedOpportunity || !targetStageId) return;
    setTransitioning(true);
    try {
      const res = await api.transitionOpportunityStage(selectedOpportunity.id, {
        target_stage_id: targetStageId,
        transition_reason: transitionReason.trim()
      });
      setSelectedOpportunity(res.opportunity);
      setShowTransitionModal(false);
      setTransitionReason('');
      setFeedbackMsg({ type: 'success', text: res.message || 'Stage transitioned successfully.' });
      fetchOpportunities();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.error || err?.message || 'Stage transition failed.' });
    } finally {
      setTransitioning(false);
    }
  };

  const handleLogActivity = async () => {
    if (!selectedOpportunity) return;
    if (!activitySubject.trim() || !nextActionDesc.trim() || !nextActionDue) {
      setFeedbackMsg({ type: 'error', text: 'Activity subject, mandatory next action, and due date are required.' });
      return;
    }
    setLoggingActivity(true);
    try {
      await api.logOpportunityActivity(selectedOpportunity.id, {
        activity_type: activityType,
        subject: activitySubject.trim(),
        outcome_notes: activityOutcome.trim(),
        next_action_description: nextActionDesc.trim(),
        next_action_due_at: nextActionDue ? new Date(nextActionDue).toISOString() : undefined
      });
      setShowActivityModal(false);
      setActivitySubject('');
      setActivityOutcome('');
      setNextActionDesc('');
      setNextActionDue('');
      setFeedbackMsg({ type: 'success', text: 'Commercial activity logged and next action SLA updated.' });
      fetchOpportunities();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to log activity.' });
    } finally {
      setLoggingActivity(false);
    }
  };

  const handleMarkWon = async () => {
    if (!selectedOpportunity) return;
    try {
      const res = await api.markOpportunityWon(selectedOpportunity.id);
      setSelectedOpportunity(res.opportunity);
      setFeedbackMsg({ type: 'success', text: 'Deal CLOSED WON! Customer Account Product relationship established.' });
      fetchOpportunities();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to mark opportunity won.' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header & Selector Banner */}
      <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid var(--accent-purple)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={28} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                  Commercial Opportunity Workspace
                </h1>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                Manage enterprise deals created from accepted SQLs, track ARR/MRR commercials, and execute pipeline stages.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Opportunity:
            </label>
            <select
              value={selectedOpportunity?.id || ''}
              onChange={(e) => {
                const opp = opportunities.find((o) => o.id === e.target.value);
                if (opp) setSelectedOpportunity(opp);
              }}
              className="form-select"
              style={{ minWidth: '280px', fontSize: '0.82rem', padding: '8px 12px' }}
            >
              {opportunities.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.account_name} — {Number(o.total_contract_value).toLocaleString()} {o.currency} ({o.status})
                </option>
              ))}
            </select>

            <button
              onClick={fetchOpportunities}
              className="btn btn-secondary"
              style={{ padding: '8px 12px' }}
              title="Refresh Opportunities"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className="glass-panel"
          style={{
            padding: '14px 18px',
            background: feedbackMsg.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
            border: `1px solid ${feedbackMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 size={18} color="var(--success)" />
            ) : (
              <AlertCircle size={18} color="var(--danger)" />
            )}
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: feedbackMsg.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
              {feedbackMsg.text}
            </span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {selectedOpportunity ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Main Deal Summary Banner */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent-purple)', letterSpacing: '0.05em' }}>
                    OPPORTUNITY #{selectedOpportunity.id.substring(0, 8)}
                  </span>
                  <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>
                    {selectedOpportunity.opportunity_type}
                  </span>
                  <span
                    className={`badge ${
                      selectedOpportunity.status === 'WON'
                        ? 'badge-success'
                        : selectedOpportunity.status === 'LOST'
                        ? 'badge-danger'
                        : 'badge-info'
                    }`}
                  >
                    {selectedOpportunity.status}
                  </span>
                </div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {selectedOpportunity.account_name}
                  {onNavigateToAccount && (
                    <button
                      onClick={() => onNavigateToAccount(selectedOpportunity.account)}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      (View Account 360)
                    </button>
                  )}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <User size={14} />
                    Owner: <strong style={{ color: 'var(--text-primary)' }}>{selectedOpportunity.owner_name || 'Sales AE'}</strong>
                  </span>
                  <span>•</span>
                  <span>Primary Product: <strong style={{ color: 'var(--primary)' }}>{selectedOpportunity.product_name}</strong></span>
                  <span>•</span>
                  <span>Stage: <strong style={{ color: 'var(--accent-purple)' }}>{selectedOpportunity.stage_name || 'Open Pipeline'}</strong></span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  onClick={() => setIsEditingCommercials(true)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem' }}
                >
                  <Edit3 size={14} />
                  Edit Commercials
                </button>

                <button
                  onClick={() => {
                    setShowTransitionModal(true);
                    if (availableStages.length === 0) {
                      api.getPipelineStages().then(res => setAvailableStages(res.results || [])).catch(() => {});
                    }
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem' }}
                >
                  <Clock size={14} />
                  Advance Stage
                </button>

                {onNavigateToProposal && (
                  <button
                    onClick={() => onNavigateToProposal(selectedOpportunity.id)}
                    className="btn btn-primary"
                    style={{ fontSize: '0.82rem' }}
                  >
                    <FileText size={14} />
                    Commercial Proposal &amp; Approvals
                  </button>
                )}

                {onNavigateToNegotiation && (
                  <button
                    onClick={() => onNavigateToNegotiation(selectedOpportunity.id)}
                    className="btn btn-primary"
                    style={{ fontSize: '0.82rem', background: '#F59E0B', borderColor: '#F59E0B' }}
                  >
                    <Handshake size={14} />
                    Negotiation Stage
                  </button>
                )}

                <button
                  onClick={() => setShowInvoiceModal(true)}
                  className="btn btn-primary"
                  style={{
                    fontSize: '0.82rem',
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    borderColor: '#047857',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)'
                  }}
                  title="Print Final Commercial Tax Invoice"
                >
                  <Printer size={14} />
                  Print Final Invoice
                </button>

                {selectedOpportunity.status === 'OPEN' && (
                  <button
                    onClick={handleMarkWon}
                    className="btn btn-primary"
                    style={{
                      fontSize: '0.82rem',
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      boxShadow: '0 2px 10px rgba(16, 185, 129, 0.25)'
                    }}
                  >
                    <Award size={14} />
                    Close Won Deal
                  </button>
                )}
              </div>
            </div>

            {/* Commercial Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: '12px',
                  background: 'rgba(139, 92, 246, 0.08)',
                  border: '1px solid rgba(139, 92, 246, 0.25)'
                }}
              >
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-purple)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                  TOTAL CONTRACT VALUE
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', margin: '4px 0 2px', display: 'block' }}>
                  {Number(selectedOpportunity.total_contract_value).toLocaleString()} {selectedOpportunity.currency}
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Term: {selectedOpportunity.contract_term_months} months
                </span>
              </div>

              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: '12px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                  ARR (ANNUAL REVENUE)
                </span>
                <span style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', margin: '4px 0 2px', display: 'block' }}>
                  {Number(selectedOpportunity.arr).toLocaleString()} {selectedOpportunity.currency}
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  MRR: {Number(selectedOpportunity.mrr).toLocaleString()} {selectedOpportunity.currency}
                </span>
              </div>

              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: '12px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                  SEATS / UNITS
                </span>
                <span style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', margin: '4px 0 2px', display: 'block' }}>
                  {selectedOpportunity.seat_units_count} Units
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Plan: {selectedOpportunity.pricing_plan || 'Standard'}
                </span>
              </div>

              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: '12px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                  WIN PROBABILITY &amp; CLOSE
                </span>
                <span style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--accent-cyan)', margin: '4px 0 2px', display: 'block' }}>
                  {selectedOpportunity.probability_pct}%
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Close Date: {selectedOpportunity.expected_close_date || 'Unscheduled'}
                </span>
              </div>
            </div>

            {/* Next Action Priority Banner */}
            <div
              style={{
                padding: '14px 18px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                fontSize: '0.82rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FDE68A' }}>
                <Clock size={16} color="var(--warning)" />
                <span>
                  <strong>NEXT COMMERCIAL ACTION:</strong>{' '}
                  {selectedOpportunity.next_action_description || 'No action scheduled'}
                </span>
              </div>
              <div style={{ color: 'var(--warning)', fontWeight: 700 }}>
                Due: {selectedOpportunity.next_activity_due_at ? new Date(selectedOpportunity.next_activity_due_at).toLocaleDateString() : 'Pending'}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
            <button
              onClick={() => setActiveTab('OVERVIEW')}
              style={{
                padding: '10px 18px',
                borderRadius: '8px 8px 0 0',
                background: activeTab === 'OVERVIEW' ? 'var(--bg-surface)' : 'transparent',
                color: activeTab === 'OVERVIEW' ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: 'none',
                borderBottom: activeTab === 'OVERVIEW' ? '2px solid var(--accent-purple)' : '2px solid transparent',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Deal Context &amp; Architecture
            </button>
            <button
              onClick={() => setActiveTab('ACTIVITIES')}
              style={{
                padding: '10px 18px',
                borderRadius: '8px 8px 0 0',
                background: activeTab === 'ACTIVITIES' ? 'var(--bg-surface)' : 'transparent',
                color: activeTab === 'ACTIVITIES' ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: 'none',
                borderBottom: activeTab === 'ACTIVITIES' ? '2px solid var(--accent-purple)' : '2px solid transparent',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <ActivityIcon size={14} />
              Activities ({activities.length})
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              style={{
                padding: '10px 18px',
                borderRadius: '8px 8px 0 0',
                background: activeTab === 'HISTORY' ? 'var(--bg-surface)' : 'transparent',
                color: activeTab === 'HISTORY' ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: 'none',
                borderBottom: activeTab === 'HISTORY' ? '2px solid var(--accent-purple)' : '2px solid transparent',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <History size={14} />
              Stage History &amp; Audit
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Carried Forward PLD & Technical Evaluation Details */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px' }}>
                  <ShieldCheck size={18} color="var(--success)" />
                  Carried-Forward Evaluation Context
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>PLD Fit Score</span>
                    <span style={{ fontWeight: 800, color: 'var(--success)' }}>
                      {selectedOpportunity.pld_score || '85.0'} / 100
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>SQL Handoff Accepted Date</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {selectedOpportunity.sql_date || 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Economic Decision Maker</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {selectedOpportunity.decision_maker || 'Confirmed during Discovery'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Primary ERP System</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {selectedOpportunity.erp_system || 'SAP S/4HANA'}
                    </span>
                  </div>
                  <div style={{ paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>POC / Trial Outcome:</span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {selectedOpportunity.poc_result || 'Completed verification benchmarks on file'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Implementation Scope:</span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {selectedOpportunity.implementation_scope || 'Standard multi-branch rollout'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Product Modules & Capabilities Relationships */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px' }}>
                  <Layers size={18} color="var(--primary)" />
                  Product Modules &amp; Scope Committed
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedOpportunity.selected_modules && selectedOpportunity.selected_modules.length > 0 ? (
                    selectedOpportunity.selected_modules.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '8px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.82rem'
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
                            {m.module_name}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.notes || m.module_code}</span>
                        </div>
                        <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>
                          Included
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-surface)', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      Primary Core Module auto-assigned from VanForces suite.
                    </div>
                  )}

                  {selectedOpportunity.required_capabilities && selectedOpportunity.required_capabilities.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                        Mapped Capabilities
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {selectedOpportunity.required_capabilities.map((c) => (
                          <span
                            key={c.id}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              background: 'rgba(59, 130, 246, 0.1)',
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                              color: 'var(--primary)',
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}
                          >
                            {c.capability_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ACTIVITIES */}
          {activeTab === 'ACTIVITIES' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowActivityModal(true)}
                  className="btn btn-primary"
                  style={{ fontSize: '0.82rem' }}
                >
                  <ActivityIcon size={14} />
                  Log Commercial Activity
                </button>
              </div>

              <UnifiedActivityTimeline
                entityType="opportunity"
                entityId={selectedOpportunity.id}
                entityName={selectedOpportunity.account_name}
                onActivityLogged={() => {
                  fetchOpportunities();
                }}
              />
            </div>
          )}

          {/* TAB 3: STAGE HISTORY & AUDIT */}
          {activeTab === 'HISTORY' && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px' }}>
                Immutable Stage Progression History
              </h3>

              {stageHistories.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No stage transition history on record.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {stageHistories.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '10px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.82rem'
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 800, color: 'var(--text-primary)', display: 'block' }}>
                          {h.from_stage || 'Initiated'} → {h.to_stage}
                        </span>
                        <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: '0.78rem' }}>{h.transition_reason || 'Standard progression'}</p>
                      </div>
                      <div style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        <div>{new Date(h.changed_at).toLocaleString()}</div>
                        <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>By: {h.changed_by}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <TrendingUp size={44} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            No Commercial Opportunities Found
          </h3>
          <p style={{ maxWidth: '480px', margin: '0 auto', fontSize: '0.88rem' }}>
            Complete and accept an SQL Handoff in the SQL Readiness workspace to automatically initialize a Commercial Opportunity.
          </p>
        </div>
      )}

      {/* Edit Commercials Modal */}
      <Modal
        isOpen={isEditingCommercials}
        onClose={() => setIsEditingCommercials(false)}
        title="Edit Commercial Contract Values"
        subtitle="Update opportunity financials, contract value, seats, and target close date."
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Edit3 size={18} />
          </div>
        }
        maxWidth="540px"
        footer={
          <>
            <button
              onClick={() => setIsEditingCommercials(false)}
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCommercials}
              disabled={savingCommercials}
              className="btn btn-primary"
              style={{ fontSize: '0.82rem' }}
            >
              {savingCommercials ? 'Saving Changes...' : 'Save & Log Audit'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Total Contract Value ($ / SAR) *
            </label>
            <input
              type="number"
              min="0"
              value={editValue}
              onChange={(e) => {
                const v = Number(e.target.value);
                setEditValue(v);
                setEditArr(v);
                setEditMrr(Number((v / 12).toFixed(2)));
              }}
              className="form-input"
              style={{ fontWeight: 800, fontSize: '0.95rem', width: '100%' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>ARR</label>
              <input
                type="number"
                value={editArr}
                onChange={(e) => setEditArr(Number(e.target.value))}
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>MRR</label>
              <input
                type="number"
                value={editMrr}
                onChange={(e) => setEditMrr(Number(e.target.value))}
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>Seats / Units</label>
              <input
                type="number"
                value={editSeats}
                onChange={(e) => setEditSeats(Number(e.target.value))}
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>Win Probability (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={editProb}
                onChange={(e) => setEditProb(Number(e.target.value))}
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>Pricing Plan Name</label>
            <input
              type="text"
              value={editPlan}
              onChange={(e) => setEditPlan(e.target.value)}
              placeholder="e.g. Enterprise Annual Subscription"
              className="form-input"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>Expected Close Date</label>
            <input
              type="date"
              value={editCloseDate}
              onChange={(e) => setEditCloseDate(e.target.value)}
              className="form-input"
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </Modal>

      {/* Log Activity Modal */}
      <Modal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        title="Log Commercial Activity"
        subtitle="Record meetings, calls, notes, and assign mandatory next step."
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIcon size={18} />
          </div>
        }
        maxWidth="540px"
        footer={
          <>
            <button
              onClick={() => setShowActivityModal(false)}
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem' }}
            >
              Cancel
            </button>
            <button
              onClick={handleLogActivity}
              disabled={loggingActivity}
              className="btn btn-primary"
              style={{ fontSize: '0.82rem' }}
            >
              {loggingActivity ? 'Saving Activity...' : 'Log Activity & Action'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>Activity Type</label>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              className="form-select"
              style={{ width: '100%' }}
            >
              <option value="MEETING">Meeting / Executive Review</option>
              <option value="CALL">Phone Call</option>
              <option value="EMAIL">Email Follow-up</option>
              <option value="WHATSAPP">WhatsApp Commercial Message</option>
              <option value="SITE_VISIT">Site Visit / Facility Inspection</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>Subject *</label>
            <input
              type="text"
              value={activitySubject}
              onChange={(e) => setActivitySubject(e.target.value)}
              placeholder="e.g. Commercial Scope & Terms Finalization"
              className="form-input"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>Outcome Notes</label>
            <textarea
              rows={3}
              value={activityOutcome}
              onChange={(e) => setActivityOutcome(e.target.value)}
              placeholder="e.g. Client agreed to 45 units in initial deployment."
              className="form-textarea"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>Mandatory Next Action *</label>
            <input
              type="text"
              value={nextActionDesc}
              onChange={(e) => setNextActionDesc(e.target.value)}
              placeholder="e.g. Issue revised commercial contract and payment schedule"
              className="form-input"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>Next Action Due Date *</label>
            <input
              type="date"
              value={nextActionDue}
              onChange={(e) => setNextActionDue(e.target.value)}
              className="form-input"
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </Modal>

      {/* Stage Transition Modal */}
      <Modal
        isOpen={showTransitionModal}
        onClose={() => setShowTransitionModal(false)}
        title="Transition Opportunity Stage"
        subtitle="Select the target stage for this commercial opportunity."
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(124, 58, 237, 0.15)', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={18} />
          </div>
        }
        maxWidth="500px"
        accentGradient="linear-gradient(90deg, var(--accent-purple) 0%, var(--primary) 100%)"
        footer={
          <>
            <button
              onClick={() => setShowTransitionModal(false)}
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem' }}
            >
              Cancel
            </button>
            <button
              onClick={handleTransitionStage}
              disabled={transitioning || !targetStageId}
              className="btn btn-primary"
              style={{ fontSize: '0.82rem' }}
            >
              {transitioning ? 'Transitioning...' : 'Confirm Stage Change'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>Target Pipeline Stage *</label>
            <select
              value={targetStageId}
              onChange={(e) => setTargetStageId(e.target.value)}
              className="form-select"
              style={{ width: '100%' }}
            >
              <option value="">-- Select Target Stage --</option>
              {availableStages.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.stage_name} ({st.stage_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Transition Reason (Mandatory for backward movement)
            </label>
            <textarea
              rows={4}
              value={transitionReason}
              onChange={(e) => setTransitionReason(e.target.value)}
              placeholder="Detail rationale for advancing or returning stage..."
              className="form-textarea"
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </Modal>

      {/* Final Commercial Invoice Modal (Print Ready) */}
      <CommercialInvoiceModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        opportunity={selectedOpportunity}
      />
    </div>
  );
};
