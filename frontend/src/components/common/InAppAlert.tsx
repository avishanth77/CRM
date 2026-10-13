import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertItem {
  id: string;
  type: AlertType;
  title?: string;
  message: string;
  duration: number;
  timestamp: number;
}

type AlertListener = (alert: AlertItem) => void;
const listeners = new Set<AlertListener>();

export const inAppAlert = {
  show: (type: AlertType, message: string, title?: string, duration: number = 4500) => {
    const alert: AlertItem = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title: title || (type === 'success' ? 'Success' : type === 'error' ? 'Notice' : type === 'warning' ? 'Warning' : 'Information'),
      message: String(message || ''),
      duration,
      timestamp: Date.now()
    };
    listeners.forEach(fn => fn(alert));
  },
  success: (message: string, title?: string, duration: number = 4500) => {
    inAppAlert.show('success', message, title || 'Success', duration);
  },
  error: (message: string, title?: string, duration: number = 5500) => {
    inAppAlert.show('error', message, title || 'Attention / Notice', duration);
  },
  warning: (message: string, title?: string, duration: number = 5000) => {
    inAppAlert.show('warning', message, title || 'Warning', duration);
  },
  info: (message: string, title?: string, duration: number = 4500) => {
    inAppAlert.show('info', message, title || 'Information', duration);
  }
};

// Global interceptor for standard window.alert calls
if (typeof window !== 'undefined') {
  window.alert = (message: any) => {
    const str = String(message ?? '');
    const lower = str.toLowerCase();
    let type: AlertType = 'info';
    let title = 'Information';
    if (lower.includes('error') || lower.includes('fail') || lower.includes('blocked') || lower.includes('denied') || lower.includes('cannot') || lower.includes('invalid')) {
      type = 'error';
      title = 'Notice / Action Blocked';
    } else if (lower.includes('warning') || lower.includes('required') || lower.includes('mandatory') || lower.includes('missing') || lower.includes('specify') || lower.includes('select')) {
      type = 'warning';
      title = 'Attention Required';
    } else if (lower.includes('success') || lower.includes('created') || lower.includes('saved') || lower.includes('updated') || lower.includes('deleted') || lower.includes('completed')) {
      type = 'success';
      title = 'Success';
    }
    inAppAlert.show(type, str, title);
  };
}

export const InAppAlertContainer: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  useEffect(() => {
    const handleNewAlert: AlertListener = (newAlert) => {
      setAlerts(prev => [...prev, newAlert]);
      if (newAlert.duration > 0) {
        setTimeout(() => {
          setAlerts(current => current.filter(a => a.id !== newAlert.id));
        }, newAlert.duration);
      }
    };

    listeners.add(handleNewAlert);
    return () => {
      listeners.delete(handleNewAlert);
    };
  }, []);

  const handleDismiss = (id: string) => {
    setAlerts(current => current.filter(a => a.id !== id));
  };

  if (alerts.length === 0) return null;

  return (
    <div
      className="in-app-alert-container"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        top: 'auto',
        left: 'auto',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '10px',
        maxWidth: '440px',
        width: 'calc(100vw - 48px)',
        pointerEvents: 'none'
      }}
    >
      {alerts.map(item => {
        let accentColor = '#3B82F6';
        let bgGradient = 'rgba(59, 130, 246, 0.12)';
        let IconComponent = Info;

        if (item.type === 'success') {
          accentColor = '#10B981';
          bgGradient = 'rgba(16, 185, 129, 0.12)';
          IconComponent = CheckCircle2;
        } else if (item.type === 'error') {
          accentColor = '#EF4444';
          bgGradient = 'rgba(239, 68, 68, 0.14)';
          IconComponent = AlertCircle;
        } else if (item.type === 'warning') {
          accentColor = '#F59E0B';
          bgGradient = 'rgba(245, 158, 11, 0.14)';
          IconComponent = AlertTriangle;
        }

        return (
          <div
            key={item.id}
            className="in-app-alert-item animate-fade-in"
            style={{
              pointerEvents: 'auto',
              background: 'var(--bg-surface, #FFFFFF)',
              border: `1px solid ${accentColor}`,
              borderLeft: `5px solid ${accentColor}`,
              borderRadius: '12px',
              padding: '14px 16px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.18), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              position: 'relative',
              overflow: 'hidden',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none'
            }}
          >
            {/* Ambient Background Accent */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: '4px',
              background: accentColor
            }} />

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  padding: '4px',
                  borderRadius: '6px',
                  background: bgGradient,
                  color: accentColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <IconComponent size={18} />
                </div>
                <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary, #0F172A)', letterSpacing: '-0.01em' }}>
                  {item.title}
                </strong>
              </div>

              <button
                type="button"
                onClick={() => handleDismiss(item.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted, #64748B)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px'
                }}
                title="Dismiss"
              >
                <X size={15} />
              </button>
            </div>

            <div style={{
              fontSize: '0.82rem',
              color: 'var(--text-secondary, #475569)',
              lineHeight: 1.45,
              paddingLeft: '26px',
              wordBreak: 'break-word'
            }}>
              {item.message}
            </div>

            {/* Subtle Progress Bar */}
            {item.duration > 0 && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '2px',
                background: accentColor,
                opacity: 0.6,
                width: '100%',
                animation: `shrinkProgress ${item.duration}ms linear forwards`
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
};
