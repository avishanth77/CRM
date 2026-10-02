import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, ShieldCheck, Server } from 'lucide-react';
import { api } from '../services/api';
import type { ERPConnectorConfig, ERPSyncRecord } from '../services/api';

interface Props {
  accounts: any[];
  onNotify: (msg: string) => void;
}

export const ERPSyncGatewayView: React.FC<Props> = ({ accounts, onNotify }) => {
  const [connectors, setConnectors] = useState<ERPConnectorConfig[]>([]);
  const [syncLogs, setSyncLogs] = useState<ERPSyncRecord[]>([]);
  const [syncing, setSyncing] = useState<boolean>(false);

  // Sync Form State
  const [selectedConnectorId, setSelectedConnectorId] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  
  // Conflict Resolution Modal
  const [resolvingRecord, setResolvingRecord] = useState<ERPSyncRecord | null>(null);
  const [resolutionChoice, setResolutionChoice] = useState<string>('CRM_WINS');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [cRes, lRes] = await Promise.all([
        api.getERPConnectors(),
        api.getERPSyncLogs()
      ]);
      setConnectors(cRes.results || []);
      setSyncLogs(lRes.results || []);
      if (cRes.results?.length > 0 && !selectedConnectorId) {
        setSelectedConnectorId(cRes.results[0].id);
      }
      if (accounts?.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accounts[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePushAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConnectorId) return;
    setSyncing(true);
    try {
      const res = await api.syncAccountToERP(selectedConnectorId, selectedAccountId || undefined);
      if (res.status === 'CONFLICT_DETECTED') {
        onNotify(`ERP Schema Conflict Detected: ${res.conflict_details}`);
      } else {
        onNotify(`Account synchronized successfully! External ERP ID: ${res.erp_reference_id}`);
      }
      loadData();
    } catch (err: any) {
      alert(err.message || 'ERP Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleResolveConflict = async () => {
    if (!resolvingRecord) return;
    try {
      const res = await api.resolveERPConflict(resolvingRecord.id, resolutionChoice);
      onNotify(`Conflict resolved via ${resolutionChoice}! Reference: ${res.erp_reference_id}`);
      setResolvingRecord(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to resolve conflict');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>SPEC SECTION 3.1 &amp; PHASE 5</span>
            <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>BI-DIRECTIONAL ERP GATEWAY</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF', margin: 0 }}>
            ERP Customer Master Integration
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0, marginTop: '4px' }}>
            Bi-directional synchronization connectors for Odoo, SAP Business One, and MS Dynamics 365.
          </p>
        </div>

        <button 
          onClick={loadData}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
        >
          <RefreshCw size={15} />
          Refresh Connector Status
        </button>
      </div>

      {/* Connected ERP Systems Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {connectors.map(c => (
          <div 
            key={c.id} 
            className="glass-panel" 
            style={{ 
              padding: '20px', 
              border: c.is_active ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={18} color="var(--primary)" />
                <span style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.95rem' }}>{c.system_name}</span>
              </div>
              <span className={`badge ${c.is_active ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.7rem' }}>
                {c.is_active ? 'CONNECTED' : 'STANDBY'}
              </span>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {c.base_endpoint}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <span>Auth: <strong>{c.auth_mode}</strong></span>
              <span>Synced Records: <strong style={{ color: '#FFFFFF' }}>{c.sync_records_count}</strong></span>
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={14} color="var(--primary)" />
              <span>Auto-sync Won Opportunities: {c.auto_sync_on_won ? 'Active' : 'Disabled'}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid: Trigger Sync Form + Audit Sync Ledger */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '20px' }}>
        {/* Trigger Sync Form */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
              Trigger ERP Customer Sync
            </h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            Pushes verified CRM Account data to the external ERP system master ledger.
          </p>

          <form onSubmit={handlePushAccount} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Target ERP System</label>
              <select
                value={selectedConnectorId}
                onChange={(e) => setSelectedConnectorId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: '#FFFFFF',
                  marginTop: '4px'
                }}
              >
                {connectors.map(c => (
                  <option key={c.id} value={c.id}>{c.system_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>CRM Account / Customer</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: '#FFFFFF',
                  marginTop: '4px'
                }}
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.company_name} ({a.city || 'Riyadh'})</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={syncing}
              className="btn btn-primary"
              style={{ padding: '12px', marginTop: '6px' }}
            >
              {syncing ? 'Pushing to ERP...' : 'Execute ERP Master Sync'}
            </button>
          </form>
        </div>

        {/* Sync Audit Ledger */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
              Bi-Directional Sync Audit Ledger
            </h3>
            <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
              {syncLogs.length} Sync Logs
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '550px', overflowY: 'auto' }}>
            {syncLogs.map(log => (
              <div 
                key={log.id}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: 'var(--bg-surface)',
                  border: log.status === 'CONFLICT_DETECTED' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#FFFFFF' }}>
                      {log.crm_entity_name}
                    </span>
                    <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                      {log.system_name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`badge ${log.status === 'SUCCESS' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                      {log.status}
                    </span>

                    {log.status === 'CONFLICT_DETECTED' && (
                      <button
                        onClick={() => setResolvingRecord(log)}
                        className="btn btn-warning"
                        style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                      >
                        Resolve Conflict
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>ERP Ref: <strong style={{ color: '#93C5FD' }}>{log.erp_reference_id || 'Pending / Unassigned'}</strong></span>
                  <span>Direction: <strong>{log.direction}</strong></span>
                  <span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {log.conflict_details && (
                  <div style={{ fontSize: '0.75rem', color: '#FCA5A5', background: 'rgba(239, 68, 68, 0.1)', padding: '8px 10px', borderRadius: '6px' }}>
                    <strong>Conflict:</strong> {log.conflict_details}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Conflict Resolution Modal */}
      {resolvingRecord && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-panel" style={{ width: '500px', padding: '32px', border: '1px solid var(--border-focus)' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, marginBottom: '8px' }}>
              Resolve ERP Schema Conflict
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Account: <strong style={{ color: '#FFFFFF' }}>{resolvingRecord.crm_entity_name}</strong>
            </p>

            <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', fontSize: '0.78rem', color: '#FCA5A5', marginBottom: '16px' }}>
              {resolvingRecord.conflict_details}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Resolution Strategy
              </label>

              <button
                type="button"
                onClick={() => setResolutionChoice('CRM_WINS')}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: resolutionChoice === 'CRM_WINS' ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-surface)',
                  border: resolutionChoice === 'CRM_WINS' ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
                  color: '#FFFFFF',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>CRM Wins (Override ERP Master)</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Force update external ERP record using verified CRM tax and billing address</div>
              </button>

              <button
                type="button"
                onClick={() => setResolutionChoice('ERP_WINS')}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: resolutionChoice === 'ERP_WINS' ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-surface)',
                  border: resolutionChoice === 'ERP_WINS' ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
                  color: '#FFFFFF',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>ERP Wins (Pull Official ERP Ledger)</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Synchronize CRM fields to match external ERP ZATCA tax registry</div>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="button" 
                onClick={handleResolveConflict} 
                className="btn btn-primary" 
                style={{ flex: 1, padding: '12px' }}
              >
                Apply Resolution
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setResolvingRecord(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
