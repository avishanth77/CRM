import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Handshake, Building2, Shield, PlusCircle, 
  Trash2, Search, AlertCircle, X, Globe, RefreshCw, Edit2, Power, PowerOff
} from 'lucide-react';
import { api } from '../services/api';
import type { AuthUser } from '../services/api';
import { inAppAlert } from './common/InAppAlert';
import { Modal } from './common/Modal';

interface AdminStaffPartnersWorkspaceProps {
  currentUser: AuthUser | null;
  onNotify: (msg: string) => void;
}

export const AdminStaffPartnersWorkspace: React.FC<AdminStaffPartnersWorkspaceProps> = ({ 
  currentUser, 
  onNotify 
}) => {
  const [activeTab, setActiveTab] = useState<'staff' | 'partners'>('staff');
  const [staffList, setStaffList] = useState<AuthUser[]>([]);
  const [partnersList, setPartnersList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [showAddStaffModal, setShowAddStaffModal] = useState<boolean>(false);
  const [showAddPartnerModal, setShowAddPartnerModal] = useState<boolean>(false);
  const [showAddPartnerUserModal, setShowAddPartnerUserModal] = useState<boolean>(false);
  const [selectedPartnerForUser, setSelectedPartnerForUser] = useState<any | null>(null);

  // New Staff Form State
  const [staffFirstName, setStaffFirstName] = useState('');
  const [staffLastName, setStaffLastName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState('PLD_EXECUTIVE');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffTerritory, setStaffTerritory] = useState('Saudi Arabia / GCC');
  const [staffPhone, setStaffPhone] = useState('');
  const [submittingStaff, setSubmittingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);

  // New Partner Form State
  const [partnerCompanyName, setPartnerCompanyName] = useState('');
  const [partnerDomain, setPartnerDomain] = useState('');
  const [partnerCode, setPartnerCode] = useState('');
  const [partnerType, setPartnerType] = useState('ERP');
  const [partnerTerritory, setPartnerTerritory] = useState('Saudi Arabia');
  const [partnerContactName, setPartnerContactName] = useState('');
  const [partnerContactEmail, setPartnerContactEmail] = useState('');
  const [partnerContactPassword, setPartnerContactPassword] = useState('');
  const [partnerUserRole, setPartnerUserRole] = useState('SALES');
  const [submittingPartner, setSubmittingPartner] = useState(false);
  const [partnerError, setPartnerError] = useState<string | null>(null);

  // New Partner User Form State (for existing partner)
  const [newPuFirstName, setNewPuFirstName] = useState('');
  const [newPuLastName, setNewPuLastName] = useState('');
  const [newPuEmail, setNewPuEmail] = useState('');
  const [newPuPassword, setNewPuPassword] = useState('');
  const [newPuRole, setNewPuRole] = useState('SALES');
  const [submittingPu, setSubmittingPu] = useState(false);
  const [puError, setPuError] = useState<string | null>(null);

  // Edit Partner Modal State
  const [showEditPartnerModal, setShowEditPartnerModal] = useState<boolean>(false);
  const [selectedPartnerToEdit, setSelectedPartnerToEdit] = useState<any | null>(null);
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editDomain, setEditDomain] = useState('');
  const [editPartnerCode, setEditPartnerCode] = useState('');
  const [editPartnerType, setEditPartnerType] = useState('ERP');
  const [editTerritory, setEditTerritory] = useState('Saudi Arabia');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [editNotes, setEditNotes] = useState('');
  const [submittingEditPartner, setSubmittingEditPartner] = useState(false);
  const [editPartnerError, setEditPartnerError] = useState<string | null>(null);

  // Deactivate Partner Modal State
  const [showDeactivatePartnerModal, setShowDeactivatePartnerModal] = useState<boolean>(false);
  const [selectedPartnerToDeactivate, setSelectedPartnerToDeactivate] = useState<any | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('Deactivated by platform administrator.');
  const [submittingDeactivatePartner, setSubmittingDeactivatePartner] = useState(false);

  // Delete Partner Modal State
  const [showDeletePartnerModal, setShowDeletePartnerModal] = useState<boolean>(false);
  const [selectedPartnerToDelete, setSelectedPartnerToDelete] = useState<any | null>(null);
  const [submittingDeletePartner, setSubmittingDeletePartner] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [staffRes, partnersRes] = await Promise.all([
        api.getStaffUsers().catch(() => ({ results: [] })),
        api.getPartners().catch(() => ({ results: [] }))
      ]);
      setStaffList(staffRes.results || []);
      setPartnersList(partnersRes.results || []);
    } catch (e) {
      console.error('Failed to load staff & partners data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError(null);
    setSubmittingStaff(true);
    try {
      const res = await api.createStaffUser({
        first_name: staffFirstName,
        last_name: staffLastName,
        email: staffEmail,
        role: staffRole,
        password: staffPassword,
        territory: staffTerritory,
        phone: staffPhone
      });
      onNotify(res.message || 'Staff member added successfully!');
      setShowAddStaffModal(false);
      // Reset form
      setStaffFirstName('');
      setStaffLastName('');
      setStaffEmail('');
      setStaffPhone('');
      loadData();
    } catch (err: any) {
      setStaffError(err.message || 'Failed to create staff user.');
    } finally {
      setSubmittingStaff(false);
    }
  };

  const handleDeleteStaff = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to remove staff member '${userName}'?`)) {
      return;
    }
    try {
      await api.deleteStaffUser(userId);
      onNotify(`Staff member '${userName}' removed.`);
      inAppAlert.success(`Staff member '${userName}' removed.`);
      loadData();
    } catch (err: any) {
      inAppAlert.error(err.message || 'Failed to remove staff member.');
    }
  };

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setPartnerError(null);
    setSubmittingPartner(true);
    try {
      const res = await api.createPartnerAdmin({
        company_name: partnerCompanyName,
        domain: partnerDomain,
        partner_code: partnerCode,
        partner_type: partnerType,
        territory: partnerTerritory,
        contact_name: partnerContactName,
        contact_email: partnerContactEmail,
        contact_password: partnerContactPassword,
        partner_role: partnerUserRole
      });
      onNotify(res.message || 'Partner organization registered successfully!');
      setShowAddPartnerModal(false);
      // Reset form
      setPartnerCompanyName('');
      setPartnerDomain('');
      setPartnerCode('');
      setPartnerContactName('');
      setPartnerContactEmail('');
      loadData();
    } catch (err: any) {
      setPartnerError(err.message || 'Failed to register partner.');
    } finally {
      setSubmittingPartner(false);
    }
  };

  const handleAddPartnerUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartnerForUser) return;
    setPuError(null);
    setSubmittingPu(true);
    try {
      const res = await api.addPartnerUser(selectedPartnerForUser.id, {
        first_name: newPuFirstName,
        last_name: newPuLastName,
        email: newPuEmail,
        password: newPuPassword,
        partner_role: newPuRole
      });
      onNotify(res.message || 'User added to partner organization!');
      setShowAddPartnerUserModal(false);
      setNewPuFirstName('');
      setNewPuLastName('');
      setNewPuEmail('');
      loadData();
    } catch (err: any) {
      setPuError(err.message || 'Failed to add user to partner.');
    } finally {
      setSubmittingPu(false);
    }
  };

  const handleOpenEditPartner = (partner: any) => {
    setSelectedPartnerToEdit(partner);
    setEditCompanyName(partner.company_name || '');
    setEditDomain(partner.domain || '');
    setEditPartnerCode(partner.partner_code || '');
    setEditPartnerType(partner.partner_type || 'ERP');
    setEditTerritory(partner.territory || 'Saudi Arabia');
    setEditStatus(partner.status || 'ACTIVE');
    setEditNotes(partner.notes || '');
    setEditPartnerError(null);
    setShowEditPartnerModal(true);
  };

  const handleUpdatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartnerToEdit) return;
    setSubmittingEditPartner(true);
    setEditPartnerError(null);
    try {
      await api.updatePartner(selectedPartnerToEdit.id, {
        company_name: editCompanyName.trim(),
        domain: editDomain.trim(),
        partner_code: editPartnerCode.trim().toUpperCase(),
        partner_type: editPartnerType,
        territory: editTerritory.trim(),
        status: editStatus,
        notes: editNotes.trim()
      });
      inAppAlert.success(`Partner "${editCompanyName}" updated successfully!`);
      onNotify(`Partner "${editCompanyName}" updated.`);
      setShowEditPartnerModal(false);
      loadData();
    } catch (err: any) {
      setEditPartnerError(err.message || 'Failed to update partner organization.');
    } finally {
      setSubmittingEditPartner(false);
    }
  };

  const handleOpenDeactivatePartner = (partner: any) => {
    setSelectedPartnerToDeactivate(partner);
    setDeactivateReason('Deactivated by platform administrator.');
    setShowDeactivatePartnerModal(true);
  };

  const handleConfirmDeactivate = async () => {
    if (!selectedPartnerToDeactivate) return;
    setSubmittingDeactivatePartner(true);
    try {
      await api.deactivatePartner(selectedPartnerToDeactivate.id, deactivateReason);
      inAppAlert.success(`Partner "${selectedPartnerToDeactivate.company_name}" has been deactivated.`);
      onNotify(`Partner "${selectedPartnerToDeactivate.company_name}" deactivated.`);
      setShowDeactivatePartnerModal(false);
      loadData();
    } catch (err: any) {
      inAppAlert.error(err.message || 'Failed to deactivate partner.');
    } finally {
      setSubmittingDeactivatePartner(false);
    }
  };

  const handleActivatePartner = async (partner: any) => {
    try {
      await api.activatePartner(partner.id, 'Re-activated by platform administrator.');
      inAppAlert.success(`Partner "${partner.company_name}" has been activated.`);
      onNotify(`Partner "${partner.company_name}" activated.`);
      loadData();
    } catch (err: any) {
      inAppAlert.error(err.message || 'Failed to activate partner.');
    }
  };

  const handleOpenDeletePartner = (partner: any) => {
    setSelectedPartnerToDelete(partner);
    setShowDeletePartnerModal(true);
  };

  const handleConfirmDeletePartner = async () => {
    if (!selectedPartnerToDelete) return;
    setSubmittingDeletePartner(true);
    try {
      await api.deletePartner(selectedPartnerToDelete.id);
      inAppAlert.success(`Partner "${selectedPartnerToDelete.company_name}" deleted successfully.`);
      onNotify(`Partner "${selectedPartnerToDelete.company_name}" deleted.`);
      setShowDeletePartnerModal(false);
      loadData();
    } catch (err: any) {
      inAppAlert.error(err.message || 'Failed to delete partner.');
    } finally {
      setSubmittingDeletePartner(false);
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'badge-primary';
      case 'PLD_EXECUTIVE':
      case 'SDR':
        return 'badge-info';
      case 'SALES_BDM':
      case 'ACCOUNT_EXECUTIVE':
        return 'badge-success';
      case 'SALES_MANAGER':
        return 'badge-warning';
      case 'SOLUTION_CONSULTANT':
      case 'SOLUTIONS_CONSULTANT':
        return 'badge-neutral';
      case 'MANAGEMENT':
        return 'badge-warning';
      case 'PRODUCT_MANAGER':
        return 'badge-primary';
      case 'PARTNER_MANAGER':
        return 'badge-warning';
      case 'CUSTOMER_SUCCESS':
        return 'badge-success';
      case 'MARKETING':
        return 'badge-info';
      case 'FINANCE':
        return 'badge-neutral';
      default:
        return 'badge-neutral';
    }
  };

  const filteredStaff = staffList.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || 
           s.email.toLowerCase().includes(q) || 
           s.role_display.toLowerCase().includes(q) ||
           (s.territory && s.territory.toLowerCase().includes(q));
  });

  const filteredPartners = partnersList.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (p.company_name && p.company_name.toLowerCase().includes(q)) ||
           (p.partner_code && p.partner_code.toLowerCase().includes(q)) ||
           (p.territory && p.territory.toLowerCase().includes(q)) ||
           (p.partner_type && p.partner_type.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Workspace Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Shield size={20} color="#3B82F6" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Staff &amp; Partner Management
              </h1>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Platform Admin directory: provision internal commercial staff, assign RBAC roles, and manage external reseller partners.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-outline"
            onClick={loadData}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            title="Refresh list"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          {activeTab === 'staff' ? (
            <button 
              className="btn btn-primary"
              onClick={() => setShowAddStaffModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <UserPlus size={16} />
              Add Staff Member
            </button>
          ) : (
            <button 
              className="btn btn-primary"
              onClick={() => setShowAddPartnerModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Building2 size={16} />
              Register New Partner
            </button>
          )}
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('staff')}
          className={`btn ${activeTab === 'staff' ? 'btn-primary' : 'btn-outline'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
        >
          <Users size={16} />
          Internal Staff Directory ({staffList.length})
        </button>
        <button
          onClick={() => setActiveTab('partners')}
          className={`btn ${activeTab === 'partners' ? 'btn-primary' : 'btn-outline'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
        >
          <Handshake size={16} />
          Authorized Partners ({partnersList.length})
        </button>
      </div>

      {/* Search Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        padding: '8px 16px',
        maxWidth: '420px'
      }}>
        <Search size={16} color="var(--text-muted)" />
        <input
          type="text"
          placeholder={activeTab === 'staff' ? "Search staff by name, email, or role..." : "Search partners by name, code, or territory..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            outline: 'none',
            fontSize: '0.85rem',
            width: '100%'
          }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* TAB 1: STAFF DIRECTORY */}
      {activeTab === 'staff' && (
        <div className="space-y-6">
          {/* Staff Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Staff</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{staffList.length}</div>
              <div style={{ fontSize: '0.72rem', color: '#10B981', marginTop: '4px' }}>Active System Users</div>
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>PLD Specialists</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#06B6D4', marginTop: '4px' }}>
                {staffList.filter(s => s.role === 'PLD_EXECUTIVE' || s.role === 'SDR').length}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Discovery &amp; Qualification</div>
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sales AEs / BDMs</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10B981', marginTop: '4px' }}>
                {staffList.filter(s => s.role === 'SALES_BDM' || s.role === 'ACCOUNT_EXECUTIVE').length}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Opportunity Pipeline &amp; Closing</div>
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Managers &amp; Admins</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#8B5CF6', marginTop: '4px' }}>
                {staffList.filter(s => ['ADMIN', 'SALES_MANAGER', 'MANAGEMENT'].includes(s.role)).length}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Governance &amp; Approvals</div>
            </div>
          </div>

          {/* Staff Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '14px 20px' }}>Staff Member</th>
                  <th style={{ padding: '14px 20px' }}>Role</th>
                  <th style={{ padding: '14px 20px' }}>Email</th>
                  <th style={{ padding: '14px 20px' }}>Territory</th>
                  <th style={{ padding: '14px 20px' }}>Permissions</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No staff members found matching query. Click "Add Staff Member" to provision a user.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff) => {
                    const isSelf = currentUser?.id === staff.id;
                    return (
                      <tr key={staff.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: staff.role === 'ADMIN' ? '#4F46E5' : '#2563EB',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              color: '#FFFFFF'
                            }}>
                              {(staff.first_name?.[0] || staff.name?.[0] || 'U').toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                {staff.name} {isSelf && <span style={{ fontSize: '0.7rem', color: '#10B981' }}>(You)</span>}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                @{staff.username}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span className={`badge ${getRoleBadgeClass(staff.role)}`} style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                            {staff.role_display}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>
                          {staff.email}
                        </td>
                        <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>
                          {staff.territory || 'Global HQ'}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {staff.allowed_workspaces?.length ?? 0} Workspaces
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          {!isSelf && (
                            <button
                              onClick={() => handleDeleteStaff(staff.id, staff.name)}
                              className="btn btn-outline"
                              style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#F43F5E', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                              title="Delete staff account"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PARTNERS DIRECTORY */}
      {activeTab === 'partners' && (
        <div className="space-y-6">
          {/* Partner Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Partner Organizations</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{partnersList.length}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Reseller &amp; Implementation Network</div>
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Status</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10B981', marginTop: '4px' }}>
                {partnersList.filter(p => p.status === 'ACTIVE').length}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#10B981', marginTop: '4px' }}>Authorized &amp; Certified</div>
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Partner Users</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F43F5E', marginTop: '4px' }}>
                {partnersList.reduce((acc, p) => acc + (p.users?.length || 0), 0)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Portal Accounts Provisioned</div>
            </div>
          </div>

          {/* Partners Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
            {filteredPartners.length === 0 ? (
              <div className="card text-center" style={{ padding: '40px', gridColumn: '1 / -1', color: 'var(--text-muted)' }}>
                No partners found. Click "Register New Partner" to onboard your first partner organization.
              </div>
            ) : (
              filteredPartners.map((partner) => (
                <div key={partner.id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {partner.company_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        Code: {partner.partner_code}
                      </div>
                    </div>
                    <span className={`badge ${partner.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                      {partner.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                      {partner.partner_type_name || partner.partner_type}
                    </span>
                    <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                      <Globe size={11} style={{ marginRight: '4px' }} />
                      {partner.territory}
                    </span>
                  </div>

                  {/* Partner Users Section */}
                  <div style={{ marginTop: '6px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        Portal Users ({partner.users?.length || 0}):
                      </span>
                      <button
                        onClick={() => {
                          setSelectedPartnerForUser(partner);
                          setShowAddPartnerUserModal(true);
                        }}
                        className="btn btn-outline"
                        style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                      >
                        <PlusCircle size={12} style={{ marginRight: '4px' }} />
                        Add User
                      </button>
                    </div>

                    {(!partner.users || partner.users.length === 0) ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No portal users assigned yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {partner.users.map((pu: any) => (
                          <div 
                            key={pu.id} 
                            style={{ 
                              background: 'var(--bg-surface-elevated)', 
                              padding: '6px 10px', 
                              borderRadius: '6px',
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              fontSize: '0.75rem' 
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{pu.user_full_name || pu.user_email}</span>
                              <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>({pu.user_email})</span>
                            </div>
                            <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                              {pu.partner_role}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Partner Actions Footer */}
                  <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleOpenEditPartner(partner)}
                      className="btn btn-outline"
                      style={{ padding: '5px 10px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                      title="Edit partner organization details"
                    >
                      <Edit2 size={13} />
                      Edit
                    </button>

                    {partner.status === 'ACTIVE' ? (
                      <button
                        onClick={() => handleOpenDeactivatePartner(partner)}
                        className="btn btn-outline"
                        style={{ padding: '5px 10px', fontSize: '0.74rem', color: '#F59E0B', borderColor: 'rgba(245, 158, 11, 0.4)', display: 'flex', alignItems: 'center', gap: '5px' }}
                        title="Deactivate partner organization"
                      >
                        <PowerOff size={13} />
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => handleActivatePartner(partner)}
                        className="btn btn-outline"
                        style={{ padding: '5px 10px', fontSize: '0.74rem', color: '#10B981', borderColor: 'rgba(16, 185, 129, 0.4)', display: 'flex', alignItems: 'center', gap: '5px' }}
                        title="Activate partner organization"
                      >
                        <Power size={13} />
                        Activate
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenDeletePartner(partner)}
                      className="btn btn-outline"
                      style={{ padding: '5px 8px', fontSize: '0.74rem', color: '#F43F5E', borderColor: 'rgba(244, 63, 94, 0.3)', display: 'flex', alignItems: 'center', gap: '5px' }}
                      title="Permanently remove partner organization"
                    >
                      <Trash2 size={13} />
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD STAFF MEMBER */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* MODAL 1: ADD STAFF MEMBER */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showAddStaffModal}
        onClose={() => setShowAddStaffModal(false)}
        title="Add Staff Member"
        icon={<UserPlus size={20} color="#3B82F6" />}
        size="md"
        footer={
          <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setShowAddStaffModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" form="add-staff-form" disabled={submittingStaff} className="btn btn-primary">
              {submittingStaff ? 'Creating Staff Member...' : 'Create Staff User'}
            </button>
          </div>
        }
      >
        <div>
          {staffError && (
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '8px', color: '#F43F5E', fontSize: '0.8rem', display: 'flex', gap: '8px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{staffError}</span>
            </div>
          )}

          <form id="add-staff-form" onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>First Name *</label>
                <input
                  type="text"
                  required
                  value={staffFirstName}
                  onChange={(e) => setStaffFirstName(e.target.value)}
                  placeholder="e.g. Tariq"
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Last Name *</label>
                <input
                  type="text"
                  required
                  value={staffLastName}
                  onChange={(e) => setStaffLastName(e.target.value)}
                  placeholder="e.g. Al-Mansour"
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Work Email Address *</label>
              <input
                type="email"
                required
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                placeholder="tariq@texol.sa"
                style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Role &amp; Permissions *</label>
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                >
                  <option value="PLD_EXECUTIVE">PLD Executive / SDR</option>
                  <option value="SALES_BDM">Account Executive (Sales AE)</option>
                  <option value="SALES_MANAGER">Sales Manager</option>
                  <option value="SOLUTION_CONSULTANT">Solution Consultant</option>
                  <option value="PRODUCT_MANAGER">Product Manager</option>
                  <option value="PARTNER_MANAGER">Partner Manager</option>
                  <option value="CUSTOMER_SUCCESS">Customer Success</option>
                  <option value="MARKETING">Marketing &amp; Growth</option>
                  <option value="FINANCE">Finance / Operations</option>
                  <option value="MANAGEMENT">TEXOL Management</option>
                  <option value="ADMIN">Platform Administrator</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Initial Password *</label>
                <input
                  type="text"
                  required
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Territory / Region</label>
                <input
                  type="text"
                  value={staffTerritory}
                  onChange={(e) => setStaffTerritory(e.target.value)}
                  placeholder="e.g. Riyadh &amp; Central"
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Phone Number</label>
                <input
                  type="text"
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(e.target.value)}
                  placeholder="+966 50 123 4567"
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
            </div>
          </form>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: REGISTER NEW PARTNER */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showAddPartnerModal}
        onClose={() => setShowAddPartnerModal(false)}
        title="Register Partner Organization"
        icon={<Building2 size={20} color="#F43F5E" />}
        size="lg"
        footer={
          <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setShowAddPartnerModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" form="add-partner-form" disabled={submittingPartner} className="btn btn-primary">
              {submittingPartner ? 'Registering Partner...' : 'Register Partner Organization'}
            </button>
          </div>
        }
      >
        <div>
          {partnerError && (
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '8px', color: '#F43F5E', fontSize: '0.8rem', display: 'flex', gap: '8px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{partnerError}</span>
            </div>
          )}

          <form id="add-partner-form" onSubmit={handleCreatePartner} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
              1. Organization Details
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Company Name *</label>
                <input
                  type="text"
                  required
                  value={partnerCompanyName}
                  onChange={(e) => setPartnerCompanyName(e.target.value)}
                  placeholder="e.g. KAT IT Solutions"
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Partner Code *</label>
                <input
                  type="text"
                  required
                  value={partnerCode}
                  onChange={(e) => setPartnerCode(e.target.value)}
                  placeholder="e.g. KAT-IT-SA"
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Domain / Website</label>
                <input
                  type="text"
                  value={partnerDomain}
                  onChange={(e) => setPartnerDomain(e.target.value)}
                  placeholder="kat-it.sa"
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Partner Type *</label>
                <select
                  value={partnerType}
                  onChange={(e) => setPartnerType(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                >
                  <option value="ERP">ERP Partner</option>
                  <option value="SAP">SAP Partner</option>
                  <option value="ODOO">Odoo Partner</option>
                  <option value="MICROSOFT">Microsoft Partner</option>
                  <option value="SI">System Integrator</option>
                  <option value="CONSULTANT">Distribution Consultant</option>
                  <option value="REFERRAL">Referral Partner</option>
                  <option value="MOBILITY">Mobility Partner</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Territory *</label>
              <input
                type="text"
                required
                value={partnerTerritory}
                onChange={(e) => setPartnerTerritory(e.target.value)}
                placeholder="Saudi Arabia / GCC"
                style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
              />
            </div>

            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', marginTop: '10px' }}>
              2. Primary Partner Portal Account
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Contact Name</label>
                <input
                  type="text"
                  value={partnerContactName}
                  onChange={(e) => setPartnerContactName(e.target.value)}
                  placeholder="e.g. Sami Al-Khatib"
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Login Email *</label>
                <input
                  type="email"
                  required
                  value={partnerContactEmail}
                  onChange={(e) => setPartnerContactEmail(e.target.value)}
                  placeholder="partner@kat-it.sa"
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Initial Password *</label>
                <input
                  type="text"
                  required
                  value={partnerContactPassword}
                  onChange={(e) => setPartnerContactPassword(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Partner Role</label>
                <select
                  value={partnerUserRole}
                  onChange={(e) => setPartnerUserRole(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                >
                  <option value="ADMIN">Partner Admin</option>
                  <option value="SALES">Partner Sales</option>
                  <option value="PRESALES">Partner Presales</option>
                </select>
              </div>
            </div>
          </form>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: ADD USER TO EXISTING PARTNER */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showAddPartnerUserModal && Boolean(selectedPartnerForUser)}
        onClose={() => setShowAddPartnerUserModal(false)}
        title="Add Partner User"
        subtitle={selectedPartnerForUser ? `Organization: ${selectedPartnerForUser.company_name}` : undefined}
        size="md"
        footer={
          <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setShowAddPartnerUserModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" form="add-partner-user-form" disabled={submittingPu} className="btn btn-primary">
              {submittingPu ? 'Adding User...' : 'Add Partner User'}
            </button>
          </div>
        }
      >
        <div>
          {puError && (
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '8px', color: '#F43F5E', fontSize: '0.8rem', display: 'flex', gap: '8px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{puError}</span>
            </div>
          )}

          <form id="add-partner-user-form" onSubmit={handleAddPartnerUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>First Name *</label>
                <input
                  type="text"
                  required
                  value={newPuFirstName}
                  onChange={(e) => setNewPuFirstName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Last Name *</label>
                <input
                  type="text"
                  required
                  value={newPuLastName}
                  onChange={(e) => setNewPuLastName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Email (Login Username) *</label>
              <input
                type="email"
                required
                value={newPuEmail}
                onChange={(e) => setNewPuEmail(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Password *</label>
                <input
                  type="text"
                  required
                  value={newPuPassword}
                  onChange={(e) => setNewPuPassword(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Partner Role</label>
                <select
                  value={newPuRole}
                  onChange={(e) => setNewPuRole(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                >
                  <option value="ADMIN">Partner Admin</option>
                  <option value="SALES">Partner Sales</option>
                  <option value="PRESALES">Partner Presales</option>
                </select>
              </div>
            </div>
          </form>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: EDIT PARTNER ORGANIZATION */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showEditPartnerModal}
        onClose={() => setShowEditPartnerModal(false)}
        title="Edit Partner Organization"
        icon={<Edit2 size={20} color="#3B82F6" />}
        size="md"
        footer={
          <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setShowEditPartnerModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" form="edit-partner-form" disabled={submittingEditPartner} className="btn btn-primary">
              {submittingEditPartner ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        }
      >
        <div>
          {editPartnerError && (
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '8px', color: '#F43F5E', fontSize: '0.8rem', display: 'flex', gap: '8px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{editPartnerError}</span>
            </div>
          )}

          <form id="edit-partner-form" onSubmit={handleUpdatePartner} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Company Name *</label>
                <input
                  type="text"
                  required
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Partner Code *</label>
                <input
                  type="text"
                  required
                  value={editPartnerCode}
                  onChange={(e) => setEditPartnerCode(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', textTransform: 'uppercase' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Domain</label>
                <input
                  type="text"
                  value={editDomain}
                  onChange={(e) => setEditDomain(e.target.value)}
                  placeholder="e.g. partner.com"
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Partner Type</label>
                <select
                  value={editPartnerType}
                  onChange={(e) => setEditPartnerType(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                >
                  <option value="ERP">ERP Partner</option>
                  <option value="SAP">SAP Partner</option>
                  <option value="MICROSOFT">Microsoft Partner</option>
                  <option value="ODOO">Odoo Partner</option>
                  <option value="POS">POS Provider</option>
                  <option value="SI">System Integrator</option>
                  <option value="CONSULTANT">Distribution Consultant</option>
                  <option value="MOBILITY">Mobility Partner</option>
                  <option value="REFERRAL">Referral Partner</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Territory / Region</label>
                <input
                  type="text"
                  value={editTerritory}
                  onChange={(e) => setEditTerritory(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="ONBOARDING">Onboarding</option>
                  <option value="ENABLED">Enabled</option>
                  <option value="AUTHORISED">Authorised</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="PROSPECT">Prospect</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Notes / Commercial Agreements</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                placeholder="Contract notes, SLAs, or executive comments..."
                style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}
              />
            </div>
          </form>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 5: DEACTIVATE PARTNER CONFIRMATION */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showDeactivatePartnerModal}
        onClose={() => setShowDeactivatePartnerModal(false)}
        title="Deactivate Partner Organization"
        icon={<PowerOff size={20} color="#F59E0B" />}
        size="sm"
        footer={
          <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setShowDeactivatePartnerModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleConfirmDeactivate} 
              disabled={submittingDeactivatePartner} 
              className="btn btn-primary"
              style={{ background: '#F59E0B', borderColor: '#F59E0B' }}
            >
              {submittingDeactivatePartner ? 'Deactivating...' : 'Confirm Deactivate'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            Are you sure you want to deactivate <strong>{selectedPartnerToDeactivate?.company_name}</strong>?
          </p>
          <div style={{ padding: '10px 12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', fontSize: '0.8rem', color: '#D97706' }}>
            Associated portal users will be temporarily locked out and will not be able to access the Partner Portal until the organization is re-activated.
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Deactivation Reason</label>
            <input
              type="text"
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              placeholder="e.g. Contract expired or renewal under negotiation"
              style={{ width: '100%', padding: '8px 12px', marginTop: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 6: DELETE PARTNER CONFIRMATION */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showDeletePartnerModal}
        onClose={() => setShowDeletePartnerModal(false)}
        title="Delete Partner Organization"
        icon={<Trash2 size={20} color="#F43F5E" />}
        size="sm"
        footer={
          <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setShowDeletePartnerModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleConfirmDeletePartner} 
              disabled={submittingDeletePartner} 
              className="btn btn-primary"
              style={{ background: '#F43F5E', borderColor: '#F43F5E' }}
            >
              {submittingDeletePartner ? 'Deleting...' : 'Delete Partner'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            Are you sure you want to permanently delete <strong>{selectedPartnerToDelete?.company_name}</strong> ({selectedPartnerToDelete?.partner_code})?
          </p>
          <div style={{ padding: '10px 12px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '8px', fontSize: '0.8rem', color: '#F43F5E' }}>
            Warning: This action will remove the partner from the reseller registry and deactivate all associated partner portal accounts.
          </div>
        </div>
      </Modal>
    </div>
  );
};
