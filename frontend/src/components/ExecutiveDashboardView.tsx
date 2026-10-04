import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, DollarSign, Users, Award, 
  Activity, ArrowRight, Layers, AlertTriangle, RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import type { ExecutiveAnalyticsData, Product } from '../services/api';
import { KPICard } from './analytics/KPICard';
import { DateRangeSelector } from './analytics/DateRangeSelector';
import { FunnelChartWidget } from './analytics/FunnelChartWidget';
import { DrillDownModal } from './analytics/DrillDownModal';
import type { DrillDownRecord } from './analytics/DrillDownModal';

interface ExecutiveDashboardViewProps {
  products: Product[];
  onNavigateToEntity?: (type: string, id: string) => void;
  onNavigateToTab?: (tab: string) => void;
}

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  products,
  onNavigateToEntity,
  onNavigateToTab
}) => {
  const [data, setData] = useState<ExecutiveAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<string>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');

  // Drill Down Modal
  const [drillModalOpen, setDrillModalOpen] = useState(false);
  const [drillTitle, setDrillTitle] = useState('');
  const [drillRecords, setDrillRecords] = useState<DrillDownRecord[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, [dateRange, customStart, customEnd, selectedProduct]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (dateRange) params.date_range = dateRange;
      if (customStart) params.start_date = customStart;
      if (customEnd) params.end_date = customEnd;
      if (selectedProduct) params.product = selectedProduct;
      const res = await api.getExecutiveAnalytics(params);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch executive analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleKpiDrillDown = async (metricKey: string, title: string) => {
    setDrillTitle(title);
    setDrillModalOpen(true);
    setDrillRecords([]);

    try {
      if (metricKey === 'leads' || metricKey === 'pld' || metricKey === 'target_accounts') {
        const leadRes = await api.getLeads();
        const records: DrillDownRecord[] = (leadRes.results || []).map((l: any) => ({
          id: l.id,
          title: l.company_name,
          subtitle: `${l.industry || 'Unknown'} • Contact: ${l.primary_contact_name || 'N/A'}`,
          status: l.qualification_status || l.status,
          badge: `PLD: ${l.pld_score ?? 0}`,
          badgeType: (l.pld_score >= 60) ? 'success' : (l.pld_score >= 30 ? 'warning' : 'neutral'),
          date: l.created_at ? new Date(l.created_at).toLocaleDateString() : undefined,
          entityType: 'lead',
          entityId: l.id
        }));
        setDrillRecords(records);
      } else if (metricKey === 'opportunities' || metricKey === 'won') {
        const oppRes = await api.getOpportunities();
        const records: DrillDownRecord[] = (oppRes.results || []).map((o: any) => ({
          id: o.id,
          title: o.name,
          subtitle: `Stage: ${o.stage} • Prob: ${o.probability_pct}%`,
          status: o.stage,
          badge: `$${Number(o.total_contract_value || 0).toLocaleString()}`,
          badgeType: o.stage === 'CLOSED_WON' ? 'success' : 'info',
          date: o.created_at ? new Date(o.created_at).toLocaleDateString() : undefined,
          entityType: 'opportunity',
          entityId: o.id
        }));
        setDrillRecords(records);
      }
    } catch {
      // Fallback
    }
  };

  const handleFunnelStageClick = async (stage: any) => {
    setDrillTitle(`Records in Stage: ${stage.stage_name}`);
    setDrillModalOpen(true);
    // Fetch underlying leads or opportunities
    try {
      const leadRes = await api.getLeads();
      const records: DrillDownRecord[] = (leadRes.results || [])
        .filter((l: any) => l.pld_stage === stage.stage_key || l.qualification_status === stage.stage_key)
        .map((l: any) => ({
          id: l.id,
          title: l.company_name,
          subtitle: `Product: ${l.product_name || 'N/A'} • Owner: ${l.owner_name || 'Unassigned'}`,
          badge: `Score: ${l.pld_score ?? 0}`,
          badgeType: 'info',
          entityType: 'lead',
          entityId: l.id
        }));
      setDrillRecords(records);
    } catch {
      // ignore
    }
  };

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null || isNaN(val)) return '$0';
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}k`;
    return `$${val.toLocaleString()}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Dashboard Top Header & Filters */}
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
            Executive Dashboard
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            High-level business performance, revenue pipeline, SLA compliance, and cross-stage funnel health.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Product Filter */}
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

          {/* Date Range Selector */}
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
            onClick={loadAnalytics}
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
          <button className="btn btn-outline" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '0.75rem' }} onClick={loadAnalytics}>
            Retry
          </button>
        </div>
      )}

      {/* Row 1: Executive KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '16px'
      }}>
        <KPICard
          title="Won Value"
          value={data ? formatCurrency(data.kpis.won_value) : '$0'}
          subtitle={`Win Rate: ${data?.rates?.win_rate ?? data?.kpis?.win_rate ?? 0}%`}
          badge="Revenue"
          badgeType="success"
          icon={<DollarSign size={18} />}
          onClick={() => handleKpiDrillDown('won', 'Closed Won Opportunities')}
        />
        <KPICard
          title="Pipeline Value"
          value={data ? formatCurrency(data.kpis.pipeline_value) : '$0'}
          subtitle={`Weighted: ${data ? formatCurrency(data.kpis.weighted_pipeline) : '$0'}`}
          badge="Active"
          badgeType="info"
          icon={<TrendingUp size={18} />}
          onClick={() => handleKpiDrillDown('opportunities', 'Active Pipeline Opportunities')}
        />
        <KPICard
          title="Total Leads"
          value={data?.kpis.total_leads ?? 0}
          subtitle={`Target Accounts: ${data?.kpis.target_accounts ?? 0}`}
          badge="Inbound & Outbound"
          badgeType="neutral"
          icon={<Users size={18} />}
          onClick={() => handleKpiDrillDown('leads', 'All Leads')}
        />
        <KPICard
          title="PLD Qualified"
          value={data?.kpis.pld_qualified ?? 0}
          subtitle={`Qual Rate: ${data?.rates?.lead_to_pld_rate ?? data?.kpis?.qualification_rate ?? 0}%`}
          badge="Qualified"
          badgeType="success"
          icon={<Award size={18} />}
          onClick={() => handleKpiDrillDown('pld', 'PLD Qualified Leads')}
        />
        <KPICard
          title="SQLs & Accepted"
          value={`${data?.kpis.sql_count ?? data?.kpis.sqls ?? 0} / ${data?.kpis.sales_accepted ?? 0}`}
          subtitle={`Acceptance: ${data?.rates?.sql_to_accepted_rate ?? data?.kpis?.acceptance_rate ?? 0}%`}
          badge="Sales Gate"
          badgeType="warning"
          icon={<Layers size={18} />}
          onClick={() => onNavigateToTab && onNavigateToTab('sql')}
        />
        <KPICard
          title="Opportunities"
          value={data?.kpis.opportunities_count ?? data?.kpis.opportunities ?? 0}
          subtitle={`Open: ${data?.kpis.open_opportunities ?? 0} • Won: ${data?.kpis.won_opportunities ?? 0}`}
          badge="Deals"
          badgeType="info"
          icon={<BarChart3 size={18} />}
          onClick={() => onNavigateToTab && onNavigateToTab('opportunities')}
        />
      </div>

      {/* Row 2: Visual Funnel Waterfall with Drop-Offs & Dwell Time */}
      <FunnelChartWidget
        title="Full Lifecycle Funnel Waterfall"
        subtitle="End-to-end progression from Target Account through Closed Won, tracked via stage transitions."
        stages={data?.funnel || []}
        onStageClick={handleFunnelStageClick}
        loading={loading}
      />

      {/* Row 3: Pipeline Breakdown, Product Distribution & Health Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '20px'
      }}>
        {/* Pipeline by Product */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Pipeline by Product
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Revenue distribution across configured products
              </p>
            </div>
            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
              {(data?.product_breakdown || data?.pipeline_by_product || []).length} Products
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(!data?.product_breakdown && !data?.pipeline_by_product) ||
            ((data?.product_breakdown || data?.pipeline_by_product || []).length === 0) ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '24px' }}>
                No active pipeline records for this filter.
              </div>
            ) : (
              (data?.product_breakdown || data?.pipeline_by_product || []).map((item: any, idx: number) => {
                const totalPipe = data?.kpis?.pipeline_value || 1;
                const itemVal = item.value ?? item.open_pipeline_value ?? 0;
                const dealCount = item.count ?? item.opportunities_count ?? 0;
                const pct = Math.min(100, Math.round((itemVal / totalPipe) * 100));
                return (
                  <div key={idx} style={{ background: 'var(--bg-surface-elevated)', padding: '12px 14px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {item.product_name}
                      </span>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {formatCurrency(itemVal)}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                          ({dealCount} deals)
                        </span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: '6px', background: 'var(--bg-surface)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #3B82F6 0%, #60A5FA 100%)',
                        borderRadius: '3px'
                      }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pipeline by Opportunity Type (New, Expansion, Renewal) */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Pipeline by Deal Type
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                New Business vs Expansion vs Renewal
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(!data?.pipeline_by_type || data.pipeline_by_type.length === 0) ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '24px' }}>
                No deal type data available.
              </div>
            ) : (
              data.pipeline_by_type.map((t, idx) => {
                const totalPipe = data.kpis.pipeline_value || 1;
                const pct = Math.min(100, Math.round((t.value / totalPipe) * 100));
                return (
                  <div key={idx} style={{ background: 'var(--bg-surface-elevated)', padding: '12px 14px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {t.type}
                      </span>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {formatCurrency(t.value)}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                          ({t.count} deals)
                        </span>
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'var(--bg-surface)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: t.type === 'EXPANSION'
                          ? 'linear-gradient(90deg, #10B981 0%, #34D399 100%)'
                          : t.type === 'RENEWAL'
                          ? 'linear-gradient(90deg, #F59E0B 0%, #FBBF24 100%)'
                          : 'linear-gradient(90deg, #6366F1 0%, #818CF8 100%)',
                        borderRadius: '3px'
                      }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Operational Health: Activity & SLA */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Operational Health
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Team execution velocity and SLA compliance
              </p>
            </div>
            <Activity size={18} color="var(--primary)" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Activities Today</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {data?.activity_health?.activities_today ?? 0}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {data?.activity_health?.activities_this_week ?? 0} this week
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>SLA Compliance</div>
              <div style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                color: (data?.sla_health?.compliance_rate ?? 100) >= 90 ? 'var(--success)' : 'var(--warning)',
                marginTop: '4px'
              }}>
                {data?.sla_health?.compliance_rate ?? 100}%
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {data?.sla_health?.breached ?? 0} breached
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Overdue Tasks</div>
              <div style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                color: (data?.activity_health?.overdue_tasks ?? 0) > 0 ? 'var(--danger)' : 'var(--text-primary)',
                marginTop: '4px'
              }}>
                {data?.activity_health?.overdue_tasks ?? 0}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Require attention
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>SLA At Risk</div>
              <div style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                color: (data?.sla_health?.at_risk ?? 0) > 0 ? 'var(--warning)' : 'var(--text-primary)',
                marginTop: '4px'
              }}>
                {data?.sla_health?.at_risk ?? 0}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Nearing breach
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <button
              className="btn btn-outline"
              style={{ width: '100%', fontSize: '0.8rem', justifyContent: 'center' }}
              onClick={() => onNavigateToTab && onNavigateToTab('work-queue')}
            >
              Open Work Queue
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Drill Down Modal */}
      <DrillDownModal
        isOpen={drillModalOpen}
        onClose={() => setDrillModalOpen(false)}
        title={drillTitle}
        records={drillRecords}
        onNavigate={onNavigateToEntity}
      />
    </div>
  );
};
