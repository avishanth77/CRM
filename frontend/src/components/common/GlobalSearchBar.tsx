import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Building, Layers, Briefcase, Package, ArrowRight } from 'lucide-react';
import type { Lead, Product, Opportunity } from '../../services/api';

interface GlobalSearchBarProps {
  accounts: any[];
  leads: Lead[];
  opportunities: Opportunity[];
  products: Product[];
  onNavigateToAccount: (id: string) => void;
  onNavigateToLead: (lead: Lead) => void;
  onNavigateToOpportunity: (id: string) => void;
  onNavigateToProductStudio: () => void;
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({
  accounts,
  leads,
  opportunities,
  products,
  onNavigateToAccount,
  onNavigateToLead,
  onNavigateToOpportunity,
  onNavigateToProductStudio
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter items matching query
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;

    const matchedAccounts = accounts.filter(a => {
      const name = (a.company_name || a.name || '').toLowerCase();
      const domain = (a.domain || a.website || '').toLowerCase();
      const ind = (a.industry || '').toLowerCase();
      return name.includes(q) || domain.includes(q) || ind.includes(q);
    }).slice(0, 4);

    const matchedLeads = leads.filter(l => {
      const acc = (l.account_name || '').toLowerCase();
      const contact = (l.contact_name || l.contact_email || '').toLowerCase();
      const prod = (l.primary_product_name || l.primary_product_code || '').toLowerCase();
      return acc.includes(q) || contact.includes(q) || prod.includes(q);
    }).slice(0, 4);

    const matchedOpportunities = opportunities.filter(o => {
      const acc = (o.account_name || '').toLowerCase();
      const prod = (o.product_name || o.pricing_plan || '').toLowerCase();
      return acc.includes(q) || prod.includes(q);
    }).slice(0, 4);

    const matchedProducts = products.filter(p => {
      const name = (p.name || '').toLowerCase();
      const code = (p.code || '').toLowerCase();
      return name.includes(q) || code.includes(q);
    }).slice(0, 3);

    const totalCount =
      matchedAccounts.length +
      matchedLeads.length +
      matchedOpportunities.length +
      matchedProducts.length;

    return {
      accounts: matchedAccounts,
      leads: matchedLeads,
      opportunities: matchedOpportunities,
      products: matchedProducts,
      totalCount
    };
  }, [query, accounts, leads, opportunities, products]);

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
  };

  const handleSelectAccount = (id: string) => {
    onNavigateToAccount(id);
    handleClear();
  };

  const handleSelectLead = (lead: Lead) => {
    onNavigateToLead(lead);
    handleClear();
  };

  const handleSelectOpportunity = (id: string) => {
    onNavigateToOpportunity(id);
    handleClear();
  };

  const handleSelectProduct = () => {
    onNavigateToProductStudio();
    handleClear();
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '340px' }}>
      {/* Search Input Box */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--bg-surface-elevated)',
          border: isOpen && query.trim() ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '6px 12px',
          width: '100%',
          boxSizing: 'border-box',
          transition: 'all 0.15s ease'
        }}
      >
        <Search size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
        <input
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          placeholder="Search accounts, leads, or deals..."
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            outline: 'none',
            width: '100%',
            fontWeight: 500
          }}
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: 'none',
              border: 'none',
              padding: '2px',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px'
            }}
            title="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown Results Box */}
      {isOpen && query.trim() && searchResults && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: '440px',
            maxHeight: '440px',
            overflowY: 'auto',
            background: 'var(--bg-surface, #FFFFFF)',
            border: '1px solid var(--border-subtle, #E2E8F0)',
            borderRadius: '12px',
            boxShadow: '0 18px 40px -10px rgba(0, 0, 0, 0.22), 0 0 1px 1px rgba(0,0,0,0.05)',
            zIndex: 9999,
            padding: '8px 0',
            animation: 'modalSlideDown 0.15s ease'
          }}
        >
          {searchResults.totalCount === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
              No matches found for <strong style={{ color: 'var(--text-primary)' }}>"{query}"</strong>
            </div>
          ) : (
            <div>
              {/* Accounts Section */}
              {searchResults.accounts.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ padding: '6px 14px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Building size={13} color="var(--primary)" />
                    Accounts ({searchResults.accounts.length})
                  </div>
                  {searchResults.accounts.map(acc => (
                    <div
                      key={acc.id}
                      onClick={() => handleSelectAccount(acc.id)}
                      style={{
                        padding: '8px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'background 0.12s ease'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-elevated)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {acc.company_name || acc.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {acc.industry || 'Account'} {acc.country ? `• ${acc.country}` : ''}
                        </div>
                      </div>
                      <ArrowRight size={13} color="var(--text-muted)" />
                    </div>
                  ))}
                </div>
              )}

              {/* Leads Section */}
              {searchResults.leads.length > 0 && (
                <div style={{ marginBottom: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                  <div style={{ padding: '6px 14px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={13} color="#0284C7" />
                    Leads ({searchResults.leads.length})
                  </div>
                  {searchResults.leads.map(lead => (
                    <div
                      key={lead.id}
                      onClick={() => handleSelectLead(lead)}
                      style={{
                        padding: '8px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'background 0.12s ease'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-elevated)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {lead.account_name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Contact: {lead.contact_name || lead.contact_email || 'Inbound'} • Product: {lead.primary_product_code || lead.primary_product_name}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(2, 132, 199, 0.1)', color: '#0284C7' }}>
                        {lead.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Opportunities Section */}
              {searchResults.opportunities.length > 0 && (
                <div style={{ marginBottom: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                  <div style={{ padding: '6px 14px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Briefcase size={13} color="#059669" />
                    Deals &amp; Opportunities ({searchResults.opportunities.length})
                  </div>
                  {searchResults.opportunities.map(opp => (
                    <div
                      key={opp.id}
                      onClick={() => handleSelectOpportunity(opp.id)}
                      style={{
                        padding: '8px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'background 0.12s ease'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-elevated)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {opp.account_name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {opp.product_name || opp.pricing_plan || 'VanForces PLD'} • ${(opp.total_contract_value || opp.arr || 0).toLocaleString()}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: opp.status === 'WON' ? 'rgba(16, 185, 129, 0.1)' : opp.status === 'LOST' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: opp.status === 'WON' ? '#10b981' : opp.status === 'LOST' ? '#ef4444' : '#f59e0b'
                        }}
                      >
                        {opp.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Products Section */}
              {searchResults.products.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                  <div style={{ padding: '6px 14px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Package size={13} color="var(--primary)" />
                    Products ({searchResults.products.length})
                  </div>
                  {searchResults.products.map(prod => (
                    <div
                      key={prod.id}
                      onClick={handleSelectProduct}
                      style={{
                        padding: '8px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'background 0.12s ease'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-elevated)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {prod.name} ({prod.code})
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {prod.category} • Configurable PLD Engine
                        </div>
                      </div>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary)' }}>
                        Studio
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
