import React, { useState, useEffect } from 'react';
import {
  User, TrendingUp, CheckCircle2, Clock, ShieldCheck, RefreshCw,
  Plus, Edit3, X, Activity as ActivityIcon, AlertCircle, Layers, History, Award
} from 'lucide-react';
import { api } from '../services/api';
import type { Opportunity } from '../services/api';

interface OpportunityWorkspaceProps {
  initialOpportunityId?: string;
  onNavigateToAccount?: (accountId: string) => void;
}

export const OpportunityWorkspace: React.FC<OpportunityWorkspaceProps> = ({
  initialOpportunityId,
  onNavigateToAccount
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
  }, []);

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
      fetchOpportunityDetails(selectedOpportunity.id);
      setEditValue(Number(selectedOpportunity.total_contract_value || 0));
      setEditArr(Number(selectedOpportunity.arr || 0));
      setEditMrr(Number(selectedOpportunity.mrr || 0));
      setEditPlan(selectedOpportunity.pricing_plan || '');
      setEditSeats(selectedOpportunity.seat_units_count || 1);
      setEditTerm(selectedOpportunity.contract_term_months || 12);
      setEditProb(selectedOpportunity.probability_pct || 50);
      setEditCloseDate(selectedOpportunity.expected_close_date || '');
    }
  }, [selectedOpportunity]);

  const handleSaveCommercials = async () => {
    if (!selectedOpportunity) return;
    if (editValue < 0) {
      setFeedbackMsg({ type: 'error', text: 'Contract value cannot be negative.' });
      return;
    }
    setSavingCommercials(true);
    setFeedbackMsg(null);
    try {
      const res = await api.updateOpportunityCommercials(selectedOpportunity.id, {
        total_contract_value: editValue,
        arr: editArr,
        mrr: editMrr,
        pricing_plan: editPlan,
        seat_units_count: editSeats,
        contract_term_months: editTerm,
        probability_pct: editProb,
        expected_close_date: editCloseDate || undefined
      });
      setSelectedOpportunity(res.opportunity);
      setIsEditingCommercials(false);
      setFeedbackMsg({ type: 'success', text: 'Commercial parameters updated and logged in Audit.' });
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
    setFeedbackMsg(null);
    try {
      const res = await api.transitionOpportunityStage(selectedOpportunity.id, targetStageId, transitionReason);
      setSelectedOpportunity(res.opportunity);
      setShowTransitionModal(false);
      setTransitionReason('');
      setFeedbackMsg({ type: 'success', text: `Stage transitioned to ${res.opportunity.stage_name}.` });
      fetchOpportunities();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to transition stage.' });
    } finally {
      setTransitioning(false);
    }
  };

  const handleLogActivity = async () => {
    if (!selectedOpportunity) return;
    if (!activitySubject.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Activity subject is required.' });
      return;
    }
    if (!nextActionDesc.trim() || !nextActionDue) {
      setFeedbackMsg({ type: 'error', text: 'Mandatory next action description and future due date are required.' });
      return;
    }
    setLoggingActivity(true);
    setFeedbackMsg(null);
    try {
      await api.createActivity({
        opportunity: selectedOpportunity.id,
        account: selectedOpportunity.account,
        activity_type: activityType,
        subject: activitySubject.trim(),
        outcome_notes: activityOutcome.trim(),
        next_action_description: nextActionDesc.trim(),
        next_action_due_at: nextActionDue
      });
      setShowActivityModal(false);
      setActivitySubject('');
      setActivityOutcome('');
      setNextActionDesc('');
      setNextActionDue('');
      setFeedbackMsg({ type: 'success', text: 'Activity logged successfully.' });
      fetchOpportunityDetails(selectedOpportunity.id);
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
    <div className="space-y-6">
      {/* Top Header & Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Commercial Opportunity Workspace
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage enterprise deals created from accepted SQLs, track ARR/MRR commercials, and execute pipeline stages.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Opportunity:</label>
          <select
            value={selectedOpportunity?.id || ''}
            onChange={(e) => {
              const opp = opportunities.find((o) => o.id === e.target.value);
              if (opp) setSelectedOpportunity(opp);
            }}
            className="px-3.5 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            {opportunities.map((o) => (
              <option key={o.id} value={o.id}>
                {o.account_name} — {o.total_contract_value} {o.currency} ({o.status})
              </option>
            ))}
          </select>

          <button
            onClick={fetchOpportunities}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh Opportunities"
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

      {selectedOpportunity ? (
        <div className="space-y-6">
          {/* Main Deal Summary Banner */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                    OPPORTUNITY #{selectedOpportunity.id.substring(0, 8)}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {selectedOpportunity.opportunity_type}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      selectedOpportunity.status === 'WON'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : selectedOpportunity.status === 'LOST'
                        ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                    }`}
                  >
                    {selectedOpportunity.status}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 flex items-center gap-2">
                  {selectedOpportunity.account_name}
                  {onNavigateToAccount && (
                    <button
                      onClick={() => onNavigateToAccount(selectedOpportunity.account)}
                      className="text-xs font-semibold text-violet-600 hover:text-violet-700 underline ml-2"
                    >
                      (View Account 360)
                    </button>
                  )}
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1 font-medium">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Owner: <strong className="text-slate-700 dark:text-slate-300">{selectedOpportunity.owner_name || 'Sales AE'}</strong>
                  </span>
                  <span>•</span>
                  <span>Primary Product: <strong className="text-slate-700 dark:text-slate-300">{selectedOpportunity.product_name}</strong></span>
                  <span>•</span>
                  <span>Stage: <strong className="text-violet-600 dark:text-violet-400">{selectedOpportunity.stage_name || 'Open Pipeline'}</strong></span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setIsEditingCommercials(true)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Commercials
                </button>

                <button
                  onClick={() => {
                    setShowTransitionModal(true);
                    if (availableStages.length === 0) {
                      api.getPipelineStages().then(res => setAvailableStages(res.results || [])).catch(() => {});
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Advance Stage
                </button>

                {selectedOpportunity.status === 'OPEN' && (
                  <button
                    onClick={handleMarkWon}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5"
                  >
                    <Award className="w-3.5 h-3.5" />
                    Close Won Deal
                  </button>
                )}
              </div>
            </div>

            {/* Commercial Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/50">
                <span className="text-[11px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider block">
                  TOTAL CONTRACT VALUE
                </span>
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 block">
                  {Number(selectedOpportunity.total_contract_value).toLocaleString()} {selectedOpportunity.currency}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Term: {selectedOpportunity.contract_term_months} months
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  ARR (ANNUAL REVENUE)
                </span>
                <span className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 block">
                  {Number(selectedOpportunity.arr).toLocaleString()} {selectedOpportunity.currency}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  MRR: {Number(selectedOpportunity.mrr).toLocaleString()} {selectedOpportunity.currency}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  SEATS / UNITS
                </span>
                <span className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 block">
                  {selectedOpportunity.seat_units_count} Units
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Plan: {selectedOpportunity.pricing_plan || 'Standard'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  WIN PROBABILITY & CLOSE
                </span>
                <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                  {selectedOpportunity.probability_pct}%
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Close Date: {selectedOpportunity.expected_close_date || 'Unscheduled'}
                </span>
              </div>
            </div>

            {/* Next Action Priority Banner */}
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>NEXT COMMERCIAL ACTION:</strong>{' '}
                  {selectedOpportunity.next_action_description || 'No action scheduled'}
                </span>
              </div>
              <div className="text-amber-700 dark:text-amber-400 font-semibold shrink-0">
                Due: {selectedOpportunity.next_activity_due_at ? new Date(selectedOpportunity.next_activity_due_at).toLocaleDateString() : 'Pending'}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6 text-sm font-semibold">
            <button
              onClick={() => setActiveTab('OVERVIEW')}
              className={`pb-3 border-b-2 transition-colors ${
                activeTab === 'OVERVIEW'
                  ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Deal Context & Architecture
            </button>
            <button
              onClick={() => setActiveTab('ACTIVITIES')}
              className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'ACTIVITIES'
                  ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <ActivityIcon className="w-4 h-4" />
              Activities ({activities.length})
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'HISTORY'
                  ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <History className="w-4 h-4" />
              Stage History & Audit
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Carried Forward PLD & Technical Evaluation Details */}
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Carried-Forward Evaluation Context
                </h3>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">PLD Fit Score</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedOpportunity.pld_score || '85.0'} / 100
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">SQL Handoff Accepted Date</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedOpportunity.sql_date || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">Economic Decision Maker</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedOpportunity.decision_maker || 'Confirmed during Discovery'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">Primary ERP System</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedOpportunity.erp_system || 'SAP S/4HANA'}
                    </span>
                  </div>
                  <div className="py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block mb-1">POC / Trial Outcome:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {selectedOpportunity.poc_result || 'Completed verification benchmarks on file'}
                    </span>
                  </div>
                  <div className="py-2">
                    <span className="text-slate-400 block mb-1">Implementation Scope:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {selectedOpportunity.implementation_scope || 'Standard multi-branch rollout'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Product Modules & Capabilities Relationships (Section 17) */}
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  Product Modules & Scope Committed
                </h3>

                <div className="space-y-3">
                  {selectedOpportunity.selected_modules && selectedOpportunity.selected_modules.length > 0 ? (
                    selectedOpportunity.selected_modules.map((m) => (
                      <div
                        key={m.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100 block">
                            {m.module_name}
                          </span>
                          <span className="text-[11px] text-slate-400">{m.notes || m.module_code}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Included
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500">
                      Primary Core Module auto-assigned from VanForces suite.
                    </div>
                  )}

                  {selectedOpportunity.required_capabilities && selectedOpportunity.required_capabilities.length > 0 && (
                    <div className="pt-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        Mapped Capabilities
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {selectedOpportunity.required_capabilities.map((c) => (
                          <span
                            key={c.id}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900 text-xs font-medium"
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
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Opportunity Activity Stream
                </h3>
                <button
                  onClick={() => setShowActivityModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Log Commercial Activity
                </button>
              </div>

              {activities.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No commercial activities recorded yet for this opportunity.
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.map((act) => (
                    <div
                      key={act.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          [{act.activity_type}] {act.subject}
                        </span>
                        <span className="text-slate-400">
                          {new Date(act.conducted_at).toLocaleDateString()}
                        </span>
                      </div>
                      {act.outcome_notes && (
                        <p className="text-slate-600 dark:text-slate-300">{act.outcome_notes}</p>
                      )}
                      {act.next_action_description && (
                        <div className="pt-2 text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          Next Action: {act.next_action_description} (Due:{' '}
                          {act.next_action_due_at ? new Date(act.next_action_due_at).toLocaleDateString() : 'Pending'})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STAGE HISTORY & AUDIT */}
          {activeTab === 'HISTORY' && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Immutable Stage Progression History
              </h3>

              {stageHistories.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No stage transition history on record.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {stageHistories.map((h, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {h.from_stage || 'Initiated'} → {h.to_stage}
                        </span>
                        <p className="text-slate-500 mt-0.5">{h.transition_reason}</p>
                      </div>
                      <div className="text-right text-slate-400">
                        <span>{new Date(h.changed_at).toLocaleString()}</span>
                        <span className="block text-[11px] text-slate-500">By: {h.changed_by}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-sm">
          No commercial opportunities found. Complete and accept an SQL Handoff to initialize an Opportunity.
        </div>
      )}

      {/* Edit Commercials Modal */}
      {isEditingCommercials && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Edit Commercial Contract Values
              </h3>
              <button onClick={() => setIsEditingCommercials(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
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
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ARR</label>
                  <input
                    type="number"
                    value={editArr}
                    onChange={(e) => setEditArr(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">MRR</label>
                  <input
                    type="number"
                    value={editMrr}
                    onChange={(e) => setEditMrr(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Seats / Units</label>
                  <input
                    type="number"
                    value={editSeats}
                    onChange={(e) => setEditSeats(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Win Probability (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editProb}
                    onChange={(e) => setEditProb(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Pricing Plan Name</label>
                <input
                  type="text"
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value)}
                  placeholder="e.g. Enterprise Annual Subscription"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Expected Close Date</label>
                <input
                  type="date"
                  value={editCloseDate}
                  onChange={(e) => setEditCloseDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsEditingCommercials(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCommercials}
                disabled={savingCommercials}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 transition-colors shadow-lg shadow-violet-600/20"
              >
                {savingCommercials ? 'Saving Changes...' : 'Save & Log Audit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Activity Modal */}
      {showActivityModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Log Commercial Activity
              </h3>
              <button onClick={() => setShowActivityModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Activity Type</label>
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                >
                  <option value="MEETING">Meeting / Executive Review</option>
                  <option value="CALL">Phone Call</option>
                  <option value="EMAIL">Email Follow-up</option>
                  <option value="WHATSAPP">WhatsApp Commercial Message</option>
                  <option value="SITE_VISIT">Site Visit / Facility Inspection</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Subject *</label>
                <input
                  type="text"
                  value={activitySubject}
                  onChange={(e) => setActivitySubject(e.target.value)}
                  placeholder="e.g. Commercial Scope & Terms Finalization"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Outcome Notes</label>
                <textarea
                  rows={2}
                  value={activityOutcome}
                  onChange={(e) => setActivityOutcome(e.target.value)}
                  placeholder="e.g. Client agreed to 45 units in Phase 1 deployment."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Mandatory Next Action *</label>
                <input
                  type="text"
                  value={nextActionDesc}
                  onChange={(e) => setNextActionDesc(e.target.value)}
                  placeholder="e.g. Issue revised commercial contract and payment schedule"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Next Action Due Date *</label>
                <input
                  type="date"
                  value={nextActionDue}
                  onChange={(e) => setNextActionDue(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowActivityModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleLogActivity}
                disabled={loggingActivity}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 transition-colors shadow-lg shadow-violet-600/20"
              >
                {loggingActivity ? 'Saving Activity...' : 'Log Activity & Action'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage Transition Modal */}
      {showTransitionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-600" />
                Transition Opportunity Stage
              </h3>
              <button
                onClick={() => setShowTransitionModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Target Pipeline Stage *</label>
                <select
                  value={targetStageId}
                  onChange={(e) => setTargetStageId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
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
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Transition Reason (Mandatory for backward movement)
                </label>
                <textarea
                  rows={3}
                  value={transitionReason}
                  onChange={(e) => setTransitionReason(e.target.value)}
                  placeholder="Detail rationale for advancing or returning stage..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowTransitionModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleTransitionStage}
                disabled={transitioning || !targetStageId}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 transition-colors shadow-lg shadow-violet-600/20"
              >
                {transitioning ? 'Transitioning...' : 'Confirm Stage Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
