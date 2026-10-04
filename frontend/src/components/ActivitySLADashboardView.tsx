import React, { useState, useEffect } from 'react';
import { 
  Activity, Clock, AlertTriangle, CheckCircle2, ShieldAlert, 
  RefreshCw, Flame
} from 'lucide-react';
import { api } from '../services/api';
import type { ActivitySLAAnalyticsData } from '../services/api';
import { KPICard } from './analytics/KPICard';
import { DateRangeSelector } from './analytics/DateRangeSelector';
import { DrillDownModal } from './analytics/DrillDownModal';
import type { DrillDownRecord } from './analytics/DrillDownModal';

interface ActivitySLADashboardViewProps {
  onNavigateToTab?: (tab: string) => void;
}

export const ActivitySLADashboardView: React.FC<ActivitySLADashboardViewProps> = ({
  onNavigateToTab
}) => {
  const [data, setData] = useState<ActivitySLAAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<string>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Drill Down
  const [drillModalOpen, setDrillModalOpen] = useState(false);
  const [drillTitle, setDrillTitle] = useState('');
  const [drillRecords, setDrillRecords] = useState<DrillDownRecord[]>([]);

  useEffect(() => {
    loadActivitySLA();
  }, [dateRange, customStart, customEnd]);

  const loadActivitySLA = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (dateRange) params.date_range = dateRange;
      if (customStart) params.start_date = customStart;
      if (customEnd) params.end_date = customEnd;
      const res = await api.getActivitySLAAnalytics(params);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch activity and SLA analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenOverdueDrillDown = () => {
    if (!data?.sla.overdue_records) return;
    setDrillTitle('Overdue SLA Records');
    const records: DrillDownRecord[] = data.sla.overdue_records.map(r => ({
      id: r.id,
      title: `${r.entity_type.toUpperCase()}: ${r.entity_name}`,
      subtitle: `SLA Rule: ${r.rule_name} • Breached by: ${r.breached_by_hours} hrs`,
      badge: r.status,
      badgeType: 'danger',
      date: r.due_at ? new Date(r.due_at).toLocaleDateString() : undefined
    }));
    setDrillRecords(records);
    setDrillModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Filters */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        paddingBottom: '8px',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Activity Execution &amp; SLA Compliance
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Cadence activity logging, task SLA compliance, operational bottlenecks, and response velocity.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <DateRangeSelector
            selectedRange={dateRange}
            onRangeChange={setDateRange}
            customStartDate={customStart}
            customEndDate={customEnd}
            onCustomDateChange={(start, end) => {
              setCustomStart(start);
              setCustomEnd(end);
            }}
          />

          <button
            className="btn btn-secondary"
            onClick={loadActivitySLA}
            style={{ padding: '8px 12px' }}
            title="Refresh analytics"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '14px 18px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '10px',
          color: 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button className="btn btn-outline" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '0.75rem' }} onClick={loadActivitySLA}>
            Retry
          </button>
        </div>
      )}

      {/* Row 1: Activity & SLA KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '16px'
      }}>
        <KPICard
          title="Activities Today"
          value={data?.activities.today ?? 0}
          subtitle={`${data?.activities.this_week ?? 0} this week`}
          badge="Daily Output"
          badgeType="info"
          icon={<Activity size={18} />}
        />
        <KPICard
          title="Completed Tasks"
          value={data?.tasks.completed ?? 0}
          subtitle={`Overdue: ${data?.tasks.overdue ?? 0}`}
          badge="Tasks"
          badgeType={(data?.tasks.overdue ?? 0) > 0 ? 'warning' : 'success'}
          icon={<CheckCircle2 size={18} />}
        />
        <KPICard
          title="SLA Compliance"
          value={`${data?.sla.compliance_rate ?? 100}%`}
          subtitle={`${data?.sla.within_sla ?? 0} Met / ${data?.sla.breached ?? 0} Breached`}
          badge="SLA Gate"
          badgeType={(data?.sla.compliance_rate ?? 100) >= 90 ? 'success' : 'danger'}
          icon={<ShieldAlert size={18} />}
        />
        <KPICard
          title="Avg Response Time"
          value={`${data?.sla.average_response_time_hours ?? 0} hrs`}
          subtitle="First lead touch"
          badge="Response"
          badgeType="neutral"
          icon={<Clock size={18} />}
        />
        <KPICard
          title="Avg Acceptance"
          value={`${data?.sla.average_acceptance_time_hours ?? 0} hrs`}
          subtitle="SQL acceptance gate"
          badge="Velocity"
          badgeType="neutral"
          icon={<Clock size={18} />}
        />
        <KPICard
          title="No Next Action"
          value={data?.governance.no_next_action_records ?? 0}
          subtitle="Leads &amp; Opps stalled"
          badge="Governance"
          badgeType={(data?.governance.no_next_action_records ?? 0) > 0 ? 'warning' : 'success'}
          icon={<AlertTriangle size={18} />}
        />
      </div>

      {/* Row 2: Bottleneck Analysis Panel */}
      {data?.bottlenecks && (
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Flame size={20} color="var(--warning)" />
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Systemic Bottleneck Indicators
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Objective identification of drop-offs, stuck deals, and SLA breach clusters
              </p>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px'
          }}>
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Longest Dwell Stages
              </div>
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {data.bottlenecks.longest_duration_stages.map((st, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600 }}>{st.stage}</span>
                    <span style={{ color: 'var(--warning)', fontWeight: 700 }}>{st.avg_days} days avg</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                SLA Breaches &amp; Overdue
              </div>
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--danger)' }}>
                    {data.sla.breached}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Active breaches
                  </div>
                </div>
                {data.sla.breached > 0 && (
                  <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '6px 12px' }} onClick={handleOpenOverdueDrillDown}>
                    View Breaches
                  </button>
                )}
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Stuck Opportunities (&gt;14d)
              </div>
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--warning)' }}>
                    {data.bottlenecks.stuck_opportunities_count}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Without progress
                  </div>
                </div>
                {onNavigateToTab && (
                  <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '6px 12px' }} onClick={() => onNavigateToTab('work-queue')}>
                    Open Queue
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Row 3: Activities by Type & Activities by Owner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '20px'
      }}>
        {/* By Type */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Activities by Interaction Type
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Calls, meetings, emails, demos, and follow-ups
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(!data?.activities.by_type || data.activities.by_type.length === 0) ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                No activities logged.
              </div>
            ) : (
              data.activities.by_type.map((t, idx) => (
                <div key={idx} style={{ background: 'var(--bg-surface-elevated)', padding: '12px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{t.type}</span>
                  <span className="badge badge-info" style={{ fontWeight: 700 }}>{t.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* By Owner */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Activity Output by Team Member
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Customer engagements logged per representative
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(!data?.activities.by_owner || data.activities.by_owner.length === 0) ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                No owner activity recorded.
              </div>
            ) : (
              data.activities.by_owner.map((o, idx) => (
                <div key={idx} style={{ background: 'var(--bg-surface-elevated)', padding: '12px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{o.owner}</span>
                  <span className="badge badge-neutral" style={{ fontWeight: 700 }}>{o.count} logged</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Drill Down Modal */}
      <DrillDownModal
        isOpen={drillModalOpen}
        onClose={() => setDrillModalOpen(false)}
        title={drillTitle}
        records={drillRecords}
      />
    </div>
  );
};
