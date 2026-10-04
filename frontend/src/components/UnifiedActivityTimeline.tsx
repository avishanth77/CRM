import React, { useState, useEffect } from 'react';
import { 
  Phone, Mail, MessageSquare, Users, Compass, Monitor, 
  FlaskConical, Clock, AlertTriangle, Plus, 
  Calendar, X, 
  Send, FileText, RefreshCw, AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import type { Activity, ActivityType, ActivityStatus } from '../services/api';

export interface UnifiedActivityTimelineProps {
  entityType?: 'lead' | 'opportunity' | 'account' | 'proposal';
  entityId?: string;
  entityName?: string;
  relatedEntity?: {
    type: 'lead' | 'opportunity' | 'account' | 'proposal' | string;
    id: string;
    name?: string;
    accountId?: string;
  };
  onActivityLogged?: () => void;
}

export const UnifiedActivityTimeline: React.FC<UnifiedActivityTimelineProps> = ({
  entityType,
  entityId,
  entityName,
  relatedEntity,
  onActivityLogged
}) => {
  const actualEntityType = (entityType || relatedEntity?.type || 'lead') as 'lead' | 'opportunity' | 'account' | 'proposal';
  const actualEntityId = entityId || relatedEntity?.id || '';
  const actualEntityName = entityName || relatedEntity?.name;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // New Activity Form State
  const [subject, setSubject] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>('CALL');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [descriptionNotes, setDescriptionNotes] = useState('');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [activityStatus, setActivityStatus] = useState<ActivityStatus>('COMPLETED');
  
  // Mandatory Next Action Form State
  const [hasNextAction, setHasNextAction] = useState<boolean>(true);
  const [nextActionDesc, setNextActionDesc] = useState('');
  const [nextActionDue, setNextActionDue] = useState('');
  const [createTaskFlag, setCreateTaskFlag] = useState<boolean>(true);

  useEffect(() => {
    if (actualEntityId) {
      loadActivities();
    }
  }, [actualEntityId, actualEntityType]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { [actualEntityType]: actualEntityId };
      const res = await api.getActivities(params);
      setActivities(res.results || []);
    } catch (err) {
      console.error("Failed to load activities", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;

    setSubmitting(true);
    try {
      const payload: Partial<Activity> = {
        subject: subject.trim(),
        activity_type: activityType,
        duration_minutes: durationMinutes,
        description_notes: descriptionNotes,
        outcome_notes: outcomeNotes,
        status: activityStatus,
        next_action_description: hasNextAction ? nextActionDesc : undefined,
        next_action_due_at: hasNextAction && nextActionDue ? new Date(nextActionDue).toISOString() : undefined,
        [actualEntityType]: actualEntityId
      };
      if (relatedEntity?.accountId && !payload.account) {
        payload.account = relatedEntity.accountId;
      }

      await api.createActivity(payload);
      setShowLogModal(false);
      resetForm();
      await loadActivities();
      if (onActivityLogged) onActivityLogged();
    } catch (err: any) {
      alert(err.message || "Failed to log activity");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubject('');
    setActivityType('CALL');
    setDurationMinutes(30);
    setDescriptionNotes('');
    setOutcomeNotes('');
    setActivityStatus('COMPLETED');
    setNextActionDesc('');
    setNextActionDue('');
    setHasNextAction(true);
    setCreateTaskFlag(true);
  };

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'CALL': return <Phone size={15} color="#3B82F6" />;
      case 'EMAIL': return <Mail size={15} color="#06B6D4" />;
      case 'WHATSAPP': return <MessageSquare size={15} color="#10B981" />;
      case 'MEETING': return <Users size={15} color="#8B5CF6" />;
      case 'DISCOVERY': return <Compass size={15} color="#EC4899" />;
      case 'DEMO': return <Monitor size={15} color="#F59E0B" />;
      case 'POC': return <FlaskConical size={15} color="#6366F1" />;
      case 'PROPOSAL_SENT': return <Send size={15} color="#10B981" />;
      case 'PROPOSAL_REVIEW': return <FileText size={15} color="#3B82F6" />;
      case 'NEGOTIATION': return <Users size={15} color="#F59E0B" />;
      default: return <Clock size={15} color="var(--text-muted)" />;
    }
  };

  const renderNextActionBadge = (act: Activity) => {
    const status = act.next_action_status || 'NO_NEXT_ACTION';
    if (!act.next_action_due_at && !act.next_action_description) {
      return (
        <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem' }}>
          <AlertTriangle size={11} /> No Next Action
        </span>
      );
    }

    if (status === 'OVERDUE') {
      return (
        <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem' }}>
          <AlertCircle size={11} /> Overdue: {act.next_action_description}
        </span>
      );
    }
    if (status === 'DUE_TODAY') {
      return (
        <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem' }}>
          <Clock size={11} /> Due Today: {act.next_action_description}
        </span>
      );
    }
    if (status === 'DUE_SOON') {
      return (
        <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem' }}>
          <Clock size={11} /> Due Soon: {act.next_action_description}
        </span>
      );
    }

    return (
      <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem' }}>
        <Calendar size={11} /> Scheduled: {act.next_action_description}
      </span>
    );
  };

  // Filter activities
  const filteredActivities = activities.filter(act => {
    if (selectedTypeFilter !== 'ALL' && act.activity_type !== selectedTypeFilter) return false;
    if (selectedStatusFilter !== 'ALL' && act.status !== selectedStatusFilter) return false;
    return true;
  });

  return (
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="var(--primary)" />
            Unified Activity Timeline {actualEntityName ? `• ${actualEntityName}` : ''}
            <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>{filteredActivities.length}</span>
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>
            Complete audit of communications, meetings, demonstrations, outcomes, and mandatory next actions.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Activity Type Filter */}
          <select
            className="input-field"
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            style={{ fontSize: '0.78rem', padding: '6px 10px' }}
          >
            <option value="ALL">All Activity Types</option>
            <option value="CALL">Phone Calls</option>
            <option value="EMAIL">Emails</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="MEETING">Meetings</option>
            <option value="DISCOVERY">Discovery Sessions</option>
            <option value="DEMO">Product Demos</option>
            <option value="POC">POC Trials</option>
            <option value="PROPOSAL_SENT">Proposal Sent</option>
            <option value="NEGOTIATION">Negotiations</option>
            <option value="FOLLOW_UP">Follow-ups</option>
          </select>

          {/* Status Filter */}
          <select
            className="input-field"
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            style={{ fontSize: '0.78rem', padding: '6px 10px' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PLANNED">Planned</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <button
            className="btn btn-primary"
            onClick={() => setShowLogModal(true)}
            style={{ fontSize: '0.82rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={15} /> Log Activity
          </button>
        </div>
      </div>

      {/* Timeline Stream */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
          <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
          Loading activity stream...
        </div>
      ) : filteredActivities.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          background: 'var(--bg-surface)',
          borderRadius: '10px',
          border: '1px dashed var(--border-subtle)',
          color: 'var(--text-muted)'
        }}>
          <Clock size={28} style={{ opacity: 0.4, margin: '0 auto 10px' }} />
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>No activities logged yet</div>
          <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
            Document your initial customer interactions, calls, or schedule a future meeting.
          </div>
          <button 
            className="btn btn-outline"
            onClick={() => setShowLogModal(true)}
            style={{ marginTop: '14px', fontSize: '0.8rem', padding: '6px 14px' }}
          >
            <Plus size={14} /> Log First Activity
          </button>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: '24px' }}>
          {/* Vertical Connecting Line */}
          <div style={{
            position: 'absolute',
            left: '11px',
            top: '8px',
            bottom: '16px',
            width: '2px',
            background: 'var(--border-subtle)'
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredActivities.map((act) => {
              const formattedDate = new Date(act.conducted_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div 
                  key={act.id} 
                  style={{
                    position: 'relative',
                    padding: '16px 18px',
                    borderRadius: '10px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Node icon dot */}
                  <div style={{
                    position: 'absolute',
                    left: '-29px',
                    top: '18px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'var(--bg-surface-elevated)',
                    border: '2px solid var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {getActivityIcon(act.activity_type)}
                  </div>

                  {/* Top Bar: Subject, Type, Status, Timestamp */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#FFFFFF' }}>{act.subject}</span>
                        <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                          {act.activity_type.replace('_', ' ')}
                        </span>
                        <span className={`badge ${act.status === 'COMPLETED' ? 'badge-success' : act.status === 'PLANNED' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.65rem' }}>
                          {act.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        Conducted by <strong style={{ color: 'var(--text-secondary)' }}>{act.performed_by_name || 'System / Unassigned'}</strong> • {formattedDate} • {act.duration_minutes || 30} mins
                      </div>
                    </div>

                    <div>
                      {renderNextActionBadge(act)}
                    </div>
                  </div>

                  {/* Description Notes */}
                  {act.description_notes && (
                    <div style={{ marginTop: '10px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                      {act.description_notes}
                    </div>
                  )}

                  {/* Outcome Notes Box */}
                  {act.outcome_notes && (
                    <div style={{
                      marginTop: '10px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'rgba(59, 130, 246, 0.06)',
                      borderLeft: '3px solid var(--primary)',
                      fontSize: '0.78rem'
                    }}>
                      <strong style={{ color: 'var(--primary)', marginRight: '6px' }}>Outcome:</strong>
                      <span style={{ color: 'var(--text-secondary)' }}>{act.outcome_notes}</span>
                    </div>
                  )}

                  {/* Next Action Scheduled Detail */}
                  {act.next_action_due_at && (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      <Calendar size={13} color="var(--primary)" />
                      <span>Next Action Due: <strong>{new Date(act.next_action_due_at).toLocaleDateString()}</strong> ({act.next_action_description})</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LOG ACTIVITY MODAL */}
      {showLogModal && (
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
            maxWidth: '640px',
            background: '#0B0F19',
            border: '1px solid var(--border-subtle)',
            borderRadius: '14px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF' }}>Log Customer Activity</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Record interaction outcome and schedule mandatory next action for {entityName || 'record'}.
                </p>
              </div>
              <button 
                onClick={() => setShowLogModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleLogActivity} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}>
                    Activity Subject *
                  </label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="e.g. Solution Demo with VP Supply Chain"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}>
                    Activity Type *
                  </label>
                  <select
                    className="input-field"
                    value={activityType}
                    onChange={(e) => setActivityType(e.target.value as ActivityType)}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  >
                    <option value="CALL">Phone Call</option>
                    <option value="EMAIL">Email</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="MEETING">Meeting</option>
                    <option value="DISCOVERY">Discovery Session</option>
                    <option value="DEMO">Product Demo</option>
                    <option value="POC">POC Check-in</option>
                    <option value="PROPOSAL_REVIEW">Proposal Review</option>
                    <option value="NEGOTIATION">Negotiation</option>
                    <option value="FOLLOW_UP">Follow-up</option>
                    <option value="SITE_VISIT">Site Visit</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}>
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min={5}
                    step={5}
                    className="input-field"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 30)}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}>
                    Status
                  </label>
                  <select
                    className="input-field"
                    value={activityStatus}
                    onChange={(e) => setActivityStatus(e.target.value as ActivityStatus)}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  >
                    <option value="COMPLETED">Completed</option>
                    <option value="PLANNED">Planned / Scheduled</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}>
                  Interaction Details / Discussion Notes
                </label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="Key topics discussed, stakeholder questions, operational findings..."
                  value={descriptionNotes}
                  onChange={(e) => setDescriptionNotes(e.target.value)}
                  style={{ width: '100%', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}>
                  Documented Outcome *
                </label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. Customer agreed to 30-day POC; procurement documents received"
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  style={{ width: '100%', fontSize: '0.85rem' }}
                />
              </div>

              {/* Mandatory Next Action Section */}
              <div style={{
                padding: '16px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={15} color="var(--primary)" />
                    Mandatory Next Action
                  </span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input 
                      type="checkbox"
                      checked={createTaskFlag}
                      onChange={(e) => setCreateTaskFlag(e.target.checked)}
                    />
                    Generate Actionable Task
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Next Action Description *
                    </label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      placeholder="e.g. Send revised commercial proposal v2"
                      value={nextActionDesc}
                      onChange={(e) => setNextActionDesc(e.target.value)}
                      style={{ width: '100%', fontSize: '0.82rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Due Date *
                    </label>
                    <input
                      type="date"
                      required
                      className="input-field"
                      value={nextActionDue}
                      onChange={(e) => setNextActionDue(e.target.value)}
                      style={{ width: '100%', fontSize: '0.82rem' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowLogModal(false)}
                  style={{ fontSize: '0.85rem', padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {submitting ? 'Saving...' : 'Save Activity & Next Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
