import React, { useState } from 'react';
import { Building2, X, Check, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import type { Industry } from '../../services/api';
import { inAppAlert } from './InAppAlert';

interface AddIndustryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIndustryCreated: (industry: Industry) => void;
}

const POPULAR_SECTORS = [
  'Pharmaceuticals & Healthcare',
  'Automotive & Spare Parts',
  'Textiles & Apparel',
  'Consumer Electronics',
  'Chemicals & Petrochemicals',
  'Building & Construction Materials',
  'Packaging & Paper Distribution',
  'Meat & Poultry Processing',
  'Beverage Bottling & Delivery',
  'Medical Equipment & Supplies'
];

export const AddIndustryModal: React.FC<AddIndustryModalProps> = ({
  isOpen,
  onClose,
  onIndustryCreated
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Industry Name is required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const created = await api.createIndustry({
        name: name.trim(),
        code: code.trim() ? code.trim().toUpperCase() : undefined,
        description: description.trim() || undefined
      });

      inAppAlert.success(`Industry "${created.name}" created successfully!`);
      onIndustryCreated(created);

      // Reset form
      setName('');
      setCode('');
      setDescription('');
      onClose();
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to create industry. Please verify details and try again.';
      setError(errMsg);
      inAppAlert.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const derivedCode = code.trim()
    ? code.trim().toUpperCase()
    : name.trim()
      ? name.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
      : 'AUTO_DERIVED';

  return (
    <div
      className="modal-backdrop animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--bg-card, #1E293B)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
              }}
            >
              <Building2 size={20} color="#FFFFFF" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary, #F8FAFC)' }}>
                Add New Industry Sector
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)', margin: '2px 0 0' }}>
                Makes this industry available across lead intake, ICP qualification, and account profiling
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #94A3B8)',
              cursor: saving ? 'not-allowed' : 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {error && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#EF4444',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Preset Badges */}
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 600, marginBottom: '6px' }}>
              Quick Suggestions (Click to fill):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {POPULAR_SECTORS.slice(0, 6).map((sector) => (
                <button
                  key={sector}
                  type="button"
                  onClick={() => setName(sector)}
                  style={{
                    background: name === sector ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: name === sector ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                    color: name === sector ? '#10B981' : 'var(--text-secondary, #CBD5E1)',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  + {sector}
                </button>
              ))}
            </div>
          </div>

          {/* Industry Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary, #CBD5E1)', marginBottom: '6px' }}>
              Industry / Sector Name <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Pharmaceuticals & Healthcare, Automotive Parts"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'var(--bg-surface, #0F172A)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                color: 'var(--text-primary, #F8FAFC)',
                fontSize: '0.88rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Code (Optional) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary, #CBD5E1)' }}>
                System Code / Identifier <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 400 }}>(Optional)</span>
              </label>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94A3B8)', fontFamily: 'monospace' }}>
                Preview: {derivedCode}
              </span>
            </div>
            <input
              type="text"
              placeholder="e.g. PHARMACEUTICALS_HEALTHCARE (Auto-generated if empty)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'var(--bg-surface, #0F172A)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                color: 'var(--text-primary, #F8FAFC)',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary, #CBD5E1)', marginBottom: '6px' }}>
              Description / Notes <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 400 }}>(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Distributors and supply chain vendors in medical and pharmaceutical sectors"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'var(--bg-surface, #0F172A)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                color: 'var(--text-primary, #F8FAFC)',
                fontSize: '0.82rem',
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'none'
              }}
            />
          </div>

          {/* FOOTER ACTIONS */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '8px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))'
          }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
              style={{ padding: '8px 16px', fontSize: '0.82rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !name.trim()}
              style={{
                padding: '8px 20px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                borderColor: '#10B981'
              }}
            >
              {saving ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Saving Industry...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Save Industry</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
