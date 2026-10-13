import React, { useState, useEffect } from 'react';
import { 
  TrendingDown, Clock, AlertTriangle, ShieldAlert, 
  Gauge, BarChart2, RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import type { LeakageVelocityData } from '../services/api';

export const FunnelLeakageVelocityView: React.FC = () => {
  const [data, setData] = useState<LeakageVelocityData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getLeakageVelocity();
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 16px auto', display: 'block' }} />
        <p style={{ fontWeight: 600 }}>Loading Funnel Leakage &amp; Pipeline Velocity Diagnostics...</p>
      </div>
    );
  }

  const primaryWarning = data?.velocity_metrics?.find(v => v.status === 'WARNING');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>SPEC SECTION 16 &amp; 21</span>
            <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>VELOCITY ENGINE</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0 }}>
            Funnel Leakage &amp; Pipeline Velocity
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0, marginTop: '4px' }}>
            Stage-by-stage drop-off diagnostics, dwell time bottleneck detection, and SLA breach watchdog.
          </p>
        </div>

        <button 
          onClick={loadData}
          disabled={loading}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh Diagnostics
        </button>
      </div>

      {/* Top Level Diagnostic Summary */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
              <span>END-TO-END EFFICIENCY</span>
              <Gauge size={16} color="var(--primary)" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: 'var(--primary)' }}>
              {data.overall_funnel_efficiency_pct}%
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Inbound lead ➔ Closed Won conversion
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
              <span>AVG SALES CYCLE</span>
              <Clock size={16} color="#059669" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: 'var(--text-primary)' }}>
              {data.average_sales_cycle_days} Days
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Benchmark target: 45.0 days
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
              <span>ACTIVE SLA WARNINGS</span>
              <AlertTriangle size={16} color="#EAB308" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: '#EAB308' }}>
              {data.active_sla_breaches?.length || 0} Hand-offs
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Approaching 48h sales acceptance SLA
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
              <span>PRIMARY BOTTLENECK</span>
              <TrendingDown size={16} color={primaryWarning ? "#F87171" : "#34D399"} />
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '8px', color: primaryWarning ? "#F87171" : "#34D399" }}>
              {primaryWarning ? primaryWarning.stage : 'All Stages Optimal'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {primaryWarning ? `Avg dwell: ${primaryWarning.avg_days}d vs ${primaryWarning.target_sla_days}d SLA` : 'Operating within SLA bounds'}
            </div>
          </div>
        </div>
      )}

      {/* Stage-by-Stage Conversion & Leakage Visualizer */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '4px' }}>
          Conversion &amp; Leakage Funnel Waterfall
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '20px' }}>
          Exact stage transitions, volume drop-offs, and root causes for pipeline attrition.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {data?.funnel_stages.map((stage, idx) => (
            <div 
              key={idx}
              style={{
                padding: '16px',
                borderRadius: '10px',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                display: 'grid',
                gridTemplateColumns: '220px 140px 1fr 280px',
                alignItems: 'center',
                gap: '16px'
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{stage.stage}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Volume: <strong style={{ color: 'var(--text-primary)' }}>{stage.count} Leads</strong>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Conversion Rate</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: stage.conversion_rate >= 50 ? 'var(--success)' : 'var(--primary)' }}>
                  {stage.conversion_rate}%
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div style={{ width: '100%', height: '10px', background: 'var(--bg-surface-elevated)', borderRadius: '5px', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      width: `${stage.conversion_rate}%`, 
                      height: '100%', 
                      background: stage.conversion_rate >= 50 ? 'var(--primary)' : 'linear-gradient(90deg, #F59E0B, #EF4444)',
                      borderRadius: '5px' 
                    }} 
                  />
                </div>
              </div>

              {/* Leakage reason */}
              <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--danger)', fontWeight: 700 }}>
                  <TrendingDown size={14} />
                  <span>{stage.leakage_count} LEAKED / DROPPED</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {stage.primary_drop_reason}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Velocity Table & Loss Pareto */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        {/* Velocity & Dwell Time */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Clock size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Pipeline Stage Velocity</h3>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '8px' }}>Stage Transition</th>
                <th style={{ padding: '8px' }}>Average Dwell</th>
                <th style={{ padding: '8px' }}>Target SLA</th>
                <th style={{ padding: '8px' }}>Health</th>
              </tr>
            </thead>
            <tbody>
              {data?.velocity_metrics.map((v, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--text-primary)' }}>{v.stage}</td>
                  <td style={{ padding: '12px 8px', fontWeight: 700 }}>{v.avg_days} Days</td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{v.target_sla_days} Days</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span className={`badge ${v.status === 'OPTIMAL' ? 'badge-success' : 'badge-warning'}`}>
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Loss & Disqualification Pareto */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <BarChart2 size={18} color="#F87171" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Disqualification Pareto Analysis</h3>
          </div>          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(data?.loss_reasons_breakdown && data.loss_reasons_breakdown.length > 0) ? (
              data.loss_reasons_breakdown.map((r, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.reason}</span>
                    <span style={{ fontWeight: 700, color: '#F87171' }}>{r.percentage}% ({r.count} leads)</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${Math.min(100, r.percentage * 3)}%`, 
                        height: '100%', 
                        background: 'linear-gradient(90deg, #F87171, #EF4444)', 
                        borderRadius: '3px' 
                      }} 
                    />
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '12px 0' }}>
                No disqualified leads or lost opportunities recorded in this period.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active SLA Breach Watchdog */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <ShieldAlert size={18} color="#EAB308" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
            Active Stage Gate &amp; SLA Breach Watchdog
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {(data?.active_sla_breaches && data.active_sla_breaches.length > 0) ? (
            data.active_sla_breaches.map(b => {
              const pct = Math.min(100, Math.round((b.elapsed_hours / b.max_hours) * 100));
              return (
                <div 
                  key={b.id}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    background: 'var(--bg-surface)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{b.account}</span>
                    <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>{b.status}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.type} • {b.entity}</div>
                  
                  {/* Timer bar */}
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Elapsed: {b.elapsed_hours}h</span>
                      <span style={{ fontWeight: 700, color: '#EAB308' }}>Limit: {b.max_hours}h</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'var(--bg-surface-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#EAB308', borderRadius: '3px' }} />
                    </div>
                  </div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Assigned Owner: <strong style={{ color: 'var(--text-primary)' }}>{b.owner}</strong>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No active SLA breaches detected. All gates operating within SLA benchmarks.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
