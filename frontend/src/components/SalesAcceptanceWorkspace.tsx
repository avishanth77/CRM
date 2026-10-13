import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Building2,
  ShieldCheck, RefreshCw, ExternalLink, CheckSquare, AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { Modal } from './common/Modal';
import type { SQLHandoff } from '../services/api';

interface SalesAcceptanceWorkspaceProps {
  initialHandoffId?: string;
  onNavigateToOpportunity?: (opportunityId: string) => void;
  onNavigateToLead?: (leadId: string) => void;
}

export const SalesAcceptanceWorkspace: React.FC<SalesAcceptanceWorkspaceProps> = ({
  initialHandoffId,
  onNavigateToOpportunity,
  onNavigateToLead
}) => {
  const [handoffs, setHandoffs] = useState<SQLHandoff[]>([]);
  const [selectedHandoff, setSelectedHandoff] = useState<SQLHandoff | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Rejection Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [returnTarget, setReturnTarget] = useState<'NURTURE' | 'DISCOVERY' | 'PLD'>('NURTURE');
  const [rejecting, setRejecting] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED'>('PENDING');

  const fetchHandoffs = async () => {
    setLoading(true);
    try {
      const res = await api.getSQLHandoffs();
      const list = res.results || [];
      setHandoffs(list);

      if (initialHandoffId) {
        const found = list.find((h) => h.id === initialHandoffId);
        if (found) setSelectedHandoff(found);
        else if (list.length > 0) setSelectedHandoff(list[0]);
      } else if (!selectedHandoff && list.length > 0) {
        const firstPending = list.find((h) => h.status === 'PENDING') || list[0];
        setSelectedHandoff(firstPending);
      } else if (selectedHandoff) {
        const refreshed = list.find((h) => h.id === selectedHandoff.id);
        if (refreshed) setSelectedHandoff(refreshed);
      }
    } catch (err: any) {
      console.error('Failed to load SQL handoffs', err);
      setFeedbackMsg({ type: 'error', text: err?.message || 'Error loading SQL handoffs.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHandoffs();
  }, []);

  const handleAccept = async () => {
    if (!selectedHandoff) return;
    setAccepting(true);
    setFeedbackMsg(null);
    try {
      const res = await api.acceptSQLHandoff(selectedHandoff.id);
      setSelectedHandoff(res.handoff);
      setFeedbackMsg({
        type: 'success',
        text: `SQL Handoff accepted! Commercial Opportunity #${res.opportunity_id.substring(0, 8)} created successfully.`
      });
      await fetchHandoffs();
      if (onNavigateToOpportunity) {
        onNavigateToOpportunity(res.opportunity_id);
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.error || err?.message || 'Failed to accept SQL handoff.' });
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedHandoff) return;
    if (!rejectionReason.trim()) {
      setFeedbackMsg({ type: 'error', text: 'A documented rejection reason is mandatory.' });
      return;
    }
    setRejecting(true);
    setFeedbackMsg(null);
    try {
      await api.rejectSQLHandoff(selectedHandoff.id, {
        rejection_reason: rejectionReason.trim(),
        return_to_stage: returnTarget
      });
      setFeedbackMsg({ type: 'success', text: `SQL Handoff rejected and lead rerouted to ${returnTarget}.` });
      setShowRejectModal(false);
      setRejectionReason('');
      await fetchHandoffs();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to reject SQL handoff.' });
    } finally {
      setRejecting(false);
    }
  };

  const filteredHandoffs = handoffs.filter((h) => {
    if (statusFilter === 'ALL') return true;
    return h.status === statusFilter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header Banner */}
      <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid var(--success)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={28} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                  Sales Acceptance Review Workspace
                </h1>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                Review qualified SQL handoffs from PLD, monitor SLAs, and accept or reject with full governance.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', background: 'var(--bg-surface)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-subtle)', gap: '4px' }}>
              {(['PENDING', 'ACCEPTED', 'REJECTED', 'ALL'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: statusFilter === st ? 'var(--primary)' : 'transparent',
                    color: statusFilter === st ? '#FFFFFF' : 'var(--text-secondary)',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            <button
              onClick={fetchHandoffs}
              className="btn btn-secondary"
              style={{ padding: '8px 12px' }}
              title="Refresh Queue"
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

      {/* Main Grid: Queue on left (1 col), Detail on right (2 cols) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        {/* Queue List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em', margin: 0 }}>
              Handoff Queue ({filteredHandoffs.length})
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '750px', overflowY: 'auto' }}>
            {filteredHandoffs.length === 0 ? (
              <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No SQL handoffs match the selected filter.
              </div>
            ) : (
              filteredHandoffs.map((h) => {
                const isSelected = selectedHandoff?.id === h.id;
                return (
                  <div
                    key={h.id}
                    onClick={() => setSelectedHandoff(h)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      background: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                      border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Building2 size={14} color="var(--primary)" />
                          {h.company_name}
                        </h4>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                          {h.product_name}
                        </span>
                      </div>
                      <span
                        className={`badge ${
                          h.status === 'ACCEPTED'
                            ? 'badge-success'
                            : h.status === 'REJECTED'
                            ? 'badge-danger'
                            : 'badge-warning'
                        }`}
                        style={{ fontSize: '0.65rem' }}
                      >
                        {h.status}
                      </span>
                    </div>

                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                      <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                        {Number(h.estimated_value).toLocaleString()} {h.currency}
                      </span>
                      {h.status === 'PENDING' && (
                        <span
                          style={{
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: h.is_sla_overdue ? 'var(--danger)' : 'var(--text-muted)'
                          }}
                        >
                          <Clock size={12} />
                          {h.is_sla_overdue ? 'SLA OVERDUE' : `${h.sla_remaining_hours}h left`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Handoff Review (2 cols) */}
        <div>
          {selectedHandoff ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Context Header */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.04em', display: 'block' }}>
                      SQL HANDOFF RECORD #{selectedHandoff.id.substring(0, 8)}
                    </span>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', margin: '4px 0 2px' }}>
                      {selectedHandoff.company_name}
                    </h2>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                      Submitted on {new Date(selectedHandoff.created_at).toLocaleDateString()} by{' '}
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {selectedHandoff.pld_executive_name || 'PLD Executive'}
                      </span>
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {onNavigateToLead && (
                      <button
                        onClick={() => onNavigateToLead(selectedHandoff.lead)}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.78rem' }}
                      >
                        View Lead
                        <ExternalLink size={13} />
                      </button>
                    )}
                    {selectedHandoff.opportunity_id && onNavigateToOpportunity && (
                      <button
                        onClick={() => onNavigateToOpportunity(selectedHandoff.opportunity_id!)}
                        className="btn btn-primary"
                        style={{ fontSize: '0.78rem' }}
                      >
                        Open Opportunity
                        <ExternalLink size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                  <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>ESTIMATED VALUE</span>
                    <span style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '2px', display: 'block' }}>
                      {Number(selectedHandoff.estimated_value).toLocaleString()} {selectedHandoff.currency}
                    </span>
                  </div>
                  <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>PRODUCT</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)', marginTop: '2px', display: 'block' }}>
                      {selectedHandoff.product_name}
                    </span>
                  </div>
                  <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>SALES OWNER</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px', display: 'block' }}>
                      {selectedHandoff.sales_owner_name || 'Pending Acceptance'}
                    </span>
                  </div>
                  <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>SLA DEADLINE</span>
                    <span
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 800,
                        marginTop: '2px',
                        display: 'block',
                        color: selectedHandoff.is_sla_overdue ? 'var(--danger)' : 'var(--success)'
                      }}
                    >
                      {selectedHandoff.is_sla_overdue
                        ? 'OVERDUE'
                        : `${selectedHandoff.sla_remaining_hours}h Remaining`}
                    </span>
                  </div>
                </div>

                {/* Authorized Override Notice if applied */}
                {selectedHandoff.is_override && (
                  <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '0.78rem', color: '#FDE68A', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <AlertTriangle size={16} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <span style={{ fontWeight: 800 }}>Authorized Override Applied at Submission:</span>
                      <p style={{ margin: '2px 0 0' }}>{selectedHandoff.override_reason}</p>
                      {selectedHandoff.override_approved_by_name && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                          Approved by {selectedHandoff.override_approved_by_name}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Qualification Evidence Snapshot */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px' }}>
                  <CheckSquare size={16} color="var(--primary)" />
                  Verified Qualification Evidence (What We Know)
                </h3>

                {selectedHandoff.qualification_evidence?.what_we_know &&
                selectedHandoff.qualification_evidence.what_we_know.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                    {selectedHandoff.qualification_evidence.what_we_know.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '8px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '0.78rem',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px'
                        }}
                      >
                        <CheckCircle2 size={15} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>No evidence summary available.</p>
                )}

                {/* Gate Audit Breakdown */}
                {Array.isArray(selectedHandoff.gate_audit_results) && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em', display: 'block', marginBottom: '10px' }}>
                      9-Gate Snapshot Results
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                      {selectedHandoff.gate_audit_results.map((g: any, i: number) => (
                        <div
                          key={i}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.78rem'
                          }}
                        >
                          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {g.name}
                          </span>
                          <span className={g.status === 'PASS' ? 'badge badge-success' : 'badge badge-warning'} style={{ fontSize: '0.65rem' }}>
                            {g.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sales Decision Panel (Only active if PENDING) */}
              {selectedHandoff.status === 'PENDING' ? (
                <div
                  className="glass-panel"
                  style={{
                    padding: '24px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, var(--bg-surface-elevated) 100%)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                    Sales Acceptance Decision
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                    Accepting this handoff confirms Sales ownership, converts the lead, and creates the commercial Opportunity with all carried-forward technical context.
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    <button
                      onClick={handleAccept}
                      disabled={accepting}
                      className="btn btn-primary"
                      style={{
                        padding: '12px 24px',
                        fontSize: '0.88rem',
                        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                        boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      <CheckCircle2 size={16} />
                      {accepting ? 'Accepting & Converting...' : 'ACCEPT SQL & CREATE OPPORTUNITY'}
                    </button>

                    <button
                      onClick={() => setShowRejectModal(true)}
                      className="btn btn-secondary"
                      style={{
                        padding: '12px 20px',
                        fontSize: '0.88rem',
                        color: 'var(--danger)',
                        borderColor: 'rgba(239, 68, 68, 0.3)'
                      }}
                    >
                      <XCircle size={16} />
                      REJECT SQL HANDOFF
                    </button>
                  </div>
                </div>
              ) : (
                <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Decision concluded on{' '}
                    {selectedHandoff.decision_date
                      ? new Date(selectedHandoff.decision_date).toLocaleString()
                      : 'N/A'}{' '}
                    — Status:{' '}
                    <strong style={{ color: selectedHandoff.status === 'ACCEPTED' ? 'var(--success)' : 'var(--danger)' }}>
                      {selectedHandoff.status}
                    </strong>
                  </span>
                  {selectedHandoff.rejection_reason && (
                    <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                      Reason: {selectedHandoff.rejection_reason}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Select an SQL Handoff from the queue to review commercial qualification details.
            </div>
          )}
        </div>
      </div>

      {/* Sales Rejection Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject SQL Handoff"
        subtitle="Sales rejection requires an auditable reason and routing target."
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <XCircle size={20} />
          </div>
        }
        maxWidth="500px"
        accentGradient="linear-gradient(90deg, #EF4444 0%, #DC2626 100%)"
        footer={
          <>
            <button
              onClick={() => setShowRejectModal(false)}
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem' }}
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={rejecting || !rejectionReason.trim()}
              className="btn btn-primary"
              style={{
                fontSize: '0.82rem',
                background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                boxShadow: '0 2px 10px rgba(239, 68, 68, 0.3)',
                border: 'none',
              }}
            >
              {rejecting ? 'Recording Rejection...' : 'Confirm Rejection'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Mandatory Rejection Reason *
            </label>
            <textarea
              rows={4}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Economic decision maker deferred project indefinitely; fleet size is under target qualification threshold."
              className="form-textarea"
              style={{ width: '100%', fontSize: '0.82rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Return Pursuit To Stage:
            </label>
            <select
              value={returnTarget}
              onChange={(e: any) => setReturnTarget(e.target.value)}
              className="form-select"
              style={{ width: '100%', fontSize: '0.82rem' }}
            >
              <option value="NURTURE">Nurture Pipeline (Deferred timeline / inactive)</option>
              <option value="DISCOVERY">Technical Discovery (Requires problem refinement)</option>
              <option value="PLD">PLD Qualification (Requires further prospecting)</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};
