import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, DollarSign, 
  RefreshCw, AlertTriangle, Percent
} from 'lucide-react';
import { api } from '../services/api';
import type { FunnelConversionData, Product } from '../services/api';
import { KPICard } from './analytics/KPICard';
import { DateRangeSelector } from './analytics/DateRangeSelector';
import { FunnelChartWidget } from './analytics/FunnelChartWidget';

interface FunnelConversionsAnalyticsViewProps {
  products: Product[];
  onNavigateToTab?: (tab: string) => void;
}

export const FunnelConversionsAnalyticsView: React.FC<FunnelConversionsAnalyticsViewProps> = ({
  products
}) => {
  const [data, setData] = useState<FunnelConversionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<string>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');

  useEffect(() => {
    loadFunnelConversions();
  }, [dateRange, customStart, customEnd, selectedProduct]);

  const loadFunnelConversions = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (dateRange) params.date_range = dateRange;
      if (customStart) params.start_date = customStart;
      if (customEnd) params.end_date = customEnd;
      if (selectedProduct) params.product = selectedProduct;
      const res = await api.getFunnelConversions(params);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch funnel conversions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Filter */}
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
            Funnel &amp; Stage Conversion Analytics
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Historical transition velocity, dwell duration, and milestone gate conversion rates calculated from Stage History.
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
            onClick={loadFunnelConversions}
            style={{ padding: '8px 12px' }}
            title="Refresh conversions"
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
          <button className="btn btn-outline" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '0.75rem' }} onClick={loadFunnelConversions}>
            Retry
          </button>
        </div>
      )}

      {/* Row 1: Key Conversion Rates */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
      }}>
        <KPICard
          title="Lead → PLD Qual"
          value={`${data?.conversions.lead_to_pld_qual ?? 0}%`}
          subtitle="Passed assessment"
          badge="Gate 1"
          badgeType="success"
          icon={<Percent size={18} />}
        />
        <KPICard
          title="PLD Qual → SQL"
          value={`${data?.conversions.pld_to_sql ?? 0}%`}
          subtitle="Passed SQL readiness"
          badge="Gate 2"
          badgeType="info"
          icon={<Percent size={18} />}
        />
        <KPICard
          title="SQL → Accepted"
          value={`${data?.conversions.sql_to_sales_accepted ?? 0}%`}
          subtitle="Sales accepted handoff"
          badge="Gate 3"
          badgeType="warning"
          icon={<CheckCircle2 size={18} />}
        />
        <KPICard
          title="Accepted → Opp"
          value={`${data?.conversions.accepted_to_opportunity ?? 0}%`}
          subtitle="Deal created"
          badge="Gate 4"
          badgeType="info"
          icon={<Percent size={18} />}
        />
        <KPICard
          title="Opportunity → Won"
          value={`${data?.conversions.opportunity_to_won ?? 0}%`}
          subtitle="Closed won revenue"
          badge="Win Rate"
          badgeType="success"
          icon={<DollarSign size={18} />}
        />
      </div>

      {/* Row 2: Average Velocity Durations */}
      <div className="glass-panel" style={{ padding: '22px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Funnel Velocity &amp; Stage Transition Times
          </h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Average days taken for accounts and opportunities to reach each lifecycle milestone
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px'
        }}>
          <div style={{ background: 'var(--bg-surface-elevated)', padding: '14px', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time to SQL</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
              {data?.velocity.avg_time_to_sql_days ?? 0} d
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>From Lead Creation</div>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', padding: '14px', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time to Sales Acceptance</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
              {data?.velocity.avg_time_to_acceptance_days ?? 0} d
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>From SQL Gate</div>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', padding: '14px', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time to Opportunity</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
              {data?.velocity.avg_time_to_opportunity_days ?? 0} d
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>From Acceptance</div>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', padding: '14px', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time to Closed Won</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>
              {data?.velocity.avg_time_to_won_days ?? 0} d
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>From Deal Inception</div>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', padding: '14px', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Sales Cycle</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
              {data?.velocity.avg_sales_cycle_days ?? 0} d
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>End-to-End Velocity</div>
          </div>
        </div>
      </div>

      {/* Row 3: 11-Stage Waterfall Funnel */}
      <FunnelChartWidget
        title="Complete 11-Stage Pipeline Waterfall"
        subtitle="Lifecycle stage transitions derived from historical StageHistory log entries."
        stages={data?.stages || []}
        loading={loading}
      />
    </div>
  );
};
