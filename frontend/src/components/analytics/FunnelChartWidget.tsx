import React from 'react';

export interface FunnelStageItem {
  stage?: string;
  stage_name?: string;
  stage_key?: string;
  code?: string;
  sequence?: number;
  count: number;
  conversion_rate?: number;
  drop_off_rate?: number;
  drop_off_count?: number;
  avg_days?: number;
  avg_days_in_stage?: number;
  dwell_days?: number;
}

interface FunnelChartWidgetProps {
  stages: FunnelStageItem[];
  onStageClick?: (stage: FunnelStageItem) => void;
  title?: string;
  subtitle?: string;
  loading?: boolean;
}

export const FunnelChartWidget: React.FC<FunnelChartWidgetProps> = ({
  stages,
  onStageClick,
  title = "Commercial Funnel Progression & Leakage",
  subtitle,
  loading = false
}) => {
  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p>Loading funnel metrics...</p>
      </div>
    );
  }

  if (!stages || stages.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        No funnel data available for selected filter range.
      </div>
    );
  }

  const maxCount = Math.max(...stages.map(s => Number(s?.count || 0)), 1);

  const getStageColor = (index: number) => {
    const colors = [
      '#3B82F6', // Blue
      '#06B6D4', // Cyan
      '#10B981', // Emerald
      '#8B5CF6', // Purple
      '#EC4899', // Pink
      '#F59E0B', // Amber
      '#6366F1', // Indigo
      '#14B8A6', // Teal
      '#10B981', // Emerald
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            {title}
          </h3>
          {subtitle && (
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Click stage for records drill-down
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {stages.map((stage, idx) => {
          const name = stage.stage_name || stage.stage || stage.code || `Stage ${idx + 1}`;
          const widthPct = Math.max(12, Math.round((stage.count / maxCount) * 100));
          const color = getStageColor(idx);
          const convRate = stage.conversion_rate !== undefined ? stage.conversion_rate : 100;
          const dropOff = stage.drop_off_count !== undefined ? stage.drop_off_count : (stage.drop_off_rate !== undefined ? `${stage.drop_off_rate}%` : 0);
          const dwell = stage.avg_days_in_stage ?? stage.dwell_days ?? stage.avg_days;

          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ 
                    width: '20px', 
                    height: '20px', 
                    borderRadius: '50%', 
                    background: `${color}22`, 
                    color: color, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: '0.7rem', 
                    fontWeight: 700 
                  }}>
                    {idx + 1}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {dwell !== undefined && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Dwell: <strong style={{ color: 'var(--text-primary)' }}>{dwell}d</strong>
                    </span>
                  )}
                  <span style={{ fontWeight: 700, color: '#FFFFFF' }}>{stage.count}</span>
                  <span style={{ fontSize: '0.75rem', color: convRate >= 70 ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                    {convRate}% conv
                  </span>
                  {dropOff !== 0 && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--danger)' }}>
                      Drop: {dropOff}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar representing funnel volume */}
              <div 
                onClick={() => onStageClick && onStageClick(stage)}
                style={{ 
                  width: '100%', 
                  height: '26px', 
                  background: 'var(--bg-surface-elevated)', 
                  borderRadius: '6px', 
                  overflow: 'hidden',
                  cursor: onStageClick ? 'pointer' : 'default',
                  position: 'relative',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div 
                  style={{ 
                    width: `${widthPct}%`, 
                    height: '100%', 
                    background: `linear-gradient(90deg, ${color}cc 0%, ${color} 100%)`, 
                    borderRadius: '5px',
                    transition: 'width 0.4s ease'
                  }} 
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
