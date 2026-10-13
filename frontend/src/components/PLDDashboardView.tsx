import React, { useState, useEffect } from 'react';
import { 
  Award, CheckCircle2, XCircle, AlertTriangle, Clock, 
  ArrowRight, Users, Sparkles, RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import type { PLDAnalyticsData, Product } from '../services/api';
import { KPICard } from './analytics/KPICard';
import { DateRangeSelector } from './analytics/DateRangeSelector';
import { DrillDownModal } from './analytics/DrillDownModal';
import type { DrillDownRecord } from './analytics/DrillDownModal';

interface PLDDashboardViewProps {
  products: Product[];
  onNavigateToLead?: (leadId: string) => void;
}

export const PLDDashboardView: React.FC<PLDDashboardViewProps> = ({
  products,
  onNavigateToLead
}) => {
  const [data, setData] = useState<PLDAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<string>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');

  // Drill Down
  const [drillModalOpen, setDrillModalOpen] = useState(false);
  const [drillTitle, setDrillTitle] = useState('');
  const [drillRecords, setDrillRecords] = useState<DrillDownRecord[]>([]);

  useEffect(() => {
    loadPLDAnalytics();
  }, [dateRange, customStart, customEnd, selectedProduct]);

  const loadPLDAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (dateRange) params.date_range = dateRange;
      if (customStart) params.start_date = customStart;
      if (customEnd) params.end_date = customEnd;
      if (selectedProduct) params.product = selectedProduct;
      const res = await api.getPLDAnalytics(params);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch PLD analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDrillDown = async (type: string, title: string) => {
    setDrillTitle(title);
    setDrillModalOpen(true);
    try {
      const leadRes = await api.getLeads();
      let filtered = leadRes.results || [];

      if (type === 'no_problems') {
        filtered = filtered.filter((l: any) => !l.problems || l.problems.length === 0);
      } else if (type === 'no_actions') {
        filtered = filtered.filter((l: any) => !l.next_action_due);
      } else if (type === 'nurture') {
        filtered = filtered.filter((l: any) => l.qualification_status === 'NURTURE');
      } else if (type === 'disqualified') {
        filtered = filtered.filter((l: any) => l.qualification_status === 'DISQUALIFIED');
      } else if (type === 'high_score') {
        filtered = filtered.filter((l: any) => (l.pld_score ?? 0) >= 70);
      }

      const records: DrillDownRecord[] = filtered.map((l: any) => ({
        id: l.id,
        title: l.company_name,
        subtitle: `Product: ${l.product_name || 'N/A'} • Contact: ${l.primary_contact_name || 'N/A'}`,
        status: l.qualification_status,
        badge: `PLD: ${l.pld_score ?? 0}`,
        badgeType: (l.pld_score >= 60) ? 'success' : (l.pld_score >= 30 ? 'warning' : 'neutral'),
        entityType: 'lead',
        entityId: l.id
      }));
      setDrillRecords(records);
    } catch {
      // ignore
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header & Filter Controls */}
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
            PLD Qualification Analytics
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Objective assessment qualification accuracy, ICP fit pass rates, score distributions, and problem discovery governance.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>PRODUCT:</span>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              style={{
                background: 'var(--bg-surface-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '7px 12px',
                fontSize: '0.82rem',
                fontWeight: 600
              }}
            >
              <option value="">All Products</option>
              {products.map(p => (
                <option key={p.id} value={p.code}>{p.name}</option>
              ))}
            </select>
          </div>

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
            onClick={loadPLDAnalytics}
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
          <button className="btn btn-outline" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '0.75rem' }} onClick={loadPLDAnalytics}>
            Retry
          </button>
        </div>
      )}

      {/* Row 1: Core PLD KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '16px'
      }}>
        <KPICard
          title="Lead Volume"
          value={data?.kpis?.total_leads ?? 0}
          subtitle="Total intake records"
          badge="Volume"
          badgeType="info"
          icon={<Users size={18} />}
          onClick={() => handleOpenDrillDown('all', 'All Leads')}
        />
        <KPICard
          title="ICP Pass Rate"
          value={`${data?.kpis?.icp_pass_rate ?? 0}%`}
          subtitle={`${data?.kpis?.icp_pass_count ?? 0} Passed / ${data?.kpis?.icp_fail_count ?? 0} Failed`}
          badge="ICP Gate"
          badgeType={(data?.kpis?.icp_pass_rate ?? 0) >= 50 ? 'success' : 'warning'}
          icon={<CheckCircle2 size={18} />}
        />
        <KPICard
          title="PLD Qual Rate"
          value={`${data?.kpis?.qualification_rate ?? 0}%`}
          subtitle={`${data?.kpis?.qualified_count ?? 0} Qualified leads`}
          badge="PLD Gate"
          badgeType="success"
          icon={<Award size={18} />}
        />
        <KPICard
          title="Avg PLD Score"
          value={data?.kpis?.average_pld_score ?? 0}
          subtitle="Out of 100 points"
          badge="Scoring"
          badgeType={(data?.kpis?.average_pld_score ?? 0) >= 60 ? 'success' : 'neutral'}
          icon={<Sparkles size={18} />}
        />
        <KPICard
          title="Nurture Volume"
          value={data?.kpis?.nurture_count ?? 0}
          subtitle="In re-engagement cadence"
          badge="Nurture"
          badgeType="warning"
          icon={<Clock size={18} />}
          onClick={() => handleOpenDrillDown('nurture', 'Nurture Leads')}
        />
        <KPICard
          title="Disqualified"
          value={data?.kpis?.disqualified_count ?? 0}
          subtitle="Unqualified / Bad Fit"
          badge="Disqualified"
          badgeType="danger"
          icon={<XCircle size={18} />}
          onClick={() => handleOpenDrillDown('disqualified', 'Disqualified Leads')}
        />
      </div>

      {/* Row 2: Governance & Data Quality Alerts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '16px'
      }}>
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '10px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--danger)'
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                Leads Without Business Problems
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Violation of Problem-Led Discovery governance
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--danger)' }}>
              {data?.alerts?.leads_without_problems ?? (data as any)?.quality_alerts?.leads_without_problems ?? 0}
            </span>
            <button
              className="btn btn-outline"
              style={{ fontSize: '0.75rem', padding: '5px 10px' }}
              onClick={() => handleOpenDrillDown('no_problems', 'Leads Without Business Problems')}
            >
              Inspect
            </button>
          </div>
        </div>

        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: '10px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--warning)'
            }}>
              <Clock size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                Leads Without Next Actions
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Active leads stalled with no scheduled follow-up
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--warning)' }}>
              {data?.alerts?.leads_without_next_action ?? (data as any)?.quality_alerts?.leads_without_next_action ?? 0}
            </span>
            <button
              className="btn btn-outline"
              style={{ fontSize: '0.75rem', padding: '5px 10px' }}
              onClick={() => handleOpenDrillDown('no_actions', 'Leads Without Next Actions')}
            >
              Inspect
            </button>
          </div>
        </div>
      </div>

      {/* Row 3: Score Distribution & Stage Breakdown */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '20px'
      }}>
        {/* Score Distribution */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              PLD Score Distribution
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Breakdown of lead qualification tiers across scoring ranges
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(Array.isArray(data?.score_distribution)
              ? data.score_distribution
              : (data?.score_distribution && typeof data.score_distribution === 'object')
                ? [
                    { range: '0-30', label: 'Nurture Band', count: (data.score_distribution as any).nurture_band_0_30 ?? 0 },
                    { range: '31-60', label: 'Development Band', count: (data.score_distribution as any).development_band_31_60 ?? 0 },
                    { range: '61-80', label: 'Qualified Band', count: (data.score_distribution as any).qualified_band_61_80 ?? 0 },
                    { range: '81-100', label: 'High Priority Band', count: (data.score_distribution as any).high_priority_band_81_100 ?? 0 },
                  ]
                : []
            ).map((tier, idx) => {
              const total = data?.kpis?.total_leads || 1;
              const pct = Math.round((tier.count / total) * 100);
              return (
                <div key={idx} style={{ background: 'var(--bg-surface-elevated)', padding: '12px 14px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {tier.range}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                        {tier.label}
                      </span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {tier.count} <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({pct}%)</span>
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--bg-surface)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: tier.range === '81-100'
                        ? 'linear-gradient(90deg, #10B981 0%, #34D399 100%)'
                        : tier.range === '61-80'
                        ? 'linear-gradient(90deg, #3B82F6 0%, #60A5FA 100%)'
                        : tier.range === '31-60'
                        ? 'linear-gradient(90deg, #F59E0B 0%, #FBBF24 100%)'
                        : 'linear-gradient(90deg, #6B7280 0%, #9CA3AF 100%)',
                      borderRadius: '3px'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stage Distribution & Velocity */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              PLD Stages &amp; Dwell Velocity
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Current lead volume and average days in each qualification stage
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(!data?.stage_distribution || data.stage_distribution.length === 0) ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                No stage data available.
              </div>
            ) : (
              (data?.stage_distribution || []).map((st, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      {st.stage}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Avg dwell: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{st.avg_days_in_stage} days</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-info" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                      {st.count} Leads
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Row 4: High-Scoring Priority Leads Table */}
      <div className="glass-panel" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              High-Scoring Priority Leads (Score ≥ 70)
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Highest intent accounts ready for immediate Sales qualification handoff
            </p>
          </div>
          <span className="badge badge-success">
            {data?.high_score_leads?.length ?? 0} High Priority
          </span>
        </div>

        {(!data?.high_score_leads || data.high_score_leads.length === 0) ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
            No leads currently have PLD score ≥ 70.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 14px' }}>COMPANY</th>
                  <th style={{ padding: '10px 14px' }}>PRODUCT</th>
                  <th style={{ padding: '10px 14px' }}>STAGE</th>
                  <th style={{ padding: '10px 14px' }}>PLD SCORE</th>
                  <th style={{ padding: '10px 14px' }}>PROBLEMS IDENTIFIED</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {(data?.high_score_leads || []).map((lead) => (
                  <tr
                    key={lead.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s'
                    }}
                  >
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {lead.company_name}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                      {lead.product_name}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                        {lead.stage}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className="badge badge-success" style={{ fontWeight: 700 }}>
                        {lead.score} / 100
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                      {lead.problems_count} mapped
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      {onNavigateToLead && (
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                          onClick={() => onNavigateToLead(lead.id)}
                        >
                          <span>Open Lead</span>
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drill Down Modal */}
      <DrillDownModal
        isOpen={drillModalOpen}
        onClose={() => setDrillModalOpen(false)}
        title={drillTitle}
        records={drillRecords}
        onNavigate={(_, id) => onNavigateToLead && onNavigateToLead(id)}
      />
    </div>
  );
};
