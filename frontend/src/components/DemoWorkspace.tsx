import React, { useState, useEffect } from 'react';
import {
  Monitor, CheckCircle2, AlertTriangle, XCircle, Clock,
  ArrowRight, RefreshCw, Plus, Trash2,
  Building2, Layers, Users, Target,
  MessageSquare, AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import type { Demo, DemoReadiness } from '../services/api';

interface DemoWorkspaceProps {
  initialDemoId?: string;
  leadId?: string;
  onDemoCompleted?: (demo: Demo) => void;
  onNavigateToPOC?: (leadId: string) => void;
  onNavigateToSQL?: (leadId: string) => void;
}

export const DemoWorkspace: React.FC<DemoWorkspaceProps> = ({
  initialDemoId,
  leadId,
  onDemoCompleted,
  onNavigateToPOC,
  onNavigateToSQL
}) => {
  const [demos, setDemos] = useState<Demo[]>([]);
  const [selectedDemo, setSelectedDemo] = useState<Demo | null>(null);
  const [readiness, setReadiness] = useState<DemoReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Participant Form Modal
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [partName, setPartName] = useState('');
  const [partEmail, setPartEmail] = useState('');
  const [partType, setPartType] = useState<'CUSTOMER' | 'INTERNAL'>('CUSTOMER');
  const [partRoleTitle, setPartRoleTitle] = useState('');
  const [partNotes, setPartNotes] = useState('');
  const [savingParticipant, setSavingParticipant] = useState(false);

  // Use Case Mapping
  const [availableDiscoveryProblems, setAvailableDiscoveryProblems] = useState<any[]>([]);
  const [availableCapabilities, setAvailableCapabilities] = useState<any[]>([]);
  const [selectedProblemId, setSelectedProblemId] = useState('');
  const [selectedCapabilityId, setSelectedCapabilityId] = useState('');
  const [useCaseNotes, setUseCaseNotes] = useState('');
  const [savingUseCase, setSavingUseCase] = useState(false);

  // Post-Demo Feedback & Objections Form
  const [customerFeedback, setCustomerFeedback] = useState('');
  const [objectionsRaised, setObjectionsRaised] = useState('');
  const [customerQuestions, setCustomerQuestions] = useState('');
  const [customerResponse, setCustomerResponse] = useState('');
  const [fitAssessment, setFitAssessment] = useState<'STRONG' | 'MODERATE' | 'POOR'>('STRONG');
  const [savingFeedback, setSavingFeedback] = useState(false);

  // Next Action Form
  const [nextActionDesc, setNextActionDesc] = useState('');
  const [nextActionDueDate, setNextActionDueDate] = useState('');
  const [savingNextAction, setSavingNextAction] = useState(false);

  // Stage "Not Required" Modal
  const [showNotRequiredModal, setShowNotRequiredModal] = useState(false);
  const [notRequiredReason, setNotRequiredReason] = useState('');
  const [savingNotRequired, setSavingNotRequired] = useState(false);

  // Complete Demo Modal / Action
  const [completingDemo, setCompletingDemo] = useState(false);

  const showNotify = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  useEffect(() => {
    loadDemos();
  }, [leadId, initialDemoId]);

  const loadDemos = async () => {
    setLoading(true);
    try {
      const res = await api.getDemos(leadId ? { lead: leadId } : undefined);
      setDemos(res.results);

      let active: Demo | null = null;
      if (initialDemoId) {
        active = res.results.find(d => d.id === initialDemoId) || null;
      }
      if (!active && res.results.length > 0) {
        active = res.results[0];
      }
      if (active) {
        selectDemoRecord(active);
      }
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to load demos');
    } finally {
      setLoading(false);
    }
  };

  const selectDemoRecord = async (demo: Demo) => {
    setSelectedDemo(demo);
    setCustomerFeedback(demo.customer_feedback || '');
    setObjectionsRaised(demo.objections_raised || '');
    setCustomerQuestions(demo.customer_questions || '');
    setCustomerResponse(demo.customer_response || '');
    setFitAssessment(demo.fit_assessment || 'STRONG');
    setNextActionDesc(demo.next_action_description || '');
    setNextActionDueDate(demo.next_action_due_at ? demo.next_action_due_at.split('T')[0] : '');

    await loadReadiness(demo.id);

    // If discovery is attached, load discovery problems and product capabilities for mapping
    if (demo.discovery) {
      try {
        const disc = await api.getDiscovery(demo.discovery);
        if (disc.problems) {
          setAvailableDiscoveryProblems(disc.problems);
        }
      } catch (e) {
        // ignore
      }
    }
    if (demo.product) {
      try {
        const prods = await api.getProducts();
        const p = prods.results.find(x => x.id === demo.product);
        if (p && p.modules) {
          const caps: any[] = [];
          p.modules.forEach(m => {
            if (m.capabilities) {
              m.capabilities.forEach(c => caps.push({ ...c, moduleName: m.name, moduleId: m.id }));
            }
          });
          setAvailableCapabilities(caps);
        }
      } catch (e) {
        // ignore
      }
    }
  };

  const loadReadiness = async (demoId: string) => {
    try {
      const ready = await api.getDemoReadiness(demoId);
      setReadiness(ready);
    } catch (err: any) {
      console.error('Readiness error:', err);
    }
  };

  const refreshCurrentDemo = async () => {
    if (!selectedDemo) return;
    setRefreshing(true);
    try {
      const updated = await api.getDemo(selectedDemo.id);
      setSelectedDemo(updated);
      await loadReadiness(updated.id);
      showNotify('success', 'Demo data refreshed.');
    } catch (err: any) {
      showNotify('error', 'Failed to refresh demo.');
    } finally {
      setRefreshing(false);
    }
  };

  // Add Participant
  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDemo) return;
    if (!partName.trim() || !partEmail.trim()) {
      showNotify('error', 'Name and Email are required.');
      return;
    }
    setSavingParticipant(true);
    try {
      await api.addDemoParticipant(selectedDemo.id, {
        name: partName.trim(),
        email: partEmail.trim(),
        participant_type: partType,
        role_title: partRoleTitle.trim(),
        notes: partNotes.trim(),
        attended: true
      });
      setShowAddParticipantModal(false);
      setPartName('');
      setPartEmail('');
      setPartRoleTitle('');
      setPartNotes('');
      await refreshCurrentDemo();
      showNotify('success', 'Participant successfully added.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to add participant.');
    } finally {
      setSavingParticipant(false);
    }
  };

  // Remove Participant
  const handleDeleteParticipant = async (partId: string) => {
    if (!window.confirm('Remove this participant from Demo?')) return;
    try {
      await api.deleteDemoParticipant(partId);
      await refreshCurrentDemo();
      showNotify('success', 'Participant removed.');
    } catch (err: any) {
      showNotify('error', 'Failed to delete participant.');
    }
  };

  // Map Use Case
  const handleMapUseCase = async () => {
    if (!selectedDemo) return;
    if (!selectedProblemId && !selectedCapabilityId) {
      showNotify('error', 'Please select a Customer Problem or Product Capability to demonstrate.');
      return;
    }
    setSavingUseCase(true);
    try {
      await api.mapDemoUseCase(selectedDemo.id, {
        discovery_problem_id: selectedProblemId || undefined,
        capability_id: selectedCapabilityId || undefined,
        notes: useCaseNotes.trim(),
        was_demonstrated: true
      });
      setSelectedProblemId('');
      setSelectedCapabilityId('');
      setUseCaseNotes('');
      await refreshCurrentDemo();
      showNotify('success', 'Demonstrated capability mapped.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to map use case.');
    } finally {
      setSavingUseCase(false);
    }
  };

  // Unmap Use Case
  const handleUnmapUseCase = async (mappingId: string) => {
    if (!selectedDemo) return;
    try {
      await api.unmapDemoUseCase(selectedDemo.id, mappingId);
      await refreshCurrentDemo();
      showNotify('success', 'Demonstrated capability unmapped.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to unmap capability.');
    }
  };

  // Save Customer Feedback
  const handleSaveFeedback = async () => {
    if (!selectedDemo) return;
    if (!customerFeedback.trim()) {
      showNotify('error', 'Customer feedback is mandatory.');
      return;
    }
    setSavingFeedback(true);
    try {
      const updated = await api.updateDemo(selectedDemo.id, {
        customer_feedback: customerFeedback.trim(),
        objections_raised: objectionsRaised.trim(),
        customer_questions: customerQuestions.trim(),
        customer_response: customerResponse.trim(),
        fit_assessment: fitAssessment
      });
      setSelectedDemo(updated);
      await loadReadiness(selectedDemo.id);
      showNotify('success', 'Customer feedback and objections saved.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to save feedback.');
    } finally {
      setSavingFeedback(false);
    }
  };

  // Save Next Action
  const handleSaveNextAction = async () => {
    if (!selectedDemo) return;
    if (!nextActionDesc.trim()) {
      showNotify('error', 'Next action description is mandatory.');
      return;
    }
    setSavingNextAction(true);
    try {
      const updated = await api.updateDemo(selectedDemo.id, {
        next_action_description: nextActionDesc.trim(),
        next_action_due_at: nextActionDueDate ? new Date(nextActionDueDate).toISOString() : undefined
      });
      setSelectedDemo(updated);
      await loadReadiness(selectedDemo.id);
      showNotify('success', 'Mandatory next action saved.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to save next action.');
    } finally {
      setSavingNextAction(false);
    }
  };

  // Complete Demo
  const handleCompleteDemo = async () => {
    if (!selectedDemo) return;
    setCompletingDemo(true);
    try {
      const res = await api.completeDemo(selectedDemo.id, {
        customer_feedback: customerFeedback.trim(),
        objections_raised: objectionsRaised.trim(),
        customer_questions: customerQuestions.trim(),
        customer_response: customerResponse.trim(),
        fit_assessment: fitAssessment,
        next_action_description: nextActionDesc.trim(),
        next_action_due_at: nextActionDueDate ? new Date(nextActionDueDate).toISOString() : undefined
      });
      await refreshCurrentDemo();
      showNotify('success', res.message || 'Demo successfully marked COMPLETED!');
      if (onDemoCompleted && selectedDemo) {
        onDemoCompleted(selectedDemo);
      }
    } catch (err: any) {
      showNotify('error', err.message || 'Demo completion blocked: Required gates not satisfied.');
    } finally {
      setCompletingDemo(false);
    }
  };

  // Mark Demo Not Required (Optional pipeline stage bypass)
  const handleMarkNotRequired = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDemo) return;
    if (!notRequiredReason.trim()) {
      showNotify('error', 'An auditable business reason is mandatory to skip this stage.');
      return;
    }
    setSavingNotRequired(true);
    try {
      const res = await api.markDemoNotRequired(selectedDemo.id, notRequiredReason.trim());
      setShowNotRequiredModal(false);
      setNotRequiredReason('');
      await refreshCurrentDemo();
      showNotify('success', res.message || 'Demo marked as NOT REQUIRED with documented audit trail.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to mark Demo as Not Required.');
    } finally {
      setSavingNotRequired(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <RefreshCw size={32} className="spin-animation" style={{ margin: '0 auto 16px' }} />
        <div>Loading Demo Management Workspace...</div>
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
      <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid var(--primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <Monitor size={24} color="var(--primary)" />
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                Demo Workspace
              </h1>
              <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>Phase 6</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>
              Live Product Solution Demonstration • Problem &amp; Capability Proof • Customer Objections &amp; Readiness Gate
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="btn btn-secondary"
              onClick={refreshCurrentDemo}
              disabled={refreshing || !selectedDemo}
              style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={refreshing ? 'spin-animation' : ''} />
              Refresh
            </button>

            {selectedDemo && selectedDemo.status !== 'COMPLETED' && selectedDemo.status !== 'NOT_REQUIRED' && (
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

        {/* Demo Selector Pill Carousel */}
        {demos.length > 0 && (
          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Select Active Demo Record ({demos.length}):
            </div>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
              {demos.map(d => {
                const isSelected = selectedDemo?.id === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => selectDemoRecord(d)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: isSelected ? 'var(--primary)' : 'var(--bg-surface-elevated)',
                      color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                      border: isSelected ? '1px solid var(--primary-hover)' : '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Building2 size={14} />
                    <span>{d.account_name}</span>
                    <span style={{
                      fontSize: '0.68rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: d.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                      color: d.status === 'COMPLETED' ? '#10B981' : 'inherit'
                    }}>
                      {d.status}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {!selectedDemo ? (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Monitor size={48} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            No Demo Record Selected
          </h3>
          <p style={{ maxWidth: '500px', margin: '0 auto', fontSize: '0.9rem' }}>
            Please select an existing Demo session above or complete a Discovery session to transition a lead to Product Demo.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          {/* LEFT COLUMN: Demo Details, Participants, Use Cases, Feedback, Next Action */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* CARD 1: Core Record & Context Header */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={18} color="var(--primary)" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>DEMO SUMMARY &amp; CONTEXT</h3>
                </div>
                <span className={`badge ${selectedDemo.status === 'COMPLETED' ? 'badge-success' : selectedDemo.status === 'NOT_REQUIRED' ? 'badge-neutral' : 'badge-warning'}`}>
                  {selectedDemo.status}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
                <div style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>TARGET ACCOUNT</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, marginTop: '4px' }}>{selectedDemo.account_name}</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PRODUCT</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, marginTop: '4px', color: 'var(--primary)' }}>
                    {selectedDemo.product_name || 'VanForces™'}
                  </div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>SOLUTIONS PRESENTER</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, marginTop: '4px' }}>
                    {selectedDemo.presenter_name || 'Assigned Consultant'}
                  </div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>SCHEDULED DATE</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, marginTop: '4px' }}>
                    {new Date(selectedDemo.scheduled_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {selectedDemo.status === 'NOT_REQUIRED' && selectedDemo.not_required_reason && (
                <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', fontSize: '0.85rem' }}>
                  <strong style={{ color: 'var(--warning)' }}>Stage Waived (Not Required): </strong>
                  {selectedDemo.not_required_reason}
                </div>
              )}
            </div>

            {/* CARD 2: PARTICIPANTS (Customer vs Internal) */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={18} color="var(--accent-cyan)" />
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>DEMO PARTICIPANTS</h3>
                    <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                      {selectedDemo.participants?.length || 0} Registered
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '4px 0 0' }}>
                    Distinguishes customer stakeholders from internal technical presenters.
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowAddParticipantModal(true)}
                  style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}
                >
                  <Plus size={14} /> Add Participant
                </button>
              </div>

              {(!selectedDemo.participants || selectedDemo.participants.length === 0) ? (
                <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <AlertCircle size={20} style={{ margin: '0 auto 6px', opacity: 0.5 }} />
                  No participants registered. At least one customer stakeholder or internal presenter required.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                  {selectedDemo.participants.map(part => {
                    const isCust = part.participant_type === 'CUSTOMER';
                    return (
                      <div
                        key={part.id}
                        style={{
                          padding: '12px 16px',
                          background: 'var(--bg-surface)',
                          borderRadius: '8px',
                          border: isCust ? '1px solid rgba(56, 189, 248, 0.2)' : '1px solid rgba(139, 92, 246, 0.2)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{part.name}</span>
                            <span style={{
                              fontSize: '0.65rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              background: isCust ? 'rgba(56, 189, 248, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                              color: isCust ? '#38BDF8' : '#A78BFA'
                            }}>
                              {isCust ? 'CUSTOMER' : 'INTERNAL'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {part.role_title || 'Stakeholder'} • {part.email}
                          </div>
                          {part.notes && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                              "{part.notes}"
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => handleDeleteParticipant(part.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '6px'
                          }}
                          title="Remove participant"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CARD 3: USE CASE & PRODUCT CAPABILITY MAPPING */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Target size={18} color="var(--primary)" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>DEMONSTRATED USE CASES &amp; PROBLEM MAPPING</h3>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '4px 0 0' }}>
                  WHAT are we demonstrating and WHY? Directly links Discovery problems to proven product capabilities.
                </p>
              </div>

              {/* Mapped use cases list */}
              {(!selectedDemo.use_cases || selectedDemo.use_cases.length === 0) ? (
                <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
                  No demonstrated use cases recorded. Link at least 1 customer problem or capability below.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                  {selectedDemo.use_cases.map(uc => (
                    <div
                      key={uc.id}
                      style={{
                        padding: '12px 16px',
                        background: 'var(--bg-surface)',
                        borderRadius: '8px',
                        borderLeft: '3px solid var(--primary)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CheckCircle2 size={16} color="var(--success)" />
                          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                            {uc.capability_name || 'Standard Capability Demo'}
                          </span>
                          {uc.module_name && (
                            <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                              {uc.module_name}
                            </span>
                          )}
                        </div>
                        {uc.problem_name && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            <strong style={{ color: 'var(--warning)' }}>Solves Problem:</strong> {uc.problem_name}
                          </div>
                        )}
                        {uc.notes && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Note: {uc.notes}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleUnmapUseCase(uc.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
                        title="Remove mapping"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Use Case Mapping Row */}
              <div style={{ padding: '16px', background: 'var(--bg-surface-elevated)', borderRadius: '8px', border: '1px dashed var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
                  Map Additional Problem / Capability to Demo:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Discovery Problem</label>
                    <select
                      value={selectedProblemId}
                      onChange={(e) => setSelectedProblemId(e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.8rem' }}
                    >
                      <option value="">-- Select Customer Problem --</option>
                      {availableDiscoveryProblems.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.refined_statement || p.problem_detail?.name || 'Problem'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Product Capability</label>
                    <select
                      value={selectedCapabilityId}
                      onChange={(e) => setSelectedCapabilityId(e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.8rem' }}
                    >
                      <option value="">-- Select Product Capability --</option>
                      {availableCapabilities.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.moduleName} → {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Demonstration notes (e.g. demonstrated live van tablet sync and offline QR invoice print)..."
                    value={useCaseNotes}
                    onChange={(e) => setUseCaseNotes(e.target.value)}
                    style={{ flex: 1, padding: '7px 10px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.8rem' }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleMapUseCase}
                    disabled={savingUseCase}
                    style={{ fontSize: '0.78rem', padding: '7px 14px', whiteSpace: 'nowrap' }}
                  >
                    {savingUseCase ? 'Mapping...' : 'Add Use Case'}
                  </button>
                </div>
              </div>
            </div>

            {/* CARD 4: CUSTOMER FEEDBACK, OBJECTIONS & QUESTIONS */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={18} color="var(--warning)" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>POST-DEMO CUSTOMER FEEDBACK &amp; OBJECTIONS</h3>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '4px 0 0' }}>
                  WHAT did the customer think? Capture feedback, objections raised, technical questions, and fit assessment.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Customer Feedback * <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Mandatory for completion)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Document detailed feedback received during or immediately following the demo..."
                    value={customerFeedback}
                    onChange={(e) => setCustomerFeedback(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                      Customer Objections / Hesitations
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Concern regarding hardware compatibility, driver training timeline..."
                      value={objectionsRaised}
                      onChange={(e) => setObjectionsRaised(e.target.value)}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.82rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                      Technical / Commercial Questions Asked
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Does offline sync handle intermittent 3G tunnels? Is SLA 99.9%?..."
                      value={customerQuestions}
                      onChange={(e) => setCustomerQuestions(e.target.value)}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.82rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', alignItems: 'center' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                      Customer Response &amp; Sentiment
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Operations Director agreed solution solves daily cash reconciliation bottlenecks..."
                      value={customerResponse}
                      onChange={(e) => setCustomerResponse(e.target.value)}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.82rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                      Fit Assessment
                    </label>
                    <select
                      value={fitAssessment}
                      onChange={(e: any) => setFitAssessment(e.target.value)}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.82rem' }}
                    >
                      <option value="STRONG">Strong Fit</option>
                      <option value="MODERATE">Moderate Fit</option>
                      <option value="POOR">Poor Fit</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={handleSaveFeedback}
                    disabled={savingFeedback}
                    style={{ fontSize: '0.82rem' }}
                  >
                    {savingFeedback ? 'Saving...' : 'Save Feedback'}
                  </button>
                </div>
              </div>
            </div>

            {/* CARD 5: NEXT ACTION (Mandatory Activity, Owner & Due Date) */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} color="var(--primary)" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>MANDATORY NEXT ACTION</h3>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '4px 0 0' }}>
                  WHAT HAPPENS NEXT? Every qualified demo must commit to a concrete commercial or technical next activity.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '12px', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Next Action Description *</label>
                  <input
                    type="text"
                    placeholder="e.g. Present commercial proposal or configure 30-day POC pilot sandbox..."
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

          {/* RIGHT COLUMN: Demo Readiness Gate & Stage Progression */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* READINESS CHECKLIST CARD */}
            <div className="glass-panel" style={{ padding: '24px', borderTop: '4px solid var(--accent-cyan)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>DEMO READINESS</h3>
                <span className={`badge ${readiness?.is_ready ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.72rem' }}>
                  {readiness?.is_ready ? 'STATUS: READY' : 'STATUS: NOT READY'}
                </span>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '18px' }}>
                Backend Gate Validation: A demo cannot be completed unless all 4 minimum enterprise criteria exist.
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
                    Demo cannot be completed.
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
                  onClick={handleCompleteDemo}
                  disabled={completingDemo || !readiness?.is_ready || selectedDemo.status === 'COMPLETED'}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    opacity: readiness?.is_ready && selectedDemo.status !== 'COMPLETED' ? 1 : 0.6,
                    cursor: readiness?.is_ready && selectedDemo.status !== 'COMPLETED' ? 'pointer' : 'not-allowed'
                  }}
                >
                  {selectedDemo.status === 'COMPLETED' ? '✓ Demo Already Completed' : completingDemo ? 'Verifying Gates...' : 'Complete Demo'}
                </button>

                {/* Downstream Progression */}
                {selectedDemo.status === 'COMPLETED' && (
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => onNavigateToPOC && selectedDemo.lead && onNavigateToPOC(selectedDemo.lead)}
                      style={{ width: '100%', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <span>Proceed to POC / Pilot Trial</span>
                      <ArrowRight size={14} />
                    </button>

                    <button
                      className="btn btn-secondary"
                      onClick={() => onNavigateToSQL && selectedDemo.lead && onNavigateToSQL(selectedDemo.lead)}
                      style={{ width: '100%', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <span>Proceed to SQL Gate Preparation</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 1: ADD PARTICIPANT */}
      {showAddParticipantModal && (
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
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>Add Demo Participant</h3>
            <form onSubmit={handleAddParticipant}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Participant Type *</label>
                  <select
                    value={partType}
                    onChange={(e: any) => setPartType(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                  >
                    <option value="CUSTOMER">Customer Stakeholder</option>
                    <option value="INTERNAL">Internal Team / Presenter</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Waleed Al-Amri"
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
                    placeholder="e.g. waleed@client.sa"
                    value={partEmail}
                    onChange={(e) => setPartEmail(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Role / Title</label>
                  <input
                    type="text"
                    placeholder="e.g. VP Fleet Logistics or Solutions Consultant"
                    value={partRoleTitle}
                    onChange={(e) => setPartRoleTitle(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Led technical evaluation of route optimization module"
                    value={partNotes}
                    onChange={(e) => setPartNotes(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddParticipantModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingParticipant}
                >
                  {savingParticipant ? 'Adding...' : 'Add Participant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: STAGE NOT REQUIRED (OPTIONAL PIPELINE BYPASS) */}
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
              Mark Demo as NOT REQUIRED
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
              If Demo is configured as OPTIONAL in the product pipeline, you may waive this stage. You must record an auditable business reason.
            </p>

            <form onSubmit={handleMarkNotRequired}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                  Auditable Waiver Reason *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Customer technical team completed self-guided sandbox assessment; formal live demo waived by mutual agreement."
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
