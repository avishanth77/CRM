import React, { useState, useMemo } from 'react';
import { 
  Globe, UserCheck, ShieldCheck, Search, RotateCcw, 
  AlertCircle, Clock, Mail, Phone, MapPin, 
  CheckCircle2, ChevronRight, MessageSquare
} from 'lucide-react';
import { api } from '../services/api';
import type { Lead, AuthUser, Product } from '../services/api';
import { inAppAlert } from './common/InAppAlert';

interface WebsiteLeadsTriageWorkspaceProps {
  leads: Lead[];
  products: Product[];
  staffUsers: AuthUser[];
  currentUser?: AuthUser | null;
  onRefresh: () => void;
  onNavigateToTab?: (tab: string, leadId?: string) => void;
}

export const WebsiteLeadsTriageWorkspace: React.FC<WebsiteLeadsTriageWorkspaceProps> = ({
  leads,
  products,
  staffUsers,
  onRefresh,
  onNavigateToTab
}) => {
  // State
  const [filterMode, setFilterMode] = useState<'UNASSIGNED' | 'ALL' | 'ASSIGNED'>('UNASSIGNED');
  const [selectedProduct, setSelectedProduct] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkOwnerId, setBulkOwnerId] = useState<string>('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [quickAssignMap, setQuickAssignMap] = useState<Record<string, string>>({});

  // Filter Sales staff eligible to receive leads (exclude partners, only active)
  const salesStaff = useMemo(() => {
    return staffUsers.filter(u => 
      u.is_active !== false && 
      !u.is_partner_user && 
      u.role !== 'PARTNER_USER'
    );
  }, [staffUsers]);

  // Identify all website inbound leads:
  // Strictly include only leads originating from website / landing page / digital inbound sources
  const websiteLeads = useMemo(() => {
    return leads.filter(lead => {
      const src = (lead.source_name || '').toLowerCase();
      const nextAct = (lead.next_action_description || '').toLowerCase();

      // Explicit non-website sources must never be included
      const isNonWebsiteSource = 
        src.includes('referral') || 
        src.includes('exhibition') || 
        src.includes('expo') || 
        src.includes('outbound') || 
        src.includes('cold') || 
        src.includes('partner') || 
        src.includes('whatsapp') ||
        src.includes('event');

      if (isNonWebsiteSource) return false;

      // Positive check: Must be an inbound website source or have a website inquiry action description
      const isWebsiteSource = 
        src.includes('web') || 
        src.includes('landing') || 
        src.includes('contact form') ||
        src.includes('google inbound') ||
        src.includes('website inbound');

      const isWebsiteInquiryAction = 
        nextAct.includes('website inquiry') || 
        (nextAct.includes('awaiting sales assignment') && !isNonWebsiteSource);

      return isWebsiteSource || isWebsiteInquiryAction;
    });
  }, [leads]);

  // Apply UI Filters
  const filteredLeads = useMemo(() => {
    return websiteLeads.filter(lead => {
      // 1. Assignment Filter
      if (filterMode === 'UNASSIGNED' && lead.owner) return false;
      if (filterMode === 'ASSIGNED' && !lead.owner) return false;

      // 2. Product Filter
      if (selectedProduct !== 'ALL' && lead.primary_product_code !== selectedProduct && lead.primary_product !== selectedProduct) {
        return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesComp = (lead.account_name || '').toLowerCase().includes(q);
        const matchesContact = (lead.contact_name || '').toLowerCase().includes(q);
        const matchesEmail = (lead.contact_email || '').toLowerCase().includes(q);
        const matchesPhone = (lead.contact_phone || '').toLowerCase().includes(q);
        const matchesAction = (lead.next_action_description || '').toLowerCase().includes(q);
        const matchesCity = (lead.account_city || '').toLowerCase().includes(q);
        const matchesState = (lead.account_state || '').toLowerCase().includes(q);
        const matchesCountry = (lead.account_country || '').toLowerCase().includes(q);
        if (!matchesComp && !matchesContact && !matchesEmail && !matchesPhone && !matchesAction && !matchesCity && !matchesState && !matchesCountry) {
          return false;
        }
      }

      return true;
    });
  }, [websiteLeads, filterMode, selectedProduct, searchQuery]);

  // Stats Counters
  const unassignedCount = useMemo(() => websiteLeads.filter(l => !l.owner).length, [websiteLeads]);
  const assignedCount = useMemo(() => websiteLeads.filter(l => !!l.owner).length, [websiteLeads]);

  // Handle Single Lead Assignment
  const handleAssignSingle = async (leadId: string, ownerId: string) => {
    if (!ownerId) {
      inAppAlert.warning('Please select a Sales Representative to assign this lead to.');
      return;
    }
    setAssigningId(leadId);
    try {
      const selectedStaff = salesStaff.find(s => s.id === ownerId);
      const staffName = selectedStaff ? (selectedStaff.first_name ? `${selectedStaff.first_name} ${selectedStaff.last_name}` : selectedStaff.username) : 'Sales Rep';

      await api.updateLead(leadId, {
        owner: ownerId,
        next_action_description: `Initial prospect outreach & discovery call with ${staffName}`
      });

      inAppAlert.success(`Lead successfully assigned to ${staffName}! It is now active in their personal queue.`);
      onRefresh();
    } catch (err: any) {
      inAppAlert.error(err.message || 'Failed to assign lead.');
    } finally {
      setAssigningId(null);
    }
  };

  // Handle Bulk Lead Assignment
  const handleBulkAssign = async () => {
    if (selectedLeadIds.length === 0) {
      inAppAlert.warning('Select at least one lead to assign.');
      return;
    }
    if (!bulkOwnerId) {
      inAppAlert.warning('Please select a Sales Representative.');
      return;
    }

    const selectedStaff = salesStaff.find(s => s.id === bulkOwnerId);
    const staffName = selectedStaff ? (selectedStaff.first_name ? `${selectedStaff.first_name} ${selectedStaff.last_name}` : selectedStaff.username) : 'Sales Rep';

    setAssigningId('bulk');
    let successCount = 0;

    for (const id of selectedLeadIds) {
      try {
        await api.updateLead(id, {
          owner: bulkOwnerId,
          next_action_description: `Initial outreach & qualification assigned to ${staffName}`
        });
        successCount++;
      } catch (err) {
        console.warn(`Failed assigning lead ${id}:`, err);
      }
    }

    setAssigningId(null);
    setSelectedLeadIds([]);
    setBulkOwnerId('');
    inAppAlert.success(`Assigned ${successCount} leads to ${staffName}!`);
    onRefresh();
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map(l => l.id));
    }
  };

  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Product badge color mapper
  const getProductBadgeColor = (code: string) => {
    switch (code) {
      case 'VANFORCES': return { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' };
      case 'AL_MAWASIL': return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
      case 'TASKFORCES': return { bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)' };
      case 'SPEAKORDER': return { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
      default: return { bg: 'rgba(99, 102, 241, 0.15)', text: '#6366f1', border: 'rgba(99, 102, 241, 0.3)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '8px 4px' }}>
      
      {/* 1. Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        borderRadius: '14px',
        padding: '24px 28px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)'
          }}>
            <Globe size={28} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 700, color: '#f8fafc' }}>
                Product Website Inbound Triage
              </h2>
              <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', fontSize: '0.72rem' }}>
                Authorized Manager Access
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#94a3b8', maxWidth: '680px' }}>
              Inbound inquiries from your product landing pages arrive here directly <strong>without automated ICP disqualification</strong>. Review the visitor's inquiry and assign the lead to a sales representative.
            </p>
          </div>
        </div>

        {/* Counter KPI Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '10px',
            padding: '10px 16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f59e0b' }}>
              {unassignedCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Awaiting Assignment
            </div>
          </div>

          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '10px',
            padding: '10px 16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10b981' }}>
              {assignedCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Assigned to Sales
            </div>
          </div>

          <button 
            className="btn btn-outline" 
            onClick={onRefresh}
            title="Refresh Leads"
            style={{ padding: '10px 14px' }}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* 2. Controls & Filter Bar */}
      <div style={{
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: '14px 18px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px'
      }}>
        {/* Status Toggle Tabs */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-surface)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <button
            className={`btn ${filterMode === 'UNASSIGNED' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilterMode('UNASSIGNED')}
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            Unassigned ({unassignedCount})
          </button>
          <button
            className={`btn ${filterMode === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilterMode('ALL')}
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            All Inbound ({websiteLeads.length})
          </button>
          <button
            className={`btn ${filterMode === 'ASSIGNED' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilterMode('ASSIGNED')}
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            Assigned ({assignedCount})
          </button>
        </div>

        {/* Search & Product Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, justifyContent: 'flex-end', minWidth: '320px' }}>
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              placeholder="Search website leads..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input"
              style={{ width: '100%', paddingLeft: '32px', fontSize: '0.82rem', height: '36px' }}
            />
          </div>

          <select
            value={selectedProduct}
            onChange={e => setSelectedProduct(e.target.value)}
            className="input"
            style={{ fontSize: '0.82rem', height: '36px', minWidth: '160px' }}
          >
            <option value="ALL">All Products</option>
            {products.map(p => (
              <option key={p.id} value={p.code}>{p.name} ({p.code})</option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Floating Bulk Action Toolbar (When 1+ leads checked) */}
      {selectedLeadIds.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
          border: '1px solid #3b82f6',
          borderRadius: '10px',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          boxShadow: '0 6px 20px rgba(59, 130, 246, 0.25)',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc', fontSize: '0.88rem', fontWeight: 600 }}>
            <CheckCircle2 size={18} color="#60a5fa" />
            <span>Selected {selectedLeadIds.length} lead(s) for assignment</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <select
              value={bulkOwnerId}
              onChange={e => setBulkOwnerId(e.target.value)}
              className="input"
              style={{ fontSize: '0.82rem', height: '36px', minWidth: '220px', background: '#0f172a', borderColor: '#3b82f6', color: '#fff' }}
            >
              <option value="">-- Choose Sales Representative --</option>
              {salesStaff.map(s => (
                <option key={s.id} value={s.id}>
                  {s.first_name ? `${s.first_name} ${s.last_name}` : s.username} ({s.role})
                </option>
              ))}
            </select>

            <button
              className="btn btn-primary"
              onClick={handleBulkAssign}
              disabled={assigningId === 'bulk' || !bulkOwnerId}
              style={{ fontSize: '0.82rem', height: '36px', padding: '0 18px', fontWeight: 600 }}
            >
              {assigningId === 'bulk' ? 'Assigning...' : 'Assign to Sales Rep'}
            </button>

            <button
              className="btn btn-ghost"
              onClick={() => setSelectedLeadIds([])}
              style={{ fontSize: '0.82rem', color: '#94a3b8' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 4. Leads List / Cards */}
      {filteredLeads.length === 0 ? (
        <div style={{
          background: 'var(--bg-surface-elevated)',
          border: '1px dashed var(--border-subtle)',
          borderRadius: '12px',
          padding: '60px 20px',
          textAlign: 'center',
          color: 'var(--text-muted)'
        }}>
          <Globe size={42} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <h4 style={{ margin: '0 0 6px', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
            No Inbound Website Leads Found
          </h4>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            {filterMode === 'UNASSIGNED' 
              ? 'Great job! All incoming website leads have been assigned to sales representatives.' 
              : 'No website inquiries match the selected criteria.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Header Row with Select All */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 8px',
            fontSize: '0.78rem',
            color: 'var(--text-muted)'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox"
                checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
                onChange={toggleSelectAll}
                style={{ cursor: 'pointer' }}
              />
              <span>Select All Visible ({filteredLeads.length})</span>
            </label>
            <span>Showing {filteredLeads.length} website leads</span>
          </div>

          {/* Cards */}
          {filteredLeads.map(lead => {
            const isAssigned = !!lead.owner;
            const isSelected = selectedLeadIds.includes(lead.id);
            const isCurrentlyAssigning = assigningId === lead.id;
            const currentSelectedStaff = quickAssignMap[lead.id] || '';
            const badgeColor = getProductBadgeColor(lead.primary_product_code);

            return (
              <div 
                key={lead.id}
                style={{
                  background: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-surface-elevated)',
                  border: isSelected ? '1px solid #3b82f6' : (isAssigned ? '1px solid var(--border-subtle)' : '1px solid rgba(245, 158, 11, 0.4)'),
                  borderRadius: '12px',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  transition: 'all 0.2s ease',
                  boxShadow: isAssigned ? 'none' : '0 2px 10px rgba(245, 158, 11, 0.08)'
                }}
              >
                {/* Row 1: Company, Product Badge, Assignment Status */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectLead(lead.id)}
                      style={{ marginTop: '5px', cursor: 'pointer' }}
                    />

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {lead.account_name}
                        </span>
                        
                        {/* Product Tag */}
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: '6px',
                          background: badgeColor.bg,
                          color: badgeColor.text,
                          border: `1px solid ${badgeColor.border}`,
                          letterSpacing: '0.5px'
                        }}>
                          {lead.primary_product_name || lead.primary_product_code}
                        </span>

                        {/* Source Tag */}
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'rgba(255,255,255,0.06)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)'
                        }}>
                          Source: {lead.source_name || 'Website Inbound'}
                        </span>

                        {/* Campaign Tag */}
                        {lead.touches && lead.touches.length > 0 && lead.touches[0].campaign_name && (
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: '#818cf8',
                            border: '1px solid rgba(99, 102, 241, 0.3)'
                          }}>
                            Campaign: {lead.touches[0].campaign_name}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} />
                          Received {new Date(lead.created_at).toLocaleDateString()} at {new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>

                        {(lead.account_city || lead.account_state || lead.account_country) && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={13} />
                            {[lead.account_city, lead.account_state, lead.account_country].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Assignment Status Pill */}
                  <div>
                    {isAssigned ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: '#10b981',
                        background: 'rgba(16, 185, 129, 0.12)',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        border: '1px solid rgba(16, 185, 129, 0.3)'
                      }}>
                        <UserCheck size={14} />
                        Assigned: {lead.owner_name}
                      </div>
                    ) : (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: '#f59e0b',
                        background: 'rgba(245, 158, 11, 0.14)',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        border: '1px solid rgba(245, 158, 11, 0.4)'
                      }}>
                        <AlertCircle size={14} />
                        Pending Assignment
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2: Contact Information & Submitted Message */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '14px',
                  background: 'var(--bg-surface)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)'
                }}>
                  {/* Contact Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      Contact: {lead.contact_name || 'Inbound Prospect'}
                    </div>
                    {lead.contact_email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                        <Mail size={13} color="#3b82f6" />
                        <a href={`mailto:${lead.contact_email}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                          {lead.contact_email}
                        </a>
                      </div>
                    )}
                    {lead.contact_phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                        <Phone size={13} color="#10b981" />
                        <a href={`tel:${lead.contact_phone}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                          {lead.contact_phone}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Visitor Inquiry / Notes */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      <MessageSquare size={13} color="#f59e0b" />
                      Inquiry Message / Next Action:
                    </div>
                    <div style={{
                      color: 'var(--text-primary)',
                      fontStyle: 'italic',
                      lineHeight: '1.4',
                      background: 'rgba(0,0,0,0.15)',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      borderLeft: '3px solid #3b82f6'
                    }}>
                      "{lead.next_action_description || 'Inbound request awaiting initial follow-up'}"
                    </div>
                  </div>
                </div>

                {/* Row 3: Admin Assignment Controls */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                  flexWrap: 'wrap',
                  paddingTop: '6px',
                  borderTop: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <ShieldCheck size={14} color="#6366f1" />
                    <span>ICP Evaluation: <strong>Postponed</strong> (Sales representative will evaluate during initial call)</span>
                  </div>

                  {/* Assign to Sales Rep Action Form */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      value={currentSelectedStaff}
                      onChange={e => setQuickAssignMap(prev => ({ ...prev, [lead.id]: e.target.value }))}
                      className="input"
                      style={{ fontSize: '0.8rem', height: '34px', minWidth: '200px' }}
                    >
                      <option value="">{isAssigned ? 'Reassign to another rep...' : '-- Select Sales Rep --'}</option>
                      {salesStaff.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.first_name ? `${s.first_name} ${s.last_name}` : s.username} ({s.role})
                        </option>
                      ))}
                    </select>

                    <button
                      className={`btn ${isAssigned ? 'btn-outline' : 'btn-primary'}`}
                      onClick={() => handleAssignSingle(lead.id, currentSelectedStaff)}
                      disabled={isCurrentlyAssigning || !currentSelectedStaff}
                      style={{ fontSize: '0.8rem', height: '34px', padding: '0 14px' }}
                    >
                      {isCurrentlyAssigning ? 'Assigning...' : (isAssigned ? 'Reassign' : 'Assign to Rep')}
                    </button>

                    {onNavigateToTab && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => onNavigateToTab('admin-leads', lead.id)}
                        title="View Full Lead Details in All Leads Directory"
                        style={{ fontSize: '0.8rem', height: '34px', padding: '0 10px', color: 'var(--text-secondary)' }}
                      >
                        Inspect <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
