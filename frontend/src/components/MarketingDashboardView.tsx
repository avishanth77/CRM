import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Award, CheckCircle2, 
  Users, AlertTriangle, RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import type { MarketingAnalyticsData, Product } from '../services/api';
import { KPICard } from './analytics/KPICard';
import { DateRangeSelector } from './analytics/DateRangeSelector';

interface MarketingDashboardViewProps {
  products: Product[];
  onNavigateToTab?: (tab: string) => void;
}

export const MarketingDashboardView: React.FC<MarketingDashboardViewProps> = ({
  products
}) => {
  const [data, setData] = useState<MarketingAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<string>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');

  useEffect(() => {
    loadMarketingAnalytics();
  }, [dateRange, customStart, customEnd, selectedProduct]);

  const loadMarketingAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (dateRange) params.date_range = dateRange;
      if (customStart) params.start_date = customStart;
      if (customEnd) params.end_date = customEnd;
      if (selectedProduct) params.product = selectedProduct;
      const res = await api.getMarketingAnalytics(params);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch marketing analytics');
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
            Marketing Channel Analytics
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Lead generation channel quality, ICP pass rates, PLD qualification yield, and pipeline attribution.
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
            onClick={loadMarketingAnalytics}
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
          <button className="btn btn-outline" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '0.75rem' }} onClick={loadMarketingAnalytics}>
            Retry
          </button>
        </div>
      )}

      {/* Row 1: Marketing Overview KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '16px'
      }}>
        <KPICard
          title="Generated Leads"
          value={data?.kpis.total_leads ?? 0}
          subtitle="All recorded channels"
          badge="Inbound/Outbound"
          badgeType="info"
          icon={<Users size={18} />}
        />
        <KPICard
          title="Overall ICP Pass"
          value={`${data?.kpis.icp_pass_rate ?? 0}%`}
          subtitle="Meets Ideal Customer Profile"
          badge="Quality"
          badgeType="success"
          icon={<CheckCircle2 size={18} />}
        />
        <KPICard
          title="PLD Qualification"
          value={`${data?.kpis.qualification_rate ?? 0}%`}
          subtitle="Achieved PLD Qual threshold"
          badge="Conversion"
          badgeType="success"
          icon={<Award size={18} />}
        />
        <KPICard
          title="Marketing Pipeline"
          value={data ? formatCurrency(data.kpis.pipeline_value) : '$0'}
          subtitle={`Won Value: ${data ? formatCurrency(data.kpis.won_value) : '$0'}`}
          badge="Attributed Value"
          badgeType="info"
          icon={<DollarSign size={18} />}
        />
      </div>

      {/* Row 2: Comprehensive Sources Table */}
      <div className="glass-panel" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Channel Performance Breakdown
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Complete breakdown of leads, ICP fit, PLD qualification, SQL readiness, and pipeline generated per source
            </p>
          </div>
          <span className="badge badge-info">
            {data?.sources?.length ?? 0} Sources
          </span>
        </div>

        {(!data?.sources || data.sources.length === 0) ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
            No lead source records available.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 14px' }}>LEAD SOURCE</th>
                  <th style={{ padding: '10px 14px' }}>LEADS</th>
                  <th style={{ padding: '10px 14px' }}>ICP PASS RATE</th>
                  <th style={{ padding: '10px 14px' }}>PLD QUAL RATE</th>
                  <th style={{ padding: '10px 14px' }}>SQLs</th>
                  <th style={{ padding: '10px 14px' }}>OPPORTUNITIES</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>PIPELINE</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>WON VALUE</th>
                </tr>
              </thead>
              <tbody>
                {data.sources.map((s, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {s.source}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className="badge badge-neutral" style={{ fontWeight: 600 }}>{s.leads}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className={`badge ${s.icp_pass_rate >= 50 ? 'badge-success' : 'badge-warning'}`}>
                        {s.icp_pass_rate}%
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className={`badge ${s.qualification_rate >= 20 ? 'badge-success' : 'badge-neutral'}`}>
                        {s.qualification_rate}%
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                      {s.sqls}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                      {s.opportunities}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>
                      {formatCurrency(s.pipeline)}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--success)', textAlign: 'right' }}>
                      {formatCurrency(s.won_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row 3: Campaigns Breakdown (if any) */}
      {data?.campaigns && data.campaigns.length > 0 && (
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Campaign Performance
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Direct campaigns, lead yields, and pipeline contribution
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 14px' }}>CAMPAIGN NAME</th>
                  <th style={{ padding: '10px 14px' }}>LEADS</th>
                  <th style={{ padding: '10px 14px' }}>BUDGET</th>
                  <th style={{ padding: '10px 14px' }}>PIPELINE</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>WON VALUE</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((c, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {c.name}
                    </td>
                    <td style={{ padding: '12px 14px' }}>{c.leads}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                      {c.budget > 0 ? formatCurrency(c.budget) : 'N/A'}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {formatCurrency(c.pipeline)}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--success)', textAlign: 'right' }}>
                      {formatCurrency(c.won_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
