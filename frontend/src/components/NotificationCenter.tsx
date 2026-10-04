import React, { useState, useEffect } from 'react';
import { 
  Bell, CheckCheck, 
  ExternalLink, X, CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';
import type { NotificationItem } from '../services/api';

interface NotificationCenterProps {
  onNavigateToRecord?: (entityType: string, entityId: string) => void;
  onNavigateToEntity?: (entityType: string, entityId: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  onNavigateToRecord,
  onNavigateToEntity
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('UNREAD');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000); // 30s poll
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, filter]);

  const loadUnreadCount = async () => {
    try {
      const res = await api.getUnreadNotificationCount();
      setUnreadCount(res.unread_count || 0);
    } catch (err) {
      // silent
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter === 'UNREAD') params['is_read'] = 'false';
      const res = await api.getNotifications(params);
      setNotifications(res.results || []);
    } catch (err) {
      console.error("Failed to load notifications", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return <span className="badge badge-danger" style={{ fontSize: '0.62rem' }}>Critical</span>;
      case 'HIGH':
        return <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>High</span>;
      case 'MEDIUM':
        return <span className="badge badge-info" style={{ fontSize: '0.62rem' }}>Medium</span>;
      default:
        return <span className="badge badge-neutral" style={{ fontSize: '0.62rem' }}>Low</span>;
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell Icon Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          background: isOpen ? 'var(--bg-surface-elevated)' : 'transparent',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '8px',
          color: unreadCount > 0 ? '#FFFFFF' : 'var(--text-muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease'
        }}
        title="Notification Center"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: 'var(--danger)',
            color: '#FFFFFF',
            fontSize: '0.65rem',
            fontWeight: 800,
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Drawer */}
      {isOpen && (
        <div 
          className="glass-panel animate-fade-in"
          style={{
            position: 'absolute',
            right: 0,
            top: '46px',
            width: '380px',
            maxWidth: '90vw',
            background: '#0B0F19',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '520px'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-surface)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={16} color="var(--primary)" />
              <strong style={{ fontSize: '0.9rem', color: '#FFFFFF' }}>Notifications</strong>
              {unreadCount > 0 && (
                <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>{unreadCount} new</span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface-elevated)' }}>
            <button
              onClick={() => setFilter('UNREAD')}
              style={{
                flex: 1,
                padding: '8px',
                background: filter === 'UNREAD' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                border: 'none',
                borderBottom: filter === 'UNREAD' ? '2px solid var(--primary)' : 'none',
                color: filter === 'UNREAD' ? '#FFFFFF' : 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('ALL')}
              style={{
                flex: 1,
                padding: '8px',
                background: filter === 'ALL' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                border: 'none',
                borderBottom: filter === 'ALL' ? '2px solid var(--primary)' : 'none',
                color: filter === 'ALL' ? '#FFFFFF' : 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              All Notifications
            </button>
          </div>

          {/* Notifications List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={24} color="var(--success)" style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>All caught up!</div>
                <div style={{ fontSize: '0.72rem', marginTop: '2px' }}>No unread alerts or task notifications.</div>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => !notif.is_read && handleMarkRead(notif.id)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: notif.is_read ? 'var(--bg-surface)' : 'rgba(59, 130, 246, 0.08)',
                    border: notif.is_read ? '1px solid var(--border-subtle)' : '1px solid rgba(59, 130, 246, 0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: notif.is_read ? 'var(--text-secondary)' : '#FFFFFF' }}>
                      {notif.title}
                    </div>
                    {getPriorityBadge(notif.priority)}
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
                    {notif.message}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    <span>{new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {notif.action_url && (onNavigateToEntity || onNavigateToRecord) && notif.related_entity_type && notif.related_entity_id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onNavigateToEntity) {
                              onNavigateToEntity(notif.related_entity_type!, notif.related_entity_id!);
                            } else if (onNavigateToRecord) {
                              onNavigateToRecord(notif.related_entity_type!, notif.related_entity_id!);
                            }
                            setIsOpen(false);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--primary)',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          View <ExternalLink size={10} />
                        </button>
                      )}
                      {!notif.is_read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkRead(notif.id);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: '0.68rem',
                            cursor: 'pointer'
                          }}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
