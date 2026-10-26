import React, { useState, useEffect } from 'react';
import { Mail, Send, Smartphone, RefreshCw, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { api } from '../services/api';
import type { CommunicationMessage, Lead } from '../services/api';
import { inAppAlert } from './common/InAppAlert';

interface Props {
  leads: Lead[];
  onNotify: (msg: string) => void;
}

export const OmniChannelCommsView: React.FC<Props> = ({ leads, onNotify }) => {
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);

  // Dispatch Form State
  const [channel, setChannel] = useState<'EMAIL' | 'WHATSAPP'>('EMAIL');
  const [template, setTemplate] = useState<string>('STAGE_DISCOVERY');
  const [recipient, setRecipient] = useState<string>('customer@example.sa');
  const [selectedLeadId, setSelectedLeadId] = useState<string>(leads[0]?.id || '');
  const [previewMsg, setPreviewMsg] = useState<{ subject: string; body: string; recipient_name?: string; recipient_email?: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'STAGE_EMAILS' | 'EMAIL' | 'WHATSAPP'>('ALL');

  useEffect(() => {
    loadMessages();
  }, []);

  // Synchronize selectedLeadId when leads prop arrives or updates
  useEffect(() => {
    if ((!selectedLeadId || !leads.some(l => l.id === selectedLeadId)) && leads.length > 0) {
      setSelectedLeadId(leads[0].id);
    }
  }, [leads, selectedLeadId]);

  // Update lead context & recipient when lead changes
  useEffect(() => {
    if (selectedLeadId) {
      loadLeadPreview(selectedLeadId, template);
    }
  }, [selectedLeadId, template]);

  const loadMessages = async () => {
    setLoadingMessages(true);
    try {
      const res = await api.getCommunications();
      setMessages(res.results || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadLeadPreview = async (leadId: string, templateKey: string) => {
    if (!leadId) return;
    setLoadingPreview(true);
    try {
      const isStageTemplate = templateKey.startsWith('STAGE_');
      const stageCode = isStageTemplate ? templateKey.replace('STAGE_', '') : templateKey;
      const preview = await api.getLeadStageEmailPreview(leadId, undefined, stageCode);
      if (preview) {
        setPreviewMsg({
          subject: preview.subject,
          body: preview.body,
          recipient_name: preview.recipient_name,
          recipient_email: preview.recipient_email || ''
        });
        if (channel === 'EMAIL' && preview.recipient_email) {
          setRecipient(preview.recipient_email);
        }
      }
    } catch (err) {
      // Non-critical fallback
      console.warn('Could not load dynamic preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleChannelSwitch = (newChannel: 'EMAIL' | 'WHATSAPP') => {
    setChannel(newChannel);
    if (newChannel === 'WHATSAPP') {
      if (recipient.includes('@') || !recipient.startsWith('+')) {
        setRecipient('+966509876543');
      }
    } else {
      if (previewMsg?.recipient_email) {
        setRecipient(previewMsg.recipient_email);
      } else if (recipient.startsWith('+')) {
        setRecipient('vp-operations@alrashidfood.sa');
      }
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !recipient.trim()) {
      inAppAlert.error('Please enter a recipient destination (email or phone).');
      return;
    }
    setSending(true);
    try {
      const isStageTemplate = template.startsWith('STAGE_');
      let res: any;

      if (isStageTemplate && channel === 'EMAIL' && selectedLeadId) {
        const stageCode = template.replace('STAGE_', '');
        try {
          res = await api.sendLeadStageEmail(selectedLeadId, {
            status: stageCode,
            recipient_email: recipient,
            subject: previewMsg?.subject,
            body: previewMsg?.body
          });
        } catch (apiErr: any) {
          // If lead-scoped endpoint fails, fallback to unified communications endpoint
          res = await api.sendTestCommunication({
            channel,
            recipient,
            template,
            lead_id: selectedLeadId || undefined,
            subject: previewMsg?.subject,
            body: previewMsg?.body
          });
        }

        if (res.status === 'FAILED') {
          inAppAlert.error(res.error_message || 'Stage Email delivery failed');
          onNotify(`Stage Email failed: ${res.error_message || 'Delivery error'}`);
        } else {
          onNotify(`Stage Email (${res.stage_name || stageCode}) dispatched to ${res.recipient_email || recipient}! Status: ${res.status}`);
          inAppAlert.success(`Customer Stage Email Dispatched: ${res.stage_name || stageCode}`);
        }
      } else {
        res = await api.sendTestCommunication({
          channel,
          recipient,
          template,
          lead_id: selectedLeadId || undefined,
          subject: previewMsg?.subject,
          body: previewMsg?.body
        });
        if (res.status === 'FAILED') {
          inAppAlert.error(res.error_message || 'Notification dispatch failed');
          onNotify(`Notification failed via ${res.channel}: ${res.error_message || 'Delivery error'}`);
        } else {
          onNotify(`Notification dispatched via ${res.channel}! Status: ${res.status}`);
          inAppAlert.success(`Dispatched via ${res.channel}`);
        }
      }

      await loadMessages();
    } catch (err: any) {
      inAppAlert.error(err.message || 'Notification dispatch failed');
    } finally {
      setSending(false);
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (activeFilter === 'EMAIL') return msg.channel === 'EMAIL';
    if (activeFilter === 'WHATSAPP') return msg.channel === 'WHATSAPP';
    if (activeFilter === 'STAGE_EMAILS') return msg.template_code?.startsWith('STAGE_');
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>PIPELINE STAGE AUTOMATION</span>
            <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>CUSTOMER EMAIL NOTIFICATIONS</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0 }}>
            Omni-Channel Customer Communications Hub
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0, marginTop: '4px' }}>
            Automated customer emails dispatched after completing every commercial pipeline stage (Intake, ICP, Discovery, Demo, POC, SQL, Handoff, Proposal, Negotiation, Won).
          </p>
        </div>

        <button 
          onClick={loadMessages}
          disabled={loadingMessages}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
        >
          <RefreshCw size={15} className={loadingMessages ? 'spin' : ''} />
          Refresh Outbox
        </button>
      </div>

      {/* Main Grid: Outbound Messenger + Communication Ledger */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.4fr', gap: '20px' }}>
        {/* Interactive Dispatcher & Live Stage Email Preview */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={18} color="var(--primary)" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                Stage Email Dispatcher &amp; Preview
              </h3>
            </div>
            <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
              15 Pipeline Stages
            </span>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            Preview or manually dispatch tailored B2B customer emails for any pipeline milestone.
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
                  onClick={() => handleChannelSwitch('EMAIL')}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    background: channel === 'EMAIL' ? 'rgba(79, 70, 229, 0.15)' : 'var(--bg-surface)',
                    border: channel === 'EMAIL' ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
                    color: channel === 'EMAIL' ? 'var(--primary)' : 'var(--text-secondary)',
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
                  Customer Email (SES/SMTP)
                </button>

                <button
                  type="button"
                  onClick={() => handleChannelSwitch('WHATSAPP')}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    background: channel === 'WHATSAPP' ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-surface)',
                    border: channel === 'WHATSAPP' ? '1.5px solid #10B981' : '1px solid var(--border-subtle)',
                    color: channel === 'WHATSAPP' ? '#059669' : 'var(--text-secondary)',
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
                  WhatsApp Cloud API
                </button>
              </div>
            </div>

            {/* Target Lead Context */}
            {leads.length > 0 && (
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Target Customer Account / Lead
                </label>
                <select
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)'
                  }}
                >
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.account_name} — {l.primary_product_code} ({l.current_stage_name || 'New'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Stage Notification Template Selector */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Pipeline Stage Notification Template
              </label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)'
                }}
              >
                <optgroup label="Customer Pipeline Stage Completion Emails">
                  <option value="STAGE_NEW">Stage 1: New Lead Intake Confirmation</option>
                  <option value="STAGE_ICP_CHECK">Stage 2: ICP Qualification Verified</option>
                  <option value="STAGE_CONTACTING">Stage 3: Introductory Consultation Scheduled</option>
                  <option value="STAGE_PLD_QUALIFIED">Stage 4: Problem-Led Discovery Qualified</option>
                  <option value="STAGE_DISCOVERY">Stage 5: Discovery Session Blueprint &amp; Summary</option>
                  <option value="STAGE_DEMO">Stage 6: Product Demo Recap &amp; Technical Findings</option>
                  <option value="STAGE_POC">Stage 7: POC Trial Concluded &amp; Benchmark Report</option>
                  <option value="STAGE_SQL_READY">Stage 8: SQL Readiness Gate Cleared</option>
                  <option value="STAGE_SALES_ACCEPTED">Stage 9: Enterprise AE Team Assigned</option>
                  <option value="STAGE_OPP_PROPOSAL">Stage 10: Formal Commercial Proposal Delivered</option>
                  <option value="STAGE_OPP_NEGOTIATION">Stage 11: Commercial Negotiation &amp; Terms Review</option>
                  <option value="STAGE_OPP_CLOSED_WON">Stage 12: Closed Won - Onboarding Kickoff</option>
                  <option value="STAGE_OPP_CLOSED_LOST">Stage Concluded: Closed Lost Acknowledgement</option>
                  <option value="STAGE_NURTURE">Lifecycle: Nurture &amp; Win-Back Pool Update</option>
                  <option value="STAGE_DISQUALIFIED">Lifecycle: Evaluation Fit Assessment Update</option>
                </optgroup>
                <optgroup label="Internal Operational Adapters">
                  <option value="SQL_READY">🚀 SQL_READY (Sales AE Handoff Alert)</option>
                  <option value="DEAL_PROTECTION_CONFIRMED">🛡️ DEAL_PROTECTION_CONFIRMED (Partner Exclusivity)</option>
                  <option value="POC_COMPLETED">✅ POC_COMPLETED (Trial KPIs Exceeded)</option>
                </optgroup>
              </select>
            </div>

            {/* Recipient */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {channel === 'WHATSAPP' ? 'Recipient WhatsApp Phone (E.164)' : 'Recipient Customer Email'}
                </label>
                {channel === 'EMAIL' && !previewMsg?.recipient_email && (
                  <span style={{ fontSize: '0.7rem', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={12} /> Contact email missing on lead
                  </span>
                )}
                {channel === 'EMAIL' && previewMsg?.recipient_email && (
                  <span style={{ fontSize: '0.7rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle size={12} /> Resolved from Primary Contact
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={channel === 'EMAIL' ? 'customer@company.sa' : '+966509876543'}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            {/* Live Email Preview Card */}
            {previewMsg && (
              <div style={{ 
                padding: '16px', 
                background: 'rgba(30, 41, 59, 0.75)', 
                borderRadius: '8px', 
                border: '1px solid rgba(99, 102, 241, 0.4)', 
                marginTop: '4px' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818CF8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Eye size={13} /> Live Customer Stage Email Preview
                  </span>
                  {loadingPreview && <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Updating...</span>}
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#F8FAFC', marginBottom: '8px' }}>
                  Subject: <span style={{ color: '#60A5FA' }}>{previewMsg.subject}</span>
                </div>
                <pre style={{ 
                  fontSize: '0.76rem', 
                  color: '#E2E8F0', 
                  whiteSpace: 'pre-wrap', 
                  margin: 0, 
                  fontFamily: 'inherit',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  lineHeight: 1.5,
                  padding: '10px 12px',
                  background: 'rgba(15, 23, 42, 0.65)',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  {previewMsg.body}
                </pre>
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="btn btn-primary"
              style={{ padding: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Send size={15} />
              {sending ? 'Transmitting Stage Email...' : `Dispatch Customer Stage Notification`}
            </button>
          </form>
        </div>

        {/* Communication Ledger with Filter */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                Customer Outbox &amp; Activity Log
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Chronological ledger of stage emails and external adapter notifications.
              </p>
            </div>
            <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
              {filteredMessages.length} Messages
            </span>
          </div>

          {/* Ledger Filter Tabs */}
          <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            {(['ALL', 'STAGE_EMAILS', 'EMAIL', 'WHATSAPP'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setActiveFilter(f)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: activeFilter === f ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                  color: activeFilter === f ? '#FFFFFF' : 'var(--text-secondary)'
                }}
              >
                {f === 'ALL' ? 'All Communications' : f === 'STAGE_EMAILS' ? 'Stage Emails' : f}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '580px', overflowY: 'auto' }}>
            {filteredMessages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No communication records found for this filter.
              </div>
            ) : (
              filteredMessages.map(msg => {
                const isStage = msg.template_code?.startsWith('STAGE_');
                return (
                  <div 
                    key={msg.id}
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      background: 'var(--bg-surface)',
                      border: isStage ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {msg.channel === 'WHATSAPP' ? (
                          <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem' }}>
                            <Smartphone size={11} /> WhatsApp
                          </span>
                        ) : (
                          <span className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem' }}>
                            <Mail size={11} /> Email
                          </span>
                        )}
                        {isStage && (
                          <span className="badge badge-primary" style={{ fontSize: '0.68rem' }}>
                            {msg.template_code.replace('STAGE_', 'STAGE: ')}
                          </span>
                        )}
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          {msg.recipient_name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ({msg.recipient_address})
                        </span>
                      </div>

                      <span className={`badge ${
                        msg.status === 'DELIVERED' || msg.status === 'SENT' ? 'badge-success' :
                        msg.status === 'READ' ? 'badge-info' : 'badge-danger'
                      }`} style={{ fontSize: '0.7rem' }}>
                        {msg.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#93C5FD' }}>
                      {msg.subject}
                    </div>

                    <div style={{ 
                      fontSize: '0.77rem', 
                      color: 'var(--text-secondary)', 
                      background: 'rgba(0,0,0,0.25)', 
                      padding: '10px 12px', 
                      borderRadius: '6px', 
                      whiteSpace: 'pre-wrap',
                      maxHeight: '120px',
                      overflowY: 'auto',
                      lineHeight: 1.45
                    }}>
                      {msg.body}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span>Provider: <strong style={{ color: '#E2E8F0' }}>{msg.provider}</strong></span>
                      <span>{new Date(msg.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
