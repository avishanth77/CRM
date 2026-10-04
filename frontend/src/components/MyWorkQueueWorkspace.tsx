import React, { useState, useEffect } from 'react';
import { 
  Clock, AlertTriangle, AlertCircle, Calendar, 
  Check, Plus, RefreshCw, Settings, ShieldAlert,
  CheckCircle2, User, Users, Briefcase, X
} from 'lucide-react';
import { api } from '../services/api';
import type { WorkQueueData, AutomationRule, SLADefinition } from '../services/api';

interface MyWorkQueueWorkspaceProps {
  onNavigateToLead?: (leadId: string) => void;
  onNavigateToOpportunity?: (oppId: string) => void;
  onNavigateToProposal?: (propId: string) => void;
  onNavigateToAccount?: (accId: string) => void;
  onNavigateToSQL?: () => void;
}

export const MyWorkQueueWorkspace: React.FC<MyWorkQueueWorkspaceProps> = ({
  onNavigateToLead,
  onNavigateToOpportunity,
  onNavigateToProposal: _onNavigateToProposal,
  onNavigateToAccount: _onNavigateToAccount,
  onNavigateToSQL
}) => {
  const [queueData, setQueueData] = useState<WorkQueueData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [roleView, setRoleView] = useState<'SALES_EXECUTIVE' | 'MANAGER' | 'EXECUTIVE'>('SALES_EXECUTIVE');
  const [activeSection, setActiveSection] = useState<'TODAY' | 'OVERDUE' | 'AT_RISK' | 'NO_NEXT_ACTION' | 'UPCOMING'>('TODAY');
  const [runningAutomations, setRunningAutomations] = useState<boolean>(false);

  // Modals
  const [showCreateTaskModal, setShowCreateTaskModal] = useState<boolean>(false);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  
  // Reschedule Modal
  const [rescheduleTaskId, setRescheduleTaskId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleReason, setRescheduleReason] = useState<string>('');

  // Schedule Next Action Modal
  const [nextActionEntity, setNextActionEntity] = useState<{ type: string; id: string; name: string } | null>(null);
  const [nextActionTitle, setNextActionTitle] = useState<string>('');
  const [nextActionDate, setNextActionDate] = useState<string>('');
  const [nextActionType, setNextActionType] = useState<string>('CALL');

  // New Task Form State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [taskType, setTaskType] = useState('FOLLOW_UP');

  // Governance Config State
  const [slaDefinitions, setSlaDefinitions] = useState<SLADefinition[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);

  useEffect(() => {
    loadWorkQueue(roleView);
  }, [roleView]);

  const loadWorkQueue = async (role: 'SALES_EXECUTIVE' | 'MANAGER' | 'EXECUTIVE') => {
    setLoading(true);
    try {
      const data = await api.getWorkQueue(role);
      setQueueData(data);
    } catch (err) {
      console.error("Failed to load work queue", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await api.completeTask(taskId);
      await loadWorkQueue(roleView);
    } catch (err) {
      alert("Failed to complete task");
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTaskId || !rescheduleDate) return;
    try {
      await api.rescheduleWorkQueueTask(rescheduleTaskId, rescheduleDate, rescheduleReason);
      setRescheduleTaskId(null);
      setRescheduleDate('');
      setRescheduleReason('');
      await loadWorkQueue(roleView);
    } catch (err: any) {
      alert(err.message || 'Failed to reschedule task');
    }
  };

  const handleScheduleNextActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nextActionEntity || !nextActionTitle || !nextActionDate) return;
    try {
      await api.scheduleWorkQueueNextAction({
        entity_type: nextActionEntity.type.toUpperCase() as 'LEAD' | 'OPPORTUNITY',
        entity_id: nextActionEntity.id,
        description: nextActionTitle,
        due_date: nextActionDate,
        activity_type: nextActionType
      });
      setNextActionEntity(null);
      setNextActionTitle('');
      setNextActionDate('');
      await loadWorkQueue(roleView);
    } catch (err: any) {
      alert(err.message || 'Failed to schedule next action');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskDueDate) return;

    try {
      await api.createTask({
        title: taskTitle.trim(),
        description: taskDescription,
        due_date: new Date(taskDueDate).toISOString(),
        priority: taskPriority,
        task_type: taskType
      });
      setShowCreateTaskModal(false);
      setTaskTitle('');
      setTaskDescription('');
      setTaskDueDate('');
      await loadWorkQueue(roleView);
    } catch (err: any) {
      alert(err.message || "Failed to create task");
    }
  };

  const handleRunAutomations = async () => {
    setRunningAutomations(true);
    try {
      await api.runAutomations();
      await loadWorkQueue(roleView);
    } catch (err) {
      console.error(err);
    } finally {
      setRunningAutomations(false);
    }
  };

  const openConfigDrawer = async () => {
    setShowConfigModal(true);
    try {
      const [slaRes, autoRes] = await Promise.all([
        api.getSLADefinitions(),
        api.getAutomationRules()
      ]);
      setSlaDefinitions(slaRes.results || []);
      setAutomationRules(autoRes.results || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Section Counts
  const counts = queueData?.counts || {
    overdue: 0,
    due_today: 0,
    upcoming: 0,
    no_next_action: 0,
    sla_alerts: 0
  };

  const todayCount = (queueData?.today?.tasks?.length ?? counts.due_today) + (queueData?.today?.scheduled_activities?.length ?? 0) + (queueData?.today?.sql_acceptance?.length ?? 0);
  const overdueCount = (queueData?.overdue?.tasks?.length ?? counts.overdue) + (queueData?.overdue?.sla_breaches?.length ?? 0);
  const atRiskCount = (queueData?.at_risk?.slas_at_risk?.length ?? counts.sla_alerts) + (queueData?.at_risk?.inactive_opportunities?.length ?? 0);
  const noActionCount = (queueData?.no_next_action?.leads?.length ?? 0) + (queueData?.no_next_action?.opportunities?.length ?? 0) || counts.no_next_action;
  const upcomingCount = (queueData?.upcoming?.tasks?.length ?? counts.upcoming) + (queueData?.upcoming?.nurture_reengagement?.length ?? 0);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header & Role Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              Operational Work Queue
            </h1>
            <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
              Phase 10 Engine
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Action-oriented queue answering <em>"What should I work on today?"</em> with inline task execution.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Role Switcher */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-surface-elevated)',
            borderRadius: '8px',
            padding: '3px',
            border: '1px solid var(--border-subtle)'
          }}>
            <button
              onClick={() => setRoleView('SALES_EXECUTIVE')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: roleView === 'SALES_EXECUTIVE' ? 'var(--primary)' : 'transparent',
                color: roleView === 'SALES_EXECUTIVE' ? '#FFFFFF' : 'var(--text-secondary)'
              }}
            >
              <User size={13} />
              Sales Rep
            </button>
            <button
              onClick={() => setRoleView('MANAGER')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: roleView === 'MANAGER' ? 'var(--primary)' : 'transparent',
                color: roleView === 'MANAGER' ? '#FFFFFF' : 'var(--text-secondary)'
              }}
            >
              <Users size={13} />
              Manager
            </button>
            <button
              onClick={() => setRoleView('EXECUTIVE')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: roleView === 'EXECUTIVE' ? 'var(--primary)' : 'transparent',
                color: roleView === 'EXECUTIVE' ? '#FFFFFF' : 'var(--text-secondary)'
              }}
            >
              <Briefcase size={13} />
              Executive
            </button>
          </div>

          <button
            className="btn btn-outline"
            onClick={openConfigDrawer}
            style={{ fontSize: '0.82rem', padding: '8px 14px' }}
          >
            <Settings size={15} /> SLAs &amp; Rules
          </button>

          <button
            className="btn btn-outline"
            onClick={handleRunAutomations}
            disabled={runningAutomations}
            style={{ fontSize: '0.82rem', padding: '8px 14px' }}
            title="Evaluate background SLA thresholds & triggers"
          >
            <RefreshCw size={15} className={runningAutomations ? 'animate-spin' : ''} />
            {runningAutomations ? 'Evaluating...' : 'Run SLAs'}
          </button>

          <button
            className="btn btn-primary"
            onClick={() => setShowCreateTaskModal(true)}
            style={{ fontSize: '0.82rem', padding: '8px 16px' }}
          >
            <Plus size={16} /> New Task
          </button>
        </div>
      </div>

      {/* 5 Phase 10 Spec Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
        {/* SECTION 1: TODAY */}
        <div
          onClick={() => setActiveSection('TODAY')}
          className="glass-panel"
          style={{
            padding: '16px',
            cursor: 'pointer',
            border: activeSection === 'TODAY' ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
            background: activeSection === 'TODAY' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-surface)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.04em' }}>TODAY</span>
            <Clock size={16} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: '#FFFFFF' }}>
            {todayCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Due today &amp; SQLs
          </div>
        </div>

        {/* SECTION 2: OVERDUE */}
        <div
          onClick={() => setActiveSection('OVERDUE')}
          className="glass-panel"
          style={{
            padding: '16px',
            cursor: 'pointer',
            border: activeSection === 'OVERDUE' ? '2px solid var(--danger)' : '1px solid var(--border-subtle)',
            background: activeSection === 'OVERDUE' ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-surface)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--danger)', letterSpacing: '0.04em' }}>OVERDUE</span>
            <AlertCircle size={16} color="var(--danger)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: overdueCount > 0 ? 'var(--danger)' : '#FFFFFF' }}>
            {overdueCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Past deadline &amp; breaches
          </div>
        </div>

        {/* SECTION 3: AT RISK */}
        <div
          onClick={() => setActiveSection('AT_RISK')}
          className="glass-panel"
          style={{
            padding: '16px',
            cursor: 'pointer',
            border: activeSection === 'AT_RISK' ? '2px solid var(--warning)' : '1px solid var(--border-subtle)',
            background: activeSection === 'AT_RISK' ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-surface)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--warning)', letterSpacing: '0.04em' }}>AT RISK</span>
            <ShieldAlert size={16} color="var(--warning)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: atRiskCount > 0 ? 'var(--warning)' : '#FFFFFF' }}>
            {atRiskCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            SLA at risk &amp; inactive
          </div>
        </div>

        {/* SECTION 4: NO NEXT ACTION */}
        <div
          onClick={() => setActiveSection('NO_NEXT_ACTION')}
          className="glass-panel"
          style={{
            padding: '16px',
            cursor: 'pointer',
            border: activeSection === 'NO_NEXT_ACTION' ? '2px solid #EC4899' : '1px solid var(--border-subtle)',
            background: activeSection === 'NO_NEXT_ACTION' ? 'rgba(236, 72, 153, 0.08)' : 'var(--bg-surface)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#EC4899', letterSpacing: '0.04em' }}>NO ACTION</span>
            <AlertTriangle size={16} color="#EC4899" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: noActionCount > 0 ? '#EC4899' : '#FFFFFF' }}>
            {noActionCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Deals missing next step
          </div>
        </div>

        {/* SECTION 5: UPCOMING */}
        <div
          onClick={() => setActiveSection('UPCOMING')}
          className="glass-panel"
          style={{
            padding: '16px',
            cursor: 'pointer',
            border: activeSection === 'UPCOMING' ? '2px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
            background: activeSection === 'UPCOMING' ? 'rgba(139, 92, 246, 0.08)' : 'var(--bg-surface)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--accent-purple)', letterSpacing: '0.04em' }}>UPCOMING</span>
            <Calendar size={16} color="var(--accent-purple)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: '#FFFFFF' }}>
            {upcomingCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Future commitments
          </div>
        </div>
      </div>

      {/* Main Work Content Area */}
      {loading ? (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          Loading your operational queue items...
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '24px' }}>
          {/* SECTION 1: TODAY */}
          {activeSection === 'TODAY' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} color="var(--primary)" />
                  Today's Execution Focus ({todayCount})
                </h3>
              </div>

              {/* SQLs Awaiting Acceptance Gate */}
              {queueData?.today?.sql_acceptance && queueData.today.sql_acceptance.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase' }}>
                    SQLs Awaiting Sales Acceptance
                  </div>
                  {queueData.today.sql_acceptance.map((sql: any) => (
                    <div
                      key={sql.id}
                      style={{
                        padding: '14px 18px',
                        borderRadius: '8px',
                        background: 'rgba(245, 158, 11, 0.06)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                          {sql.account_name || 'Pending Lead'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Product: {sql.product_name} • Sales Owner: {sql.sales_owner || 'SDR'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {onNavigateToSQL && (
                          <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '6px 12px' }} onClick={onNavigateToSQL}>
                            Review SQL Gate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tasks Due Today */}
              {(!queueData?.today?.tasks || queueData.today.tasks.length === 0) && (!queueData?.due_today_tasks || queueData.due_today_tasks.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={32} color="var(--success)" style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>No Tasks Due Today</div>
                  <div style={{ fontSize: '0.78rem', marginTop: '2px' }}>All daily obligations are met.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(queueData?.today?.tasks || queueData?.due_today_tasks || []).map((t: any) => (
                    <div
                      key={t.id}
                      style={{
                        padding: '14px 18px',
                        borderRadius: '8px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                          onClick={() => handleCompleteTask(t.id)}
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '5px',
                            border: '2px solid var(--primary)',
                            background: 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'transparent'
                          }}
                          title="Complete Task"
                        >
                          <Check size={12} />
                        </button>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{t.title}</span>
                            <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{t.priority}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Due Today • {t.description || 'Routine follow-up'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          className="btn btn-outline"
                          style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                          onClick={() => { setRescheduleTaskId(t.id); setRescheduleDate(new Date().toISOString().split('T')[0]); }}
                        >
                          Reschedule
                        </button>
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                          onClick={() => handleCompleteTask(t.id)}
                        >
                          Complete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: OVERDUE */}
          {activeSection === 'OVERDUE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={18} color="var(--danger)" />
                  Overdue Operational Items ({overdueCount})
                </h3>
              </div>

              {/* SLA Breaches */}
              {queueData?.overdue?.sla_breaches && queueData.overdue.sla_breaches.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase' }}>
                    SLA Breaches
                  </div>
                  {queueData.overdue.sla_breaches.map((b: any) => (
                    <div
                      key={b.id}
                      style={{
                        padding: '14px 18px',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--danger)' }}>
                          {b.entity_type}: {b.entity_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Rule: {b.rule_name} • Breached by: {b.breached_by_hours} hours
                        </div>
                      </div>
                      <span className="badge badge-danger">Breached</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Overdue Tasks */}
              {(!queueData?.overdue?.tasks || queueData.overdue.tasks.length === 0) && (!queueData?.overdue_tasks || queueData.overdue_tasks.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={32} color="var(--success)" style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>No Overdue Tasks</div>
                  <div style={{ fontSize: '0.78rem', marginTop: '2px' }}>All assignments are on track.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(queueData?.overdue?.tasks || queueData?.overdue_tasks || []).map((t: any) => (
                    <div
                      key={t.id}
                      style={{
                        padding: '14px 18px',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.04)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--danger)' }}>{t.title}</span>
                          <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>{t.priority}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Due: {new Date(t.due_date).toLocaleDateString()} (Overdue) • {t.assigned_to_name || 'Assigned'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          className="btn btn-outline"
                          style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                          onClick={() => { setRescheduleTaskId(t.id); setRescheduleDate(new Date().toISOString().split('T')[0]); }}
                        >
                          Reschedule
                        </button>
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                          onClick={() => handleCompleteTask(t.id)}
                        >
                          Complete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: AT RISK */}
          {activeSection === 'AT_RISK' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={18} color="var(--warning)" />
                  At-Risk Deals &amp; SLA Warnings ({atRiskCount})
                </h3>
              </div>

              {/* Inactive Opportunities */}
              {queueData?.at_risk?.inactive_opportunities && queueData.at_risk.inactive_opportunities.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase' }}>
                    Inactive Opportunities (&gt;14d Without Logged Action)
                  </div>
                  {queueData.at_risk.inactive_opportunities.map((opp: any) => (
                    <div
                      key={opp.id}
                      style={{
                        padding: '14px 18px',
                        borderRadius: '8px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {opp.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Stage: {opp.stage} • Value: ${Number(opp.value || 0).toLocaleString()} • Inactive: <strong style={{ color: 'var(--danger)' }}>{opp.days_inactive} days</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        {onNavigateToOpportunity && (
                          <button
                            className="btn btn-outline"
                            style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                            onClick={() => onNavigateToOpportunity(opp.id)}
                          >
                            Open Deal
                          </button>
                        )}
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                          onClick={() => {
                            setNextActionEntity({ type: 'opportunity', id: opp.id, name: opp.name });
                            setNextActionTitle('Re-engage account executive');
                            setNextActionDate(new Date().toISOString().split('T')[0]);
                          }}
                        >
                          Plan Next Action
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* SLA Alerts */}
              {(queueData?.slas_at_risk || queueData?.at_risk?.slas_at_risk || []).map((sla: any) => (
                <div
                  key={sla.id}
                  style={{
                    padding: '14px 18px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {sla.entity_name} ({sla.entity_type})
                    </span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {sla.rule_name} • Due in: {sla.hours_remaining ?? 0} hrs
                    </div>
                  </div>
                  <span className="badge badge-warning">At Risk</span>
                </div>
              ))}
            </div>
          )}

          {/* SECTION 4: NO NEXT ACTION */}
          {activeSection === 'NO_NEXT_ACTION' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#EC4899', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} color="#EC4899" />
                  Records Without Next Actions ({noActionCount})
                </h3>
              </div>

              {/* Active Leads without next actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Active Leads Needing Next Scheduled Step
                </div>
                {(queueData?.no_next_action?.leads || queueData?.leads_missing_next_action || []).length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '16px' }}>
                    All active leads have scheduled next actions.
                  </div>
                ) : (
                  (queueData?.no_next_action?.leads || queueData?.leads_missing_next_action || []).map((l: any) => (
                    <div
                      key={l.id}
                      style={{
                        padding: '14px 18px',
                        borderRadius: '8px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {l.company_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Status: {l.qualification_status || l.status} • PLD Score: {l.pld_score ?? 0}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        {onNavigateToLead && (
                          <button
                            className="btn btn-outline"
                            style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                            onClick={() => onNavigateToLead(l.id)}
                          >
                            Open Lead
                          </button>
                        )}
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                          onClick={() => {
                            setNextActionEntity({ type: 'lead', id: l.id, name: l.company_name });
                            setNextActionTitle('Schedule follow-up call');
                            setNextActionDate(new Date().toISOString().split('T')[0]);
                          }}
                        >
                          Schedule Next Action
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* SECTION 5: UPCOMING */}
          {activeSection === 'UPCOMING' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} color="var(--accent-purple)" />
                  Upcoming Commitments &amp; Nurture Re-engagement ({upcomingCount})
                </h3>
              </div>

              {/* Upcoming Tasks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(queueData?.upcoming?.tasks || queueData?.upcoming_tasks || []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No upcoming tasks scheduled for the next 7 days.
                  </div>
                ) : (
                  (queueData?.upcoming?.tasks || queueData?.upcoming_tasks || []).map((t: any) => (
                    <div
                      key={t.id}
                      style={{
                        padding: '14px 18px',
                        borderRadius: '8px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {t.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Due: {new Date(t.due_date).toLocaleDateString()} • Priority: {t.priority}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-outline"
                          style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                          onClick={() => { setRescheduleTaskId(t.id); setRescheduleDate(new Date(t.due_date).toISOString().split('T')[0]); }}
                        >
                          Reschedule
                        </button>
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                          onClick={() => handleCompleteTask(t.id)}
                        >
                          Complete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reschedule Task Modal */}
      {rescheduleTaskId && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Reschedule Task</h3>
              <button onClick={() => setRescheduleTaskId(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRescheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  New Due Date &amp; Time
                </label>
                <input
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Reason for Rescheduling
                </label>
                <input
                  type="text"
                  placeholder="e.g., Prospect rescheduled meeting"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRescheduleTaskId(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Next Action Modal */}
      {nextActionEntity && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Schedule Next Action</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  For: {nextActionEntity.name}
                </p>
              </div>
              <button onClick={() => setNextActionEntity(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleScheduleNextActionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Next Action Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Conduct second discovery call with CTO"
                  value={nextActionTitle}
                  onChange={(e) => setNextActionTitle(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Due Date
                </label>
                <input
                  type="date"
                  required
                  value={nextActionDate}
                  onChange={(e) => setNextActionDate(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Interaction Type
                </label>
                <select
                  value={nextActionType}
                  onChange={(e) => setNextActionType(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="CALL">Call</option>
                  <option value="MEETING">Meeting</option>
                  <option value="EMAIL">Email</option>
                  <option value="DEMO">Demo</option>
                  <option value="FOLLOW_UP">Follow-Up</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setNextActionEntity(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Schedule Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateTaskModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '520px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '14px',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF' }}>Create Operational Task</h3>
              <button 
                onClick={() => setShowCreateTaskModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Review commercial proposal terms with Legal"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Due Date &amp; Time</label>
                <input
                  type="datetime-local"
                  required
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e: any) => setTaskPriority(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Task Type</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="FOLLOW_UP">Follow Up</option>
                    <option value="PROPOSAL_REVIEW">Proposal Review</option>
                    <option value="SQL_ACCEPTANCE">SQL Acceptance</option>
                    <option value="DISCOVERY_CALL">Discovery Call</option>
                    <option value="DEMO_PREP">Demo Preparation</option>
                    <option value="POC_CHECKIN">POC Check-in</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Description / Context</label>
                <textarea
                  rows={3}
                  placeholder="Include context or specific requirements..."
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    resize: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateTaskModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SLA & Governance Config Modal */}
      {showConfigModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '840px',
            background: '#0B0F19',
            border: '1px solid var(--border-subtle)',
            borderRadius: '14px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>SLA &amp; Automation Governance Engine</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Configurable response targets, escalation ladders, and automated event triggers.
                </p>
              </div>
              <button 
                onClick={() => setShowConfigModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* SLA Definitions Table */}
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '10px' }}>
                Configured Service Level Agreements (SLAs)
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>SLA Name</th>
                      <th style={{ padding: '8px' }}>Target Duration</th>
                      <th style={{ padding: '8px' }}>Warning %</th>
                      <th style={{ padding: '8px' }}>Escalation Role</th>
                      <th style={{ padding: '8px' }}>Action</th>
                      <th style={{ padding: '8px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slaDefinitions.map(def => (
                      <tr key={def.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 700, color: '#FFFFFF' }}>{def.name}</td>
                        <td style={{ padding: '10px 8px' }}>{def.target_duration_hours}h</td>
                        <td style={{ padding: '10px 8px' }}>{def.warning_threshold_pct}%</td>
                        <td style={{ padding: '10px 8px' }}>{def.escalation_role}</td>
                        <td style={{ padding: '10px 8px' }}>{def.escalation_action}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <span className={`badge ${def.is_active ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.65rem' }}>
                            {def.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Automation Rules Table */}
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-purple)', marginBottom: '10px' }}>
                Configured Automation Triggers &amp; Actions
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Rule Name</th>
                      <th style={{ padding: '8px' }}>Trigger Event</th>
                      <th style={{ padding: '8px' }}>Action Type</th>
                      <th style={{ padding: '8px' }}>Executions</th>
                      <th style={{ padding: '8px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {automationRules.map(rule => (
                      <tr key={rule.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 700, color: '#FFFFFF' }}>{rule.name}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--primary)' }}>{rule.trigger_type}</td>
                        <td style={{ padding: '10px 8px' }}>{rule.action_type}</td>
                        <td style={{ padding: '10px 8px' }}>{rule.execution_count} runs</td>
                        <td style={{ padding: '10px 8px' }}>
                          <span className={`badge ${rule.is_active ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.65rem' }}>
                            {rule.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={() => setShowConfigModal(false)}
                style={{ fontSize: '0.85rem', padding: '8px 20px' }}
              >
                Close Governance Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
