import React, { useState, useEffect } from 'react';
import { Mail, Send, Smartphone, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import type { CommunicationMessage, Lead } from '../services/api';

interface Props {
  leads: Lead[];
  onNotify: (msg: string) => void;
}

export const OmniChannelCommsView: React.FC<Props> = ({ leads, onNotify }) => {
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [sending, setSending] = useState<boolean>(false);

  // Dispatch Form State
  const [channel, setChannel] = useState<'EMAIL' | 'WHATSAPP'>('WHATSAPP');
  const [template, setTemplate] = useState<string>('SQL_READY');
  const [recipient, setRecipient] = useState<string>('+966509876543');
  const [selectedLeadId, setSelectedLeadId] = useState<string>(leads[0]?.id || '');
  const [previewMsg, setPreviewMsg] = useState<string | null>(null);

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    if (channel === 'EMAIL' && recipient.startsWith('+')) {
      setRecipient('vp-operations@alrashidfood.sa');
    } else if (channel === 'WHATSAPP' && recipient.includes('@')) {
      setRecipient('+966509876543');
    }
  }, [channel]);

  const loadMessages = async () => {
    try {
      const res = await api.getCommunications();
      setMessages(res.results || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await api.sendTestCommunication({
        channel,
        recipient,
        template,
        lead_id: selectedLeadId || undefined
      });
      onNotify(`Notification dispatched via ${res.channel}! Status: ${res.status}`);
      setPreviewMsg(res.body);
      loadMessages();
    } catch (err: any) {
      alert(err.message || 'Notification dispatch failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>SPEC SECTION 14 &amp; 17</span>
            <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>EMAIL &amp; WHATSAPP ADAPTERS</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF', margin: 0 }}>
            Omni-Channel Communications Hub
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0, marginTop: '4px' }}>
            Pluggable adapter notifications for real-time stage gate alerts, SQL assignments, and partner updates.
          </p>
        </div>

        <button 
          onClick={loadMessages}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
        >
          <RefreshCw size={15} />
          Refresh Outbox
        </button>
      </div>

      {/* Main Grid: Outbound Messenger + Communication Ledger */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
        {/* Interactive Dispatcher */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Send size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
              Dispatch Adapter Notification
            </h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            Simulate real-time external communications delivered to commercial stakeholders or partners.
          </p>

          <form onSubmit={handleSendNotification} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Channel Toggle */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Delivery Channel
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setChannel('WHATSAPP')}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    background: channel === 'WHATSAPP' ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-surface)',
                    border: channel === 'WHATSAPP' ? '1.5px solid #10B981' : '1px solid var(--border-subtle)',
                    color: channel === 'WHATSAPP' ? '#34D399' : '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Smartphone size={16} />
                  WhatsApp Cloud
                </button>

                <button
                  type="button"
                  onClick={() => setChannel('EMAIL')}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    background: channel === 'EMAIL' ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-surface)',
                    border: channel === 'EMAIL' ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
                    color: channel === 'EMAIL' ? '#60A5FA' : '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Mail size={16} />
                  Email (SES/SMTP)
                </button>
              </div>
            </div>

            {/* Template Selector */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Event Notification Template</label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
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
                <option value="SQL_READY">🚀 SQL_READY (Sales AE Handoff Alert)</option>
                <option value="DEAL_PROTECTION_CONFIRMED">🛡️ DEAL_PROTECTION_CONFIRMED (Partner Exclusivity)</option>
                <option value="POC_COMPLETED">✅ POC_COMPLETED (Trial KPIs Exceeded)</option>
              </select>
            </div>

            {/* Recipient */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {channel === 'WHATSAPP' ? 'Recipient WhatsApp Phone (E.164)' : 'Recipient Email Address'}
              </label>
              <input
                type="text"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: '#FFFFFF',
                  marginTop: '4px'
                }}
              />
            </div>

            {/* Target Lead Context */}
            {leads.length > 0 && (
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Context Lead Entity</label>
                <select
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
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
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>{l.account_name} ({l.primary_product_code})</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="btn btn-primary"
              style={{ padding: '12px', marginTop: '6px' }}
            >
              {sending ? 'Transmitting via Adapter...' : `Send Outbound ${channel}`}
            </button>
          </form>

          {previewMsg && (
            <div style={{ padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginTop: '8px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Latest Adapter Output Preview
              </div>
              <pre style={{ fontSize: '0.75rem', color: '#E2E8F0', whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'monospace' }}>
                {previewMsg}
              </pre>
            </div>
          )}
        </div>

        {/* Communication Ledger */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
              Adapter Delivery Log
            </h3>
            <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
              {messages.length} Messages Logged
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '550px', overflowY: 'auto' }}>
            {messages.map(msg => (
              <div 
                key={msg.id}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {msg.channel === 'WHATSAPP' ? (
                      <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Smartphone size={12} /> WhatsApp
                      </span>
                    ) : (
                      <span className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Mail size={12} /> Email
                      </span>
                    )}
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#FFFFFF' }}>
                      {msg.recipient_name}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      ({msg.recipient_address})
                    </span>
                  </div>

                  <span className={`badge ${msg.status === 'READ' ? 'badge-success' : (msg.status === 'DELIVERED' ? 'badge-info' : 'badge-neutral')}`} style={{ fontSize: '0.7rem' }}>
                    {msg.status}
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#93C5FD' }}>
                  {msg.subject}
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>
                  {msg.body}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  <span>Provider: <strong style={{ color: '#E2E8F0' }}>{msg.provider}</strong></span>
                  <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
