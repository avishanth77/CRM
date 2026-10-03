import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Building2,
  ShieldCheck, RefreshCw, ExternalLink, CheckSquare, AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
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
      setFeedbackMsg({
        type: 'success',
        text: `SQL Handoff accepted! Commercial Opportunity #${res.opportunity_id.substring(0, 8)} created successfully.`
      });
      await fetchHandoffs();
      if (res.opportunity_id && onNavigateToOpportunity) {
        // Optional quick prompt
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to accept SQL handoff.' });
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedHandoff) return;
    if (!rejectionReason.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Rejection reason is mandatory when declining an SQL handoff.' });
      return;
    }
    setRejecting(true);
    setFeedbackMsg(null);
    try {
      await api.rejectSQLHandoff(selectedHandoff.id, rejectionReason.trim(), returnTarget);
      setFeedbackMsg({
        type: 'success',
        text: `SQL Handoff rejected and returned to ${returnTarget}. Lead updated with audit trail.`
      });
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
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Sales Acceptance Review Workspace
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Review qualified SQL handoffs from PLD, monitor SLAs, and accept or reject with full governance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
            {(['PENDING', 'ACCEPTED', 'REJECTED', 'ALL'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            onClick={fetchHandoffs}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh Queue"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl flex items-start gap-3 text-sm ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
          )}
          <div className="flex-1 font-medium">{feedbackMsg.text}</div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-xs font-semibold hover:underline opacity-70"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Queue on left (1 col), Detail on right (2 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Queue List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Handoff Queue ({filteredHandoffs.length})
            </h3>
          </div>

          <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
            {filteredHandoffs.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                No SQL handoffs match the selected filter.
              </div>
            ) : (
              filteredHandoffs.map((h) => {
                const isSelected = selectedHandoff?.id === h.id;
                return (
                  <div
                    key={h.id}
                    onClick={() => setSelectedHandoff(h)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-500 shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                          {h.company_name}
                        </h4>
                        <span className="text-xs text-slate-500 block mt-0.5">
                          {h.product_name}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          h.status === 'ACCEPTED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : h.status === 'REJECTED'
                            ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {h.status}
                      </span>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {h.estimated_value} {h.currency}
                      </span>
                      {h.status === 'PENDING' && (
                        <span
                          className={`font-semibold flex items-center gap-1 text-[11px] ${
                            h.is_sla_overdue ? 'text-red-600 font-bold' : 'text-slate-500'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
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
        <div className="lg:col-span-2">
          {selectedHandoff ? (
            <div className="space-y-6">
              {/* Context Header */}
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                      SQL HANDOFF RECORD #{selectedHandoff.id.substring(0, 8)}
                    </span>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                      {selectedHandoff.company_name}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Submitted on {new Date(selectedHandoff.created_at).toLocaleDateString()} by{' '}
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {selectedHandoff.pld_executive_name || 'PLD Executive'}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {onNavigateToLead && (
                      <button
                        onClick={() => onNavigateToLead(selectedHandoff.lead)}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                      >
                        View Lead
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {selectedHandoff.opportunity_id && onNavigateToOpportunity && (
                      <button
                        onClick={() => onNavigateToOpportunity(selectedHandoff.opportunity_id!)}
                        className="px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold text-xs hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
                      >
                        Open Opportunity
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block font-medium">ESTIMATED VALUE</span>
                    <span className="text-slate-900 dark:text-slate-100 font-black text-base mt-0.5 block">
                      {selectedHandoff.estimated_value} {selectedHandoff.currency}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block font-medium">PRODUCT</span>
                    <span className="text-slate-900 dark:text-slate-100 font-bold text-sm mt-0.5 block">
                      {selectedHandoff.product_name}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block font-medium">ASSIGNED SALES OWNER</span>
                    <span className="text-slate-900 dark:text-slate-100 font-semibold text-sm mt-0.5 block">
                      {selectedHandoff.sales_owner_name || 'Pending Acceptance'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block font-medium">SLA DEADLINE</span>
                    <span
                      className={`font-bold text-sm mt-0.5 block ${
                        selectedHandoff.is_sla_overdue ? 'text-red-600' : 'text-emerald-600'
                      }`}
                    >
                      {selectedHandoff.is_sla_overdue
                        ? 'OVERDUE'
                        : `${selectedHandoff.sla_remaining_hours}h Remaining`}
                    </span>
                  </div>
                </div>

                {/* Authorized Override Notice if applied */}
                {selectedHandoff.is_override && (
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Authorized Override Applied at Submission:</span>
                      <p className="mt-0.5">{selectedHandoff.override_reason}</p>
                      {selectedHandoff.override_approved_by_name && (
                        <span className="text-[11px] text-amber-700 dark:text-amber-400 block mt-1">
                          Approved by {selectedHandoff.override_approved_by_name}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Qualification Evidence Snapshot */}
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-indigo-500" />
                  Verified Qualification Evidence (What We Know)
                </h3>

                {selectedHandoff.qualification_evidence?.what_we_know &&
                selectedHandoff.qualification_evidence.what_we_know.length > 0 ? (
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {selectedHandoff.qualification_evidence.what_we_know.map((item, idx) => (
                      <li
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 italic">No evidence summary available.</p>
                )}

                {/* Gate Audit Breakdown */}
                {Array.isArray(selectedHandoff.gate_audit_results) && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                      9-Gate Snapshot Results
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      {selectedHandoff.gate_audit_results.map((g: any, i: number) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                        >
                          <span className="font-medium text-slate-700 dark:text-slate-300 truncate mr-2">
                            {g.name}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              g.status === 'PASS'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
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
                <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white shadow-xl space-y-4">
                  <div>
                    <h3 className="text-lg font-bold">Sales Acceptance Decision</h3>
                    <p className="text-xs text-slate-300 mt-1">
                      Accepting this handoff confirms Sales ownership, converts the lead, and creates the commercial Opportunity with all carried-forward technical context.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <button
                      onClick={handleAccept}
                      disabled={accepting}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {accepting ? 'Accepting & Converting...' : 'ACCEPT SQL & CREATE OPPORTUNITY'}
                    </button>

                    <button
                      onClick={() => setShowRejectModal(true)}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-red-300 font-semibold text-sm transition-all border border-red-500/30 flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4 text-red-400" />
                      REJECT SQL HANDOFF
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between">
                  <span className="text-slate-500">
                    Decision concluded on{' '}
                    {selectedHandoff.decision_date
                      ? new Date(selectedHandoff.decision_date).toLocaleString()
                      : 'N/A'}{' '}
                    — Status:{' '}
                    <strong className="text-slate-900 dark:text-slate-100">
                      {selectedHandoff.status}
                    </strong>
                  </span>
                  {selectedHandoff.rejection_reason && (
                    <span className="text-red-600 font-medium">
                      Reason: {selectedHandoff.rejection_reason}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-sm">
              Select an SQL Handoff from the queue to review commercial qualification details.
            </div>
          )}
        </div>
      </div>

      {/* Sales Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-red-300 dark:border-red-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Reject SQL Handoff
                </h3>
                <p className="text-xs text-slate-500">
                  Sales rejection requires an auditable reason and routing target.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Mandatory Rejection Reason *
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Economic decision maker deferred project indefinitely; fleet size is under target qualification threshold."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Return Pursuit To Stage:
              </label>
              <select
                value={returnTarget}
                onChange={(e: any) => setReturnTarget(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="NURTURE">Nurture Pipeline (Deferred timeline / inactive)</option>
                <option value="DISCOVERY">Technical Discovery (Requires problem refinement)</option>
                <option value="PLD">PLD Qualification (Requires further prospecting)</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejecting || !rejectionReason.trim()}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors shadow-lg shadow-red-600/20"
              >
                {rejecting ? 'Recording Rejection...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
