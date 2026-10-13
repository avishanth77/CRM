import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, ShieldCheck, Server } from 'lucide-react';
import { api } from '../services/api';
import type { ERPConnectorConfig, ERPSyncRecord } from '../services/api';
import { inAppAlert } from './common/InAppAlert';
import { Modal } from './common/Modal';

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
        inAppAlert.warning(`ERP Schema Conflict Detected: ${res.conflict_details}`, 'Schema Conflict');
      } else {
        onNotify(`Account synchronized successfully! External ERP ID: ${res.erp_reference_id}`);
        inAppAlert.success(`Account synchronized successfully! ID: ${res.erp_reference_id}`);
      }
      loadData();
    } catch (err: any) {
      inAppAlert.error(err.message || 'ERP Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleResolveConflict = async () => {
    if (!resolvingRecord) return;
    try {
      const res = await api.resolveERPConflict(resolvingRecord.id, resolutionChoice);
      onNotify(`Conflict resolved via ${resolutionChoice}! Reference: ${res.erp_reference_id}`);
      inAppAlert.success(`Conflict resolved via ${resolutionChoice}!`);
      setResolvingRecord(null);
      loadData();
    } catch (err: any) {
      inAppAlert.error(err.message || 'Failed to resolve conflict');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>BI-DIRECTIONAL ERP GATEWAY</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0 }}>
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
      {connectors.length === 0 ? (
        <div className="glass-panel" style={{ padding: '28px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Server size={32} color="var(--primary)" style={{ margin: '0 auto 10px auto', opacity: 0.7 }} />
          <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>No ERP Connectors Configured</h3>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' }}>
            Bi-directional connectors for Odoo 17, SAP Business One, and MS Dynamics 365 can be configured by administrators to enable real-time ledger synchronization.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {connectors.map(c => (
            <div 
              key={c.id} 
              className="glass-panel" 
              style={{ 
                padding: '20px', 
                border: c.is_active ? '1px solid rgba(79, 70, 229, 0.4)' : '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Server size={18} color="var(--primary)" />
                  <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{c.system_name}</span>
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
                <span>Synced Records: <strong style={{ color: 'var(--text-primary)' }}>{c.sync_records_count}</strong></span>
              </div>

              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={14} color="var(--primary)" />
                <span>Auto-sync Won Opportunities: {c.auto_sync_on_won ? 'Active' : 'Disabled'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

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
                disabled={connectors.length === 0}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  marginTop: '4px'
                }}
              >
                {connectors.length === 0 ? (
                  <option value="">No ERP connectors configured</option>
                ) : (
                  connectors.map(c => (
                    <option key={c.id} value={c.id}>{c.system_name}</option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>CRM Account / Customer</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                disabled={accounts.length === 0}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  marginTop: '4px'
                }}
              >
                {accounts.length === 0 ? (
                  <option value="">No customer accounts in database</option>
                ) : (
                  accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.company_name}{a.city ? ` (${a.city})` : (a.country ? ` (${a.country})` : '')}</option>
                  ))
                )}
              </select>
            </div>

            <button
              type="submit"
              disabled={syncing || connectors.length === 0 || accounts.length === 0}
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
            {syncLogs.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                No synchronization logs recorded yet. Real-time sync transactions will appear here when accounts are pushed to external ERP endpoints.
              </div>
            ) : (
              syncLogs.map(log => (
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
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
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
                    <span>ERP Ref: <strong style={{ color: 'var(--primary)' }}>{log.erp_reference_id || 'Pending / Unassigned'}</strong></span>
                    <span>Direction: <strong>{log.direction}</strong></span>
                    <span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {log.conflict_details && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--danger)', background: 'var(--danger-bg)', padding: '8px 10px', borderRadius: '6px' }}>
                      <strong>Conflict:</strong> {log.conflict_details}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Conflict Resolution Modal */}
      <Modal
        isOpen={Boolean(resolvingRecord)}
        onClose={() => setResolvingRecord(null)}
        title="Resolve ERP Schema Conflict"
        subtitle={resolvingRecord ? `Account: ${resolvingRecord.crm_entity_name}` : undefined}
        size="md"
        footer={
          <div style={{ display: 'flex', gap: '12px', width: '100%', justifyContent: 'flex-end' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setResolvingRecord(null)}
            >
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleResolveConflict} 
              className="btn btn-primary" 
              style={{ padding: '8px 20px' }}
            >
              Apply Resolution
            </button>
          </div>
        }
      >
        {resolvingRecord && (
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Account: <strong style={{ color: 'var(--text-primary)' }}>{resolvingRecord.crm_entity_name}</strong>
            </p>

            <div style={{ padding: '12px', background: 'var(--danger-bg)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--danger)', marginBottom: '16px' }}>
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
                  background: resolutionChoice === 'CRM_WINS' ? 'var(--primary-light)' : 'var(--bg-surface)',
                  border: resolutionChoice === 'CRM_WINS' ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
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
                  background: resolutionChoice === 'ERP_WINS' ? 'var(--primary-light)' : 'var(--bg-surface)',
                  border: resolutionChoice === 'ERP_WINS' ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>ERP Wins (Pull Official ERP Ledger)</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Synchronize CRM fields to match external ERP ZATCA tax registry</div>
              </button>
            </div>

          </div>
        )}
      </Modal>
    </div>
  );
};
