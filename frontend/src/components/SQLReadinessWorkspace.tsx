import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, AlertTriangle, XCircle, ShieldAlert,
  Send, DollarSign, Clock, RefreshCw, CheckSquare,
  Building2, User, ShieldCheck, AlertCircle, ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import type {
  Lead, SQLReadinessData, SQLHandoff
} from '../services/api';

interface SQLReadinessWorkspaceProps {
  initialLeadId?: string;
  onNavigateToOpportunity?: (opportunityId: string) => void;
  onNavigateToSalesAcceptance?: (handoffId: string) => void;
}

export const SQLReadinessWorkspace: React.FC<SQLReadinessWorkspaceProps> = ({
  initialLeadId,
  onNavigateToOpportunity,
  onNavigateToSalesAcceptance
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PASS
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
            <XCircle className="w-3.5 h-3.5" />
            BLOCKED
          </span>
        );
      case 'MISSING':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            MISSING
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Lead Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                SQL Readiness & Commercial Handoff Gate
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Enforces the 9 documented qualification gates before commercial submission to Sales.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Lead:</label>
          <select
            value={selectedLeadId}
            onChange={(e) => setSelectedLeadId(e.target.value)}
            className="px-3.5 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.account_name} — {l.primary_product_name} ({l.status})
              </option>
            ))}
          </select>

          <button
            onClick={() => selectedLeadId && fetchReadiness(selectedLeadId)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh Gates"
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

      {selectedLead && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">ACCOUNT</span>
            <span className="text-slate-900 dark:text-slate-100 font-semibold text-sm flex items-center gap-1.5 mt-0.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-500" />
              {selectedLead.account_name}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">PRIMARY CONTACT</span>
            <span className="text-slate-900 dark:text-slate-100 font-semibold text-sm flex items-center gap-1.5 mt-0.5">
              <User className="w-3.5 h-3.5 text-emerald-500" />
              {selectedLead.contact_name || 'Unassigned Contact'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">PRODUCT</span>
            <span className="text-slate-900 dark:text-slate-100 font-semibold text-sm mt-0.5 block">
              {selectedLead.primary_product_name} ({selectedLead.primary_product_code})
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">CURRENT STAGE / STATUS</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold text-sm mt-0.5 block">
              {selectedLead.current_stage_name || selectedLead.status}
            </span>
          </div>
        </div>
      )}

      {/* SQL Status Banner */}
      {readinessData && (
        <div
          className={`p-6 rounded-2xl border transition-all ${
            readinessData.is_ready
              ? 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/30'
              : 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`p-3.5 rounded-2xl ${
                  readinessData.is_ready
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                }`}
              >
                {readinessData.is_ready ? (
                  <CheckCircle2 className="w-7 h-7" />
                ) : (
                  <AlertTriangle className="w-7 h-7" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    SQL READINESS STATUS
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      readinessData.is_ready
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {readinessData.status}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {readinessData.is_ready
                    ? 'All 9 Qualification Gates Passed — Ready for Sales'
                    : `${readinessData.missing_gates.length} Mandatory Qualification Gate(s) Incomplete`}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {readinessData.is_ready
                    ? 'This pursuit meets the documented criteria for commercial review. Submit to notify Sales and start the 48-hour acceptance SLA.'
                    : 'Backend validation strictly blocks SQL conversion until all gates are completed, or an authorized manager override is approved.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end md:self-auto">
              {!readinessData.is_ready && (
                <button
                  onClick={() => setShowOverrideModal(true)}
                  className="px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-sm font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors flex items-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Authorized Override
                </button>
              )}
            </div>
          </div>

          {/* Missing Gates Box */}
          {!readinessData.is_ready && readinessData.what_is_missing.length > 0 && (
            <div className="mt-5 p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Missing Qualification Evidence Required Before Handoff:
              </div>
              <ul className="space-y-1.5">
                {readinessData.what_is_missing.map((item, idx) => (
                  <li key={idx} className="text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 9-Gate Checklist & Submission Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gates Checklist (2 columns) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-indigo-500" />
              Documented SQL Readiness Gates (9 Mandatory Gates)
            </h3>
            <span className="text-xs text-slate-400 font-medium">Source of Truth: TEXOL PLD CRM v1.1</span>
          </div>

          {readinessData?.checklist.map((gate, index) => (
            <div
              key={gate.gate_code}
              className={`p-4 rounded-xl border transition-all ${
                gate.status === 'PASS'
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800'
                  : 'bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-900/60 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {gate.name}
                      </h4>
                      {gate.is_mandatory && (
                        <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          Mandatory
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {gate.description}
                    </p>
                    <div className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/80">
                      <span className="text-slate-400 mr-1.5 font-normal">Evidence:</span>
                      {gate.evidence || 'No verified evidence on file'}
                    </div>
                  </div>
                </div>
                {getGateStatusBadge(gate.status)}
              </div>
            </div>
          ))}
        </div>

        {/* Commercial Submission & SLA Controls (1 column) */}
        <div className="space-y-6">
          {/* Active Handoff Card if exists */}
          {activeHandoff && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Active SQL Handoff #{activeHandoff.id.substring(0, 8)}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    activeHandoff.status === 'ACCEPTED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : activeHandoff.status === 'REJECTED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {activeHandoff.status}
                </span>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/50">
                  <span className="text-slate-400">Assigned Sales Owner</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {activeHandoff.sales_owner_name || 'Unassigned'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/50">
                  <span className="text-slate-400">Estimated Deal Value</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {activeHandoff.estimated_value} {activeHandoff.currency}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/50">
                  <span className="text-slate-400">SLA Duration</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {activeHandoff.sla_duration_hours} Hours
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/50">
                  <span className="text-slate-400">SLA Health</span>
                  <span
                    className={`font-bold ${
                      activeHandoff.is_sla_overdue
                        ? 'text-red-600 animate-pulse'
                        : 'text-emerald-600'
                    }`}
                  >
                    {activeHandoff.is_sla_overdue
                      ? 'OVERDUE'
                      : `${activeHandoff.sla_remaining_hours}h Remaining`}
                  </span>
                </div>
                {activeHandoff.is_override && (
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200">
                    <span className="font-bold block">Authorized Override Applied:</span>
                    {activeHandoff.override_reason}
                  </div>
                )}
                {activeHandoff.status === 'PENDING' && onNavigateToSalesAcceptance && (
                  <button
                    onClick={() => onNavigateToSalesAcceptance(activeHandoff.id)}
                    className="w-full mt-2 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    Review in Sales Acceptance Queue
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
                {activeHandoff.opportunity_id && onNavigateToOpportunity && (
                  <button
                    onClick={() => onNavigateToOpportunity(activeHandoff.opportunity_id!)}
                    className="w-full mt-2 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    View Converted Opportunity
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Submission Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Send className="w-4 h-4 text-indigo-500" />
              Commercial Handoff Submission
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter estimated commercial value and configure the Sales Acceptance SLA before handoff.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Estimated Opportunity Value (Contract Total) *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={estimatedValue || ''}
                    onChange={(e) => setEstimatedValue(Number(e.target.value))}
                    className="w-full pl-9 pr-14 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. 85000"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs font-bold text-slate-400">
                    {currency}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="USD">USD ($)</option>
                  <option value="SAR">SAR (Saudi Riyal)</option>
                  <option value="AED">AED (UAE Dirham)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sales Acceptance SLA (Hours)
                </label>
                <select
                  value={slaHours}
                  onChange={(e) => setSlaHours(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                readinessData?.is_ready && estimatedValue > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
              }`}
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Submitting for Sales Review...' : 'Submit for Sales Acceptance'}
            </button>

            {!readinessData?.is_ready && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center font-medium">
                ⚠ Submission blocked until all 9 qualification gates pass or an authorized override is applied.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Authorized Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Authorized SQL Readiness Override
                </h3>
                <p className="text-xs text-slate-500">
                  Executive governance bypass for incomplete qualification gates.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 text-xs text-amber-900 dark:text-amber-200 space-y-2">
              <span className="font-bold block">Incomplete Gates to be Overridden:</span>
              <ul className="list-disc pl-4 space-y-1">
                {readinessData?.missing_gates.map((g, idx) => (
                  <li key={idx}>{g}</li>
                ))}
              </ul>
              <span className="block text-[11px] text-amber-700 dark:text-amber-400 italic mt-2">
                * Note: The original gate results and your reason will remain permanently visible in the audit history.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Mandatory Override Business Justification *
              </label>
              <textarea
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g., Executive sponsor confirmed commercial review; board requested fast-track commercial proposal."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowOverrideModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAuthorizeOverride}
                disabled={submittingOverride || !overrideReason.trim()}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-lg shadow-amber-600/20"
              >
                {submittingOverride ? 'Recording Override...' : 'Approve Override & Submit SQL'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
