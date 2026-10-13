import React, { useState, useEffect } from 'react';
import {
  FileText, CheckCircle2, Clock, ShieldCheck, AlertCircle,
  Plus, X, RefreshCw, Send,
  TrendingUp, Building, ArrowRight,
  Sliders, History, Printer
} from 'lucide-react';
import { api } from '../services/api';
import { Modal } from './common/Modal';
import { CommercialInvoiceModal } from './CommercialInvoiceModal';
import type { Proposal, ProposalVersion, Opportunity, ApprovalRule } from '../services/api';

interface ProposalWorkspaceProps {
  initialOpportunityId?: string;
  onNavigateToOpportunity?: (oppId: string) => void;
  onNavigateToNegotiation?: (oppId: string) => void;
}

export const ProposalWorkspace: React.FC<ProposalWorkspaceProps> = ({
  initialOpportunityId,
  onNavigateToOpportunity,
  onNavigateToNegotiation
}) => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<ProposalVersion | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [approvalRules, setApprovalRules] = useState<ApprovalRule[]>([]);
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Active Workspace Sub-Tab
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'APPROVAL' | 'NEGOTIATION' | 'HISTORY' | 'RULES'>('DETAILS');

  // Create Proposal Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOppId, setNewOppId] = useState(initialOpportunityId || '');
  const [newTitle, setNewTitle] = useState('');
  const [newQuantity, setNewQuantity] = useState(1);
  const [newUnitPrice, setNewUnitPrice] = useState<number | ''>('');
  const [newDiscountPct, setNewDiscountPct] = useState(0);
  const [newDiscountReason, setNewDiscountReason] = useState('');
  const [newTaxPct, setNewTaxPct] = useState(15);
  const [newTermMonths, setNewTermMonths] = useState(12);
  const [newPaymentTerms, setNewPaymentTerms] = useState('Net 30 Days');
  const [newValidDays, setNewValidDays] = useState(30);
  const [creatingProposal, setCreatingProposal] = useState(false);

  // Create New Version Modal
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [verQuantity, setVerQuantity] = useState(1);
  const [verUnitPrice, setVerUnitPrice] = useState<number | ''>('');
  const [verDiscountPct, setVerDiscountPct] = useState(0);
  const [verDiscountReason, setVerDiscountReason] = useState('');
  const [verTaxPct, setVerTaxPct] = useState(15);
  const [verTermMonths, setVerTermMonths] = useState(12);
  const [verPaymentTerms, setVerPaymentTerms] = useState('Net 30 Days');
  const [verNotes, setVerNotes] = useState('');
  const [creatingVersion, setCreatingVersion] = useState(false);

  // Send Proposal Modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sendNextAction, setSendNextAction] = useState('Executive proposal review meeting');
  const [sendNextDue, setSendNextDue] = useState('');
  const [sendingProposal, setSendingProposal] = useState(false);

  // Print Invoice Modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Reject Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Approve Comments Modal
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');
  const [approving, setApproving] = useState(false);

  // Create Approval Rule Modal
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleType, setRuleType] = useState<'DISCOUNT_PERCENT' | 'TOTAL_VALUE' | 'PRICING_EXCEPTION' | 'COMMERCIAL_EXCEPTION'>('DISCOUNT_PERCENT');
  const [ruleThreshold, setRuleThreshold] = useState(15);
  const [ruleRole, setRuleRole] = useState('SALES_MANAGER');
  const [savingRule, setSavingRule] = useState(false);

  // Initial Data Loading
  const loadWorkspaceData = async () => {
    setLoading(true);
    try {
      const [propsRes, oppsRes, rulesRes] = await Promise.all([
        api.getProposals(),
        api.getOpportunities(),
        api.getApprovalRules()
      ]);

      const propList = propsRes.results || [];
      setProposals(propList);
      setOpportunities(oppsRes.results || []);
      setApprovalRules(rulesRes.results || []);

      if (initialOpportunityId) {
        setNewOppId(initialOpportunityId);
        const matching = propList.filter(p => p.opportunity === initialOpportunityId);
        if (matching.length > 0) {
          selectProposalRecord(matching[0]);
        } else {
          const targetOpp = (oppsRes.results || []).find((o: any) => o.id === initialOpportunityId);
          if (targetOpp) {
            setNewTitle(`Commercial Proposal for ${targetOpp.account_name}`);
            const seats = targetOpp.seat_units_count || 1;
            setNewQuantity(seats);
            const tcv = Number(targetOpp.total_contract_value) || 0;
            setNewUnitPrice(tcv > 0 ? Math.round(tcv / seats) : 10000);
            setShowCreateModal(true);
            setFeedbackMsg({
              type: 'success',
              text: `Ready to generate Proposal v1 for ${targetOpp.account_name}. Click "Generate Proposal v1" below.`
            });
          } else if (propList.length > 0) {
            selectProposalRecord(propList[0]);
          }
        }
      } else if (propList.length > 0) {
        selectProposalRecord(propList[0]);
      }
    } catch (err: any) {
      console.error('Failed to load proposals', err);
      setFeedbackMsg({ type: 'error', text: err?.message || 'Error loading proposals.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, [initialOpportunityId]);

  const selectProposalRecord = (prop: Proposal, targetVersionNum?: number) => {
    setSelectedProposal(prop);
    const versions = prop.versions || [];
    if (targetVersionNum) {
      const v = versions.find(item => item.version_number === targetVersionNum);
      setSelectedVersion(v || versions[0] || null);
    } else {
      const activeV = versions.find(item => item.version_number === prop.version_number);
      setSelectedVersion(activeV || versions[0] || null);
    }

    // Load audit history
    api.getProposalHistory(prop.id).then(hist => {
      setAuditHistory(hist || []);
    }).catch(() => {
      setAuditHistory([]);
    });
  };

  const notifyUser = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  // 1. Create Proposal
  const handleCreateProposal = async () => {
    if (!newOppId) {
      notifyUser('error', 'Please select an Opportunity to associate this proposal with.');
      return;
    }
    setCreatingProposal(true);
    try {
      const opp = opportunities.find(o => o.id === newOppId);
      const res = await api.createProposal({
        opportunity: newOppId,
        title: newTitle || `Commercial Proposal for ${opp?.account_name || 'Client'}`,
        quantity: newQuantity,
        unit_price: newUnitPrice !== '' ? Number(newUnitPrice) : undefined,
        discount_pct: newDiscountPct,
        discount_reason: newDiscountReason,
        tax_pct: newTaxPct,
        contract_term_months: newTermMonths,
        payment_terms: newPaymentTerms,
        valid_from: new Date().toISOString().split('T')[0],
        valid_until: new Date(Date.now() + newValidDays * 86400000).toISOString().split('T')[0]
      });
      notifyUser('success', `Proposal ${res.proposal_number} v1 created successfully.`);
      setShowCreateModal(false);
      await loadWorkspaceData();
      selectProposalRecord(res);
    } catch (err: any) {
      notifyUser('error', err?.message || 'Failed to generate proposal.');
    } finally {
      setCreatingProposal(false);
    }
  };

  // 2. Create New Version
  const handleCreateNewVersion = async () => {
    if (!selectedProposal) return;
    setCreatingVersion(true);
    try {
      const res = await api.createProposalVersion(selectedProposal.id, {
        quantity: verQuantity,
        unit_price: verUnitPrice !== '' ? Number(verUnitPrice) : undefined,
        discount_pct: verDiscountPct,
        discount_reason: verDiscountReason,
        tax_pct: verTaxPct,
        contract_term_months: verTermMonths,
        payment_terms: verPaymentTerms,
        notes: verNotes
      });
      notifyUser('success', res.message || `New version v${res.version.version_number} created.`);
      setShowVersionModal(false);
      await loadWorkspaceData();
      selectProposalRecord(res.proposal, res.version.version_number);
    } catch (err: any) {
      notifyUser('error', err?.message || 'Failed to create new proposal version.');
    } finally {
      setCreatingVersion(false);
    }
  };

  // 3. Request Approval
  const handleRequestApproval = async () => {
    if (!selectedProposal || !selectedVersion) return;
    try {
      const reasonPrompt = prompt('Enter justification notes for management approval:', selectedVersion.discount_reason || 'Commercial exception approval');
      if (reasonPrompt === null) return;
      const res = await api.requestProposalApproval(selectedProposal.id, {
        version_number: selectedVersion.version_number,
        reason: reasonPrompt
      });
      notifyUser('success', 'Commercial approval request submitted to Sales Management.');
      await loadWorkspaceData();
      selectProposalRecord(res.proposal, selectedVersion.version_number);
    } catch (err: any) {
      notifyUser('error', err?.message || 'Failed to request approval.');
    }
  };

  // 4. Approve Proposal
  const handleApproveProposal = async () => {
    if (!selectedProposal || !selectedVersion) return;
    setApproving(true);
    try {
      const res = await api.approveProposal(selectedProposal.id, {
        version_number: selectedVersion.version_number,
        comments: approvalComments || 'Approved by commercial sales authority.'
      });
      notifyUser('success', res.message || `Proposal version v${selectedVersion.version_number} approved.`);
      setShowApproveModal(false);
      setApprovalComments('');
      await loadWorkspaceData();
      selectProposalRecord(res.proposal, selectedVersion.version_number);
    } catch (err: any) {
      notifyUser('error', err?.message || 'Approval rejected by authorization rules.');
    } finally {
      setApproving(false);
    }
  };

  // 5. Reject Proposal (Mandatory Reason Enforced)
  const handleRejectProposal = async () => {
    if (!selectedProposal || !selectedVersion) return;
    if (!rejectionReason.trim()) {
      notifyUser('error', 'Rejection reason is mandatory. Silent rejection is blocked.');
      return;
    }
    setRejecting(true);
    try {
      const res = await api.rejectProposal(selectedProposal.id, {
        version_number: selectedVersion.version_number,
        rejection_reason: rejectionReason
      });
      notifyUser('success', res.message || `Proposal version v${selectedVersion.version_number} rejected.`);
      setShowRejectModal(false);
      setRejectionReason('');
      await loadWorkspaceData();
      selectProposalRecord(res.proposal, selectedVersion.version_number);
    } catch (err: any) {
      notifyUser('error', err?.message || 'Failed to record rejection.');
    } finally {
      setRejecting(false);
    }
  };

  // 6. Send Proposal to Client
  const handleSendProposal = async () => {
    if (!selectedProposal || !selectedVersion) return;
    setSendingProposal(true);
    try {
      const res = await api.sendProposal(selectedProposal.id, {
        version_number: selectedVersion.version_number,
        recipient_email: recipientEmail || undefined,
        next_action_description: sendNextAction,
        next_activity_due_at: sendNextDue || undefined
      });
      notifyUser('success', res.message || `Proposal v${selectedVersion.version_number} sent successfully.`);
      setShowSendModal(false);
      await loadWorkspaceData();
      selectProposalRecord(res.proposal, selectedVersion.version_number);
    } catch (err: any) {
      notifyUser('error', err?.message || 'Failed to send proposal.');
    } finally {
      setSendingProposal(false);
    }
  };

  // 7. Mark Expired
  const handleMarkExpired = async () => {
    if (!selectedProposal || !selectedVersion) return;
    if (!confirm(`Are you sure you want to mark Proposal ${selectedProposal.proposal_number} v${selectedVersion.version_number} as Expired?`)) return;
    try {
      const res = await api.expireProposal(selectedProposal.id, selectedVersion.version_number);
      notifyUser('success', `Proposal v${selectedVersion.version_number} marked as EXPIRED.`);
      await loadWorkspaceData();
      selectProposalRecord(res.proposal, selectedVersion.version_number);
    } catch (err: any) {
      notifyUser('error', err?.message || 'Failed to mark as expired.');
    }
  };

  // 8. Transition to Commercial Negotiation
  const handleToNegotiation = async () => {
    if (!selectedProposal) return;
    try {
      await api.transitionOpportunityToNegotiation(
        selectedProposal.opportunity,
        'Proposal sent to client; entering formal commercial negotiation on contract term & payment schedule.'
      );
      notifyUser('success', 'Opportunity transitioned to Commercial Negotiation stage.');
      await loadWorkspaceData();
      if (onNavigateToNegotiation) {
        onNavigateToNegotiation(selectedProposal.opportunity);
      }
    } catch (err: any) {
      notifyUser('error', err?.message || 'Failed to advance to negotiation.');
    }
  };

  // 9. Create Configurable Approval Rule
  const handleCreateRule = async () => {
    if (!ruleName.trim()) {
      notifyUser('error', 'Rule name is required.');
      return;
    }
    setSavingRule(true);
    try {
      await api.createApprovalRule({
        rule_name: ruleName,
        rule_type: ruleType,
        threshold_value: ruleThreshold,
        approver_role: ruleRole,
        is_active: true
      });
      notifyUser('success', `Approval rule '${ruleName}' created successfully.`);
      setShowRuleModal(false);
      setRuleName('');
      const r = await api.getApprovalRules();
      setApprovalRules(r.results || []);
    } catch (err: any) {
      notifyUser('error', err?.message || 'Failed to create approval rule.');
    } finally {
      setSavingRule(false);
    }
  };

  // Color helper for Proposal Status
  const getStatusBadgeClass = (st: string) => {
    switch (st) {
      case 'APPROVED': return 'badge-success';
      case 'SENT': return 'badge-info';
      case 'ACCEPTED': return 'badge-success';
      case 'PENDING_APPROVAL': return 'badge-warning';
      case 'REJECTED': return 'badge-error';
      case 'EXPIRED': return 'badge-error';
      case 'SUPERSEDED': return 'badge-neutral';
      default: return 'badge-neutral';
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Alert */}
      {feedbackMsg && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '8px',
          background: feedbackMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${feedbackMsg.type === 'success' ? 'var(--success)' : 'var(--error)'}`,
          color: feedbackMsg.type === 'success' ? '#34D399' : '#F87171',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 600,
          fontSize: '0.88rem'
        }}>
          {feedbackMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0 }}>
              Commercial Proposals &amp; Approvals
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
            Formal quote generation, immutable versioning, configurable discount governance, and negotiation workflows.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="btn btn-outline" onClick={loadWorkspaceData} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button className="btn btn-outline" onClick={() => setShowRuleModal(true)}>
            <Sliders size={15} />
            Approval Rules ({approvalRules.length})
          </button>

          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
            Create Proposal
          </button>
        </div>
      </div>

      {/* Split Layout: Proposals List on Left, Active Proposal Workspace on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left Side: Proposal Selector List */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Active Proposals ({proposals.length})
            </div>
          </div>

          {proposals.length === 0 ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No proposals found. Click "Create Proposal" to initiate a commercial quote from an Opportunity.
            </div>
          ) : (
            proposals.map(p => {
              const isSelected = selectedProposal?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => selectProposalRecord(p)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-surface)',
                    border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-subtle)'}`,
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{p.proposal_number}</span>
                    <span className={`badge ${getStatusBadgeClass(p.status)}`} style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                      {p.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.account_name || 'Prospect Account'}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    <span>Active: v{p.version_number}</span>
                    <span style={{ fontWeight: 700, color: 'var(--success)' }}>
                      {p.currency} {Number(p.net_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Side: Proposal Workspace Content */}
        {!selectedProposal || !selectedVersion ? (
          <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <FileText size={48} style={{ margin: '0 auto 16px auto', opacity: 0.5 }} />
            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px 0' }}>No Proposal Selected</h3>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Select a commercial proposal from the list on the left, or create a new quote from an opportunity.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header Card */}
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      {selectedProposal.title || selectedProposal.proposal_number}
                    </h2>
                    <span className={`badge ${getStatusBadgeClass(selectedVersion.status)}`}>
                      {selectedVersion.status}
                    </span>
                    {selectedVersion.version_number === selectedProposal.version_number && (
                      <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>CURRENT ACTIVE VERSION</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>Proposal #: <strong style={{ color: 'var(--text-primary)' }}>{selectedProposal.proposal_number}</strong></span>
                    <span>•</span>
                    <span>Account: <strong style={{ color: 'var(--text-primary)' }}>{selectedProposal.account_name}</strong></span>
                    <span>•</span>
                    <span>Primary Contact: <strong style={{ color: 'var(--text-primary)' }}>{selectedProposal.primary_contact_name || 'N/A'}</strong></span>
                    <span>•</span>
                    <span>Product: <strong style={{ color: 'var(--text-primary)' }}>{selectedProposal.product_name}</strong></span>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {onNavigateToOpportunity && (
                    <button
                      className="btn btn-outline"
                      style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                      onClick={() => onNavigateToOpportunity(selectedProposal.opportunity)}
                    >
                      <Building size={14} />
                      Opportunity Workspace
                    </button>
                  )}

                  <button
                    className="btn btn-outline"
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    onClick={() => {
                      setVerDiscountPct(Number(selectedVersion.discount_pct));
                      setVerDiscountReason(selectedVersion.discount_reason || '');
                      setVerTaxPct(Number(selectedVersion.tax_pct));
                      setVerTermMonths(selectedVersion.contract_term_months || 12);
                      setVerPaymentTerms(selectedVersion.payment_terms || 'Net 30 Days');
                      const firstItem = selectedVersion.items?.[0];
                      setVerQuantity(firstItem?.quantity || 1);
                      setVerUnitPrice(firstItem ? Number(firstItem.unit_price) : '');
                      setShowVersionModal(true);
                    }}
                  >
                    <Plus size={14} />
                    New Version (v{(selectedProposal.versions?.length || 1) + 1})
                  </button>

                  {selectedVersion.status === 'PENDING_APPROVAL' && (
                    <>
                      <button
                        className="btn btn-primary"
                        style={{ background: 'var(--success)', borderColor: 'var(--success)', fontSize: '0.8rem', padding: '6px 12px' }}
                        onClick={() => setShowApproveModal(true)}
                        title="Review and approve this proposal version"
                      >
                        <CheckCircle2 size={14} />
                        Approve Version
                      </button>
                      <button
                        className="btn btn-outline"
                        style={{ color: 'var(--error)', borderColor: 'var(--error)', fontSize: '0.8rem', padding: '6px 12px' }}
                        onClick={() => setShowRejectModal(true)}
                        title="Reject this proposal version with required reason"
                      >
                        <X size={14} />
                        Reject Version
                      </button>
                    </>
                  )}

                  <button
                    className="btn btn-outline"
                    style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => setShowInvoiceModal(true)}
                    title="Print the final commercial tax invoice"
                  >
                    <Printer size={14} />
                    Print Invoice
                  </button>

                  <button
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    onClick={() => {
                      setRecipientEmail(selectedProposal.primary_contact_name ? `${selectedProposal.primary_contact_name.toLowerCase().replace(' ', '.')}@${selectedProposal.account_name?.toLowerCase().replace(/\s+/g, '')}.sa` : '');
                      setShowSendModal(true);
                    }}
                  >
                    <Send size={14} />
                    Send Proposal
                  </button>
                </div>
              </div>

              {/* Version Navigation Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '6px' }}>
                  Version Timeline:
                </span>
                {(selectedProposal.versions || []).map(v => {
                  const isCurrent = v.version_number === selectedVersion.version_number;
                  return (
                    <button
                      key={v.id}
                      onClick={() => selectProposalRecord(selectedProposal, v.version_number)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: isCurrent ? 'var(--primary)' : 'var(--bg-surface-elevated)',
                        color: isCurrent ? '#FFFFFF' : 'var(--text-muted)',
                        border: `1px solid ${isCurrent ? 'var(--primary)' : 'var(--border-subtle)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>v{v.version_number}</span>
                      <span style={{ fontSize: '0.65rem', opacity: 0.85 }}>({v.status})</span>
                    </button>
                  );
                })}
              </div>

              {/* High-level KPI Ribbon */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginTop: '4px' }}>
                <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>NET CONTRACT VALUE</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--success)', marginTop: '2px' }}>
                    {selectedVersion.currency} {Number(selectedVersion.net_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Term: {selectedVersion.contract_term_months} Months
                  </div>
                </div>

                <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                    DISCOUNT APPLIED
                    <span style={{ color: Number(selectedVersion.discount_pct) > 0 ? 'var(--warning)' : 'inherit' }}>
                      {selectedVersion.discount_pct}%
                    </span>
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {selectedVersion.currency} {Number(selectedVersion.discount_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedVersion.discount_reason || 'No commercial discount'}
                  </div>
                </div>

                <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>APPROVAL STATUS</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: selectedVersion.approval_required_flag && selectedVersion.status !== 'APPROVED' ? 'var(--warning)' : 'var(--success)', marginTop: '4px' }}>
                    {selectedVersion.approval_required_flag ? selectedVersion.status : 'Auto-Approved (No Exception)'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {selectedVersion.approval_required_flag ? 'Rule Exception Triggered' : 'Standard Commercial Pricing'}
                  </div>
                </div>

                <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>VALIDITY &amp; EXPIRY</div>
                    {!selectedVersion.is_expired && selectedVersion.status !== 'EXPIRED' && (
                      <button
                        onClick={handleMarkExpired}
                        style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        Expire
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: selectedVersion.is_expired ? 'var(--error)' : 'var(--text-primary)', marginTop: '4px' }}>
                    {selectedVersion.valid_until ? `Expires: ${selectedVersion.valid_until}` : '30-Day Default Validity'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: selectedVersion.is_expired ? 'var(--error)' : 'var(--text-muted)', marginTop: '2px' }}>
                    {selectedVersion.is_expired ? 'Proposal has Expired' : 'Quote Active for Client'}
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '2px' }}>
              <button
                className={`btn ${activeTab === 'DETAILS' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                onClick={() => setActiveTab('DETAILS')}
              >
                <FileText size={15} />
                Line Items &amp; Pricing
              </button>

              <button
                className={`btn ${activeTab === 'APPROVAL' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                onClick={() => setActiveTab('APPROVAL')}
              >
                <ShieldCheck size={15} />
                Approval Governance
                {selectedVersion.approval_required_flag && selectedVersion.status === 'PENDING_APPROVAL' && (
                  <span className="badge badge-warning" style={{ fontSize: '0.65rem', marginLeft: '4px' }}>1</span>
                )}
              </button>

              <button
                className={`btn ${activeTab === 'NEGOTIATION' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                onClick={() => setActiveTab('NEGOTIATION')}
              >
                <TrendingUp size={15} />
                Negotiation &amp; Activity
              </button>

              <button
                className={`btn ${activeTab === 'HISTORY' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                onClick={() => setActiveTab('HISTORY')}
              >
                <History size={15} />
                Audit Trail ({auditHistory.length})
              </button>
            </div>

            {/* TAB 1: LINE ITEMS & COMMERCIAL PRICING */}
            {activeTab === 'DETAILS' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Proposal Line Items (Version {selectedVersion.version_number})
                    </h3>
                    <button
                      className="btn btn-outline"
                      style={{ fontSize: '0.78rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => setShowInvoiceModal(true)}
                    >
                      <Printer size={13} />
                      Print Final Invoice
                    </button>
                  </div>

                  {(!selectedVersion.items || selectedVersion.items.length === 0) ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No individual line items configured. Proposal uses aggregate product contract value.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '10px 12px' }}>Product / Module</th>
                            <th style={{ padding: '10px 12px' }}>Description</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Qty</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Unit Price</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Disc %</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedVersion.items.map(item => (
                            <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '12px' }}>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.product_name}</div>
                                {item.module_name && (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>{item.module_name}</div>
                                )}
                              </td>
                              <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                                {item.description || 'Enterprise Module Subscription'}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>
                                {item.quantity}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>
                                {selectedVersion.currency} {Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', color: Number(item.discount_pct) > 0 ? 'var(--warning)' : 'inherit' }}>
                                {item.discount_pct}%
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: 'var(--success)' }}>
                                {selectedVersion.currency} {Number(item.line_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Pricing Financial Summary Calculation */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                    <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                        <span>Subtotal (Gross):</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {selectedVersion.currency} {Number(selectedVersion.gross_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                        <span>Discount ({selectedVersion.discount_pct}%):</span>
                        <span style={{ fontWeight: 700, color: Number(selectedVersion.discount_amount) > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
                          - {selectedVersion.currency} {Number(selectedVersion.discount_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                        <span>Tax / VAT ({selectedVersion.tax_pct}%):</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          + {selectedVersion.currency} {Number(selectedVersion.tax_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '1.05rem',
                        fontWeight: 800,
                        color: 'var(--success)',
                        borderTop: '1px solid var(--border-subtle)',
                        paddingTop: '8px',
                        marginTop: '4px'
                      }}>
                        <span>Total Net Value:</span>
                        <span>{selectedVersion.currency} {Number(selectedVersion.net_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Commercial Terms Panel */}
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>
                    Commercial Terms &amp; Conditions
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', fontSize: '0.82rem' }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>CONTRACT TERM</div>
                      <div style={{ fontWeight: 700, marginTop: '2px', color: 'var(--text-primary)' }}>
                        {selectedVersion.contract_term_months} Months Annual Commitment
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>PAYMENT TERMS</div>
                      <div style={{ fontWeight: 700, marginTop: '2px', color: 'var(--text-primary)' }}>
                        {selectedVersion.payment_terms || 'Net 30 Days from Invoice'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>GOVERNANCE &amp; EXPIRY</div>
                      <div style={{ fontWeight: 700, marginTop: '2px', color: selectedVersion.is_expired ? 'var(--error)' : 'var(--text-primary)' }}>
                        {selectedVersion.valid_until || '30 days from issuance'}
                      </div>
                    </div>
                  </div>
                  {selectedVersion.notes && (
                    <div style={{ marginTop: '14px', padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <strong>Commercial Notes:</strong> {selectedVersion.notes}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: APPROVAL GOVERNANCE (SECTION 10) */}
            {activeTab === 'APPROVAL' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        Commercial Approval Workflow
                      </h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '2px 0 0 0' }}>
                        Management approval enforced when discounts or contract value meet configured threshold limits.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      {selectedVersion.status === 'PENDING_APPROVAL' ? (
                        <>
                          <button
                            className="btn btn-primary"
                            style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
                            onClick={() => setShowApproveModal(true)}
                          >
                            <CheckCircle2 size={16} />
                            Approve Version
                          </button>
                          <button
                            className="btn btn-outline"
                            style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
                            onClick={() => setShowRejectModal(true)}
                          >
                            <X size={16} />
                            Reject Version
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-outline"
                          onClick={handleRequestApproval}
                        >
                          <ShieldCheck size={16} />
                          Re-Request Approval
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Approval State Card */}
                  <div style={{
                    padding: '16px 20px',
                    borderRadius: '8px',
                    background: selectedVersion.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.1)' : selectedVersion.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    border: `1px solid ${selectedVersion.status === 'APPROVED' ? 'var(--success)' : selectedVersion.status === 'REJECTED' ? 'var(--error)' : 'var(--warning)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ShieldCheck size={22} color={selectedVersion.status === 'APPROVED' ? 'var(--success)' : selectedVersion.status === 'REJECTED' ? 'var(--error)' : 'var(--warning)'} />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            {selectedVersion.approval_required_flag ? `Status: ${selectedVersion.status}` : 'Approval Status: Cleared / Not Required'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Proposal Version: <strong>v{selectedVersion.version_number}</strong>
                          </div>
                        </div>
                      </div>

                      <span className={`badge ${getStatusBadgeClass(selectedVersion.status)}`}>
                        {selectedVersion.status}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', fontSize: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>REQUESTED BY</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {selectedVersion.approval_request?.requested_by_name || selectedVersion.created_by_name || 'Sales Representative'}
                        </div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>APPROVAL TYPE</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {selectedVersion.approval_request?.approval_type || 'COMMERCIAL_DISCOUNT_EXCEPTION'}
                        </div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>DECISION DATE</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {selectedVersion.approval_request?.decision_date || selectedVersion.approved_at || selectedVersion.rejected_at || 'Pending Decision'}
                        </div>
                      </div>
                    </div>

                    {selectedVersion.approval_request?.justification_notes && (
                      <div style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '6px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Justification / Trigger: </span>
                        <span style={{ color: 'var(--text-primary)' }}>{selectedVersion.approval_request.justification_notes}</span>
                      </div>
                    )}

                    {selectedVersion.approval_request?.decision_notes && (
                      <div style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '6px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Management Decision Notes: </span>
                        <span style={{ color: selectedVersion.status === 'REJECTED' ? 'var(--error)' : 'var(--success)', fontWeight: 600 }}>
                          {selectedVersion.approval_request.decision_notes}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: NEGOTIATION WORKSPACE (SECTION 17 & 18) */}
            {activeTab === 'NEGOTIATION' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        Commercial Negotiation Stage
                      </h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '2px 0 0 0' }}>
                        Track terms adjustments, buyer objections, and commercial follow-ups on this opportunity.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-primary" onClick={handleToNegotiation}>
                        <ArrowRight size={15} />
                        Advance to Negotiation
                      </button>
                      {onNavigateToNegotiation && (
                        <button
                          className="btn btn-outline"
                          onClick={() => onNavigateToNegotiation(selectedProposal.opportunity)}
                          style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}
                        >
                          Open Negotiation Stage
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>LAST RECORDED ACTIVITY</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                        {selectedProposal.sent_at ? `Proposal v${selectedVersion.version_number} Sent` : 'Proposal Drafted'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {selectedProposal.sent_at || selectedProposal.created_at}
                      </div>
                    </div>

                    <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>NEXT COMMERCIAL ACTION</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>
                        Negotiate commercial payment terms &amp; rollout schedule
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        SLA Target: Within 3 business days
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: AUDIT TRAIL */}
            {activeTab === 'HISTORY' && (
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px 0' }}>
                  Universal Proposal Audit Trail (WHO, WHAT, WHEN)
                </h3>

                {auditHistory.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No audit records found for this proposal yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {auditHistory.map(entry => (
                      <div
                        key={entry.id}
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{entry.action}</span>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{entry.actor_email || 'System User'}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({entry.actor_role})</span>
                          </div>

                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {JSON.stringify(entry.changes_json || {})}
                          </div>
                        </div>

                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                          <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          {new Date(entry.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: CREATE PROPOSAL */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Commercial Proposal"
        subtitle="Generate v1 proposal with configured commercial terms, discounts, and payment schedule."
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={20} />
          </div>
        }
        maxWidth="540px"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowCreateModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateProposal} disabled={creatingProposal || !newOppId}>
              {creatingProposal ? 'Generating...' : 'Generate Proposal v1'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Target Opportunity *</label>
            <select
              value={newOppId}
              onChange={(e) => {
                const oppId = e.target.value;
                setNewOppId(oppId);
                const opp = opportunities.find(o => o.id === oppId);
                if (opp) {
                  const seats = opp.seat_units_count || 1;
                  setNewQuantity(seats);
                  const tcv = Number(opp.total_contract_value) || 0;
                  setNewUnitPrice(tcv > 0 ? Math.round(tcv / seats) : 10000);
                  if (!newTitle) {
                    setNewTitle(`Commercial Proposal for ${opp.account_name}`);
                  }
                }
              }}
              style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
            >
              <option value="">Select Opportunity...</option>
              {opportunities.map(o => (
                <option key={o.id} value={o.id}>
                  {o.account_name} — {o.product_name} ({o.currency} {Number(o.total_contract_value).toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Proposal Title</label>
            <input
              type="text"
              placeholder="e.g. Enterprise Fleet Transformation Proposal"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>
                Licensed Quantity / Seats *
              </label>
              <input
                type="number"
                min="1"
                value={newQuantity}
                onChange={(e) => setNewQuantity(Math.max(1, Number(e.target.value)))}
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>
                Unit Price ({opportunities.find(o => o.id === newOppId)?.currency || 'USD'})
              </label>
              <input
                type="number"
                min="0"
                placeholder="Unit price per seat"
                value={newUnitPrice}
                onChange={(e) => setNewUnitPrice(e.target.value ? Number(e.target.value) : '')}
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {newUnitPrice !== '' && (
            <div style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600, padding: '4px 8px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '6px' }}>
              Base Gross Subtotal: {opportunities.find(o => o.id === newOppId)?.currency || 'USD'} {(newQuantity * Number(newUnitPrice)).toLocaleString()} ({newQuantity} units @ {Number(newUnitPrice).toLocaleString()})
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Discount Percentage (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={newDiscountPct}
                onChange={(e) => setNewDiscountPct(Number(e.target.value))}
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Tax / VAT (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={newTaxPct}
                onChange={(e) => setNewTaxPct(Number(e.target.value))}
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {newDiscountPct > 0 && (
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Discount Justification</label>
              <input
                type="text"
                placeholder="e.g. High-volume 50-vehicle commitment"
                value={newDiscountReason}
                onChange={(e) => setNewDiscountReason(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Contract Term (Months)</label>
              <input
                type="number"
                value={newTermMonths}
                onChange={(e) => setNewTermMonths(Number(e.target.value))}
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Validity (Days)</label>
              <input
                type="number"
                value={newValidDays}
                onChange={(e) => setNewValidDays(Number(e.target.value))}
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Payment Terms</label>
            <input
              type="text"
              value={newPaymentTerms}
              onChange={(e) => setNewPaymentTerms(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
            />
          </div>
        </div>
      </Modal>

      {/* MODAL: CREATE NEW VERSION */}
      <Modal
        isOpen={showVersionModal && !!selectedProposal}
        onClose={() => setShowVersionModal(false)}
        title={`Create Proposal Version v${(selectedProposal?.versions?.length || 1) + 1}`}
        subtitle="Creates an immutable new version preserving previous versions. If discount or terms trigger approval rules, independent approval will be required."
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={20} />
          </div>
        }
        maxWidth="540px"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowVersionModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateNewVersion} disabled={creatingVersion}>
              {creatingVersion ? 'Creating...' : `Create Version v${(selectedProposal?.versions?.length || 1) + 1}`}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Revised Quantity / Seats</label>
              <input
                type="number"
                min="1"
                value={verQuantity}
                onChange={(e) => setVerQuantity(Math.max(1, Number(e.target.value)))}
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Unit Price ({selectedVersion?.currency || 'USD'})</label>
              <input
                type="number"
                min="0"
                placeholder="Unit price per seat"
                value={verUnitPrice}
                onChange={(e) => setVerUnitPrice(e.target.value ? Number(e.target.value) : '')}
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Revised Discount (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={verDiscountPct}
                onChange={(e) => setVerDiscountPct(Number(e.target.value))}
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Tax / VAT (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={verTaxPct}
                onChange={(e) => setVerTaxPct(Number(e.target.value))}
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Revision Justification / Notes</label>
            <input
              type="text"
              placeholder="e.g. Revised quote with quarterly billing per CFO negotiation"
              value={verDiscountReason}
              onChange={(e) => setVerDiscountReason(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Contract Term (Months)</label>
              <input
                type="number"
                value={verTermMonths}
                onChange={(e) => setVerTermMonths(Number(e.target.value))}
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Payment Terms</label>
              <input
                type="text"
                value={verPaymentTerms}
                onChange={(e) => setVerPaymentTerms(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Internal Version Notes</label>
            <input
              type="text"
              placeholder="e.g. Terms negotiated with client VP"
              value={verNotes}
              onChange={(e) => setVerNotes(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
            />
          </div>
        </div>
      </Modal>

      {/* MODAL: SEND PROPOSAL */}
      <Modal
        isOpen={showSendModal && !!selectedProposal && !!selectedVersion}
        onClose={() => setShowSendModal(false)}
        title={`Deliver Proposal ${selectedProposal?.proposal_number || ''} v${selectedVersion?.version_number || ''}`}
        subtitle="Confirm client dispatch and specify mandatory next commercial follow-up step."
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Send size={18} />
          </div>
        }
        maxWidth="500px"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowSendModal(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleSendProposal}
              disabled={sendingProposal || (selectedVersion?.approval_required_flag && selectedVersion?.status !== 'APPROVED') || selectedVersion?.is_expired}
            >
              {sendingProposal ? 'Delivering...' : 'Send to Client'}
            </button>
          </>
        }
      >
        {selectedVersion?.approval_required_flag && selectedVersion?.status !== 'APPROVED' ? (
          <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--error)', color: '#F87171', fontSize: '0.85rem' }}>
            <AlertCircle size={18} style={{ display: 'inline', marginRight: '6px' }} />
            <strong>Sending Blocked:</strong> Management approval is required before delivery to client (Current Status: {selectedVersion.status}).
          </div>
        ) : selectedVersion?.is_expired ? (
          <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--error)', color: '#F87171', fontSize: '0.85rem' }}>
            <AlertCircle size={18} style={{ display: 'inline', marginRight: '6px' }} />
            <strong>Sending Blocked:</strong> This proposal version has expired. Create a new version with updated validity.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Recipient Email *</label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="ahmed.mansoor@saudilogistics.sa"
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Next Commercial Action *</label>
              <input
                type="text"
                value={sendNextAction}
                onChange={(e) => setSendNextAction(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Next Action Target Due Date</label>
              <input
                type="date"
                value={sendNextDue}
                onChange={(e) => setSendNextDue(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: REJECT PROPOSAL (MANDATORY REASON) */}
      <Modal
        isOpen={showRejectModal && !!selectedProposal && !!selectedVersion}
        onClose={() => setShowRejectModal(false)}
        title="Reject Proposal Version"
        subtitle={`Rejecting will mark version v${selectedVersion?.version_number || ''} as REJECTED and unlock revision for the sales team. A rejection reason is mandatory.`}
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--error)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={20} />
          </div>
        }
        maxWidth="480px"
        accentGradient="linear-gradient(90deg, var(--error) 0%, #DC2626 100%)"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowRejectModal(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              style={{ background: 'var(--error)', borderColor: 'var(--error)' }}
              onClick={handleRejectProposal}
              disabled={rejecting || !rejectionReason.trim()}
            >
              {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </>
        }
      >
        <div>
          <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px', fontSize: '0.85rem' }}>Rejection Reason *</label>
          <textarea
            rows={4}
            placeholder="Document explicit commercial or governance grounds for declining this proposal..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)', resize: 'vertical', fontSize: '0.85rem' }}
          />
        </div>
      </Modal>

      {/* MODAL: APPROVE PROPOSAL */}
      <Modal
        isOpen={showApproveModal && !!selectedProposal && !!selectedVersion}
        onClose={() => setShowApproveModal(false)}
        title="Approve Proposal Version"
        subtitle="Authorize discounted commercial terms and unlock delivery to customer."
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(5, 150, 105, 0.15)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={20} />
          </div>
        }
        maxWidth="480px"
        accentGradient="linear-gradient(90deg, var(--success) 0%, #059669 100%)"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowApproveModal(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
              onClick={handleApproveProposal}
              disabled={approving}
            >
              {approving ? 'Approving...' : 'Confirm Approval'}
            </button>
          </>
        }
      >
        <div>
          <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px', fontSize: '0.85rem' }}>Approval Comments (Optional)</label>
          <textarea
            rows={4}
            placeholder="e.g. Approved under executive discretion for strategic enterprise account acquisition."
            value={approvalComments}
            onChange={(e) => setApprovalComments(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)', resize: 'vertical', fontSize: '0.85rem' }}
          />
        </div>
      </Modal>

      {/* MODAL: CREATE APPROVAL RULE */}
      <Modal
        isOpen={showRuleModal}
        onClose={() => setShowRuleModal(false)}
        title="Configurable Approval Rules"
        subtitle="Configure discount threshold caps and escalation authority roles."
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sliders size={20} />
          </div>
        }
        maxWidth="540px"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowRuleModal(false)}>Close</button>
            <button className="btn btn-primary" onClick={handleCreateRule} disabled={savingRule || !ruleName.trim()}>
              {savingRule ? 'Saving...' : 'Save Approval Rule'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Existing Active Rules */}
          <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>ACTIVE RULES:</div>
            {approvalRules.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-surface-elevated)', borderRadius: '6px', fontSize: '0.78rem' }}>
                <span style={{ fontWeight: 600 }}>{r.rule_name}</span>
                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{r.rule_type}: {r.threshold_value} ({r.approver_role})</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Add New Governance Rule:</div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 600 }}>Rule Name</label>
              <input
                type="text"
                placeholder="e.g. Standard Discount 15% Cap"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 600 }}>Rule Dimension</label>
                <select
                  value={ruleType}
                  onChange={(e: any) => setRuleType(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
                >
                  <option value="DISCOUNT_PERCENT">Discount Percentage (%)</option>
                  <option value="TOTAL_VALUE">Total Contract Value</option>
                  <option value="PRICING_EXCEPTION">Pricing Exception</option>
                  <option value="COMMERCIAL_EXCEPTION">Commercial Exception</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 600 }}>Threshold Value</label>
                <input
                  type="number"
                  value={ruleThreshold}
                  onChange={(e) => setRuleThreshold(Number(e.target.value))}
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 600 }}>Approver Authority Role</label>
              <select
                value={ruleRole}
                onChange={(e) => setRuleRole(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)' }}
              >
                <option value="SALES_MANAGER">Sales Manager</option>
                <option value="VP_SALES">VP of Sales</option>
                <option value="FINANCE_HEAD">Finance Head</option>
                <option value="ADMIN">System Administrator</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* Final Commercial Invoice Modal (Print Ready) */}
      <CommercialInvoiceModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        proposal={selectedProposal}
        version={selectedVersion}
        opportunity={opportunities.find(o => o.id === selectedProposal?.opportunity)}
      />
    </div>
  );
};
