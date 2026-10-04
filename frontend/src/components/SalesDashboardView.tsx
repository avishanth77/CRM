import React, { useState, useEffect } from 'react';
import { 
  Briefcase, DollarSign, TrendingUp, Calendar, AlertTriangle, 
  CheckCircle2, Clock, ArrowRight, RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import type { SalesAnalyticsData, Product } from '../services/api';
import { KPICard } from './analytics/KPICard';
import { DateRangeSelector } from './analytics/DateRangeSelector';
import { DrillDownModal } from './analytics/DrillDownModal';
import type { DrillDownRecord } from './analytics/DrillDownModal';

interface SalesDashboardViewProps {
  products: Product[];
  onNavigateToOpportunity?: (oppId: string) => void;
  onNavigateToProposal?: (propId: string) => void;
  onNavigateToSQL?: () => void;
}

export const SalesDashboardView: React.FC<SalesDashboardViewProps> = ({
  products,
  onNavigateToOpportunity,
  onNavigateToProposal,
  onNavigateToSQL
}) => {
  const [data, setData] = useState<SalesAnalyticsData | null>(null);
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
    loadSalesAnalytics();
  }, [dateRange, customStart, customEnd, selectedProduct]);

  const loadSalesAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (dateRange) params.date_range = dateRange;
      if (customStart) params.start_date = customStart;
      if (customEnd) params.end_date = customEnd;
      if (selectedProduct) params.product = selectedProduct;
      const res = await api.getSalesAnalytics(params);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sales analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null || isNaN(val)) return '$0';
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}k`;
    return `$${val.toLocaleString()}`;
  };

  const handleOpenStageDrillDown = async (stage: string) => {
    setDrillTitle(`Opportunities in Stage: ${stage}`);
    setDrillModalOpen(true);
    try {
      const oppRes = await api.getOpportunities();
      const filtered = (oppRes.results || []).filter((o: any) => o.stage === stage);
      const records: DrillDownRecord[] = filtered.map((o: any) => ({
        id: o.id,
        title: o.name,
        subtitle: `Account: ${o.account_name || 'N/A'} • Owner: ${o.owner_name || 'Unassigned'}`,
        status: o.stage,
        badge: `$${Number(o.total_contract_value || 0).toLocaleString()}`,
        badgeType: 'info',
        entityType: 'opportunity',
        entityId: o.id
      }));
      setDrillRecords(records);
    } catch {
      // ignore
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header & Filters */}
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
            Sales &amp; Pipeline Analytics
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Deal execution velocity, weighted pipeline forecasts, stagnating opportunities, and close month distributions.
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
            onClick={loadSalesAnalytics}
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
          <button className="btn btn-outline" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '0.75rem' }} onClick={loadSalesAnalytics}>
            Retry
          </button>
        </div>
      )}

      {/* Row 1: Core Sales KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '16px'
      }}>
        <KPICard
          title="Active Pipeline"
          value={data ? formatCurrency(data?.kpis?.pipeline_value) : '$0'}
          subtitle={`${data?.kpis?.active_opportunities ?? 0} active deals`}
          badge="Unweighted"
          badgeType="info"
          icon={<DollarSign size={18} />}
        />
        <KPICard
          title="Weighted Pipeline"
          value={data ? formatCurrency(data?.kpis?.weighted_pipeline) : '$0'}
          subtitle="Value × Probability"
          badge="Forecast"
          badgeType="success"
          icon={<TrendingUp size={18} />}
        />
        <KPICard
          title="ARR / MRR"
          value={data ? formatCurrency(data?.kpis?.arr) : '$0'}
          subtitle={`MRR: ${data ? formatCurrency(data?.kpis?.mrr) : '$0'}`}
          badge="Recurring"
          badgeType="info"
          icon={<Calendar size={18} />}
        />
        <KPICard
          title="Won / Lost"
          value={`${data?.kpis?.won_count ?? 0} / ${data?.kpis?.lost_count ?? 0}`}
          subtitle={`Win Rate: ${data?.kpis?.win_rate ?? 0}%`}
          badge="Closed"
          badgeType={(data?.kpis?.win_rate ?? 0) >= 30 ? 'success' : 'neutral'}
          icon={<CheckCircle2 size={18} />}
        />
        <KPICard
          title="Avg Deal Size"
          value={data ? formatCurrency(data?.kpis?.average_deal_size) : '$0'}
          subtitle="Per won/open contract"
          badge="Commercial"
          badgeType="neutral"
          icon={<Briefcase size={18} />}
        />
        <KPICard
          title="Avg Sales Cycle"
          value={`${data?.kpis?.average_sales_cycle_days ?? 0} d`}
          subtitle="Creation to Close Won"
          badge="Velocity"
          badgeType="warning"
          icon={<Clock size={18} />}
        />
      </div>

      {/* Row 2: Sales Attention & Bottleneck Alerts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '14px'
      }}>
        <div style={{ background: 'var(--bg-surface-elevated)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>SQLs Awaiting Acceptance</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: ((data?.attention?.sqls_awaiting_acceptance ?? 0) > 0) ? 'var(--warning)' : 'var(--text-primary)', marginTop: '2px' }}>
              {data?.attention?.sqls_awaiting_acceptance ?? 0}
            </div>
          </div>
          {onNavigateToSQL && (
            <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '5px 10px' }} onClick={onNavigateToSQL}>
              Review
            </button>
          )}
        </div>

        <div style={{ background: 'var(--bg-surface-elevated)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Inactive Deals (&gt;14d)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: ((data?.attention?.inactive_opportunities_count ?? 0) > 0) ? 'var(--danger)' : 'var(--text-primary)', marginTop: '2px' }}>
              {data?.attention?.inactive_opportunities_count ?? 0}
            </div>
          </div>
          <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>Stalled</span>
        </div>

        <div style={{ background: 'var(--bg-surface-elevated)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pending Proposals</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              {data?.attention?.pending_proposals ?? 0}
            </div>
          </div>
          {onNavigateToProposal && (
            <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '5px 10px' }} onClick={() => onNavigateToProposal('')}>
              Inspect
            </button>
          )}
        </div>

        <div style={{ background: 'var(--bg-surface-elevated)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Overdue Tasks</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: ((data?.attention?.overdue_activities ?? 0) > 0) ? 'var(--danger)' : 'var(--text-primary)', marginTop: '2px' }}>
              {data?.attention?.overdue_activities ?? 0}
            </div>
          </div>
          <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Action Req</span>
        </div>
      </div>

      {/* Row 3: Opportunities by Stage & Opportunities by Owner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '20px'
      }}>
        {/* By Stage */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Pipeline by Sales Stage
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Contract value and count of deals in each lifecycle milestone
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(!data?.by_stage || data.by_stage.length === 0) ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                No active stage pipeline.
              </div>
            ) : (
              data.by_stage.map((st, idx) => (
                <div
                  key={idx}
                  onClick={() => handleOpenStageDrillDown(st.stage)}
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s',
                    border: '1px solid transparent'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      {st.stage}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {st.count} deals • Click to inspect
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      {formatCurrency(st.value)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Weighted: {formatCurrency(st.weighted_value)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* By Owner */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Pipeline by Account Executive
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Quota ownership and pipeline volume per representative
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(!data?.by_owner || data.by_owner.length === 0) ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                No owner pipeline assigned.
              </div>
            ) : (
              data.by_owner.map((ow, idx) => (
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'rgba(59, 130, 246, 0.2)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.78rem'
                    }}>
                      {ow.owner.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {ow.owner}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {ow.count} opportunities
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      {formatCurrency(ow.value)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Inactive Opportunities Stagnation Alert Table */}
      {data?.attention.inactive_opportunities && data.attention.inactive_opportunities.length > 0 && (
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Inactive Opportunities (&gt;14 Days Without Logged Activity)
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                At-risk deals that require immediate sales intervention or stage re-qualification
              </p>
            </div>
            <span className="badge badge-danger">
              {data.attention.inactive_opportunities.length} At Risk
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 14px' }}>OPPORTUNITY</th>
                  <th style={{ padding: '10px 14px' }}>STAGE</th>
                  <th style={{ padding: '10px 14px' }}>VALUE</th>
                  <th style={{ padding: '10px 14px' }}>OWNER</th>
                  <th style={{ padding: '10px 14px' }}>DAYS INACTIVE</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {data.attention.inactive_opportunities.map((opp) => (
                  <tr key={opp.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {opp.name}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                        {opp.stage}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {formatCurrency(opp.value)}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                      {opp.owner}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className="badge badge-danger" style={{ fontWeight: 700 }}>
                        {opp.days_inactive} days
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      {onNavigateToOpportunity && (
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                          onClick={() => onNavigateToOpportunity(opp.id)}
                        >
                          <span>Open Deal</span>
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drill Down Modal */}
      <DrillDownModal
        isOpen={drillModalOpen}
        onClose={() => setDrillModalOpen(false)}
        title={drillTitle}
        records={drillRecords}
        onNavigate={(_, id) => onNavigateToOpportunity && onNavigateToOpportunity(id)}
      />
    </div>
  );
};
