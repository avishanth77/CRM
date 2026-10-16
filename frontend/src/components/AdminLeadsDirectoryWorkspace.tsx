import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Building2, Users, UserCheck, ShieldCheck, Search, 
  RotateCcw, Download, Eye, ArrowRight, AlertCircle, 
  Clock, DollarSign, MapPin, X, ExternalLink, Share2
} from 'lucide-react';
import { api } from '../services/api';
import type { Lead, AuthUser, Product, LeadSource } from '../services/api';
import { inAppAlert } from './common/InAppAlert';

interface AdminLeadsDirectoryWorkspaceProps {
  leads: Lead[];
  products: Product[];
  staffUsers: AuthUser[];
  currentUser: AuthUser | null;
  onRefresh: () => void;
  onNavigateToTab?: (tab: string, leadId?: string) => void;
}

export const AdminLeadsDirectoryWorkspace: React.FC<AdminLeadsDirectoryWorkspaceProps> = ({
  leads,
  products,
  staffUsers,
  currentUser,
  onRefresh,
  onNavigateToTab
}) => {
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOwner, setFilterOwner] = useState('ALL');
  const [filterProduct, setFilterProduct] = useState('ALL');
  const [filterStage, setFilterStage] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterIcp, setFilterIcp] = useState('ALL');
  const [filterScoreBand, setFilterScoreBand] = useState('ALL');
  const [filterCountry, setFilterCountry] = useState('ALL');
  const [filterTargetAccount, setFilterTargetAccount] = useState('ALL');
  const [filterSource, setFilterSource] = useState('ALL');

  // Lead Sources State
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [showEditSourceModal, setShowEditSourceModal] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [newSourceName, setNewSourceName] = useState('');
  const [savingSource, setSavingSource] = useState(false);

  useEffect(() => {
    api.getLeadSources().then(res => {
      const list = Array.isArray(res) ? res : (res?.results || []);
      setLeadSources(list);
    }).catch(e => console.warn('Failed to load lead sources:', e));
  }, []);

  // Lead Detail Inspection Drawer / Modal State
  const [inspectingLead, setInspectingLead] = useState<Lead | null>(null);
  const [drawerTab, setDrawerTab] = useState<'profile' | 'pld' | 'actions' | 'governance'>('profile');

  // Single & Bulk Reassignment States
  const [reassignModalLead, setReassignModalLead] = useState<Lead | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [showBulkReassignModal, setShowBulkReassignModal] = useState(false);
  const [targetOwnerId, setTargetOwnerId] = useState('');
  const [submittingReassign, setSubmittingReassign] = useState(false);

  // Close any active modal on Escape key press and manage background scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectingLead) setInspectingLead(null);
        if (reassignModalLead) setReassignModalLead(null);
        if (showBulkReassignModal) setShowBulkReassignModal(false);
      }
    };
    if (inspectingLead || reassignModalLead || showBulkReassignModal) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
      document.documentElement.classList.add('modal-open');
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.paddingRight = '';
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.paddingRight = '';
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [inspectingLead, reassignModalLead, showBulkReassignModal]);

  // Sales Staff filter for dropdown (exclude partners/superusers if needed)
  const salesStaffOptions = useMemo(() => {
    return staffUsers.filter(u => u.is_active !== false);
  }, [staffUsers]);

  // Unique list of stages & countries from leads for dynamic filters
  const availableStages = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => {
      if (l.current_stage_name) set.add(l.current_stage_name);
    });
    return Array.from(set);
  }, [leads]);

  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => {
      if (l.account_country) set.add(l.account_country);
    });
    return Array.from(set);
  }, [leads]);

  // Filtered Leads Computation
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const accMatch = lead.account_name?.toLowerCase().includes(q);
        const contactMatch = lead.contact_name?.toLowerCase().includes(q) || lead.contact_email?.toLowerCase().includes(q);
        const domainMatch = lead.domain?.toLowerCase().includes(q);
        const cityMatch = lead.account_city?.toLowerCase().includes(q);
        const countryMatch = lead.account_country?.toLowerCase().includes(q);
        const ownerMatch = lead.owner_name?.toLowerCase().includes(q) || lead.owner_email?.toLowerCase().includes(q);
        const prodMatch = lead.primary_product_name?.toLowerCase().includes(q) || lead.primary_product_code?.toLowerCase().includes(q);
        if (!accMatch && !contactMatch && !domainMatch && !cityMatch && !countryMatch && !ownerMatch && !prodMatch) {
          return false;
        }
      }

      // 2. Owner Filter
      if (filterOwner !== 'ALL') {
        if (filterOwner === 'UNASSIGNED') {
          if (lead.owner) return false;
        } else {
          if (String(lead.owner) !== filterOwner && lead.owner_email !== filterOwner) return false;
        }
      }

      // 3. Product Filter
      if (filterProduct !== 'ALL') {
        if (lead.primary_product_code !== filterProduct && lead.primary_product !== filterProduct) return false;
      }

      // 4. Stage Filter
      if (filterStage !== 'ALL') {
        if (lead.current_stage_name !== filterStage && lead.current_stage_code !== filterStage) return false;
      }

      // 5. Status Filter
      if (filterStatus !== 'ALL') {
        if (lead.status !== filterStatus) return false;
      }

      // 6. ICP Knockout Filter
      if (filterIcp !== 'ALL') {
        if (filterIcp === 'PASSED' && lead.icp_knockout_passed === false) return false;
        if (filterIcp === 'KNOCKOUT' && lead.icp_knockout_passed !== false) return false;
      }

      // 7. PLD Score Band Filter
      if (filterScoreBand !== 'ALL') {
        const score = lead.pld_score ?? 0;
        if (filterScoreBand === 'HIGH' && score < 80) return false;
        if (filterScoreBand === 'QUALIFIED' && (score < 60 || score >= 80)) return false;
        if (filterScoreBand === 'DEV' && (score < 30 || score >= 60)) return false;
        if (filterScoreBand === 'NURTURE' && score >= 30) return false;
      }

      // 8. Country Filter
      if (filterCountry !== 'ALL') {
        if (lead.account_country !== filterCountry) return false;
      }

      // 9. Target Account Filter
      if (filterTargetAccount !== 'ALL') {
        if (filterTargetAccount === 'TARGET' && !lead.is_target_account) return false;
        if (filterTargetAccount === 'STANDARD' && lead.is_target_account) return false;
      }

      // 10. Origination Source Filter
      if (filterSource !== 'ALL') {
        if (lead.source !== filterSource && lead.source_name !== filterSource) return false;
      }

      return true;
    });
  }, [leads, searchQuery, filterOwner, filterProduct, filterStage, filterStatus, filterIcp, filterScoreBand, filterCountry, filterTargetAccount, filterSource]);

  // Executive KPI summary calculations
  const totalPipelineVal = useMemo(() => {
    return leads.reduce((sum, l) => sum + (Number(l.estimated_opportunity_value) || 0), 0);
  }, [leads]);

  const pldQualifiedCount = useMemo(() => {
    return leads.filter(l => (l.pld_score ?? 0) >= 60 || l.current_stage_code === 'PLD_QUALIFIED').length;
  }, [leads]);

  const unassignedCount = useMemo(() => {
    return leads.filter(l => !l.owner).length;
  }, [leads]);

  // Bulk Selection Handlers
  const handleToggleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map(l => l.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Execute Reassignment (Single or Bulk)
  const handleExecuteReassignment = async (leadIds: string[], newOwnerId: string) => {
    if (!newOwnerId) {
      inAppAlert.warning('Please select a staff member to assign.');
      return;
    }
    setSubmittingReassign(true);
    try {
      let successCount = 0;
      for (const id of leadIds) {
        await api.updateLead(id, { owner: newOwnerId });
        successCount++;
      }

      const assignedUser = staffUsers.find(u => String(u.id) === newOwnerId);
      const ownerName = assignedUser ? `${assignedUser.first_name} ${assignedUser.last_name}` : 'selected staff member';
      inAppAlert.success(`Successfully reassigned ${successCount} lead(s) to ${ownerName}.`);

      setReassignModalLead(null);
      setShowBulkReassignModal(false);
      setSelectedLeadIds([]);
      setTargetOwnerId('');
      onRefresh();

      // If drawer is open on this lead, update it
      if (inspectingLead && leadIds.includes(inspectingLead.id)) {
        setInspectingLead(prev => prev ? {
          ...prev, 
          owner: newOwnerId,
          owner_name: ownerName
        } : null);
      }
    } catch (err: any) {
      console.error(err);
      inAppAlert.error(err.message || 'Failed to reassign lead ownership.');
    } finally {
      setSubmittingReassign(false);
    }
  };

  // CSV Export Generator
  const handleExportCSV = () => {
    if (filteredLeads.length === 0) {
      inAppAlert.warning('No lead records to export.');
      return;
    }

    const headers = [
      'Lead ID', 'Company Name', 'Domain', 'City', 'Country', 'Target Account',
      'Contact Name', 'Contact Title', 'Contact Email', 'Contact Phone',
      'Primary Product', 'Product Code', 'Assigned Owner', 'Owner Email',
      'Current Stage', 'Status', 'PLD Score', 'Score Classification', 'ICP Passed',
      'Estimated Value ($)', 'Next Action', 'Next Action Due', 'Created Date'
    ];

    const rows = filteredLeads.map(l => [
      `"${l.id}"`,
      `"${(l.account_name || '').replace(/"/g, '""')}"`,
      `"${l.domain || ''}"`,
      `"${l.account_city || ''}"`,
      `"${l.account_country || ''}"`,
      l.is_target_account ? 'Yes' : 'No',
      `"${(l.contact_name || '').replace(/"/g, '""')}"`,
      `"${(l.contact_designation || '').replace(/"/g, '""')}"`,
      `"${l.contact_email || ''}"`,
      `"${l.contact_phone || ''}"`,
      `"${(l.primary_product_name || '').replace(/"/g, '""')}"`,
      `"${l.primary_product_code || ''}"`,
      `"${(l.owner_name || 'Unassigned').replace(/"/g, '""')}"`,
      `"${l.owner_email || ''}"`,
      `"${l.current_stage_name || l.current_stage_code || ''}"`,
      `"${l.status}"`,
      l.pld_score ?? 'N/A',
      `"${l.score_classification || ''}"`,
      l.icp_knockout_passed === false ? 'Knockout' : 'Passed',
      l.estimated_opportunity_value ?? 0,
      `"${(l.next_action_description || '').replace(/"/g, '""')}"`,
      `"${l.next_activity_due_at || ''}"`,
      `"${l.created_at ? l.created_at.substring(0, 10) : ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `admin_all_leads_directory_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    inAppAlert.success(`Exported ${filteredLeads.length} leads to CSV.`);
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterOwner('ALL');
    setFilterProduct('ALL');
    setFilterStage('ALL');
    setFilterStatus('ALL');
    setFilterIcp('ALL');
    setFilterScoreBand('ALL');
    setFilterCountry('ALL');
    setFilterTargetAccount('ALL');
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 1. Header Banner & Executive Controls */}
      <div className="glass-panel" style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
              }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                  Admin Master Lead Directory
                </h1>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  Complete organizational overview of all enterprise prospect leads across every sales representative
                </p>
                {currentUser && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '0.75rem', color: '#4F46E5', fontWeight: 600 }}>
                    <ShieldCheck size={13} />
                    <span>Administrator Session: {currentUser.name || currentUser.email} ({currentUser.role_display || currentUser.role})</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {selectedLeadIds.length > 0 && (
              <button
                className="btn btn-primary"
                onClick={() => setShowBulkReassignModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.82rem' }}
              >
                <UserCheck size={16} />
                Reassign ({selectedLeadIds.length}) Leads
              </button>
            )}

            <button
              className="btn btn-outline"
              onClick={handleExportCSV}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.82rem' }}
            >
              <Download size={16} />
              Export Directory (CSV)
            </button>

            <button
              className="btn btn-outline"
              onClick={onRefresh}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.82rem' }}
            >
              <RotateCcw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {/* 2. Executive KPI Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginTop: '22px'
        }}>
          <div style={{
            padding: '14px 18px',
            background: 'var(--bg-surface)',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Enterprise Leads
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
              {leads.length}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {filteredLeads.length} currently matching filters
            </div>
          </div>

          <div style={{
            padding: '14px 18px',
            background: 'var(--bg-surface)',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              PLD Qualified &amp; High Fit
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#10B981', marginTop: '4px' }}>
              {pldQualifiedCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Score ≥ 60 or Stage PLD Qualified
            </div>
          </div>

          <div style={{
            padding: '14px 18px',
            background: 'var(--bg-surface)',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Est. Pipeline Value
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#3B82F6', marginTop: '4px' }}>
              ${totalPipelineVal.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Aggregated commercial value
            </div>
          </div>

          <div style={{
            padding: '14px 18px',
            background: 'var(--bg-surface)',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Unassigned Leads
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: unassignedCount > 0 ? '#F59E0B' : '#10B981', marginTop: '4px' }}>
              {unassignedCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {unassignedCount > 0 ? 'Requires manager allocation' : 'All leads assigned to staff'}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Universal Search & Filtering Panel */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Search Row */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{
              flex: 1,
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search across all leads by Company, Domain, Contact Name, Email, City, Country, or Assigned Owner..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 42px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.86rem',
                  outline: 'none'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {(searchQuery || filterOwner !== 'ALL' || filterProduct !== 'ALL' || filterStage !== 'ALL' || filterStatus !== 'ALL' || filterIcp !== 'ALL' || filterScoreBand !== 'ALL' || filterCountry !== 'ALL' || filterTargetAccount !== 'ALL' || filterSource !== 'ALL') && (
              <button
                className="btn btn-outline"
                onClick={() => {
                  setSearchQuery('');
                  setFilterOwner('ALL');
                  setFilterProduct('ALL');
                  setFilterStage('ALL');
                  setFilterStatus('ALL');
                  setFilterIcp('ALL');
                  setFilterScoreBand('ALL');
                  setFilterCountry('ALL');
                  setFilterTargetAccount('ALL');
                  setFilterSource('ALL');
                }}
                style={{ padding: '8px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              >
                Clear All Filters
              </button>
            )}
          </div>

          {/* Filters Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '10px'
          }}>
            {/* Filter: Owner / Sales Rep */}
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Assigned Staff</label>
              <select
                value={filterOwner}
                onChange={e => setFilterOwner(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  marginTop: '4px',
                  outline: 'none'
                }}
              >
                <option value="ALL">All Staff Members</option>
                <option value="UNASSIGNED">⚠️ Unassigned Leads</option>
                {salesStaffOptions.map(u => (
                  <option key={u.id} value={String(u.id)}>
                    {u.first_name} {u.last_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter: Product */}
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Product Solution</label>
              <select
                value={filterProduct}
                onChange={e => setFilterProduct(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  marginTop: '4px',
                  outline: 'none'
                }}
              >
                <option value="ALL">All Products</option>
                {products.map(p => (
                  <option key={p.id} value={p.code}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter: Stage */}
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Pipeline Stage</label>
              <select
                value={filterStage}
                onChange={e => setFilterStage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  marginTop: '4px',
                  outline: 'none'
                }}
              >
                <option value="ALL">All Stages</option>
                {availableStages.map(stg => (
                  <option key={stg} value={stg}>{stg}</option>
                ))}
              </select>
            </div>

            {/* Filter: Origination Source */}
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Origination Source</label>
              <select
                value={filterSource}
                onChange={e => setFilterSource(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  marginTop: '4px',
                  outline: 'none'
                }}
              >
                <option value="ALL">All Lead Sources</option>
                {leadSources.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter: Status */}
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Lead Status</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  marginTop: '4px',
                  outline: 'none'
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE (In Pursuit)</option>
                <option value="QUALIFIED">QUALIFIED</option>
                <option value="NURTURE">NURTURE (Win-Back Pool)</option>
                <option value="DISQUALIFIED">DISQUALIFIED</option>
                <option value="CONVERTED">CONVERTED (Won Deal)</option>
              </select>
            </div>

            {/* Filter: PLD Score Band */}
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>PLD Score Band</label>
              <select
                value={filterScoreBand}
                onChange={e => setFilterScoreBand(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  marginTop: '4px',
                  outline: 'none'
                }}
              >
                <option value="ALL">All Score Bands</option>
                <option value="HIGH">High Priority (80 - 100)</option>
                <option value="QUALIFIED">Qualified Band (60 - 79)</option>
                <option value="DEV">Development Band (30 - 59)</option>
                <option value="NURTURE">Nurture Band (0 - 29)</option>
              </select>
            </div>

            {/* Filter: ICP Knockout */}
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ICP Knockout</label>
              <select
                value={filterIcp}
                onChange={e => setFilterIcp(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  marginTop: '4px',
                  outline: 'none'
                }}
              >
                <option value="ALL">All Fit States</option>
                <option value="PASSED">ICP Passed (No Knockouts)</option>
                <option value="KNOCKOUT">Knockout Triggered</option>
              </select>
            </div>

            {/* Filter: Country */}
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Country</label>
              <select
                value={filterCountry}
                onChange={e => setFilterCountry(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  marginTop: '4px',
                  outline: 'none'
                }}
              >
                <option value="ALL">All Countries</option>
                {availableCountries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Filter: Target Account */}
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Target Account Tier</label>
              <select
                value={filterTargetAccount}
                onChange={e => setFilterTargetAccount(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  marginTop: '4px',
                  outline: 'none'
                }}
              >
                <option value="ALL">All Accounts</option>
                <option value="TARGET">Strategic Target Accounts Only</option>
                <option value="STANDARD">Standard Prospect Accounts</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Leads Master Directory Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{
          padding: '16px 22px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-surface)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
              Master Lead Records
            </span>
            <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
              Showing {filteredLeads.length} of {leads.length} Leads
            </span>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Click any lead row to inspect complete account, contact, problems, and qualification details.
          </div>
        </div>

        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '12px 14px', width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={filteredLeads.length > 0 && selectedLeadIds.length === filteredLeads.length}
                    onChange={handleToggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Company / Account</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Location</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Primary Product</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Key Contact</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Assigned Owner</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Stage &amp; Status</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>PLD Score</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Est. Value</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={32} color="var(--text-muted)" />
                      <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>No lead records matched your filter criteria</span>
                      <button
                        className="btn btn-outline"
                        onClick={clearAllFilters}
                        style={{ marginTop: '8px', fontSize: '0.78rem' }}
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const isSelected = selectedLeadIds.includes(lead.id);
                  const pldScore = lead.pld_score ?? 0;
                  const isHighFit = pldScore >= 80;
                  const isQualified = pldScore >= 60 && pldScore < 80;

                  return (
                    <tr
                      key={lead.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: isSelected ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                      className="table-row-hover"
                    >
                      {/* Checkbox */}
                      <td style={{ padding: '14px' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(lead.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>

                      {/* Company Name & Account */}
                      <td style={{ padding: '14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span 
                              onClick={() => setInspectingLead(lead)}
                              style={{ fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}
                            >
                              {lead.account_name}
                            </span>
                            {lead.is_target_account && (
                              <span className="badge badge-primary" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                                {lead.target_tier || 'Target'}
                              </span>
                            )}
                          </div>
                          {lead.domain && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {lead.domain}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Location */}
                      <td style={{ padding: '14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                          <MapPin size={13} color="var(--text-muted)" />
                          <span>
                            {lead.account_city ? `${lead.account_city}, ` : ''}{lead.account_country || 'Saudi Arabia'}
                          </span>
                        </div>
                      </td>

                      {/* Product */}
                      <td style={{ padding: '14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {lead.primary_product_name}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {lead.primary_product_code}
                          </span>
                        </div>
                      </td>

                      {/* Contact */}
                      <td style={{ padding: '14px' }}>
                        {lead.contact_name ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{lead.contact_name}</span>
                            {lead.contact_email && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{lead.contact_email}</span>
                            )}
                            {lead.contact_phone && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{lead.contact_phone}</span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>
                            No stakeholder linked
                          </span>
                        )}
                      </td>

                      {/* Assigned Owner (Staff) with Quick Reassign Button */}
                      <td style={{ padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {lead.owner_name ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{lead.owner_name}</span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{lead.owner_email}</span>
                            </div>
                          ) : (
                            <span className="badge badge-warning" style={{ fontSize: '0.68rem' }}>
                              Unassigned
                            </span>
                          )}

                          <button
                            onClick={() => {
                              setReassignModalLead(lead);
                              setTargetOwnerId(lead.owner ? String(lead.owner) : '');
                            }}
                            data-testid="admin-reassign-btn"
                            title="Reassign lead owner"
                            style={{
                              background: 'rgba(79, 70, 229, 0.1)',
                              border: '1px solid rgba(79, 70, 229, 0.25)',
                              color: '#6366F1',
                              borderRadius: '4px',
                              padding: '3px 6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontSize: '0.68rem',
                              fontWeight: 600
                            }}
                          >
                            <UserCheck size={12} />
                            Reassign
                          </button>
                        </div>
                      </td>

                      {/* Stage & Status */}
                      <td style={{ padding: '14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span className="badge badge-neutral" style={{ fontSize: '0.7rem', width: 'fit-content' }}>
                            {lead.current_stage_name || lead.current_stage_code || 'Inbound'}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: lead.status === 'ACTIVE' ? '#10B981' : lead.status === 'NURTURE' ? '#F59E0B' : 'var(--text-muted)', fontWeight: 600 }}>
                            {lead.status}
                          </span>
                        </div>
                      </td>

                      {/* PLD Score */}
                      <td style={{ padding: '14px' }}>
                        {lead.pld_score !== null && lead.pld_score !== undefined ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              fontWeight: 800,
                              fontSize: '0.85rem',
                              color: isHighFit ? '#10B981' : isQualified ? '#3B82F6' : '#F59E0B'
                            }}>
                              {pldScore}/100
                            </span>
                            <span className={`badge ${isHighFit ? 'badge-success' : isQualified ? 'badge-primary' : 'badge-neutral'}`} style={{ fontSize: '0.62rem' }}>
                              {lead.score_classification || (isHighFit ? 'High Fit' : isQualified ? 'Qualified' : 'Review')}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Est Value */}
                      <td style={{ padding: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {lead.estimated_opportunity_value ? `$${Number(lead.estimated_opportunity_value).toLocaleString()}` : '-'}
                      </td>

                      {/* Action Buttons */}
                      <td style={{ padding: '14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => setInspectingLead(lead)}
                            className="btn btn-outline admin-inspect-btn"
                            data-testid="admin-inspect-lead-btn"
                            style={{ padding: '5px 9px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Inspect complete lead information"
                          >
                            <Eye size={13} />
                            All Info
                          </button>

                          {onNavigateToTab && (
                            <button
                              onClick={() => onNavigateToTab('queue', lead.id)}
                              className="btn btn-primary"
                              style={{ padding: '5px 9px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                              title="Open in Qualification Workspace"
                            >
                              Qualify
                              <ArrowRight size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Single Lead Reassignment Modal */}
      {reassignModalLead && typeof document !== 'undefined' && createPortal(
        <div 
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submittingReassign) setReassignModalLead(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
        >
          <div 
            className="modal-card animate-scale-up" 
            style={{ width: '100%', maxWidth: '480px', maxHeight: 'calc(100vh - 48px)', padding: '24px', position: 'relative', margin: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Reassign Lead Ownership</h3>
              </div>
              <button 
                onClick={() => setReassignModalLead(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              As an Administrator, you can assign or reassign this lead to any active sales representative. The new owner will immediately view and manage this lead.
            </p>

            <div style={{
              padding: '12px 14px',
              background: 'var(--bg-surface-elevated, #FAFAFA)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {reassignModalLead.account_name}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                Product: <strong>{reassignModalLead.primary_product_name}</strong> • Current Owner: <strong>{reassignModalLead.owner_name || 'Unassigned'}</strong>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Select New Sales Staff Member <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                value={targetOwnerId}
                onChange={e => setTargetOwnerId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.84rem',
                  marginTop: '6px',
                  outline: 'none'
                }}
              >
                <option value="">-- Choose Sales Staff Representative --</option>
                {salesStaffOptions.map(u => (
                  <option key={u.id} value={String(u.id)}>
                    {u.first_name} {u.last_name} ({u.role}) • {u.email}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn btn-outline"
                onClick={() => setReassignModalLead(null)}
                disabled={submittingReassign}
                style={{ padding: '8px 14px', fontSize: '0.82rem' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleExecuteReassignment([reassignModalLead.id], targetOwnerId)}
                disabled={submittingReassign || !targetOwnerId}
                style={{ padding: '8px 16px', fontSize: '0.82rem' }}
              >
                {submittingReassign ? 'Reassigning...' : 'Confirm Reassignment'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 6. Bulk Reassignment Modal */}
      {showBulkReassignModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submittingReassign) setShowBulkReassignModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
        >
          <div 
            className="modal-card animate-scale-up" 
            style={{ width: '100%', maxWidth: '500px', maxHeight: 'calc(100vh - 48px)', padding: '24px', position: 'relative', margin: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Bulk Reassign ({selectedLeadIds.length}) Leads</h3>
              </div>
              <button 
                onClick={() => setShowBulkReassignModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Assign all {selectedLeadIds.length} selected leads to a designated sales representative in a single batch operation.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Target Sales Staff Member <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                value={targetOwnerId}
                onChange={e => setTargetOwnerId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.84rem',
                  marginTop: '6px',
                  outline: 'none'
                }}
              >
                <option value="">-- Choose Sales Staff Representative --</option>
                {salesStaffOptions.map(u => (
                  <option key={u.id} value={String(u.id)}>
                    {u.first_name} {u.last_name} ({u.role}) • {u.email}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn btn-outline"
                onClick={() => setShowBulkReassignModal(false)}
                disabled={submittingReassign}
                style={{ padding: '8px 14px', fontSize: '0.82rem' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleExecuteReassignment(selectedLeadIds, targetOwnerId)}
                disabled={submittingReassign || !targetOwnerId}
                style={{ padding: '8px 16px', fontSize: '0.82rem' }}
              >
                {submittingReassign ? 'Reassigning Batch...' : `Reassign ${selectedLeadIds.length} Leads`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 7. Comprehensive Lead 360 Inspection Centered Modal ("All Lead Info") */}
      {inspectingLead && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-overlay"
          data-testid="admin-lead-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInspectingLead(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px',
            zIndex: 100000,
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
        >
          <div
            className="modal-card animate-scale-up"
            data-testid="admin-lead-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-lead-inspection-modal-title"
            style={{
              width: '100%',
              maxWidth: '860px',
              maxHeight: 'calc(100vh - 48px)',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-surface, #FFFFFF)',
              borderRadius: '16px',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border-subtle)',
              position: 'relative',
              overflow: 'hidden',
              margin: 'auto'
            }}
          >
            {/* Top Accent Gradient Bar */}
            <div style={{
              height: '4px',
              width: '100%',
              background: 'linear-gradient(90deg, #4F46E5 0%, #06B6D4 100%)',
              flexShrink: 0
            }} />

            {/* Modal Header */}
            <div 
              className="modal-card-header"
              style={{
                padding: '20px 24px 16px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '16px',
                background: 'var(--bg-surface)',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', minWidth: 0 }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
                  border: '1px solid rgba(79, 70, 229, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary, #4F46E5)',
                  flexShrink: 0,
                  marginTop: '2px'
                }}>
                  <Building2 size={24} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2
                      id="admin-lead-inspection-modal-title"
                      style={{
                        fontSize: '1.35rem',
                        fontWeight: 800,
                        margin: 0,
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.02em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {inspectingLead.account_name}
                    </h2>
                    {inspectingLead.is_target_account && (
                      <span className="badge badge-primary" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                        ⭐ {inspectingLead.target_tier || 'Target Account'}
                      </span>
                    )}
                    <span 
                      className={`badge ${inspectingLead.status === 'ACTIVE' ? 'badge-success' : inspectingLead.status === 'NURTURE' ? 'badge-warning' : 'badge-neutral'}`}
                      style={{ fontSize: '0.68rem', padding: '2px 8px' }}
                    >
                      {inspectingLead.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span>Product: <strong style={{ color: 'var(--text-primary)' }}>{inspectingLead.primary_product_name}</strong> ({inspectingLead.primary_product_code})</span>
                    <span>•</span>
                    <span>Lead ID: <code style={{ fontSize: '0.72rem', background: 'var(--bg-surface-elevated, #F3F4F6)', padding: '1px 5px', borderRadius: '4px' }}>{inspectingLead.id.substring(0, 8)}</code></span>
                    {inspectingLead.account_country && (
                      <>
                        <span>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <MapPin size={11} /> {inspectingLead.account_city ? `${inspectingLead.account_city}, ` : ''}{inspectingLead.account_country}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setInspectingLead(null)}
                data-testid="admin-close-drawer-btn"
                className="admin-close-drawer-btn"
                style={{
                  background: 'rgba(0, 0, 0, 0.05)',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                title="Close Lead Info Modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface)',
              padding: '0 24px',
              gap: '24px',
              overflowX: 'auto',
              flexShrink: 0
            }}>
              {[
                { key: 'profile', label: 'Account & Stakeholder', icon: <Building2 size={15} /> },
                { key: 'pld', label: 'PLD & ICP Qualification', icon: <ShieldCheck size={15} /> },
                { key: 'actions', label: 'Next Actions & SLA', icon: <Clock size={15} /> },
                { key: 'governance', label: 'Admin Governance', icon: <UserCheck size={15} /> },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setDrawerTab(tab.key as any)}
                  style={{
                    padding: '12px 2px',
                    border: 'none',
                    background: 'transparent',
                    color: drawerTab === tab.key ? 'var(--primary, #4F46E5)' : 'var(--text-secondary)',
                    fontWeight: drawerTab === tab.key ? 700 : 500,
                    fontSize: '0.84rem',
                    borderBottom: drawerTab === tab.key ? '2px solid var(--primary, #4F46E5)' : '2px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Modal Body: Scrollable with Clean Grid Cards */}
            <div 
              className="modal-scroll-body"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}
            >
              {/* TAB 1: Profile */}
              {drawerTab === 'profile' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Account Overview Card */}
                  <div style={{
                    padding: '20px',
                    borderRadius: '12px',
                    background: 'var(--bg-surface-elevated, #FAFAFA)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <Building2 size={16} color="var(--primary, #4F46E5)" />
                      Corporate Account Organization
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', fontSize: '0.82rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '3px' }}>Company Name</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{inspectingLead.account_name}</span>
                      </div>

                      <div>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '3px' }}>Corporate Domain</span>
                        {inspectingLead.domain ? (
                          <span style={{ fontWeight: 600, color: 'var(--primary, #4F46E5)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {inspectingLead.domain}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not configured</span>
                        )}
                      </div>

                      <div>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '3px' }}>Location / Place</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {inspectingLead.account_city ? `${inspectingLead.account_city}, ` : ''}{inspectingLead.account_country || 'Saudi Arabia'}
                        </span>
                      </div>

                      <div>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '3px' }}>Industry &amp; Scale</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {inspectingLead.industry || 'FMCG / Retail'} • {inspectingLead.employees_count || 100} FTEs
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Primary Stakeholder Card */}
                  <div style={{
                    padding: '20px',
                    borderRadius: '12px',
                    background: 'var(--bg-surface-elevated, #FAFAFA)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <Users size={16} color="var(--primary, #4F46E5)" />
                      Primary Customer Stakeholder
                    </h4>

                    {inspectingLead.contact_name ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', fontSize: '0.82rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '3px' }}>Contact Name</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{inspectingLead.contact_name}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '3px' }}>Designation / Title</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inspectingLead.contact_designation || 'Key Decision Maker'}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '3px' }}>Direct Email</span>
                          {inspectingLead.contact_email ? (
                            <a href={`mailto:${inspectingLead.contact_email}`} style={{ fontWeight: 600, color: 'var(--primary, #4F46E5)', textDecoration: 'none' }}>
                              {inspectingLead.contact_email}
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>None provided</span>
                          )}
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '3px' }}>Direct Phone / Mobile</span>
                          {inspectingLead.contact_phone ? (
                            <a href={`tel:${inspectingLead.contact_phone}`} style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}>
                              {inspectingLead.contact_phone}
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>None provided</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic', padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                        No primary contact stakeholder has been attached to this lead record yet.
                      </div>
                    )}
                  </div>

                  {/* Commercial Deal Size Card */}
                  <div style={{
                    padding: '20px',
                    borderRadius: '12px',
                    background: 'var(--bg-surface-elevated, #FAFAFA)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <DollarSign size={16} color="var(--primary, #4F46E5)" />
                      Commercial Parameters
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', fontSize: '0.82rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '3px' }}>Estimated Opportunity Value</span>
                        <span style={{ fontWeight: 800, color: '#10B981', fontSize: '1.2rem' }}>
                          ${Number(inspectingLead.estimated_opportunity_value || 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '3px' }}>Timeline Expectation</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inspectingLead.timeline_expectation || 'Immediate / Q1'}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '3px' }}>Lead Source &amp; Attribution</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inspectingLead.source_name || inspectingLead.source || 'Direct Outreach / Web Inbound'}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSourceId(inspectingLead.source || '');
                              setShowEditSourceModal(true);
                            }}
                            style={{
                              background: 'rgba(99, 102, 241, 0.12)',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                              color: '#6366F1',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '3px' }}>Intake Timestamp</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inspectingLead.created_at}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PLD & ICP Qualification */}
              {drawerTab === 'pld' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Score & ICP Overview */}
                  <div style={{
                    padding: '20px',
                    borderRadius: '12px',
                    background: 'var(--bg-surface-elevated, #FAFAFA)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        PLD QUALIFICATION SCORE
                      </div>
                      <div style={{ fontSize: '2.2rem', fontWeight: 900, color: (inspectingLead.pld_score ?? 0) >= 60 ? '#10B981' : (inspectingLead.pld_score ?? 0) >= 30 ? '#3B82F6' : '#F59E0B', margin: '4px 0' }}>
                        {inspectingLead.pld_score !== null && inspectingLead.pld_score !== undefined ? `${inspectingLead.pld_score} / 100` : 'Not Scored'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Score Classification: <strong style={{ color: 'var(--text-primary)' }}>{inspectingLead.score_classification || 'NURTURE'}</strong>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                        ICP FIT STATUS
                      </div>
                      <div>
                        {inspectingLead.icp_knockout_passed === false ? (
                          <span className="badge badge-warning" style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
                            ⚠️ Knockout Triggered
                          </span>
                        ) : (
                          <span className="badge badge-success" style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
                            ✓ ICP Knockout Passed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recorded Problems Box */}
                  <div style={{
                    padding: '20px',
                    borderRadius: '12px',
                    background: 'var(--bg-surface-elevated, #FAFAFA)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <AlertCircle size={16} color="var(--primary, #4F46E5)" />
                      Recorded Operational Problems &amp; Pains
                    </h4>

                    {inspectingLead.recorded_problems && inspectingLead.recorded_problems.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {inspectingLead.recorded_problems.map((prob, idx) => (
                          <div 
                            key={prob.id || idx}
                            style={{
                              padding: '14px',
                              borderRadius: '8px',
                              background: 'var(--bg-surface, #FFFFFF)',
                              border: '1px solid var(--border-subtle)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                                {prob.problem_detail?.name || prob.problem || 'Operational Pain Point'}
                              </span>
                              <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>
                                {prob.problem_detail?.category || 'OPERATIONAL'}
                              </span>
                            </div>
                            {prob.notes && (
                              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '8px 0 0 0', lineHeight: 1.4 }}>
                                {prob.notes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic', padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                        No specific operational problem items have been recorded for this lead yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: Next Actions & SLA */}
              {drawerTab === 'actions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{
                    padding: '20px',
                    borderRadius: '12px',
                    background: 'var(--bg-surface-elevated, #FAFAFA)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <Clock size={16} color="var(--primary, #4F46E5)" />
                      Next Action &amp; Operating Cadence
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.84rem' }}>
                      <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '3px' }}>Current Pipeline Stage</span>
                        <span style={{ fontWeight: 700, color: 'var(--primary, #4F46E5)', fontSize: '1rem' }}>
                          {inspectingLead.current_stage_name || inspectingLead.current_stage_code || 'Inbound'}
                        </span>
                      </div>

                      <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '3px' }}>Next Scheduled Activity</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                          {inspectingLead.next_action_description || 'No action scheduled'}
                        </span>
                      </div>

                      <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '3px' }}>Due Date &amp; SLA Status</span>
                        <span style={{ fontWeight: 600, color: inspectingLead.next_activity_due_at ? 'var(--text-primary)' : '#EF4444' }}>
                          {inspectingLead.next_activity_due_at || '⚠️ Missing future scheduled action'}
                        </span>
                      </div>

                      <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '3px' }}>Last Touch / Touchpoint</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {inspectingLead.last_activity_at || 'Inbound creation'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Admin Governance */}
              {drawerTab === 'governance' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{
                    padding: '20px',
                    borderRadius: '12px',
                    background: 'var(--bg-surface-elevated, #FAFAFA)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <UserCheck size={16} color="var(--primary, #4F46E5)" />
                      Lead Ownership Administration
                    </h4>

                    <div style={{ padding: '14px 16px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
                      <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px' }}>Currently Assigned Staff Representative</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1rem' }}>
                          {inspectingLead.owner_name || 'Unassigned'}
                        </span>
                        {inspectingLead.owner_email && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            ({inspectingLead.owner_email})
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        Transfer Lead to Different Staff Member
                      </label>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <select
                          value={targetOwnerId || (inspectingLead.owner ? String(inspectingLead.owner) : '')}
                          onChange={e => setTargetOwnerId(e.target.value)}
                          style={{
                            flex: 1,
                            minWidth: '240px',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            fontSize: '0.84rem',
                            outline: 'none'
                          }}
                        >
                          <option value="">-- Choose Sales Staff Representative --</option>
                          {salesStaffOptions.map(u => (
                            <option key={u.id} value={String(u.id)}>
                              {u.first_name} {u.last_name} ({u.role}) • {u.email}
                            </option>
                          ))}
                        </select>

                        <button
                          className="btn btn-primary"
                          disabled={submittingReassign || !targetOwnerId || targetOwnerId === String(inspectingLead.owner)}
                          onClick={() => handleExecuteReassignment([inspectingLead.id], targetOwnerId)}
                          style={{ padding: '10px 18px', fontSize: '0.84rem', whiteSpace: 'nowrap' }}
                        >
                          {submittingReassign ? 'Transferring...' : 'Transfer Lead'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Sticky Footer */}
            <div 
              className="modal-footer"
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-surface)',
                flexShrink: 0,
                gap: '12px',
                flexWrap: 'wrap'
              }}
            >
              <button
                className="btn btn-outline"
                onClick={() => setInspectingLead(null)}
                style={{ padding: '8px 18px', fontSize: '0.82rem' }}
              >
                Close Modal
              </button>

              {onNavigateToTab && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const id = inspectingLead.id;
                    setInspectingLead(null);
                    onNavigateToTab('queue', id);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', fontSize: '0.82rem' }}
                >
                  <span>Open in PLD Qualification Workspace</span>
                  <ExternalLink size={15} />
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: EDIT LEAD SOURCE */}
      {showEditSourceModal && inspectingLead && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 10001, backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '460px', padding: '24px', borderRadius: '12px', background: 'var(--bg-surface-elevated, #1E293B)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Share2 size={18} color="#6366F1" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Lead Origination Source</h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowEditSourceModal(false); setNewSourceName(''); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Assign where <strong>{inspectingLead.account_name}</strong> was generated from for marketing attribution and ROI tracking.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Select Origination Channel
                </label>
                <select
                  value={selectedSourceId}
                  onChange={(e) => setSelectedSourceId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="">-- Direct / Unspecified Inbound --</option>
                  {leadSources.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Or Add a New Channel
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="e.g. TikTok Ads, Trade Fair 2026, Cold Call"
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem'
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={savingSource || !newSourceName.trim()}
                    onClick={async () => {
                      if (!newSourceName.trim()) return;
                      setSavingSource(true);
                      try {
                        const created = await api.createLeadSource({ name: newSourceName.trim() });
                        setLeadSources(prev => [...prev.filter(s => s.id !== created.id), created]);
                        setSelectedSourceId(created.id);
                        setNewSourceName('');
                        inAppAlert.success(`Source "${created.name}" created! Click Save below to apply.`);
                      } catch (err: any) {
                        inAppAlert.error(err.message || 'Failed to create lead source');
                      } finally {
                        setSavingSource(false);
                      }
                    }}
                    style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                  >
                    + Create
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setShowEditSourceModal(false); setNewSourceName(''); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingSource}
                onClick={async () => {
                  setSavingSource(true);
                  try {
                    const updated = await api.updateLead(inspectingLead.id, { source: selectedSourceId || null });
                    setInspectingLead(prev => prev ? {
                      ...prev,
                      source: updated.source,
                      source_name: updated.source_name
                    } : null);
                    setShowEditSourceModal(false);
                    inAppAlert.success('Lead source updated successfully!');
                    onRefresh();
                  } catch (err: any) {
                    inAppAlert.error(err.message || 'Failed to update lead source');
                  } finally {
                    setSavingSource(false);
                  }
                }}
              >
                {savingSource ? 'Saving...' : 'Save Lead Source'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
