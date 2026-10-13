import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Send, Sparkles, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import type { AttributionData, Product } from '../services/api';
import { inAppAlert } from './common/InAppAlert';
import { Modal } from './common/Modal';

interface Props {
  products: Product[];
  onNotify: (msg: string) => void;
}

export const MultiTouchAttributionView: React.FC<Props> = ({ products, onNotify }) => {
  const [data, setData] = useState<AttributionData | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('W_SHAPED');
  const [showWebhookModal, setShowWebhookModal] = useState<boolean>(false);

  // Webhook Simulator State
  const [whCompany, setWhCompany] = useState('Al-Safwa FMCG Logistics');
  const [whContact, setWhContact] = useState('Karim Al-Husseini');
  const [whEmail, setWhEmail] = useState('karim@alsafwa-logistics.sa');
  const [whPhone, setWhPhone] = useState('+966509876543');
  const [whProduct, setWhProduct] = useState('VANFORCES');
  const [whSource, setWhSource] = useState('google');
  const [whMedium, setWhMedium] = useState('cpc');
  const [whCampaign, setWhCampaign] = useState('CMP-2026-VAN-Q4');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    loadAttribution(selectedModel);
  }, [selectedModel]);

  const loadAttribution = async (model: string) => {
    try {
      const res = await api.getAttribution(model);
      setData(res);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSimulateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        company_name: whCompany,
        contact_name: whContact,
        email: whEmail,
        phone: whPhone,
        product_code: whProduct,
        utm_source: whSource,
        utm_medium: whMedium,
        utm_campaign: whCampaign,
        industry: 'FMCG Distribution',
        employee_count: 120
      };
      const res = await api.submitInboundLead(payload);
      onNotify(`Inbound Webhook Processed! Lead #${res.lead_id.slice(0, 8)} created. ICP Status: ${res.icp_status}`);
      inAppAlert.success(`Inbound Webhook Processed! Lead #${res.lead_id.slice(0, 8)} created.`);
      setShowWebhookModal(false);
      loadAttribution(selectedModel);
    } catch (err: any) {
      inAppAlert.error(err.message || 'Webhook simulation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const models = [
    { id: 'W_SHAPED', name: 'W-Shaped (30/30/30/10)', desc: 'Balanced: First, Lead Qual & Opp creation' },
    { id: 'FIRST_TOUCH', name: 'First-Touch (100%)', desc: 'Acquisition origination credit' },
    { id: 'LAST_TOUCH', name: 'Last-Touch (100%)', desc: 'Pre-conversion trigger credit' },
    { id: 'LINEAR', name: 'Linear (Equal Split)', desc: 'Uniform weighting across all touches' },
    { id: 'PARTNER_WEIGHTED', name: 'Partner-Weighted (60/40)', desc: '60% to registered partner touches' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>SPEC SECTION 9.1 &amp; OD-05</span>
            <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>OMNI-CHANNEL LEDGER</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0 }}>
            Multi-Touch Campaign Attribution
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0, marginTop: '4px' }}>
            Algorithmic attribution engine analyzing touchpoints, channel contribution, and revenue conversion.
          </p>
        </div>

        <button 
          onClick={() => setShowWebhookModal(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px' }}
        >
          <Send size={16} />
          Simulate Inbound Campaign Webhook
        </button>
      </div>

      {/* Attribution Model Selector */}
      <div className="glass-panel" style={{ padding: '16px 20px', border: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>
          Select Dynamic Attribution Algorithm
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          {models.map(m => {
            const active = selectedModel === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedModel(m.id)}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: active ? 'var(--primary-light)' : 'var(--bg-surface)',
                  border: active ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: active ? 'var(--primary)' : 'var(--text-primary)' }}>
                  {m.name}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {m.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Summary Cards */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
              <span>TOTAL CAMPAIGN BUDGET</span>
              <DollarSign size={16} color="var(--primary)" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: 'var(--text-primary)' }}>
              ${data.summary.total_budget.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Allocated across active programs
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
              <span>RECORDED AD SPEND</span>
              <TrendingUp size={16} color="#EAB308" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: 'var(--text-primary)' }}>
              ${data.summary.total_spent.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Spend utilization: {Math.round((data.summary.total_spent / (data.summary.total_budget || 1)) * 100)}%
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
              <span>ATTRIBUTED WON REVENUE</span>
              <CheckCircle2 size={16} color="var(--success)" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: 'var(--success)' }}>
              ${data.summary.total_attributed_revenue.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Contract value closed from campaign touches
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
              <span>BLENDED CAMPAIGN ROAS</span>
              <Sparkles size={16} color="var(--primary)" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: '#60A5FA' }}>
              {data.summary.blended_roas}x
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Return on ad spend across model
            </div>
          </div>
        </div>
      )}

      {/* Campaigns Table & Channel Visualizer */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Campaign Breakdown Table */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Campaign Performance Ledger</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 8px' }}>Campaign</th>
                  <th style={{ padding: '10px 8px' }}>Channel</th>
                  <th style={{ padding: '10px 8px' }}>Spent</th>
                  <th style={{ padding: '10px 8px' }}>Attributed Pipeline</th>
                  <th style={{ padding: '10px 8px' }}>Attributed Revenue</th>
                  <th style={{ padding: '10px 8px' }}>ROAS</th>
                </tr>
              </thead>
              <tbody>
                {data?.campaigns.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{c.campaign_code}</div>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>{c.channel}</span>
                    </td>
                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>${c.spent.toLocaleString()}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--primary)' }}>${c.attributed_pipeline.toLocaleString()}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--success)', fontWeight: 700 }}>${c.attributed_revenue.toLocaleString()}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span className={`badge ${c.roas >= 2.0 ? 'badge-success' : (c.roas > 0 ? 'badge-info' : 'badge-neutral')}`}>
                        {c.roas}x
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Channel Breakdown Visualizer */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Channel Revenue Contribution</h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Pipeline attributed by customer touchpoint channel under <strong style={{ color: 'var(--text-primary)' }}>{selectedModel}</strong>.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, justifyContent: 'center' }}>
            {data?.channel_breakdown.map((ch, idx) => {
              const maxVal = Math.max(...data.channel_breakdown.map(x => x.attributed_pipeline), 1);
              const pct = Math.round((ch.attributed_pipeline / maxVal) * 100);
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ch.channel}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>${ch.attributed_pipeline.toLocaleString()}</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${Math.max(5, pct)}%`, 
                        height: '100%', 
                        background: 'linear-gradient(90deg, #3B82F6 0%, #60A5FA 100%)', 
                        borderRadius: '4px',
                        transition: 'width 0.5s ease'
                      }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Inbound Webhook Simulator Modal */}
      <Modal
        isOpen={showWebhookModal}
        onClose={() => setShowWebhookModal(false)}
        title="Simulate Inbound Campaign Webhook"
        subtitle="Emulates external form submit (LinkedIn / Google Ads / Landing Page)"
        size="md"
        footer={
          <div style={{ display: 'flex', gap: '12px', width: '100%', justifyContent: 'flex-end' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setShowWebhookModal(false)}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              form="simulate-webhook-form"
              disabled={submitting} 
              className="btn btn-primary" 
              style={{ padding: '8px 20px' }}
            >
              {submitting ? 'Triggering Inbound Webhook...' : 'Fire Webhook & Evaluate ICP'}
            </button>
          </div>
        }
      >
        <form id="simulate-webhook-form" onSubmit={handleSimulateWebhook} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Prospect Company Name</label>
            <input 
              type="text" 
              required
              value={whCompany}
              onChange={(e) => setWhCompany(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                marginTop: '4px'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Key Contact Name</label>
              <input 
                type="text" 
                required
                value={whContact}
                onChange={(e) => setWhContact(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  marginTop: '4px'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Target Product</label>
              <select
                value={whProduct}
                onChange={(e) => setWhProduct(e.target.value)}
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
                {products.map(p => (
                  <option key={p.id} value={p.code}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</label>
              <input 
                type="email" 
                required
                value={whEmail}
                onChange={(e) => setWhEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  marginTop: '4px'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>WhatsApp / Phone</label>
              <input 
                type="text" 
                value={whPhone}
                onChange={(e) => setWhPhone(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  marginTop: '4px'
                }}
              />
            </div>
          </div>

          {/* UTM Tracking Fields */}
          <div style={{ padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              UTM Ingestion Tags
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>utm_source</label>
                <input 
                  type="text" 
                  value={whSource}
                  onChange={(e) => setWhSource(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>utm_medium</label>
                <input 
                  type="text" 
                  value={whMedium}
                  onChange={(e) => setWhMedium(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>utm_campaign</label>
                <input 
                  type="text" 
                  value={whCampaign}
                  onChange={(e) => setWhCampaign(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                />
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
