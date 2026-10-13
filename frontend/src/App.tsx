import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  BarChart3, Layers, 
  ShieldCheck, Settings, Sparkles, 
  PlusCircle, Briefcase, 
  Check, X, Compass, CheckSquare, Handshake, 
  FlaskConical, History, Share2, Gauge, Send, Database, Monitor, FileText,
  Building2, ListTodo, LogOut, UserCheck, ShieldAlert, UserPlus, Package, User,
  Sun, Moon, Calendar, Clock, RotateCcw, FolderKanban,
  CheckCircle2, AlertTriangle, AlertCircle, Info, ExternalLink, ArrowRight, Sliders
} from 'lucide-react';
import { api } from './services/api';
import type { 
  Lead, Product, Discovery, SQLHandoff, Opportunity, Demo, POC, OperationalMetrics,
  AuthUser, LeadSource, ICPRule, ICPProfile
} from './services/api';
import { LoginPage } from './components/LoginPage';
import { MultiTouchAttributionView } from './components/MultiTouchAttributionView';
import { FunnelLeakageVelocityView } from './components/FunnelLeakageVelocityView';
import { OmniChannelCommsView } from './components/OmniChannelCommsView';
import { ERPSyncGatewayView } from './components/ERPSyncGatewayView';
import { PLDQualificationWorkspace } from './components/PLDQualificationWorkspace';
import { AdminEngineStudio } from './components/AdminEngineStudio';
import { DiscoveryWorkspace } from './components/DiscoveryWorkspace';
import { DemoWorkspace } from './components/DemoWorkspace';
import { POCWorkspace } from './components/POCWorkspace';
import { SQLReadinessWorkspace } from './components/SQLReadinessWorkspace';
import { SalesAcceptanceWorkspace } from './components/SalesAcceptanceWorkspace';
import { OpportunityWorkspace } from './components/OpportunityWorkspace';
import { ProposalWorkspace } from './components/ProposalWorkspace';
import { NegotiationWorkspace } from './components/NegotiationWorkspace';
import { CustomerLifecycleWorkspace } from './components/CustomerLifecycleWorkspace';
import { NurtureWorkspace } from './components/NurtureWorkspace';
import { NotificationCenter } from './components/NotificationCenter';
import { MyWorkQueueWorkspace } from './components/MyWorkQueueWorkspace';
import { Account360Workspace } from './components/Account360Workspace';
import { AnalyticsHubView } from './components/AnalyticsHubView';
import { AdminStaffPartnersWorkspace } from './components/AdminStaffPartnersWorkspace';
import { AdminLeadsDirectoryWorkspace } from './components/AdminLeadsDirectoryWorkspace';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { InAppAlertContainer, inAppAlert } from './components/common/InAppAlert';
import { GlobalSearchBar } from './components/common/GlobalSearchBar';

export type TabType = 
  | 'dashboard' 
  | 'work-queue' 
  | 'account-360' 
  | 'queue' 
  | 'discovery' 
  | 'demo' 
  | 'poc' 
  | 'sql' 
  | 'opportunities' 
  | 'proposals' 
  | 'negotiation' 
  | 'customer-lifecycle' 
  | 'nurture-pool' 
  | 'partners' 
  | 'studio' 
  | 'audit' 
  | 'attribution' 
  | 'leakage' 
  | 'communications' 
  | 'erp' 
  | 'staff-partners'
  | 'admin-leads';

export const isTabAllowedForUser = (tabId: string, user: AuthUser | null): boolean => {
  if (!user) return false;
  if (user.is_superuser || user.role === 'ADMIN') return true;
  if (tabId === 'negotiation') {
    const allowedRoles = ['ADMIN', 'MANAGEMENT', 'SALES_MANAGER', 'SALES_BDM', 'ACCOUNT_EXECUTIVE', 'FINANCE', 'PARTNER_MANAGER'];
    if (allowedRoles.includes(user.role)) return true;
  }
  if (tabId === 'customer-lifecycle') {
    const allowedRoles = ['ADMIN', 'MANAGEMENT', 'SALES_MANAGER', 'SALES_BDM', 'ACCOUNT_EXECUTIVE', 'CUSTOMER_SUCCESS', 'PARTNER_MANAGER'];
    if (allowedRoles.includes(user.role)) return true;
  }
  if (tabId === 'nurture-pool') {
    const allowedRoles = ['ADMIN', 'MANAGEMENT', 'SALES_MANAGER', 'SALES_BDM', 'ACCOUNT_EXECUTIVE', 'MARKETING'];
    if (allowedRoles.includes(user.role)) return true;
  }
  if (tabId === 'admin-leads') {
    const allowedRoles = ['ADMIN', 'MANAGEMENT', 'SALES_MANAGER'];
    if (user.is_superuser || allowedRoles.includes(user.role)) return true;
    return false;
  }
  return user.allowed_workspaces?.includes(tabId) ?? false;
};

export const canAcceptDealRegistration = (user: AuthUser | null): boolean => {
  if (!user) return false;
  if (user.is_partner_user || user.role === 'PARTNER_USER') return false;
  if (user.is_superuser || user.role === 'ADMIN') return true;
  if (user.capabilities?.can_manage_partners) return true;
  const authorizedRoles = ['ADMIN', 'MANAGEMENT', 'PARTNER_MANAGER', 'SALES_MANAGER'];
  return authorizedRoles.includes(user.role);
};

export const getAuthorizedWorkspace = (user: AuthUser | null): TabType => {
  if (!user) return 'dashboard';
  if (user.is_superuser || user.role === 'ADMIN') return 'dashboard';
  if (isTabAllowedForUser('dashboard', user)) return 'dashboard';
  if (user.allowed_workspaces && user.allowed_workspaces.length > 0) {
    const firstAllowed = user.allowed_workspaces.find(w => isTabAllowedForUser(w, user));
    if (firstAllowed) return firstAllowed as TabType;
    return user.allowed_workspaces[0] as TabType;
  }
  return 'work-queue';
};

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('texol_theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('texol_theme', theme);
  }, [theme]);

  // Global modal observer: Disables vertical scroll on html & body when ANY modal form or overlay is active
  useEffect(() => {
    let prevBodyOverflow = '';
    let prevHtmlOverflow = '';

    const handleModalState = () => {
      const hasModal = Boolean(
        document.querySelector('.modal-overlay, .modal-backdrop, [data-modal-overlay="true"]')
      );

      if (hasModal) {
        if (!document.body.classList.contains('modal-open')) {
          prevBodyOverflow = document.body.style.overflow;
          prevHtmlOverflow = document.documentElement.style.overflow;

          const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
          if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
          }

          document.body.style.overflow = 'hidden';
          document.documentElement.style.overflow = 'hidden';
          document.body.classList.add('modal-open');
          document.documentElement.classList.add('modal-open');
        }
      } else {
        if (document.body.classList.contains('modal-open')) {
          document.body.classList.remove('modal-open');
          document.documentElement.classList.remove('modal-open');
          document.body.style.overflow = prevBodyOverflow;
          document.documentElement.style.overflow = prevHtmlOverflow;
          document.body.style.paddingRight = '';
        }
      }
    };

    const observer = new MutationObserver(() => {
      handleModalState();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    handleModalState();

    return () => {
      observer.disconnect();
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, []);

  // Authentication & RBAC State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('texol_auth_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const isTabAllowed = (tabId: string): boolean => {
    return isTabAllowedForUser(tabId, currentUser);
  };

  const [activeTab, _setActiveTab] = useState<TabType>(() => {
    const saved = localStorage.getItem('texol_auth_user');
    if (saved) {
      try {
        const user: AuthUser = JSON.parse(saved);
        const savedTab = localStorage.getItem('texol_active_tab') as TabType | null;
        if (savedTab && isTabAllowedForUser(savedTab, user)) {
          return savedTab;
        }
        return getAuthorizedWorkspace(user);
      } catch {
        // fallback
      }
    }
    return 'dashboard';
  });

  const setActiveTab = (tab: TabType) => {
    const target = (currentUser && !isTabAllowedForUser(tab, currentUser))
      ? getAuthorizedWorkspace(currentUser)
      : tab;
    _setActiveTab(target);
    localStorage.setItem('texol_active_tab', target);
  };

  // Ensure instant redirect if user or permissions change such that activeTab is not allowed
  useEffect(() => {
    if (currentUser && !isTabAllowed(activeTab)) {
      const authorized = getAuthorizedWorkspace(currentUser);
      _setActiveTab(authorized);
      localStorage.setItem('texol_active_tab', authorized);
    }
  }, [currentUser, activeTab]);

  const [sqlSubView, setSqlSubView] = useState<'readiness' | 'acceptance'>('readiness');
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string>('');
  const [_funnelData, setFunnelData] = useState<any>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [demos, setDemos] = useState<Demo[]>([]);
  const [pocs, setPocs] = useState<POC[]>([]);
  const [sqlHandoffs, setSqlHandoffs] = useState<SQLHandoff[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [partnerDashboard, setPartnerDashboard] = useState<any>(null);
  const [partnerList, setPartnerList] = useState<any[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [regPartnerId, setRegPartnerId] = useState<string>('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [operationalMetrics, setOperationalMetrics] = useState<OperationalMetrics | null>(null);
  const [selectedAccount360Id, setSelectedAccount360Id] = useState<string>('');
  
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  const [_loading, setLoading] = useState<boolean>(true);
  const selectedProductFilter = 'ALL';
  const [showIntakeModal, setShowIntakeModal] = useState<boolean>(false);
  const [showDealRegModal, setShowDealRegModal] = useState<boolean>(false);
  const [studioView, setStudioView] = useState<'modules' | 'engine'>('engine');
  const [nurtureInitialTab, setNurtureInitialTab] = useState<'LOST_OPPORTUNITIES' | 'ICP_FAILED' | 'NURTURE_LEADS' | 'INTELLIGENCE_MATRIX'>('LOST_OPPORTUNITIES');

  // New Lead Form State
  const [accountSelectionMode, setAccountSelectionMode] = useState<'create' | 'existing'>('create');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [newIndustry, setNewIndustry] = useState('FMCG');
  const [newEmployees, setNewEmployees] = useState(100);
  const [newContactName, setNewContactName] = useState('');
  const [newContactTitle, setNewContactTitle] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRole, setNewContactRole] = useState('DECISION_MAKER');
  const [newProductId, setNewProductId] = useState<string>('');
  const [newProductCode, setNewProductCode] = useState('VANFORCES');
  const [newAssignedOwnerId, setNewAssignedOwnerId] = useState<string>('');
  const [staffUsers, setStaffUsers] = useState<AuthUser[]>([]);
  const [newNextAction, setNewNextAction] = useState('Schedule introductory discovery call');
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [newLeadSourceId, setNewLeadSourceId] = useState<string>('');
  const [showAddSourceModal, setShowAddSourceModal] = useState<boolean>(false);
  const [newSourceName, setNewSourceName] = useState<string>('');
  const [savingNewSource, setSavingNewSource] = useState<boolean>(false);
  const [newIsTarget, setNewIsTarget] = useState(false);
  const [newTargetTier, setNewTargetTier] = useState('TIER_1');
  const [duplicateMatches, setDuplicateMatches] = useState<any[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  // Operational ICP Qualification State for Lead Intake
  const [icpFieldSales, setIcpFieldSales] = useState<boolean>(true);
  const [icpVansCount, setIcpVansCount] = useState<number>(25);
  const [icpSalesmenCount, setIcpSalesmenCount] = useState<number>(25);
  const [icpPrimaryErp, setIcpPrimaryErp] = useState<string>('Odoo');
  const [icpDistributionCenters, setIcpDistributionCenters] = useState<number>(2);
  const [icpDailyOrders, setIcpDailyOrders] = useState<number>(150);
  const [icpMonthlyInvoices, setIcpMonthlyInvoices] = useState<number>(10000);

  // Dynamic ICP Qualification State for Lead Intake
  const [productIcpRules, setProductIcpRules] = useState<ICPRule[]>([]);
  const [loadingIcpRules, setLoadingIcpRules] = useState<boolean>(false);
  const [dynamicIcpValues, setDynamicIcpValues] = useState<Record<string, any>>({});
  const [productIcpProfile, setProductIcpProfile] = useState<ICPProfile | null>(null);

  const fetchProductIcpRules = async (prodId: string) => {
    if (!prodId) {
      setProductIcpRules([]);
      return;
    }
    setLoadingIcpRules(true);
    try {
      const [rulesData, profilesData] = await Promise.all([
        api.getICPRules(prodId).catch(() => []),
        api.getICPProfiles(prodId).catch(() => []),
      ]);
      const validRules = rulesData || [];
      setProductIcpRules(validRules);
      setProductIcpProfile((profilesData && profilesData.length > 0) ? profilesData[0] : null);

      // Pre-seed dynamic values for any rule field not yet initialized
      setDynamicIcpValues(prev => {
        const next = { ...prev };
        validRules.forEach(r => {
          if (next[r.field_name] === undefined) {
            if (r.field_name === 'field_sales') {
              next[r.field_name] = icpFieldSales;
            } else if (r.field_name === 'vans_count') {
              next[r.field_name] = icpVansCount;
            } else if (r.field_name === 'salesmen_count') {
              next[r.field_name] = icpSalesmenCount;
            } else if (r.field_name === 'primary_erp') {
              next[r.field_name] = icpPrimaryErp;
            } else if (r.field_name === 'employees_count' || r.field_name === 'employees') {
              next[r.field_name] = newEmployees;
            } else if (r.field_name === 'industry') {
              next[r.field_name] = newIndustry;
            } else if (r.field_name === 'distribution_centers_count' || r.field_name === 'distribution_depots') {
              next[r.field_name] = icpDistributionCenters;
            } else if (r.field_name === 'monthly_invoices') {
              next[r.field_name] = icpMonthlyInvoices;
            } else if (r.field_name === 'daily_orders') {
              next[r.field_name] = icpDailyOrders;
            } else if (typeof r.target_value === 'boolean' || r.target_value === 'true') {
              next[r.field_name] = true;
            } else if (typeof r.target_value === 'number') {
              next[r.field_name] = r.target_value;
            } else if (Array.isArray(r.target_value) && r.target_value.length > 0) {
              next[r.field_name] = r.target_value[0];
            } else {
              next[r.field_name] = r.target_value ?? '';
            }
          }
        });
        return next;
      });
    } catch (err) {
      console.warn('Failed to load dynamic ICP rules:', err);
    } finally {
      setLoadingIcpRules(false);
    }
  };

  // Fetch ICP rules whenever product changes or intake modal opens
  useEffect(() => {
    if (!showIntakeModal && !newProductId) return;
    const targetProduct = products.find(p => p.id === newProductId || p.code === newProductCode) || products[0];
    if (targetProduct?.id) {
      fetchProductIcpRules(targetProduct.id);
    }
  }, [newProductId, newProductCode, products, showIntakeModal]);

  // Reactive sync when ICP rules/profiles are changed in Product Studio
  useEffect(() => {
    const handleRulesUpdated = () => {
      const targetProduct = products.find(p => p.id === newProductId || p.code === newProductCode) || products[0];
      if (targetProduct?.id) {
        fetchProductIcpRules(targetProduct.id);
      }
    };
    window.addEventListener('icp-rules-updated', handleRulesUpdated);
    return () => window.removeEventListener('icp-rules-updated', handleRulesUpdated);
  }, [newProductId, newProductCode, products]);

  // Real-time client-side rule evaluation helper
  const getRuleEvaluation = (rule: ICPRule) => {
    let val = dynamicIcpValues[rule.field_name];
    if (rule.field_name === 'industry') val = newIndustry;
    else if (rule.field_name === 'employees_count' || rule.field_name === 'employees') val = newEmployees;
    else if (rule.field_name === 'distribution_centers_count' || rule.field_name === 'distribution_depots') val = icpDistributionCenters;
    else if (rule.field_name === 'country') val = newCountry;
    else if (rule.field_name === 'city') val = newCity;

    if (val === undefined || val === null || val === '') {
      return { satisfied: false, missing: true, actual: val };
    }

    const op = rule.operator;
    const target = rule.target_value;

    if (op === 'EQ' || op === 'EXACT') {
      if (typeof target === 'boolean' || typeof val === 'boolean') {
        const bVal = typeof val === 'boolean' ? val : ['true', '1', 'yes'].includes(String(val).toLowerCase());
        const bTarget = typeof target === 'boolean' ? target : ['true', '1', 'yes'].includes(String(target).toLowerCase());
        return { satisfied: bVal === bTarget, missing: false, actual: val };
      }
      return { satisfied: String(val).trim().toLowerCase() === String(target).trim().toLowerCase(), missing: false, actual: val };
    } else if (op === 'NEQ') {
      return { satisfied: String(val).trim().toLowerCase() !== String(target).trim().toLowerCase(), missing: false, actual: val };
    } else if (op === 'GTE') {
      return { satisfied: Number(val) >= Number(target), missing: false, actual: val };
    } else if (op === 'GT') {
      return { satisfied: Number(val) > Number(target), missing: false, actual: val };
    } else if (op === 'LTE') {
      return { satisfied: Number(val) <= Number(target), missing: false, actual: val };
    } else if (op === 'LT') {
      return { satisfied: Number(val) < Number(target), missing: false, actual: val };
    } else if (op === 'IN') {
      if (Array.isArray(target)) {
        const list = target.map(t => String(t).trim().toLowerCase());
        return { satisfied: list.includes(String(val).trim().toLowerCase()), missing: false, actual: val };
      }
      return { satisfied: true, missing: false, actual: val };
    } else if (op === 'NOT_IN') {
      if (Array.isArray(target)) {
        const list = target.map(t => String(t).trim().toLowerCase());
        return { satisfied: !list.includes(String(val).trim().toLowerCase()), missing: false, actual: val };
      }
      return { satisfied: true, missing: false, actual: val };
    } else if (op === 'CONTAINS') {
      return { satisfied: String(val).toLowerCase().includes(String(target).toLowerCase()), missing: false, actual: val };
    }
    return { satisfied: false, missing: false, actual: val };
  };

  // New Deal Registration State
  const [regCustomerName, setRegCustomerName] = useState('');
  const [regProductCode, setRegProductCode] = useState('VANFORCES');
  const [regValue, setRegValue] = useState<number | ''>('');
  const [regEvidence, setRegEvidence] = useState('');

  const isManagerOrAdmin = Boolean(
    currentUser?.role === 'ADMIN' ||
    currentUser?.is_superuser ||
    currentUser?.role === 'SALES_MANAGER' ||
    currentUser?.role === 'MANAGEMENT' ||
    currentUser?.role?.includes('MANAGER')
  );

  const isSalesperson = Boolean(
    currentUser?.role === 'SALES_BDM' ||
    currentUser?.role === 'ACCOUNT_EXECUTIVE' ||
    currentUser?.role === 'SALES_REP'
  );

  const visibleLeads = React.useMemo(() => {
    // Active leads belong in the PLD Work Queue
    const activeQueueLeads = leads.filter(l => {
      if (l.status === 'NURTURE' || l.status === 'DISQUALIFIED') return false;
      if (l.status === 'ACTIVE') {
        // If explicitly knocked out without override/pass, exclude from active queue
        if (String(l.icp_result).toUpperCase() === 'FAIL' || l.icp_knockout_passed === false) {
          return false;
        }
        return true;
      }
      return false;
    });

    if (!currentUser || isManagerOrAdmin || !isSalesperson) return activeQueueLeads;
    return activeQueueLeads.filter(l => l.owner && (String(l.owner) === String(currentUser.id) || (l as any).owner_email === currentUser.email));
  }, [leads, currentUser, isManagerOrAdmin, isSalesperson]);

  useEffect(() => {
    if (visibleLeads.length > 0) {
      if (!selectedLead || !visibleLeads.some(l => l.id === selectedLead.id)) {
        setSelectedLead(visibleLeads[0]);
      }
    } else {
      setSelectedLead(null);
    }
  }, [visibleLeads]);

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return !!localStorage.getItem('texol_auth_user');
  });

  useEffect(() => {
    if (isLoggedIn) {
      loadData();
    }
  }, [isLoggedIn]);

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    localStorage.setItem('texol_auth_user', JSON.stringify(user));
    const authorized = getAuthorizedWorkspace(user);
    const savedTab = localStorage.getItem('texol_active_tab') as TabType | null;
    const targetTab = (savedTab && isTabAllowedForUser(savedTab, user)) ? savedTab : authorized;
    _setActiveTab(targetTab);
    localStorage.setItem('texol_active_tab', targetTab);
    loadData();
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    localStorage.removeItem('texol_auth_user');
    localStorage.removeItem('texol_active_tab');
    setCurrentUser(null);
    setIsLoggedIn(false);
    _setActiveTab('dashboard');
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [fData, lData, pData, dData, demoData, sData, oData, pocData, aData, accData, opMetrics, uData, pListData, srcData] = await Promise.all([
        api.getFunnelAnalytics().catch(() => null),
        api.getLeads().catch(() => ({ results: [] })),
        api.getProducts().catch(() => ({ results: [] })),
        api.getDiscoveries().catch(() => ({ results: [] })),
        api.getDemos().catch(() => ({ results: [] })),
        api.getSQLHandoffs().catch(() => ({ results: [] })),
        api.getOpportunities().catch(() => ({ results: [] })),
        api.getPOCs().catch(() => ({ results: [] })),
        api.getAuditLogs().catch(() => ({ results: [] })),
        api.getAccounts().catch(() => ({ results: [] })),
        api.getOperationalMetrics().catch(() => null),
        api.getUsers().catch(() => ({ results: [] })),
        api.getPartners().catch(() => ({ results: [] })),
        api.getLeadSources().catch(() => ({ results: [] }))
      ]);
      setFunnelData(fData);
      setLeads(lData.results);
      const fetchedSources = Array.isArray(srcData) ? srcData : (srcData?.results || []);
      setLeadSources(fetchedSources);
      setProducts(pData.results);
      if (pData.results && pData.results.length > 0 && !newProductId) {
        setNewProductId(pData.results[0].id);
        setNewProductCode(pData.results[0].code);
      }
      setDiscoveries(dData.results);
      setDemos(demoData.results);
      setSqlHandoffs(sData.results);
      setOpportunities(oData.results);
      setPocs(pocData.results);

      const fetchedPartners = pListData?.results || [];
      setPartnerList(fetchedPartners);

      // Determine active partner ID for portal
      let activePid = selectedPartnerId;
      if (currentUser?.is_partner_user && currentUser?.partner_details?.partner_id) {
        activePid = currentUser.partner_details.partner_id;
      } else if (!activePid && fetchedPartners.length > 0) {
        activePid = fetchedPartners[0].id;
      }
      if (activePid && activePid !== selectedPartnerId) {
        setSelectedPartnerId(activePid);
      }

      const pDash = await api.getPartnerPortalDashboard(activePid || undefined).catch(() => null);
      setPartnerDashboard(pDash);

      setAuditLogs(aData.results);
      setAccounts(accData.results || []);
      setOperationalMetrics(opMetrics);
      setStaffUsers(uData?.results || []);

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
    inAppAlert.success(msg);
  };

  const handleInspectLead = (lead: Lead) => {
    setSelectedLead(lead);
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
    if (!canAcceptDealRegistration(currentUser)) {
      inAppAlert.error('Permission Denied: Only Channel Partner Managers and authorized managers can accept deal registrations.');
      return;
    }
    try {
      const res = await api.acceptDealRegistration(regId, 90);
      notifySuccess(res.message);
      const targetPid = selectedPartnerId || partnerDashboard?.partner_id;
      const updatedDash = await api.getPartnerPortalDashboard(targetPid || undefined).catch(() => null);
      if (updatedDash) {
        setPartnerDashboard(updatedDash);
      }
      loadData();
    } catch (err: any) {
      inAppAlert.error(err.message || 'Failed to accept deal registration');
    }
  };

  const handleSelectPartner = async (pId: string) => {
    setSelectedPartnerId(pId);
    try {
      const pDash = await api.getPartnerPortalDashboard(pId);
      setPartnerDashboard(pDash);
    } catch (err: any) {
      inAppAlert.error(err.message || 'Failed to load partner dashboard');
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let targetAccountId = selectedAccountId;
      let targetAccountName = '';

      if (accountSelectionMode === 'create') {
        if (!newCompanyName.trim()) {
          inAppAlert.warning('Please enter a Company Name.');
          return;
        }
        const acc = await api.createAccount({
          company_name: newCompanyName.trim(),
          domain: newDomain.trim() || undefined,
          industry: newIndustry,
          employees_count: Number(newEmployees),
          distribution_centers_count: Number(icpDistributionCenters || 1),
          city: newCity.trim() || undefined,
          country: newCountry.trim() || undefined,
          is_target_account: newIsTarget,
          target_tier: newIsTarget ? newTargetTier : undefined
        });
        targetAccountId = acc.id;
        targetAccountName = acc.company_name;
      } else {
        if (!selectedAccountId) {
          inAppAlert.warning('Please select an existing Customer Account.');
          return;
        }
        const foundAcc = accounts.find(a => a.id === selectedAccountId);
        targetAccountName = foundAcc?.company_name || 'Selected Customer';
      }

      // Create primary customer contact person if contact name was supplied
      let createdContactId: string | undefined = undefined;
      if (newContactName.trim()) {
        const parts = newContactName.trim().split(' ');
        const firstName = parts[0];
        const lastName = parts.slice(1).join(' ') || undefined;

        try {
          const contact = await api.createContact({
            account: targetAccountId,
            first_name: firstName,
            last_name: lastName,
            designation: newContactTitle.trim() || undefined,
            email: newContactEmail.trim() || undefined,
            phone: newContactPhone.trim() || undefined,
            role_type: newContactRole,
            is_primary: true
          });
          createdContactId = contact.id;
        } catch (contactErr: any) {
          console.warn('Customer contact creation warning:', contactErr);
        }
      }

      const selectedProduct = products.find(p => p.id === newProductId || p.code === newProductCode) || products[0];

      // Prepare dynamic ICP attributes payload according to product requirements & defined rules
      const icpAttributesPayload: Record<string, any> = {
        primary_erp: dynamicIcpValues['primary_erp'] ?? icpPrimaryErp,
        ...dynamicIcpValues
      };

      // Ensure fallback legacy product attributes are properly initialized if not already in dynamicIcpValues
      if (selectedProduct.code === 'VANFORCES') {
        if (icpAttributesPayload.field_sales === undefined) icpAttributesPayload.field_sales = Boolean(icpFieldSales);
        if (icpAttributesPayload.vans_count === undefined) icpAttributesPayload.vans_count = Number(icpVansCount);
        if (icpAttributesPayload.salesmen_count === undefined) icpAttributesPayload.salesmen_count = Number(icpSalesmenCount);
      } else if (selectedProduct.code === 'TASKFORCES') {
        if (icpAttributesPayload.employees_count === undefined) icpAttributesPayload.employees_count = Number(newEmployees);
      } else if (selectedProduct.code === 'AL_MAWASIL') {
        if (icpAttributesPayload.monthly_invoices === undefined) icpAttributesPayload.monthly_invoices = Number(icpMonthlyInvoices);
        if (icpAttributesPayload.vat_registered === undefined) icpAttributesPayload.vat_registered = true;
      } else if (selectedProduct.code === 'SPEAKORDER') {
        if (icpAttributesPayload.daily_orders === undefined) icpAttributesPayload.daily_orders = Number(icpDailyOrders);
      }

      // Format types (numbers and booleans) accurately based on product rules
      productIcpRules.forEach(rule => {
        const val = icpAttributesPayload[rule.field_name];
        if (val !== undefined && val !== null && val !== '') {
          if (['GTE', 'GT', 'LTE', 'LT'].includes(rule.operator) || typeof rule.target_value === 'number') {
            if (!isNaN(Number(val))) {
              icpAttributesPayload[rule.field_name] = Number(val);
            }
          } else if (typeof rule.target_value === 'boolean' || rule.target_value === 'true' || rule.target_value === 'false') {
            icpAttributesPayload[rule.field_name] = Boolean(val);
          }
        }
      });

      // Pre-save attributes to account for selected product
      try {
        await api.upsertAccountAttributes(targetAccountId, selectedProduct.id, icpAttributesPayload);
      } catch (attrErr) {
        console.warn('Pre-saving account attributes warning:', attrErr);
      }

      // Enforce Role Rule: Sales reps can ONLY assign leads to themselves.
      // Only Managers and Admins can assign leads to other staff members.
      const assignedOwner = isManagerOrAdmin
        ? (newAssignedOwnerId || currentUser?.id || undefined)
        : (currentUser?.id || undefined);

      const createdLead = await api.createLead({
        account: targetAccountId,
        contact: createdContactId,
        primary_product: selectedProduct.id,
        owner: assignedOwner,
        source: newLeadSourceId || undefined,
        next_activity_due_at: new Date().toISOString(),
        next_action_description: newNextAction,
        icp_attributes: icpAttributesPayload
      });

      setShowIntakeModal(false);
      setNewLeadSourceId('');
      setNewCompanyName('');
      setNewDomain('');
      setNewCity('');
      setNewCountry('');
      setSelectedAccountId('');
      setAccountSelectionMode('create');
      setNewContactName('');
      setNewContactTitle('');
      setNewContactEmail('');
      setNewContactPhone('');
      setNewContactRole('DECISION_MAKER');
      setNewAssignedOwnerId('');
      setDuplicateMatches([]);
      setIcpFieldSales(true);
      setIcpVansCount(25);
      setIcpSalesmenCount(25);
      setIcpPrimaryErp('Odoo');
      setIcpDistributionCenters(2);
      setIcpDailyOrders(150);
      setIcpMonthlyInvoices(10000);

      const isPassedIcp = (String(createdLead?.icp_result).toUpperCase() === 'PASS' || createdLead?.icp_knockout_passed === true) && createdLead?.status === 'ACTIVE';
      const isFailedIcp = !isPassedIcp && (
        createdLead?.status === 'NURTURE' ||
        createdLead?.status === 'DISQUALIFIED' ||
        String(createdLead?.icp_result).toUpperCase() === 'FAIL' ||
        createdLead?.icp_knockout_passed === false
      );

      if (isFailedIcp) {
        inAppAlert.warning(`Lead for "${targetAccountName}" failed mandatory ICP knockout criteria. It was NOT added to the PLD queue and has been moved to Nurture & Win-Back Pool -> ICP Failed.`);
        setNurtureInitialTab('ICP_FAILED');
        setActiveTab('nurture-pool');
      } else {
        notifySuccess(`New lead created & passed ICP qualification for ${targetAccountName}! Added to active PLD Queue.`);
      }
      loadData();
    } catch (err: any) {
      inAppAlert.error(err.message || 'Failed to create lead');
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

      const targetPartnerId = (
        (currentUser?.is_partner_user && currentUser?.partner_details?.partner_id)
        || regPartnerId
        || selectedPartnerId
        || partnerDashboard?.partner_id
        || (partnerList[0]?.id)
      );

      if (!targetPartnerId) {
        inAppAlert.error('No partner organization selected for deal registration.');
        return;
      }

      const res = await api.submitDealRegistration({
        partner: targetPartnerId,
        customer_account: acc.id,
        product: prod.id,
        expected_deal_value: Number(regValue),
        evidence_notes: regEvidence
      });

      setShowDealRegModal(false);
      setRegCustomerName('');
      setRegValue(50000);
      setRegEvidence('');
      if (res.conflict) {
        inAppAlert.warning(res.message, 'Deal Registration Conflict');
      } else {
        inAppAlert.success(res.message);
      }
      
      const updatedDash = await api.getPartnerPortalDashboard(targetPartnerId).catch(() => null);
      if (updatedDash) {
        setPartnerDashboard(updatedDash);
      }
      loadData();
    } catch (err: any) {
      inAppAlert.error(err.message || 'Failed to submit deal registration');
    }
  };

  if (!isLoggedIn || !currentUser) {
    return (
      <>
        <InAppAlertContainer />
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <InAppAlertContainer />

      {/* 1. Left Sidebar Navigation */}
      <aside style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: '260px',
        height: '100vh',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        zIndex: 50,
        boxSizing: 'border-box'
      }}>
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingLeft: '8px', flexShrink: 0 }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(79, 70, 229, 0.35)'
          }}>
            <Sparkles size={20} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>TEXOL CRM</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>CONFIGURABLE PLD ENGINE</div>
          </div>
        </div>

        {/* Navigation Items - Filtered by RBAC */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {isTabAllowed('dashboard') && (
            <button 
              className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('dashboard')}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
            >
              <BarChart3 size={16} />
              Analytics &amp; Dashboards
            </button>
          )}

          {isTabAllowed('work-queue') && (
            <button 
              className={`btn ${activeTab === 'work-queue' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('work-queue')}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem', borderColor: activeTab === 'work-queue' ? undefined : 'rgba(59, 130, 246, 0.4)' }}
            >
              <ListTodo size={16} color="var(--primary)" />
              My Work Queue
              {((operationalMetrics?.overdue_tasks ?? 0) + (operationalMetrics?.tasks_due_today ?? 0)) > 0 && (
                <span className="badge badge-danger" style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>
                  {(operationalMetrics?.overdue_tasks ?? 0) + (operationalMetrics?.tasks_due_today ?? 0)}
                </span>
              )}
            </button>
          )}

          {isTabAllowed('account-360') && (
            <button 
              className={`btn ${activeTab === 'account-360' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('account-360')}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
            >
              <Building2 size={16} />
              Account 360
              <span className="badge badge-neutral" style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>{accounts.length}</span>
            </button>
          )}

          {isTabAllowed('queue') && (
            <button 
              className={`btn ${activeTab === 'queue' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setActiveTab('queue'); if (visibleLeads.length > 0) handleInspectLead(visibleLeads[0]); }}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
            >
              <Layers size={16} />
              PLD Lead Queue
              <span className="badge badge-info" style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>{visibleLeads.length}</span>
            </button>
          )}

          {isTabAllowed('discovery') && (
            <button 
              className={`btn ${activeTab === 'discovery' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('discovery')}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
            >
              <Compass size={16} />
              Discovery &amp; Mapping
              <span className="badge badge-neutral" style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>{discoveries.length}</span>
            </button>
          )}

          {isTabAllowed('demo') && (
            <button 
              className={`btn ${activeTab === 'demo' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('demo')}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
            >
              <Monitor size={16} />
              Demo Workspace
              <span className="badge badge-neutral" style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>{demos.length}</span>
            </button>
          )}

          {isTabAllowed('poc') && (
            <button 
              className={`btn ${activeTab === 'poc' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('poc')}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
            >
              <FlaskConical size={16} />
              POC Pilot Trials
              <span className="badge badge-neutral" style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>{pocs.length}</span>
            </button>
          )}

          {isTabAllowed('sql') && (
            <button 
              className={`btn ${activeTab === 'sql' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('sql')}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
            >
              <CheckSquare size={16} />
              SQL Gate Readiness
              <span className="badge badge-warning" style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>{sqlHandoffs.filter(h => h.status === 'PENDING').length}</span>
            </button>
          )}

          {isTabAllowed('opportunities') && (
            <button 
              className={`btn ${activeTab === 'opportunities' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('opportunities')}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
            >
              <Briefcase size={16} />
              Opportunities
              <span className="badge badge-neutral" style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>{opportunities.length}</span>
            </button>
          )}

          {isTabAllowed('proposals') && (
            <button 
              className={`btn ${activeTab === 'proposals' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('proposals')}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
            >
              <FileText size={16} />
              Commercial Proposals
            </button>
          )}

          {isTabAllowed('negotiation') && (
            <button 
              className={`btn ${activeTab === 'negotiation' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('negotiation')}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
            >
              <Handshake size={16} />
              Negotiation Stage
              {opportunities.filter(o => o.status === 'OPEN' && (o.stage_code === 'OPP_NEGOTIATION' || o.stage_name?.includes('Negotiation'))).length > 0 && (
                <span className="badge badge-warning" style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>
                  {opportunities.filter(o => o.status === 'OPEN' && (o.stage_code === 'OPP_NEGOTIATION' || o.stage_name?.includes('Negotiation'))).length}
                </span>
              )}
            </button>
          )}

          {isTabAllowed('customer-lifecycle') && (
            <button 
              className={`btn ${activeTab === 'customer-lifecycle' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('customer-lifecycle')}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
            >
              <Layers size={16} />
              Customer Lifecycle
              {opportunities.filter(o => o.status === 'WON').length > 0 && (
                <span className="badge badge-success" style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>
                  {opportunities.filter(o => o.status === 'WON').length}
                </span>
              )}
            </button>
          )}

          {isTabAllowed('nurture-pool') && (
            <button 
              className={`btn ${activeTab === 'nurture-pool' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('nurture-pool')}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
            >
              <RotateCcw size={16} />
              Nurture &amp; Win-Back Pool
              {(() => {
                const totalNurtureItems = opportunities.filter(o => o.status === 'LOST').length +
                  leads.filter(l => l.status === 'NURTURE' || l.status === 'DISQUALIFIED' || String(l.icp_result).toUpperCase() === 'FAIL' || l.icp_knockout_passed === false).length;
                return totalNurtureItems > 0 ? (
                  <span className="badge badge-neutral" style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>
                    {totalNurtureItems}
                  </span>
                ) : null;
              })()}
            </button>
          )}

          {/* Phase 3 Tabs */}
          {(isTabAllowed('attribution') || isTabAllowed('leakage') || isTabAllowed('communications') || isTabAllowed('erp')) && (
            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '8px 0' }} />
          )}

          {isTabAllowed('attribution') && (
            <button 
              className={`btn ${activeTab === 'attribution' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('attribution')}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
            >
              <Share2 size={16} />
              Multi-Touch Attribution
            </button>
          )}

          {isTabAllowed('leakage') && (
            <button 
              className={`btn ${activeTab === 'leakage' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('leakage')}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
            >
              <Gauge size={16} />
              Funnel Leakage &amp; Velocity
            </button>
          )}

          {isTabAllowed('communications') && (
            <button 
              className={`btn ${activeTab === 'communications' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('communications')}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
            >
              <Send size={16} />
              Omni-Channel Comms
            </button>
          )}

          {isTabAllowed('erp') && (
            <button 
              className={`btn ${activeTab === 'erp' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('erp')}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
            >
              <Database size={16} />
              ERP Customer Sync
            </button>
          )}

          {isTabAllowed('partners') && (
            <button 
              className={`btn ${activeTab === 'partners' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('partners')}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem', borderColor: activeTab === 'partners' ? undefined : 'rgba(59, 130, 246, 0.3)' }}
            >
              <Handshake size={16} color="var(--primary)" />
              Partner Portal (Wireframe 13.4)
            </button>
          )}

          {isTabAllowed('studio') && (
            <button 
              className={`btn ${activeTab === 'studio' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('studio')}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
            >
              <Settings size={16} />
              Product Studio
            </button>
          )}

          {isTabAllowed('audit') && (
            <button 
              className={`btn ${activeTab === 'audit' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('audit')}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem' }}
            >
              <History size={16} />
              Universal Audit Trail
            </button>
          )}

          {isTabAllowed('staff-partners') && (
            <button 
              className={`btn ${activeTab === 'staff-partners' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('staff-partners')}
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem', borderColor: activeTab === 'staff-partners' ? undefined : 'rgba(16, 185, 129, 0.4)' }}
            >
              <UserPlus size={16} color="#10B981" />
              Staff &amp; Partners
              <span className="badge badge-success" style={{ marginLeft: 'auto', fontSize: '0.65rem' }}>Admin</span>
            </button>
          )}

          {isTabAllowed('admin-leads') && (
            <button 
              className={`btn ${activeTab === 'admin-leads' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('admin-leads')}
              style={{ 
                justifyContent: 'flex-start', 
                padding: '8px 12px', 
                fontSize: '0.82rem', 
                borderColor: activeTab === 'admin-leads' ? undefined : 'rgba(99, 102, 241, 0.4)' 
              }}
            >
              <FolderKanban size={16} color="#6366F1" />
              All Leads Directory
              <span className="badge badge-primary" style={{ marginLeft: 'auto', fontSize: '0.65rem' }}>Admin</span>
            </button>
          )}
        </nav>

        {/* User Context & Footer with Role Switching & Logout */}
        <div style={{
          marginTop: 'auto',
          padding: '12px',
          background: 'var(--bg-surface-elevated)',
          borderRadius: '10px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: currentUser?.role === 'ADMIN' ? '#4F46E5' : currentUser?.role === 'PARTNER_USER' ? '#E11D48' : '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.8rem',
              color: '#FFFFFF',
              flexShrink: 0
            }}>
              {(currentUser?.first_name?.[0] || currentUser?.name?.[0] || 'U').toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentUser?.name}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentUser?.role_display}
                {currentUser?.partner_details ? ` • ${currentUser.partner_details.partner_name}` : ''}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              onClick={handleLogout}
              className="btn btn-outline"
              style={{ width: '100%', padding: '6px 12px', fontSize: '0.75rem', color: '#F43F5E', borderColor: 'rgba(244, 63, 94, 0.3)', justifyContent: 'center' }}
              title="Sign Out"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Workspace */}
      <main style={{
        flex: 1,
        marginLeft: '260px',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        width: 'calc(100% - 260px)',
        boxSizing: 'border-box'
      }}>
        {/* Top Header */}
        <header style={{
          height: '68px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(8px)',
          position: 'sticky',
          top: 0,
          zIndex: 40
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <GlobalSearchBar
              accounts={accounts}
              leads={visibleLeads}
              opportunities={opportunities}
              products={products}
              onNavigateToAccount={(id) => {
                setSelectedAccount360Id(id);
                setActiveTab('account-360');
              }}
              onNavigateToLead={(lead) => {
                setSelectedLead(lead);
                setActiveTab('queue');
              }}
              onNavigateToOpportunity={(id) => {
                setSelectedOpportunityId(id);
                setActiveTab('opportunities');
              }}
              onNavigateToProductStudio={() => {
                setActiveTab('studio');
              }}
            />
            
            {/* RBAC Active Role Indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.78rem'
            }}>
              <UserCheck size={14} color="#10B981" />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{currentUser?.name}</span>
              <span className="badge badge-info" style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                {currentUser?.role_display}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
              <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
            </button>

            <NotificationCenter onNavigateToEntity={(type, id) => {
              if (type === 'lead') {
                const found = leads.find(l => l.id === id);
                if (found) setSelectedLead(found);
                setActiveTab('queue');
              } else if (type === 'opportunity') {
                setSelectedOpportunityId(id);
                setActiveTab('opportunities');
              } else if (type === 'account') {
                setSelectedAccount360Id(id);
                setActiveTab('account-360');
              } else {
                setActiveTab('work-queue');
              }
            }} />
            {!currentUser?.is_partner_user && (
              <button className="btn btn-primary" onClick={() => setShowIntakeModal(true)}>
                <PlusCircle size={16} />
                Intake New Lead
              </button>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          {!isTabAllowed(activeTab) ? (
            (!currentUser?.allowed_workspaces || currentUser.allowed_workspaces.length === 0) ? (
              <div className="card text-center" style={{ padding: '64px 32px', maxWidth: '600px', margin: '40px auto' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px auto'
                }}>
                  <ShieldAlert size={32} color="#F59E0B" />
                </div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  No Authorized Workspaces Assigned
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '24px', lineHeight: 1.5 }}>
                  Your current account does not have any assigned workspaces. Please contact your system administrator.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)', gap: '12px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: '3px solid var(--primary)',
                  borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Redirecting to authorized workspace...</span>
              </div>
            )
          ) : (
            <ErrorBoundary key={activeTab} fallbackTitle={`Unable to load ${activeTab} workspace`}>
              {/* TAB 1: PHASE 10 ANALYTICS & DASHBOARDS HUB */}
              {activeTab === 'dashboard' && (
            <AnalyticsHubView
              products={products}
              onNavigateToLead={(leadId) => {
                const found = leads.find(l => l.id === leadId);
                if (found) setSelectedLead(found);
                setActiveTab('queue');
              }}
              onNavigateToOpportunity={(oppId) => {
                setSelectedOpportunityId(oppId);
                setActiveTab('opportunities');
              }}
              onNavigateToProposal={() => {
                setActiveTab('proposals');
              }}
              onNavigateToSQL={() => {
                setActiveTab('sql');
              }}
              onNavigateToTab={(tab) => {
                setActiveTab(tab as any);
              }}
            />
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
                  <span className="badge badge-neutral">{visibleLeads.length} Records</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {visibleLeads.map(lead => {
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
                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{lead.account_name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Product: <strong style={{ color: 'var(--primary)' }}>{lead.primary_product_name}</strong>
                            </div>
                          </div>
                          <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                            {lead.current_stage_name || lead.status}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
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
                          {lead.owner_name && (
                            <span className="badge badge-neutral" style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <UserCheck size={10} color="var(--primary)" /> {lead.owner_name}
                            </span>
                          )}
                        </div>

                        {lead.contact_name && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <User size={11} color="#10B981" />
                            <span><strong>Contact:</strong> {lead.contact_name}{lead.contact_designation ? ` (${lead.contact_designation})` : ''}</span>
                          </div>
                        )}

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

                        {/* Date and Time Logs for Lead Card */}
                        <div style={{
                          marginTop: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderTop: '1px solid var(--border-subtle)',
                          paddingTop: '6px',
                          fontSize: '0.68rem',
                          color: 'var(--text-muted)'
                        }}>
                          <span title="Created timestamp" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Calendar size={11} /> {new Date(lead.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {lead.last_activity_at ? (
                            <span title="Last action date & time" style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--text-secondary)' }}>
                              <Clock size={11} color="var(--primary)" /> {new Date(lead.last_activity_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span style={{ fontStyle: 'italic', opacity: 0.7 }}>No activity yet</span>
                          )}
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
                    setActiveTab('discovery');
                  }}
                  onLeadUpdated={() => loadData()}
                  onNavigateToNurture={(targetTab = 'ICP_FAILED') => {
                    loadData();
                    setNurtureInitialTab(targetTab as any);
                    setActiveTab('nurture-pool' as any);
                  }}
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
                setActiveTab('demo');
              }}
              onNavigateToSQL={(targetLeadId) => {
                if (targetLeadId) {
                  const found = leads.find(l => l.id === targetLeadId);
                  if (found) setSelectedLead(found);
                }
                setActiveTab('sql');
              }}
            />
          )}

          {/* TAB 4: DEMO WORKSPACE (PHASE 6) */}
          {activeTab === 'demo' && (
            <DemoWorkspace
              leadId={selectedLead?.id}
              onDemoCompleted={(completedDemo) => {
                notifySuccess(`Demo for ${completedDemo.account_name} completed successfully! Verification gates passed.`);
                loadData();
              }}
              onNavigateToPOC={async (targetLeadId) => {
                const found = leads.find(l => l.id === targetLeadId);
                if (found) {
                  setSelectedLead(found);
                } else if (targetLeadId) {
                  try {
                    const fetchedLead = await api.getLead(targetLeadId);
                    if (fetchedLead) setSelectedLead(fetchedLead);
                  } catch (e) {
                    console.warn('Could not fetch lead on navigate to POC:', e);
                  }
                }
                setActiveTab('poc');
              }}
              onNavigateToSQL={(targetLeadId) => {
                if (targetLeadId) {
                  const found = leads.find(l => l.id === targetLeadId);
                  if (found) setSelectedLead(found);
                }
                setActiveTab('sql');
              }}
            />
          )}

          {/* TAB 5: POC PILOT MANAGEMENT WORKSPACE (PHASE 6) */}
          {activeTab === 'poc' && (
            <POCWorkspace
              leadId={selectedLead?.id}
              onPOCCompleted={(completedPOC) => {
                notifySuccess(`POC trial for ${completedPOC.account_name} completed successfully! Trial criteria verified.`);
                loadData();
              }}
              onNavigateToSQL={(targetLeadId) => {
                if (targetLeadId) {
                  const found = leads.find(l => l.id === targetLeadId);
                  if (found) setSelectedLead(found);
                }
                setActiveTab('sql');
              }}
            />
          )}

          {/* TAB 5: SQL READINESS & SALES ACCEPTANCE WORKSPACES */}
          {activeTab === 'sql' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Sub-view switcher */}
              <div className="glass-panel" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-surface)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  <button
                    onClick={() => setSqlSubView('readiness')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: sqlSubView === 'readiness' ? 'var(--primary)' : 'transparent',
                      color: sqlSubView === 'readiness' ? '#FFFFFF' : 'var(--text-secondary)',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <CheckSquare size={15} />
                    SQL Readiness Gates (9 Gates)
                  </button>
                  <button
                    onClick={() => setSqlSubView('acceptance')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: sqlSubView === 'acceptance' ? 'var(--primary)' : 'transparent',
                      color: sqlSubView === 'acceptance' ? '#FFFFFF' : 'var(--text-secondary)',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <ShieldCheck size={15} />
                    Sales Acceptance Queue &amp; SLA
                  </button>
                </div>
              </div>

              {sqlSubView === 'readiness' ? (
                <SQLReadinessWorkspace
                  initialLeadId={selectedLead?.id}
                  onNavigateToOpportunity={(oppId) => {
                    setSelectedOpportunityId(oppId);
                    setActiveTab('opportunities');
                  }}
                  onNavigateToSalesAcceptance={() => {
                    setSqlSubView('acceptance');
                  }}
                  onNavigateToTab={(tab, targetLeadId) => {
                    if (targetLeadId) {
                      const found = leads.find(l => l.id === targetLeadId);
                      if (found) setSelectedLead(found);
                    }
                    setActiveTab(tab as any);
                  }}
                />
              ) : (
                <SalesAcceptanceWorkspace
                  onNavigateToOpportunity={(oppId) => {
                    setSelectedOpportunityId(oppId);
                    setActiveTab('opportunities');
                  }}
                  onNavigateToLead={(ldId) => {
                    const found = leads.find(l => l.id === ldId);
                    if (found) setSelectedLead(found);
                    setActiveTab('queue');
                  }}
                />
              )}
            </div>
          )}

          {/* TAB: MY WORK QUEUE (PHASE 9) */}
          {activeTab === 'work-queue' && (
            <MyWorkQueueWorkspace
              currentUser={currentUser}
              onNavigateToLead={(leadId) => {
                const found = leads.find(l => l.id === leadId);
                if (found) setSelectedLead(found);
                setActiveTab('queue');
              }}
              onNavigateToOpportunity={(oppId) => {
                setSelectedOpportunityId(oppId);
                setActiveTab('opportunities');
              }}
              onNavigateToAccount={(accId) => {
                setSelectedAccount360Id(accId);
                setActiveTab('account-360');
              }}
            />
          )}

          {/* TAB: ACCOUNT 360 (PHASE 9) */}
          {activeTab === 'account-360' && (
            <Account360Workspace
              initialAccountId={selectedAccount360Id}
              onNavigateToOpportunity={(oppId) => {
                setSelectedOpportunityId(oppId);
                setActiveTab('opportunities');
              }}
            />
          )}

          {/* TAB 6: COMMERCIAL OPPORTUNITY WORKSPACE */}
          {activeTab === 'opportunities' && (
            <OpportunityWorkspace
              initialOpportunityId={selectedOpportunityId}
              onNavigateToAccount={(accId) => {
                setSelectedAccount360Id(accId);
                setActiveTab('account-360');
              }}
              onNavigateToProposal={(oppId) => {
                setSelectedOpportunityId(oppId);
                setActiveTab('proposals');
              }}
              onNavigateToNegotiation={(oppId) => {
                setSelectedOpportunityId(oppId);
                setActiveTab('negotiation');
              }}
            />
          )}

          {/* TAB 6.5: COMMERCIAL PROPOSALS WORKSPACE (PHASE 8) */}
          {activeTab === 'proposals' && (
            <ProposalWorkspace
              initialOpportunityId={selectedOpportunityId}
              onNavigateToOpportunity={(oppId) => {
                setSelectedOpportunityId(oppId);
                setActiveTab('opportunities');
              }}
              onNavigateToNegotiation={(oppId) => {
                setSelectedOpportunityId(oppId);
                setActiveTab('negotiation');
              }}
            />
          )}

          {/* COMMERCIAL NEGOTIATION STAGE WORKSPACE */}
          {activeTab === 'negotiation' && (
            <NegotiationWorkspace
              initialOpportunityId={selectedOpportunityId}
              selectedProductFilter={selectedProductFilter}
              onNavigateToProposal={(oppId) => {
                setSelectedOpportunityId(oppId);
                setActiveTab('proposals');
              }}
              onNavigateToAccount={(accId) => {
                setSelectedAccount360Id(accId);
                setActiveTab('account-360');
              }}
            />
          )}

          {/* POST-NEGOTIATION CUSTOMER LIFECYCLE & EXPANSION WORKSPACE */}
          {activeTab === 'customer-lifecycle' && (
            <CustomerLifecycleWorkspace
              initialAccountId={selectedAccount360Id}
              selectedProductFilter={selectedProductFilter}
              onNavigateToAccount={(accId) => {
                setSelectedAccount360Id(accId);
                setActiveTab('account-360');
              }}
              onNavigateToOpportunity={(oppId) => {
                setSelectedOpportunityId(oppId);
                setActiveTab('opportunities');
              }}
            />
          )}

          {/* NURTURE & WIN-BACK INTELLIGENCE POOL */}
          {activeTab === 'nurture-pool' && (
            <NurtureWorkspace
              key={nurtureInitialTab}
              selectedProductFilter={selectedProductFilter}
              initialTab={nurtureInitialTab}
              onNavigateToAccount={(accId) => {
                setSelectedAccount360Id(accId);
                setActiveTab('account-360');
              }}
              onNavigateToOpportunity={(oppId) => {
                setSelectedOpportunityId(oppId);
                setActiveTab('opportunities');
              }}
              onNavigateToNegotiation={(oppId) => {
                setSelectedOpportunityId(oppId);
                setActiveTab('negotiation');
              }}
              onNavigateToLead={(targetLead) => {
                setSelectedLead(targetLead);
                setActiveTab('queue');
                loadData();
              }}
            />
          )}

          {/* TAB 7: PARTNER PORTAL (WIREFRAME 13.4 - NEW IN PHASE 3) */}
          {activeTab === 'partners' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                      Partner Portal: {partnerDashboard?.partner_name || (partnerList.find(p => p.id === selectedPartnerId)?.company_name) || 'Partner Organization'}
                    </h1>
                    <span className="badge badge-info">
                      Partner Code: {partnerDashboard?.partner_code || (partnerList.find(p => p.id === selectedPartnerId)?.partner_code) || 'N/A'}
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                    Isolated partner organization workspace: Protected deal registrations, certified products, and commissions.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {!currentUser?.is_partner_user && partnerList.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>VIEW PARTNER:</span>
                      <select
                        value={selectedPartnerId || partnerDashboard?.partner_id || ''}
                        onChange={(e) => handleSelectPartner(e.target.value)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '8px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        {partnerList.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.company_name || p.partner_code} ({p.partner_code})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button className="btn btn-primary" onClick={() => {
                    setRegPartnerId(selectedPartnerId || partnerDashboard?.partner_id || (partnerList[0]?.id || ''));
                    setShowDealRegModal(true);
                  }}>
                    <PlusCircle size={16} />
                    Register New Deal
                  </button>
                </div>
              </div>

              {/* Partner KPI Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px' }}>
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>REGISTERED DEALS</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: 'var(--text-primary)' }}>
                    {partnerDashboard?.metrics?.registered_deals_count ?? 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Active submissions</div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>ACCEPTED &amp; PROTECTED</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: 'var(--success)' }}>
                    {partnerDashboard?.metrics?.accepted_deals_count ?? 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--success)', marginTop: '4px' }}>90-Day exclusivity active</div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>PARTNER PIPELINE</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: 'var(--primary)' }}>
                    ${(Number(partnerDashboard?.metrics?.pipeline_estimate) || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--primary)', marginTop: '4px' }}>Total expected value</div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>ACCRUED COMMISSIONS</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: 'var(--warning)' }}>
                    ${(Number(partnerDashboard?.metrics?.total_commission_accrued) || 0).toLocaleString()}
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
                  {(!partnerDashboard?.recent_registrations || partnerDashboard.recent_registrations.length === 0) ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No deal registrations found for {partnerDashboard?.partner_name || 'this partner organization'}. Click "+ Register New Deal" above to register.
                    </div>
                  ) : (
                    partnerDashboard.recent_registrations.map((reg: any) => (
                      <div key={reg.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'var(--bg-surface)', borderRadius: '10px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>{reg.customer_name}</span>
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
                            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>${(Number(reg.expected_deal_value) || 0).toLocaleString()}</div>
                          </div>
                          {canAcceptDealRegistration(currentUser) && reg.status !== 'ACCEPTED' && (
                            <button className="btn btn-secondary" onClick={() => handleAcceptDealReg(reg.id)} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                              <Check size={14} /> Accept &amp; Protect
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
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
                    ICP &amp; PLD Engine Studio
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
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{m.name}</div>
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
              <OmniChannelCommsView leads={visibleLeads} onNotify={notifySuccess} />
            </div>
          )}

          {/* TAB 13: ERP CUSTOMER SYNC */}
          {activeTab === 'erp' && (
            <div className="animate-fade-in">
              <ERPSyncGatewayView accounts={accounts} onNotify={notifySuccess} />
            </div>
          )}

          {/* TAB 14: STAFF & PARTNERS MANAGEMENT (ADMIN) */}
          {activeTab === 'staff-partners' && (
            <div className="animate-fade-in">
              <AdminStaffPartnersWorkspace currentUser={currentUser} onNotify={notifySuccess} />
            </div>
          )}

          {/* TAB 15: ALL LEADS MASTER DIRECTORY (ADMIN) */}
          {activeTab === 'admin-leads' && (
            <div className="animate-fade-in">
              <AdminLeadsDirectoryWorkspace
                leads={leads}
                products={products}
                staffUsers={staffUsers}
                currentUser={currentUser}
                onRefresh={loadData}
                onNavigateToTab={(tab, leadId) => {
                  if (leadId) {
                    const found = leads.find(l => l.id === leadId);
                    if (found) setSelectedLead(found);
                  }
                  setActiveTab(tab as any);
                }}
              />
            </div>
          )}
            </ErrorBoundary>
          )}
        </div>
      </main>

      {/* LEAD INTAKE MODAL */}
      {showIntakeModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowIntakeModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
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
            style={{ 
              width: '100%', 
              maxWidth: '640px', 
              maxHeight: 'calc(100vh - 48px)',
              margin: 'auto',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div className="modal-header-accent" />
            <div 
              className="modal-card-header"
              style={{ 
                padding: '20px 24px 16px 24px', 
                borderBottom: '1px solid var(--border-subtle)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                flexShrink: 0,
                background: 'var(--bg-surface)'
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Intake New Commercial Lead</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Assign to customer account, link customer contact, and establish lead ownership
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowIntakeModal(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateLead} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, margin: 0 }}>
              <div 
                className="modal-scroll-body"
                style={{ 
                  padding: '20px 24px', 
                  overflowY: 'auto', 
                  flex: 1, 
                  minHeight: 0, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '16px' 
                }}
              >
                {/* Account / Customer Assignment Selection */}
                <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <Building2 size={14} color="var(--primary)" />
                  <span>Customer Account</span>
                  <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setAccountSelectionMode('create')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: accountSelectionMode === 'create' ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                      background: accountSelectionMode === 'create' ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-surface)',
                      color: accountSelectionMode === 'create' ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    + Create New Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountSelectionMode('existing')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: accountSelectionMode === 'existing' ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                      background: accountSelectionMode === 'existing' ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-surface)',
                      color: accountSelectionMode === 'existing' ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Select Existing Account ({accounts.length})
                  </button>
                </div>

                {accountSelectionMode === 'existing' ? (
                  <div>
                    <select
                      required={accountSelectionMode === 'existing'}
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        outline: 'none'
                      }}
                    >
                      <option value="">-- Choose Existing Customer Account --</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.company_name} {acc.industry ? `(${acc.industry})` : ''} {acc.city ? `• ${acc.city}` : ''} {acc.country ? `• ${acc.country}` : ''}
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Assign this new lead to an already established customer organization in the CRM.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Company / Account Name <span style={{ color: '#EF4444' }}>*</span></label>
                      <input 
                        type="text" 
                        required={accountSelectionMode === 'create'}
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
                          color: 'var(--text-primary)',
                          marginTop: '4px',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                          color: 'var(--text-primary)',
                          marginTop: '4px',
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: '8px' }}>
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
                            color: 'var(--text-primary)',
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Industry</label>
                        <select 
                          value={newIndustry}
                          onChange={(e) => setNewIndustry(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            marginTop: '4px',
                            outline: 'none'
                          }}
                        >
                          <option value="FMCG">FMCG</option>
                          <option value="Bakery">Bakery</option>
                          <option value="Food & Beverage">Food &amp; Beverage</option>
                          <option value="Wholesale Distribution">Wholesale Distribution</option>
                          <option value="Distribution">Distribution</option>
                          <option value="Dairy">Dairy</option>
                          <option value="Frozen Food">Frozen Food</option>
                          <option value="Retail">Retail</option>
                          <option value="Logistics">Logistics &amp; Transport</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Employees</label>
                        <input 
                          type="number"
                          value={newEmployees}
                          onChange={(e) => setNewEmployees(Number(e.target.value))}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            marginTop: '4px',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>City / Place</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Jeddah, Dammam, Dubai, Riyadh"
                          value={newCity}
                          onChange={(e) => setNewCity(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            marginTop: '4px',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Country</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Saudi Arabia, UAE, Qatar"
                          value={newCountry}
                          onChange={(e) => setNewCountry(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            marginTop: '4px',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Primary Customer Contact Person (Stakeholder) */}
              <div style={{
                padding: '14px',
                background: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={14} color="var(--primary)" />
                    <span>Customer Contact Person</span>
                  </label>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Required for SQL Readiness Gate 5</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Contact Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Tariq Al-Mansoor"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem',
                        marginTop: '4px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Job Title / Designation</label>
                    <input
                      type="text"
                      placeholder="e.g. VP of Operations / IT Director"
                      value={newContactTitle}
                      onChange={(e) => setNewContactTitle(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem',
                        marginTop: '4px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Work Email</label>
                    <input
                      type="email"
                      placeholder="e.g. tariq@customer.com"
                      value={newContactEmail}
                      onChange={(e) => setNewContactEmail(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem',
                        marginTop: '4px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Direct Phone / Mobile</label>
                    <input
                      type="text"
                      placeholder="e.g. +966 50 123 4567"
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem',
                        marginTop: '4px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Decision Role in Commercial Buying</label>
                  <select
                    value={newContactRole}
                    onChange={(e) => setNewContactRole(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      marginTop: '4px',
                      outline: 'none'
                    }}
                  >
                    <option value="DECISION_MAKER">Economic Decision Maker (Authorized Buyer)</option>
                    <option value="CHAMPION">Internal Champion / Sponsor</option>
                    <option value="INFLUENCER">Influencer / Evaluator</option>
                    <option value="TECHNICAL">Technical / IT Lead</option>
                    <option value="FINANCE">Finance / Procurement Lead</option>
                    <option value="USER">Operational End User</option>
                  </select>
                </div>
              </div>

              {/* Lead Origination Channel / Source */}
              <div style={{
                padding: '14px',
                background: 'rgba(99, 102, 241, 0.05)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Share2 size={14} color="#6366F1" />
                    <span>Lead Origination Source</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddSourceModal(true)}
                    style={{
                      background: 'rgba(99, 102, 241, 0.12)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      color: '#6366F1',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '6px'
                    }}
                  >
                    <PlusCircle size={12} />
                    <span>+ Add New Source</span>
                  </button>
                </div>

                <select
                  value={newLeadSourceId}
                  onChange={(e) => {
                    if (e.target.value === '__NEW__') {
                      setShowAddSourceModal(true);
                    } else {
                      setNewLeadSourceId(e.target.value);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="">-- Direct / Unspecified Origination Channel --</option>
                  {leadSources.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                  <option value="__NEW__">+ Add Custom Origination Channel...</option>
                </select>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Select where this lead originated from (Website Inbound, LinkedIn, WhatsApp, Referral, Exhibition, Outbound, etc.) or create a new source.
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Package size={14} color="var(--primary)" />
                  <span>Product Name</span>
                  <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select 
                  required
                  value={newProductId || (products.find(p => p.code === newProductCode)?.id || '')}
                  onChange={(e) => {
                    const chosenId = e.target.value;
                    setNewProductId(chosenId);
                    const prod = products.find(p => p.id === chosenId);
                    if (prod) setNewProductCode(prod.code);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    marginTop: '6px',
                    outline: 'none'
                  }}
                >
                  <option value="">-- Select Product Name --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code}){p.category ? ` • ${p.category}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product ICP Qualification & Operational Criteria Card */}
              <div style={{
                padding: '16px',
                background: 'rgba(59, 130, 246, 0.04)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={16} color="var(--primary)" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Product ICP Qualification Criteria
                    </span>
                  </div>
                  <span className="badge badge-primary" style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                    ⚡ Instant Knockout Validation
                  </span>
                </div>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                  Ensure this commercial prospect meets the mandatory operational criteria for <strong>{products.find(p => p.id === newProductId || p.code === newProductCode)?.name || 'the selected product'}</strong> to avoid premature disqualification.
                </p>

                {/* Dynamic ICP Qualification Rules & Real-time Verification Engine */}
                {(() => {
                  const activeIntakeProduct = products.find(p => p.id === newProductId || p.code === newProductCode) || products[0];
                  const knockoutRules = productIcpRules.filter(r => r.rule_type === 'KNOCKOUT');
                  const fitRules = productIcpRules.filter(r => r.rule_type === 'FIT' || r.rule_type === 'FIT_CRITERIA');

                  const knockoutEvaluations = knockoutRules.map(r => ({ rule: r, eval: getRuleEvaluation(r) }));
                  const fitEvaluations = fitRules.map(r => ({ rule: r, eval: getRuleEvaluation(r) }));

                  const failedKnockouts = knockoutEvaluations.filter(k => !k.eval.satisfied);
                  const satisfiedKnockouts = knockoutEvaluations.filter(k => k.eval.satisfied);

                  const totalFitPoints = fitRules.reduce((sum, r) => sum + (r.weight || 10), 0);
                  const earnedFitPoints = fitEvaluations.reduce((sum, f) => f.eval.satisfied ? sum + (f.rule.weight || 10) : sum, 0);
                  const predictedFitPercent = totalFitPoints > 0 ? Math.round((earnedFitPoints / totalFitPoints) * 100) : 100;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {/* Real-time Verification Banner */}
                      {loadingIcpRules ? (
                        <div style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <RotateCcw size={14} className="animate-spin" />
                          <span>Fetching active ICP rules for {activeIntakeProduct?.name}...</span>
                        </div>
                      ) : (
                        <div style={{
                          padding: '12px 14px',
                          borderRadius: '8px',
                          background: failedKnockouts.length > 0
                            ? 'rgba(239, 68, 68, 0.09)'
                            : (productIcpRules.length > 0 ? 'rgba(16, 185, 129, 0.09)' : 'var(--bg-surface)'),
                          border: failedKnockouts.length > 0
                            ? '1px solid rgba(239, 68, 68, 0.35)'
                            : (productIcpRules.length > 0 ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-subtle)'),
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {failedKnockouts.length > 0 ? (
                                <AlertTriangle size={16} color="#EF4444" />
                              ) : (
                                <CheckCircle2 size={16} color="#10B981" />
                              )}
                              <span style={{
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                color: failedKnockouts.length > 0 ? '#EF4444' : (productIcpRules.length > 0 ? '#10B981' : 'var(--text-primary)')
                              }}>
                                {failedKnockouts.length > 0
                                  ? `ICP Disqualification Risk: ${failedKnockouts.length} of ${knockoutRules.length} Knockout Rule(s) Unmet`
                                  : (knockoutRules.length > 0
                                      ? `ICP Pre-Verification Passed: All ${knockoutRules.length} Knockout Criteria Satisfied`
                                      : 'No Mandatory Knockout Rules Configured')}
                              </span>
                            </div>

                            {fitRules.length > 0 && (
                              <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                                Predicted Fit: {predictedFitPercent}% ({earnedFitPoints}/{totalFitPoints} pts)
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {failedKnockouts.length > 0 ? (
                              <span>
                                ⚠️ <strong>Action Required:</strong> The entered inputs fail criteria for: {failedKnockouts.map(k => k.rule.field_name.replace(/_/g, ' ')).join(', ')}. If submitted now, this lead will be automatically routed to <strong>Nurture</strong>.
                              </span>
                            ) : (
                              <span>
                                ✓ Operational parameters align with {activeIntakeProduct?.name} target ICP. This lead qualifies for full PLD assessment upon submission.
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Dynamic Rule Input Controls */}
                      {productIcpRules.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {productIcpRules.map(rule => {
                            const evalResult = getRuleEvaluation(rule);
                            const isKnockout = rule.rule_type === 'KNOCKOUT';
                            const label = rule.description || rule.field_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

                            // Value resolution
                            let currentValue = dynamicIcpValues[rule.field_name];
                            if (rule.field_name === 'industry') currentValue = newIndustry;
                            else if (rule.field_name === 'employees_count' || rule.field_name === 'employees') currentValue = newEmployees;
                            else if (rule.field_name === 'distribution_centers_count' || rule.field_name === 'distribution_depots') currentValue = icpDistributionCenters;
                            else if (rule.field_name === 'country') currentValue = newCountry;
                            else if (rule.field_name === 'city') currentValue = newCity;

                            const isBoolean = typeof rule.target_value === 'boolean' ||
                              rule.target_value === 'true' ||
                              rule.target_value === 'false' ||
                              rule.field_name === 'field_sales' ||
                              rule.field_name.startsWith('is_') ||
                              rule.field_name.startsWith('has_');

                            const isNumeric = ['GTE', 'GT', 'LTE', 'LT'].includes(rule.operator) ||
                              typeof rule.target_value === 'number' ||
                              (!isNaN(Number(rule.target_value)) && rule.target_value !== '' && !isBoolean);

                            const isChoices = (rule.operator === 'IN' || rule.operator === 'NOT_IN') && Array.isArray(rule.target_value);

                            const handleValueChange = (newVal: any) => {
                              setDynamicIcpValues(prev => ({ ...prev, [rule.field_name]: newVal }));
                              if (rule.field_name === 'field_sales') setIcpFieldSales(Boolean(newVal));
                              else if (rule.field_name === 'vans_count') setIcpVansCount(Number(newVal));
                              else if (rule.field_name === 'salesmen_count') setIcpSalesmenCount(Number(newVal));
                              else if (rule.field_name === 'primary_erp') setIcpPrimaryErp(String(newVal));
                              else if (rule.field_name === 'industry') setNewIndustry(String(newVal));
                              else if (rule.field_name === 'employees_count' || rule.field_name === 'employees') setNewEmployees(Number(newVal));
                              else if (rule.field_name === 'distribution_centers_count' || rule.field_name === 'distribution_depots') setIcpDistributionCenters(Number(newVal));
                              else if (rule.field_name === 'monthly_invoices') setIcpMonthlyInvoices(Number(newVal));
                              else if (rule.field_name === 'daily_orders') setIcpDailyOrders(Number(newVal));
                              else if (rule.field_name === 'country') setNewCountry(String(newVal));
                              else if (rule.field_name === 'city') setNewCity(String(newVal));
                            };

                            return (
                              <div
                                key={rule.id}
                                style={{
                                  padding: '12px 14px',
                                  background: 'var(--bg-surface)',
                                  border: `1px solid ${evalResult.satisfied ? 'var(--border-subtle)' : (isKnockout ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)')}`,
                                  borderRadius: '8px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                      {label}
                                    </span>
                                    <span className={`badge ${isKnockout ? 'badge-danger' : 'badge-info'}`} style={{ fontSize: '0.65rem' }}>
                                      {isKnockout ? '⚡ Mandatory Knockout' : `Fit (${rule.weight || 10} pts)`}
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                      Req: {rule.operator} {Array.isArray(rule.target_value) ? rule.target_value.join(', ') : String(rule.target_value)}
                                    </span>
                                    {evalResult.satisfied ? (
                                      <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', fontWeight: 700 }}>
                                        <CheckCircle2 size={12} /> Satisfied
                                      </span>
                                    ) : (
                                      <span style={{ color: isKnockout ? '#EF4444' : '#F59E0B', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', fontWeight: 700 }}>
                                        <AlertTriangle size={12} /> {isKnockout ? 'Fails Knockout' : 'Unmet'}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Control Switcher */}
                                {isBoolean ? (
                                  <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '8px 12px',
                                    background: Boolean(currentValue) === Boolean(rule.target_value) ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                  }}>
                                    <input
                                      type="checkbox"
                                      checked={Boolean(currentValue)}
                                      onChange={e => handleValueChange(e.target.checked)}
                                      style={{ cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                                      {rule.description || `Customer satisfies ${rule.field_name.replace(/_/g, ' ')}`}
                                    </span>
                                  </label>
                                ) : isChoices ? (
                                  <select
                                    value={String(currentValue || '')}
                                    onChange={e => handleValueChange(e.target.value)}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      borderRadius: '6px',
                                      background: 'var(--bg-surface-elevated)',
                                      border: evalResult.satisfied ? '1px solid var(--border-subtle)' : '1px solid #EF4444',
                                      color: 'var(--text-primary)',
                                      fontSize: '0.82rem',
                                      outline: 'none'
                                    }}
                                  >
                                    <option value="">-- Choose {label} Option --</option>
                                    {(rule.target_value as string[]).map((opt: string) => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                    {/* Include currentValue if custom */}
                                    {currentValue && !(rule.target_value as string[]).includes(String(currentValue)) && (
                                      <option value={String(currentValue)}>{String(currentValue)} (Custom / Non-Standard)</option>
                                    )}
                                  </select>
                                ) : isNumeric ? (
                                  <input
                                    type="number"
                                    min={0}
                                    value={currentValue !== undefined && currentValue !== null ? currentValue : ''}
                                    onChange={e => handleValueChange(e.target.value === '' ? '' : Number(e.target.value))}
                                    placeholder={`Target: ${rule.operator} ${rule.target_value}`}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      borderRadius: '6px',
                                      background: 'var(--bg-surface-elevated)',
                                      border: evalResult.satisfied ? '1px solid var(--border-subtle)' : '1px solid #EF4444',
                                      color: 'var(--text-primary)',
                                      fontSize: '0.82rem',
                                      outline: 'none'
                                    }}
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    value={String(currentValue || '')}
                                    onChange={e => handleValueChange(e.target.value)}
                                    placeholder={`Target: ${rule.target_value}`}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      borderRadius: '6px',
                                      background: 'var(--bg-surface-elevated)',
                                      border: evalResult.satisfied ? '1px solid var(--border-subtle)' : '1px solid #EF4444',
                                      color: 'var(--text-primary)',
                                      fontSize: '0.82rem',
                                      outline: 'none'
                                    }}
                                  />
                                )}

                                {rule.failure_reason && (
                                  <div style={{ fontSize: '0.7rem', color: evalResult.satisfied ? 'var(--text-muted)' : '#EF4444', fontStyle: 'italic' }}>
                                    Failure Impact: {rule.failure_reason}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{
                          padding: '16px',
                          background: 'var(--bg-surface)',
                          borderRadius: '8px',
                          border: '1px dashed var(--border-subtle)',
                          textAlign: 'center'
                        }}>
                          <ShieldAlert size={24} color="var(--primary)" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            No Custom ICP Rules Configured for {activeIntakeProduct?.name}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Standard organization parameters (Industry, Employees count, Depots) will be captured. Administrators can define custom knock-out rules and fit score thresholds anytime in Product Studio.
                          </div>
                        </div>
                      )}

                      {/* Additional Operational Parameters (ERP & Depots) if not already in dynamic rules */}
                      {!productIcpRules.some(r => r.field_name === 'primary_erp') && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              Back-Office ERP / Accounting System
                            </label>
                            <select
                              value={icpPrimaryErp}
                              onChange={(e) => {
                                setIcpPrimaryErp(e.target.value);
                                setDynamicIcpValues(prev => ({ ...prev, primary_erp: e.target.value }));
                              }}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)',
                                fontSize: '0.82rem',
                                marginTop: '4px',
                                outline: 'none'
                              }}
                            >
                              <option value="Odoo">Odoo</option>
                              <option value="SAP">SAP ERP / S4HANA</option>
                              <option value="Oracle">Oracle Fusion</option>
                              <option value="Microsoft Dynamics">Microsoft Dynamics 365</option>
                              <option value="Tally">Tally Prime</option>
                              <option value="Custom In-house">Custom Legacy In-House SQL</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              Distribution Depots / Branches
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={icpDistributionCenters}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setIcpDistributionCenters(val);
                                setDynamicIcpValues(prev => ({ ...prev, distribution_centers_count: val }));
                              }}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)',
                                fontSize: '0.82rem',
                                marginTop: '4px',
                                outline: 'none'
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Footer link to Product Studio */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '8px',
                        paddingTop: '10px',
                        borderTop: '1px solid var(--border-subtle)'
                      }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          ⚡ Rules dynamically sync from Product Studio configuration.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowIntakeModal(false);
                            _setActiveTab('admin');
                            setStudioView('engine');
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--primary)',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>Manage ICP Rules in Product Studio</span>
                          <ExternalLink size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Lead Ownership & RBAC Assignment Rules */}
              {isManagerOrAdmin ? (
                <div style={{
                  padding: '12px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <UserCheck size={14} color="#10B981" />
                      <span>Assign Lead to Staff</span>
                    </label>
                    <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                      Manager / Admin Authority
                    </span>
                  </div>
                  <select
                    value={newAssignedOwnerId}
                    onChange={(e) => setNewAssignedOwnerId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      outline: 'none'
                    }}
                  >
                    <option value="">Unassigned (Default to Creator: {currentUser?.name})</option>
                    {staffUsers
                      .filter(u => !u.is_partner_user)
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} — {u.role_display || u.role} ({u.email})
                        </option>
                      ))}
                  </select>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    As a manager or admin, select which sales representative or executive will own and qualify this lead.
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '12px 14px',
                  background: 'rgba(59, 130, 246, 0.05)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      <UserCheck size={14} color="var(--primary)" />
                      <span>Lead Owner: Assigned to You ({currentUser?.name || 'Sales Representative'})</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                      Sales Representatives can only assign leads to themselves. Only Managers and Admins can assign leads to other staff.
                    </div>
                  </div>
                  <span className="badge badge-neutral" style={{ fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                    🔒 Locked to Self
                  </span>
                </div>
              )}

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
                    color: 'var(--text-primary)',
                    marginTop: '6px',
                    outline: 'none'
                  }}
                />
                </div>
              </div>

              <div 
                className="modal-footer"
                style={{ 
                  padding: '16px 24px', 
                  borderTop: '1px solid var(--border-subtle)', 
                  display: 'flex', 
                  justifyContent: 'flex-end', 
                  gap: '12px',
                  flexShrink: 0,
                  background: 'var(--bg-surface)'
                }}
              >
                <button type="button" className="btn btn-secondary" onClick={() => setShowIntakeModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px' }}>
                  Run Automatic ICP &amp; Intake
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}



      {/* DEAL REGISTRATION MODAL */}
      {showDealRegModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDealRegModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
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
            style={{ 
              width: '100%', 
              maxWidth: '560px', 
              maxHeight: 'calc(100vh - 48px)',
              margin: 'auto',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div className="modal-header-accent" />
            <div 
              className="modal-card-header"
              style={{ 
                padding: '20px 24px 16px 24px', 
                borderBottom: '1px solid var(--border-subtle)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                flexShrink: 0,
                background: 'var(--bg-surface)'
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Submit Deal Registration</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Lock in partner protection and conflict-free exclusivity
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowDealRegModal(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitDealReg} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, margin: 0 }}>
              <div 
                className="modal-scroll-body"
                style={{ 
                  padding: '20px 24px', 
                  overflowY: 'auto', 
                  flex: 1, 
                  minHeight: 0, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '16px' 
                }}
              >
              {!currentUser?.is_partner_user && partnerList.length > 0 ? (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Partner Organization</label>
                  <select
                    value={regPartnerId || selectedPartnerId || partnerDashboard?.partner_id || ''}
                    onChange={(e) => setRegPartnerId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      marginTop: '6px',
                      outline: 'none',
                      fontWeight: 600
                    }}
                  >
                    {partnerList.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.company_name || p.partner_code} ({p.partner_code})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ padding: '10px 14px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Submitting For Partner</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)' }}>
                    {partnerDashboard?.partner_name || currentUser?.partner_details?.partner_name || 'Selected Partner'}
                  </span>
                </div>
              )}

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
                    color: 'var(--text-primary)',
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
                      color: 'var(--text-primary)',
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
                      color: 'var(--text-primary)',
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
                    color: 'var(--text-primary)',
                    marginTop: '6px',
                    outline: 'none',
                    resize: 'none'
                  }}
                />
              </div>
            </div>

            <div 
              className="modal-footer"
                style={{ 
                  padding: '16px 24px', 
                  borderTop: '1px solid var(--border-subtle)', 
                  display: 'flex', 
                  justifyContent: 'flex-end', 
                  gap: '12px',
                  flexShrink: 0,
                  background: 'var(--bg-surface)'
                }}
              >
                <button type="button" className="btn btn-secondary" onClick={() => setShowDealRegModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px' }}>
                  Submit for 90-Day Protection
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: ADD NEW LEAD SOURCE */}
      {showAddSourceModal && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 10000, backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '440px', padding: '24px', borderRadius: '12px', background: 'var(--bg-surface-elevated, #1E293B)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Share2 size={18} color="#6366F1" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Add New Lead Source</h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowAddSourceModal(false); setNewSourceName(''); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Define a new origination channel or campaign source for lead attribution across the CRM.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Source Channel Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. TikTok Ads, Trade Fair 2026, Cold Calling, Partner Referral"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setShowAddSourceModal(false); setNewSourceName(''); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingNewSource || !newSourceName.trim()}
                onClick={async () => {
                  if (!newSourceName.trim()) return;
                  setSavingNewSource(true);
                  try {
                    const created = await api.createLeadSource({ name: newSourceName.trim() });
                    setLeadSources(prev => [...prev.filter(s => s.id !== created.id), created]);
                    setNewLeadSourceId(created.id);
                    setShowAddSourceModal(false);
                    setNewSourceName('');
                    inAppAlert.success(`Lead source "${created.name}" created and selected!`);
                  } catch (err: any) {
                    inAppAlert.error(err.message || 'Failed to create lead source');
                  } finally {
                    setSavingNewSource(false);
                  }
                }}
              >
                {savingNewSource ? 'Saving...' : 'Add Source'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
