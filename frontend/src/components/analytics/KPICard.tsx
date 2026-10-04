import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'UP' | 'DOWN' | 'NEUTRAL';
  trendValue?: string;
  color?: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeType?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  onClick?: () => void;
  clickableHint?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  color = 'var(--primary)',
  icon,
  badge,
  badgeType = 'neutral',
  onClick,
  clickableHint
}) => {
  return (
    <div 
      className="glass-panel" 
      onClick={onClick}
      style={{
        padding: '20px',
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.borderColor = 'var(--primary)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.borderColor = 'var(--border-subtle)';
        }
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {badge && (
            <span className={`badge badge-${badgeType}`} style={{ fontSize: '0.65rem' }}>
              {badge}
            </span>
          )}
          {icon && (
            <div style={{ color }}>
              {icon}
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        {value}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
        {subtitle && (
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
            {subtitle}
          </div>
        )}

        {trend && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px', 
            fontSize: '0.72rem', 
            fontWeight: 700,
            color: trend === 'UP' ? 'var(--success)' : trend === 'DOWN' ? 'var(--danger)' : 'var(--text-muted)',
            marginLeft: 'auto'
          }}>
            {trend === 'UP' && <TrendingUp size={13} />}
            {trend === 'DOWN' && <TrendingDown size={13} />}
            {trend === 'NEUTRAL' && <Minus size={13} />}
            {trendValue}
          </div>
        )}
      </div>

      {onClick && clickableHint && (
        <div style={{ 
          marginTop: '8px', 
          fontSize: '0.7rem', 
          color: 'var(--primary)', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px',
          fontWeight: 600
        }}>
          🔍 {clickableHint}
        </div>
      )}
    </div>
  );
};
