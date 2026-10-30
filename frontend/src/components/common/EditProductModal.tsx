import React, { useState, useEffect } from 'react';
import { Package, X, Check, AlertCircle, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import type { Product } from '../../services/api';
import { inAppAlert } from './InAppAlert';

interface EditProductModalProps {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
  onProductUpdated: (product: Product) => void;
  onProductDeleted?: (productId: string) => void;
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

export const EditProductModal: React.FC<EditProductModalProps> = ({
  isOpen,
  product,
  onClose,
  onProductUpdated,
  onProductDeleted
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState(COMMON_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<string>('ACTIVE');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setCode(product.code || '');
      if (product.category && COMMON_CATEGORIES.includes(product.category)) {
        setCategory(product.category);
        setCustomCategory('');
      } else if (product.category) {
        setCategory('__CUSTOM__');
        setCustomCategory(product.category);
      } else {
        setCategory(COMMON_CATEGORIES[0]);
        setCustomCategory('');
      }
      setDescription(product.description || '');
      setStatus(product.status || 'ACTIVE');
      setConfirmDelete(false);
      setError(null);
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

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
      const updated = await api.updateProduct(product.id, {
        name: name.trim(),
        code: code.trim() ? code.trim().toUpperCase() : undefined,
        category: finalCategory || undefined,
        description: description.trim() || undefined,
        status: status
      });

      inAppAlert.success(`Product "${updated.name}" updated successfully!`);
      onProductUpdated(updated);
      onClose();
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to update product. Please verify fields and try again.';
      setError(errMsg);
      inAppAlert.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await api.deleteProduct(product.id);
      inAppAlert.success(`Product "${product.name}" deleted successfully.`);
      onProductDeleted?.(product.id);
      onClose();
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to delete product.';
      setError(errMsg);
      inAppAlert.error(errMsg);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="modal-backdrop animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving && !deleting) onClose();
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
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.05) 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)'
              }}
            >
              <Package size={20} color="#FFFFFF" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary, #F8FAFC)' }}>
                Edit Product: {product.name}
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)', margin: '2px 0 0' }}>
                Modify product details, category, code, status, and solution scope
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving || deleting}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #94A3B8)',
              cursor: saving || deleting ? 'not-allowed' : 'pointer',
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

          {/* Product Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary, #CBD5E1)', marginBottom: '6px' }}>
              Product Name <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. VanForces DSD Suite, EntAura AI"
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* System Code */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary, #CBD5E1)', marginBottom: '6px' }}>
                Product Code
              </label>
              <input
                type="text"
                placeholder="e.g. VANFORCES"
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

            {/* Status */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary, #CBD5E1)', marginBottom: '6px' }}>
                Product Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface, #0F172A)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                  color: 'var(--text-primary, #F8FAFC)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="ACTIVE">ACTIVE (Commercial)</option>
                <option value="INTERNAL">INTERNAL (Testing)</option>
                <option value="DRAFT">DRAFT (In Planning)</option>
                <option value="SUNSET">SUNSET (Maintenance)</option>
                <option value="ARCHIVED">ARCHIVED (Decommissioned)</option>
              </select>
            </div>
          </div>

          {/* Category */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary, #CBD5E1)', marginBottom: '6px' }}>
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'var(--bg-surface, #0F172A)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                color: 'var(--text-primary, #F8FAFC)',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            >
              {COMMON_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              <option value="__CUSTOM__">+ Custom Category...</option>
            </select>

            {category === '__CUSTOM__' && (
              <input
                type="text"
                placeholder="Type custom category name..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: '8px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface, #0F172A)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                  color: 'var(--text-primary, #F8FAFC)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            )}
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary, #CBD5E1)', marginBottom: '6px' }}>
              Description &amp; Solution Scope
            </label>
            <textarea
              rows={3}
              placeholder="Commercial summary of this product and core use cases..."
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
                resize: 'vertical'
              }}
            />
          </div>

          {/* FOOTER ACTIONS */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              marginTop: '8px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))'
            }}
          >
            {/* Delete Option */}
            <div>
              {confirmDelete ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="btn btn-danger"
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.78rem',
                      background: '#EF4444',
                      borderColor: '#EF4444',
                      color: '#FFFFFF'
                    }}
                  >
                    {deleting ? 'Deleting...' : 'Confirm Delete?'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={saving || deleting}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#EF4444',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Delete this product"
                >
                  <Trash2 size={14} />
                  <span>Delete Product</span>
                </button>
              )}
            </div>

            {/* Save / Cancel */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={saving || deleting}
                style={{ padding: '8px 16px', fontSize: '0.82rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || deleting || !name.trim()}
                style={{
                  padding: '8px 20px',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {saving ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
