import React, { useState } from 'react';
import { Printer, Download, X, Edit3, CheckCircle2, ShieldCheck, Building, Calendar, DollarSign } from 'lucide-react';
import type { Opportunity, Proposal, ProposalVersion } from '../services/api';

interface CommercialInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunity?: Opportunity | null;
  proposal?: Proposal | null;
  version?: ProposalVersion | null;
}

export const CommercialInvoiceModal: React.FC<CommercialInvoiceModalProps> = ({
  isOpen,
  onClose,
  opportunity,
  proposal,
  version
}) => {
  if (!isOpen) return null;

  // Extract initial values from opportunity or proposal
  const targetOpp = opportunity;
  const targetProp = proposal;
  const targetVersion = version || targetProp?.versions?.[0];

  const defaultCurrency = targetVersion?.currency || targetOpp?.currency || 'USD';
  const defaultSeats = Number(
    targetVersion?.items?.[0]?.quantity ||
    targetOpp?.seat_units_count ||
    1
  );

  const defaultTcv = Number(
    targetVersion?.gross_amount ||
    targetOpp?.total_contract_value ||
    50000
  );

  const defaultUnitPrice = Number(
    targetVersion?.items?.[0]?.unit_price ||
    (defaultTcv > 0 ? Math.round(defaultTcv / defaultSeats) : 10000)
  );

  const defaultDiscountPct = Number(
    targetVersion?.discount_pct || 0
  );

  const defaultTaxPct = Number(
    targetVersion?.tax_pct || 15
  );

  // Editable invoice state
  const [isEditing, setIsEditing] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState(
    `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [paymentTerms, setPaymentTerms] = useState(
    targetVersion?.payment_terms || 'Net 30 Days from Invoice Date'
  );
  const [itemDescription, setItemDescription] = useState(
    targetVersion?.items?.[0]?.description ||
    `${targetOpp?.product_name || 'VanForces PLD Suite'} Enterprise Annual Subscription`
  );
  const [quantity, setQuantity] = useState(defaultSeats);
  const [unitPrice, setUnitPrice] = useState(defaultUnitPrice);
  const [discountPct, setDiscountPct] = useState(defaultDiscountPct);
  const [taxPct, setTaxPct] = useState(defaultTaxPct);
  const [contractTerm, setContractTerm] = useState(
    targetVersion?.contract_term_months || targetOpp?.contract_term_months || 12
  );

  // Financial calculations
  const grossSubtotal = quantity * unitPrice;
  const discountAmount = Math.round((grossSubtotal * (discountPct / 100)) * 100) / 100;
  const netTaxable = Math.max(0, grossSubtotal - discountAmount);
  const taxAmount = Math.round((netTaxable * (taxPct / 100)) * 100) / 100;
  const grandTotal = Math.round((netTaxable + taxAmount) * 100) / 100;

  const handlePrint = () => {
    window.print();
  };

  const accountName = targetOpp?.account_name || targetProp?.account_name || 'Client Corporation';
  const contactName = targetOpp?.primary_contact_name || targetProp?.primary_contact_name || 'Authorized Buyer';
  const productName = targetOpp?.product_name || targetProp?.product_name || 'VanForces Suite';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px',
        overflowY: 'auto'
      }}
    >
      {/* Print Specific CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-commercial-invoice, #printable-commercial-invoice * {
            visibility: visible !important;
          }
          #printable-commercial-invoice {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            background: #FFFFFF !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .no-print-area {
            display: none !important;
          }
        }
      `}</style>

      {/* Top Modal Controls Header (Not Printed) */}
      <div
        className="no-print-area glass-panel"
        style={{
          width: '100%',
          maxWidth: '850px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 20px',
          marginBottom: '16px',
          background: 'var(--bg-surface-elevated)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
            <Printer size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
              Final Commercial Tax Invoice
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Official Tax Invoice for {accountName} • Negotiated Commercial Terms
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="btn btn-outline"
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            <Edit3 size={14} />
            {isEditing ? 'Preview Layout' : 'Quick Adjust'}
          </button>

          <button
            onClick={handlePrint}
            className="btn btn-primary"
            style={{
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              borderColor: '#059669',
              fontSize: '0.82rem',
              padding: '6px 16px',
              boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)'
            }}
          >
            <Printer size={15} />
            Print Invoice
          </button>

          <button
            onClick={onClose}
            className="btn btn-outline"
            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Quick Adjust Settings Drawer (Not Printed) */}
      {isEditing && (
        <div
          className="no-print-area glass-panel"
          style={{
            width: '100%',
            maxWidth: '850px',
            padding: '16px 20px',
            marginBottom: '16px',
            background: 'var(--bg-surface)',
            borderRadius: '12px',
            border: '1px solid var(--primary)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            fontSize: '0.8rem'
          }}
        >
          <div>
            <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Invoice Number
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="form-input"
              style={{ width: '100%', padding: '6px 10px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Invoice Date
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="form-input"
              style={{ width: '100%', padding: '6px 10px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="form-input"
              style={{ width: '100%', padding: '6px 10px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 700, color: 'var(--primary)', marginBottom: '4px' }}>
              Required Quantity (Seats) *
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="form-input"
              style={{ width: '100%', padding: '6px 10px', borderColor: 'var(--primary)', fontWeight: 700 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Unit Price ({defaultCurrency})
            </label>
            <input
              type="number"
              min="0"
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
              className="form-input"
              style={{ width: '100%', padding: '6px 10px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Discount (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={discountPct}
              onChange={(e) => setDiscountPct(Number(e.target.value))}
              className="form-input"
              style={{ width: '100%', padding: '6px 10px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              VAT / Tax (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={taxPct}
              onChange={(e) => setTaxPct(Number(e.target.value))}
              className="form-input"
              style={{ width: '100%', padding: '6px 10px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Payment Terms
            </label>
            <input
              type="text"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="form-input"
              style={{ width: '100%', padding: '6px 10px' }}
            />
          </div>
        </div>
      )}

      {/* PRINTABLE INVOICE SHEET (A4 Standard View) */}
      <div
        id="printable-commercial-invoice"
        style={{
          width: '100%',
          maxWidth: '850px',
          background: '#FFFFFF',
          color: '#111827',
          padding: '40px 48px',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          lineHeight: 1.5,
          position: 'relative'
        }}
      >
        {/* Top Header & Logo Area */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #E5E7EB', paddingBottom: '24px', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '36px', height: '36px', background: '#2563EB', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 900, fontSize: '18px' }}>
                T
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em', color: '#1E293B' }}>
                  TEXOL INFORMATION TECHNOLOGY
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Enterprise Software Systems &amp; PLD Cloud Solutions
                </div>
              </div>
            </div>

            <div style={{ marginTop: '12px', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
              <div>Commercial Registration: <strong>1010892341</strong></div>
              <div>VAT Identification Number: <strong>310294857200003</strong></div>
              <div>King Fahd Road, Al Olaya District, Riyadh, Kingdom of Saudi Arabia</div>
              <div>Billing Inquiry: billing@texol.sa • Web: www.texol.sa</div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-block', padding: '6px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', color: '#1D4ED8', fontWeight: 800, fontSize: '14px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              TAX INVOICE / فاتورة ضريبية
            </div>
            <div style={{ marginTop: '12px', fontSize: '13px', color: '#1E293B' }}>
              <div>Invoice No: <strong style={{ fontSize: '15px', color: '#0F172A' }}>{invoiceNumber}</strong></div>
              <div>Invoice Date: <strong>{invoiceDate}</strong></div>
              <div>Payment Due Date: <strong>{dueDate}</strong></div>
              <div>Deal Ref: <strong>#{targetOpp?.id ? targetOpp.id.substring(0, 8) : 'TEX-2026'}</strong></div>
            </div>
          </div>
        </div>

        {/* Bill To & Deal Context */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px', background: '#F8FAFC', padding: '16px 20px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              BILLED TO (CLIENT / CUSTOMER)
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
              {accountName}
            </div>
            <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px', lineHeight: 1.5 }}>
              <div>Attention: <strong>{contactName}</strong></div>
              <div>Primary Contact Email: {targetOpp?.primary_contact_email || `${accountName.toLowerCase().replace(/\s+/g, '')}@client.com`}</div>
              <div>Contract Term: <strong>{contractTerm} Months</strong></div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              NEGOTIATION &amp; COMMERCIAL TERMS
            </div>
            <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>
              <div>Commercial Stage: <strong style={{ color: '#10B981' }}>Final Negotiated &amp; Agreed</strong></div>
              <div>Payment Terms: <strong>{paymentTerms}</strong></div>
              <div>Currency: <strong>{defaultCurrency}</strong></div>
              <div>Deployment Type: <strong>Enterprise Cloud SaaS</strong></div>
            </div>
          </div>
        </div>

        {/* Itemized Line Items Table */}
        <div style={{ marginBottom: '28px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#1E293B', color: '#FFFFFF' }}>
                <th style={{ padding: '10px 14px', borderRadius: '6px 0 0 0', fontWeight: 700 }}>#</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Description &amp; License Scope</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>Qty</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>Unit Price</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>Disc %</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', borderRadius: '0 6px 0 0', fontWeight: 700 }}>Total ({defaultCurrency})</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                <td style={{ padding: '14px', color: '#64748B', fontWeight: 600 }}>01</td>
                <td style={{ padding: '14px' }}>
                  <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '14px' }}>
                    {productName}
                  </div>
                  <div style={{ color: '#475569', fontSize: '12px', marginTop: '2px' }}>
                    {itemDescription} ({contractTerm} Months Deployment)
                  </div>
                </td>
                <td style={{ padding: '14px', textAlign: 'right', fontWeight: 800, color: '#0F172A', fontSize: '14px' }}>
                  {quantity}
                </td>
                <td style={{ padding: '14px', textAlign: 'right', color: '#334155', fontWeight: 600 }}>
                  {defaultCurrency} {unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '14px', textAlign: 'right', color: discountPct > 0 ? '#DC2626' : '#64748B' }}>
                  {discountPct}%
                </td>
                <td style={{ padding: '14px', textAlign: 'right', fontWeight: 800, color: '#0F172A', fontSize: '14px' }}>
                  {defaultCurrency} {netTaxable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Financial Calculation Breakdown */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '28px' }}>
          <div style={{ width: '340px', background: '#F8FAFC', padding: '16px 20px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#475569' }}>
              <span>Gross Subtotal ({quantity} seats):</span>
              <span style={{ fontWeight: 600, color: '#0F172A' }}>
                {defaultCurrency} {grossSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            {discountPct > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#DC2626' }}>
                <span>Negotiated Discount ({discountPct}%):</span>
                <span style={{ fontWeight: 600 }}>
                  - {defaultCurrency} {discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#475569', borderTop: '1px solid #E2E8F0', paddingTop: '8px' }}>
              <span>Net Taxable Amount:</span>
              <span style={{ fontWeight: 600, color: '#0F172A' }}>
                {defaultCurrency} {netTaxable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', color: '#475569' }}>
              <span>Value Added Tax (VAT {taxPct}%):</span>
              <span style={{ fontWeight: 600, color: '#0F172A' }}>
                {defaultCurrency} {taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0F172A', paddingTop: '10px', fontSize: '15px' }}>
              <span style={{ fontWeight: 900, color: '#0F172A' }}>Total Amount Due:</span>
              <span style={{ fontWeight: 900, color: '#059669', fontSize: '16px' }}>
                {defaultCurrency} {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Bank Wire Details & Remittance */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', background: '#F8FAFC', padding: '16px 20px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '28px', fontSize: '12px' }}>
          <div>
            <div style={{ fontWeight: 800, color: '#1E293B', marginBottom: '6px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em' }}>
              Bank Wire Remittance Instructions
            </div>
            <div style={{ color: '#475569', lineHeight: 1.6 }}>
              <div>Beneficiary: <strong>TEXOL INFORMATION TECHNOLOGY CO.</strong></div>
              <div>Bank Name: <strong>Saudi National Bank (SNB)</strong></div>
              <div>IBAN: <strong>SA44 1000 0001 2345 6789 0123</strong></div>
              <div>SWIFT Code: <strong>NCBKSA22</strong></div>
              <div>Payment Reference: <strong>{invoiceNumber} / {accountName}</strong></div>
            </div>
          </div>

          {/* ZATCA QR Code Stamp Representation */}
          <div style={{ textAlign: 'center', borderLeft: '1px solid #E2E8F0', paddingLeft: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '80px', height: '80px', background: '#0F172A', padding: '6px', borderRadius: '6px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px' }}>
              {Array.from({ length: 25 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    background: (i % 2 === 0 || i % 7 === 0) ? '#FFFFFF' : 'transparent',
                    borderRadius: '1px'
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: '10px', color: '#64748B', marginTop: '6px', fontWeight: 600 }}>
              ZATCA Cryptographic E-Invoice
            </div>
          </div>
        </div>

        {/* Signature & Authorized Seal */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #E2E8F0' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '36px' }}>
              ISSUED BY: TEXOL AUTHORIZED REPRESENTATIVE
            </div>
            <div style={{ borderBottom: '1px dashed #94A3B8', width: '220px', marginBottom: '6px' }} />
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>Commercial Director</div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>TEXOL Enterprise Sales &amp; Finance</div>
          </div>

          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '36px' }}>
              CUSTOMER ACCEPTANCE &amp; ACKNOWLEDGMENT
            </div>
            <div style={{ borderBottom: '1px dashed #94A3B8', width: '220px', marginBottom: '6px' }} />
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>{contactName}</div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>Authorized Buyer Signature &amp; Stamp</div>
          </div>
        </div>
      </div>
    </div>
  );
};
