import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Layers, Target, CheckCircle2, 
  ArrowRight, ShieldCheck, Settings, Sparkles, 
  TrendingUp, Clock, Search, PlusCircle, RefreshCw, Briefcase, 
  Check, X, Compass, CheckSquare, Handshake, 
  FlaskConical, History, Share2, Gauge, Send, Database
} from 'lucide-react';
import { api } from './services/api';
import type { FunnelData, Lead, Product, Discovery, SQLHandoff, Opportunity } from './services/api';
import { MultiTouchAttributionView } from './components/MultiTouchAttributionView';
import { FunnelLeakageVelocityView } from './components/FunnelLeakageVelocityView';
import { OmniChannelCommsView } from './components/OmniChannelCommsView';
import { ERPSyncGatewayView } from './components/ERPSyncGatewayView';
import { PLDQualificationWorkspace } from './components/PLDQualificationWorkspace';
import { AdminEngineStudio } from './components/AdminEngineStudio';
import { DiscoveryWorkspace } from './components/DiscoveryWorkspace';

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'queue' | 'discovery' | 'poc' | 'sql' | 'opportunities' | 'partners' | 'studio' | 'audit' | 'attribution' | 'leakage' | 'communications' | 'erp'
  >('dashboard');
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [sqlHandoffs, setSqlHandoffs] = useState<SQLHandoff[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [pocs, setPocs] = useState<any[]>([]);
  const [partnerDashboard, setPartnerDashboard] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('ALL');
  const [showIntakeModal, setShowIntakeModal] = useState<boolean>(false);
  const [showDealRegModal, setShowDealRegModal] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [studioView, setStudioView] = useState<'modules' | 'engine'>('engine');

  // New Lead Form State
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newIndustry, setNewIndustry] = useState('FMCG');
  const [newEmployees, setNewEmployees] = useState(100);
  const [newProductCode, setNewProductCode] = useState('VANFORCES');
  const [newNextAction, setNewNextAction] = useState('Schedule introductory discovery call');
  const [newIsTarget, setNewIsTarget] = useState(false);
  const [newTargetTier, setNewTargetTier] = useState('TIER_1');
  const [duplicateMatches, setDuplicateMatches] = useState<any[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  // SQL Rejection Modal State
  const [showSqlRejectModal, setShowSqlRejectModal] = useState(false);
  const [rejectHandoffId, setRejectHandoffId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectReturnTarget, setRejectReturnTarget] = useState<'DISCOVERY' | 'PLD' | 'NURTURE'>('DISCOVERY');

  // POC Not Required Modal State
  const [showPocNotRequiredModal, setShowPocNotRequiredModal] = useState(false);
  const [skipPocId, setSkipPocId] = useState<string | null>(null);
  const [skipPocReason, setSkipPocReason] = useState('');

  // New Deal Registration State
  const [regCustomerName, setRegCustomerName] = useState('');
  const [regProductCode, setRegProductCode] = useState('VANFORCES');
  const [regValue, setRegValue] = useState(75000);
  const [regEvidence, setRegEvidence] = useState('Client has 30 vans and requires immediate dispatch integration.');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fData, lData, pData, dData, sData, oData, pocData, pDash, aData, accData] = await Promise.all([
        api.getFunnelAnalytics().catch(() => null),
        api.getLeads().catch(() => ({ results: [] })),
        api.getProducts().catch(() => ({ results: [] })),
        api.getDiscoveries().catch(() => ({ results: [] })),
        api.getSQLHandoffs().catch(() => ({ results: [] })),
        api.getOpportunities().catch(() => ({ results: [] })),
        api.getPOCs().catch(() => ({ results: [] })),
        api.getPartnerPortalDashboard().catch(() => null),
        api.getAuditLogs().catch(() => ({ results: [] })),
        api.getAccounts().catch(() => ({ results: [] }))
      ]);
      setFunnelData(fData);
      setLeads(lData.results);
      setProducts(pData.results);
      setDiscoveries(dData.results);
      setSqlHandoffs(sData.results);
      setOpportunities(oData.results);
      setPocs(pocData.results);
      setPartnerDashboard(pDash);
      setAuditLogs(aData.results);
      setAccounts(accData.results || []);

      if (lData.results.length > 0 && !selectedLead) {
        setSelectedLead(lData.results[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const notifySuccess = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 4500);
  };

  const handleInspectLead = (lead: Lead) => {
    setSelectedLead(lead);
  };

  const handleAcceptSQL = async (handoffId: string) => {
    try {
      const res = await api.acceptSQLHandoff(handoffId);
      notifySuccess(res.message);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Acceptance failed');
    }
  };

  const openSqlReject = (handoffId: string) => {
    setRejectHandoffId(handoffId);
    setRejectReason('');
    setRejectReturnTarget('DISCOVERY');
    setShowSqlRejectModal(true);
  };

  const confirmSqlReject = async () => {
    if (!rejectHandoffId || !rejectReason.trim()) {
      alert('A documented rejection reason is mandatory.');
      return;
    }
    try {
      const res = await api.rejectSQLHandoff(rejectHandoffId, rejectReason, rejectReturnTarget);
      notifySuccess(res.message);
      setShowSqlRejectModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Rejection failed');
    }
  };

  const openSkipPoc = (pocId: string) => {
    setSkipPocId(pocId);
    setSkipPocReason('');
    setShowPocNotRequiredModal(true);
  };

  const confirmSkipPoc = async () => {
    if (!skipPocId || !skipPocReason.trim()) {
      alert('A documented reason is mandatory when marking a POC as Not Required.');
      return;
    }
    try {
      await api.markPOCNotRequired(skipPocId, skipPocReason);
      notifySuccess('POC marked as Not Required (Stage Skipped with governance audit).');
      setShowPocNotRequiredModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const handleCheckDuplicates = async (name: string, domainStr: string) => {
    if (!name && !domainStr) {
      setDuplicateMatches([]);
      return;
    }
    setCheckingDuplicates(true);
    try {
      const res = await api.checkDuplicates({
        company_name: name || undefined,
        domain: domainStr || undefined
      });
      setDuplicateMatches(res.duplicates || []);
    } catch {
      // ignore
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handleAcceptDealReg = async (regId: string) => {
    try {
      const res = await api.acceptDealRegistration(regId, 90);
      notifySuccess(res.message);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to accept deal registration');
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const acc = await api.createAccount({
        company_name: newCompanyName,
        domain: newDomain || undefined,
        industry: newIndustry,
        employees_count: Number(newEmployees),
        country: 'Saudi Arabia',
        is_target_account: newIsTarget,
        target_tier: newIsTarget ? newTargetTier : undefined
      });
      const selectedProduct = products.find(p => p.code === newProductCode) || products[0];

      await api.createLead({
        account: acc.id,
        primary_product: selectedProduct.id,
        next_activity_due_at: new Date(Date.now() + 86400000 * 2).toISOString(),
        next_action_description: newNextAction
      });

      setShowIntakeModal(false);
      setNewCompanyName('');
      setNewDomain('');
      setDuplicateMatches([]);
      notifySuccess(`New lead created & automatic ICP evaluated for ${selectedProduct.name}!`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create lead');
    }
  };

  const handleSubmitDealReg = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const acc = await api.createAccount({
        company_name: regCustomerName,
        industry: 'Distribution',
        country: 'Saudi Arabia'
      });
      const prod = products.find(p => p.code === regProductCode) || products[0];
      const partnersList = await api.getPartners();
      const katPartner = partnersList.results[0];

      const res = await api.submitDealRegistration({
        partner: katPartner.id,
        customer_account: acc.id,
        product: prod.id,
        expected_deal_value: Number(regValue),
        evidence_notes: regEvidence
      });

      setShowDealRegModal(false);
      setRegCustomerName('');
      if (res.conflict) {
        alert(res.message);
      } else {
        notifySuccess(res.message);
      }
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to submit deal registration');
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Toast Alert */}
      {actionSuccessMsg && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
          color: '#FFFFFF',
          padding: '14px 20px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 8px 30px rgba(16, 185, 129, 0.4)',
          fontWeight: 600,
          fontSize: '0.9rem'
        }}>
          <CheckCircle2 size={20} />
          {actionSuccessMsg}
        </div>
      )}

      {/* 1. Left Sidebar Navigation */}
      <aside style={{
        width: '260px',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px'
      }}>
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingLeft: '8px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(59, 130, 246, 0.4)'
          }}>
            <Sparkles size={20} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em', color: '#FFFFFF' }}>TEXOL CRM</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>CONFIGURABLE PLD ENGINE</div>
          </div>
        </div>

        {/* Global Product Scope Filter */}
        <div style={{ marginBottom: '18px', padding: '10px 12px', background: 'var(--bg-surface-elevated)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Product Scope</div>
          <select 
            value={selectedProductFilter}
            onChange={(e) => setSelectedProductFilter(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '6px 8px',
              fontSize: '0.82rem',
              fontWeight: 600
            }}
          >
            <option value="ALL">All Products (Multi-Product)</option>
            {products.map(p => (
              <option key={p.id} value={p.code}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflowY: 'auto' }}>
          <button 
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('dashboard')}
            style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
          >
            <BarChart3 size={16} />
            Executive Funnel
          </button>

          <button 
            className={`btn ${activeTab === 'queue' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { setActiveTab('queue'); if (leads.length > 0) handleInspectLead(leads[0]); }}
            style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
          >
            <Layers size={16} />
            PLD Work Queue
            <span className="badge badge-info" style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>{leads.length}</span>
          </button>

          <button 
            className={`btn ${activeTab === 'discovery' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('discovery')}
            style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
          >
            <Compass size={16} />
            Discovery &amp; Mapping
            <span className="badge badge-neutral" style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>{discoveries.length}</span>
          </button>

          <button 
            className={`btn ${activeTab === 'poc' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('poc')}
            style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
          >
            <FlaskConical size={16} />
            POC Pilot Trials
            <span className="badge badge-neutral" style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>{pocs.length}</span>
          </button>

          <button 
            className={`btn ${activeTab === 'sql' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('sql')}
            style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
          >
            <CheckSquare size={16} />
            SQL Gate Readiness
            <span className="badge badge-warning" style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>{sqlHandoffs.filter(h => h.status === 'PENDING').length}</span>
          </button>

          <button 
            className={`btn ${activeTab === 'opportunities' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('opportunities')}
            style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
          >
            <Briefcase size={16} />
            Opportunities
            <span className="badge badge-neutral" style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>{opportunities.length}</span>
          </button>

          {/* Phase 3 Tabs */}
          <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '8px 0' }} />

          <button 
            className={`btn ${activeTab === 'attribution' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('attribution')}
            style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
          >
            <Share2 size={16} />
            Multi-Touch Attribution
          </button>

          <button 
            className={`btn ${activeTab === 'leakage' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('leakage')}
            style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
          >
            <Gauge size={16} />
            Funnel Leakage &amp; Velocity
          </button>

          <button 
            className={`btn ${activeTab === 'communications' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('communications')}
            style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
          >
            <Send size={16} />
            Omni-Channel Comms
          </button>

          <button 
            className={`btn ${activeTab === 'erp' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('erp')}
            style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
          >
            <Database size={16} />
            ERP Customer Sync
          </button>

          <button 
            className={`btn ${activeTab === 'partners' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('partners')}
            style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem', borderColor: activeTab === 'partners' ? undefined : 'rgba(59, 130, 246, 0.3)' }}
          >
            <Handshake size={16} color="var(--primary)" />
            Partner Portal (Wireframe 13.4)
          </button>

          <button 
            className={`btn ${activeTab === 'studio' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('studio')}
            style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
          >
            <Settings size={16} />
            Product Studio
          </button>

          <button 
            className={`btn ${activeTab === 'audit' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('audit')}
            style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
          >
            <History size={16} />
            Universal Audit Trail
          </button>
        </nav>

        {/* User Context & Footer */}
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'var(--bg-surface-elevated)',
          borderRadius: '10px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
            AK
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>Aslam Khan</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PLD Executive • GCC</div>
          </div>
        </div>
      </aside>

      {/* 2. Main Workspace */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Header */}
        <header style={{
          height: '68px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '6px 14px',
              width: '320px'
            }}>
              <Search size={16} color="var(--text-muted)" />
              <input 
                type="text" 
                placeholder="Search accounts, leads, or problems..." 
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  width: '100%'
                }}
              />
            </div>
            <span className="badge badge-success">
              <ShieldCheck size={12} />
              Phase 3 Multi-Tenant &amp; Partner Scope Active
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={loadData} title="Refresh data">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              Sync
            </button>
            <button className="btn btn-primary" onClick={() => setShowIntakeModal(true)}>
              <PlusCircle size={16} />
              Intake New Lead
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          {/* TAB 1: EXECUTIVE DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
                  Executive PLD Revenue Funnel
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Real-time pipeline metrics, conversion rates, and stage leakage across all configured products.
                </p>
              </div>

              {/* Top KPI Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px' }}>
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>
                    TOTAL WON REVENUE
                    <TrendingUp size={16} color="var(--success)" />
                  </div>
                  <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '10px', color: '#FFFFFF' }}>
                    ${funnelData?.metrics?.total_won_revenue?.toLocaleString() || '65,000'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '4px', fontWeight: 600 }}>
                    Win Rate: {funnelData?.rates?.win_rate || 50}%
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>
                    OPEN PIPELINE VALUE
                    <Clock size={16} color="var(--primary)" />
                  </div>
                  <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '10px', color: '#FFFFFF' }}>
                    ${funnelData?.metrics?.total_pipeline_value?.toLocaleString() || '140,000'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {funnelData?.metrics?.total_opportunities || 2} active commercial opportunities
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>
                    PLD QUALIFIED RATE
                    <Target size={16} color="var(--accent-cyan)" />
                  </div>
                  <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '10px', color: '#FFFFFF' }}>
                    {funnelData?.rates?.pld_rate || 100}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--info)', marginTop: '4px' }}>
                    High conversion across VanForces &amp; TaskForces
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>
                    PARTNER CONTRIBUTION
                    <Handshake size={16} color="var(--warning)" />
                  </div>
                  <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '10px', color: '#FFFFFF' }}>
                    $65,000
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '4px' }}>
                    KAT IT Solutions ($9,750 commission)
                  </div>
                </div>
              </div>

              {/* Visual PLD Funnel & Leakage */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>
                  End-to-End Product-Led Development Funnel
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '16px', background: 'var(--bg-surface)', borderRadius: '10px' }}>
                  {[
                    { label: 'Leads Ingested', count: funnelData?.metrics?.total_leads || 2, color: '#3B82F6' },
                    { label: 'ICP Knockout Passed', count: funnelData?.metrics?.icp_passed || 2, color: '#06B6D4' },
                    { label: 'PLD Qualified', count: funnelData?.metrics?.pld_qualified || 2, color: '#10B981' },
                    { label: 'Discovery Mapped', count: discoveries.length || 1, color: '#8B5CF6' },
                    { label: 'POC Trials', count: pocs.length || 1, color: '#EC4899' },
                    { label: 'SQL Ready Gate', count: sqlHandoffs.length || 1, color: '#F59E0B' },
                    { label: 'Won Deal', count: 1, color: '#10B981' },
                  ].map((step, idx, arr) => (
                    <React.Fragment key={idx}>
                      <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: step.color }}>{step.count}</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '4px' }}>{step.label}</div>
                      </div>
                      {idx < arr.length - 1 && (
                        <ArrowRight size={18} color="var(--border-subtle)" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PLD WORK QUEUE & QUALIFICATION WORKSPACE */}
          {activeTab === 'queue' && (
            <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', alignItems: 'start' }}>
              <div className="glass-panel" style={{ padding: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>PLD Work Queue</h2>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Prioritized leads requiring qualification or next actions</p>
                  </div>
                  <span className="badge badge-neutral">{leads.length} Records</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {leads.map(lead => {
                    const isSelected = selectedLead?.id === lead.id;
                    return (
                      <div 
                        key={lead.id} 
                        onClick={() => handleInspectLead(lead)}
                        style={{
                          padding: '16px',
                          borderRadius: '10px',
                          background: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#FFFFFF' }}>{lead.account_name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Product: <strong style={{ color: 'var(--primary)' }}>{lead.primary_product_name}</strong>
                            </div>
                          </div>
                          <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                            {lead.current_stage_name || lead.status}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                          {lead.is_target_account && (
                            <span className="badge badge-warning" style={{ fontSize: '0.68rem' }}>
                              {lead.target_tier || 'Target'}
                            </span>
                          )}
                          {lead.recorded_problems && lead.recorded_problems.length > 0 && (
                            <span className="badge badge-danger" style={{ fontSize: '0.68rem' }}>
                              {lead.recorded_problems.length} Problem(s)
                            </span>
                          )}
                        </div>

                        <div style={{
                          marginTop: '10px',
                          padding: '8px 10px',
                          background: 'rgba(59, 130, 246, 0.08)',
                          borderRadius: '6px',
                          borderLeft: '3px solid var(--primary)',
                          fontSize: '0.74rem'
                        }}>
                          <strong>Next:</strong> {lead.next_action_description || 'No action defined'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Dynamic Phase 4 PLD Qualification Workspace */}
              {selectedLead ? (
                <PLDQualificationWorkspace
                  lead={selectedLead}
                  onTransitionSuccess={() => {
                    loadData();
                    notifySuccess(`Lead ${selectedLead.account_name} successfully qualified and advanced to Discovery.`);
                  }}
                  onLeadUpdated={() => loadData()}
                />
              ) : (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Select a lead from the work queue to begin ICP evaluation and qualification.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DISCOVERY & PRODUCT CAPABILITY MAPPING WORKSPACE (PHASE 5) */}
          {activeTab === 'discovery' && (
            <DiscoveryWorkspace
              leadId={selectedLead?.id}
              onDiscoveryCompleted={(completedDisc) => {
                notifySuccess(`Discovery for ${completedDisc.account_name} completed successfully! Verification gates passed.`);
                loadData();
              }}
              onNavigateToDemo={(targetLeadId) => {
                const found = leads.find(l => l.id === targetLeadId);
                if (found) setSelectedLead(found);
                setActiveTab('queue');
              }}
              onNavigateToSQL={() => {
                setActiveTab('sql');
              }}
            />
          )}

          {/* TAB 4: POC PILOT TRIALS & KPI TRACKER (NEW IN PHASE 3) */}
          {activeTab === 'poc' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
                  Proof of Concept (POC) &amp; Pilot Trials
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Tracks trial parameters, baseline metrics vs verified result KPIs before commercial commitment.
                </p>
              </div>

              {pocs.map(poc => (
                <div key={poc.id} className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '20px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>{poc.account_name}</h2>
                        <span className={`badge ${poc.status === 'COMPLETED' ? 'badge-success' : poc.status === 'NOT_REQUIRED' ? 'badge-neutral' : 'badge-warning'}`}>
                          Status: {poc.status}
                        </span>
                        {poc.status === 'NOT_REQUIRED' && poc.not_required_reason && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            (Reason: {poc.not_required_reason})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Scope: {poc.scope_description} • {poc.users_count} Vans / Drivers
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="badge badge-info">Coverage: {poc.geography_coverage}</span>
                      {poc.status !== 'COMPLETED' && poc.status !== 'NOT_REQUIRED' && (
                        <button 
                          className="btn btn-secondary" 
                          style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                          onClick={() => openSkipPoc(poc.id)}
                        >
                          Mark as Not Required (Skip Stage)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* KPI Baseline vs Result Comparison Table */}
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px' }}>
                    Documented Baseline KPIs vs. Pilot Results
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                    <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ROUTE ADHERENCE</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '8px' }}>
                        <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>58% Baseline</span>
                        <span style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--success)' }}>88% Actual</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--success)', marginTop: '4px' }}>Target was &gt;80% (+30% increase)</div>
                    </div>

                    <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ORDER PROCESSING TIME</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '8px' }}>
                        <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>45 mins</span>
                        <span style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>8 mins</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', marginTop: '4px' }}>-82% time saved per outlet visit</div>
                    </div>

                    <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>VAN INVENTORY VARIANCE</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '8px' }}>
                        <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>4.2%</span>
                        <span style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--primary)' }}>0.3%</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--primary)', marginTop: '4px' }}>Virtually zero load reconciliation error</div>
                    </div>
                  </div>

                  <div style={{ padding: '14px', background: 'var(--bg-surface)', borderRadius: '8px', borderLeft: '4px solid var(--success)', fontSize: '0.85rem' }}>
                    <strong>Customer Trial Feedback:</strong> "{poc.customer_feedback}"
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 5: SQL GATE READINESS & SALES ACCEPTANCE */}
          {activeTab === 'sql' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
                  SQL Gate Readiness &amp; Sales Acceptance Workspace
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Specification Wireframe 13.7: What We Know, What Is Missing, and formal Sales Acceptance SLA.
                </p>
              </div>

              {sqlHandoffs.map(h => (
                <div key={h.id} className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '20px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>{h.company_name}</h2>
                        <span className="badge badge-info">{h.product_name}</span>
                        <span className={`badge ${h.status === 'ACCEPTED' ? 'badge-success' : h.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                          Status: {h.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        PLD Submitter: Tariq Al-Mansoor • 48-Hour Sales Acceptance SLA Active
                      </div>
                    </div>

                    {h.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn btn-primary" onClick={() => handleAcceptSQL(h.id)}>
                          <Check size={16} />
                          Accept SQL &amp; Create Opportunity
                        </button>
                        <button className="btn btn-secondary" onClick={() => openSqlReject(h.id)} style={{ color: 'var(--danger)' }}>
                          <X size={16} />
                          Decline SQL Handoff
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div style={{ padding: '18px', background: 'var(--bg-surface)', borderRadius: '10px' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--success)', marginBottom: '14px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle2 size={16} />
                        What We Know (Gates Verified)
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Check size={16} color="var(--success)" /> ICP confirmed (FMCG, 210 employees, Saudi Arabia)
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Check size={16} color="var(--success)" /> Business problems confirmed (Missed orders &amp; SAP re-entry)
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Check size={16} color="var(--success)" /> Problem impact documented ($45,000/mo in lost billing)
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Check size={16} color="var(--success)" /> Solution / capability mapped (Mobile Invoicing &amp; Geofencing)
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Check size={16} color="var(--success)" /> Decision maker identified (Tariq Al-Ghamdi, MD)
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Check size={16} color="var(--success)" /> Timeline documented (Q4 Rollout)
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: '18px', background: 'var(--bg-surface)', borderRadius: '10px' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '14px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingUp size={16} />
                        Commercial Sizing &amp; Next Action
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-primary)', borderRadius: '6px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Estimated Deal Value:</span>
                          <strong style={{ color: '#FFFFFF', fontSize: '1rem' }}>$85,000 USD</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-primary)', borderRadius: '6px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Recommended Next Action:</span>
                          <strong style={{ color: 'var(--primary)' }}>Commercial proposal presentation</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 6: OPPORTUNITIES */}
          {activeTab === 'opportunities' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
                  Commercial Opportunities Pipeline
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Multi-product commercial deals with line items, versioned proposals, and conversion tracking.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px' }}>
                {opportunities.map(opp => (
                  <div key={opp.id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span className="badge badge-info">{opp.opportunity_type}</span>
                      <span className="badge badge-success">${opp.total_contract_value?.toLocaleString()} {opp.currency}</span>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '12px', color: '#FFFFFF' }}>
                      {opp.account_name}
                    </h3>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Owner: {opp.owner_name || 'Sales Team'}
                    </div>

                    <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>PRODUCT LINES:</div>
                      {opp.product_lines && opp.product_lines.length > 0 ? (
                        opp.product_lines.map((pl, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginTop: '4px' }}>
                            <span style={{ color: 'var(--accent-purple)' }}>{pl.product_name}</span>
                            <span>${pl.total_amount?.toLocaleString()}</span>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>VanForces Base License ($65,000)</div>
                      )}
                    </div>

                    <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                        PLD Score: {opp.pld_score ?? 97}
                      </span>
                      {opp.sql_date && (
                        <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                          SQL Date: {opp.sql_date}
                        </span>
                      )}
                      <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                        ERP: {opp.erp_system || 'SAP S/4HANA'}
                      </span>
                    </div>

                    {opp.decision_maker && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                        <strong>Decision Maker:</strong> {opp.decision_maker}
                      </div>
                    )}

                    {opp.poc_result && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--success)', marginTop: '6px', background: 'rgba(16, 185, 129, 0.08)', padding: '6px 8px', borderRadius: '4px' }}>
                        <strong>POC Outcome:</strong> {opp.poc_result}
                      </div>
                    )}

                    {opp.next_action_description && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--primary)', marginTop: '6px', background: 'rgba(59, 130, 246, 0.08)', padding: '6px 8px', borderRadius: '4px' }}>
                        <strong>Next Activity:</strong> {opp.next_action_description}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Probability: <strong>{opp.probability_pct}%</strong></span>
                      <span className="badge badge-neutral">Status: {opp.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: PARTNER PORTAL (WIREFRAME 13.4 - NEW IN PHASE 3) */}
          {activeTab === 'partners' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                      Partner Portal: {partnerDashboard?.partner_name || 'KAT IT Solutions'}
                    </h1>
                    <span className="badge badge-info">Partner Code: {partnerDashboard?.partner_code || 'KAT-IT-SA'}</span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                    Isolated partner organization workspace: Protected deal registrations, certified products, and commissions.
                  </p>
                </div>

                <button className="btn btn-primary" onClick={() => setShowDealRegModal(true)}>
                  <PlusCircle size={16} />
                  Register New Deal
                </button>
              </div>

              {/* Partner KPI Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px' }}>
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>REGISTERED DEALS</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: '#FFFFFF' }}>
                    {partnerDashboard?.metrics?.registered_deals_count || 2}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Active submissions</div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>ACCEPTED &amp; PROTECTED</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: 'var(--success)' }}>
                    {partnerDashboard?.metrics?.accepted_deals_count || 1}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--success)', marginTop: '4px' }}>90-Day exclusivity active</div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>PARTNER PIPELINE</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: 'var(--primary)' }}>
                    ${partnerDashboard?.metrics?.pipeline_estimate?.toLocaleString() || '185,000'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--primary)', marginTop: '4px' }}>Total expected value</div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>ACCRUED COMMISSIONS</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: 'var(--warning)' }}>
                    ${partnerDashboard?.metrics?.total_commission_accrued?.toLocaleString() || '9,750'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--warning)', marginTop: '4px' }}>Approved for payout</div>
                </div>
              </div>

              {/* Deal Registrations Table */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>
                  Protected Deal Registrations &amp; Conflict Status
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {partnerDashboard?.recent_registrations?.map((reg: any) => (
                    <div key={reg.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'var(--bg-surface)', borderRadius: '10px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontWeight: 800, fontSize: '1rem', color: '#FFFFFF' }}>{reg.customer_name}</span>
                          <span className="badge badge-info">{reg.product_name}</span>
                          <span className={`badge ${reg.status === 'ACCEPTED' ? 'badge-success' : 'badge-warning'}`}>
                            {reg.status === 'ACCEPTED' ? 'Protected' : 'Under Review'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Evidence: {reg.evidence_notes}
                        </div>
                        {reg.protection_expiry_date && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--success)', marginTop: '2px', fontWeight: 600 }}>
                            Protection Expiry: {reg.protection_expiry_date}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>DEAL VALUE</div>
                          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#FFFFFF' }}>${reg.expected_deal_value?.toLocaleString()}</div>
                        </div>
                        {reg.status !== 'ACCEPTED' && (
                          <button className="btn btn-secondary" onClick={() => handleAcceptDealReg(reg.id)} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                            <Check size={14} /> Accept &amp; Protect
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: PRODUCT STUDIO & ENGINE CONFIGURATION */}
          {activeTab === 'studio' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
                    Product &amp; Engine Configuration Studio
                  </h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Zero hardcoded tables. Manage ICP profiles, knock-out rules, deterministic scoring models, and dynamic qualification questionnaires.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className={`btn ${studioView === 'engine' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setStudioView('engine')}
                    style={{ fontSize: '0.82rem' }}
                  >
                    <ShieldCheck size={15} />
                    Phase 4: ICP &amp; PLD Engine Studio
                  </button>
                  <button
                    className={`btn ${studioView === 'modules' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setStudioView('modules')}
                    style={{ fontSize: '0.82rem' }}
                  >
                    <Layers size={15} />
                    Modules &amp; Capabilities Catalog
                  </button>
                </div>
              </div>

              {studioView === 'engine' ? (
                <AdminEngineStudio products={products} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {products.map(prod => (
                    <div key={prod.id} className="glass-panel" style={{ padding: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '20px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>{prod.name}</h2>
                            <span className="badge badge-success">Status: {prod.status}</span>
                            <span className="badge badge-info">Version 1.0 (Published)</span>
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>{prod.category}</div>
                        </div>
                      </div>

                      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>
                        Configured Modules &amp; Capabilities ({prod.modules?.length || 0})
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                        {prod.modules?.map(m => (
                          <div key={m.id} style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#FFFFFF' }}>{m.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{m.code}</div>
                            
                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {m.capabilities.map(c => (
                                <div key={c.id} style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.08)', padding: '4px 8px', borderRadius: '4px' }}>
                                  • {c.name}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 9: UNIVERSAL AUDIT TRAIL (NEW IN PHASE 3) */}
          {activeTab === 'audit' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
                  Universal Field-Level Audit Trail
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Immutable chronological log recording who changed what, when, old values, and new values across all entities.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {auditLogs.map((log: any) => (
                    <div key={log.id} style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '10px', borderLeft: '4px solid var(--primary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="badge badge-info">{log.action}</span>
                          <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{log.entity_type}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>#{log.entity_id?.slice(0, 8)}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {log.timestamp?.replace('T', ' ').slice(0, 19)} • IP: {log.ip_address}
                        </div>
                      </div>

                      <div style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <strong>Actor:</strong> {log.actor_email || 'System / Administrator'} ({log.actor_role || 'Admin'})
                      </div>

                      <div style={{ marginTop: '10px', padding: '10px', background: 'var(--bg-primary)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                        {JSON.stringify(log.changes_json, null, 2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 10: MULTI-TOUCH ATTRIBUTION */}
          {activeTab === 'attribution' && (
            <div className="animate-fade-in">
              <MultiTouchAttributionView products={products} onNotify={notifySuccess} />
            </div>
          )}

          {/* TAB 11: FUNNEL LEAKAGE & VELOCITY */}
          {activeTab === 'leakage' && (
            <div className="animate-fade-in">
              <FunnelLeakageVelocityView />
            </div>
          )}

          {/* TAB 12: OMNI-CHANNEL COMMUNICATIONS */}
          {activeTab === 'communications' && (
            <div className="animate-fade-in">
              <OmniChannelCommsView leads={leads} onNotify={notifySuccess} />
            </div>
          )}

          {/* TAB 13: ERP CUSTOMER SYNC */}
          {activeTab === 'erp' && (
            <div className="animate-fade-in">
              <ERPSyncGatewayView accounts={accounts} onNotify={notifySuccess} />
            </div>
          )}
        </div>
      </main>

      {/* LEAD INTAKE MODAL */}
      {showIntakeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-panel" style={{ width: '520px', padding: '32px', border: '1px solid var(--border-focus)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Intake New Commercial Lead</h2>
              <button onClick={() => setShowIntakeModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateLead} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Target Company Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Al-Riyadh Beverage Co."
                  value={newCompanyName}
                  onChange={(e) => {
                    setNewCompanyName(e.target.value);
                    handleCheckDuplicates(e.target.value, newDomain);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: '#FFFFFF',
                    marginTop: '6px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Corporate Domain / Website</span>
                  {checkingDuplicates && <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Scanning duplicates...</span>}
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. riyadhbeverage.com"
                  value={newDomain}
                  onChange={(e) => {
                    setNewDomain(e.target.value);
                    handleCheckDuplicates(newCompanyName, e.target.value);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: '#FFFFFF',
                    marginTop: '6px',
                    outline: 'none'
                  }}
                />
              </div>

              {duplicateMatches.length > 0 && (
                <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid var(--warning)', borderRadius: '8px', fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>⚠️</span> Potential Duplicate Account / Contact Detected ({duplicateMatches.length}):
                  </div>
                  {duplicateMatches.map((m, i) => (
                    <div key={i} style={{ color: 'var(--text-primary)', marginTop: '4px', fontSize: '0.78rem' }}>
                      • <strong>{m.name}</strong> ({m.matched_on})
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input 
                    type="checkbox" 
                    checked={newIsTarget} 
                    onChange={(e) => setNewIsTarget(e.target.checked)}
                  />
                  <strong>Designate as Target Account</strong>
                </label>
                {newIsTarget && (
                  <select
                    value={newTargetTier}
                    onChange={(e) => setNewTargetTier(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '6px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      color: '#FFFFFF',
                      fontSize: '0.8rem',
                      outline: 'none'
                    }}
                  >
                    <option value="TIER_1">Tier 1 - Strategic</option>
                    <option value="TIER_2">Tier 2 - High Priority</option>
                    <option value="TIER_3">Tier 3 - Standard</option>
                  </select>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Industry</label>
                  <select 
                    value={newIndustry}
                    onChange={(e) => setNewIndustry(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: '#FFFFFF',
                      marginTop: '6px',
                      outline: 'none'
                    }}
                  >
                    <option value="FMCG">FMCG</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Food & Beverage">Food &amp; Beverage</option>
                    <option value="Distribution">Wholesale Distribution</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Employees</label>
                  <input 
                    type="number"
                    value={newEmployees}
                    onChange={(e) => setNewEmployees(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: '#FFFFFF',
                      marginTop: '6px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Target Product</label>
                <select 
                  value={newProductCode}
                  onChange={(e) => setNewProductCode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: '#FFFFFF',
                    marginTop: '6px',
                    outline: 'none'
                  }}
                >
                  {products.map(p => (
                    <option key={p.id} value={p.code}>{p.name} ({p.category})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mandatory Next Action</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Schedule discovery call with Sales Director"
                  value={newNextAction}
                  onChange={(e) => setNewNextAction(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: '#FFFFFF',
                    marginTop: '6px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '12px' }}>
                  Run Automatic ICP &amp; Intake
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowIntakeModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SQL REJECTION & RETURN ROUTING MODAL */}
      {showSqlRejectModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-panel" style={{ width: '500px', padding: '30px', border: '1px solid var(--border-focus)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--danger)' }}>
                Decline SQL Handoff
              </h2>
              <button onClick={() => setShowSqlRejectModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              TEXOL Sales Governance: Declining an SQL handoff requires a documented reason and routing destination for the lead.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Return Lead Destination
                </label>
                <select
                  value={rejectReturnTarget}
                  onChange={(e: any) => setRejectReturnTarget(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: '#FFFFFF',
                    marginTop: '6px',
                    outline: 'none'
                  }}
                >
                  <option value="DISCOVERY">Return to Discovery &amp; Product Mapping</option>
                  <option value="PLD">Return to PLD Qualification Queue</option>
                  <option value="NURTURE">Return to Marketing Nurture</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Mandatory Rejection Reason
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Detail why this lead is not currently SQL-ready (e.g., budget unconfirmed, wrong decision-maker, requirements mismatch)..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: '#FFFFFF',
                    marginTop: '6px',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  style={{ flex: 1, padding: '12px', background: 'var(--danger)', borderColor: 'var(--danger)' }}
                  onClick={confirmSqlReject}
                >
                  Confirm Rejection &amp; Route Lead
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSqlRejectModal(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POC NOT REQUIRED (SKIP STAGE) MODAL */}
      {showPocNotRequiredModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-panel" style={{ width: '480px', padding: '30px', border: '1px solid var(--border-focus)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                Mark POC as Not Required
              </h2>
              <button onClick={() => setShowPocNotRequiredModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              TEXOL Pipeline Rule: An optional stage (Demo or POC) must NOT be skipped silently. A formal business rationale must be recorded.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Reason POC is Not Required
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g., Client accepts existing customer reference visit in Riyadh; standard deployment without custom telemetry..."
                  value={skipPocReason}
                  onChange={(e) => setSkipPocReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: '#FFFFFF',
                    marginTop: '6px',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  style={{ flex: 1, padding: '12px' }}
                  onClick={confirmSkipPoc}
                >
                  Record &amp; Skip Stage
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPocNotRequiredModal(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEAL REGISTRATION MODAL */}
      {showDealRegModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-panel" style={{ width: '520px', padding: '32px', border: '1px solid var(--border-focus)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Submit Deal Registration</h2>
              <button onClick={() => setShowDealRegModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitDealReg} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Prospect Customer Company</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Al-Madina Wholesale Trading"
                  value={regCustomerName}
                  onChange={(e) => setRegCustomerName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: '#FFFFFF',
                    marginTop: '6px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Registered Product</label>
                  <select 
                    value={regProductCode}
                    onChange={(e) => setRegProductCode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: '#FFFFFF',
                      marginTop: '6px',
                      outline: 'none'
                    }}
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.code}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Expected Deal Value ($)</label>
                  <input 
                    type="number"
                    value={regValue}
                    onChange={(e) => setRegValue(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: '#FFFFFF',
                      marginTop: '6px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Qualification Evidence &amp; Scope</label>
                <textarea 
                  required
                  rows={3}
                  value={regEvidence}
                  onChange={(e) => setRegEvidence(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: '#FFFFFF',
                    marginTop: '6px',
                    outline: 'none',
                    resize: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '12px' }}>
                  Submit for 90-Day Protection
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDealRegModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
