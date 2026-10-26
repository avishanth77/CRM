import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Clock, 
  HelpCircle, Plus, FileText, 
  ArrowRight, RefreshCw, UserCheck, Scale, History, AlertCircle, Sliders,
  Calendar, Search, ChevronDown, ChevronUp, User, RotateCcw, MapPin, Share2, UserPlus,
  Building2, Package, X, ExternalLink, PlusCircle, ShieldAlert
} from 'lucide-react';
import { api } from '../services/api';
import type { 
  Lead, AccountProductAssessment, QuestionnaireTemplate, 
  LeadProblemItem, StageGateChecklist, LeadActionLog, LeadSource, AuthUser,
  Product, Territory, ICPRule
} from '../services/api';
import { UnifiedActivityTimeline } from './UnifiedActivityTimeline';
import { inAppAlert } from './common/InAppAlert';
import { Modal } from './common/Modal';

interface PLDQualificationWorkspaceProps {
  lead: Lead;
  currentUser?: AuthUser | null;
  onTransitionSuccess?: () => void;
  onLeadUpdated?: () => void;
  onNavigateToNurture?: (targetTab?: 'LOST_OPPORTUNITIES' | 'ICP_FAILED' | 'NURTURE_LEADS' | 'INTELLIGENCE_MATRIX') => void;
}

export const PLDQualificationWorkspace: React.FC<PLDQualificationWorkspaceProps> = ({
  lead,
  currentUser,
  onTransitionSuccess,
  onLeadUpdated,
  onNavigateToNurture,
}) => {
  // Resolve user identity & permissions
  const activeUser = currentUser || (() => {
    try {
      const saved = localStorage.getItem('texol_auth_user');
      return saved ? (JSON.parse(saved) as AuthUser) : null;
    } catch {
      return null;
    }
  })();

  const isManagerOrAdmin = Boolean(
    activeUser?.is_superuser ||
    activeUser?.role === 'ADMIN' ||
    activeUser?.role === 'MANAGEMENT' ||
    activeUser?.role === 'SALES_MANAGER' ||
    activeUser?.role?.includes('MANAGER')
  );

  const isPresales = Boolean(
    activeUser?.role === 'PRESALES' ||
    activeUser?.role === 'PLD_EXECUTIVE' ||
    activeUser?.role === 'SOLUTION_CONSULTANT' ||
    activeUser?.role === 'SOLUTIONS_CONSULTANT'
  );

  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<AccountProductAssessment | null>(null);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireTemplate | null>(null);
  const [problems, setProblems] = useState<LeadProblemItem[]>([]);
  const [gateChecklist, setGateChecklist] = useState<StageGateChecklist | null>(null);
  
  // Questionnaire form state
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [savingScore, setSavingScore] = useState(false);
  const [evaluatingICP, setEvaluatingICP] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Salesman / Sales Owner Assignment state
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [showAssignSalesModal, setShowAssignSalesModal] = useState<boolean>(false);
  const [selectedSalesUserId, setSelectedSalesUserId] = useState<string>(lead.owner || '');
  const [assignHandoffNotes, setAssignHandoffNotes] = useState<string>('');
  const [scheduleFollowupTask, setScheduleFollowupTask] = useState<boolean>(true);
  const [savingAssignment, setSavingAssignment] = useState<boolean>(false);
  const [currentLeadOwner, setCurrentLeadOwner] = useState<{ id?: string; name?: string; email?: string } | null>({
    id: lead.owner,
    name: lead.owner_name,
    email: lead.owner_email
  });

  const isAlreadyAssigned = Boolean(currentLeadOwner?.id || currentLeadOwner?.name || lead.owner || lead.owner_name);

  // Enforce Section 9.3 RBAC:
  // Reassignment of an already-assigned lead is STRICTLY restricted to Managers & Admins. Salesmen cannot reassign leads.
  // Initial assignment of an unassigned lead can be performed by Managers, Admins, or Presales Specialists.
  const canAssignOrReassign = isAlreadyAssigned
    ? isManagerOrAdmin
    : (isManagerOrAdmin || isPresales);

  // Score Override Modal state
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideScore, setOverrideScore] = useState<number>(75);
  const [overrideClassification, setOverrideClassification] = useState<string>('QUALIFIED');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // Business Problem Modal state
  const [showAddProblemModal, setShowAddProblemModal] = useState(false);
  const [newProbName, setNewProbName] = useState('');
  const [newProbCategory, setNewProbCategory] = useState('DISTRIBUTION');
  const [newProbSeverity, setNewProbSeverity] = useState('HIGH');
  const [newProbFrequency, setNewProbFrequency] = useState('DAILY');
  const [newProbImpact, setNewProbImpact] = useState('');
  const [newProbUsers, setNewProbUsers] = useState('');
  const [newProbEvidence, setNewProbEvidence] = useState('');
  const [newProbNotes, setNewProbNotes] = useState('');
  const [savingProblem, setSavingProblem] = useState(false);

  // Edit Location / Place Modal state
  const [showEditPlaceModal, setShowEditPlaceModal] = useState(false);
  const [savingPlace, setSavingPlace] = useState(false);

  // Edit Lead Source Modal state
  const [showEditSourceModal, setShowEditSourceModal] = useState(false);
  const [sourcesList, setSourcesList] = useState<LeadSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [newSourceName, setNewSourceName] = useState('');
  const [savingSource, setSavingSource] = useState(false);

  // Full Commercial Intake / ICP Modal state
  const [showICPModal, setShowICPModal] = useState(false);
  const [savingICPData, setSavingICPData] = useState(false);

  // Account details state
  const [editCompanyName, setEditCompanyName] = useState(lead.account_name || '');
  const [editDomain, setEditDomain] = useState(lead.domain || '');
  const [editIndustry, setEditIndustry] = useState(lead.industry || 'FMCG');
  const [editEmployees, setEditEmployees] = useState<number>(lead.employees_count || 100);
  const [editCity, setEditCity] = useState(lead.account_city || '');
  const [editCountry, setEditCountry] = useState(lead.account_country || 'Saudi Arabia');
  const [editTerritory, setEditTerritory] = useState(lead.territory || '');
  const [editIsTarget, setEditIsTarget] = useState<boolean>(Boolean(lead.is_target_account));
  const [editTargetTier, setEditTargetTier] = useState(lead.target_tier || 'TIER_1');

  // Contact details state
  const [editContactName, setEditContactName] = useState(lead.contact_name || '');
  const [editContactTitle, setEditContactTitle] = useState(lead.contact_designation || '');
  const [editContactEmail, setEditContactEmail] = useState(lead.contact_email || '');
  const [editContactPhone, setEditContactPhone] = useState(lead.contact_phone || '');
  const [editContactRole, setEditContactRole] = useState('DECISION_MAKER');

  // Source & Next Action state
  const [editSourceId, setEditSourceId] = useState(lead.source || '');
  const [editNextAction, setEditNextAction] = useState(lead.next_action_description || 'Schedule introductory discovery call');

  // Product & Territory lists & selection
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [territoriesList, setTerritoriesList] = useState<Territory[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(lead.primary_product || '');
  const [selectedProductCode, setSelectedProductCode] = useState(lead.primary_product_code || 'VANFORCES');
  const [productIcpRules, setProductIcpRules] = useState<ICPRule[]>([]);
  const [loadingIcpRules, setLoadingIcpRules] = useState(false);
  const [dynamicIcpValues, setDynamicIcpValues] = useState<Record<string, any>>({});

  // Operational ICP values
  const [icpFieldSales, setIcpFieldSales] = useState<boolean>(true);
  const [icpVansCount, setIcpVansCount] = useState<number>(25);
  const [icpSalesmenCount, setIcpSalesmenCount] = useState<number>(25);
  const [icpPrimaryErp, setIcpPrimaryErp] = useState<string>('Odoo');
  const [icpDistributionCenters, setIcpDistributionCenters] = useState<number>(2);
  const [icpDailyOrders, setIcpDailyOrders] = useState<number>(150);
  const [icpMonthlyInvoices, setIcpMonthlyInvoices] = useState<number>(10000);

  // Lead Ownership / Assigned Staff for modal
  const [editAssignedOwnerId, setEditAssignedOwnerId] = useState(lead.owner || '');

  // Duplicate match check
  const [duplicateMatches, setDuplicateMatches] = useState<any[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  // Synchronize modal state with lead details (ensures data from website lead API / DB is fresh)
  const syncModalStateWithLead = (targetAssessment?: AccountProductAssessment | null, accountData?: any, contactData?: any) => {
    const company = accountData?.company_name || lead.account_name || '';
    const dom = accountData?.domain || lead.domain || '';
    const ind = accountData?.industry || lead.industry || 'FMCG';
    const emp = Number(accountData?.employees_count || lead.employees_count || 100);
    const cit = accountData?.city || lead.account_city || '';
    const ctry = accountData?.country || lead.account_country || 'Saudi Arabia';
    const terr = accountData?.territory || lead.territory || '';
    const isTgt = accountData?.is_target_account !== undefined ? Boolean(accountData.is_target_account) : Boolean(lead.is_target_account);
    const tgtTier = accountData?.target_tier || lead.target_tier || 'TIER_1';

    setEditCompanyName(company);
    setEditDomain(dom);
    setEditIndustry(ind);
    setEditEmployees(emp);
    setEditCity(cit);
    setEditCountry(ctry);
    setEditTerritory(terr);
    setEditIsTarget(isTgt);
    setEditTargetTier(tgtTier);

    const cName = (contactData ? `${contactData.first_name || ''} ${contactData.last_name || ''}`.trim() : '') || lead.contact_name || '';
    const cTitle = contactData?.designation || lead.contact_designation || '';
    const cEmail = contactData?.email || lead.contact_email || '';
    const cPhone = contactData?.phone || lead.contact_phone || '';
    const cRole = contactData?.role_type || 'DECISION_MAKER';

    setEditContactName(cName);
    setEditContactTitle(cTitle);
    setEditContactEmail(cEmail);
    setEditContactPhone(cPhone);
    setEditContactRole(cRole);

    // Resolve source from ID, code, or name
    const srcMatch = sourcesList.find(s => s.id === lead.source || s.code === lead.source || s.name === lead.source_name || s.name === lead.source);
    setEditSourceId(srcMatch ? srcMatch.id : (lead.source || ''));
    setEditNextAction(lead.next_action_description || 'Schedule introductory discovery call');

    setSelectedProductId(lead.primary_product || '');
    setSelectedProductCode(lead.primary_product_code || 'VANFORCES');

    const ownerId = lead.owner || currentLeadOwner?.id || '';
    setEditAssignedOwnerId(ownerId);

    // Collect attributes from AccountAttribute EAV and Assessment ICP Evidence
    const accAttrs: Record<string, any> = {};
    if (Array.isArray(accountData?.custom_attributes)) {
      accountData.custom_attributes.forEach((attr: any) => {
        if (attr?.attribute_key) {
          accAttrs[attr.attribute_key] = attr.attribute_value;
        }
      });
    }

    const activeAssessment = targetAssessment !== undefined ? targetAssessment : assessment;
    const ev = { ...accAttrs, ...((activeAssessment?.icp_evidence || {}) as Record<string, any>) };

    const hasFieldSales = ev.field_sales !== undefined ? Boolean(ev.field_sales) : true;
    const hasVans = ev.vans_count !== undefined ? Number(ev.vans_count) : 25;
    const hasSalesmen = ev.salesmen_count !== undefined ? Number(ev.salesmen_count) : 25;
    const hasErp = ev.primary_erp ? String(ev.primary_erp) : 'Odoo';
    const hasDepots = ev.distribution_centers_count !== undefined ? Number(ev.distribution_centers_count) : (ev.distribution_depots !== undefined ? Number(ev.distribution_depots) : (accountData?.distribution_centers_count ? Number(accountData.distribution_centers_count) : 2));
    const hasDaily = ev.daily_orders !== undefined ? Number(ev.daily_orders) : 150;
    const hasInvoices = ev.monthly_invoices !== undefined ? Number(ev.monthly_invoices) : 10000;

    setIcpFieldSales(hasFieldSales);
    setIcpVansCount(hasVans);
    setIcpSalesmenCount(hasSalesmen);
    setIcpPrimaryErp(hasErp);
    setIcpDistributionCenters(hasDepots);
    setIcpDailyOrders(hasDaily);
    setIcpMonthlyInvoices(hasInvoices);

    const dynamicValues: Record<string, any> = {
      ...ev,
      field_sales: hasFieldSales,
      vans_count: hasVans,
      salesmen_count: hasSalesmen,
      primary_erp: hasErp,
      distribution_centers_count: hasDepots,
      distribution_depots: hasDepots,
      daily_orders: hasDaily,
      monthly_invoices: hasInvoices,
      industry: ind,
      employees_count: emp,
      employees: emp,
      city: cit,
      country: ctry,
    };
    setDynamicIcpValues(dynamicValues);
  };

  const fetchProductIcpRules = async (prodId: string) => {
    if (!prodId) {
      setProductIcpRules([]);
      return;
    }
    setLoadingIcpRules(true);
    try {
      const rulesData = await api.getICPRules(prodId).catch(() => []);
      const validRules = rulesData || [];
      setProductIcpRules(validRules);

      setDynamicIcpValues(prev => {
        const next = { ...prev };
        validRules.forEach(r => {
          if (next[r.field_name] === undefined) {
            if (r.field_name === 'field_sales') next[r.field_name] = icpFieldSales;
            else if (r.field_name === 'vans_count') next[r.field_name] = icpVansCount;
            else if (r.field_name === 'salesmen_count') next[r.field_name] = icpSalesmenCount;
            else if (r.field_name === 'primary_erp') next[r.field_name] = icpPrimaryErp;
            else if (r.field_name === 'employees_count' || r.field_name === 'employees') next[r.field_name] = editEmployees;
            else if (r.field_name === 'industry') next[r.field_name] = editIndustry;
            else if (r.field_name === 'distribution_centers_count' || r.field_name === 'distribution_depots') next[r.field_name] = icpDistributionCenters;
            else if (r.field_name === 'monthly_invoices') next[r.field_name] = icpMonthlyInvoices;
            else if (r.field_name === 'daily_orders') next[r.field_name] = icpDailyOrders;
            else if (typeof r.target_value === 'boolean' || r.target_value === 'true') next[r.field_name] = true;
            else if (typeof r.target_value === 'number') next[r.field_name] = r.target_value;
            else if (Array.isArray(r.target_value) && r.target_value.length > 0) next[r.field_name] = r.target_value[0];
            else next[r.field_name] = r.target_value ?? '';
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

  const getRuleEvaluation = (rule: ICPRule) => {
    let val = dynamicIcpValues[rule.field_name];
    if (rule.field_name === 'industry') val = editIndustry;
    else if (rule.field_name === 'employees_count' || rule.field_name === 'employees') val = editEmployees;
    else if (rule.field_name === 'distribution_centers_count' || rule.field_name === 'distribution_depots') val = icpDistributionCenters;
    else if (rule.field_name === 'country') val = editCountry;
    else if (rule.field_name === 'city') val = editCity;
    else if (rule.field_name === 'field_sales') val = icpFieldSales;
    else if (rule.field_name === 'vans_count') val = icpVansCount;
    else if (rule.field_name === 'salesmen_count') val = icpSalesmenCount;
    else if (rule.field_name === 'primary_erp') val = icpPrimaryErp;

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
      const otherMatches = (res.duplicates || []).filter((d: any) => d.id !== lead.account);
      setDuplicateMatches(otherMatches);
    } catch {
      // ignore
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handleOpenICPModal = async () => {
    syncModalStateWithLead(assessment);
    if (lead.primary_product) {
      fetchProductIcpRules(selectedProductId || lead.primary_product);
    }
    if (lead.account) {
      api.getAccount(lead.account).then(acc => {
        if (acc) syncModalStateWithLead(assessment, acc);
      }).catch(() => {});
    }
    if (lead.contact) {
      api.getContact(lead.contact).then(cont => {
        if (cont) syncModalStateWithLead(assessment, undefined, cont);
      }).catch(() => {});
    }
    setShowICPModal(true);
  };

  // Custom Answer Option state
  const [addingOptionForQuestion, setAddingOptionForQuestion] = useState<string | null>(null);
  const [newOptionLabel, setNewOptionLabel] = useState<string>('');
  const [newOptionPoints, setNewOptionPoints] = useState<number>(50);
  const [savingNewOption, setSavingNewOption] = useState<boolean>(false);

  // Transition state
  const [transitioning, setTransitioning] = useState(false);

  // Nurture & Win-Back Pool state
  const [showNurtureModal, setShowNurtureModal] = useState(false);
  const [nurturePresetReason, setNurturePresetReason] = useState('FAILED_ICP');
  const [nurtureCustomReason, setNurtureCustomReason] = useState('');
  const [nurtureStatusChoice, setNurtureStatusChoice] = useState<'NURTURE' | 'DISQUALIFIED'>('NURTURE');
  const [nurturingLead, setNurturingLead] = useState(false);

  // Active view toggle
  const [activeSection, setActiveSection] = useState<'icp' | 'questionnaire' | 'problems' | 'score' | 'history' | 'timeline'>('questionnaire');

  // Date & Time Action Logs state
  const [actionLogs, setActionLogs] = useState<LeadActionLog[]>([]);
  const [loadingActionLogs, setLoadingActionLogs] = useState<boolean>(false);
  const [actionCategoryFilter, setActionCategoryFilter] = useState<string>('ALL');
  const [actionSearchTerm, setActionSearchTerm] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Quick Log Action with Date & Time Modal state
  const getLocalDatetimeString = (date?: Date) => {
    const d = date || new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [showLogActionModal, setShowLogActionModal] = useState<boolean>(false);
  const [newActionType, setNewActionType] = useState<string>('CALL');
  const [newActionSubject, setNewActionSubject] = useState<string>('');
  const [newActionDateTime, setNewActionDateTime] = useState<string>(getLocalDatetimeString());
  const [newActionDuration, setNewActionDuration] = useState<number>(30);
  const [newActionOutcome, setNewActionOutcome] = useState<string>('');
  const [newActionNotes, setNewActionNotes] = useState<string>('');
  const [newActionNextDesc, setNewActionNextDesc] = useState<string>('');
  const [newActionNextDue, setNewActionNextDue] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  useEffect(() => {
    loadWorkspaceData();
    loadActionLogs(lead.id);
  }, [lead.id, lead.primary_product]);

  const loadActionLogs = async (id: string) => {
    setLoadingActionLogs(true);
    try {
      const res = await api.getLeadActionLogs(id);
      setActionLogs(res.logs || []);
    } catch (err) {
      console.warn('Failed to load lead action logs:', err);
    } finally {
      setLoadingActionLogs(false);
    }
  };

  const handleDirectLogAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionSubject.trim()) {
      showNotification('error', 'Action title/subject is required.');
      return;
    }

    setSubmittingAction(true);
    try {
      await api.logLeadAction(lead.id, {
        action_type: newActionType,
        subject: newActionSubject.trim(),
        conducted_at: newActionDateTime ? new Date(newActionDateTime).toISOString() : new Date().toISOString(),
        duration_minutes: newActionDuration,
        description_notes: newActionNotes,
        outcome_notes: newActionOutcome,
        next_action_description: newActionNextDesc,
        next_activity_due_at: newActionNextDue ? new Date(newActionNextDue).toISOString() : undefined,
        status: 'COMPLETED'
      });

      showNotification('success', 'Action with date & time recorded successfully on lead.');
      setShowLogActionModal(false);
      setNewActionSubject('');
      setNewActionOutcome('');
      setNewActionNotes('');
      setNewActionNextDesc('');
      setNewActionNextDue('');
      setNewActionDateTime(getLocalDatetimeString());
      await loadActionLogs(lead.id);
      if (onLeadUpdated) onLeadUpdated();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to record action log.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const showNotification = (type: 'success' | 'error' | 'warning', text: string) => {
    setFeedbackMsg({ type, text });
    inAppAlert.show(type, text);
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const loadWorkspaceData = async () => {
    setLoading(true);
    try {
      // 1. Load Questionnaire for Lead's primary product
      let qTemplate: QuestionnaireTemplate | null = null;
      try {
        qTemplate = await api.getQuestionnaireForProduct(lead.primary_product);
        setQuestionnaire(qTemplate);
      } catch (err) {
        console.warn('No active questionnaire template found for product:', lead.primary_product, err);
      }

      // 2. Load Assessment for this Account + Product
      let currentAssessment: AccountProductAssessment | null = null;
      try {
        const assessments = await api.getAssessments({
          account: lead.account,
          product: lead.primary_product,
          lead: lead.id,
        });
        if (assessments && assessments.length > 0) {
          currentAssessment = assessments[0];
        } else {
          // If no assessment exists yet, evaluate ICP automatically
          const icpRes = await api.evaluateICP(lead.account, lead.primary_product, lead.id);
          if (icpRes && icpRes.assessment_id) {
            currentAssessment = await api.getAssessmentById(icpRes.assessment_id);
          }
        }
      } catch (err) {
        console.warn('Error fetching or initializing assessment:', err);
      }
      setAssessment(currentAssessment);

      // Pre-fill questionnaire answers if stored in assessment
      if (currentAssessment?.questionnaire_answers) {
        setAnswers(currentAssessment.questionnaire_answers);
      }

      // Pre-fill ICP operational attributes if present in assessment evidence
      if (currentAssessment?.icp_evidence) {
        const ev = currentAssessment.icp_evidence as Record<string, any>;
        if (ev.field_sales !== undefined) setIcpFieldSales(Boolean(ev.field_sales));
        if (ev.vans_count !== undefined) setIcpVansCount(Number(ev.vans_count));
        if (ev.salesmen_count !== undefined) setIcpSalesmenCount(Number(ev.salesmen_count));
        if (ev.primary_erp) setIcpPrimaryErp(String(ev.primary_erp));
      }

      // 3. Load Documented Business Problems for this Lead
      try {
        const probs = await api.getLeadProblems(lead.id);
        setProblems(probs);
      } catch (err) {
        console.warn('Error fetching lead problems:', err);
      }

      // Load Lead Sources
      try {
        const srcRes = await api.getLeadSources();
        setSourcesList(Array.isArray(srcRes) ? srcRes : (srcRes?.results || []));
      } catch (err) {
        console.warn('Error loading lead sources:', err);
      }

      // Load Territories
      try {
        const terrRes = await api.getTerritories();
        const terrList = Array.isArray(terrRes) ? terrRes : (terrRes?.results || []);
        setTerritoriesList(terrList);
      } catch (err) {
        console.warn('Error loading territories:', err);
      }

      // Load Products
      try {
        const prodRes = await api.getProducts();
        const pList = prodRes?.results || [];
        setProductsList(pList);
      } catch (err) {
        console.warn('Error loading products:', err);
      }

      // Load dynamic ICP rules for the product
      if (lead.primary_product) {
        await fetchProductIcpRules(lead.primary_product);
      }

      // Load full account and contact data directly from database to ensure fresh data
      let fullAccountData: any = null;
      let fullContactData: any = null;
      if (lead.account) {
        try {
          fullAccountData = await api.getAccount(lead.account);
        } catch (accErr) {
          console.warn('Failed to fetch full account details:', accErr);
        }
      }
      if (lead.contact) {
        try {
          fullContactData = await api.getContact(lead.contact);
        } catch (contErr) {
          console.warn('Failed to fetch full contact details:', contErr);
        }
      }

      // Pre-sync all modal inputs with lead information (including data from website lead API)
      syncModalStateWithLead(currentAssessment, fullAccountData, fullContactData);

      // Load Staff Users for sales assignment
      try {
        const uRes = await api.getUsers();
        const uList = uRes.results || [];
        setStaffUsers(uList);
        if (!lead.owner && uList.length > 0) {
          const firstSales = uList.find((u: any) => 
            u.role === 'SALES_BDM' || u.role === 'ACCOUNT_EXECUTIVE' || u.role === 'SALES_REP' || u.role === 'SALES_MANAGER'
          ) || uList[0];
          if (firstSales) setSelectedSalesUserId(firstSales.id);
        }
      } catch (err) {
        console.warn('Failed to load users for sales assignment:', err);
      }

      // 4. Validate Stage Gate readiness
      try {
        const configs = await api.getConfigurations();
        const currentConfig = configs.results?.find((c: any) => c.product === lead.primary_product) || configs.results?.[0];
        if (currentConfig?.stages) {
          const nextStage = currentConfig.stages.find((s: any) => s.sequence_order === 4) || currentConfig.stages[1];
          if (nextStage) {
            const check = await api.validateGate(lead.id, nextStage.id);
            setGateChecklist(check);
          }
        }
      } catch (err) {
        console.warn('Gate validation check error:', err);
      }

    } catch (e: any) {
      console.error('Failed to load PLD Workspace data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentLeadOwner({
      id: lead.owner,
      name: lead.owner_name,
      email: lead.owner_email
    });
    if (lead.owner) {
      setSelectedSalesUserId(lead.owner);
    }
    syncModalStateWithLead();
  }, [lead.id, lead.owner, lead.owner_name, lead.account_name, lead.domain, lead.contact_name]);

  useEffect(() => {
    if (showICPModal) {
      syncModalStateWithLead();
      if (lead.primary_product) {
        fetchProductIcpRules(selectedProductId || lead.primary_product);
      }
    }
  }, [showICPModal]);

  const handleAssignToSalesman = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedSalesUserId) {
      showNotification('error', 'Please select a sales representative to assign.');
      return;
    }

    if (isAlreadyAssigned && !isManagerOrAdmin) {
      showNotification('error', 'Permission denied: Sales representatives are not permitted to reassign leads. Only Sales Managers and Administrators can reassign lead ownership.');
      setShowAssignSalesModal(false);
      return;
    }

    if (!isAlreadyAssigned && !(isManagerOrAdmin || isPresales)) {
      showNotification('error', 'Permission denied: Only Sales Managers, Administrators, and Presales Specialists can assign leads to sales representatives.');
      setShowAssignSalesModal(false);
      return;
    }

    setSavingAssignment(true);
    try {
      const res = await api.assignLeadSalesOwner(lead.id, {
        sales_user_id: selectedSalesUserId,
        notes: assignHandoffNotes.trim(),
        schedule_task: scheduleFollowupTask
      });

      const assignedUser = res.assigned_user;
      setCurrentLeadOwner({
        id: assignedUser?.id || selectedSalesUserId,
        name: assignedUser?.name || 'Sales Representative',
        email: assignedUser?.email
      });

      showNotification('success', res.message || `Lead successfully assigned to ${assignedUser?.name || 'sales representative'}!`);
      setShowAssignSalesModal(false);
      setAssignHandoffNotes('');
      if (onLeadUpdated) onLeadUpdated();
      loadWorkspaceData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to assign lead to sales representative.');
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleReEvaluateICP = async () => {
    setEvaluatingICP(true);
    try {
      const res = await api.evaluateICP(lead.account, lead.primary_product, lead.id);
      showNotification('success', `ICP Evaluated: ${res.result} (Fit Score: ${res.fit_score}/100)`);
      if (res.assessment_id) {
        const updated = await api.getAssessmentById(res.assessment_id);
        setAssessment(updated);
      }
      if (onLeadUpdated) onLeadUpdated();
      if (res.result === 'FAIL') {
        showNotification('warning', `ICP knockout failed! Lead automatically routed to Nurture & Win-Back Pool (ICP Failed tab).`);
        if (onNavigateToNurture) onNavigateToNurture('ICP_FAILED');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'ICP evaluation failed.');
    } finally {
      setEvaluatingICP(false);
    }
  };

  const handleAnswerChange = (questionCode: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionCode]: value
    }));
  };

  const handleCreateCustomOption = async (q: any) => {
    if (!newOptionLabel.trim()) return;
    setSavingNewOption(true);
    try {
      const created = await api.addQuestionOption(q.id, newOptionLabel.trim(), newOptionPoints, newOptionLabel.trim());
      // Add to questionnaire in local state
      setQuestionnaire(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          questions: prev.questions.map(item => {
            if (item.id === q.id || item.code === q.code) {
              return {
                ...item,
                options: [...(item.options || []), created]
              };
            }
            return item;
          })
        };
      });
      // Auto-select this answer
      const selectedValue = created.value || created.label || newOptionLabel.trim();
      handleAnswerChange(q.code, selectedValue);
      showNotification('success', `Option "${newOptionLabel}" added and selected.`);
      setAddingOptionForQuestion(null);
      setNewOptionLabel('');
      setNewOptionPoints(50);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to add custom answer option.');
    } finally {
      setSavingNewOption(false);
    }
  };

  const handleCalculateScore = async () => {
    if (!assessment) {
      showNotification('error', 'No assessment record found. Run ICP evaluation first.');
      return;
    }

    setSavingScore(true);
    try {
      const res = await api.evaluatePLDScore(assessment.id, answers);
      showNotification('success', `PLD Score Updated: ${res.total_score}/100 [${res.classification}]`);
      const updated = await api.getAssessmentById(assessment.id);
      setAssessment(updated);
      if (onLeadUpdated) onLeadUpdated();
      // Reload gate checklist
      loadWorkspaceData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to calculate PLD score.');
    } finally {
      setSavingScore(false);
    }
  };

  const handleSaveProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProbName.trim()) {
      showNotification('error', 'Problem description or title is mandatory.');
      return;
    }

    setSavingProblem(true);
    try {
      await api.addLeadProblem(lead.id, {
        problem_name: newProbName.trim(),
        category: newProbCategory,
        severity: newProbSeverity,
        frequency: newProbFrequency,
        business_impact: newProbImpact,
        affected_users: newProbUsers,
        evidence: newProbEvidence,
        notes: newProbNotes,
      });

      showNotification('success', 'Documented business problem recorded successfully.');
      setShowAddProblemModal(false);
      // Reset form
      setNewProbName('');
      setNewProbImpact('');
      setNewProbUsers('');
      setNewProbEvidence('');
      setNewProbNotes('');

      // Refresh problems list
      const updatedProbs = await api.getLeadProblems(lead.id);
      setProblems(updatedProbs);

      // Re-evaluate score to lift cap if necessary
      if (assessment) {
        await api.evaluatePLDScore(assessment.id, answers);
        const updated = await api.getAssessmentById(assessment.id);
        setAssessment(updated);
      }
      if (onLeadUpdated) onLeadUpdated();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to save business problem.');
    } finally {
      setSavingProblem(false);
    }
  };

  const handleScoreOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      setOverrideError('A documented business justification reason is mandatory for score override.');
      return;
    }

    if (!assessment) return;

    setOverrideSubmitting(true);
    setOverrideError(null);
    try {
      const res = await api.overrideAssessment(
        assessment.id,
        overrideReason.trim(),
        overrideClassification,
        overrideScore
      );
      showNotification('success', res.message || 'PLD score manually overridden.');
      setShowOverrideModal(false);
      setOverrideReason('');
      const updated = await api.getAssessmentById(assessment.id);
      setAssessment(updated);
      if (onLeadUpdated) onLeadUpdated();
    } catch (err: any) {
      setOverrideError(err.message || 'Override failed.');
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const handleSaveICPData = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingICPData(true);
    try {
      const targetProdId = selectedProductId || lead.primary_product;

      // 1. Update Customer Account Details
      if (lead.account) {
        try {
          await api.updateAccount(lead.account, {
            company_name: editCompanyName.trim() || lead.account_name,
            domain: editDomain.trim() || undefined,
            industry: editIndustry,
            employees_count: Number(editEmployees),
            distribution_centers_count: Number(icpDistributionCenters || 1),
            city: editCity.trim() || undefined,
            country: editCountry.trim() || undefined,
            territory: editTerritory || undefined,
            is_target_account: editIsTarget,
            target_tier: editIsTarget ? editTargetTier : undefined
          });
        } catch (accErr) {
          console.warn('Failed to update account:', accErr);
        }
      }

      // 2. Update or Create Customer Contact Person
      let resolvedContactId = lead.contact;
      if (editContactName.trim()) {
        const parts = editContactName.trim().split(' ');
        const firstName = parts[0];
        const lastName = parts.slice(1).join(' ') || undefined;

        if (lead.contact) {
          try {
            await api.updateContact(lead.contact, {
              first_name: firstName,
              last_name: lastName,
              designation: editContactTitle.trim() || undefined,
              email: editContactEmail.trim() || undefined,
              phone: editContactPhone.trim() || undefined,
              role_type: editContactRole
            });
          } catch (cErr) {
            console.warn('Failed to update contact:', cErr);
          }
        } else if (lead.account) {
          try {
            const newCont = await api.createContact({
              account: lead.account,
              first_name: firstName,
              last_name: lastName,
              designation: editContactTitle.trim() || undefined,
              email: editContactEmail.trim() || undefined,
              phone: editContactPhone.trim() || undefined,
              role_type: editContactRole,
              is_primary: true
            });
            resolvedContactId = newCont.id;
          } catch (cErr) {
            console.warn('Failed to create contact:', cErr);
          }
        }
      }

      // 3. Prepare ICP operational attributes payload
      const icpAttributesPayload: Record<string, any> = {
        field_sales: Boolean(icpFieldSales),
        vans_count: Number(icpVansCount),
        salesmen_count: Number(icpSalesmenCount),
        primary_erp: dynamicIcpValues['primary_erp'] ?? icpPrimaryErp,
        distribution_centers_count: Number(icpDistributionCenters),
        distribution_depots: Number(icpDistributionCenters),
        monthly_invoices: Number(icpMonthlyInvoices),
        daily_orders: Number(icpDailyOrders),
        industry: editIndustry,
        employees_count: Number(editEmployees),
        country: editCountry,
        city: editCity,
        ...dynamicIcpValues
      };

      // Type-cast according to dynamic rules
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

      // 4. Save operational account attributes for target product
      await api.upsertAccountAttributes(lead.account, targetProdId, icpAttributesPayload);

      // 5. Update Lead properties (territory, source, next action, contact, owner if manager/admin, product if changed)
      const leadUpdatePayload: any = {
        territory: editTerritory || undefined,
        source: editSourceId || undefined,
        next_action_description: editNextAction || lead.next_action_description,
        contact: resolvedContactId || undefined,
        icp_attributes: icpAttributesPayload
      };
      if (targetProdId && targetProdId !== lead.primary_product) {
        leadUpdatePayload.primary_product = targetProdId;
      }
      if (isManagerOrAdmin && editAssignedOwnerId !== undefined) {
        leadUpdatePayload.owner = editAssignedOwnerId || null;
      }

      await api.updateLead(lead.id, leadUpdatePayload);

      // 6. Evaluate ICP
      const res = await api.evaluateICP(lead.account, targetProdId, lead.id);
      showNotification('success', `ICP Evaluated: ${res.result} (Fit Score: ${res.fit_score}/100)`);
      if (res.assessment_id) {
        const updated = await api.getAssessmentById(res.assessment_id);
        setAssessment(updated);
      }

      setShowICPModal(false);
      if (onLeadUpdated) onLeadUpdated();

      if (res.result === 'FAIL') {
        showNotification('warning', `ICP knockout failed! Lead automatically routed to Nurture & Win-Back Pool (ICP Failed tab).`);
        if (onNavigateToNurture) onNavigateToNurture('ICP_FAILED');
      } else {
        await loadWorkspaceData();
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to save ICP data.');
    } finally {
      setSavingICPData(false);
    }
  };

  const handleAdvanceToDiscovery = async () => {
    // Check gate requirements
    const isIcpPassed = assessment?.icp_result === 'PASS' || Boolean(assessment?.is_overridden);
    const hasProblem = problems.length > 0;
    const hasNextAction = Boolean(lead.next_action_description);

    if (!isIcpPassed) {
      showNotification('error', 'GATE BLOCKED: Cannot advance to Discovery. ICP requirement not satisfied (Current status: ' + (assessment?.icp_result || 'PENDING') + '). Please complete the qualification questionnaire and calculate PLD score, or use Score Override.');
      return;
    }

    if (!hasProblem) {
      showNotification('error', 'GATE BLOCKED: Cannot advance to Discovery. At least 1 documented business problem is required.');
      setShowAddProblemModal(true);
      return;
    }

    if (!hasNextAction) {
      showNotification('error', 'GATE BLOCKED: A concrete next action and scheduled due date are required before progressing.');
      return;
    }

    setTransitioning(true);
    try {
      // 1. Locate the target Discovery pipeline stage
      let discoveryStage: any = null;
      try {
        const stagesRes = await api.getPipelineStages();
        const allStages = stagesRes.results || [];
        discoveryStage = allStages.find((s: any) => 
          (s.stage_code === 'DISCOVERY' || s.code === 'DISCOVERY' || s.stage_name?.toLowerCase().includes('discovery')) &&
          (s.pipeline_type === 'PURSUIT' || s.pipeline_type === 'LEAD')
        ) || allStages.find((s: any) => s.stage_code === 'DISCOVERY' || s.code === 'DISCOVERY');
      } catch (err) {
        console.warn('Direct stages lookup failed, falling back to configurations', err);
      }

      if (!discoveryStage) {
        const configs = await api.getConfigurations();
        const currentConfig = configs.results?.find((c: any) => c.product === lead.primary_product) || configs.results?.[0];
        discoveryStage = currentConfig?.stages?.find((s: any) => 
          s.stage_code === 'DISCOVERY' || s.code === 'DISCOVERY' ||
          s.stage_name?.toLowerCase().includes('discovery') || s.name?.toLowerCase().includes('discovery') ||
          s.sequence_order === 5
        );
      }

      if (!discoveryStage) {
        const stagesRes = await api.getPipelineStages();
        discoveryStage = stagesRes.results?.find((s: any) => s.stage_code === 'PLD_QUALIFIED');
      }

      if (!discoveryStage) {
        throw new Error('Target Discovery pipeline stage not found in product configuration.');
      }

      const targetSalesOwnerId = selectedSalesUserId || currentLeadOwner?.id || lead.owner;
      const res = await api.transitionLeadStage(
        lead.id,
        discoveryStage.id,
        `Passed ICP and PLD Qualification Engine gates (Score: ${assessment?.pld_score || 0}).`,
        true,
        undefined,
        targetSalesOwnerId
      );

      let successMsg = res.message || 'Lead successfully advanced to Discovery!';
      if (res.stage_email?.email_sent) {
        successMsg += ` • Customer email delivered to ${res.stage_email.recipient_email}`;
      } else if (res.stage_email?.status === 'DELIVERED') {
        successMsg += ` • Customer stage notification logged`;
      }
      showNotification('success', successMsg);
      if (onTransitionSuccess) onTransitionSuccess();
      if (onLeadUpdated) onLeadUpdated();
    } catch (err: any) {
      showNotification('error', err.message || 'Stage transition failed.');
    } finally {
      setTransitioning(false);
    }
  };

  const handleMoveToNurture = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = nurtureCustomReason.trim() || (
      nurturePresetReason === 'FAILED_ICP' ? 'Failed ICP qualification criteria (van count / field operations knockout).' :
      nurturePresetReason === 'NO_BUDGET' ? 'No immediate commercial budget allocated; postponed to next fiscal cycle.' :
      nurturePresetReason === 'INFRASTRUCTURE' ? 'Prerequisite enterprise ERP / telematics infrastructure not ready.' :
      nurturePresetReason === 'COMPETITOR' ? 'Contract locked with competitor; queued for win-back timing.' :
      nurturePresetReason === 'GATE_FAILED' ? 'Failed required Stage Gates / Critical business problems not identified.' :
      'Lead disqualified during PLD qualification stage.'
    );

    setNurturingLead(true);
    try {
      const isIcpFailure = nurturePresetReason === 'FAILED_ICP' || nurtureStatusChoice === 'DISQUALIFIED';
      const res = await api.moveToNurturePool(lead.id, {
        reason: finalReason,
        status: nurtureStatusChoice,
        is_icp_failure: isIcpFailure
      });
      inAppAlert.success(res.message || `Lead ${lead.account_name} routed to Nurture & Win-Back Pool!`);
      setShowNurtureModal(false);
      setNurtureCustomReason('');
      if (onLeadUpdated) onLeadUpdated();
      if (onNavigateToNurture) onNavigateToNurture(isIcpFailure ? 'ICP_FAILED' : 'NURTURE_LEADS');
    } catch (err: any) {
      inAppAlert.error(err.message || 'Failed to move lead to Nurture Pool.');
    } finally {
      setNurturingLead(false);
    }
  };

  const handleRedirectFromMissing = (item: string) => {
    const text = (item || '').toLowerCase();
    if (text.includes('icp') || text.includes('field sales') || text.includes('van') || text.includes('erp') || text.includes('attribute') || text.includes('knockout') || text.includes('revenue') || text.includes('employee')) {
      handleOpenICPModal();
    } else if (text.includes('problem') || text.includes('pain')) {
      setActiveSection('problems');
      setShowAddProblemModal(true);
    } else if (text.includes('next action') || text.includes('activity') || text.includes('schedule') || text.includes('due')) {
      setActiveSection('timeline');
    } else if (text.includes('question') || text.includes('score')) {
      setActiveSection('questionnaire');
    } else {
      handleOpenICPModal();
    }
  };

  // Helper for ICP status badge styling
  const renderICPBadge = (result?: string, fitScore?: number, isOverridden?: boolean) => {
    // If fit score is below 50% and not overridden, prevent showing green PASS
    if ((result === 'PASS' || !result) && fitScore !== undefined && fitScore < 50 && !isOverridden) {
      return (
        <span className="badge badge-danger" title={`ICP Fit Score (${fitScore}/100) is below the 50% qualification threshold.`}>
          <XCircle size={13} /> ICP: FAILED (Low Fit: {fitScore}%)
        </span>
      );
    }
    switch (result) {
      case 'PASS':
        return <span className="badge badge-success"><CheckCircle2 size={13} /> ICP: PASSED</span>;
      case 'FAIL':
        return (
          <span className="badge badge-danger">
            <XCircle size={13} /> ICP: FAILED{fitScore !== undefined ? ` (${fitScore}%)` : ''}
          </span>
        );
      case 'REVIEW_REQUIRED':
        return <span className="badge badge-warning"><AlertTriangle size={13} /> ICP: REVIEW REQUIRED</span>;
      default:
        return <span className="badge badge-neutral"><Clock size={13} /> ICP: PENDING EVALUATION</span>;
    }
  };

  // Helper for PLD score outcome badge styling
  const renderScoreClassificationBadge = (classification?: string) => {
    switch (classification) {
      case 'HIGH_PRIORITY':
        return <span className="badge badge-success" style={{ background: 'rgba(16, 185, 129, 0.25)', borderColor: 'var(--success)' }}>HIGH PRIORITY</span>;
      case 'QUALIFIED':
        return <span className="badge badge-info" style={{ background: 'rgba(56, 189, 248, 0.25)', borderColor: 'var(--info)' }}>QUALIFIED PLD</span>;
      case 'DEVELOPMENT':
        return <span className="badge badge-warning" style={{ background: 'rgba(245, 158, 11, 0.25)', borderColor: 'var(--warning)' }}>PLD DEVELOPMENT</span>;
      case 'NURTURE':
      default:
        return <span className="badge badge-neutral">NURTURE</span>;
    }
  };

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <RefreshCw className="animate-spin" size={28} style={{ margin: '0 auto 12px auto', color: 'var(--primary)' }} />
        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Loading PLD Qualification Workspace...</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Fetching dynamic ICP rules, questionnaires, and business problems
        </div>
      </div>
    );
  }

  const isScoreCapped = Boolean(
    assessment?.pld_breakdown?.why_score_exists?.includes('capped') ||
    (assessment?.pld_score && assessment.pld_score > 60 && problems.length === 0)
  );

  return (
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* FEEDBACK BANNER */}
      {feedbackMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: feedbackMsg.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
          border: `1px solid ${feedbackMsg.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
          color: feedbackMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {feedbackMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span className="badge badge-info" style={{ fontWeight: 800 }}>
                {lead.primary_product_name || 'VanForces'}
              </span>
              {renderICPBadge(assessment?.icp_result, assessment?.icp_fit_score, assessment?.is_overridden)}
              {assessment && (
                <span className={`badge ${(assessment.icp_fit_score ?? 0) >= 50 ? 'badge-success' : 'badge-danger'}`} style={{ fontWeight: 700 }}>
                  Fit Score: {assessment.icp_fit_score || 0}/100
                </span>
              )}
            </div>

            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {lead.account_name}
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Lead ID: #{lead.id.slice(0, 8)} • Stage: <strong style={{ color: 'var(--text-primary)' }}>{lead.current_stage_name || 'PLD Qualified'}</strong> • Rule Ver: {assessment?.icp_rule_version || 'v1.0'}
            </div>

            {/* Lead Ownership and Customer Contact Details */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.8rem', marginTop: '6px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
                <UserCheck size={14} color="var(--primary)" />
                <span>Assigned Salesman: <strong style={{ color: 'var(--text-primary)' }}>{currentLeadOwner?.name || lead.owner_name || 'Unassigned'}</strong></span>
                {canAssignOrReassign && (
                  <button
                    type="button"
                    onClick={() => {
                      if (currentLeadOwner?.id) setSelectedSalesUserId(currentLeadOwner.id);
                      setShowAssignSalesModal(true);
                    }}
                    style={{
                      background: 'rgba(59, 130, 246, 0.12)',
                      border: '1px solid rgba(59, 130, 246, 0.4)',
                      color: 'var(--primary)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginLeft: '4px'
                    }}
                    title={isAlreadyAssigned ? "Reassign sales representative (Manager / Admin)" : "Assign sales representative"}
                  >
                    <UserPlus size={11} />
                    {isAlreadyAssigned ? 'Reassign' : '+ Assign to Salesman'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
                <User size={14} color="#10B981" />
                <span>Customer Contact: <strong style={{ color: 'var(--text-primary)' }}>{lead.contact_name ? `${lead.contact_name}${lead.contact_designation ? ` (${lead.contact_designation})` : ''}` : 'None Assigned'}</strong></span>
                {lead.contact_email && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>• {lead.contact_email}</span>}
                {lead.contact_phone && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>• {lead.contact_phone}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
                <MapPin size={14} color="#F59E0B" />
                <span>Location: <strong style={{ color: 'var(--text-primary)' }}>
                  {lead.account_city && lead.account_country 
                    ? `${lead.account_city}, ${lead.account_country}` 
                    : (lead.account_city || lead.account_country || 'Not specified')}
                </strong></span>
                <button
                  type="button"
                  onClick={() => {
                    setEditCity(lead.account_city || '');
                    setEditCountry(lead.account_country || '');
                    setShowEditPlaceModal(true);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: '0 4px'
                  }}
                >
                  {lead.account_city || lead.account_country ? 'Change' : '+ Add Place'}
                </button>
              </div>

              {lead.territory && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
                  <span className="badge badge-primary" style={{ fontSize: '0.74rem', background: 'rgba(79, 70, 229, 0.1)', color: '#4F46E5', border: '1px solid rgba(79, 70, 229, 0.3)' }}>
                    📍 Region: {lead.territory}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
                <Share2 size={14} color="#6366F1" />
                <span>Lead Source: <strong style={{ color: 'var(--text-primary)' }}>{lead.source_name || (lead as any).source || 'Direct / Unspecified'}</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSourceId(lead.source || '');
                    setShowEditSourceModal(true);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#6366F1',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: '0 4px'
                  }}
                >
                  {lead.source_name || (lead as any).source ? 'Change' : '+ Add Source'}
                </button>
              </div>
            </div>

            {/* Last & Next Activity Visual Card with Date & Time Logs */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              marginTop: '10px',
              padding: '10px 14px',
              background: 'var(--bg-surface)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              flexWrap: 'wrap'
            }}>
              <div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Calendar size={10} /> CREATED AT
                </span>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {new Date(lead.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              <div style={{ width: '1px', height: '26px', background: 'var(--border-subtle)' }} />

              <div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Clock size={10} color="var(--primary)" /> LAST ACTIVITY
                </span>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {lead.last_activity_at 
                    ? new Date(lead.last_activity_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                    : 'None Recorded'}
                </div>
              </div>

              <div style={{ width: '1px', height: '26px', background: 'var(--border-subtle)' }} />

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>NEXT ACTIVITY</span>
                  {(() => {
                    if (!lead.next_action_description && !lead.next_activity_due_at) {
                      return (
                        <span
                          className="badge badge-danger"
                          style={{ fontSize: '0.65rem', cursor: 'pointer' }}
                          onClick={() => setActiveSection('timeline')}
                          title="Click to schedule missing next action"
                        >
                          No Next Action ➔ Schedule
                        </span>
                      );
                    }
                    if (lead.next_activity_due_at) {
                      const due = new Date(lead.next_activity_due_at).getTime();
                      const diffHours = (due - Date.now()) / (1000 * 3600);
                      if (diffHours < 0) return (
                        <span
                          className="badge badge-danger"
                          style={{ fontSize: '0.65rem', cursor: 'pointer' }}
                          onClick={() => setActiveSection('timeline')}
                          title="Click to manage overdue activity"
                        >
                          Overdue ➔ Update
                        </span>
                      );
                      if (diffHours <= 24) return <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Due Today</span>;
                      if (diffHours <= 72) return <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>Due Soon</span>;
                    }
                    return <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Scheduled</span>;
                  })()}
                </div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {lead.next_action_description || 'No future action scheduled'}
                  {lead.next_activity_due_at && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                      (Due: {new Date(lead.next_activity_due_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })})
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button 
                  type="button"
                  className="btn btn-primary" 
                  onClick={() => setShowLogActionModal(true)}
                  style={{ fontSize: '0.72rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title="Record an interaction, call, meeting, or note with Date & Time"
                >
                  <Plus size={12} />
                  Log Action
                </button>
                <button 
                  type="button"
                  className="btn btn-secondary" 
                  onClick={() => setActiveSection('history')}
                  style={{ fontSize: '0.72rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title="View full chronological Date & Time action logs"
                >
                  <History size={12} />
                  Logs ({actionLogs.length})
                </button>
              </div>
            </div>
          </div>

          {/* Right Header Status Widget */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: 'var(--bg-surface-elevated)',
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              textAlign: 'right'
            }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                PLD Total Score
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', justifyContent: 'flex-end', marginTop: '2px' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary)' }}>
                  {assessment?.pld_score ?? 0}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ 100</span>
              </div>
              <div style={{ marginTop: '4px' }}>
                {renderScoreClassificationBadge(assessment?.score_classification)}
              </div>
            </div>

            <button
              className="btn btn-secondary"
              onClick={handleReEvaluateICP}
              disabled={evaluatingICP}
              title="Re-run product ICP knock-out rules & fit score"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '42px' }}
            >
              <RefreshCw size={15} className={evaluatingICP ? 'animate-spin' : ''} />
              Re-eval ICP
            </button>

            <button
              className="btn btn-outline"
              onClick={() => {
                setNurturePresetReason(assessment?.icp_result === 'FAIL' ? 'FAILED_ICP' : 'NO_BUDGET');
                setShowNurtureModal(true);
              }}
              title="Route failed or disqualified lead to Nurture & Win-Back Pool"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '42px', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' }}
            >
              <RotateCcw size={15} />
              Route to Nurture
            </button>
          </div>
        </div>

        {/* ICP Qualification Failure Alert */}
        {(assessment?.icp_result === 'FAIL' || ((assessment?.icp_fit_score ?? 100) < 50 && !assessment?.is_overridden)) && (
          <div style={{
            marginTop: '14px',
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid var(--danger)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <XCircle size={20} color="var(--danger)" style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ color: 'var(--danger)', fontSize: '0.88rem' }}>ICP Qualification Failed:</strong>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                  {Array.isArray(assessment?.icp_reasons) && assessment.icp_reasons.length > 0
                    ? assessment.icp_reasons.join(' • ')
                    : (assessment?.icp_fit_score !== undefined && assessment.icp_fit_score < 50
                        ? `ICP Fit Score (${assessment.icp_fit_score}/100) is below the minimum required qualification threshold (50%).`
                        : (assessment?.icp_breakdown?.why_result_occurred || 'Prospect does not satisfy minimum qualification criteria.'))}
                </span>
              </div>
            </div>
            <button
              className="btn btn-outline"
              onClick={() => {
                setNurturePresetReason('FAILED_ICP');
                setShowNurtureModal(true);
              }}
              style={{
                fontSize: '0.78rem',
                padding: '6px 14px',
                color: '#f59e0b',
                borderColor: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RotateCcw size={13} /> Add Failed Lead to Nurture Pool
            </button>
          </div>
        )}

        {/* Capped Score Warning Alert */}
        {isScoreCapped && (
          <div style={{
            marginTop: '14px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid var(--warning)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.8rem',
            color: 'var(--warning)'
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <div>
              <strong>QUALIFICATION GATE ENFORCED:</strong> {assessment?.pld_breakdown?.why_score_exists || 'Score is capped at DEVELOPMENT because at least one documented business problem is required before qualifying.'}
            </div>
          </div>
        )}

        {/* OVERRIDDEN NOTICE BANNER */}
        {assessment?.original_pld_score !== undefined && assessment.original_pld_score !== null && (
          <div style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(139, 92, 246, 0.12)',
            border: '1px solid var(--accent-purple)',
            fontSize: '0.8rem',
            color: '#DDD6FE',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <strong>Manual Score Override Active:</strong> Original calculated score was <strong>{assessment.original_pld_score}</strong>, manually adjusted to <strong>{assessment.pld_score}</strong>.
              <div style={{ fontSize: '0.75rem', marginTop: '2px', color: 'var(--text-secondary)' }}>
                Reason: "{assessment.override_reason}" (by {assessment.overridden_by_name || 'Authorized Manager'})
              </div>
            </div>
            <span className="badge" style={{ background: 'var(--accent-purple)', color: '#FFFFFF' }}>OVERRIDDEN</span>
          </div>
        )}

        {/* POST-PLD QUALIFICATION SALES ASSIGNMENT BANNER */}
        {(assessment?.icp_result === 'PASS' || assessment?.is_overridden) && (
          <div style={{
            marginTop: '14px',
            padding: '14px 18px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10B981',
                flexShrink: 0
              }}>
                <UserCheck size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  PLD Qualification Cleared — Sales Assignment
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Assigned Sales Representative: <strong style={{ color: currentLeadOwner?.name ? '#10B981' : '#F59E0B' }}>
                    {currentLeadOwner?.name || lead.owner_name || 'No Salesman Assigned Yet'}
                  </strong>
                  {currentLeadOwner?.email && <span style={{ color: 'var(--text-muted)' }}> ({currentLeadOwner.email})</span>}
                </div>
              </div>
            </div>

            {canAssignOrReassign ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (currentLeadOwner?.id) setSelectedSalesUserId(currentLeadOwner.id);
                    setShowAssignSalesModal(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    padding: '7px 14px',
                    background: '#10B981',
                    borderColor: '#10B981',
                    color: '#FFFFFF'
                  }}
                  title={isAlreadyAssigned ? "Reassign sales representative (Manager / Admin only)" : "Assign to sales representative"}
                >
                  <UserPlus size={14} />
                  {isAlreadyAssigned ? 'Reassign Salesman' : 'Assign to Salesman'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Lead reassignment is strictly restricted to Sales Managers and Administrators under Section 9.3 RBAC"
                >
                  <ShieldCheck size={14} color="#10B981" />
                  Assigned (Reassignment Restricted to Managers &amp; Admin)
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION TABS */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveSection('questionnaire')}
          className={`btn ${activeSection === 'questionnaire' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.8rem', padding: '6px 14px' }}
        >
          <FileText size={14} />
          Qualification Questionnaire ({questionnaire?.questions?.length || 0})
        </button>
        <button
          onClick={() => setActiveSection('problems')}
          className={`btn ${activeSection === 'problems' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.8rem', padding: '6px 14px', position: 'relative' }}
        >
          <AlertCircle size={14} />
          Business Problems ({problems.length})
          {problems.length === 0 && (
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', marginLeft: '4px' }}></span>
          )}
        </button>
        <button
          onClick={() => setActiveSection('score')}
          className={`btn ${activeSection === 'score' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.8rem', padding: '6px 14px' }}
        >
          <Scale size={14} />
          PLD Score Dimensions
        </button>
        <button
          onClick={() => setActiveSection('icp')}
          className={`btn ${activeSection === 'icp' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.8rem', padding: '6px 14px' }}
        >
          <ShieldCheck size={14} />
          ICP Gate & Breakdown
        </button>
        <button
          onClick={() => setActiveSection('history')}
          className={`btn ${activeSection === 'history' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.8rem', padding: '6px 14px' }}
        >
          <History size={14} />
          Action Logs &amp; Audit ({actionLogs.length})
        </button>
        <button
          onClick={() => setActiveSection('timeline')}
          className={`btn ${activeSection === 'timeline' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.8rem', padding: '6px 14px' }}
        >
          <Clock size={14} />
          Activities &amp; Timeline
        </button>
      </div>

      {/* TAB 1: QUESTIONNAIRE */}
      {activeSection === 'questionnaire' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                {questionnaire?.name || 'VanForces PLD Qualification Questionnaire'}
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Template Ver: {questionnaire?.version_number || '1.0'} • Feeds 6 deterministic PLD score dimensions
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="btn btn-primary"
                onClick={handleCalculateScore}
                disabled={savingScore}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14} className={savingScore ? 'animate-spin' : ''} />
                {savingScore ? 'Calculating Score...' : 'Calculate PLD Score'}
              </button>

              <button
                className="btn btn-secondary"
                onClick={handleAdvanceToDiscovery}
                disabled={transitioning}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  borderColor: 'var(--primary)',
                  color: 'var(--primary)'
                }}
                title="Advance qualified lead to Discovery & Mapping"
              >
                {transitioning ? <RefreshCw className="animate-spin" size={14} /> : <ArrowRight size={14} color="var(--primary)" />}
                Advance to Discovery
              </button>
            </div>
          </div>

          {questionnaire && questionnaire.questions && questionnaire.questions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '580px', overflowY: 'auto', paddingRight: '6px' }}>
              {questionnaire.questions.map((q, idx) => (
                <div
                  key={q.id || idx}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: 'var(--primary)',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        Q{idx + 1}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {q.question_text}
                      </span>
                      {q.is_required && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>*Required</span>
                      )}
                    </div>

                    <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>
                      Feeds: {q.feeds_dimension || 'GENERAL'}
                    </span>
                  </div>

                  {q.help_text && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                      {q.help_text}
                    </div>
                  )}

                  {/* Options render - All questions render as selectable options */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', marginTop: '8px' }}>
                    {q.options && q.options.map(opt => {
                      const optVal = opt.value ?? opt.code ?? opt.label;
                      const isSelected = answers[q.code] === optVal || 
                                         answers[q.code] === opt.label || 
                                         answers[q.code] === opt.code ||
                                         (optVal === 'true' && answers[q.code] === true) ||
                                         (optVal === 'false' && answers[q.code] === false);
                      const pointsDisplay = opt.points ?? opt.score_value ?? 0;
                      return (
                        <label
                          key={opt.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-surface-elevated)',
                            border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <input
                            type="radio"
                            name={q.code}
                            value={optVal}
                            checked={isSelected}
                            onChange={() => handleAnswerChange(q.code, optVal)}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          <div style={{ flex: 1 }}>
                            <span>{opt.label}</span>
                            {opt.knockout_flag && (
                              <span style={{ fontSize: '0.65rem', color: 'var(--danger)', marginLeft: '6px' }}>
                                (Knockout)
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.7rem', color: isSelected ? 'var(--primary)' : 'var(--text-muted)', fontWeight: isSelected ? 700 : 400 }}>
                            +{pointsDisplay}pts
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {/* If answer is not in options -> Add answer button and inline form */}
                  {addingOptionForQuestion === q.id ? (
                    <div style={{
                      marginTop: '10px',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px dashed var(--primary)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={13} /> Add Custom Answer Option (saves to question catalog &amp; configurable by Admin):
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Type customer's custom answer..."
                          value={newOptionLabel}
                          onChange={e => setNewOptionLabel(e.target.value)}
                          style={{ flex: 1, minWidth: '220px', fontSize: '0.8rem' }}
                          autoFocus
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Points:</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="form-input"
                            value={newOptionPoints}
                            onChange={e => setNewOptionPoints(parseInt(e.target.value) || 0)}
                            style={{ width: '70px', fontSize: '0.8rem' }}
                            title="Points awarded towards feeds dimension (0-100)"
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={savingNewOption || !newOptionLabel.trim()}
                          onClick={() => handleCreateCustomOption(q)}
                          style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                        >
                          {savingNewOption ? 'Saving...' : 'Save & Select Answer'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => { setAddingOptionForQuestion(null); setNewOptionLabel(''); }}
                          style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-start' }}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => {
                          setAddingOptionForQuestion(q.id);
                          setNewOptionLabel('');
                          setNewOptionPoints(50);
                        }}
                        style={{
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          borderStyle: 'dashed',
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Plus size={12} />
                        Answer not listed? Add custom answer
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: '8px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No active qualification questionnaire found for product {lead.primary_product_name}.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BUSINESS PROBLEMS */}
      {activeSection === 'problems' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                Documented Business Problems ({problems.length})
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Mandatory Gate: At least 1 documented problem is required. Captured problems automatically carry into Discovery.
              </p>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => setShowAddProblemModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={15} />
              Record Business Problem
            </button>
          </div>

          {problems.length === 0 ? (
            <div style={{
              padding: '24px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px dashed var(--danger)',
              textAlign: 'center'
            }}>
              <AlertTriangle size={24} color="var(--danger)" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '0.9rem' }}>
                No Business Problem Documented Yet
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '420px', margin: '4px auto 14px auto' }}>
                A PLD cannot qualify without a documented business problem. Score is currently capped at DEVELOPMENT.
              </p>
              <button
                className="btn btn-danger"
                onClick={() => setShowAddProblemModal(true)}
                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
              >
                + Capture Problem Now
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {problems.map((prob) => (
                <div
                  key={prob.id}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    borderLeft: `4px solid ${prob.severity === 'CRITICAL' ? 'var(--danger)' : prob.severity === 'HIGH' ? 'var(--warning)' : 'var(--primary)'}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          {prob.problem_name}
                        </span>
                        <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>
                          {prob.category}
                        </span>
                      </div>
                      {prob.business_impact && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          <strong>Impact:</strong> {prob.business_impact}
                        </div>
                      )}
                      {prob.affected_users && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          <strong>Affected Users/Teams:</strong> {prob.affected_users}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <span className={`badge ${prob.severity === 'CRITICAL' ? 'badge-danger' : prob.severity === 'HIGH' ? 'badge-warning' : 'badge-info'}`}>
                        {prob.severity}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Freq: {prob.frequency}
                      </span>
                    </div>
                  </div>

                  {prob.evidence && (
                    <div style={{
                      marginTop: '8px',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      background: 'var(--bg-surface-elevated)',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)'
                    }}>
                      <strong>Evidence:</strong> {prob.evidence}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PLD SCORE DIMENSIONS */}
      {activeSection === 'score' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                6-Dimension Deterministic PLD Score Breakdown
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Weights: Severity 25%, Value 20%, Decision 15%, Timeline 10%, Tech Fit 15%, Commercial 15%
              </p>
            </div>

            <button
              className="btn btn-secondary"
              onClick={() => setShowOverrideModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
            >
              <UserCheck size={14} />
              Manual Score Override
            </button>
          </div>

          {/* Dimension Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            {[
              { dim: 'PROBLEM_SEVERITY', label: 'Problem Severity', weight: 25, defaultPoints: 20 },
              { dim: 'BUSINESS_VALUE', label: 'Business Value', weight: 20, defaultPoints: 16 },
              { dim: 'DECISION_ACCESS', label: 'Decision-Maker Access', weight: 15, defaultPoints: 12 },
              { dim: 'TIMELINE', label: 'Implementation Timeline', weight: 10, defaultPoints: 8 },
              { dim: 'TECHNICAL_FIT', label: 'Technical Fit / ERP', weight: 15, defaultPoints: 12 },
              { dim: 'COMMERCIAL_POTENTIAL', label: 'Commercial Potential', weight: 15, defaultPoints: 12 },
            ].map(item => {
              const dimRecord = assessment?.dimension_scores?.find(ds => ds.dimension === item.dim);
              const scoreEarned = dimRecord?.score ?? (assessment ? Math.round((assessment.pld_score / 100) * item.weight) : 0);
              const weightedContribution = dimRecord?.weighted_score ?? scoreEarned;

              return (
                <div
                  key={item.dim}
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {item.label}
                      </span>
                      <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>
                        Weight {item.weight}%
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '8px' }}>
                      <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>
                        {scoreEarned}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        / {item.weight} pts (Contrib: {weightedContribution}%)
                      </span>
                    </div>

                    {/* Mini progress bar */}
                    <div style={{ height: '5px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, Math.round((scoreEarned / item.weight) * 100))}%`,
                          background: 'var(--primary)',
                          borderRadius: '3px'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '10px' }}>
                    {dimRecord?.evidence_notes || `Evaluated from qualification questionnaire responses for ${item.label}.`}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Structured Score Explanation */}
          {assessment?.pld_breakdown && (
            <div style={{
              padding: '16px',
              borderRadius: '8px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)'
            }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: 'var(--accent-cyan)' }}>
                Deterministic Score Rationale &amp; Audit Trail
              </h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <strong>Why the score exists:</strong> {assessment.pld_breakdown.why_score_exists}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                <strong>Recommended Next Action:</strong> {assessment.pld_breakdown.what_to_do_next}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ICP GATE & BREAKDOWN (The 4-Part Structure) */}
      {activeSection === 'icp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                Product-Specific ICP Gate Evaluation
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Evaluated per product: Knock-out rules must pass, followed by 0-100 fit score criteria
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="btn btn-primary"
                onClick={handleOpenICPModal}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 14px' }}
              >
                <Plus size={14} />
                Add / Update ICP Data
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleReEvaluateICP}
                disabled={evaluatingICP}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px' }}
              >
                <RefreshCw size={14} className={evaluatingICP ? 'animate-spin' : ''} />
                Re-Evaluate ICP
              </button>
              {renderICPBadge(assessment?.icp_result, assessment?.icp_fit_score, assessment?.is_overridden)}
            </div>
          </div>

          {/* 4-Part Breakdown Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            
            {/* 1. WHAT WE KNOW */}
            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <CheckCircle2 size={14} /> WHAT WE KNOW
              </div>
              {assessment?.icp_breakdown?.what_we_know && assessment.icp_breakdown.what_we_know.length > 0 ? (
                <ul style={{ paddingLeft: '18px', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {assessment.icp_breakdown.what_we_know.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Account profile data evaluated.</div>
              )}
            </div>

            {/* 2. WHAT IS MISSING */}
            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: assessment?.icp_breakdown?.what_is_missing?.length ? 'var(--warning)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <AlertTriangle size={14} /> WHAT IS MISSING
              </div>
              {assessment?.icp_breakdown?.what_is_missing && assessment.icp_breakdown.what_is_missing.length > 0 ? (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {assessment.icp_breakdown.what_is_missing.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleRedirectFromMissing(item)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          background: 'rgba(245, 158, 11, 0.08)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--warning)';
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.25)';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                        title="Click to jump directly to this section and fill missing data"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#FDE68A' }}>
                          <AlertCircle size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                          <span>{item}</span>
                        </div>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: 'var(--warning)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap'
                        }}>
                          Fill In ➔
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={handleOpenICPModal}
                      style={{ fontSize: '0.75rem', padding: '4px 10px', borderColor: 'var(--warning)', color: 'var(--warning)' }}
                    >
                      + Fill Missing ICP Attributes
                    </button>
                    {problems.length === 0 && (
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => {
                          setActiveSection('problems');
                          setShowAddProblemModal(true);
                        }}
                        style={{ fontSize: '0.75rem', padding: '4px 10px', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                      >
                        + Document Business Problem
                      </button>
                    )}
                    {!lead.next_action_description && (
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setActiveSection('timeline')}
                        style={{ fontSize: '0.75rem', padding: '4px 10px', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                      >
                        + Schedule Next Action
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>All required ICP profile fields are present.</div>
              )}
            </div>

            {/* 3. WHY THE RESULT OCCURRED */}
            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--info)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <HelpCircle size={14} /> WHY THE RESULT OCCURRED
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {assessment?.icp_breakdown?.why_result_occurred || 'Evaluated against published VanForces knockout and scoring criteria.'}
              </div>
            </div>

            {/* 4. WHAT THE USER SHOULD DO NEXT */}
            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <ArrowRight size={14} /> WHAT TO DO NEXT
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {assessment?.icp_breakdown?.what_to_do_next || 'Proceed with PLD qualification questionnaire and record business problems.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: COMPREHENSIVE DATE & TIME ACTION LOGS & AUDIT TRAIL */}
      {activeSection === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="var(--primary)" />
                Lead Action History &amp; Date-Time Log
                <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                  {actionLogs.length} Total Actions
                </span>
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Immutable chronological log of all interactions, stage transitions, qualification scores, problems, and updates with exact date &amp; time.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => loadActionLogs(lead.id)}
                style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Reload action logs"
              >
                <RefreshCw size={13} className={loadingActionLogs ? 'animate-spin' : ''} />
                Refresh Logs
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowLogActionModal(true)}
                style={{ fontSize: '0.78rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={14} /> Log Action with Date &amp; Time
              </button>
            </div>
          </div>

          {/* Search & Category Filter Pills */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { key: 'ALL', label: 'All Actions' },
                { key: 'PIPELINE', label: 'Stage Transitions' },
                { key: 'ACTIVITY', label: 'Conducted Activities' },
                { key: 'SCORING', label: 'PLD Scores' },
                { key: 'QUALIFICATION', label: 'Problems & Interests' },
                { key: 'AUDIT', label: 'System Audits' },
              ].map(f => {
                const count = f.key === 'ALL'
                  ? actionLogs.length
                  : actionLogs.filter(l => l.action_category === f.key).length;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setActionCategoryFilter(f.key)}
                    className={`btn ${actionCategoryFilter === f.key ? 'btn-primary' : 'btn-outline'}`}
                    style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: '20px' }}
                  >
                    {f.label} ({count})
                  </button>
                );
              })}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '4px 10px',
              width: '240px'
            }}>
              <Search size={13} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search action logs..."
                value={actionSearchTerm}
                onChange={(e) => setActionSearchTerm(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.78rem',
                  outline: 'none',
                  width: '100%'
                }}
              />
            </div>
          </div>

          {/* Action Logs Stream */}
          {loadingActionLogs ? (
            <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
              <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 8px', color: 'var(--primary)' }} />
              <div>Fetching complete date and time action logs...</div>
            </div>
          ) : (() => {
            const filtered = actionLogs.filter(log => {
              if (actionCategoryFilter !== 'ALL' && log.action_category !== actionCategoryFilter) return false;
              if (actionSearchTerm.trim()) {
                const term = actionSearchTerm.toLowerCase();
                const text = `${log.title} ${log.description} ${log.actor_name} ${log.outcome || ''} ${log.action_type}`.toLowerCase();
                if (!text.includes(term)) return false;
              }
              return true;
            });

            if (filtered.length === 0) {
              return (
                <div style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: 'var(--bg-surface)',
                  borderRadius: '10px',
                  border: '1px dashed var(--border-subtle)',
                  color: 'var(--text-muted)'
                }}>
                  <Clock size={28} style={{ opacity: 0.35, margin: '0 auto 10px' }} />
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    No action logs match your filter criteria
                  </div>
                  <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                    Record a phone call, meeting, stage progression, or custom note to populate this log.
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setShowLogActionModal(true)}
                    style={{ marginTop: '12px', fontSize: '0.78rem', padding: '6px 14px' }}
                  >
                    <Plus size={13} /> Log First Action
                  </button>
                </div>
              );
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative' }}>
                {filtered.map(log => {
                  const isExpanded = expandedLogId === log.id;
                  const borderCol = log.action_category === 'PIPELINE'
                    ? '#3B82F6'
                    : log.action_category === 'ACTIVITY'
                    ? '#10B981'
                    : log.action_category === 'SCORING'
                    ? '#8B5CF6'
                    : log.action_category === 'QUALIFICATION'
                    ? '#F59E0B'
                    : '#64748B';

                  return (
                    <div
                      key={log.id}
                      style={{
                        padding: '14px 18px',
                        borderRadius: '10px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderLeft: `4px solid ${borderCol}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Top Row: Title, Badges, Exact Date & Time Log */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {log.title}
                          </span>
                          <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                            {log.action_category}
                          </span>
                          <span className={`badge ${log.status === 'COMPLETED' || log.status === 'PASSED' || log.status === 'QUALIFIED' ? 'badge-success' : log.status === 'OVERRIDE' ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: '0.65rem' }}>
                            {log.status}
                          </span>
                        </div>

                        {/* PROMINENT DATE & TIME LOG */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            className="badge badge-neutral"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: 'var(--bg-surface-elevated)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-primary)',
                              padding: '4px 8px'
                            }}
                            title={`Full timestamp: ${log.timestamp}`}
                          >
                            <Calendar size={12} color="var(--primary)" />
                            {log.date_formatted}
                            <Clock size={12} color="var(--primary)" style={{ marginLeft: '4px' }} />
                            {log.time_formatted}
                          </span>
                        </div>
                      </div>

                      {/* Description & Actor */}
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                        {log.description}
                      </div>

                      {/* Outcome Notes Banner if available */}
                      {log.outcome && (
                        <div style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: 'rgba(59, 130, 246, 0.06)',
                          borderLeft: '3px solid var(--primary)',
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <strong style={{ color: 'var(--primary)' }}>Outcome / State:</strong>
                          <span>{log.outcome}</span>
                        </div>
                      )}

                      {/* Bottom Footer: Actor & Details toggle */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <div>
                          By <strong style={{ color: 'var(--text-secondary)' }}>{log.actor_name}</strong> ({log.actor_role}) • Source: {log.source}
                        </div>

                        {log.details && Object.keys(log.details).length > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--primary)',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 600
                            }}
                          >
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {isExpanded ? 'Hide Details' : 'View Action Details'}
                          </button>
                        )}
                      </div>

                      {/* Expanded Details JSON / Field diffs */}
                      {isExpanded && log.details && (
                        <div style={{
                          marginTop: '6px',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          background: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '0.72rem',
                          fontFamily: 'monospace'
                        }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                            Action Metadata &amp; Diff Log
                          </div>
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-primary)' }}>
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 6: UNIFIED ACTIVITY TIMELINE (PHASE 9) */}
      {activeSection === 'timeline' && (
        <UnifiedActivityTimeline
          relatedEntity={{
            type: 'lead',
            id: lead.id,
            name: lead.account_name,
            accountId: lead.account
          }}
          onActivityLogged={() => {
            if (onLeadUpdated) onLeadUpdated();
          }}
        />
      )}

      {/* BOTTOM ACTION & GATE READINESS BAR */}
      <div style={{
        marginTop: '8px',
        padding: '16px',
        borderRadius: '10px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Next Scheduled Action
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: '2px', color: 'var(--text-primary)' }}>
            {lead.next_action_description || 'No next action scheduled (Action required to advance)'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Due: {lead.next_activity_due_at ? new Date(lead.next_activity_due_at).toLocaleDateString() : 'Pending schedule'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Gate Mini Checklist */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.75rem' }}>
            <span
              onClick={() => {
                if (assessment?.icp_result !== 'PASS') {
                  handleOpenICPModal();
                }
              }}
              style={{
                color: assessment?.icp_result === 'PASS' ? 'var(--success)' : 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: assessment?.icp_result !== 'PASS' ? 'pointer' : 'default'
              }}
              title={assessment?.icp_result !== 'PASS' ? "Click to configure missing ICP attributes" : undefined}
            >
              {assessment?.icp_result === 'PASS' ? <CheckCircle2 size={14} /> : <XCircle size={14} />} ICP Pass {assessment?.icp_result !== 'PASS' && '➔ Fill'}
            </span>
            <span
              onClick={() => {
                if (problems.length === 0) {
                  setActiveSection('problems');
                  setShowAddProblemModal(true);
                }
              }}
              style={{
                color: problems.length > 0 ? 'var(--success)' : 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: problems.length === 0 ? 'pointer' : 'default'
              }}
              title={problems.length === 0 ? "Click to record missing problem" : undefined}
            >
              {problems.length > 0 ? <CheckCircle2 size={14} /> : <XCircle size={14} />} ≥1 Problem {problems.length === 0 && '➔ Add'}
            </span>
            <span
              onClick={() => {
                if (!lead.next_action_description) {
                  setActiveSection('timeline');
                }
              }}
              style={{
                color: lead.next_action_description ? 'var(--success)' : 'var(--warning)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: !lead.next_action_description ? 'pointer' : 'default'
              }}
              title={!lead.next_action_description ? "Click to schedule missing next action" : undefined}
            >
              {lead.next_action_description ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} Next Action {!lead.next_action_description && '➔ Set'}
            </span>
            {gateChecklist && !gateChecklist.all_passed && (
              <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>
                Stage Gates Pending
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setNurturePresetReason(assessment?.icp_result === 'FAIL' ? 'FAILED_ICP' : 'GATE_FAILED');
                setShowNurtureModal(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                fontWeight: 700,
                color: '#f59e0b',
                borderColor: 'rgba(245, 158, 11, 0.5)'
              }}
              title="Add failed or stalled lead to Nurture & Win-Back Pool"
            >
              <RotateCcw size={16} />
              Move Failed Lead to Nurture Pool
            </button>

            <button
              className="btn btn-primary"
              onClick={handleAdvanceToDiscovery}
              disabled={transitioning}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                fontWeight: 700,
                boxShadow: ((assessment?.icp_result === 'PASS' || assessment?.is_overridden) && problems.length > 0 && lead.next_action_description)
                  ? '0 4px 14px rgba(59, 130, 246, 0.4)'
                  : undefined
              }}
            >
              {transitioning ? <RefreshCw className="animate-spin" size={16} /> : <ArrowRight size={16} />}
              Advance to Discovery Stage
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: ADD BUSINESS PROBLEM */}
      <Modal
        isOpen={showAddProblemModal}
        onClose={() => setShowAddProblemModal(false)}
        title="Record Documented Business Problem"
        subtitle="Capture pain points, business impact, and problem severity"
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={18} />
          </div>
        }
        maxWidth="560px"
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowAddProblemModal(false)}
              style={{ fontSize: '0.82rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-lead-problem-form"
              className="btn btn-primary"
              disabled={savingProblem}
              style={{ fontSize: '0.82rem' }}
            >
              {savingProblem ? 'Saving...' : 'Save Problem & Update Gate'}
            </button>
          </>
        }
      >
        <form id="add-lead-problem-form" onSubmit={handleSaveProblem} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Problem Description / Name *
            </label>
            <input
              type="text"
              className="form-input"
              required
              value={newProbName}
              onChange={e => setNewProbName(e.target.value)}
              placeholder="e.g., Manual paper receipts causing reconciliation delays and driver overtime"
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Category
              </label>
              <select
                className="form-select"
                value={newProbCategory}
                onChange={e => setNewProbCategory(e.target.value)}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <option value="DISTRIBUTION">Distribution Operations</option>
                <option value="DISPATCH">Dispatch &amp; Fleet</option>
                <option value="ROUTING">Route Planning</option>
                <option value="COLLECTIONS">Collections &amp; Invoicing</option>
                <option value="INVENTORY">Van Stock Checks</option>
                <option value="ERP_INTEGRATION">ERP Integration</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Severity
              </label>
              <select
                className="form-select"
                value={newProbSeverity}
                onChange={e => setNewProbSeverity(e.target.value)}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <option value="CRITICAL">Critical (Blocking)</option>
                <option value="HIGH">High Impact</option>
                <option value="MEDIUM">Medium Impact</option>
                <option value="LOW">Low Impact</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Frequency
              </label>
              <select
                className="form-select"
                value={newProbFrequency}
                onChange={e => setNewProbFrequency(e.target.value)}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="OCCASIONAL">Occasional</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Affected Teams / Users
              </label>
              <input
                type="text"
                className="form-input"
                value={newProbUsers}
                onChange={e => setNewProbUsers(e.target.value)}
                placeholder="e.g. 25 Van Drivers, 3 Dispatchers"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Business Impact
            </label>
            <textarea
              className="form-input"
              rows={2}
              value={newProbImpact}
              onChange={e => setNewProbImpact(e.target.value)}
              placeholder="e.g., Estimated $45,000 monthly leakage due to unverified returned inventory and billing discrepancies"
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Evidence / Customer Quotes
            </label>
            <textarea
              className="form-input"
              rows={2}
              value={newProbEvidence}
              onChange={e => setNewProbEvidence(e.target.value)}
              placeholder="e.g. Confirmed by Operations Director during intake call"
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>
        </form>
      </Modal>

      {/* MODAL 2: MANUAL SCORE OVERRIDE */}
      <Modal
        isOpen={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        title="Authorized Score Override"
        subtitle="Apply manager/admin override with documented rationale"
        accentGradient="linear-gradient(90deg, var(--accent-purple, #8b5cf6) 0%, #ec4899 100%)"
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.12)', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserCheck size={18} />
          </div>
        }
        maxWidth="520px"
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowOverrideModal(false)}
              style={{ fontSize: '0.82rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="override-pld-score-form"
              className="btn btn-primary"
              disabled={overrideSubmitting}
              style={{ background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)', fontSize: '0.82rem' }}
            >
              {overrideSubmitting ? 'Submitting Override...' : 'Apply Authorized Override'}
            </button>
          </>
        }
      >
        {overrideError && (
          <div style={{ padding: '10px', borderRadius: '6px', background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '12px' }}>
            {overrideError}
          </div>
        )}

        <form id="override-pld-score-form" onSubmit={handleScoreOverride} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current Calculated Score:</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
              {assessment?.pld_score || 0} / 100
            </span>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              New Score Value (0 - 100) *
            </label>
            <input
              type="number"
              min="0"
              max="100"
              required
              className="form-input"
              value={overrideScore}
              onChange={e => setOverrideScore(parseInt(e.target.value) || 0)}
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              New Score Classification
            </label>
            <select
              className="form-select"
              value={overrideClassification}
              onChange={e => setOverrideClassification(e.target.value)}
              style={{ width: '100%', marginTop: '4px' }}
            >
              <option value="HIGH_PRIORITY">HIGH PRIORITY (81 - 100)</option>
              <option value="QUALIFIED">QUALIFIED PLD (61 - 80)</option>
              <option value="DEVELOPMENT">PLD DEVELOPMENT (31 - 60)</option>
              <option value="NURTURE">NURTURE (0 - 30)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Documented Override Reason (Mandatory Audit Trail) *
            </label>
            <textarea
              className="form-input"
              required
              rows={3}
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              placeholder="e.g. Confirmed C-level executive sponsorship and validated urgent dispatch replacement budget for Q3"
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>
        </form>
      </Modal>

      {/* MODAL 3: INTAKE COMMERCIAL LEAD / ADD & UPDATE ICP DATA */}
      <Modal
        isOpen={showICPModal}
        onClose={() => setShowICPModal(false)}
        title="Intake New Commercial Lead / ICP Data"
        subtitle="Assign to customer account, link customer contact, and establish lead ownership"
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sliders size={18} />
          </div>
        }
        maxWidth="840px"
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowICPModal(false)}
              style={{ fontSize: '0.82rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="icp-attributes-form"
              className="btn btn-primary"
              disabled={savingICPData}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
            >
              <RefreshCw size={14} className={savingICPData ? 'animate-spin' : ''} />
              {savingICPData ? 'Saving & Evaluating...' : 'Run Automatic ICP & Save'}
            </button>
          </>
        }
      >
        <form
          id="icp-attributes-form"
          onSubmit={handleSaveICPData}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          {/* Section 1: Customer Account / Organization Information */}
          <div style={{
            padding: '16px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px'
          }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <Building2 size={15} color="var(--primary)" />
              <span>Customer Account &amp; Organization Information</span>
              <span style={{ color: '#EF4444' }}>*</span>
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Company / Account Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Al-Riyadh Beverage Co."
                  value={editCompanyName}
                  onChange={(e) => {
                    setEditCompanyName(e.target.value);
                    handleCheckDuplicates(e.target.value, editDomain);
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    marginTop: '4px',
                    outline: 'none',
                    fontSize: '0.85rem'
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
                  value={editDomain}
                  onChange={(e) => {
                    setEditDomain(e.target.value);
                    handleCheckDuplicates(editCompanyName, e.target.value);
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    marginTop: '4px',
                    outline: 'none',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              {duplicateMatches.length > 0 && (
                <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid var(--warning)', borderRadius: '8px', fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>⚠️</span> Potential Duplicate Account Detected ({duplicateMatches.length}):
                  </div>
                  {duplicateMatches.map((m: any, i: number) => (
                    <div key={i} style={{ color: 'var(--text-primary)', marginTop: '4px', fontSize: '0.78rem' }}>
                      • <strong>{m.company_name || m.name}</strong> ({m.matched_on || m.domain || 'Domain / Name match'})
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={editIsTarget}
                    onChange={(e) => setEditIsTarget(e.target.checked)}
                  />
                  <strong>Designate as Target Account</strong>
                </label>
                {editIsTarget && (
                  <select
                    value={editTargetTier}
                    onChange={(e) => setEditTargetTier(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '6px',
                      background: 'var(--bg-surface)',
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
                    value={editIndustry}
                    onChange={(e) => {
                      setEditIndustry(e.target.value);
                      setDynamicIcpValues(prev => ({ ...prev, industry: e.target.value }));
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      marginTop: '4px',
                      outline: 'none',
                      fontSize: '0.82rem'
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
                    min="1"
                    value={editEmployees}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setEditEmployees(val);
                      setDynamicIcpValues(prev => ({ ...prev, employees_count: val, employees: val }));
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      marginTop: '4px',
                      outline: 'none',
                      fontSize: '0.82rem'
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
                    value={editCity}
                    onChange={(e) => {
                      setEditCity(e.target.value);
                      setDynamicIcpValues(prev => ({ ...prev, city: e.target.value }));
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      marginTop: '4px',
                      outline: 'none',
                      fontSize: '0.82rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Country</label>
                  <input
                    type="text"
                    placeholder="e.g. Saudi Arabia, UAE, Qatar"
                    value={editCountry}
                    onChange={(e) => {
                      setEditCountry(e.target.value);
                      setDynamicIcpValues(prev => ({ ...prev, country: e.target.value }));
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      marginTop: '4px',
                      outline: 'none',
                      fontSize: '0.82rem'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Region / Territory</label>
                <select
                  value={editTerritory}
                  onChange={(e) => setEditTerritory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    marginTop: '4px',
                    outline: 'none',
                    fontSize: '0.82rem'
                  }}
                >
                  <option value="">-- Select Region / Territory (Admin Defined) --</option>
                  {territoriesList.map(t => (
                    <option key={t.id} value={t.name}>{t.name} ({t.country})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Primary Customer Contact Person (Stakeholder) */}
          <div style={{
            padding: '16px',
            background: 'rgba(59, 130, 246, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={15} color="var(--primary)" />
                <span>Primary Customer Contact Person</span>
              </label>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Required for SQL Readiness Gate 5</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Contact Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Tariq Al-Mansoor"
                  value={editContactName}
                  onChange={(e) => setEditContactName(e.target.value)}
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
                  value={editContactTitle}
                  onChange={(e) => setEditContactTitle(e.target.value)}
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
                  value={editContactEmail}
                  onChange={(e) => setEditContactEmail(e.target.value)}
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
                  value={editContactPhone}
                  onChange={(e) => setEditContactPhone(e.target.value)}
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
                value={editContactRole}
                onChange={(e) => setEditContactRole(e.target.value)}
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

          {/* Section 3: Lead Origination Channel / Source */}
          <div style={{
            padding: '16px',
            background: 'rgba(99, 102, 241, 0.05)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: '10px'
          }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Share2 size={15} color="#6366F1" />
              <span>Lead Origination Source</span>
            </label>
            <select
              value={editSourceId}
              onChange={(e) => setEditSourceId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: '0.85rem'
              }}
            >
              <option value="">-- Direct / Unspecified Origination Channel --</option>
              {sourcesList.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Origination channel of the lead (Product Website Inbound, LinkedIn, Referral, Exhibition, etc.).
            </div>
          </div>

          {/* Section 4: Target Product Name */}
          <div style={{
            padding: '16px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px'
          }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Package size={15} color="var(--primary)" />
              <span>Target Product Name</span>
              <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              required
              value={selectedProductId || lead.primary_product}
              onChange={(e) => {
                const chosenId = e.target.value;
                setSelectedProductId(chosenId);
                const prod = productsList.find(p => p.id === chosenId);
                if (prod) {
                  setSelectedProductCode(prod.code);
                  fetchProductIcpRules(prod.id);
                }
              }}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: '0.85rem'
              }}
            >
              {productsList.length > 0 ? (
                productsList.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}){p.category ? ` • ${p.category}` : ''}
                  </option>
                ))
              ) : (
                <option value={lead.primary_product}>
                  {lead.primary_product_name || 'VanForces'} ({lead.primary_product_code || 'VANFORCES'})
                </option>
              )}
            </select>
          </div>

          {/* Section 5: Product ICP Qualification Criteria & Operational Parameters Card */}
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
              Ensure this commercial prospect meets the mandatory operational criteria for <strong>{productsList.find(p => p.id === selectedProductId || p.code === selectedProductCode)?.name || lead.primary_product_name || 'the selected product'}</strong> to avoid premature disqualification.
            </p>

            {/* Dynamic ICP Verification Banner & Rules Engine */}
            {(() => {
              const activeIntakeProduct = productsList.find(p => p.id === selectedProductId || p.code === selectedProductCode) || productsList[0] || { name: lead.primary_product_name || 'VanForces' };
              const knockoutRules = productIcpRules.filter(r => r.rule_type === 'KNOCKOUT');
              const fitRules = productIcpRules.filter(r => r.rule_type === 'FIT_CRITERIA' || (r.rule_type as string) === 'FIT');

              const knockoutEvaluations = knockoutRules.map(r => ({ rule: r, eval: getRuleEvaluation(r) }));
              const fitEvaluations = fitRules.map(r => ({ rule: r, eval: getRuleEvaluation(r) }));

              const failedKnockouts = knockoutEvaluations.filter(k => !k.eval.satisfied);

              const totalFitPoints = fitRules.reduce((sum, r) => sum + (r.weight || 10), 0);
              const earnedFitPoints = fitEvaluations.reduce((sum, f) => f.eval.satisfied ? sum + (f.rule.weight || 10) : sum, 0);
              const predictedFitPercent = totalFitPoints > 0 ? Math.round((earnedFitPoints / totalFitPoints) * 100) : 100;
              const isFitBelowThreshold = predictedFitPercent < 50;
              const hasFailureRisk = failedKnockouts.length > 0 || isFitBelowThreshold;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {loadingIcpRules ? (
                    <div style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <RotateCcw size={14} className="animate-spin" />
                      <span>Fetching active ICP rules for {activeIntakeProduct?.name}...</span>
                    </div>
                  ) : (
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: hasFailureRisk
                        ? 'rgba(239, 68, 68, 0.09)'
                        : (productIcpRules.length > 0 ? 'rgba(16, 185, 129, 0.09)' : 'var(--bg-surface)'),
                      border: hasFailureRisk
                        ? '1px solid rgba(239, 68, 68, 0.35)'
                        : (productIcpRules.length > 0 ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-subtle)'),
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {hasFailureRisk ? (
                            <AlertTriangle size={16} color="#EF4444" />
                          ) : (
                            <CheckCircle2 size={16} color="#10B981" />
                          )}
                          <span style={{
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            color: hasFailureRisk ? '#EF4444' : (productIcpRules.length > 0 ? '#10B981' : 'var(--text-primary)')
                          }}>
                            {failedKnockouts.length > 0
                              ? `ICP Disqualification Risk: ${failedKnockouts.length} of ${knockoutRules.length} Knockout Rule(s) Unmet`
                              : isFitBelowThreshold
                                ? `ICP Disqualification Risk: Predicted Fit Score (${predictedFitPercent}%) is below 50% passing threshold`
                                : (knockoutRules.length > 0
                                    ? `ICP Pre-Verification Passed: All Criteria Satisfied (${predictedFitPercent}% Fit Score)`
                                    : 'No Mandatory Knockout Rules Configured')}
                          </span>
                        </div>

                        {fitRules.length > 0 && (
                          <span className={`badge ${predictedFitPercent >= 50 ? 'badge-info' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                            Predicted Fit: {predictedFitPercent}% ({earnedFitPoints}/{totalFitPoints} pts)
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {failedKnockouts.length > 0 ? (
                          <span>
                            ⚠️ <strong>Action Required:</strong> The entered inputs fail criteria for: {failedKnockouts.map(k => k.rule.field_name.replace(/_/g, ' ')).join(', ')}. If saved now, this lead will be automatically routed to <strong>Nurture &amp; Win-Back Pool</strong>.
                          </span>
                        ) : isFitBelowThreshold ? (
                          <span>
                            ⚠️ <strong>Low Fit Score Alert:</strong> Predicted ICP fit is {predictedFitPercent}%, which is below the minimum 50% threshold. If saved without meeting additional operational criteria, this lead will fail ICP and be routed to Nurture.
                          </span>
                        ) : (
                          <span>
                            ✓ Operational parameters align with {activeIntakeProduct?.name} target ICP (≥50% Fit Score). This lead qualifies for full PLD assessment upon saving.
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dynamic Rule Controls */}
                  {productIcpRules.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {productIcpRules.map(rule => {
                        const evalResult = getRuleEvaluation(rule);
                        const isKnockout = rule.rule_type === 'KNOCKOUT';
                        const label = rule.description || rule.field_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

                        let currentValue = dynamicIcpValues[rule.field_name];
                        if (rule.field_name === 'industry') currentValue = editIndustry;
                        else if (rule.field_name === 'employees_count' || rule.field_name === 'employees') currentValue = editEmployees;
                        else if (rule.field_name === 'distribution_centers_count' || rule.field_name === 'distribution_depots') currentValue = icpDistributionCenters;
                        else if (rule.field_name === 'country') currentValue = editCountry;
                        else if (rule.field_name === 'city') currentValue = editCity;
                        else if (rule.field_name === 'field_sales') currentValue = icpFieldSales;
                        else if (rule.field_name === 'vans_count') currentValue = icpVansCount;
                        else if (rule.field_name === 'salesmen_count') currentValue = icpSalesmenCount;
                        else if (rule.field_name === 'primary_erp') currentValue = icpPrimaryErp;

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
                          else if (rule.field_name === 'industry') setEditIndustry(String(newVal));
                          else if (rule.field_name === 'employees_count' || rule.field_name === 'employees') setEditEmployees(Number(newVal));
                          else if (rule.field_name === 'distribution_centers_count' || rule.field_name === 'distribution_depots') setIcpDistributionCenters(Number(newVal));
                          else if (rule.field_name === 'monthly_invoices') setIcpMonthlyInvoices(Number(newVal));
                          else if (rule.field_name === 'daily_orders') setIcpDailyOrders(Number(newVal));
                          else if (rule.field_name === 'country') setEditCountry(String(newVal));
                          else if (rule.field_name === 'city') setEditCity(String(newVal));
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
                                {((rule.target_value as unknown) as string[]).map((opt: string) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                                {currentValue && !((rule.target_value as unknown) as string[]).includes(String(currentValue)) && (
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
                  )}

                  {/* Operational Parameters (Field sales, vans, salesmen, ERP, depots) */}
                  <div style={{
                    padding: '14px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Core Fleet, Sales &amp; ERP Parameters
                    </div>

                    <div>
                      <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Field Sales / Direct Store Delivery (DSD) Operation *
                      </label>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="field_sales_modal"
                            checked={icpFieldSales === true}
                            onChange={() => {
                              setIcpFieldSales(true);
                              setDynamicIcpValues(prev => ({ ...prev, field_sales: true }));
                            }}
                          />
                          Yes (Operates Field Sales / Vans)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="field_sales_modal"
                            checked={icpFieldSales === false}
                            onChange={() => {
                              setIcpFieldSales(false);
                              setDynamicIcpValues(prev => ({ ...prev, field_sales: false }));
                            }}
                          />
                          No (In-store or Wholesale only)
                        </label>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          Active Delivery Vans Count *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={icpVansCount}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            setIcpVansCount(val);
                            setDynamicIcpValues(prev => ({ ...prev, vans_count: val }));
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                            marginTop: '4px',
                            outline: 'none'
                          }}
                        />
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Recommended: 5+ vans
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          Active Salesmen / Reps Count *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={icpSalesmenCount}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            setIcpSalesmenCount(val);
                            setDynamicIcpValues(prev => ({ ...prev, salesmen_count: val }));
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                            marginTop: '4px',
                            outline: 'none'
                          }}
                        />
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Recommended: 5+ reps
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          Primary ERP / Accounting System
                        </label>
                        <select
                          value={icpPrimaryErp}
                          onChange={e => {
                            setIcpPrimaryErp(e.target.value);
                            setDynamicIcpValues(prev => ({ ...prev, primary_erp: e.target.value }));
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                            marginTop: '4px',
                            outline: 'none'
                          }}
                        >
                          <option value="SAP">SAP Business One / ECC / S4HANA</option>
                          <option value="Odoo">Odoo Enterprise / Community</option>
                          <option value="Microsoft Dynamics">Microsoft Dynamics 365 / Business Central</option>
                          <option value="Oracle">Oracle NetSuite / Fusion</option>
                          <option value="Tally">Tally Prime / ERP</option>
                          <option value="Custom">Custom / Proprietary In-House ERP</option>
                          <option value="Other">Other ERP</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          Distribution Depots / Branches
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={icpDistributionCenters}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setIcpDistributionCenters(val);
                            setDynamicIcpValues(prev => ({ ...prev, distribution_centers_count: val, distribution_depots: val }));
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                            marginTop: '4px',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Section 6: Territory / Regional Scoping */}
          <div style={{
            padding: '16px',
            background: 'rgba(79, 70, 229, 0.05)',
            border: '1px solid rgba(79, 70, 229, 0.25)',
            borderRadius: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={15} color="#4F46E5" />
                <span>Territory / Regional Scoping</span>
              </label>
              <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                Regional Scoping
              </span>
            </div>
            <select
              value={editTerritory}
              onChange={(e) => setEditTerritory(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '0.84rem',
                outline: 'none'
              }}
            >
              <option value="">-- Choose Territory / Region (Default: Global / Auto) --</option>
              {territoriesList.map(t => (
                <option key={t.id} value={t.name}>
                  {t.name} ({t.country}) {t.regional_manager_name ? `• Regional Mgr: ${t.regional_manager_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Section 7: Lead Ownership & Staff Assignment */}
          {isManagerOrAdmin ? (
            <div style={{
              padding: '14px',
              background: 'var(--bg-surface)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck size={15} color="#10B981" />
                  <span>Assign Lead to Staff</span>
                </label>
                <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                  Manager / Admin Authority
                </span>
              </div>
              <select
                value={editAssignedOwnerId}
                onChange={(e) => setEditAssignedOwnerId(e.target.value)}
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
                <option value="">Unassigned (Inbound Triage Queue)</option>
                {staffUsers
                  .filter(u => !u.is_partner_user)
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.role_display || u.role} ({u.email})
                    </option>
                  ))}
              </select>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Currently assigned staff: <strong>{currentLeadOwner?.name || lead.owner_name || 'Unassigned (Triage)'}</strong>. Select a sales representative or executive to establish or reassign ownership.
              </div>
            </div>
          ) : (
            <div style={{
              padding: '14px',
              background: 'rgba(59, 130, 246, 0.05)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  <UserCheck size={15} color="var(--primary)" />
                  <span>Assigned Staff: {lead.owner_name || currentLeadOwner?.name || 'Unassigned (Triage Queue)'}</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Sales Representatives cannot reassign leads. Only Sales Managers and Administrators have permission to change staff assignment.
                </div>
              </div>
              <span className="badge badge-neutral" style={{ fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                🔒 Locked to Lead Owner
              </span>
            </div>
          )}

          {/* Section 8: Mandatory Next Action */}
          <div style={{
            padding: '16px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px'
          }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
              Mandatory Next Action <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Schedule discovery call with Sales Director"
              value={editNextAction}
              onChange={(e) => setEditNextAction(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: '0.84rem'
              }}
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Scheduled next activity required for progression through pipeline stages.
            </div>
          </div>
        </form>
      </Modal>

      {/* QUICK LOG ACTION WITH DATE & TIME MODAL */}
      <Modal
        isOpen={showLogActionModal}
        onClose={() => setShowLogActionModal(false)}
        title="Log Action with Date & Time"
        subtitle="Record commercial interaction with exact timestamp and milestone details"
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={18} />
          </div>
        }
        maxWidth="620px"
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowLogActionModal(false)}
              style={{ fontSize: '0.82rem', padding: '8px 16px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="direct-log-action-form"
              disabled={submittingAction}
              className="btn btn-primary"
              style={{ fontSize: '0.82rem', padding: '8px 20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {submittingAction && <RefreshCw size={14} className="animate-spin" />}
              {submittingAction ? 'Saving Action...' : 'Save Action Log'}
            </button>
          </>
        }
      >
        <form id="direct-log-action-form" onSubmit={handleDirectLogAction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Action Subject / Title *
              </label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. Solution Review Call with Procurement"
                value={newActionSubject}
                onChange={(e) => setNewActionSubject(e.target.value)}
                style={{ width: '100%', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Action Type *
              </label>
              <select
                className="form-select"
                value={newActionType}
                onChange={(e) => setNewActionType(e.target.value)}
                style={{ width: '100%', fontSize: '0.85rem' }}
              >
                <option value="CALL">Phone Call</option>
                <option value="EMAIL">Email</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="MEETING">Meeting</option>
                <option value="DISCOVERY">Discovery Session</option>
                <option value="DEMO">Product Demo</option>
                <option value="POC">POC Check-in</option>
                <option value="FOLLOW_UP">Follow-up</option>
                <option value="SITE_VISIT">Site Visit</option>
                <option value="CUSTOM">Custom Note / Milestone</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Action Date &amp; Time *
              </label>
              <input
                type="datetime-local"
                required
                className="form-input"
                value={newActionDateTime}
                onChange={(e) => setNewActionDateTime(e.target.value)}
                style={{ width: '100%', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Duration (Minutes)
              </label>
              <input
                type="number"
                min={5}
                step={5}
                className="form-input"
                value={newActionDuration}
                onChange={(e) => setNewActionDuration(parseInt(e.target.value) || 30)}
                style={{ width: '100%', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Discussion / Action Details
            </label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Key discussion points, customer feedback, operational notes..."
              value={newActionNotes}
              onChange={(e) => setNewActionNotes(e.target.value)}
              style={{ width: '100%', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Documented Outcome *
            </label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="e.g. Customer approved trial schedule; agreed to follow-up next Monday"
              value={newActionOutcome}
              onChange={(e) => setNewActionOutcome(e.target.value)}
              style={{ width: '100%', fontSize: '0.85rem' }}
            />
          </div>

          {/* Scheduled Next Action */}
          <div style={{
            padding: '14px',
            borderRadius: '8px',
            background: 'var(--bg-surface-elevated, rgba(59, 130, 246, 0.05))',
            border: '1px solid var(--border-subtle, rgba(59, 130, 246, 0.2))',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} color="var(--primary)" />
              Scheduled Next Action (Mandatory Governance)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Next Action Description
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Conduct follow-up product trial review"
                  value={newActionNextDesc}
                  onChange={(e) => setNewActionNextDesc(e.target.value)}
                  style={{ width: '100%', fontSize: '0.82rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Due Date &amp; Time
                </label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={newActionNextDue}
                  onChange={(e) => setNewActionNextDue(e.target.value)}
                  style={{ width: '100%', fontSize: '0.82rem' }}
                />
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL 6: MOVE FAILED LEAD TO NURTURE & WIN-BACK INTELLIGENCE POOL */}
      <Modal
        isOpen={showNurtureModal}
        onClose={() => setShowNurtureModal(false)}
        title="Move Failed Lead to Nurture Pool"
        subtitle="Incubate stalled or disqualified prospect in the Nurture & Win-Back Intelligence Pool"
        accentGradient="linear-gradient(90deg, #f59e0b, #d97706)"
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RotateCcw size={18} />
          </div>
        }
        maxWidth="540px"
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowNurtureModal(false)}
              style={{ fontSize: '0.82rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="move-to-nurture-form"
              className="btn btn-primary"
              disabled={nurturingLead}
              style={{
                fontSize: '0.82rem',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                borderColor: '#d97706',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {nurturingLead ? <RefreshCw className="animate-spin" size={14} /> : <RotateCcw size={14} />}
              {nurturingLead ? 'Moving...' : 'Confirm & Move to Nurture Pool'}
            </button>
          </>
        }
      >
        <form id="move-to-nurture-form" onSubmit={handleMoveToNurture} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{
            padding: '12px 14px',
            borderRadius: '8px',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                {lead.account_name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Product: {lead.primary_product_name || 'VanForces'} • Current Owner: {lead.owner_name || 'Unassigned'}
              </div>
            </div>
            <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
              {assessment?.icp_result || 'DISQUALIFIED'}
            </span>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Pool Category / Disposition Status *
            </label>
            <select
              className="form-select"
              value={nurtureStatusChoice}
              onChange={e => setNurtureStatusChoice(e.target.value as any)}
              style={{ width: '100%', marginTop: '4px' }}
            >
              <option value="NURTURE">Nurture Pool (Timed Re-qualification Incubation)</option>
              <option value="DISQUALIFIED">Disqualified (Unfit for Product / Knockout Failed)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Primary Failure / Disqualification Rationale *
            </label>
            <select
              className="form-select"
              value={nurturePresetReason}
              onChange={e => setNurturePresetReason(e.target.value)}
              style={{ width: '100%', marginTop: '4px' }}
            >
              <option value="FAILED_ICP">Failed ICP Criteria (Fleet size, van count, or field knockouts not met)</option>
              <option value="GATE_FAILED">Failed Required Stage Gates (No critical business pain / missing criteria)</option>
              <option value="NO_BUDGET">No Immediate Budget / Project Postponed to Next Fiscal Cycle</option>
              <option value="INFRASTRUCTURE">Prerequisite System / ERP Not Ready for Modern PLD Deployment</option>
              <option value="COMPETITOR">Competitor Contract Locked (Target for Win-Back Playbook)</option>
              <option value="CUSTOM">Custom Rationale (Specify below)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Detailed Notes &amp; Incubation Context
            </label>
            <textarea
              className="form-input"
              rows={3}
              value={nurtureCustomReason}
              onChange={e => setNurtureCustomReason(e.target.value)}
              placeholder="Document specific customer context, competitor details, or conditions required for future revival..."
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>
        </form>
      </Modal>
      {/* EDIT LOCATION / PLACE MODAL */}
      <Modal
        isOpen={showEditPlaceModal}
        onClose={() => setShowEditPlaceModal(false)}
        title="Lead Account Location / Place"
        subtitle="Specify geographic city and territory country for this lead."
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MapPin size={18} />
          </div>
        }
        maxWidth="440px"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowEditPlaceModal(false)}
              className="btn btn-outline"
              style={{ fontSize: '0.82rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-lead-place-form"
              disabled={savingPlace}
              className="btn btn-primary"
              style={{ fontSize: '0.82rem' }}
            >
              {savingPlace ? 'Saving...' : 'Save Location'}
            </button>
          </>
        }
      >
        <form
          id="edit-lead-place-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!lead.account) return;
            setSavingPlace(true);
            try {
              await api.updateAccount(lead.account, {
                city: editCity.trim() || '',
                country: editCountry.trim() || ''
              });
              lead.account_city = editCity.trim();
              lead.account_country = editCountry.trim();
              setShowEditPlaceModal(false);
              inAppAlert.success('Lead location updated successfully!');
              onLeadUpdated?.();
            } catch (err: any) {
              inAppAlert.error(err.message || 'Failed to update location');
            } finally {
              setSavingPlace(false);
            }
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                City / Place
              </label>
              <input
                type="text"
                placeholder="e.g. Jeddah, Dammam, Dubai, Riyadh"
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Country
              </label>
              <input
                type="text"
                placeholder="e.g. Saudi Arabia, UAE, Qatar"
                value={editCountry}
                onChange={(e) => setEditCountry(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontSize: '0.85rem'
                }}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL 8: EDIT / ASSIGN LEAD SOURCE */}
      <Modal
        isOpen={showEditSourceModal}
        onClose={() => setShowEditSourceModal(false)}
        title="Lead Origination Source"
        subtitle="Specify or update where this lead was generated from for marketing ROI and pipeline attribution."
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.12)', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Share2 size={18} />
          </div>
        }
        maxWidth="460px"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowEditSourceModal(false)}
              className="btn btn-outline"
              style={{ fontSize: '0.82rem' }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={savingSource}
              onClick={async () => {
                setSavingSource(true);
                try {
                  const updated = await api.updateLead(lead.id, { source: selectedSourceId || null });
                  lead.source = updated.source;
                  lead.source_name = updated.source_name;
                  setShowEditSourceModal(false);
                  inAppAlert.success('Lead source updated successfully!');
                  onLeadUpdated?.();
                } catch (err: any) {
                  inAppAlert.error(err.message || 'Failed to update lead source');
                } finally {
                  setSavingSource(false);
                }
              }}
              className="btn btn-primary"
              style={{ fontSize: '0.82rem' }}
            >
              {savingSource ? 'Saving...' : 'Save Lead Source'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Select Active Origination Channel
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
                fontSize: '0.85rem',
                outline: 'none'
              }}
            >
              <option value="">-- Direct / Unspecified Inbound --</option>
              {sourcesList.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Or Add a New Channel on the Fly
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
                    setSourcesList(prev => [...prev.filter(s => s.id !== created.id), created]);
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
      </Modal>

      {/* MODAL: ASSIGN LEAD TO SALES REPRESENTATIVE */}
      <Modal
        isOpen={showAssignSalesModal}
        onClose={() => setShowAssignSalesModal(false)}
        title={isAlreadyAssigned ? "Reassign Lead to Sales Representative" : "Assign Lead to Sales Representative"}
        subtitle={isAlreadyAssigned 
          ? "Manager Reassignment Authority: Reassign this qualified lead to another Sales Representative / Account Executive"
          : "Hand off qualified lead to a dedicated Salesman / Account Executive for Discovery & Commercial Pursuit"
        }
        icon={
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserCheck size={20} />
          </div>
        }
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowAssignSalesModal(false)}
              disabled={savingAssignment}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAssignToSalesman}
              disabled={savingAssignment || !selectedSalesUserId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#10B981',
                borderColor: '#10B981',
                color: '#FFFFFF'
              }}
            >
              {savingAssignment ? <RefreshCw className="animate-spin" size={15} /> : <UserCheck size={15} />}
              {savingAssignment ? (isAlreadyAssigned ? 'Reassigning...' : 'Assigning...') : (isAlreadyAssigned ? 'Confirm Reassignment' : 'Confirm Sales Assignment')}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Lead Context Summary */}
          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.85rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{lead.account_name}</strong>
              <span className="badge badge-info">{lead.primary_product_name || 'VanForces'}</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              PLD Score: <strong style={{ color: 'var(--primary)' }}>{assessment?.pld_score ?? 0}/100</strong> • ICP Status: <strong style={{ color: '#10B981' }}>{assessment?.icp_result || 'PASSED'}</strong>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '4px' }}>
              Currently Assigned To: <strong style={{ color: 'var(--text-primary)' }}>{currentLeadOwner?.name || lead.owner_name || 'Unassigned'}</strong>
            </div>
          </div>

          {/* Sales Representative Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Select Sales Representative <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <select
              className="input-field"
              value={selectedSalesUserId}
              onChange={(e) => setSelectedSalesUserId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem'
              }}
            >
              <option value="">-- Choose Sales Representative --</option>
              {/* Sales Team Members First */}
              <optgroup label="Sales Team (BDMs & Account Executives)">
                {staffUsers
                  .filter((u: any) => u.role === 'SALES_BDM' || u.role === 'ACCOUNT_EXECUTIVE' || u.role === 'SALES_MANAGER' || u.role === 'SALES_REP' || u.role === 'SALES_EXECUTIVE')
                  .map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username} ({u.role_display || u.role}) - {u.email}
                    </option>
                  ))
                }
              </optgroup>
              {/* Other Staff Members */}
              <optgroup label="Other Commercial & Presales Staff">
                {staffUsers
                  .filter((u: any) => !(u.role === 'SALES_BDM' || u.role === 'ACCOUNT_EXECUTIVE' || u.role === 'SALES_MANAGER' || u.role === 'SALES_REP' || u.role === 'SALES_EXECUTIVE'))
                  .map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username} ({u.role_display || u.role}) - {u.email}
                    </option>
                  ))
                }
              </optgroup>
            </select>
          </div>

          {/* Handoff / Discovery Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Handoff Notes & Instructions for Salesman (Optional)
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="e.g. Qualified for route execution. Primary pain point is SAR 40k monthly duplicate orders in wholesale van dispatch. Client expects discovery call this week."
              value={assignHandoffNotes}
              onChange={(e) => setAssignHandoffNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Schedule Followup Task Checkbox */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '12px 14px',
            borderRadius: '8px',
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}>
            <input
              type="checkbox"
              id="schedule_task_checkbox"
              checked={scheduleFollowupTask}
              onChange={(e) => setScheduleFollowupTask(e.target.checked)}
              style={{ marginTop: '3px', cursor: 'pointer' }}
            />
            <label htmlFor="schedule_task_checkbox" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: '1.4' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Initialize 48-Hour Sales Outreach Task</strong>
              <div>Automatically adds a high-priority Discovery follow-up task into the selected salesman's Work Queue with SLA deadline tracking.</div>
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
};
