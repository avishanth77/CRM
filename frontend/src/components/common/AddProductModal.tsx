import React, { useState } from 'react';
import { Package, X, Sparkles, Check, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import type { Product } from '../../services/api';
import { inAppAlert } from './InAppAlert';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductCreated: (product: Product) => void;
}

const COMMON_CATEGORIES = [
  'Van Sales & DSD',
  'Field Service & ERP',
  'Route Optimization & Logistics',
  'Supply Chain & Distribution',
  'AI & Voice Solutions',
  'Warehouse & Telematics',
  'Commercial SaaS'
];

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onProductCreated
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState(COMMON_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INTERNAL' | 'DRAFT'>('ACTIVE');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product Name is required.');
      return;
    }

    setSaving(true);
    setError(null);

    const finalCategory = category === '__CUSTOM__' ? customCategory.trim() : category;

    try {
      const created = await api.createProduct({
        name: name.trim(),
        code: code.trim() ? code.trim().toUpperCase() : undefined,
        category: finalCategory || undefined,
        description: description.trim() || undefined,
        status: status
      });

      inAppAlert.success(`Product "${created.name}" created and configured successfully!`);
      onProductCreated(created);
      
      // Reset form
      setName('');
      setCode('');
      setCategory(COMMON_CATEGORIES[0]);
      setCustomCategory('');
      setDescription('');
      setStatus('ACTIVE');
      onClose();
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to create product. Please verify fields and try again.';
      setError(errMsg);
      inAppAlert.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

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
        zIndex: 10000,
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
          maxWidth: '560px',
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
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.05) 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)'
            }}>
              <Package size={20} color="#FFFFFF" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary, #F8FAFC)' }}>
                Add New Solution Product
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)', margin: '2px 0 0' }}>
                Registers new product across ICP engine, lead intake, and catalogs
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

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto' }}>
            {error && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#F87171',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* PRODUCT NAME */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary, #CBD5E1)', display: 'block', marginBottom: '6px' }}>
                Product / Solution Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. VanForces DSD Suite, EntAura Logistics AI"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!code && e.target.value) {
                    // Optional live helper preview
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface, #0F172A)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                  color: 'var(--text-primary, #F8FAFC)',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* PRODUCT CODE */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary, #CBD5E1)' }}>
                  Product Code
                </label>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94A3B8)' }}>
                  Optional • Auto-derived if blank
                </span>
              </div>
              <input
                type="text"
                placeholder="e.g. VANFORCES, ENTAURA_AI (Auto-generated if left empty)"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface, #0F172A)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                  color: 'var(--text-primary, #F8FAFC)',
                  fontSize: '0.88rem',
                  fontFamily: 'monospace',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* CATEGORY */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary, #CBD5E1)', display: 'block', marginBottom: '6px' }}>
                Commercial Solution Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface, #0F172A)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                  color: 'var(--text-primary, #F8FAFC)',
                  fontSize: '0.88rem',
                  outline: 'none',
                  marginBottom: category === '__CUSTOM__' ? '8px' : '0',
                  boxSizing: 'border-box'
                }}
              >
                {COMMON_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="__CUSTOM__">+ Custom Category...</option>
              </select>

              {category === '__CUSTOM__' && (
                <input
                  type="text"
                  placeholder="Enter custom category name..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface, #0F172A)',
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                    color: 'var(--text-primary, #F8FAFC)',
                    fontSize: '0.84rem',
                    outline: 'none',
                    marginTop: '6px',
                    boxSizing: 'border-box'
                  }}
                />
              )}
            </div>

            {/* DESCRIPTION */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary, #CBD5E1)', display: 'block', marginBottom: '6px' }}>
                Product Description &amp; Scope
              </label>
              <textarea
                rows={3}
                placeholder="High-level product overview, core value proposition, and distribution focus..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface, #0F172A)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                  color: 'var(--text-primary, #F8FAFC)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* INITIAL STATUS */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary, #CBD5E1)', display: 'block', marginBottom: '6px' }}>
                Availability Status
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { key: 'ACTIVE', label: 'Active', desc: 'Commercial' },
                  { key: 'INTERNAL', label: 'Testing', desc: 'Presales only' },
                  { key: 'DRAFT', label: 'Draft', desc: 'In development' }
                ].map(item => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setStatus(item.key as any)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: status === item.key ? '2px solid #3B82F6' : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                      background: status === item.key ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-surface, #0F172A)',
                      color: status === item.key ? '#60A5FA' : 'var(--text-muted, #94A3B8)',
                      textAlign: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{item.label}</div>
                    <div style={{ fontSize: '0.68rem', opacity: 0.8 }}>{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* AUTOMATION NOTICE */}
            <div style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.06)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              fontSize: '0.74rem',
              color: 'var(--text-secondary, #CBD5E1)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}>
              <Sparkles size={16} color="#60A5FA" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Automatic Provisioning:</strong> Initializing this product will automatically create an initial published configuration version (v1.0) and standard ICP qualification profile so it is ready for instant use.
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            background: 'var(--bg-surface, #0F172A)'
          }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'transparent',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                color: 'var(--text-secondary, #CBD5E1)',
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                border: 'none',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)'
              }}
            >
              {saving ? (
                <>Saving Product...</>
              ) : (
                <>
                  <Check size={16} />
                  <span>Create Product</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
