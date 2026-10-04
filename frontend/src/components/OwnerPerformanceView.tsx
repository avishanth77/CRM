import React, { useState, useEffect } from 'react';
import { 
  Users, AlertTriangle, RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import type { OwnerPerformanceData } from '../services/api';
import { DateRangeSelector } from './analytics/DateRangeSelector';

export const OwnerPerformanceView: React.FC = () => {
  const [data, setData] = useState<OwnerPerformanceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<string>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  useEffect(() => {
    loadOwnerPerformance();
  }, [dateRange, customStart, customEnd]);

  const loadOwnerPerformance = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (dateRange) params.date_range = dateRange;
      if (customStart) params.start_date = customStart;
      if (customEnd) params.end_date = customEnd;
      const res = await api.getOwnerPerformance(params);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch owner performance');
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
            Representative Performance Matrix
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Individual AE and SDR activity output, pipeline conversion rates, and closed won quotas.
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
            onClick={loadOwnerPerformance}
            style={{ padding: '8px 12px' }}
            title="Refresh owner metrics"
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
          <button className="btn btn-outline" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '0.75rem' }} onClick={loadOwnerPerformance}>
            Retry
          </button>
        </div>
      )}

      {/* Owners Table */}
      <div className="glass-panel" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Team Member Yield &amp; Conversion
            </h3>
          </div>
          <span className="badge badge-info">
            {data?.owners?.length ?? 0} Representatives
          </span>
        </div>

        {(!data?.owners || data.owners.length === 0) ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
            No owner performance data available.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 14px' }}>REPRESENTATIVE</th>
                  <th style={{ padding: '10px 14px' }}>LEADS</th>
                  <th style={{ padding: '10px 14px' }}>PLD QUAL</th>
                  <th style={{ padding: '10px 14px' }}>SQLs</th>
                  <th style={{ padding: '10px 14px' }}>ACCEPTED</th>
                  <th style={{ padding: '10px 14px' }}>OPPORTUNITIES</th>
                  <th style={{ padding: '10px 14px' }}>ACTIVITIES</th>
                  <th style={{ padding: '10px 14px' }}>OVERDUE</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>PIPELINE</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>WINS</th>
                </tr>
              </thead>
              <tbody>
                {data.owners.map((ow) => (
                  <tr key={ow.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: 'rgba(59, 130, 246, 0.2)',
                          color: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.75rem'
                        }}>
                          {ow.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span>{ow.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>{ow.leads}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>{ow.pld_qualified}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>{ow.sqls}</td>
                    <td style={{ padding: '12px 14px' }}>{ow.sales_accepted}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{ow.opportunities}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{ow.activities}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {ow.overdue_tasks > 0 ? (
                        <span className="badge badge-danger">{ow.overdue_tasks}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>0</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>
                      {formatCurrency(ow.pipeline)}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--success)', textAlign: 'right' }}>
                      {ow.wins} ({formatCurrency(ow.won_value)})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
