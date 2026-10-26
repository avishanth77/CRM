import React, { useState, useEffect } from 'react';
import {
  FlaskConical, CheckCircle2, AlertTriangle, XCircle, Clock,
  ArrowRight, RefreshCw, Plus, Trash2,
  Building2, Users, Target,
  MapPin, BarChart3, Edit3, AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { Modal } from './common/Modal';
import type { POC, POCSuccessCriterion, POCReadiness } from '../services/api';

interface POCWorkspaceProps {
  initialPOCId?: string;
  leadId?: string;
  onPOCCompleted?: (poc: POC) => void;
  onNavigateToSQL?: (leadId: string) => void;
}

export const POCWorkspace: React.FC<POCWorkspaceProps> = ({
  initialPOCId,
  leadId,
  onPOCCompleted,
  onNavigateToSQL
}) => {
  const [pocs, setPocs] = useState<POC[]>([]);
  const [selectedPOC, setSelectedPOC] = useState<POC | null>(null);
  const [readiness, setReadiness] = useState<POCReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Scope & Operational Parameters State
  const [scopeDesc, setScopeDesc] = useState('');
  const [geography, setGeography] = useState('');
  const [usersCount, setUsersCount] = useState<number>(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [savingScope, setSavingScope] = useState(false);

  // Add Success Criterion Modal
  const [showAddCritModal, setShowAddCritModal] = useState(false);
  const [critName, setCritName] = useState('');
  const [critCategory, setCritCategory] = useState('OPERATIONAL_EFFICIENCY');
  const [critBaseline, setCritBaseline] = useState('');
  const [critTarget, setCritTarget] = useState('');
  const [critNotes, setCritNotes] = useState('');
  const [savingCrit, setSavingCrit] = useState(false);

  // Update Criterion Result Modal
  const [editingCrit, setEditingCrit] = useState<POCSuccessCriterion | null>(null);
  const [editActualResult, setEditActualResult] = useState('');
  const [editIsMet, setEditIsMet] = useState(true);
  const [updatingCrit, setUpdatingCrit] = useState(false);

  // Add Participant Modal
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [partName, setPartName] = useState('');
  const [partEmail, setPartEmail] = useState('');
  const [partType, setPartType] = useState<'PILOT_USER' | 'ENGINEER' | 'CUSTOMER' | 'INTERNAL'>('PILOT_USER');
  const [partRole, setPartRole] = useState('');
  const [partNotes, setPartNotes] = useState('');
  const [savingPart, setSavingPart] = useState(false);

  // Baseline & Results & Feedback Form
  const [baselineNotes, setBaselineNotes] = useState('');
  const [resultsSummary, setResultsSummary] = useState('');
  const [customerFeedback, setCustomerFeedback] = useState('');
  const [isSuccessful, setIsSuccessful] = useState(true);
  const [savingResults, setSavingResults] = useState(false);

  // Next Action Form
  const [nextActionDesc, setNextActionDesc] = useState('');
  const [nextActionDueDate, setNextActionDueDate] = useState('');
  const [savingNextAction, setSavingNextAction] = useState(false);

  // Stage "Not Required" Modal
  const [showNotRequiredModal, setShowNotRequiredModal] = useState(false);
  const [notRequiredReason, setNotRequiredReason] = useState('');
  const [savingNotRequired, setSavingNotRequired] = useState(false);

  // Complete POC Action
  const [completingPOC, setCompletingPOC] = useState(false);

  // Initialize New POC Pilot Trial
  const [showInitModal, setShowInitModal] = useState(false);
  const [availableLeads, setAvailableLeads] = useState<any[]>([]);
  const [initLeadId, setInitLeadId] = useState(leadId || '');
  const [initializingPOC, setInitializingPOC] = useState(false);

  const showNotify = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  useEffect(() => {
    if (leadId) setInitLeadId(leadId);
    loadPOCs();
    loadAvailableLeads();
  }, [leadId, initialPOCId]);

  const loadAvailableLeads = async () => {
    try {
      const res = await api.getLeads();
      const list = Array.isArray(res) ? res : (res.results || []);
      setAvailableLeads(list);
    } catch (e) {
      console.warn('Could not load leads for POC selection:', e);
    }
  };

  const loadPOCs = async () => {
    setLoading(true);
    try {
      const res = await api.getPOCs();
      let list = res.results || [];

      // If a leadId is provided and no POC exists in the list for this lead, auto-initialize it
      if (leadId && !list.some(p => p.lead === leadId)) {
        try {
          const initRes = await api.initPOC(leadId);
          if (initRes && initRes.id) {
            list = [initRes, ...list.filter(p => p.id !== initRes.id)];
          }
        } catch (initErr) {
          console.warn('Auto init POC warning in loadPOCs:', initErr);
        }
      }

      setPocs(list);

      let active: POC | null = null;
      if (initialPOCId) {
        active = list.find(p => p.id === initialPOCId) || null;
      }
      if (!active && leadId) {
        active = list.find(p => p.lead === leadId) || null;
      }
      if (!active && list.length > 0) {
        active = list[0];
      }
      if (active) {
        selectPOCRecord(active);
      } else {
        setSelectedPOC(null);
      }
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to load POC trials');
    } finally {
      setLoading(false);
    }
  };

  const handleInitPOC = async (targetLeadId?: string) => {
    const lid = targetLeadId || initLeadId || leadId;
    if (!lid) {
      showNotify('error', 'Please select an account / lead to initialize a POC pilot trial.');
      return;
    }
    setInitializingPOC(true);
    try {
      const created = await api.initPOC(lid);
      setPocs(prev => [created, ...prev.filter(p => p.id !== created.id)]);
      selectPOCRecord(created);
      setShowInitModal(false);
      showNotify('success', `POC Pilot Trial initialized successfully for ${created.account_name || 'selected lead'}!`);
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to initialize POC pilot trial');
    } finally {
      setInitializingPOC(false);
    }
  };

  const selectPOCRecord = async (poc: POC) => {
    setSelectedPOC(poc);
    setScopeDesc(poc.scope_description || '');
    setGeography(poc.geography_coverage || '');
    setUsersCount(poc.users_count || 0);
    setStartDate(poc.start_date || '');
    setEndDate(poc.end_date || '');
    setBaselineNotes(poc.baseline_notes || '');
    setResultsSummary(poc.results_summary || '');
    setCustomerFeedback(poc.customer_feedback || '');
    setIsSuccessful(poc.is_successful !== false);
    setNextActionDesc(poc.next_action_description || '');
    setNextActionDueDate(poc.next_action_due_at ? poc.next_action_due_at.split('T')[0] : '');

    await loadReadiness(poc.id);
  };

  const loadReadiness = async (pocId: string) => {
    try {
      const ready = await api.getPOCReadiness(pocId);
      setReadiness(ready);
    } catch (err: any) {
      console.error('POC readiness error:', err);
    }
  };

  const refreshCurrentPOC = async () => {
    if (!selectedPOC) return;
    setRefreshing(true);
    try {
      const updated = await api.getPOC(selectedPOC.id);
      setSelectedPOC(updated);
      await loadReadiness(updated.id);
      showNotify('success', 'POC data refreshed.');
    } catch (err: any) {
      showNotify('error', 'Failed to refresh POC.');
    } finally {
      setRefreshing(false);
    }
  };

  // Save Scope & Parameters
  const handleSaveScope = async () => {
    if (!selectedPOC) return;
    setSavingScope(true);
    try {
      const updated = await api.updatePOC(selectedPOC.id, {
        scope_description: scopeDesc.trim(),
        geography_coverage: geography.trim(),
        users_count: Number(usersCount),
        start_date: startDate || undefined,
        end_date: endDate || undefined
      });
      setSelectedPOC(updated);
      await loadReadiness(selectedPOC.id);
      showNotify('success', 'Scope, geography, and dates updated.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to save scope.');
    } finally {
      setSavingScope(false);
    }
  };

  // Add Success Criterion
  const handleAddCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPOC) return;
    if (!critName.trim() || !critBaseline.trim() || !critTarget.trim()) {
      showNotify('error', 'Criterion Name, Baseline, and Target are mandatory.');
      return;
    }
    setSavingCrit(true);
    try {
      await api.addPOCCriterion(selectedPOC.id, {
        name: critName.trim(),
        category: critCategory,
        measurement_baseline: critBaseline.trim(),
        expected_target: critTarget.trim(),
        notes: critNotes.trim(),
        is_met: false
      });
      setShowAddCritModal(false);
      setCritName('');
      setCritBaseline('');
      setCritTarget('');
      setCritNotes('');
      await refreshCurrentPOC();
      showNotify('success', 'Success criterion registered.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to add criterion.');
    } finally {
      setSavingCrit(false);
    }
  };

  // Update Criterion Result
  const handleSaveCritResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCrit) return;
    setUpdatingCrit(true);
    try {
      await api.updatePOCCriterion(editingCrit.id, {
        actual_result: editActualResult.trim(),
        is_met: editIsMet
      });
      setEditingCrit(null);
      await refreshCurrentPOC();
      showNotify('success', 'Criterion result recorded.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to update criterion.');
    } finally {
      setUpdatingCrit(false);
    }
  };

  // Delete Criterion
  const handleDeleteCrit = async (critId: string) => {
    if (!window.confirm('Delete this success criterion?')) return;
    try {
      await api.deletePOCCriterion(critId);
      await refreshCurrentPOC();
      showNotify('success', 'Criterion deleted.');
    } catch (err: any) {
      showNotify('error', 'Failed to delete criterion.');
    }
  };

  // Add Participant
  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPOC) return;
    if (!partName.trim() || !partEmail.trim()) {
      showNotify('error', 'Name and Email are required.');
      return;
    }
    setSavingPart(true);
    try {
      await api.addPOCParticipant(selectedPOC.id, {
        name: partName.trim(),
        email: partEmail.trim(),
        participant_type: partType,
        role_title: partRole.trim(),
        notes: partNotes.trim()
      });
      setShowAddPartModal(false);
      setPartName('');
      setPartEmail('');
      setPartRole('');
      setPartNotes('');
      await refreshCurrentPOC();
      showNotify('success', 'Participant registered.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to add participant.');
    } finally {
      setSavingPart(false);
    }
  };

  // Delete Participant
  const handleDeleteParticipant = async (partId: string) => {
    if (!window.confirm('Remove this pilot participant?')) return;
    try {
      await api.deletePOCParticipant(partId);
      await refreshCurrentPOC();
      showNotify('success', 'Participant removed.');
    } catch (err: any) {
      showNotify('error', 'Failed to remove participant.');
    }
  };

  // Save Baseline, Results & Customer Feedback
  const handleSaveResults = async () => {
    if (!selectedPOC) return;
    setSavingResults(true);
    try {
      const updated = await api.updatePOC(selectedPOC.id, {
        baseline_notes: baselineNotes.trim(),
        results_summary: resultsSummary.trim(),
        customer_feedback: customerFeedback.trim(),
        is_successful: isSuccessful
      });
      setSelectedPOC(updated);
      await loadReadiness(selectedPOC.id);
      showNotify('success', 'Baseline, results, and feedback saved.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to save results.');
    } finally {
      setSavingResults(false);
    }
  };

  // Save Next Action
  const handleSaveNextAction = async () => {
    if (!selectedPOC) return;
    if (!nextActionDesc.trim()) {
      showNotify('error', 'Next action description is mandatory.');
      return;
    }
    setSavingNextAction(true);
    try {
      const updated = await api.updatePOC(selectedPOC.id, {
        next_action_description: nextActionDesc.trim(),
        next_action_due_at: nextActionDueDate ? new Date(nextActionDueDate).toISOString() : undefined
      });
      setSelectedPOC(updated);
      await loadReadiness(selectedPOC.id);
      showNotify('success', 'Mandatory next action saved.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to save next action.');
    } finally {
      setSavingNextAction(false);
    }
  };

  // Complete POC Gate Action
  const handleCompletePOC = async () => {
    if (!selectedPOC) return;
    setCompletingPOC(true);
    try {
      const res = await api.completePOC(selectedPOC.id, {
        results_summary: resultsSummary.trim(),
        customer_feedback: customerFeedback.trim(),
        is_successful: isSuccessful,
        next_action_description: nextActionDesc.trim(),
        next_action_due_at: nextActionDueDate ? new Date(nextActionDueDate).toISOString() : undefined
      });
      await refreshCurrentPOC();
      showNotify('success', res.message || 'POC Trial successfully completed!');
      if (onPOCCompleted && selectedPOC) {
        onPOCCompleted(selectedPOC);
      }
    } catch (err: any) {
      showNotify('error', err.message || 'POC completion blocked: Required criteria missing.');
    } finally {
      setCompletingPOC(false);
    }
  };

  // Mark POC Not Required (Optional pipeline stage bypass)
  const handleMarkNotRequired = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPOC) return;
    if (!notRequiredReason.trim()) {
      showNotify('error', 'An auditable business reason is mandatory to skip this stage.');
      return;
    }
    setSavingNotRequired(true);
    try {
      const res = await api.markPOCNotRequired(selectedPOC.id, notRequiredReason.trim());
      setShowNotRequiredModal(false);
      setNotRequiredReason('');
      await refreshCurrentPOC();
      showNotify('success', res.message || 'POC marked as NOT REQUIRED with documented audit trail.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to mark POC as Not Required.');
    } finally {
      setSavingNotRequired(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <RefreshCw size={32} className="spin-animation" style={{ margin: '0 auto 16px' }} />
        <div>Loading POC Pilot Trials Workspace...</div>
      </div>
    );
  }

  const scrollToSection = (sectionId: string, focusSelector?: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-section-pulse');
      setTimeout(() => el.classList.remove('highlight-section-pulse'), 2500);
      if (focusSelector) {
        const input = el.querySelector(focusSelector) as HTMLElement;
        if (input) setTimeout(() => input.focus(), 400);
      }
    }
  };

  const getTargetSectionForGate = (gateCodeOrText: string) => {
    const text = (gateCodeOrText || '').toUpperCase();
    if (text.includes('SCOPE') || text.includes('OWNER') || text.includes('DATES') || text.includes('TIMELINE') || text.includes('BOUNDARIES')) {
      return { id: 'poc-section-scope', selector: 'textarea', label: 'Pilot Scope & Timeline' };
    }
    if (text.includes('CRITERIA')) {
      return { id: 'poc-section-criteria', selector: undefined, label: 'Success Criteria' };
    }
    if (text.includes('PARTICIPANT') || text.includes('USER')) {
      return { id: 'poc-section-participants', selector: undefined, label: 'Trial Participants' };
    }
    if (text.includes('RESULT') || text.includes('FEEDBACK') || text.includes('METRIC') || text.includes('SIGN-OFF')) {
      return { id: 'poc-section-results', selector: 'textarea', label: 'Results & Sign-off' };
    }
    if (text.includes('ACTION') || text.includes('ACTIVITY')) {
      return { id: 'poc-section-next-action', selector: 'input', label: 'Next Action' };
    }
    return { id: 'poc-section-scope', selector: undefined, label: 'Missing Section' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Toast Alert */}
      {feedbackMsg && (
        <div
          className="in-app-alert-item"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 99999,
            background: feedbackMsg.type === 'success'
              ? 'linear-gradient(135deg, #059669 0%, #10B981 100%)'
              : 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
            color: '#FFFFFF',
            padding: '14px 20px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '0.88rem',
            fontWeight: 600,
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none'
          }}
        >
          {feedbackMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          {feedbackMsg.text}
        </div>
      )}

      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid var(--accent-cyan)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <FlaskConical size={24} color="var(--accent-cyan)" />
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                POC / Pilot Management Workspace
              </h1>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>
              Proof of Concept Operational Pilots • Configurable Success Criteria • Baseline vs. Verified Results &amp; Customer Sign-Off
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="btn btn-secondary"
              onClick={refreshCurrentPOC}
              disabled={refreshing || !selectedPOC}
              style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={refreshing ? 'spin-animation' : ''} />
              Refresh
            </button>

            <button
              className="btn btn-primary"
              onClick={() => {
                if (leadId && (!selectedPOC || selectedPOC.lead !== leadId)) {
                  handleInitPOC(leadId);
                } else {
                  setShowInitModal(true);
                }
              }}
              disabled={initializingPOC}
              style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} />
              <span>{initializingPOC ? 'Initializing...' : 'New Pilot Trial'}</span>
            </button>

            {selectedPOC && selectedPOC.status !== 'COMPLETED' && selectedPOC.status !== 'NOT_REQUIRED' && (
              <button
                className="btn btn-secondary"
                onClick={() => setShowNotRequiredModal(true)}
                style={{ fontSize: '0.82rem', color: 'var(--warning)', borderColor: 'rgba(245, 158, 11, 0.3)' }}
              >
                Mark as Not Required
              </button>
            )}
          </div>
        </div>

        {/* POC / Lead Selector Dropdown */}
        {pocs.length > 0 && (
          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1, minWidth: '280px' }}>
                <label
                  htmlFor="poc-selector-dropdown"
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Building2 size={14} color="var(--accent-cyan)" />
                  Select Active Pilot Trial ({pocs.length}):
                </label>

                <div style={{ position: 'relative', minWidth: '280px', maxWidth: '420px', flex: 1 }}>
                  <select
                    id="poc-selector-dropdown"
                    value={selectedPOC?.id || ''}
                    onChange={(e) => {
                      const found = pocs.find(p => p.id === e.target.value);
                      if (found) selectPOCRecord(found);
                    }}
                    className="form-select"
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      padding: '8px 36px 8px 12px',
                      cursor: 'pointer'
                    }}
                  >
                    {pocs.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.account_name || 'Unnamed Account'} — {p.status}{p.product_name ? ` • ${p.product_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedPOC && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background:
                        selectedPOC.status === 'COMPLETED'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : selectedPOC.status === 'NOT_REQUIRED'
                          ? 'rgba(239, 68, 68, 0.15)'
                          : 'rgba(6, 182, 212, 0.15)',
                      color:
                        selectedPOC.status === 'COMPLETED'
                          ? '#10B981'
                          : selectedPOC.status === 'NOT_REQUIRED'
                          ? '#EF4444'
                          : 'var(--accent-cyan)',
                      border: `1px solid ${
                        selectedPOC.status === 'COMPLETED'
                          ? 'rgba(16, 185, 129, 0.3)'
                          : selectedPOC.status === 'NOT_REQUIRED'
                          ? 'rgba(239, 68, 68, 0.3)'
                          : 'rgba(6, 182, 212, 0.3)'
                      }`
                    }}
                  >
                    {selectedPOC.status}
                  </span>

                  {selectedPOC.product_name && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: 'var(--bg-surface-elevated)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      {selectedPOC.product_name}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {!selectedPOC ? (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <FlaskConical size={48} color="var(--accent-cyan)" style={{ opacity: 0.6, margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
            No Active POC Pilot Trial Selected
          </h3>
          <p style={{ maxWidth: '520px', margin: '0 auto 24px', fontSize: '0.9rem', lineHeight: 1.5 }}>
            {leadId
              ? 'A POC Pilot Trial has not been initialized yet for this lead. Initialize now to begin a 30-day operational trial with pre-seeded success criteria.'
              : 'There are no active POC pilot trials selected. Select an existing trial from above or initialize a new pilot trial for any account.'}
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            {leadId ? (
              <button
                className="btn btn-primary"
                onClick={() => handleInitPOC(leadId)}
                disabled={initializingPOC}
                style={{ padding: '10px 24px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Plus size={16} />
                <span>{initializingPOC ? 'Initializing Pilot Trial...' : 'Initialize Pilot Trial for Current Lead'}</span>
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() => setShowInitModal(true)}
                style={{ padding: '10px 24px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Plus size={16} />
                <span>Initialize New POC Pilot Trial</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          {/* LEFT COLUMN: Scope, Users, Success Criteria, Baseline & Results, Feedback, Next Action */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* CARD 1: Core Context & Operational Scope */}
            <div id="poc-section-scope" className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={18} color="var(--accent-cyan)" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>PILOT SCOPE &amp; OPERATIONAL BOUNDARIES</h3>
                </div>
                <span className={`badge ${selectedPOC.status === 'COMPLETED' ? 'badge-success' : selectedPOC.status === 'NOT_REQUIRED' ? 'badge-neutral' : 'badge-warning'}`}>
                  {selectedPOC.status}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                <div style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>TARGET ACCOUNT</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, marginTop: '4px' }}>{selectedPOC.account_name}</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PRODUCT</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, marginTop: '4px', color: 'var(--primary)' }}>
                    {selectedPOC.product_name || 'VanForces™'}
                  </div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>TRIAL LEAD ENGINEER</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, marginTop: '4px' }}>
                    {selectedPOC.owner_name || 'Assigned Deployment Engineer'}
                  </div>
                </div>
              </div>

              {/* Scope form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    POC Scope Description *
                  </label>
                  <textarea
                    rows={2}
                    value={scopeDesc}
                    onChange={(e) => setScopeDesc(e.target.value)}
                    placeholder="Document exact operational capabilities and boundaries tested in pilot..."
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Geography / Fleet Coverage</label>
                    <input
                      type="text"
                      placeholder="e.g. Dammam & Khobar Commercial District"
                      value={geography}
                      onChange={(e) => setGeography(e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.82rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Users / Vans Count</label>
                    <input
                      type="number"
                      min={1}
                      value={usersCount}
                      onChange={(e) => setUsersCount(Number(e.target.value))}
                      style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.82rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.82rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.82rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={handleSaveScope}
                    disabled={savingScope}
                    style={{ fontSize: '0.82rem' }}
                  >
                    {savingScope ? 'Saving...' : 'Save Parameters'}
                  </button>
                </div>
              </div>

              {selectedPOC.status === 'NOT_REQUIRED' && selectedPOC.not_required_reason && (
                <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', fontSize: '0.85rem' }}>
                  <strong style={{ color: 'var(--warning)' }}>Stage Waived (Not Required): </strong>
                  {selectedPOC.not_required_reason}
                </div>
              )}
            </div>

            {/* CARD 2: CONFIGURABLE SUCCESS CRITERIA */}
            <div id="poc-section-criteria" className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Target size={18} color="var(--primary)" />
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>CONFIGURABLE SUCCESS CRITERIA</h3>
                    <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                      {selectedPOC.criteria_items?.length || 0} Defined
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '4px 0 0' }}>
                    Mandatory for trial completion. Defines measurable targets vs customer baseline.
                  </p>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={() => setShowAddCritModal(true)}
                  style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}
                >
                  <Plus size={14} /> Add Criterion
                </button>
              </div>

              {(!selectedPOC.criteria_items || selectedPOC.criteria_items.length === 0) ? (
                <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No success criteria defined. A POC cannot be completed without at least 1 measurable success criterion.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedPOC.criteria_items.map(crit => (
                    <div
                      key={crit.id}
                      style={{
                        padding: '14px 16px',
                        background: 'var(--bg-surface)',
                        borderRadius: '8px',
                        borderLeft: crit.is_met ? '3px solid var(--success)' : '3px solid var(--warning)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontWeight: 800, fontSize: '0.92rem' }}>{crit.name}</span>
                          <span className="badge badge-neutral" style={{ marginLeft: '8px', fontSize: '0.65rem' }}>
                            {crit.category}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: crit.is_met ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: crit.is_met ? 'var(--success)' : 'var(--warning)'
                          }}>
                            {crit.is_met ? '✓ TARGET MET' : '⏳ PENDING VERIFICATION'}
                          </span>

                          <button
                            onClick={() => {
                              setEditingCrit(crit);
                              setEditActualResult(crit.actual_result || '');
                              setEditIsMet(crit.is_met);
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px' }}
                            title="Update Result"
                          >
                            <Edit3 size={15} />
                          </button>

                          <button
                            onClick={() => handleDeleteCrit(crit.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                            title="Delete Criterion"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '0.8rem', background: 'var(--bg-surface-elevated)', padding: '10px', borderRadius: '6px' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>BASELINE MEASUREMENT</div>
                          <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{crit.measurement_baseline}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>EXPECTED TARGET</div>
                          <div style={{ color: 'var(--primary)', fontWeight: 600, marginTop: '2px' }}>{crit.expected_target}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ACTUAL PILOT RESULT</div>
                          <div style={{ color: crit.is_met ? 'var(--success)' : 'var(--warning)', fontWeight: 700, marginTop: '2px' }}>
                            {crit.actual_result || 'Pending live measurement'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CARD 3: PILOT PARTICIPANTS & USERS */}
            <div id="poc-section-participants" className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={18} color="var(--accent-purple)" />
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>TRIAL PARTICIPANTS &amp; PILOT USERS</h3>
                    <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                      {selectedPOC.participants?.length || 0} Registered
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '4px 0 0' }}>
                    Field drivers, warehouse depot managers, and deployment engineers evaluating trial software.
                  </p>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={() => setShowAddPartModal(true)}
                  style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}
                >
                  <Plus size={14} /> Add User
                </button>
              </div>

              {(!selectedPOC.participants || selectedPOC.participants.length === 0) ? (
                <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No active pilot participants linked.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                  {selectedPOC.participants.map(part => (
                    <div
                      key={part.id}
                      style={{
                        padding: '10px 14px',
                        background: 'var(--bg-surface)',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{part.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {part.role_title || 'Pilot User'} • {part.participant_type}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteParticipant(part.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                        title="Remove user"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CARD 4: BASELINE, VERIFIED RESULTS & CUSTOMER FEEDBACK */}
            <div id="poc-section-results" className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart3 size={18} color="var(--success)" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>BASELINE, VERIFIED RESULTS &amp; CUSTOMER SIGN-OFF</h3>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '4px 0 0' }}>
                  WHAT DID IT PROVE? Capture pre-pilot baseline, actual measured results, and verified customer feedback.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Customer Baseline Measurements (Pre-POC)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Drivers carried paper carbon-copy pads; reconciliation backlogs averaged 4.5 hours per driver..."
                    value={baselineNotes}
                    onChange={(e) => setBaselineNotes(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Verified Trial Results Summary * <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Mandatory for completion)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Pilot verified: All 15 vans synced daily within 18 minutes; zero lost invoices over 30 days..."
                    value={resultsSummary}
                    onChange={(e) => setResultsSummary(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Customer Feedback &amp; Executive Sign-off * <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Mandatory for completion)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. VP Operations confirmed the pilot exceeded all operational benchmarks. Fleet drivers fully adapted within 3 days..."
                    value={customerFeedback}
                    onChange={(e) => setCustomerFeedback(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={isSuccessful}
                      onChange={(e) => setIsSuccessful(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--success)' }}
                    />
                    <span>POC Trial Deemed Successful by Stakeholders</span>
                  </label>

                  <button
                    className="btn btn-secondary"
                    onClick={handleSaveResults}
                    disabled={savingResults}
                    style={{ fontSize: '0.82rem' }}
                  >
                    {savingResults ? 'Saving...' : 'Save Results & Feedback'}
                  </button>
                </div>
              </div>
            </div>

            {/* CARD 5: NEXT ACTION */}
            <div id="poc-section-next-action" className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} color="var(--primary)" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>MANDATORY NEXT ACTION</h3>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '4px 0 0' }}>
                  WHAT HAPPENS NEXT? Every active or completed trial must commit to a concrete next step towards SQL conversion.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '12px', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Next Action Description *</label>
                  <input
                    type="text"
                    placeholder="e.g. Present final trial benchmark report to CFO and proceed to commercial SQL handoff..."
                    value={nextActionDesc}
                    onChange={(e) => setNextActionDesc(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.82rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Due Date</label>
                  <input
                    type="date"
                    value={nextActionDueDate}
                    onChange={(e) => setNextActionDueDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.82rem' }}
                  />
                </div>

                <button
                  className="btn btn-secondary"
                  onClick={handleSaveNextAction}
                  disabled={savingNextAction}
                  style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                >
                  {savingNextAction ? 'Saving...' : 'Save Next Action'}
                </button>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: POC Readiness Gate & SQL Progression */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* READINESS CHECKLIST CARD */}
            <div className="glass-panel" style={{ padding: '24px', borderTop: '4px solid var(--success)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>POC READINESS</h3>
                <span className={`badge ${readiness?.is_ready ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.72rem' }}>
                  {readiness?.is_ready ? 'STATUS: READY' : 'STATUS: NOT READY'}
                </span>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '18px' }}>
                Backend Gate Validation: A POC cannot be marked complete unless scope, owner, dates, criteria, results, and feedback are verified.
              </p>

              {/* Checklist items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {readiness?.checklist.map(item => {
                  const isDone = item.status === 'COMPLETED';
                  const target = getTargetSectionForGate(item.gate_code);

                  return (
                    <div
                      key={item.gate_code}
                      onClick={() => {
                        if (!isDone) {
                          if (item.gate_code === 'POC_CRITERIA' && (!selectedPOC.criteria_items || selectedPOC.criteria_items.length === 0)) {
                            setShowAddCritModal(true);
                          } else {
                            scrollToSection(target.id, target.selector);
                          }
                        }
                      }}
                      style={{
                        padding: '10px 12px',
                        background: 'var(--bg-surface)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderLeft: isDone ? '3px solid var(--success)' : '3px solid var(--danger)',
                        cursor: isDone ? 'default' : 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isDone) e.currentTarget.style.borderColor = 'var(--primary)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isDone) e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      }}
                      title={!isDone ? `Click to jump to ${target.label} and fill missing data` : undefined}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isDone ? (
                          <CheckCircle2 size={16} color="var(--success)" />
                        ) : (
                          <XCircle size={16} color="var(--danger)" />
                        )}
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{item.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.description}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: isDone ? 'var(--success)' : 'var(--danger)'
                        }}>
                          {isDone ? 'READY' : 'MISSING'}
                        </span>
                        {!isDone && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700 }}>➔</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Missing Fields Explanations */}
              {readiness && !readiness.is_ready && readiness.missing_fields.length > 0 && (
                <div style={{ padding: '14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--danger)', marginBottom: '4px' }}>
                    POC cannot be completed:
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Click any missing item below to jump directly to it:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {readiness.missing_fields.map((mf, i) => {
                      const target = getTargetSectionForGate(mf);
                      return (
                        <div
                          key={i}
                          onClick={() => {
                            if (mf.toLowerCase().includes('criteria') && (!selectedPOC.criteria_items || selectedPOC.criteria_items.length === 0)) {
                              setShowAddCritModal(true);
                            } else {
                              scrollToSection(target.id, target.selector);
                            }
                          }}
                          style={{
                            padding: '6px 10px',
                            background: 'var(--bg-surface)',
                            borderRadius: '6px',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            color: 'var(--text-primary)',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)'}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertCircle size={13} color="var(--danger)" />
                            {mf}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700 }}>
                            Fill In ➔
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleCompletePOC}
                  disabled={completingPOC || !readiness?.is_ready || selectedPOC.status === 'COMPLETED'}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    opacity: readiness?.is_ready && selectedPOC.status !== 'COMPLETED' ? 1 : 0.6,
                    cursor: readiness?.is_ready && selectedPOC.status !== 'COMPLETED' ? 'pointer' : 'not-allowed'
                  }}
                >
                  {selectedPOC.status === 'COMPLETED' ? '✓ POC Already Completed' : completingPOC ? 'Verifying Gates...' : 'Complete POC'}
                </button>

                {/* Downstream SQL Progression */}
                {selectedPOC.status === 'COMPLETED' && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => onNavigateToSQL && selectedPOC.lead && onNavigateToSQL(selectedPOC.lead)}
                    style={{ width: '100%', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <span>Proceed to SQL Gate Preparation</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 1: ADD SUCCESS CRITERION */}
      <Modal
        isOpen={showAddCritModal}
        onClose={() => setShowAddCritModal(false)}
        title="Define POC Success Criterion"
        subtitle="Add measurable customer operational or compliance test criteria."
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Target size={20} />
          </div>
        }
        maxWidth="520px"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowAddCritModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-criterion-form"
              className="btn btn-primary"
              disabled={savingCrit}
            >
              {savingCrit ? 'Saving...' : 'Add Criterion'}
            </button>
          </>
        }
      >
        <form id="add-criterion-form" onSubmit={handleAddCriterion}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Criterion Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Daily Van Invoicing & Reconciliation Latency"
                value={critName}
                onChange={(e) => setCritName(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Category</label>
              <select
                value={critCategory}
                onChange={(e) => setCritCategory(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
              >
                <option value="OPERATIONAL_EFFICIENCY">Operational Efficiency</option>
                <option value="FINANCIAL_REVENUE">Financial & Revenue Reconciliation</option>
                <option value="COMPLIANCE">Regulatory & ZATCA Compliance</option>
                <option value="USER_ADOPTION">Driver / User Adoption</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Customer Baseline Measurement *</label>
              <input
                type="text"
                required
                placeholder="e.g. 4.5 hours manual depot cash reconciliation every evening"
                value={critBaseline}
                onChange={(e) => setCritBaseline(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Expected Target *</label>
              <input
                type="text"
                required
                placeholder="e.g. < 25 minutes automated end-of-day van settlement"
                value={critTarget}
                onChange={(e) => setCritTarget(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Notes / Testing Procedure</label>
              <input
                type="text"
                placeholder="e.g. Measured via automated cloud sync telemetry across all 15 vans"
                value={critNotes}
                onChange={(e) => setCritNotes(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: UPDATE CRITERION RESULT */}
      <Modal
        isOpen={!!editingCrit}
        onClose={() => setEditingCrit(null)}
        title="Record Actual Result"
        subtitle={editingCrit ? `Criterion: ${editingCrit.name} (Target: ${editingCrit.expected_target})` : undefined}
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={20} />
          </div>
        }
        maxWidth="480px"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditingCrit(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="save-crit-result-form"
              className="btn btn-primary"
              disabled={updatingCrit}
            >
              {updatingCrit ? 'Saving...' : 'Save Result'}
            </button>
          </>
        }
      >
        <form id="save-crit-result-form" onSubmit={handleSaveCritResult}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Actual Measured Result *</label>
              <input
                type="text"
                required
                placeholder="e.g. 18 minutes average daily settlement across 15 vans"
                value={editActualResult}
                onChange={(e) => setEditActualResult(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={editIsMet}
                onChange={(e) => setEditIsMet(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--success)' }}
              />
              <span style={{ fontWeight: 600 }}>Target Successfully Met</span>
            </label>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: ADD PARTICIPANT */}
      <Modal
        isOpen={showAddPartModal}
        onClose={() => setShowAddPartModal(false)}
        title="Add Trial Participant"
        subtitle="Record stakeholder, pilot user, or deployment engineer."
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} />
          </div>
        }
        maxWidth="480px"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowAddPartModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-participant-form"
              className="btn btn-primary"
              disabled={savingPart}
            >
              {savingPart ? 'Adding...' : 'Add Participant'}
            </button>
          </>
        }
      >
        <form id="add-participant-form" onSubmit={handleAddParticipant}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Participant Type *</label>
              <select
                value={partType}
                onChange={(e: any) => setPartType(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
              >
                <option value="PILOT_USER">Pilot Field User / Driver</option>
                <option value="ENGINEER">Technical Deployment Engineer</option>
                <option value="CUSTOMER">Customer Stakeholder / Manager</option>
                <option value="INTERNAL">Internal Team</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Tariq Al-Ghamdi"
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Email Address *</label>
              <input
                type="email"
                required
                placeholder="e.g. tariq@distribution.sa"
                value={partEmail}
                onChange={(e) => setPartEmail(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Role / Title</label>
              <input
                type="text"
                placeholder="e.g. Senior Fleet Van Driver"
                value={partRole}
                onChange={(e) => setPartRole(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: STAGE NOT REQUIRED (OPTIONAL PIPELINE BYPASS) */}
      <Modal
        isOpen={showNotRequiredModal}
        onClose={() => setShowNotRequiredModal(false)}
        title="Mark POC Pilot as NOT REQUIRED"
        subtitle="If POC is configured as OPTIONAL in the product pipeline, you may waive the trial stage. You must record an auditable business reason."
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={20} />
          </div>
        }
        maxWidth="500px"
        accentGradient="linear-gradient(90deg, #F59E0B 0%, #D97706 100%)"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowNotRequiredModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="mark-not-required-form"
              className="btn btn-primary"
              disabled={savingNotRequired}
              style={{ background: 'var(--warning)', borderColor: 'var(--warning)', color: '#000000', fontWeight: 800 }}
            >
              {savingNotRequired ? 'Recording...' : 'Confirm Waiver & Skip Stage'}
            </button>
          </>
        }
      >
        <form id="mark-not-required-form" onSubmit={handleMarkNotRequired}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Auditable Waiver Reason *
            </label>
            <textarea
              rows={4}
              required
              placeholder="e.g. Customer waived 30-day POC trial after reviewing on-site reference architecture at Al-Munajem distribution hub; proceeding directly to SQL."
              value={notRequiredReason}
              onChange={(e) => setNotRequiredReason(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.85rem' }}
            />
          </div>
        </form>
      </Modal>

      {/* MODAL 5: INITIALIZE POC PILOT TRIAL */}
      <Modal
        isOpen={showInitModal}
        onClose={() => setShowInitModal(false)}
        title="Initialize POC Pilot Trial"
        subtitle="Establish a structured 30-day operational trial workspace with baseline KPIs and evaluation gates."
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FlaskConical size={20} />
          </div>
        }
        maxWidth="520px"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowInitModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleInitPOC(initLeadId)}
              disabled={initializingPOC || !initLeadId}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} />
              <span>{initializingPOC ? 'Initializing...' : 'Initialize Pilot Trial'}</span>
            </button>
          </>
        }
      >
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
            TARGET ACCOUNT / LEAD
          </label>
          <select
            className="input-field"
            value={initLeadId}
            onChange={(e) => setInitLeadId(e.target.value)}
            style={{ width: '100%', padding: '10px', fontSize: '0.85rem', background: 'var(--bg-surface)' }}
          >
            <option value="">-- Choose an Account / Lead --</option>
            {availableLeads.map(l => (
              <option key={l.id} value={l.id}>
                {l.account_name || 'Account'} ({l.primary_product_name || 'Product'}) - Stage: {l.current_stage_name || l.status}
              </option>
            ))}
          </select>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Success criteria will be automatically populated from confirmed Discovery problems and product solution capabilities.
          </p>
        </div>
      </Modal>
    </div>
  );
};
