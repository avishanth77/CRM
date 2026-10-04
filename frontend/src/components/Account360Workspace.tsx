import React, { useState, useEffect } from 'react';
import { 
  Phone, Globe, MapPin, 
  Search, RefreshCw, Briefcase
} from 'lucide-react';
import { api } from '../services/api';
import { UnifiedActivityTimeline } from './UnifiedActivityTimeline';

interface Account360WorkspaceProps {
  initialAccountId?: string;
  onNavigateToOpportunity?: (oppId: string) => void;
}

export const Account360Workspace: React.FC<Account360WorkspaceProps> = ({
  initialAccountId,
  onNavigateToOpportunity
}) => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccountId || '');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (initialAccountId) {
      setSelectedAccountId(initialAccountId);
    }
  }, [initialAccountId]);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.getAccounts();
      const list = res.results || [];
      setAccounts(list);
      if (list.length > 0 && !selectedAccountId) {
        setSelectedAccountId(initialAccountId || list[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = accounts.find(a => a.id === selectedAccountId) || accounts[0];

  const filteredAccounts = accounts.filter(a => 
    a.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.industry?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getNextActionVisualState = (acc: any) => {
    if (!acc.next_action_description && !acc.next_activity_due_at) {
      return { label: 'No Next Action', color: 'var(--danger)', bg: 'rgba(239, 68, 68, 0.12)' };
    }
    if (acc.next_activity_due_at) {
      const dueDate = new Date(acc.next_activity_due_at);
      const now = new Date();
      const diffHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (diffHours < 0) {
        return { label: 'Overdue', color: 'var(--danger)', bg: 'rgba(239, 68, 68, 0.15)' };
      }
      if (diffHours <= 24) {
        return { label: 'Due Today', color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.15)' };
      }
      if (diffHours <= 72) {
        return { label: 'Due Soon', color: 'var(--accent-cyan)', bg: 'rgba(6, 182, 212, 0.12)' };
      }
    }
    return { label: 'Scheduled', color: 'var(--success)', bg: 'rgba(16, 185, 129, 0.12)' };
  };

  if (loading && accounts.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <RefreshCw className="animate-spin" size={28} style={{ margin: '0 auto 12px auto', color: 'var(--primary)' }} />
        <div style={{ fontWeight: 600 }}>Loading Account 360 Workspace...</div>
      </div>
    );
  }

  const nextActionState = selectedAccount ? getNextActionVisualState(selectedAccount) : null;

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '24px', alignItems: 'start' }}>
      
      {/* LEFT: ACCOUNT SELECTOR LIST */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Account 360</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Enterprise customer & prospect accounts</p>
          </div>
          <span className="badge badge-neutral">{accounts.length} Total</span>
        </div>

        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '6px 12px'
        }}>
          <Search size={14} color="var(--text-muted)" />
          <input 
            type="text"
            placeholder="Search accounts or industry..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '0.8rem',
              outline: 'none',
              width: '100%'
            }}
          />
        </div>

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '720px', overflowY: 'auto' }}>
          {filteredAccounts.map(acc => {
            const isSelected = selectedAccountId === acc.id;
            const itemState = getNextActionVisualState(acc);
            return (
              <div
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#FFFFFF' }}>{acc.company_name}</div>
                  {acc.is_target_account && (
                    <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>TARGET</span>
                  )}
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <span>{acc.industry || 'Enterprise'}</span>
                  <span>•</span>
                  <span>{acc.city || acc.country || 'GCC'}</span>
                </div>

                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    color: itemState.color,
                    background: itemState.bg
                  }}>
                    {itemState.label}
                  </span>
                  {acc.primary_owner_name && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Owner: {acc.primary_owner_name}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT: ACCOUNT 360 PROFILE & UNIFIED TIMELINE */}
      {selectedAccount ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Header Card */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span className="badge badge-info">{selectedAccount.account_type || 'PROSPECT'}</span>
                  {selectedAccount.is_target_account && (
                    <span className="badge badge-warning">{selectedAccount.target_tier || 'TIER 1 TARGET'}</span>
                  )}
                  {selectedAccount.partner_name && (
                    <span className="badge badge-neutral">Partner: {selectedAccount.partner_name}</span>
                  )}
                </div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                  {selectedAccount.company_name}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {selectedAccount.website && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Globe size={13} /> {selectedAccount.website}
                    </span>
                  )}
                  {selectedAccount.phone && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Phone size={13} /> {selectedAccount.phone}
                    </span>
                  )}
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={13} /> {selectedAccount.city || 'Riyadh'}, {selectedAccount.country || 'Saudi Arabia'}
                  </span>
                  {onNavigateToOpportunity && (
                    <button 
                      className="btn btn-outline"
                      onClick={() => onNavigateToOpportunity('')}
                      style={{ fontSize: '0.72rem', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Briefcase size={12} /> Opportunities
                    </button>
                  )}
                </div>
              </div>

              {/* Next Action Visual Card */}
              <div style={{
                background: 'var(--bg-surface-elevated)',
                padding: '14px 18px',
                borderRadius: '12px',
                border: `1px solid ${nextActionState?.color || 'var(--border-subtle)'}`,
                minWidth: '240px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Next Action State
                  </span>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    color: nextActionState?.color,
                    background: nextActionState?.bg
                  }}>
                    {nextActionState?.label}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#FFFFFF', marginTop: '4px' }}>
                  {selectedAccount.next_action_description || 'No future action defined'}
                </div>
                {selectedAccount.next_activity_due_at && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Due: {new Date(selectedAccount.next_activity_due_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stat Bar */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)'
            }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>EMPLOYEES</div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#FFFFFF' }}>{selectedAccount.employees_count || 100}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>DISTRIBUTION CENTERS</div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#FFFFFF' }}>{selectedAccount.distribution_centers_count || 1}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>LAST ACTIVITY</div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#FFFFFF' }}>
                  {selectedAccount.last_activity_at ? new Date(selectedAccount.last_activity_at).toLocaleDateString() : 'None Recorded'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PRIMARY OWNER</div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#FFFFFF' }}>
                  {selectedAccount.primary_owner_name || 'Commercial Team'}
                </div>
              </div>
            </div>

            {/* Contacts Pill Row */}
            {selectedAccount.contacts && selectedAccount.contacts.length > 0 && (
              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Contacts:</span>
                {selectedAccount.contacts.map((c: any) => (
                  <span key={c.id} style={{
                    fontSize: '0.72rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    color: 'var(--text-primary)'
                  }}>
                    {c.first_name} {c.last_name} ({c.designation || 'Key Stakeholder'})
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Unified Timeline for the Account */}
          <UnifiedActivityTimeline 
            relatedEntity={{
              type: 'account',
              id: selectedAccount.id,
              name: selectedAccount.company_name,
              accountId: selectedAccount.id
            }}
            onActivityLogged={loadAccounts}
          />
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Select an account to view Account 360 profile and interaction timeline.
        </div>
      )}
    </div>
  );
};
