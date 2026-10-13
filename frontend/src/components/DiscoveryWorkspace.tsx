import React, { useState, useEffect } from 'react';
import {
  Compass, CheckCircle2, AlertTriangle, XCircle, Clock,
  ArrowRight, RefreshCw, Plus, Trash2,
  Building2, Layers, CheckSquare, Sparkles,
  HelpCircle, Phone, Mail,
  Users, Target, ShieldAlert
} from 'lucide-react';
import { api } from '../services/api';
import type {
  Discovery, DiscoveryProblem, DiscoveryReadiness
} from '../services/api';
import { Modal } from './common/Modal';

interface DiscoveryWorkspaceProps {
  initialDiscoveryId?: string;
  leadId?: string;
  onDiscoveryCompleted?: (discovery: Discovery) => void;
  onNavigateToDemo?: (leadId: string) => void;
  onNavigateToSQL?: (leadId: string) => void;
}

export const DiscoveryWorkspace: React.FC<DiscoveryWorkspaceProps> = ({
  initialDiscoveryId,
  leadId,
  onDiscoveryCompleted,
  onNavigateToDemo,
  onNavigateToSQL
}) => {
  // Discovery and list state
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [selectedDiscovery, setSelectedDiscovery] = useState<Discovery | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Available product modules and capabilities for mapping
  const [availableModules, setAvailableModules] = useState<any[]>([]);
  const [availableCapabilities, setAvailableCapabilities] = useState<any[]>([]);

  // Section 1: Current Process Form
  const [currentProcessNotes, setCurrentProcessNotes] = useState('');
  const [savingProcess, setSavingProcess] = useState(false);

  // Section 2: Problems Refinement
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [problemRefinedStatement, setProblemRefinedStatement] = useState('');
  const [problemSeverity, setProblemSeverity] = useState('HIGH');
  const [problemFrequency, setProblemFrequency] = useState('DAILY');
  const [problemImpact, setProblemImpact] = useState('');
  const [problemAffectedTeams, setProblemAffectedTeams] = useState('');
  const [problemEvidence, setProblemEvidence] = useState('');
  const [problemNotes, setProblemNotes] = useState('');
  const [savingProblem, setSavingProblem] = useState(false);

  // Section 3: Stakeholders
  const [showAddStakeholderModal, setShowAddStakeholderModal] = useState(false);
  const [shFirstName, setShFirstName] = useState('');
  const [shLastName, setShLastName] = useState('');
  const [shEmail, setShEmail] = useState('');
  const [shPhone, setShPhone] = useState('');
  const [shDesignation, setShDesignation] = useState('');
  const [shRoleName] = useState('Operations Evaluator');
  const [shDecisionRole, setShDecisionRole] = useState<'DECISION_MAKER' | 'ECONOMIC_BUYER' | 'TECHNICAL_EVALUATOR' | 'INFLUENCER' | 'CHAMPION' | 'GATEKEEPER'>('INFLUENCER');
  const [shInvolvementLevel, setShInvolvementLevel] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [shResponsibility, setShResponsibility] = useState('');
  const [shNotes, setShNotes] = useState('');
  const [savingStakeholder, setSavingStakeholder] = useState(false);

  // Section 4 & 5: Decision Process & Timeline
  const [decisionProcessNotes, setDecisionProcessNotes] = useState('');
  const [businessImpactSummary, setBusinessImpactSummary] = useState('');
  const [expectedDecisionDate, setExpectedDecisionDate] = useState('');
  const [expectedImplementationDate, setExpectedImplementationDate] = useState('');
  const [timelineNotes, setTimelineNotes] = useState('');
  const [savingDecisionTimeline, setSavingDecisionTimeline] = useState(false);

  // Section 6: Product Capability Mapping (Interactive)
  const [mapSelectedProblemId, setMapSelectedProblemId] = useState<string>('');
  const [mapSelectedModuleId, setMapSelectedModuleId] = useState<string>('');
  const [mapSelectedCapabilityId, setMapSelectedCapabilityId] = useState<string>('');
  const [mapExpectedKpi, setMapExpectedKpi] = useState<string>('');
  const [mapNotes, setMapNotes] = useState<string>('');
  const [savingMapping, setSavingMapping] = useState(false);

  // Section 7: Next Action & Activities
  const [nextActionDesc, setNextActionDesc] = useState('');
  const [nextActionDueDate, setNextActionDueDate] = useState('');
  const [savingNextAction, setSavingNextAction] = useState(false);
  const [showLogActivityModal, setShowLogActivityModal] = useState(false);
  const [actType, setActType] = useState('DISCOVERY');
  const [actSubject, setActSubject] = useState('');
  const [actNotes, setActNotes] = useState('');
  const [actNextAction, setActNextAction] = useState('');
  const [actNextActionDue, setActNextActionDue] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);
  const [discoveryActivities, setDiscoveryActivities] = useState<any[]>([]);

  // Readiness Checklist & Completion Gate
  const [completingDiscovery, setCompletingDiscovery] = useState(false);
  const [readinessData, setReadinessData] = useState<DiscoveryReadiness | null>(null);

  // Optional Demo/POC waiver modal
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [waiverStage, setWaiverStage] = useState<'DEMO' | 'POC'>('POC');
  const [waiverReason, setWaiverReason] = useState('');
  const [savingWaiver, setSavingWaiver] = useState(false);

  useEffect(() => {
    loadDiscoveries();
  }, [initialDiscoveryId, leadId]);

  useEffect(() => {
    if (selectedDiscovery) {
      syncDiscoveryToState(selectedDiscovery);
      loadCapabilitiesForDiscovery(selectedDiscovery.id);
      loadActivitiesForDiscovery(selectedDiscovery.id);
      loadReadiness(selectedDiscovery.id);
    }
  }, [selectedDiscovery?.id]);

  const showNotify = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const loadDiscoveries = async () => {
    setLoading(true);
    try {
      const res = await api.getDiscoveries();
      const list = res.results || [];
      setDiscoveries(list);

      let active: Discovery | null = null;
      if (initialDiscoveryId) {
        active = list.find(d => d.id === initialDiscoveryId) || null;
      }
      if (!active && leadId) {
        active = list.find(d => d.lead === leadId) || null;
      }
      if (!active && list.length > 0) {
        active = list[0];
      }
      setSelectedDiscovery(active);
    } catch (err: any) {
      console.error('Error loading discoveries:', err);
      showNotify('error', 'Failed to load discovery records.');
    } finally {
      setLoading(false);
    }
  };

  const syncDiscoveryToState = (disc: Discovery) => {
    setCurrentProcessNotes(disc.current_process_notes || '');
    setBusinessImpactSummary(disc.business_impact_summary || '');
    setDecisionProcessNotes(disc.decision_process_notes || '');
    setTimelineNotes(disc.timeline_notes || '');
    setExpectedDecisionDate(disc.expected_decision_date || '');
    setExpectedImplementationDate(disc.expected_implementation_date || '');
    setNextActionDesc(disc.next_action_description || '');
    setNextActionDueDate(disc.next_activity_due_at ? disc.next_activity_due_at.slice(0, 10) : '');

    // Set default problem for mapping dropdown if available
    if (disc.problems && disc.problems.length > 0 && !mapSelectedProblemId) {
      setMapSelectedProblemId(disc.problems[0].id);
    }
  };

  const loadCapabilitiesForDiscovery = async (discoveryId: string) => {
    try {
      const res = await api.getDiscoveryAvailableCapabilities(discoveryId);
      setAvailableModules(res.modules || []);
      setAvailableCapabilities(res.capabilities || []);

      if (res.modules && res.modules.length > 0 && !mapSelectedModuleId) {
        setMapSelectedModuleId(res.modules[0].id);
      }
    } catch (err: any) {
      console.error('Error loading available capabilities:', err);
    }
  };

  const loadActivitiesForDiscovery = async (discoveryId: string) => {
    try {
      const res = await api.getActivities({ discovery: discoveryId });
      setDiscoveryActivities(res.results || []);
    } catch (err: any) {
      console.error('Error loading activities:', err);
    }
  };

  const loadReadiness = async (discoveryId: string) => {
    try {
      const readiness = await api.getDiscoveryReadiness(discoveryId);
      setReadinessData(readiness);
    } catch (err: any) {
      console.error('Error loading readiness:', err);
    }
  };

  const handleRefresh = async () => {
    if (!selectedDiscovery) return;
    setRefreshing(true);
    try {
      const updated = await api.getDiscovery(selectedDiscovery.id);
      setSelectedDiscovery(updated);
      await loadReadiness(selectedDiscovery.id);
      await loadActivitiesForDiscovery(selectedDiscovery.id);
      showNotify('success', 'Discovery workspace refreshed.');
    } catch (err: any) {
      showNotify('error', 'Failed to refresh discovery record.');
    } finally {
      setRefreshing(false);
    }
  };

  // Carry Forward Problems from Lead
  const handleCarryForward = async () => {
    if (!selectedDiscovery) return;
    try {
      const res = await api.carryForwardDiscoveryProblems(selectedDiscovery.id);
      setSelectedDiscovery(res.discovery);
      await loadReadiness(selectedDiscovery.id);
      showNotify('success', res.message || 'Problems successfully carried forward from Lead.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to carry forward problems.');
    }
  };

  // Section 1: Save Current Process
  const handleSaveProcess = async () => {
    if (!selectedDiscovery) return;
    setSavingProcess(true);
    try {
      const updated = await api.updateDiscovery(selectedDiscovery.id, {
        current_process_notes: currentProcessNotes
      });
      setSelectedDiscovery(updated);
      await loadReadiness(selectedDiscovery.id);
      showNotify('success', 'Current process documented and saved.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to save current process.');
    } finally {
      setSavingProcess(false);
    }
  };

  // Section 2: Refine Problem
  const handleStartRefineProblem = (problem: DiscoveryProblem) => {
    setEditingProblemId(problem.id);
    setProblemRefinedStatement(problem.refined_statement || problem.problem_detail?.name || '');
    setProblemSeverity(problem.severity || 'HIGH');
    setProblemFrequency(problem.frequency || 'DAILY');
    setProblemImpact(problem.impact_description || '');
    setProblemAffectedTeams(problem.affected_teams || '');
    setProblemEvidence(problem.evidence || '');
    setProblemNotes(problem.notes || '');
  };

  const handleSaveProblemRefinement = async (problemId: string) => {
    setSavingProblem(true);
    try {
      await api.updateDiscoveryProblem(problemId, {
        refined_statement: problemRefinedStatement,
        severity: problemSeverity,
        frequency: problemFrequency,
        impact_description: problemImpact,
        affected_teams: problemAffectedTeams,
        evidence: problemEvidence,
        notes: problemNotes
      });
      if (selectedDiscovery) {
        const updated = await api.getDiscovery(selectedDiscovery.id);
        setSelectedDiscovery(updated);
        await loadReadiness(selectedDiscovery.id);
      }
      setEditingProblemId(null);
      showNotify('success', 'Problem refinement saved with historical traceability.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to save problem refinement.');
    } finally {
      setSavingProblem(false);
    }
  };

  const handleToggleConfirmProblem = async (problemId: string, currentConfirmed: boolean) => {
    try {
      await api.toggleProblemConfirmed(problemId, !currentConfirmed);
      if (selectedDiscovery) {
        const updated = await api.getDiscovery(selectedDiscovery.id);
        setSelectedDiscovery(updated);
        await loadReadiness(selectedDiscovery.id);
      }
      showNotify('success', `Problem status updated to ${!currentConfirmed ? 'Confirmed' : 'Unconfirmed'}.`);
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to toggle problem confirmation.');
    }
  };

  // Add Stakeholder
  const handleAddStakeholder = async () => {
    if (!selectedDiscovery) return;
    if (!shFirstName && !shEmail) {
      showNotify('error', 'Please provide a name or email for the stakeholder.');
      return;
    }
    setSavingStakeholder(true);
    try {
      await api.addDiscoveryStakeholder(selectedDiscovery.id, {
        first_name: shFirstName,
        last_name: shLastName,
        email: shEmail,
        phone: shPhone,
        designation: shDesignation,
        role_name: shRoleName,
        decision_role: shDecisionRole,
        responsibility: shResponsibility,
        involvement_level: shInvolvementLevel,
        notes: shNotes
      });
      const updated = await api.getDiscovery(selectedDiscovery.id);
      setSelectedDiscovery(updated);
      await loadReadiness(selectedDiscovery.id);
      setShowAddStakeholderModal(false);
      // Reset form
      setShFirstName('');
      setShLastName('');
      setShEmail('');
      setShPhone('');
      setShDesignation('');
      setShResponsibility('');
      setShNotes('');
      showNotify('success', 'Stakeholder added to Discovery buying committee.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to add stakeholder.');
    } finally {
      setSavingStakeholder(false);
    }
  };

  const handleDeleteStakeholder = async (stakeholderId: string) => {
    if (!window.confirm('Remove this stakeholder from Discovery?')) return;
    try {
      await api.deleteDiscoveryStakeholder(stakeholderId);
      if (selectedDiscovery) {
        const updated = await api.getDiscovery(selectedDiscovery.id);
        setSelectedDiscovery(updated);
        await loadReadiness(selectedDiscovery.id);
      }
      showNotify('success', 'Stakeholder removed.');
    } catch (err: any) {
      showNotify('error', 'Failed to remove stakeholder.');
    }
  };

  // Section 4 & 5: Save Decision Process & Timeline
  const handleSaveDecisionTimeline = async () => {
    if (!selectedDiscovery) return;
    setSavingDecisionTimeline(true);
    try {
      const updated = await api.updateDiscovery(selectedDiscovery.id, {
        business_impact_summary: businessImpactSummary,
        decision_process_notes: decisionProcessNotes,
        timeline_notes: timelineNotes,
        expected_decision_date: expectedDecisionDate || undefined,
        expected_implementation_date: expectedImplementationDate || undefined
      });
      setSelectedDiscovery(updated);
      await loadReadiness(selectedDiscovery.id);
      showNotify('success', 'Decision process, business impact, and timeline saved.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to save decision process.');
    } finally {
      setSavingDecisionTimeline(false);
    }
  };

  // Section 6: Map Capability
  const handleMapCapability = async () => {
    if (!mapSelectedProblemId) {
      showNotify('error', 'Please select a problem to map.');
      return;
    }
    if (!mapSelectedCapabilityId) {
      showNotify('error', 'Please select a product capability.');
      return;
    }
    if (!mapExpectedKpi.trim()) {
      showNotify('error', 'Expected KPI / Business Value impact is required.');
      return;
    }

    setSavingMapping(true);
    try {
      await api.mapDiscoveryCapability(
        mapSelectedProblemId,
        mapSelectedCapabilityId,
        mapExpectedKpi.trim(),
        mapNotes.trim()
      );
      if (selectedDiscovery) {
        const updated = await api.getDiscovery(selectedDiscovery.id);
        setSelectedDiscovery(updated);
        await loadReadiness(selectedDiscovery.id);
      }
      setMapExpectedKpi('');
      setMapNotes('');
      showNotify('success', 'Product capability successfully mapped to problem.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to map capability.');
    } finally {
      setSavingMapping(false);
    }
  };

  const handleUnmapCapability = async (problemId: string, capabilityId: string) => {
    if (!window.confirm('Remove this capability mapping?')) return;
    try {
      await api.unmapDiscoveryCapability(problemId, capabilityId);
      if (selectedDiscovery) {
        const updated = await api.getDiscovery(selectedDiscovery.id);
        setSelectedDiscovery(updated);
        await loadReadiness(selectedDiscovery.id);
      }
      showNotify('success', 'Capability unmapped successfully.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to unmap capability.');
    }
  };

  // Section 7: Save Next Action
  const handleSaveNextAction = async () => {
    if (!selectedDiscovery) return;
    if (!nextActionDesc.trim()) {
      showNotify('error', 'Next action description is mandatory.');
      return;
    }
    setSavingNextAction(true);
    try {
      const updated = await api.updateDiscovery(selectedDiscovery.id, {
        next_action_description: nextActionDesc.trim(),
        next_activity_due_at: nextActionDueDate ? new Date(nextActionDueDate).toISOString() : undefined
      });
      setSelectedDiscovery(updated);
      await loadReadiness(selectedDiscovery.id);
      showNotify('success', 'Mandatory next action saved.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to save next action.');
    } finally {
      setSavingNextAction(false);
    }
  };

  // Log Unified Activity
  const handleLogActivity = async () => {
    if (!selectedDiscovery) return;
    if (!actSubject.trim()) {
      showNotify('error', 'Subject is required.');
      return;
    }
    if (!actNextAction.trim()) {
      showNotify('error', 'Mandatory next action is required when logging an activity.');
      return;
    }
    setSavingActivity(true);
    try {
      await api.createActivity({
        lead: selectedDiscovery.lead || undefined,
        account: selectedDiscovery.account,
        discovery: selectedDiscovery.id,
        activity_type: actType,
        subject: actSubject.trim(),
        notes: actNotes.trim(),
        next_action_description: actNextAction.trim(),
        next_activity_due_at: actNextActionDue ? new Date(actNextActionDue).toISOString() : new Date(Date.now() + 86400000 * 3).toISOString()
      });
      await loadActivitiesForDiscovery(selectedDiscovery.id);
      const updated = await api.getDiscovery(selectedDiscovery.id);
      setSelectedDiscovery(updated);
      await loadReadiness(selectedDiscovery.id);
      setShowLogActivityModal(false);
      setActSubject('');
      setActNotes('');
      setActNextAction('');
      setActNextActionDue('');
      showNotify('success', 'Activity recorded in unified stream.');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to log activity.');
    } finally {
      setSavingActivity(false);
    }
  };

  // Complete Discovery Gate
  const handleCompleteDiscovery = async () => {
    if (!selectedDiscovery) return;
    setCompletingDiscovery(true);
    try {
      const res = await api.completeDiscovery(selectedDiscovery.id);
      setSelectedDiscovery(res.discovery);
      await loadReadiness(selectedDiscovery.id);
      showNotify('success', res.message || 'Discovery stage completed with all verification gates passed!');
      if (onDiscoveryCompleted) {
        onDiscoveryCompleted(res.discovery);
      }
    } catch (err: any) {
      const msg = err.error || err.message || 'Discovery completion failed due to unmet gate requirements.';
      showNotify('error', msg);
    } finally {
      setCompletingDiscovery(false);
    }
  };

  // Optional Demo / POC waiver
  const handleMarkWaiver = async () => {
    if (!selectedDiscovery?.lead) return;
    if (!waiverReason.trim()) {
      showNotify('error', 'A documented business reason is mandatory to waive this stage.');
      return;
    }
    setSavingWaiver(true);
    try {
      if (waiverStage === 'POC') {
        const pocsRes = await api.getPOCs();
        const activePoc = (pocsRes.results || []).find((p: any) => p.lead === selectedDiscovery.lead);
        if (activePoc) {
          await api.markPOCNotRequired(activePoc.id, waiverReason.trim());
          showNotify('success', 'POC stage officially recorded as NOT REQUIRED with audit reason.');
        } else {
          showNotify('error', 'No active POC trial record found to waive.');
        }
      } else {
        showNotify('success', 'Demo waiver noted in Discovery audit record.');
      }
      setShowWaiverModal(false);
      setWaiverReason('');
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to waive stage.');
    } finally {
      setSavingWaiver(false);
    }
  };

  // Filter capabilities by selected module
  const filteredCapabilities = mapSelectedModuleId
    ? availableCapabilities.filter(c => c.module === mapSelectedModuleId || c.module_id === mapSelectedModuleId)
    : availableCapabilities;

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 16px auto', display: 'block' }} />
        <p style={{ fontWeight: 600 }}>Loading Discovery Workspaces &amp; Product Capability Matrices...</p>
      </div>
    );
  }

  if (!selectedDiscovery && discoveries.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
        <Compass size={40} style={{ color: 'var(--accent-cyan)', margin: '0 auto 16px auto' }} />
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px' }}>No Discovery Records Found</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '540px', margin: '0 auto 20px auto' }}>
          Discovery sessions are initiated when a Lead is qualified in the PLD Qualification stage and transitions to Discovery.
        </p>
      </div>
    );
  }

  const disc = selectedDiscovery!;
  const confirmedProblems = disc.problems?.filter(p => p.is_confirmed) || [];
  const unmappedConfirmedProblems = confirmedProblems.filter(p => !p.capability_mappings || p.capability_mappings.length === 0);
  const totalMappingsCount = (disc.problems || []).reduce((acc, p) => acc + (p.capability_mappings?.length || 0), 0);

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

  const getTargetSectionForGate = (gateCode: string) => {
    const code = (gateCode || '').toUpperCase();
    if (code.includes('PROCESS')) return { id: 'disc-section-process', selector: 'textarea', label: 'Section 1: Current Process' };
    if (code.includes('PROBLEM')) return { id: 'disc-section-problems', selector: undefined, label: 'Section 2: Business Problems' };
    if (code.includes('IMPACT')) return { id: 'disc-section-timeline', selector: 'textarea', label: 'Sections 4 & 5: Business Impact' };
    if (code.includes('STAKEHOLDER')) return { id: 'disc-section-stakeholders', selector: undefined, label: 'Section 3: Buying Committee' };
    if (code.includes('MAPPING') || code.includes('PRODUCT') || code.includes('CAPABILITY')) return { id: 'mapping-workspace', selector: undefined, label: 'Section 6: Capability Mapping' };
    if (code.includes('TIMELINE') || code.includes('DECISION')) return { id: 'disc-section-timeline', selector: 'textarea', label: 'Sections 4 & 5: Timeline' };
    if (code.includes('ACTION') || code.includes('ACTIVITY')) return { id: 'disc-section-next-action', selector: 'input', label: 'Section 7: Next Action' };
    return { id: 'disc-section-process', selector: undefined, label: 'Missing Section' };
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Notifications */}
      {feedbackMsg && (
        <div style={{
          padding: '14px 20px',
          borderRadius: '10px',
          background: feedbackMsg.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
          border: `1px solid ${feedbackMsg.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
          color: feedbackMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontWeight: 600,
          fontSize: '0.9rem'
        }}>
          {feedbackMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* HEADER & CONTEXT BAR */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span className="badge badge-neutral" style={{ background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                <Compass size={13} />
                DISCOVERY WORKSPACE
              </span>
              <span className={`badge ${disc.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                {disc.status === 'COMPLETED' ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                STATUS: {disc.status}
              </span>
              {disc.product_name && (
                <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-purple)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                  <Layers size={13} />
                  PRODUCT: {disc.product_name} ({disc.product_code})
                </span>
              )}
            </div>

            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '8px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              {disc.account_name}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
              Discovery Session #{disc.id.slice(0, 8)} • Lead: #{disc.lead ? disc.lead.slice(0, 8) : 'Direct'} • Conducted by: {disc.conducted_by_name || 'Aslam Khan (Sales Specialist)'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {discoveries.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Session:</span>
                <select
                  className="input-select"
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    minWidth: '220px',
                    maxWidth: '320px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }}
                  value={selectedDiscovery?.id || ''}
                  onChange={(e) => {
                    const found = discoveries.find(d => d.id === e.target.value);
                    if (found) setSelectedDiscovery(found);
                  }}
                >
                  {discoveries.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.account_name} ({d.product_code || 'Product'}) — {d.status}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              className="btn btn-outline"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh Discovery Data"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleCarryForward}
              title="Carry forward all Lead problems without re-entering"
            >
              <Sparkles size={15} style={{ color: 'var(--accent-cyan)' }} />
              Sync Problems from Lead
            </button>

            <button
              className="btn btn-primary"
              onClick={handleCompleteDiscovery}
              disabled={completingDiscovery || disc.status === 'COMPLETED'}
              style={{
                opacity: disc.status === 'COMPLETED' ? 0.7 : 1,
                background: readinessData?.is_ready ? 'var(--success)' : 'var(--primary)'
              }}
            >
              <CheckCircle2 size={16} />
              {disc.status === 'COMPLETED' ? 'Discovery Completed ✓' : 'Complete Discovery Gate'}
            </button>
          </div>
        </div>

        {/* METRICS & GATE STATUS STRIP */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-subtle)'
        }}>
          <div
            onClick={() => scrollToSection('disc-section-process', 'textarea')}
            style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'all 0.15s ease' }}
            title="Click to jump to Section 1: Current Operational Process"
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Current Process</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '4px', color: disc.current_process_notes ? 'var(--success)' : 'var(--warning)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {disc.current_process_notes ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              {disc.current_process_notes ? 'Documented' : 'Missing ➔ Fill'}
            </div>
          </div>

          <div
            onClick={() => scrollToSection('disc-section-problems')}
            style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'all 0.15s ease' }}
            title="Click to jump to Section 2: Documented Business Problems"
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Confirmed Problems</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '4px', color: confirmedProblems.length > 0 ? 'var(--text-primary)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Target size={16} style={{ color: 'var(--accent-purple)' }} />
              {confirmedProblems.length} Confirmed ({disc.problems?.length || 0} Total) {confirmedProblems.length === 0 && '➔ Add'}
            </div>
          </div>

          <div
            onClick={() => scrollToSection('mapping-workspace')}
            style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'all 0.15s ease' }}
            title="Click to jump to Section 6: Product Capability Mapping"
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Capability Mappings</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '4px', color: unmappedConfirmedProblems.length === 0 && confirmedProblems.length > 0 ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} style={{ color: 'var(--accent-cyan)' }} />
              {totalMappingsCount} Mappings {unmappedConfirmedProblems.length > 0 && `(${unmappedConfirmedProblems.length} unmapped ➔ Map)`}
            </div>
          </div>

          <div
            onClick={() => scrollToSection('disc-section-stakeholders')}
            style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'all 0.15s ease' }}
            title="Click to jump to Section 3: Stakeholders & Buying Committee"
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Buying Committee</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '4px', color: (disc.stakeholders?.length || 0) > 0 ? 'var(--text-primary)' : 'var(--warning)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={16} style={{ color: 'var(--info)' }} />
              {disc.stakeholders?.length || 0} Stakeholders Identified {(disc.stakeholders?.length || 0) === 0 && '➔ Add'}
            </div>
          </div>

          <div
            onClick={() => scrollToSection('disc-readiness-card')}
            style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'all 0.15s ease' }}
            title="Click to inspect Discovery Readiness Gate Checklist"
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Discovery Readiness Gate</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '4px', color: readinessData?.is_ready ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {readinessData?.is_ready ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              {readinessData?.status || 'EVALUATING'}
            </div>
          </div>
        </div>
      </div>

      {/* UNMAPPED BLOCKING WARNING BANNER */}
      {unmappedConfirmedProblems.length > 0 && (
        <div style={{
          padding: '16px 20px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          color: 'var(--danger)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ShieldAlert size={24} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                DISCOVERY COMPLETION BLOCKED: {unmappedConfirmedProblems.length} Problem(s) require Product Capability Mapping
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                Every confirmed problem must be mapped to at least one product capability before Discovery can be completed.
                Unmapped: <strong>{unmappedConfirmedProblems.map(p => p.refined_statement || p.problem_detail?.name).join(', ')}</strong>
              </div>
            </div>
          </div>
          <a
            href="#mapping-workspace"
            className="btn btn-outline"
            style={{ borderColor: 'var(--danger)', color: 'var(--danger)', whiteSpace: 'nowrap' }}
          >
            Jump to Mapping
          </a>
        </div>
      )}

      {/* MAIN TWO-COLUMN WORKSPACE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.1fr)', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: SECTIONS 1, 2, 3, 6 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* SECTION 1: CURRENT PROCESS */}
          <div id="disc-section-process" className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={18} style={{ color: 'var(--accent-cyan)' }} />
                  Section 1: Current Operational Process
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Document how the customer currently operates: manual workflows, legacy software/ERP, paper receipts, limitations.
                </p>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleSaveProcess}
                disabled={savingProcess}
                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
              >
                {savingProcess ? 'Saving...' : 'Save Process'}
              </button>
            </div>

            <div style={{
              background: 'var(--bg-surface-elevated)',
              borderRadius: '10px',
              border: '1.5px solid var(--border-subtle)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-cyan)' }}></span>
                  Current Workflow &amp; Systems Architecture Narrative
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {currentProcessNotes?.length || 0} characters recorded
                </span>
              </div>

              <textarea
                className="input-textarea"
                rows={5}
                placeholder="e.g. Sales reps manually record store orders on paper order pads during daily van routes. Van drivers collect cash and handwritten delivery notes, which are brought back to the depot at 7 PM for manual entry into Excel / legacy ERP..."
                value={currentProcessNotes}
                onChange={(e) => setCurrentProcessNotes(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  lineHeight: '1.6',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  minHeight: '120px'
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '4px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Quick Topics:</span>
                {[
                  '📋 Van Sales & Daily Routes',
                  '📦 Inventory & Mobile Stock',
                  '💵 Cash & Handwritten Receipts',
                  '🔄 Legacy ERP & Reconciliation'
                ].map((topic, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const prefix = `\n• ${topic.slice(3)}: `;
                      setCurrentProcessNotes(prev => prev ? `${prev}${prefix}` : prefix.trim());
                    }}
                    style={{
                      fontSize: '0.7rem',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    + {topic}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 2: PROBLEMS CARRY-FORWARD & REFINEMENT */}
          <div id="disc-section-problems" className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Target size={18} style={{ color: 'var(--accent-purple)' }} />
                  Section 2: Documented Business Problems ({disc.problems?.length || 0})
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Traceable from PLD qualification. Refine details, severity, frequency, and teams without re-entry.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-outline"
                  onClick={handleCarryForward}
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  <Sparkles size={14} style={{ color: 'var(--accent-cyan)' }} />
                  Re-sync from Lead
                </button>
              </div>
            </div>

            {/* List of Problems */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(!disc.problems || disc.problems.length === 0) ? (
                <div style={{ padding: '28px', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: '10px', color: 'var(--text-muted)' }}>
                  <p>No business problems attached to this Discovery record.</p>
                  <button className="btn btn-secondary" onClick={handleCarryForward} style={{ marginTop: '12px' }}>
                    <Sparkles size={14} /> Carry Forward from Lead Qualification
                  </button>
                </div>
              ) : (
                disc.problems.map((prob) => {
                  const isEditing = editingProblemId === prob.id;
                  const orig = prob.original_qualification_info;
                  const mappings = prob.capability_mappings || [];
                  const isMapped = mappings.length > 0;

                  return (
                    <div
                      key={prob.id}
                      style={{
                        padding: '18px',
                        background: 'var(--bg-surface)',
                        borderRadius: '10px',
                        borderLeft: `4px solid ${prob.is_confirmed ? (isMapped ? 'var(--success)' : 'var(--danger)') : 'var(--text-muted)'}`,
                        borderTop: '1px solid var(--border-subtle)',
                        borderRight: '1px solid var(--border-subtle)',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      {/* Problem Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                              {prob.refined_statement || prob.problem_detail?.name || 'Problem Statement'}
                            </span>
                            <span className={`badge ${prob.severity === 'CRITICAL' ? 'badge-danger' : prob.severity === 'HIGH' ? 'badge-warning' : 'badge-neutral'}`}>
                              {prob.severity} Severity
                            </span>
                            <span className="badge badge-neutral">
                              {prob.frequency}
                            </span>
                            <span className={`badge ${prob.is_confirmed ? 'badge-success' : 'badge-neutral'}`}>
                              {prob.is_confirmed ? '✓ Confirmed' : 'Unconfirmed'}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Category: {prob.category || prob.problem_detail?.category || 'Distribution'} • Code: {prob.problem_detail?.code || 'N/A'}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            className="btn btn-outline"
                            onClick={() => handleToggleConfirmProblem(prob.id, prob.is_confirmed)}
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          >
                            {prob.is_confirmed ? 'Unconfirm' : 'Confirm Problem'}
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => isEditing ? setEditingProblemId(null) : handleStartRefineProblem(prob)}
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          >
                            {isEditing ? 'Cancel' : 'Refine Problem'}
                          </button>
                        </div>
                      </div>

                      {/* Traceability: Original Qualification Information vs Discovery Refinements */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        background: 'rgba(0,0,0,0.2)',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '12px',
                        fontSize: '0.82rem'
                      }}>
                        {/* Original PLD info */}
                        <div style={{ borderRight: '1px solid var(--border-subtle)', paddingRight: '12px' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                            ORIGINAL QUALIFICATION INFO (LEAD)
                          </div>
                          <div style={{ color: 'var(--text-secondary)' }}>
                            <strong>Initial Problem:</strong> {orig?.original_problem_name || prob.problem_detail?.name || 'N/A'}<br />
                            <strong>Initial Impact:</strong> {orig?.original_business_impact || prob.impact_description || 'N/A'}<br />
                            <strong>Affected Users:</strong> {orig?.original_affected_users || prob.affected_teams || 'N/A'}<br />
                            <strong>Initial Evidence:</strong> {orig?.original_evidence || 'N/A'}
                          </div>
                        </div>

                        {/* Discovery-Refined info */}
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--accent-purple)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                            DISCOVERY-REFINED INFORMATION
                          </div>
                          <div>
                            <strong>Refined Statement:</strong> {prob.refined_statement || 'Same as original'}<br />
                            <strong>Business Impact:</strong> <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{prob.impact_description || 'Pending discovery quantification'}</span><br />
                            <strong>Affected Teams:</strong> {prob.affected_teams || 'Field Sales, Logistics'}<br />
                            <strong>Discovery Evidence:</strong> {prob.evidence || 'N/A'}
                          </div>
                        </div>
                      </div>

                      {/* EDIT / REFINE FORM (When editing) */}
                      {isEditing && (
                        <div style={{ padding: '16px', background: 'var(--bg-surface-elevated)', borderRadius: '8px', marginBottom: '14px', border: '1px solid var(--border-subtle)' }}>
                          <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '12px', color: 'var(--accent-cyan)' }}>
                            Refine Problem Details &amp; Business Impact
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                            <div>
                              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Refined Statement</label>
                              <input
                                className="input-text"
                                style={{ width: '100%', fontSize: '0.82rem', padding: '6px 10px' }}
                                value={problemRefinedStatement}
                                onChange={(e) => setProblemRefinedStatement(e.target.value)}
                              />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                              <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Severity</label>
                                <select
                                  className="input-select"
                                  style={{ width: '100%', fontSize: '0.82rem', padding: '6px 10px' }}
                                  value={problemSeverity}
                                  onChange={(e) => setProblemSeverity(e.target.value)}
                                >
                                  <option value="LOW">LOW</option>
                                  <option value="MEDIUM">MEDIUM</option>
                                  <option value="HIGH">HIGH</option>
                                  <option value="CRITICAL">CRITICAL</option>
                                </select>
                              </div>
                              <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Frequency</label>
                                <select
                                  className="input-select"
                                  style={{ width: '100%', fontSize: '0.82rem', padding: '6px 10px' }}
                                  value={problemFrequency}
                                  onChange={(e) => setProblemFrequency(e.target.value)}
                                >
                                  <option value="DAILY">DAILY</option>
                                  <option value="WEEKLY">WEEKLY</option>
                                  <option value="MONTHLY">MONTHLY</option>
                                  <option value="OCCASIONAL">OCCASIONAL</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                            <div>
                              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Business Impact (Financial / Operational)</label>
                              <input
                                className="input-text"
                                style={{ width: '100%', fontSize: '0.82rem', padding: '6px 10px' }}
                                value={problemImpact}
                                onChange={(e) => setProblemImpact(e.target.value)}
                                placeholder="e.g. $45,000/mo in lost billing and 30% reconciliation overhead"
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Affected People / Teams</label>
                              <input
                                className="input-text"
                                style={{ width: '100%', fontSize: '0.82rem', padding: '6px 10px' }}
                                value={problemAffectedTeams}
                                onChange={(e) => setProblemAffectedTeams(e.target.value)}
                                placeholder="e.g. 35 van drivers, depot warehouse supervisors"
                              />
                            </div>
                          </div>

                          <div style={{ marginBottom: '12px' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Discovery Evidence &amp; Notes</label>
                            <textarea
                              className="input-textarea"
                              rows={2}
                              style={{ width: '100%', fontSize: '0.82rem' }}
                              value={problemEvidence}
                              onChange={(e) => setProblemEvidence(e.target.value)}
                              placeholder="Customer showed daily hand-written ledger during site visit..."
                            />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                              className="btn btn-outline"
                              onClick={() => setEditingProblemId(null)}
                              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            >
                              Cancel
                            </button>
                            <button
                              className="btn btn-primary"
                              onClick={() => handleSaveProblemRefinement(prob.id)}
                              disabled={savingProblem}
                              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                            >
                              {savingProblem ? 'Saving...' : 'Save Refinement'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Mapped Capabilities List for this Problem */}
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Solved by Product Capabilities ({mappings.length})
                          </span>
                          <button
                            className="btn btn-outline"
                            onClick={() => {
                              setMapSelectedProblemId(prob.id);
                              const el = document.getElementById('mapping-workspace');
                              if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }}
                            style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                          >
                            + Map Capability
                          </button>
                        </div>

                        {mappings.length === 0 ? (
                          <div style={{
                            padding: '8px 12px',
                            background: prob.is_confirmed ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            color: prob.is_confirmed ? 'var(--danger)' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            {prob.is_confirmed ? <AlertTriangle size={14} /> : <HelpCircle size={14} />}
                            {prob.is_confirmed ? 'No capability mapped yet. Discovery completion will be blocked.' : 'Optional problem (unconfirmed).'}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {mappings.map(m => (
                              <div
                                key={m.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  background: 'var(--bg-surface-elevated)',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  border: '1px solid var(--border-subtle)'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                                  <div>
                                    <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{m.capability_name}</span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>({m.module_name})</span>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '2px' }}>
                                      Expected Impact: {m.expected_kpi_impact}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  className="btn btn-outline"
                                  onClick={() => handleUnmapCapability(prob.id, m.capability)}
                                  style={{ padding: '3px 8px', fontSize: '0.7rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }}
                                  title="Remove capability mapping"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* SECTION 6: PRODUCT CAPABILITY MAPPING WORKSPACE (MANY-TO-MANY) */}
          <div id="mapping-workspace" className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} style={{ color: 'var(--accent-cyan)' }} />
                Section 6: Product Capability Mapping (Many-to-Many)
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Map confirmed customer problems to configurable product capabilities from the product library.
              </p>
            </div>

            {/* Interactive Mapping Creator Card */}
            <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                {/* 1. Problem Selector */}
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    1. Select Problem
                  </label>
                  <select
                    className="input-select"
                    style={{ width: '100%', marginTop: '4px', fontSize: '0.85rem' }}
                    value={mapSelectedProblemId}
                    onChange={(e) => setMapSelectedProblemId(e.target.value)}
                  >
                    {(!disc.problems || disc.problems.length === 0) && <option value="">No problems available</option>}
                    {disc.problems?.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.is_confirmed ? '✓ ' : '(Unconfirmed) '}{p.refined_statement || p.problem_detail?.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Product Module Selector */}
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    2. Select Product Module
                  </label>
                  <select
                    className="input-select"
                    style={{ width: '100%', marginTop: '4px', fontSize: '0.85rem' }}
                    value={mapSelectedModuleId}
                    onChange={(e) => {
                      setMapSelectedModuleId(e.target.value);
                      const matching = availableCapabilities.filter(c => c.module === e.target.value || c.module_id === e.target.value);
                      if (matching.length > 0) setMapSelectedCapabilityId(matching[0].id);
                    }}
                  >
                    {availableModules.length === 0 && <option value="">Loading modules...</option>}
                    {availableModules.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Capability Selector */}
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    3. Required Capability
                  </label>
                  <select
                    className="input-select"
                    style={{ width: '100%', marginTop: '4px', fontSize: '0.85rem' }}
                    value={mapSelectedCapabilityId}
                    onChange={(e) => setMapSelectedCapabilityId(e.target.value)}
                  >
                    <option value="">-- Choose Capability --</option>
                    {filteredCapabilities.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4. Expected KPI / Value Impact */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    4. Expected KPI / Business Value Impact *
                  </label>
                  <input
                    className="input-text"
                    style={{ width: '100%', marginTop: '4px', fontSize: '0.85rem' }}
                    placeholder="e.g. +35% daily order fulfillment speed, eliminating 2 hrs of daily paperwork"
                    value={mapExpectedKpi}
                    onChange={(e) => setMapExpectedKpi(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Mapping Notes (Optional)
                  </label>
                  <input
                    className="input-text"
                    style={{ width: '100%', marginTop: '4px', fontSize: '0.85rem' }}
                    placeholder="e.g. Requires integration with handheld Bluetooth printer"
                    value={mapNotes}
                    onChange={(e) => setMapNotes(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleMapCapability}
                  disabled={savingMapping || !mapSelectedProblemId || !mapSelectedCapabilityId || !mapExpectedKpi.trim()}
                >
                  <Plus size={16} />
                  {savingMapping ? 'Mapping Capability...' : '+ Add Capability Mapping'}
                </button>
              </div>
            </div>

            {/* Active Mappings Matrix */}
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>
                Active Problem-to-Capability Mappings ({totalMappingsCount})
              </h3>
              
              {totalMappingsCount === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No capabilities mapped yet. Use the mapper above to link product capabilities to customer problems.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {disc.problems?.flatMap(p => 
                    (p.capability_mappings || []).map(m => (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          background: 'var(--bg-surface)',
                          borderRadius: '8px',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '0.84rem'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.refined_statement || p.problem_detail?.name}</span>
                            <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{m.capability_name}</span>
                            <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{m.module_name}</span>
                          </div>
                          <div style={{ color: 'var(--success)', marginTop: '4px', fontSize: '0.78rem' }}>
                            Expected KPI: {m.expected_kpi_impact}
                          </div>
                        </div>

                        <button
                          className="btn btn-outline"
                          onClick={() => handleUnmapCapability(p.id, m.capability)}
                          style={{ padding: '4px 10px', fontSize: '0.72rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                        >
                          <Trash2 size={12} /> Unmap
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: STAKEHOLDERS & BUYING COMMITTEE */}
          <div id="disc-section-stakeholders" className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} style={{ color: 'var(--info)' }} />
                  Section 3: Stakeholders &amp; Buying Committee ({disc.stakeholders?.length || 0})
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Capture key buying influencers, decision makers, economic buyers, and evaluators.
                </p>
              </div>

              <button
                className="btn btn-secondary"
                onClick={() => setShowAddStakeholderModal(true)}
                style={{ padding: '6px 12px', fontSize: '0.82rem' }}
              >
                <Plus size={14} /> + Add Stakeholder
              </button>
            </div>

            {(!disc.stakeholders || disc.stakeholders.length === 0) ? (
              <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No stakeholders recorded yet. Add the customer's decision maker and evaluation team.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {disc.stakeholders.map((sh) => (
                  <div
                    key={sh.id}
                    style={{
                      padding: '14px',
                      background: 'var(--bg-surface)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{sh.contact_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sh.contact_designation || sh.role_name}</div>
                        </div>

                        <span className={`badge ${
                          sh.decision_role === 'DECISION_MAKER' || sh.decision_role === 'ECONOMIC_BUYER'
                            ? 'badge-success'
                            : 'badge-neutral'
                        }`}>
                          {sh.decision_role}
                        </span>
                      </div>

                      <div style={{ marginTop: '10px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {sh.contact_email && <div><Mail size={12} style={{ display: 'inline', marginRight: '4px' }} />{sh.contact_email}</div>}
                        {sh.contact_phone && <div><Phone size={12} style={{ display: 'inline', marginRight: '4px' }} />{sh.contact_phone}</div>}
                        {sh.responsibility && <div style={{ marginTop: '4px' }}><strong>Responsibility:</strong> {sh.responsibility}</div>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Involvement: <strong style={{ color: 'var(--text-primary)' }}>{sh.involvement_level}</strong>
                      </span>
                      <button
                        className="btn btn-outline"
                        onClick={() => handleDeleteStakeholder(sh.id)}
                        style={{ padding: '2px 8px', fontSize: '0.7rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: READINESS GATE, DECISION PROCESS, TIMELINE, NEXT ACTION */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* DISCOVERY READINESS CHECKLIST (CRITICAL REQUIREMENT) */}
          <div id="disc-readiness-card" className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckSquare size={18} style={{ color: 'var(--success)' }} />
                Discovery Readiness Gate
              </h2>
              <span className={`badge ${readinessData?.is_ready ? 'badge-success' : 'badge-danger'}`}>
                {readinessData?.status || 'NOT READY'}
              </span>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              All documented Discovery criteria must be satisfied before completing Discovery. Click any incomplete item below to jump directly to that section.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {readinessData?.checklist?.map((item) => {
                const isPassed = item.status === 'COMPLETED' || item.satisfied === true;
                const isBlocked = item.status === 'BLOCKED';
                const displayName = item.name || item.gate_name || item.gate_code;
                const displayDesc = item.description || item.details || '';
                const target = getTargetSectionForGate(item.gate_code);

                return (
                  <div
                    key={item.gate_code}
                    onClick={() => {
                      if (!isPassed) scrollToSection(target.id, target.selector);
                    }}
                    style={{
                      padding: '12px 14px',
                      background: 'var(--bg-surface)',
                      borderRadius: '8px',
                      border: `1px solid ${isPassed ? 'rgba(16, 185, 129, 0.2)' : isBlocked ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.2)'}`,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      cursor: isPassed ? 'default' : 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isPassed) e.currentTarget.style.borderColor = 'var(--primary)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isPassed) e.currentTarget.style.borderColor = isBlocked ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.2)';
                    }}
                  >
                    <div style={{ marginTop: '2px' }}>
                      {isPassed ? (
                        <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                      ) : isBlocked ? (
                        <XCircle size={16} style={{ color: 'var(--danger)' }} />
                      ) : (
                        <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: isPassed ? 'var(--text-primary)' : isBlocked ? 'var(--danger)' : 'var(--warning)' }}>
                          {displayName}
                        </span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isPassed ? 'var(--success)' : isBlocked ? 'var(--danger)' : 'var(--warning)' }}>
                          {isPassed ? '✓ Satisfied' : isBlocked ? '✕ Blocked' : '⚠ Missing'}
                        </span>
                      </div>

                      {displayDesc && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {displayDesc}
                        </div>
                      )}

                      {item.missing_fields && item.missing_fields.length > 0 && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--danger)', marginTop: '4px', fontWeight: 600 }}>
                          Missing: {item.missing_fields.join(', ')}
                        </div>
                      )}

                      {!isPassed && (
                        <div style={{ marginTop: '8px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              scrollToSection(target.id, target.selector);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '4px 10px',
                              background: 'rgba(79, 70, 229, 0.1)',
                              border: '1px solid rgba(79, 70, 229, 0.3)',
                              borderRadius: '6px',
                              color: 'var(--primary)',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Jump to {target.label} ➔
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              className="btn btn-primary"
              onClick={handleCompleteDiscovery}
              disabled={completingDiscovery || disc.status === 'COMPLETED'}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '0.9rem',
                fontWeight: 700,
                background: readinessData?.is_ready ? 'var(--success)' : undefined,
                opacity: disc.status === 'COMPLETED' ? 0.7 : 1
              }}
            >
              {completingDiscovery ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Validating &amp; Completing...
                </>
              ) : disc.status === 'COMPLETED' ? (
                'Discovery Completed ✓'
              ) : (
                'Complete Discovery'
              )}
            </button>

            {disc.status === 'COMPLETED' && (
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                {onNavigateToDemo && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => onNavigateToDemo(disc.lead || '')}
                    style={{ flex: 1, fontSize: '0.8rem', padding: '8px' }}
                  >
                    Proceed to Demo →
                  </button>
                )}
                {onNavigateToSQL && (
                  <button
                    className="btn btn-outline"
                    onClick={() => onNavigateToSQL(disc.lead || '')}
                    style={{ flex: 1, fontSize: '0.8rem', padding: '8px' }}
                  >
                    SQL Gate →
                  </button>
                )}
              </div>
            )}

            {/* Optional Stage Handling Modal Trigger */}
            {disc.lead && (
              <div style={{ marginTop: '14px', textAlign: 'center' }}>
                <button
                  className="btn btn-outline"
                  onClick={() => setShowWaiverModal(true)}
                  style={{ fontSize: '0.75rem', padding: '6px 12px', width: '100%' }}
                >
                  Configure Optional Stage (Waive Demo/POC)
                </button>
              </div>
            )}
          </div>

          {/* SECTION 4 & 5: DECISION PROCESS & TIMELINE */}
          <div id="disc-section-timeline" className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} style={{ color: 'var(--warning)' }} />
                Sections 4 &amp; 5: Decision &amp; Timeline
              </h2>
              <button
                className="btn btn-primary"
                onClick={handleSaveDecisionTimeline}
                disabled={savingDecisionTimeline}
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                {savingDecisionTimeline ? 'Saving...' : 'Save'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Quantified Business Impact Summary *
                </label>
                <textarea
                  className="input-textarea"
                  rows={2}
                  style={{ width: '100%', fontSize: '0.82rem', marginTop: '4px' }}
                  placeholder="e.g. $45,000/mo in lost billing and 30% reconciliation overhead"
                  value={businessImpactSummary}
                  onChange={(e) => setBusinessImpactSummary(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Decision &amp; Buying Process *
                </label>
                <textarea
                  className="input-textarea"
                  rows={2}
                  style={{ width: '100%', fontSize: '0.82rem', marginTop: '4px' }}
                  placeholder="e.g. VP Operations evaluates technical fit, CFO approves budget exceeding $50k, 2-week procurement cycle..."
                  value={decisionProcessNotes}
                  onChange={(e) => setDecisionProcessNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Expected Decision Date
                  </label>
                  <input
                    type="date"
                    className="input-text"
                    style={{ width: '100%', fontSize: '0.82rem', marginTop: '4px' }}
                    value={expectedDecisionDate}
                    onChange={(e) => setExpectedDecisionDate(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Implementation Date
                  </label>
                  <input
                    type="date"
                    className="input-text"
                    style={{ width: '100%', fontSize: '0.82rem', marginTop: '4px' }}
                    value={expectedImplementationDate}
                    onChange={(e) => setExpectedImplementationDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Timeline Notes &amp; Urgency
                </label>
                <input
                  className="input-text"
                  style={{ width: '100%', fontSize: '0.82rem', marginTop: '4px' }}
                  placeholder="e.g. Wants deployment live before Ramadan peak season"
                  value={timelineNotes}
                  onChange={(e) => setTimelineNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* SECTION 7: NEXT ACTION & ACTIVITIES */}
          <div id="disc-section-next-action" className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} style={{ color: 'var(--primary)' }} />
                Section 7: Mandatory Next Action
              </h2>

              <button
                className="btn btn-secondary"
                onClick={() => setShowLogActivityModal(true)}
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              >
                + Log Activity
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Next Action Description *
                </label>
                <input
                  className="input-text"
                  style={{ width: '100%', fontSize: '0.85rem', marginTop: '4px' }}
                  placeholder="e.g. Send customized VanForces architecture deck and proposal"
                  value={nextActionDesc}
                  onChange={(e) => setNextActionDesc(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Due Date
                </label>
                <input
                  type="date"
                  className="input-text"
                  style={{ width: '100%', fontSize: '0.85rem', marginTop: '4px' }}
                  value={nextActionDueDate}
                  onChange={(e) => setNextActionDueDate(e.target.value)}
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={handleSaveNextAction}
                disabled={savingNextAction || !nextActionDesc.trim()}
                style={{ padding: '8px', fontSize: '0.82rem' }}
              >
                {savingNextAction ? 'Saving...' : 'Update Next Action'}
              </button>

              {/* Activity Stream Preview */}
              {discoveryActivities.length > 0 && (
                <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                    Recent Unified Activities ({discoveryActivities.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {discoveryActivities.slice(0, 3).map((act: any) => (
                      <div
                        key={act.id}
                        style={{
                          padding: '8px 10px',
                          background: 'var(--bg-surface)',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          border: '1px solid var(--border-subtle)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                          <span>{act.subject}</span>
                          <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>{act.activity_type}</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Next: {act.next_action_description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* MODAL 1: ADD STAKEHOLDER */}
      <Modal
        isOpen={showAddStakeholderModal}
        onClose={() => setShowAddStakeholderModal(false)}
        title="Add Buying Committee Stakeholder"
        subtitle="Link or create a customer contact and assign their role in the purchasing decision."
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
            <button
              className="btn btn-outline"
              onClick={() => setShowAddStakeholderModal(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleAddStakeholder}
              disabled={savingStakeholder}
            >
              {savingStakeholder ? 'Adding...' : 'Add Stakeholder'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>First Name *</label>
              <input
                className="input-text"
                style={{ width: '100%', marginTop: '4px' }}
                value={shFirstName}
                onChange={(e) => setShFirstName(e.target.value)}
                placeholder="e.g. Tariq"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Last Name</label>
              <input
                className="input-text"
                style={{ width: '100%', marginTop: '4px' }}
                value={shLastName}
                onChange={(e) => setShLastName(e.target.value)}
                placeholder="e.g. Al-Mansoor"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Email Address</label>
              <input
                type="email"
                className="input-text"
                style={{ width: '100%', marginTop: '4px' }}
                value={shEmail}
                onChange={(e) => setShEmail(e.target.value)}
                placeholder="tariq@client.com"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Phone Number</label>
              <input
                className="input-text"
                style={{ width: '100%', marginTop: '4px' }}
                value={shPhone}
                onChange={(e) => setShPhone(e.target.value)}
                placeholder="+966 50 123 4567"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Designation</label>
              <input
                className="input-text"
                style={{ width: '100%', marginTop: '4px' }}
                value={shDesignation}
                onChange={(e) => setShDesignation(e.target.value)}
                placeholder="e.g. Head of Van Fleet Operations"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Decision Role *</label>
              <select
                className="input-select"
                style={{ width: '100%', marginTop: '4px' }}
                value={shDecisionRole}
                onChange={(e) => setShDecisionRole(e.target.value as any)}
              >
                <option value="DECISION_MAKER">DECISION MAKER</option>
                <option value="ECONOMIC_BUYER">ECONOMIC BUYER</option>
                <option value="TECHNICAL_EVALUATOR">TECHNICAL EVALUATOR</option>
                <option value="INFLUENCER">INFLUENCER</option>
                <option value="CHAMPION">CHAMPION</option>
                <option value="GATEKEEPER">GATEKEEPER</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Involvement Level</label>
            <select
              className="input-select"
              style={{ width: '100%', marginTop: '4px' }}
              value={shInvolvementLevel}
              onChange={(e) => setShInvolvementLevel(e.target.value as any)}
            >
              <option value="HIGH">HIGH (Participates in all demos)</option>
              <option value="MEDIUM">MEDIUM (Reviews summary &amp; pricing)</option>
              <option value="LOW">LOW (Sign-off only)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Responsibility / Notes</label>
            <input
              className="input-text"
              style={{ width: '100%', marginTop: '4px' }}
              value={shResponsibility}
              onChange={(e) => setShResponsibility(e.target.value)}
              placeholder="e.g. Validates driver offline sync and invoice printing"
            />
          </div>
        </div>
      </Modal>

      {/* MODAL 2: LOG UNIFIED ACTIVITY */}
      <Modal
        isOpen={showLogActivityModal}
        onClose={() => setShowLogActivityModal(false)}
        title="Log Discovery Activity"
        subtitle="Record meeting notes, site visits, or calls in the unified timeline."
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
            <button
              className="btn btn-outline"
              onClick={() => setShowLogActivityModal(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleLogActivity}
              disabled={savingActivity || !actSubject.trim() || !actNextAction.trim()}
            >
              {savingActivity ? 'Saving...' : 'Log Activity'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Activity Type</label>
            <select
              className="input-select"
              style={{ width: '100%', marginTop: '4px' }}
              value={actType}
              onChange={(e) => setActType(e.target.value)}
            >
              <option value="DISCOVERY">Discovery Meeting</option>
              <option value="SITE_VISIT">On-Site Fleet Inspection</option>
              <option value="CALL">Discovery Phone Call</option>
              <option value="WHATSAPP">WhatsApp Discussion</option>
              <option value="EMAIL">Email Follow-Up</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Subject *</label>
            <input
              className="input-text"
              style={{ width: '100%', marginTop: '4px' }}
              value={actSubject}
              onChange={(e) => setActSubject(e.target.value)}
              placeholder="e.g. Conducted in-depth fleet ops review with VP Logistics"
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Notes &amp; Key Findings</label>
            <textarea
              className="input-textarea"
              rows={3}
              style={{ width: '100%', marginTop: '4px' }}
              value={actNotes}
              onChange={(e) => setActNotes(e.target.value)}
              placeholder="Client confirmed 45 vans and manual handwritten delivery books..."
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Next Action Description *</label>
            <input
              className="input-text"
              style={{ width: '100%', marginTop: '4px' }}
              value={actNextAction}
              onChange={(e) => setActNextAction(e.target.value)}
              placeholder="e.g. Schedule customized VanForces demo with dispatch team"
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Next Action Due Date</label>
            <input
              type="date"
              className="input-text"
              style={{ width: '100%', marginTop: '4px' }}
              value={actNextActionDue}
              onChange={(e) => setActNextActionDue(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* MODAL 3: OPTIONAL STAGE WAIVER (DEMO / POC) */}
      <Modal
        isOpen={showWaiverModal}
        onClose={() => setShowWaiverModal(false)}
        title="Optional Stage Handling: Waive Stage"
        subtitle="TEXOL Rule: If Demo or POC is not required for the product/lead, document the reason. Never fake trial records."
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
            <button
              className="btn btn-outline"
              onClick={() => setShowWaiverModal(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleMarkWaiver}
              disabled={savingWaiver || !waiverReason.trim()}
            >
              {savingWaiver ? 'Recording...' : 'Record Waiver with Audit'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Stage to Waive</label>
            <select
              className="input-select"
              style={{ width: '100%', marginTop: '4px' }}
              value={waiverStage}
              onChange={(e) => setWaiverStage(e.target.value as any)}
            >
              <option value="POC">POC Trial (Mark NOT_REQUIRED)</option>
              <option value="DEMO">Product Demo (Proceed straight to Proposal/SQL)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Documented Business Reason *</label>
            <textarea
              className="input-textarea"
              rows={3}
              style={{ width: '100%', marginTop: '4px' }}
              value={waiverReason}
              onChange={(e) => setWaiverReason(e.target.value)}
              placeholder="e.g. Customer waived 30-day POC trial after reviewing on-site reference architecture at Al-Munajem distribution hub; proceeding directly to commercial SQL handoff."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
