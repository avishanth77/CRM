import React, { useState, useMemo } from 'react';
import { 
  Users, Search, ArrowRight, Clock, MapPin, 
  AlertCircle, RefreshCw, Layers, Compass, Monitor, 
  FlaskConical, CheckSquare, Briefcase, FileText, Handshake
} from 'lucide-react';
import type { Lead, AuthUser, Product } from '../services/api';

export interface MyLeadsWorkspaceProps {
  leads: Lead[];
  products: Product[];
  currentUser: AuthUser | null;
  onRefresh: () => void;
  onNavigateToStage: (lead: Lead) => void;
  onCreateNewLead?: () => void;
}

export const isLeadAssignedToUser = (lead: Lead, user: AuthUser | null): boolean => {
  if (!user) return false;
  const userId = String(user.id);
  const userEmail = (user.email || '').toLowerCase().trim();
  const userName = (user.name || `${user.first_name || ''} ${user.last_name || ''}`).toLowerCase().trim();

  const leadOwnerId = lead.owner ? String(lead.owner) : '';
  const leadOwnerEmail = (lead.owner_email || '').toLowerCase().trim();
  const leadOwnerName = (lead.owner_name || '').toLowerCase().trim();

  if (leadOwnerId && (leadOwnerId === userId || (user.username && leadOwnerId === user.username))) {
    return true;
  }
  if (userEmail && leadOwnerEmail && userEmail === leadOwnerEmail) {
    return true;
  }
  if (userName && leadOwnerName && (userName === leadOwnerName || leadOwnerName.includes(userName))) {
    return true;
  }
  return false;
};

export const getLeadStageMeta = (lead: Lead): { label: string; tab: string; color: string; icon: any } => {
  if (lead.status === 'NURTURE') {
    return { label: 'Nurture Pool', tab: 'nurture-pool', color: '#94A3B8', icon: RefreshCw };
  }
  if (lead.status === 'DISQUALIFIED') {
    return { label: 'Disqualified', tab: 'nurture-pool', color: '#EF4444', icon: AlertCircle };
  }

  const code = (lead.current_stage_code || '').toUpperCase();
  const name = (lead.current_stage_name || '').toUpperCase();

  if (code.includes('DISCOVERY') || name.includes('DISCOVERY')) {
    return { label: lead.current_stage_name || 'Discovery & Mapping', tab: 'discovery', color: '#8B5CF6', icon: Compass };
  }
  if (code.includes('DEMO') || name.includes('DEMO')) {
    return { label: lead.current_stage_name || 'Product Demo', tab: 'demo', color: '#06B6D4', icon: Monitor };
  }
  if (code.includes('POC') || code.includes('PILOT') || name.includes('POC') || name.includes('PILOT')) {
    return { label: lead.current_stage_name || 'POC Pilot Trials', tab: 'poc', color: '#F59E0B', icon: FlaskConical };
  }
  if (code.includes('SQL') || name.includes('SQL')) {
    return { label: lead.current_stage_name || 'SQL Gate Readiness', tab: 'sql', color: '#EAB308', icon: CheckSquare };
  }
  if (code.includes('PROPOSAL') || name.includes('PROPOSAL')) {
    return { label: lead.current_stage_name || 'Commercial Proposals', tab: 'proposals', color: '#3B82F6', icon: FileText };
  }
  if (code.includes('NEGOTIATION') || name.includes('NEGOTIATION')) {
    return { label: lead.current_stage_name || 'Negotiation Stage', tab: 'negotiation', color: '#EC4899', icon: Handshake };
  }
  if (code.includes('WON') || name.includes('WON') || name.includes('CUSTOMER')) {
    return { label: lead.current_stage_name || 'Customer Lifecycle', tab: 'customer-lifecycle', color: '#10B981', icon: Layers };
  }
  if (lead.status === 'CONVERTED' || code.includes('OPPORTUNITY') || code.includes('SALES_ACCEPTED') || name.includes('OPPORTUNITY')) {
    return { label: lead.current_stage_name || 'Opportunities', tab: 'opportunities', color: '#10B981', icon: Briefcase };
  }

  // Default: PLD Work Queue
  return { label: lead.current_stage_name || 'PLD Work Queue', tab: 'queue', color: '#3B82F6', icon: Layers };
};

export const MyLeadsWorkspace: React.FC<MyLeadsWorkspaceProps> = ({
  leads,
  products,
  currentUser,
  onRefresh,
  onNavigateToStage,
  onCreateNewLead
}) => {
  const isManagerOrAdmin = Boolean(
    currentUser?.is_superuser ||
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'MANAGEMENT' ||
    currentUser?.role === 'SALES_MANAGER'
  );

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('ALL');
  const [selectedStageTab, setSelectedStageTab] = useState('ALL');
  const [scopeFilter, setScopeFilter] = useState<'MINE' | 'ALL'>('MINE');

  // Strict logged-user filter vs All
  const scopedLeads = useMemo(() => {
    if (scopeFilter === 'MINE') {
      return leads.filter(l => isLeadAssignedToUser(l, currentUser));
    }
    return leads;
  }, [leads, scopeFilter, currentUser]);

  const filteredLeads = useMemo(() => {
    return scopedLeads.filter(lead => {
      // 1. Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesAccount = (lead.account_name || '').toLowerCase().includes(q);
        const matchesContact = (lead.contact_name || '').toLowerCase().includes(q);
        const matchesEmail = (lead.contact_email || '').toLowerCase().includes(q);
        const matchesCity = (lead.account_city || '').toLowerCase().includes(q);
        const matchesTerritory = (lead.territory || '').toLowerCase().includes(q);
        const matchesProduct = (lead.primary_product_name || '').toLowerCase().includes(q);
        if (!matchesAccount && !matchesContact && !matchesEmail && !matchesCity && !matchesTerritory && !matchesProduct) {
          return false;
        }
      }

      // 2. Product filter
      if (selectedProduct !== 'ALL') {
        if (lead.primary_product_code !== selectedProduct && lead.primary_product !== selectedProduct) {
          return false;
        }
      }

      // 3. Stage filter
      if (selectedStageTab !== 'ALL') {
        const meta = getLeadStageMeta(lead);
        if (meta.tab !== selectedStageTab) {
          return false;
        }
      }

      return true;
    });
  }, [scopedLeads, searchQuery, selectedProduct, selectedStageTab]);

  // Summary Metrics
  const myTotalCount = useMemo(() => leads.filter(l => isLeadAssignedToUser(l, currentUser)).length, [leads, currentUser]);
  const pldStageCount = useMemo(() => scopedLeads.filter(l => {
    const meta = getLeadStageMeta(l);
    return ['queue', 'discovery', 'demo', 'poc'].includes(meta.tab);
  }).length, [scopedLeads]);
  const salesStageCount = useMemo(() => scopedLeads.filter(l => {
    const meta = getLeadStageMeta(l);
    return ['sql', 'opportunities', 'proposals', 'negotiation', 'customer-lifecycle'].includes(meta.tab);
  }).length, [scopedLeads]);
  const qualifiedCount = useMemo(() => scopedLeads.filter(l => (l.pld_score ?? 0) >= 60).length, [scopedLeads]);

  return (
    <div className="space-y-6 animate-fade-in" style={{ paddingBottom: '32px' }}>
      {/* Top Header Card */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(79, 70, 229, 0.15)',
                border: '1px solid rgba(79, 70, 229, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Users size={20} color="#4F46E5" />
              </div>
              <div>
                <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                  {scopeFilter === 'MINE' ? 'My Assigned Leads' : 'All Leads Directory'}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', margin: '3px 0 0' }}>
                  {scopeFilter === 'MINE' 
                    ? `Showing all ${myTotalCount} leads assigned to ${currentUser?.name || 'you'}. Click any lead to open its active stage.` 
                    : `Showing all ${leads.length} system leads. Click any lead to jump directly to its stage.`}
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Scope toggle for Admin / Manager */}
            {isManagerOrAdmin && (
              <div style={{ display: 'flex', background: 'var(--bg-surface)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setScopeFilter('MINE')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: scopeFilter === 'MINE' ? 'var(--primary)' : 'transparent',
                    color: scopeFilter === 'MINE' ? '#FFFFFF' : 'var(--text-secondary)'
                  }}
                >
                  Assigned to Me ({myTotalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setScopeFilter('ALL')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: scopeFilter === 'ALL' ? 'var(--primary)' : 'transparent',
                    color: scopeFilter === 'ALL' ? '#FFFFFF' : 'var(--text-secondary)'
                  }}
                >
                  All Leads ({leads.length})
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onRefresh}
              className="btn btn-outline"
              style={{ padding: '7px 12px', fontSize: '0.80rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Refresh Leads Data"
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>

            {onCreateNewLead && (
              <button
                type="button"
                onClick={onCreateNewLead}
                className="btn btn-primary"
                style={{ padding: '7px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>+ Create Lead</span>
              </button>
            )}
          </div>
        </div>

        {/* KPI Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginTop: '18px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-subtle)'
        }}>
          <div style={{ padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              {scopeFilter === 'MINE' ? 'My Assigned Leads' : 'Total Leads'}
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              {scopedLeads.length}
            </div>
          </div>

          <div style={{ padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              In PLD Pipeline
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#4F46E5', marginTop: '2px' }}>
              {pldStageCount}
            </div>
          </div>

          <div style={{ padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              In Sales Pipeline
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10B981', marginTop: '2px' }}>
              {salesStageCount}
            </div>
          </div>

          <div style={{ padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              PLD Qualified (&ge; 60%)
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#F59E0B', marginTop: '2px' }}>
              {qualifiedCount}
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="card" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search company, contact, email, city, territory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '8px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Product Filter */}
          <div style={{ minWidth: '160px' }}>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            >
              <option value="ALL">All Products</option>
              {products.map(p => (
                <option key={p.id} value={p.code}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Stage Filter */}
          <div style={{ minWidth: '190px' }}>
            <select
              value={selectedStageTab}
              onChange={(e) => setSelectedStageTab(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            >
              <option value="ALL">All Pipeline Stages</option>
              <optgroup label="PLD Pipeline">
                <option value="queue">PLD Qualification</option>
                <option value="discovery">Discovery &amp; Mapping</option>
                <option value="demo">Demo Workspace</option>
                <option value="poc">POC Pilot Trials</option>
              </optgroup>
              <optgroup label="Sales Pipeline">
                <option value="sql">SQL Gate Readiness</option>
                <option value="opportunities">Opportunities</option>
                <option value="proposals">Commercial Proposals</option>
                <option value="negotiation">Negotiation Stage</option>
                <option value="customer-lifecycle">Customer Lifecycle</option>
              </optgroup>
              <optgroup label="Other">
                <option value="nurture-pool">Nurture / Disqualified</option>
              </optgroup>
            </select>
          </div>

          {(searchQuery || selectedProduct !== 'ALL' || selectedStageTab !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedProduct('ALL');
                setSelectedStageTab('ALL');
              }}
              className="btn btn-outline"
              style={{ padding: '7px 12px', fontSize: '0.78rem' }}
            >
              Clear Filters
            </button>
          )}

          <div style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Showing <strong>{filteredLeads.length}</strong> of <strong>{scopedLeads.length}</strong> leads
          </div>
        </div>
      </div>

      {/* Leads Table / Card List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filteredLeads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-secondary)' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'rgba(79, 70, 229, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Users size={26} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
              {scopedLeads.length === 0 ? 'No leads assigned to you yet' : 'No matching leads found'}
            </h3>
            <p style={{ fontSize: '0.84rem', maxWidth: '420px', margin: '0 auto 16px', color: 'var(--text-muted)' }}>
              {scopedLeads.length === 0 
                ? 'When leads are assigned to your user account, they will automatically appear here with their current progression stage.'
                : 'Try adjusting your search criteria or clear the filters to view all assigned leads.'}
            </p>
            {scopedLeads.length === 0 && isManagerOrAdmin && (
              <button
                type="button"
                onClick={() => setScopeFilter('ALL')}
                className="btn btn-outline"
                style={{ fontSize: '0.80rem', padding: '6px 14px' }}
              >
                View All Company Leads ({leads.length})
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Company &amp; Location</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Primary Contact</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Product</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Current Stage</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center' }}>Fit Score</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Next Scheduled Action</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const stageMeta = getLeadStageMeta(lead);
                  const StageIcon = stageMeta.icon;
                  const fitScore = lead.pld_score ?? 0;

                  return (
                    <tr 
                      key={lead.id}
                      onClick={() => onNavigateToStage(lead)}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      className="hover:bg-surface-elevated"
                    >
                      {/* Company & Location */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                          {lead.account_name || 'Unnamed Account'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                          <MapPin size={12} />
                          <span>{lead.account_city || lead.territory || lead.account_country || 'Saudi Arabia'}</span>
                        </div>
                      </td>

                      {/* Primary Contact */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {lead.contact_name || 'No contact documented'}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {lead.contact_designation || lead.contact_email || lead.contact_phone || '—'}
                        </div>
                      </td>

                      {/* Product */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <span className="badge badge-neutral" style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                          {lead.primary_product_name || lead.primary_product_code || 'Product'}
                        </span>
                      </td>

                      {/* Current Stage */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: `${stageMeta.color}15`,
                          border: `1px solid ${stageMeta.color}40`,
                          color: stageMeta.color,
                          fontWeight: 700,
                          fontSize: '0.76rem'
                        }}>
                          <StageIcon size={13} />
                          <span>{stageMeta.label}</span>
                        </div>
                      </td>

                      {/* PLD Fit Score */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <span 
                          className={`badge ${
                            fitScore >= 80 ? 'badge-success' : fitScore >= 60 ? 'badge-info' : 'badge-neutral'
                          }`}
                          style={{ fontSize: '0.75rem', fontWeight: 700 }}
                        >
                          {fitScore}%
                        </span>
                      </td>

                      {/* Next Scheduled Action */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', maxWidth: '240px' }}>
                        <div style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }} title={lead.next_action_description || 'No action scheduled'}>
                          {lead.next_action_description || 'Initial qualification'}
                        </div>
                        {lead.next_activity_due_at && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.70rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                            <Clock size={11} />
                            <span>{new Date(lead.next_activity_due_at).toLocaleDateString()}</span>
                          </div>
                        )}
                      </td>

                      {/* Action Button: Jump to Stage */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToStage(lead);
                          }}
                          className="btn btn-primary"
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.76rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                          title={`Open lead in ${stageMeta.label}`}
                        >
                          <span>Open Stage</span>
                          <ArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
