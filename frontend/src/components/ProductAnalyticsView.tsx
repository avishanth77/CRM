import React, { useState, useEffect } from 'react';
import { 
  Box, Layers, Sparkles, RefreshCw, AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import type { ProductAnalyticsData } from '../services/api';
import { DateRangeSelector } from './analytics/DateRangeSelector';

export const ProductAnalyticsView: React.FC = () => {
  const [data, setData] = useState<ProductAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<string>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'products' | 'modules' | 'capabilities'>('products');

  useEffect(() => {
    loadProductAnalytics();
  }, [dateRange, customStart, customEnd]);

  const loadProductAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (dateRange) params.date_range = dateRange;
      if (customStart) params.start_date = customStart;
      if (customEnd) params.end_date = customEnd;
      const res = await api.getProductAnalytics(params);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch product analytics');
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
            Product &amp; Capability Demand Analytics
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Demand intelligence mapped through Product → Pipeline → Stage → Module → Capability hierarchy.
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
            onClick={loadProductAnalytics}
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
          <button className="btn btn-outline" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '0.75rem' }} onClick={loadProductAnalytics}>
            Retry
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
        <button
          className={`btn ${activeTab === 'products' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('products')}
          style={{ fontSize: '0.82rem', padding: '7px 14px' }}
        >
          <Box size={15} />
          Products Overview ({data?.products?.length ?? 0})
        </button>
        <button
          className={`btn ${activeTab === 'modules' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('modules')}
          style={{ fontSize: '0.82rem', padding: '7px 14px' }}
        >
          <Layers size={15} />
          Module Demand ({data?.module_interest?.length ?? 0})
        </button>
        <button
          className={`btn ${activeTab === 'capabilities' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('capabilities')}
          style={{ fontSize: '0.82rem', padding: '7px 14px' }}
        >
          <Sparkles size={15} />
          Capability Solutions ({data?.capability_demand?.length ?? 0})
        </button>
      </div>

      {/* View 1: Products Performance Grid */}
      {activeTab === 'products' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {(!data?.products || data.products.length === 0) ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No configured products found.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '18px'
            }}>
              {data.products.map((p) => (
                <div key={p.id} className="glass-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                          {p.name}
                        </h3>
                        <span className="badge badge-info" style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                          {p.code}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Avg PLD Score: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p.average_pld_score}/100</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                        {formatCurrency(p.pipeline)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Pipeline</div>
                    </div>
                  </div>

                  {/* Metrics Row */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '8px',
                    background: 'var(--bg-surface-elevated)',
                    padding: '12px',
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>LEADS</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{p.leads}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>PLD QUAL</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--success)' }}>{p.pld_qualified}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>SQLs</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--warning)' }}>{p.sqls}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>WON</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{p.won_count}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>Conversion Rate: <strong style={{ color: 'var(--text-primary)' }}>{p.conversion_rate}%</strong></span>
                    <span>Won Value: <strong style={{ color: 'var(--success)' }}>{formatCurrency(p.won_value)}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View 2: Module Interest Breakdown */}
      {activeTab === 'modules' && (
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Customer Module Interest
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Which product modules solve customer business pain points during Discovery
            </p>
          </div>

          {(!data?.module_interest || data.module_interest.length === 0) ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
              No module interest records logged in discovery.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.module_interest.map((m, idx) => (
                <div key={idx} style={{ background: 'var(--bg-surface-elevated)', padding: '14px 18px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {m.name}
                      </span>
                      <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                        {m.product}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span className="badge badge-info" style={{ fontWeight: 700, fontSize: '0.8rem' }}>
                      {m.count} Sessions Mapped
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View 3: Capability Demand Breakdown */}
      {activeTab === 'capabilities' && (
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Capability Demand Ranking
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Specific functional capabilities requested to solve customer root causes
            </p>
          </div>

          {(!data?.capability_demand || data.capability_demand.length === 0) ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
              No capability demand records mapped.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data.capability_demand.map((c, idx) => (
                <div key={idx} style={{ background: 'var(--bg-surface-elevated)', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'rgba(59, 130, 246, 0.2)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700
                    }}>
                      {idx + 1}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      {c.name}
                    </span>
                  </div>
                  <div>
                    <span className="badge badge-success" style={{ fontWeight: 700, fontSize: '0.78rem' }}>
                      {c.demand_count} Mappings
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
