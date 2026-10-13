import React, { useState, useEffect } from 'react';
import { 
  Handshake, Building2, CheckCircle2, DollarSign, 
  RefreshCw, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { api } from '../services/api';
import type { PartnerAnalyticsData } from '../services/api';
import { KPICard } from './analytics/KPICard';

export const PartnerDashboardFoundationView: React.FC = () => {
  const [data, setData] = useState<PartnerAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPartnerData();
  }, []);

  const loadPartnerData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPartnerAnalytics();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch partner analytics');
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
      {/* Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Partner Ecosystem Foundation
            </h1>
            <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
              Real Data Only
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Certified partner network, deal registrations, co-selling pipeline, and commission entitlements.
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={loadPartnerData}
          style={{ padding: '8px 12px' }}
          title="Refresh partner data"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
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
        </div>
      )}

      {/* Row 1: Real Partner Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '16px'
      }}>
        <KPICard
          title="Authorized Partners"
          value={data?.kpis?.total_partners ?? 0}
          subtitle="Registered partner organizations"
          badge="Network"
          badgeType="info"
          icon={<Building2 size={18} />}
        />
        <KPICard
          title="Deal Registrations"
          value={data?.kpis?.deal_registrations ?? 0}
          subtitle={`${data?.kpis?.approved_registrations ?? 0} Approved / ${data?.kpis?.pending_registrations ?? 0} Pending`}
          badge="Protected Deals"
          badgeType="success"
          icon={<Handshake size={18} />}
        />
        <KPICard
          title="Partner Pipeline"
          value={formatCurrency(data?.kpis?.partner_pipeline_value)}
          subtitle="Originating from partner registrations"
          badge="Co-Sell"
          badgeType="info"
          icon={<DollarSign size={18} />}
        />
        <KPICard
          title="Partner Won Revenue"
          value={formatCurrency(data?.kpis?.partner_won_value)}
          subtitle={`Commission: ${formatCurrency(data?.kpis?.commissions_earned)}`}
          badge="Closed"
          badgeType="success"
          icon={<CheckCircle2 size={18} />}
        />
      </div>

      {/* Row 2: Partner Organizations Table */}
      <div className="glass-panel" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Partner Directory &amp; Status
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Active partner organizations with tier accreditation and territory
            </p>
          </div>
          <span className="badge badge-neutral">
            {data?.partner_list?.length ?? 0} Organizations
          </span>
        </div>

        {(!data?.partner_list || data.partner_list.length === 0) ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
            No partner organizations registered in the database.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 14px' }}>PARTNER NAME</th>
                  <th style={{ padding: '10px 14px' }}>TIER</th>
                  <th style={{ padding: '10px 14px' }}>TERRITORY</th>
                  <th style={{ padding: '10px 14px' }}>DEALS REGISTERED</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>COMMISSION RATE</th>
                </tr>
              </thead>
              <tbody>
                {(data?.partner_list || []).map((pt) => (
                  <tr key={pt.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Building2 size={16} color="var(--primary)" />
                        <span>{pt.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                        {pt.tier}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                      {pt.territory}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className="badge badge-neutral" style={{ fontWeight: 600 }}>
                        {pt.deals} deals
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                      {pt.commission_pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info notice about future phase */}
      <div style={{
        padding: '14px 18px',
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <ShieldCheck size={20} color="var(--primary)" />
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          <strong>Future-Ready Architecture Note:</strong> Multi-tier partner attribution, margin calculations, and portal self-service will be fully unlocked in the upcoming Partner Management release. No fake placeholder data is displayed.
        </div>
      </div>
    </div>
  );
};
