import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, AlertTriangle, XCircle, ShieldAlert,
  Send, DollarSign, Clock, RefreshCw, CheckSquare,
  Building2, User, ShieldCheck, AlertCircle, ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import { Modal } from './common/Modal';
import type {
  Lead, SQLReadinessData, SQLHandoff
} from '../services/api';

interface SQLReadinessWorkspaceProps {
  initialLeadId?: string;
  onNavigateToOpportunity?: (opportunityId: string) => void;
  onNavigateToSalesAcceptance?: (handoffId: string) => void;
  onNavigateToTab?: (tab: string, leadId?: string) => void;
}

export const SQLReadinessWorkspace: React.FC<SQLReadinessWorkspaceProps> = ({
  initialLeadId,
  onNavigateToOpportunity,
  onNavigateToSalesAcceptance,
  onNavigateToTab
}) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialLeadId || '');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [readinessData, setReadinessData] = useState<SQLReadinessData | null>(null);
  const [activeHandoff, setActiveHandoff] = useState<SQLHandoff | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Submission Form State
  const [estimatedValue, setEstimatedValue] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('USD');
  const [slaHours, setSlaHours] = useState<number>(48);

  // Authorized Override Modal State
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [submittingOverride, setSubmittingOverride] = useState<boolean>(false);

  // Load Leads list
  const loadLeads = async () => {
    try {
      const res = await api.getLeads();
      const list = res.results || [];
      setLeads(list);
      if (!selectedLeadId && list.length > 0) {
        setSelectedLeadId(list[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load leads', err);
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  // Fetch readiness and handoff data when selectedLeadId changes
  const fetchReadiness = async (leadId: string) => {
    if (!leadId) return;
    setLoading(true);
    try {
      const [leadRes, readinessRes, handoffsRes] = await Promise.all([
        api.getLead(leadId),
        api.getSQLReadiness(leadId),
        api.getSQLHandoffs({ lead: leadId })
      ]);
      setSelectedLead(leadRes);
      setReadinessData(readinessRes);
      if (leadRes.estimated_opportunity_value) {
        setEstimatedValue(Number(leadRes.estimated_opportunity_value));
      } else {
        setEstimatedValue(50000);
      }

      const handoffList = handoffsRes.results || [];
      if (handoffList.length > 0) {
        setActiveHandoff(handoffList[0]);
      } else {
        setActiveHandoff(null);
      }
    } catch (err: any) {
      console.error('Failed to fetch SQL readiness', err);
      setFeedbackMsg({ type: 'error', text: err?.message || 'Error loading SQL readiness checklist' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLeadId) {
      fetchReadiness(selectedLeadId);
    }
  }, [selectedLeadId]);

  const handleSubmitSQL = async () => {
    if (!selectedLead) return;
    setSubmitting(true);
    setFeedbackMsg(null);
    try {
      const res = await api.submitSQLHandoff({
        lead_id: selectedLead.id,
        estimated_value: estimatedValue,
        sla_duration_hours: slaHours,
        is_override: false
      });
      setActiveHandoff(res.handoff);
      setFeedbackMsg({ type: 'success', text: 'SQL Handoff submitted successfully! Sales Acceptance SLA timer initiated.' });
      fetchReadiness(selectedLead.id);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to submit SQL handoff.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAuthorizeOverride = async () => {
    if (!selectedLead) return;
    if (!overrideReason.trim()) {
      setFeedbackMsg({ type: 'error', text: 'An auditable override reason is mandatory to bypass qualification gates.' });
      return;
    }
    setSubmittingOverride(true);
    setFeedbackMsg(null);
    try {
      const res = await api.submitSQLHandoff({
        lead_id: selectedLead.id,
        estimated_value: estimatedValue,
        sla_duration_hours: slaHours,
        is_override: true,
        override_reason: overrideReason.trim()
      });
      setActiveHandoff(res.handoff);
      setShowOverrideModal(false);
      setOverrideReason('');
      setFeedbackMsg({ type: 'success', text: 'Authorized SQL Override approved! Handoff submitted for Sales Acceptance with audit record.' });
      fetchReadiness(selectedLead.id);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Authorized override failed.' });
    } finally {
      setSubmittingOverride(false);
    }
  };

  const getGateStatusBadge = (status: string) => {
    switch (status) {
      case 'PASS':
        return (
          <span className="badge badge-success" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
            <CheckCircle2 size={13} />
            PASS
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="badge badge-danger" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
            <XCircle size={13} />
            BLOCKED
          </span>
        );
      case 'MISSING':
      default:
        return (
          <span className="badge badge-warning" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
            <AlertTriangle size={13} />
            MISSING
          </span>
        );
    }
  };

  const handleRedirectToMissing = (gateCodeOrText: string) => {
    const text = (gateCodeOrText || '').toUpperCase();
    if (text.includes('ICP') || text.includes('FIT') || text.includes('KNOCK-OUT') || text.includes('PLD_SCORE')) {
      onNavigateToTab?.('queue', selectedLead?.id);
    } else if (
      text.includes('PROBLEM') ||
      text.includes('IMPACT') ||
      text.includes('CAPABILITY') ||
      text.includes('DECISION') ||
      text.includes('BUYER') ||
      text.includes('TIMELINE') ||
      text.includes('DISCOVERY')
    ) {
      onNavigateToTab?.('discovery', selectedLead?.id);
    } else if (text.includes('POC') || text.includes('TRIAL')) {
      onNavigateToTab?.('poc', selectedLead?.id);
    } else if (text.includes('DEMO')) {
      onNavigateToTab?.('demo', selectedLead?.id);
    } else if (text.includes('OPPORTUNITY') || text.includes('VALUE') || text.includes('ESTIMATED_VALUE')) {
      const input = document.getElementById('sql-estimated-value-input');
      if (input) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus();
        input.classList.add('highlight-section-pulse');
        setTimeout(() => input.classList.remove('highlight-section-pulse'), 2500);
      }
    } else if (text.includes('ACTION') || text.includes('ACTIVITY')) {
      onNavigateToTab?.('queue', selectedLead?.id);
    } else {
      onNavigateToTab?.('discovery', selectedLead?.id);
    }
  };

  const getRedirectLabel = (gateCodeOrText: string) => {
    const text = (gateCodeOrText || '').toUpperCase();
    if (text.includes('ICP') || text.includes('FIT') || text.includes('KNOCK-OUT')) {
      return 'Complete ICP in Lead Qualification ➔';
    }
    if (text.includes('PROBLEM')) {
      return 'Document Problems in Discovery ➔';
    }
    if (text.includes('IMPACT')) {
      return 'Quantify Impact in Discovery ➔';
    }
    if (text.includes('CAPABILITY')) {
      return 'Map Capabilities in Discovery ➔';
    }
    if (text.includes('DECISION') || text.includes('BUYER')) {
      return 'Identify Committee in Discovery ➔';
    }
    if (text.includes('TIMELINE')) {
      return 'Set Timeline in Discovery ➔';
    }
    if (text.includes('ACTION') || text.includes('ACTIVITY')) {
      return 'Schedule Next Action in Lead View ➔';
    }
    if (text.includes('OPPORTUNITY') || text.includes('VALUE')) {
      return 'Fill Estimated Value on this Page ➔';
    }
    if (text.includes('POC') || text.includes('TRIAL')) {
      return 'Manage Trials in POC Workspace ➔';
    }
    if (text.includes('DEMO')) {
      return 'Manage Demo in Demo Workspace ➔';
    }
    return 'Resolve Missing Section ➔';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Lead Selector Banner */}
      <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid var(--primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={28} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                  SQL Readiness &amp; Commercial Handoff Gate
                </h1>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                Enforces the 9 documented qualification gates before commercial submission to Sales.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Select Lead:
            </label>
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className="form-select"
              style={{ minWidth: '280px', fontSize: '0.82rem', padding: '8px 12px' }}
            >
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.account_name} — {l.primary_product_name} ({l.status})
                </option>
              ))}
            </select>

            <button
              onClick={() => selectedLeadId && fetchReadiness(selectedLeadId)}
              className="btn btn-secondary"
              style={{ padding: '8px 12px' }}
              title="Refresh Gates"
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

      {selectedLead && (
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>ACCOUNT</span>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <Building2 size={15} color="var(--primary)" />
              {selectedLead.account_name}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>PRIMARY CONTACT</span>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <User size={15} color="var(--success)" />
              {selectedLead.contact_name || 'Unassigned Contact'}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>PRODUCT</span>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>
              {selectedLead.primary_product_name} ({selectedLead.primary_product_code})
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>CURRENT STAGE</span>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--accent-cyan)', marginTop: '4px' }}>
              {selectedLead.current_stage_name || selectedLead.status}
            </div>
          </div>
        </div>
      )}

      {/* SQL Status Banner */}
      {readinessData && (
        <div
          className="glass-panel"
          style={{
            padding: '24px',
            borderRadius: '14px',
            border: readinessData.is_ready ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
            background: readinessData.is_ready
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(17, 23, 38, 0.9) 100%)'
              : 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(17, 23, 38, 0.9) 100%)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div
                style={{
                  padding: '12px',
                  borderRadius: '14px',
                  background: readinessData.is_ready ? 'var(--success)' : 'var(--warning)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {readinessData.is_ready ? <CheckCircle2 size={26} /> : <AlertTriangle size={26} />}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                    SQL READINESS STATUS:
                  </span>
                  <span className={readinessData.is_ready ? 'badge badge-success' : 'badge badge-warning'}>
                    {readinessData.status}
                  </span>
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: '6px 0 4px' }}>
                  {readinessData.is_ready
                    ? 'All 9 Qualification Gates Passed — Ready for Sales'
                    : `${readinessData.missing_gates.length} Mandatory Qualification Gate(s) Incomplete`}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0, maxWidth: '720px' }}>
                  {readinessData.is_ready
                    ? 'This pursuit meets the documented criteria for commercial review. Submit to notify Sales and start the 48-hour acceptance SLA.'
                    : 'Backend validation strictly blocks SQL conversion until all gates are completed, or an authorized manager override is approved.'}
                </p>
              </div>
            </div>

            {!readinessData.is_ready && (
              <button
                onClick={() => setShowOverrideModal(true)}
                className="btn btn-secondary"
                style={{
                  borderColor: 'rgba(245, 158, 11, 0.4)',
                  color: 'var(--warning)',
                  fontSize: '0.84rem'
                }}
              >
                <ShieldAlert size={16} />
                Authorized Override
              </button>
            )}
          </div>

          {/* Missing Gates Box */}
          {!readinessData.is_ready && readinessData.what_is_missing.length > 0 && (
            <div
              style={{
                marginTop: '18px',
                padding: '16px',
                background: 'rgba(245, 158, 11, 0.08)',
                borderRadius: '10px',
                border: '1px solid rgba(245, 158, 11, 0.25)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--warning)' }}>
                  <AlertTriangle size={15} />
                  Missing Qualification Evidence Required Before Handoff:
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Click any item below to jump directly to that section &amp; fill data
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {readinessData.what_is_missing.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleRedirectToMissing(item)}
                    style={{
                      padding: '10px 14px',
                      background: 'var(--bg-surface)',
                      borderRadius: '8px',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.3)';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                      <AlertCircle size={15} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                      <span>{item}</span>
                    </div>
                    <span style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                      background: 'var(--primary-subtle)',
                      padding: '4px 10px',
                      borderRadius: '6px'
                    }}>
                      {getRedirectLabel(item)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 9-Gate Checklist & Submission Form */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Gates Checklist (Left Column) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <CheckSquare size={18} color="var(--primary)" />
              Documented SQL Readiness Gates (9 Mandatory Gates)
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Click any incomplete gate to jump directly to resolve it
            </span>
          </div>

          {readinessData?.checklist.map((gate, index) => {
            const isPassed = gate.status === 'PASS';
            const isBlocked = gate.status === 'BLOCKED';

            return (
              <div
                key={gate.gate_code}
                onClick={() => {
                  if (!isPassed) handleRedirectToMissing(gate.gate_code);
                }}
                style={{
                  padding: '16px 18px',
                  background: 'var(--bg-surface)',
                  borderRadius: '12px',
                  border: `1px solid ${
                    isPassed
                      ? 'rgba(16, 185, 129, 0.25)'
                      : isBlocked
                      ? 'rgba(239, 68, 68, 0.3)'
                      : 'rgba(245, 158, 11, 0.25)'
                  }`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '14px',
                  cursor: isPassed ? 'default' : 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isPassed) {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isPassed) {
                    e.currentTarget.style.borderColor = isBlocked ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.25)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'var(--bg-surface-elevated)',
                      color: 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px'
                    }}
                  >
                    {index + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        {gate.name}
                      </h4>
                      {gate.is_mandatory && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-surface-elevated)', padding: '2px 6px', borderRadius: '4px' }}>
                          Mandatory
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 8px' }}>
                      {gate.description}
                    </p>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-primary)',
                        background: 'var(--bg-surface-elevated)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>Evidence:</span>
                      {gate.evidence || 'No verified evidence on file'}
                    </div>

                    {!isPassed && (
                      <div style={{ marginTop: '10px' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRedirectToMissing(gate.gate_code);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 12px',
                            background: 'rgba(79, 70, 229, 0.12)',
                            border: '1px solid rgba(79, 70, 229, 0.35)',
                            borderRadius: '6px',
                            color: 'var(--primary)',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <ExternalLink size={13} />
                          {getRedirectLabel(gate.gate_code)}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {getGateStatusBadge(gate.status)}
              </div>
            );
          })}
        </div>

        {/* Commercial Submission & SLA Controls (Right Column) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Handoff Card if exists */}
          {activeHandoff && (
            <div className="glass-panel" style={{ padding: '20px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} />
                  Active SQL Handoff #{activeHandoff.id.substring(0, 8)}
                </span>
                <span className={activeHandoff.status === 'ACCEPTED' ? 'badge badge-success' : activeHandoff.status === 'REJECTED' ? 'badge badge-danger' : 'badge badge-warning'}>
                  {activeHandoff.status}
                </span>
              </div>

              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Assigned Sales Owner</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {activeHandoff.sales_owner_name || 'Unassigned'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Estimated Deal Value</span>
                  <span style={{ fontWeight: 800, color: 'var(--success)' }}>
                    {Number(activeHandoff.estimated_value).toLocaleString()} {activeHandoff.currency}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>SLA Duration</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {activeHandoff.sla_duration_hours} Hours
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>SLA Health</span>
                  <span style={{ fontWeight: 800, color: activeHandoff.is_sla_overdue ? 'var(--danger)' : 'var(--success)' }}>
                    {activeHandoff.is_sla_overdue ? 'OVERDUE' : `${activeHandoff.sla_remaining_hours}h Remaining`}
                  </span>
                </div>
                {activeHandoff.is_override && (
                  <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '0.75rem', color: '#FDE68A' }}>
                    <span style={{ fontWeight: 700, display: 'block' }}>Authorized Override Applied:</span>
                    {activeHandoff.override_reason}
                  </div>
                )}
                {activeHandoff.status === 'PENDING' && onNavigateToSalesAcceptance && (
                  <button
                    onClick={() => onNavigateToSalesAcceptance(activeHandoff.id)}
                    className="btn btn-secondary"
                    style={{ width: '100%', marginTop: '8px', fontSize: '0.8rem', color: 'var(--warning)', borderColor: 'rgba(245, 158, 11, 0.3)' }}
                  >
                    Review in Sales Acceptance Queue
                    <ExternalLink size={14} style={{ marginLeft: '4px' }} />
                  </button>
                )}
                {activeHandoff.opportunity_id && onNavigateToOpportunity && (
                  <button
                    onClick={() => onNavigateToOpportunity(activeHandoff.opportunity_id!)}
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: '8px', fontSize: '0.8rem' }}
                  >
                    View Converted Opportunity
                    <ExternalLink size={14} style={{ marginLeft: '4px' }} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Submission Card */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px' }}>
              <Send size={16} color="var(--primary)" />
              Commercial Handoff Submission
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
              Enter estimated commercial value and configure the Sales Acceptance SLA before handoff.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Estimated Opportunity Value (Contract Total) *
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: '10px', display: 'flex', alignItems: 'center', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                    <DollarSign size={15} />
                  </div>
                  <input
                    id="sql-estimated-value-input"
                    type="number"
                    min="1"
                    value={estimatedValue || ''}
                    onChange={(e) => setEstimatedValue(Number(e.target.value))}
                    className="form-input"
                    style={{ paddingLeft: '32px', paddingRight: '50px', fontWeight: 700 }}
                    placeholder="e.g. 85000"
                  />
                  <div style={{ position: 'absolute', top: 0, bottom: 0, right: '12px', display: 'flex', alignItems: 'center', pointerEvents: 'none', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    {currency}
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="form-select"
                >
                  <option value="USD">USD ($)</option>
                  <option value="SAR">SAR (Saudi Riyal)</option>
                  <option value="AED">AED (UAE Dirham)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Sales Acceptance SLA (Hours)
                </label>
                <select
                  value={slaHours}
                  onChange={(e) => setSlaHours(Number(e.target.value))}
                  className="form-select"
                >
                  <option value={24}>24 Hours (Fast-Track)</option>
                  <option value={48}>48 Hours (Standard Corporate SLA)</option>
                  <option value={72}>72 Hours (Enterprise Committee)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleSubmitSQL}
              disabled={submitting || !readinessData?.is_ready || estimatedValue <= 0}
              className="btn btn-primary"
              style={{
                width: '100%',
                marginTop: '18px',
                padding: '12px',
                fontSize: '0.88rem',
                opacity: (!readinessData?.is_ready || estimatedValue <= 0) ? 0.5 : 1
              }}
            >
              <Send size={15} />
              {submitting ? 'Submitting for Sales Review...' : 'Submit for Sales Acceptance'}
            </button>

            {!readinessData?.is_ready && (
              <div style={{
                marginTop: '14px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                textAlign: 'center'
              }}>
                <p style={{ fontSize: '0.74rem', color: 'var(--warning)', fontWeight: 600, margin: '0 0 10px 0', lineHeight: 1.4 }}>
                  ⚠ Submission blocked until all 9 qualification gates pass or an authorized override is applied.
                </p>
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(true)}
                  className="btn btn-outline"
                  style={{
                    fontSize: '0.78rem',
                    padding: '6px 14px',
                    borderColor: 'rgba(245, 158, 11, 0.5)',
                    color: 'var(--warning)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  <ShieldAlert size={14} /> Apply Authorized Override to Submit
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Authorized Override Modal */}
      <Modal
        isOpen={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        title="Authorized SQL Readiness Override"
        subtitle="Executive governance bypass for incomplete qualification gates."
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={20} />
          </div>
        }
        maxWidth="540px"
        accentGradient="linear-gradient(90deg, #F59E0B 0%, #D97706 100%)"
        footer={
          <>
            <button
              onClick={() => setShowOverrideModal(false)}
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem' }}
            >
              Cancel
            </button>
            <button
              onClick={handleAuthorizeOverride}
              disabled={submittingOverride || !overrideReason.trim()}
              className="btn btn-primary"
              style={{
                fontSize: '0.82rem',
                background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                boxShadow: '0 2px 10px rgba(245, 158, 11, 0.3)',
                border: 'none',
              }}
            >
              {submittingOverride ? 'Recording Override...' : 'Approve Override & Submit SQL'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', fontSize: '0.8rem', color: '#FDE68A' }}>
            <span style={{ fontWeight: 800, display: 'block', marginBottom: '6px' }}>Incomplete Gates to be Overridden:</span>
            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {readinessData?.missing_gates.map((g, idx) => (
                <li key={idx}>{g}</li>
              ))}
            </ul>
            <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '8px' }}>
              * Note: The original gate results and your reason will remain permanently visible in the audit history.
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Mandatory Override Business Justification *
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {[
                'Executive sponsor fast-track commercial approval',
                'Management waiver: expedited pilot review',
                'Strategic enterprise account fast-track review'
              ].map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setOverrideReason(preset)}
                  style={{
                    fontSize: '0.7rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  + {preset}
                </button>
              ))}
            </div>
            <textarea
              rows={4}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="e.g., Executive sponsor confirmed commercial review; board requested fast-track commercial proposal."
              className="form-textarea"
              style={{ width: '100%', fontSize: '0.82rem' }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
