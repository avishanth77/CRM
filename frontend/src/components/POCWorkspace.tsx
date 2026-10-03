import React, { useState, useEffect } from 'react';
import {
  FlaskConical, CheckCircle2, AlertTriangle, XCircle, Clock,
  ArrowRight, RefreshCw, Plus, Trash2,
  Building2, Users, Target,
  MapPin, BarChart3, Edit3
} from 'lucide-react';
import { api } from '../services/api';
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
  const [usersCount, setUsersCount] = useState(15);
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

  const showNotify = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  useEffect(() => {
    loadPOCs();
  }, [leadId, initialPOCId]);

  const loadPOCs = async () => {
    setLoading(true);
    try {
      const res = await api.getPOCs(leadId ? { lead: leadId } : undefined);
      setPocs(res.results);

      let active: POC | null = null;
      if (initialPOCId) {
        active = res.results.find(p => p.id === initialPOCId) || null;
      }
      if (!active && res.results.length > 0) {
        active = res.results[0];
      }
      if (active) {
        selectPOCRecord(active);
      }
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to load POC trials');
    } finally {
      setLoading(false);
    }
  };

  const selectPOCRecord = async (poc: POC) => {
    setSelectedPOC(poc);
    setScopeDesc(poc.scope_description || '');
    setGeography(poc.geography_coverage || '');
    setUsersCount(poc.users_count || 15);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Toast Alert */}
      {feedbackMsg && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          background: feedbackMsg.type === 'success'
            ? 'linear-gradient(135deg, #059669 0%, #10B981 100%)'
            : 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
          color: '#FFFFFF',
          padding: '14px 20px',
          borderRadius: '10px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.88rem',
          fontWeight: 600,
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
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
              <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>Phase 6</span>
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

        {/* POC Selector Pill Carousel */}
        {pocs.length > 0 && (
          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Select Active Pilot Trial ({pocs.length}):
            </div>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
              {pocs.map(p => {
                const isSelected = selectedPOC?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => selectPOCRecord(p)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: isSelected ? 'var(--accent-cyan)' : 'var(--bg-surface-elevated)',
                      color: isSelected ? '#000000' : 'var(--text-secondary)',
                      border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Building2 size={14} />
                    <span>{p.account_name}</span>
                    <span style={{
                      fontSize: '0.68rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: p.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                      color: p.status === 'COMPLETED' ? '#10B981' : 'inherit'
                    }}>
                      {p.status}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {!selectedPOC ? (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <FlaskConical size={48} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            No POC Pilot Record Selected
          </h3>
          <p style={{ maxWidth: '500px', margin: '0 auto', fontSize: '0.9rem' }}>
            Please select an existing POC record above or progress a Demo session to begin pilot trial onboarding.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          {/* LEFT COLUMN: Scope, Users, Success Criteria, Baseline & Results, Feedback, Next Action */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* CARD 1: Core Context & Operational Scope */}
            <div className="glass-panel" style={{ padding: '20px' }}>
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
            <div className="glass-panel" style={{ padding: '20px' }}>
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
            <div className="glass-panel" style={{ padding: '20px' }}>
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
            <div className="glass-panel" style={{ padding: '20px' }}>
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
            <div className="glass-panel" style={{ padding: '20px' }}>
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
                  return (
                    <div
                      key={item.gate_code}
                      style={{
                        padding: '10px 12px',
                        background: 'var(--bg-surface)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderLeft: isDone ? '3px solid var(--success)' : '3px solid var(--danger)'
                      }}
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

                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: isDone ? 'var(--success)' : 'var(--danger)'
                      }}>
                        {isDone ? 'READY' : 'MISSING'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Missing Fields Explanations */}
              {readiness && !readiness.is_ready && readiness.missing_fields.length > 0 && (
                <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--danger)', marginBottom: '4px' }}>
                    POC cannot be completed.
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Missing items:</div>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    {readiness.missing_fields.map((mf, i) => (
                      <li key={i}>{mf}</li>
                    ))}
                  </ul>
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
      {showAddCritModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-panel" style={{ width: '500px', padding: '24px', background: 'var(--bg-surface-elevated)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>Define POC Success Criterion</h3>
            <form onSubmit={handleAddCriterion}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Criterion Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Daily Van Invoicing & Reconciliation Latency"
                    value={critName}
                    onChange={(e) => setCritName(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Category</label>
                  <select
                    value={critCategory}
                    onChange={(e) => setCritCategory(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                  >
                    <option value="OPERATIONAL_EFFICIENCY">Operational Efficiency</option>
                    <option value="FINANCIAL_REVENUE">Financial & Revenue Reconciliation</option>
                    <option value="COMPLIANCE">Regulatory & ZATCA Compliance</option>
                    <option value="USER_ADOPTION">Driver / User Adoption</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Customer Baseline Measurement *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 4.5 hours manual depot cash reconciliation every evening"
                    value={critBaseline}
                    onChange={(e) => setCritBaseline(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Expected Target *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. < 25 minutes automated end-of-day van settlement"
                    value={critTarget}
                    onChange={(e) => setCritTarget(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Notes / Testing Procedure</label>
                  <input
                    type="text"
                    placeholder="e.g. Measured via automated cloud sync telemetry across all 15 vans"
                    value={critNotes}
                    onChange={(e) => setCritNotes(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddCritModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingCrit}
                >
                  {savingCrit ? 'Saving...' : 'Add Criterion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: UPDATE CRITERION RESULT */}
      {editingCrit && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-panel" style={{ width: '480px', padding: '24px', background: 'var(--bg-surface-elevated)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px' }}>Record Actual Result</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
              Criterion: <strong>{editingCrit.name}</strong> (Target: {editingCrit.expected_target})
            </p>

            <form onSubmit={handleSaveCritResult}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Actual Measured Result *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 18 minutes average daily settlement across 15 vans"
                    value={editActualResult}
                    onChange={(e) => setEditActualResult(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={editIsMet}
                    onChange={(e) => setEditIsMet(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--success)' }}
                  />
                  <span>Target Successfully Met</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingCrit(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updatingCrit}
                >
                  {updatingCrit ? 'Saving...' : 'Save Result'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD PARTICIPANT */}
      {showAddPartModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-panel" style={{ width: '460px', padding: '24px', background: 'var(--bg-surface-elevated)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>Add Trial Participant</h3>
            <form onSubmit={handleAddParticipant}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Participant Type *</label>
                  <select
                    value={partType}
                    onChange={(e: any) => setPartType(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                  >
                    <option value="PILOT_USER">Pilot Field User / Driver</option>
                    <option value="ENGINEER">Technical Deployment Engineer</option>
                    <option value="CUSTOMER">Customer Stakeholder / Manager</option>
                    <option value="INTERNAL">Internal Team</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tariq Al-Ghamdi"
                    value={partName}
                    onChange={(e) => setPartName(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. tariq@distribution.sa"
                    value={partEmail}
                    onChange={(e) => setPartEmail(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Role / Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Fleet Van Driver"
                    value={partRole}
                    onChange={(e) => setPartRole(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddPartModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingPart}
                >
                  {savingPart ? 'Adding...' : 'Add Participant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: STAGE NOT REQUIRED (OPTIONAL PIPELINE BYPASS) */}
      {showNotRequiredModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-panel" style={{ width: '480px', padding: '24px', background: 'var(--bg-surface-elevated)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px', color: 'var(--warning)' }}>
              Mark POC Pilot as NOT REQUIRED
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
              If POC is configured as OPTIONAL in the product pipeline, you may waive the trial stage. You must record an auditable business reason.
            </p>

            <form onSubmit={handleMarkNotRequired}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                  Auditable Waiver Reason *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Customer waived 30-day POC trial after reviewing on-site reference architecture at Al-Munajem distribution hub; proceeding directly to SQL."
                  value={notRequiredReason}
                  onChange={(e) => setNotRequiredReason(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowNotRequiredModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingNotRequired}
                  style={{ background: 'var(--warning)', borderColor: 'var(--warning)', color: '#000000', fontWeight: 800 }}
                >
                  {savingNotRequired ? 'Recording...' : 'Confirm Waiver & Skip Stage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
