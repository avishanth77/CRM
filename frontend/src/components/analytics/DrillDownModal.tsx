import React from 'react';
import { ExternalLink, Download } from 'lucide-react';
import { Modal } from '../common/Modal';

export interface DrillDownRecord {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  badge?: string;
  badgeType?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  metrics?: { label: string; value: string | number }[];
  entityType?: 'lead' | 'opportunity' | 'account' | 'task' | 'sla';
  entityId?: string;
  date?: string;
}

interface DrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  records: DrillDownRecord[];
  onNavigate?: (entityType: string, entityId: string) => void;
  loading?: boolean;
}

export const DrillDownModal: React.FC<DrillDownModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  records,
  onNavigate,
  loading = false,
}) => {
  const exportAsCsv = () => {
    if (!records.length) return;
    const headers = ['ID', 'Title', 'Subtitle', 'Status', 'Badge', 'Date'];
    const rows = records.map(r => [
      `"${r.id}"`,
      `"${r.title.replace(/"/g, '""')}"`,
      `"${(r.subtitle || '').replace(/"/g, '""')}"`,
      `"${r.status || ''}"`,
      `"${r.badge || ''}"`,
      `"${r.date || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${title.toLowerCase().replace(/\s+/g, '_')}_drilldown.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getBadgeClass = (type?: string) => {
    switch (type) {
      case 'success': return 'badge-success';
      case 'warning': return 'badge-warning';
      case 'danger': return 'badge-danger';
      case 'info': return 'badge-info';
      default: return 'badge-neutral';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="lg"
      badge={
        <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
          {records.length} {records.length === 1 ? 'Record' : 'Records'}
        </span>
      }
      headerActions={
        records.length > 0 ? (
          <button
            className="btn btn-outline"
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            onClick={exportAsCsv}
            title="Export this drill-down list to CSV"
          >
            <Download size={14} />
            Export CSV
          </button>
        ) : undefined
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div style={{ padding: '4px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <div className="animate-spin" style={{ display: 'inline-block', marginBottom: '8px' }}>⏳</div>
            <p>Loading drill-down details...</p>
          </div>
        ) : records.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '1rem', fontWeight: 600 }}>No underlying records found</p>
            <p style={{ fontSize: '0.85rem' }}>There are currently no records matching this filter condition.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {records.map((rec) => (
              <div
                key={rec.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ flex: 1, minWidth: 0, marginRight: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      {rec.title}
                    </span>
                    {rec.badge && (
                      <span className={`badge ${getBadgeClass(rec.badgeType)}`} style={{ fontSize: '0.7rem' }}>
                        {rec.badge}
                      </span>
                    )}
                  </div>
                  {rec.subtitle && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {rec.subtitle}
                    </div>
                  )}
                </div>

                {rec.metrics && (
                  <div style={{ display: 'flex', gap: '16px', marginRight: '16px' }}>
                    {rec.metrics.map((m, idx) => (
                      <div key={idx} style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          {m.label}
                        </div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {m.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {rec.date && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '16px' }}>
                    {rec.date}
                  </div>
                )}

                {onNavigate && rec.entityType && (
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                    onClick={() => {
                      onClose();
                      onNavigate(rec.entityType!, rec.entityId || rec.id);
                    }}
                  >
                    <span>Open</span>
                    <ExternalLink size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
