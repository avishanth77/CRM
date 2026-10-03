const API_BASE = 'http://localhost:8001/api/v1';

export interface FunnelData {
  metrics: {
    total_leads: number;
    icp_passed: number;
    pld_qualified: number;
    sql_converted: number;
    total_opportunities: number;
    won_opportunities: number;
    total_won_revenue: number;
    total_pipeline_value: number;
  };
  rates: {
    icp_rate: number;
    pld_rate: number;
    sql_rate: number;
    win_rate: number;
  };
  attention_required: {
    missing_next_actions: number;
    high_score_leads: number;
  };
  product_breakdown: Array<{
    product_code: string;
    product_name: string;
    leads_count: number;
    pipeline_value: number;
  }>;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  status: string;
  modules?: Array<{
    id: string;
    code: string;
    name: string;
    capabilities: Array<{
      id: string;
      code: string;
      name: string;
      description: string;
    }>;
  }>;
}

export interface Lead {
  id: string;
  account: string;
  account_name: string;
  contact?: string;
  contact_name?: string;
  primary_product: string;
  primary_product_name: string;
  primary_product_code: string;
  current_stage?: string;
  current_stage_name?: string;
  current_stage_code?: string;
  status: string;
  last_activity_at?: string;
  next_activity_due_at?: string;
  next_action_description?: string;
  recorded_problems?: Array<{
    id: string;
    problem: string;
    problem_detail: {
      name: string;
      category: string;
      default_severity: string;
    };
    notes?: string;
  }>;
  is_target_account?: boolean;
  target_tier?: string;
  source?: string;
  created_at: string;
}

export interface ICPBreakdown {
  what_we_know: string[];
  what_is_missing: string[];
  why_result_occurred: string;
  what_to_do_next: string;
}

export interface PLDBreakdown {
  what_we_know: string[];
  what_is_missing: string[];
  why_score_exists: string;
  what_to_do_next: string;
}

export interface ScoreAssessmentItem {
  id: string;
  dimension: string;
  score: number;
  max_score: number;
  weight_pct: number;
  weighted_score: number;
  evidence_notes: string;
  explanation?: Record<string, any>;
  rule_version?: string;
}

export interface AccountProductAssessment {
  id: string;
  account: string;
  account_name: string;
  product: string;
  product_name: string;
  product_code: string;
  lead?: string;
  lead_company_name?: string;
  icp_result: 'PASS' | 'FAIL' | 'PENDING' | 'REVIEW_REQUIRED';
  icp_fit_score: number;
  icp_knockout_passed: boolean;
  icp_rule_version?: string;
  icp_reasons?: string[];
  icp_evidence?: Record<string, any>;
  icp_breakdown?: ICPBreakdown;
  pld_breakdown?: PLDBreakdown;
  pld_score: number;
  original_pld_score?: number;
  score_classification: 'NURTURE' | 'DEVELOPMENT' | 'QUALIFIED' | 'HIGH_PRIORITY';
  is_qualified: boolean;
  qualification_status: string;
  override_reason?: string;
  overridden_by_name?: string;
  overridden_at?: string;
  qualification_history?: Array<Record<string, any>>;
  questionnaire_answers?: Record<string, any>;
  dimension_scores?: ScoreAssessmentItem[];
  evaluated_at: string;
  created_at: string;
  updated_at: string;
}

export interface QuestionAnswerOption {
  id: string;
  code: string;
  label: string;
  order: number;
  score_value: number;
  knockout_flag: boolean;
  feeds_dimension: string;
}

export interface QuestionnaireQuestion {
  id: string;
  code: string;
  question_text: string;
  question_type: 'SINGLE_SELECT' | 'MULTI_SELECT' | 'TEXT' | 'NUMERIC' | 'BOOLEAN' | 'SLIDER';
  category: string;
  order: number;
  is_required: boolean;
  help_text?: string;
  feeds_dimension: string;
  weight: number;
  options: QuestionAnswerOption[];
}

export interface QuestionnaireTemplate {
  id: string;
  name: string;
  code: string;
  product?: string;
  product_name?: string;
  version_number: string;
  is_active: boolean;
  stage_code: string;
  questions: QuestionnaireQuestion[];
}

export interface ICPProfile {
  id: string;
  name: string;
  code: string;
  product: string;
  product_name: string;
  product_code: string;
  version_number: string;
  is_active: boolean;
  pass_threshold: number;
  description: string;
  rules_count?: number;
}

export interface ICPRule {
  id: string;
  profile: string;
  rule_type: 'KNOCKOUT' | 'FIT_CRITERIA';
  field_name: string;
  operator: string;
  target_value: string;
  weight: number;
  is_active: boolean;
  failure_reason: string;
  description: string;
}

export interface ScoreModel {
  id: string;
  name: string;
  code: string;
  version_number: string;
  is_active: boolean;
  weights: Record<string, number>;
  thresholds: Record<string, number>;
}

export interface LeadProblemItem {
  id: string;
  lead: string;
  problem: string;
  problem_name: string;
  problem_code: string;
  category: string;
  severity: string;
  frequency: string;
  business_impact: string;
  affected_users: string;
  evidence: string;
  notes: string;
  created_at: string;
}

export interface DiscoveryProblemMapping {
  id: string;
  discovery_problem: string;
  capability: string;
  capability_name: string;
  capability_code: string;
  module_id: string;
  module_name: string;
  module_code: string;
  expected_kpi_impact: string;
  notes?: string;
  created_at: string;
}

export interface DiscoveryStakeholder {
  id: string;
  discovery: string;
  contact: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  contact_designation?: string;
  role_name: string;
  decision_role: 'DECISION_MAKER' | 'ECONOMIC_BUYER' | 'TECHNICAL_EVALUATOR' | 'INFLUENCER' | 'CHAMPION' | 'GATEKEEPER';
  responsibility?: string;
  involvement_level: 'HIGH' | 'MEDIUM' | 'LOW';
  notes?: string;
  created_at: string;
}

export interface DiscoveryChecklistItem {
  gate_code: string;
  name: string;
  description: string;
  status: 'COMPLETED' | 'MISSING' | 'BLOCKED';
  is_mandatory: boolean;
  missing_fields: string[];
}

export interface DiscoveryReadiness {
  is_ready: boolean;
  status: 'READY' | 'NOT_READY';
  missing_count: number;
  blocked_count: number;
  checklist: DiscoveryChecklistItem[];
  unmapped_problems: Array<{ id: string; name: string; severity: string }>;
}

export interface DiscoveryProblem {
  id: string;
  discovery: string;
  problem: string;
  problem_detail: {
    id: string;
    name: string;
    code: string;
    category: string;
    default_severity: string;
  };
  lead_problem?: string;
  refined_statement: string;
  category?: string;
  severity: string;
  frequency: string;
  impact_description: string;
  quantified_loss_value?: number;
  affected_teams?: string;
  evidence?: string;
  notes?: string;
  is_confirmed: boolean;
  capability_mappings: DiscoveryProblemMapping[];
  original_qualification_info?: {
    source_lead_problem_id: string;
    original_problem_name: string;
    original_category: string;
    original_severity: string;
    original_frequency: string;
    original_business_impact: string;
    original_affected_users: string;
    original_evidence: string;
    original_notes: string;
    qualified_at?: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface Discovery {
  id: string;
  lead?: string;
  account: string;
  account_name: string;
  product?: string;
  product_name?: string;
  product_code?: string;
  conducted_by?: string;
  conducted_by_name?: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';
  current_process_notes: string;
  business_impact_summary: string;
  stakeholders_involved_notes: string;
  decision_process_notes: string;
  timeline_notes: string;
  expected_decision_date?: string;
  expected_implementation_date?: string;
  budget_notes?: string;
  technical_constraints_notes?: string;
  evidence_notes?: string;
  next_action_description?: string;
  next_activity_due_at?: string;
  last_activity_at?: string;
  is_product_mapping_complete: boolean;
  completed_at?: string;
  problems?: DiscoveryProblem[];
  stakeholders?: DiscoveryStakeholder[];
  readiness?: DiscoveryReadiness;
  created_at: string;
  updated_at: string;
}

// Phase 6: Demo & POC Management Interfaces
export interface DemoParticipant {
  id: string;
  demo: string;
  contact?: string;
  contact_name?: string;
  contact_email?: string;
  user?: string;
  user_name?: string;
  name: string;
  email: string;
  participant_type: 'CUSTOMER' | 'INTERNAL';
  role_title: string;
  attended: boolean;
  notes: string;
  created_at: string;
}

export interface DemoUseCaseMapping {
  id: string;
  demo: string;
  discovery_problem?: string;
  problem_name?: string;
  problem_category?: string;
  lead_problem?: string;
  module?: string;
  module_name?: string;
  module_code?: string;
  capability?: string;
  capability_name?: string;
  capability_code?: string;
  notes: string;
  was_demonstrated: boolean;
  created_at: string;
}

export interface DemoChecklistItem {
  gate_code: string;
  name: string;
  description: string;
  status: 'COMPLETED' | 'MISSING' | 'BLOCKED';
  is_mandatory: boolean;
  missing_fields: string[];
}

export interface DemoReadiness {
  is_ready: boolean;
  status: 'READY' | 'NOT_READY';
  checklist: DemoChecklistItem[];
  missing_fields: string[];
}

export interface Demo {
  id: string;
  lead?: string;
  account: string;
  account_name: string;
  discovery?: string;
  opportunity?: string;
  product?: string;
  product_name?: string;
  product_code?: string;
  presenter?: string;
  presenter_name?: string;
  scheduled_at: string;
  conducted_at?: string;
  participants_notes?: string;
  demonstrated_use_cases?: any[];
  customer_feedback?: string;
  objections_raised?: string;
  customer_questions?: string;
  customer_response?: string;
  fit_assessment: 'STRONG' | 'MODERATE' | 'POOR';
  status: 'PLANNED' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NOT_REQUIRED';
  not_required_reason?: string;
  next_action_description?: string;
  next_action_due_at?: string;
  last_activity_at?: string;
  participants?: DemoParticipant[];
  use_cases?: DemoUseCaseMapping[];
  readiness?: DemoReadiness;
  is_required_in_pipeline?: boolean;
  created_at: string;
  updated_at: string;
}

export interface POCParticipant {
  id: string;
  poc: string;
  contact?: string;
  contact_name?: string;
  contact_email?: string;
  user?: string;
  user_name?: string;
  name: string;
  email: string;
  participant_type: 'CUSTOMER' | 'INTERNAL' | 'PILOT_USER' | 'ENGINEER';
  role_title: string;
  notes: string;
  created_at: string;
}

export interface POCSuccessCriterion {
  id: string;
  poc: string;
  name: string;
  category: string;
  measurement_baseline: string;
  expected_target: string;
  actual_result: string;
  is_met: boolean;
  notes: string;
  created_at: string;
}

export interface POCChecklistItem {
  gate_code: string;
  name: string;
  description: string;
  status: 'COMPLETED' | 'MISSING' | 'BLOCKED';
  is_mandatory: boolean;
  missing_fields: string[];
}

export interface POCReadiness {
  is_ready: boolean;
  status: 'READY' | 'NOT_READY';
  checklist: POCChecklistItem[];
  missing_fields: string[];
}

export interface POC {
  id: string;
  lead?: string;
  account: string;
  account_name: string;
  discovery?: string;
  opportunity?: string;
  product?: string;
  product_name?: string;
  product_code?: string;
  owner?: string;
  owner_name?: string;
  scope_description: string;
  success_criteria: string;
  baseline_metrics: Record<string, any>;
  baseline_notes?: string;
  result_metrics: Record<string, any>;
  results_summary?: string;
  geography_coverage: string;
  users_count: number;
  start_date: string;
  end_date: string;
  completed_at?: string;
  status: 'PLANNED' | 'APPROVED' | 'ACTIVE' | 'REVIEW' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'NOT_REQUIRED';
  not_required_reason?: string;
  is_successful: boolean;
  customer_feedback?: string;
  next_action_description?: string;
  next_action_due_at?: string;
  last_activity_at?: string;
  criteria_items?: POCSuccessCriterion[];
  participants?: POCParticipant[];
  readiness?: POCReadiness;
  is_required_in_pipeline?: boolean;
  created_at: string;
  updated_at: string;
}

export interface SQLHandoff {
  id: string;
  lead: string;
  company_name: string;
  product: string;
  product_name: string;
  pld_executive_name?: string;
  sales_owner_name?: string;
  gate_audit_results: Record<string, any>;
  sla_expires_at?: string;
  status: string;
  decision_date?: string;
  rejection_reason?: string;
  is_target_account?: boolean;
  target_tier?: string;
  source?: string;
  created_at: string;
}

export interface Opportunity {
  id: string;
  account: string;
  account_name: string;
  primary_contact_name?: string;
  owner_name?: string;
  opportunity_type: string;
  stage_name?: string;
  status: string;
  total_contract_value: number;
  currency: string;
  probability_pct: number;
  expected_close_date?: string;
  pld_score?: number;
  sql_date?: string;
  decision_maker?: string;
  implementation_scope?: string;
  erp_system?: string;
  integration_requirements?: string;
  poc_result?: string;
  last_activity_at?: string;
  next_activity_due_at?: string;
  next_action_description?: string;
  product_lines?: Array<{
    product_name: string;
    product_code: string;
    quantity: number;
    total_amount: number;
  }>;
}

export interface StageGateChecklist {
  all_passed: boolean;
  target_stage: string;
  checklist: Array<{
    gate_code: string;
    gate_name: string;
    is_mandatory: boolean;
    satisfied: boolean;
    missing: string[];
  }>;
}

export interface AttributionData {
  attribution_model: string;
  campaigns: Array<{
    id: string;
    campaign_code: string;
    name: string;
    channel: string;
    budget: number;
    spent: number;
    attributed_pipeline: number;
    attributed_revenue: number;
    touch_count: number;
    won_deals_count: number;
    roas: number;
  }>;
  channel_breakdown: Array<{
    channel: string;
    attributed_pipeline: number;
  }>;
  summary: {
    total_budget: number;
    total_spent: number;
    total_attributed_revenue: number;
    blended_roas: number;
  };
}

export interface LeakageVelocityData {
  funnel_stages: Array<{
    stage: string;
    count: number;
    conversion_rate: number;
    leakage_count: number;
    primary_drop_reason: string;
  }>;
  overall_funnel_efficiency_pct: number;
  average_sales_cycle_days: number;
  velocity_metrics: Array<{
    stage: string;
    avg_days: number;
    target_sla_days: number;
    status: 'OPTIMAL' | 'WARNING' | 'BREACHED';
  }>;
  active_sla_breaches: Array<{
    id: string;
    entity: string;
    account: string;
    type: string;
    elapsed_hours: number;
    max_hours: number;
    status: string;
    owner: string;
  }>;
  loss_reasons_breakdown: Array<{
    reason: string;
    percentage: number;
    count: number;
  }>;
}

export interface CommunicationMessage {
  id: string;
  channel: 'EMAIL' | 'WHATSAPP' | 'IN_APP_ALERT';
  recipient_name: string;
  recipient_address: string;
  lead_name?: string;
  account_name?: string;
  template_code: string;
  subject: string;
  body: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  provider: string;
  delivered_at?: string;
  created_at: string;
}

export interface ERPConnectorConfig {
  id: string;
  system_type: 'ODOO' | 'SAP_B1' | 'MS_DYNAMICS' | 'ZATCA';
  system_name: string;
  base_endpoint: string;
  auth_mode: string;
  api_key_masked: string;
  is_active: boolean;
  auto_sync_on_won: boolean;
  last_sync_timestamp?: string;
  sync_records_count: number;
}

export interface ERPSyncRecord {
  id: string;
  connector: string;
  system_name: string;
  system_type: string;
  entity_type: string;
  direction: string;
  crm_entity_id: string;
  crm_entity_name: string;
  erp_reference_id: string;
  status: 'SUCCESS' | 'PENDING_REVIEW' | 'CONFLICT_DETECTED' | 'FAILED';
  conflict_details: string;
  payload: Record<string, any>;
  response_payload: Record<string, any>;
  created_at: string;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `API request failed with status ${response.status}`);
  }
  return response.json();
}

export const api = {
  // Analytics
  getFunnelAnalytics: () => request<FunnelData>('/analytics/funnel/'),

  // Products
  getProducts: () => request<{ results: Product[] }>('/products/'),
  getProblems: () => request<{ results: any[] }>('/problems/'),

  // Configurations
  getConfigurations: () => request<{ results: any[] }>('/configurations/'),

  // Leads
  getLeads: () => request<{ results: Lead[] }>('/leads/'),
  getLead: (id: string) => request<Lead>(`/leads/${id}/`),
  createLead: (data: any) => request<Lead>('/leads/', { method: 'POST', body: JSON.stringify(data) }),
  checkDuplicates: (data: { company_name?: string; domain?: string; email?: string; phone?: string }) =>
    request<{ has_duplicates: boolean; duplicate_count: number; duplicates: any[] }>('/leads/check-duplicates/', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Phase 5: Discovery Workspace & Product Capability Mapping
  getDiscoveries: (params?: { lead?: string; account?: string; product?: string; status?: string }) => {
    const q = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<{ results: Discovery[] }>(`/discoveries/${q}`);
  },
  getDiscovery: (id: string) => request<Discovery>(`/discoveries/${id}/`),
  updateDiscovery: (id: string, data: Partial<Discovery>) =>
    request<Discovery>(`/discoveries/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  getDiscoveryReadiness: (id: string) =>
    request<DiscoveryReadiness>(`/discoveries/${id}/readiness/`),
  carryForwardDiscoveryProblems: (id: string) =>
    request<{ message: string; discovery: Discovery }>(`/discoveries/${id}/carry-forward/`, {
      method: 'POST'
    }),
  completeDiscovery: (id: string) =>
    request<{ message: string; discovery: Discovery }>(`/discoveries/${id}/complete/`, {
      method: 'POST'
    }),
  completeDiscoveryMapping: (discoveryId: string) =>
    request<{ message: string; discovery: Discovery }>(`/discoveries/${discoveryId}/complete/`, {
      method: 'POST'
    }),
  getDiscoveryAvailableCapabilities: (discoveryId: string) =>
    request<{
      product_id: string;
      product_name: string;
      product_code: string;
      modules: any[];
      capabilities: any[];
    }>(`/discoveries/${discoveryId}/available-capabilities/`),
  addDiscoveryStakeholder: (discoveryId: string, data: {
    contact_id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    designation?: string;
    role_name?: string;
    decision_role?: string;
    responsibility?: string;
    involvement_level?: string;
    notes?: string;
  }) =>
    request<DiscoveryStakeholder>(`/discoveries/${discoveryId}/add-stakeholder/`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  deleteDiscoveryStakeholder: (id: string) =>
    request<any>(`/discovery-stakeholders/${id}/`, {
      method: 'DELETE'
    }),
  updateDiscoveryProblem: (problemId: string, data: Partial<DiscoveryProblem>) =>
    request<DiscoveryProblem>(`/discovery-problems/${problemId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  toggleProblemConfirmed: (problemId: string, isConfirmed?: boolean) =>
    request<DiscoveryProblem>(`/discovery-problems/${problemId}/toggle-confirm/`, {
      method: 'POST',
      body: JSON.stringify({ is_confirmed: isConfirmed })
    }),
  mapDiscoveryCapability: (problemId: string, capabilityId: string, expectedKpi: string, notes?: string) =>
    request<DiscoveryProblemMapping>(`/discovery-problems/${problemId}/map-capability/`, {
      method: 'POST',
      body: JSON.stringify({
        capability_id: capabilityId,
        expected_kpi_impact: expectedKpi,
        notes: notes || ''
      })
    }),
  unmapDiscoveryCapability: (problemId: string, capabilityId: string) =>
    request<{ message: string }>(`/discovery-problems/${problemId}/unmap-capability/`, {
      method: 'POST',
      body: JSON.stringify({ capability_id: capabilityId })
    }),

  // SQL Handoffs
  getSQLHandoffs: () => request<{ results: SQLHandoff[] }>('/sql-handoffs/'),
  acceptSQLHandoff: (handoffId: string) =>
    request<{ message: string; opportunity_id: string }>(`/sql-handoffs/${handoffId}/accept/`, {
      method: 'POST'
    }),
  rejectSQLHandoff: (handoffId: string, reason: string, returnTarget: string = 'NURTURE') =>
    request<{ message: string; return_target: string }>(`/sql-handoffs/${handoffId}/reject/`, {
      method: 'POST',
      body: JSON.stringify({ rejection_reason: reason, return_target: returnTarget })
    }),

  // Gate & Transitions
  validateGate: (leadId: string, targetStageId: string) =>
    request<StageGateChecklist>('/configurations/validate-gate/', {
      method: 'POST',
      body: JSON.stringify({ lead_id: leadId, target_stage_id: targetStageId })
    }),

  transitionLeadStage: (leadId: string, targetStageId: string, reason?: string, isOverride: boolean = false) =>
    request<{ message: string; lead: Lead }>(`/leads/${leadId}/transition-stage/`, {
      method: 'POST',
      body: JSON.stringify({
        target_stage_id: targetStageId,
        transition_reason: reason,
        is_override: isOverride
      })
    }),

  // Phase 4: ICP Engine
  evaluateICP: (accountId: string, productId: string, leadId?: string) =>
    request<any>('/icp/evaluate/', {
      method: 'POST',
      body: JSON.stringify({ account_id: accountId, product_id: productId, lead_id: leadId })
    }),
  getICPProfiles: (productId?: string) =>
    request<ICPProfile[]>(`/icp/profiles/${productId ? `?product=${productId}` : ''}`),
  getICPRules: (productId?: string) =>
    request<ICPRule[]>(`/icp/rules/${productId ? `?product=${productId}` : ''}`),
  saveICPRule: (rule: Partial<ICPRule>) =>
    rule.id
      ? request<ICPRule>(`/icp-rules/${rule.id}/`, { method: 'PATCH', body: JSON.stringify(rule) })
      : request<ICPRule>('/icp-rules/', { method: 'POST', body: JSON.stringify(rule) }),

  // Phase 4: PLD Qualification & Scoring Engine
  evaluatePLDScore: (assessmentId: string, answers: Record<string, any>) =>
    request<any>('/pld/score/', {
      method: 'POST',
      body: JSON.stringify({ assessment_id: assessmentId, answers })
    }),
  assessPLD: (accountId: string, productId: string, leadId?: string, answers: Record<string, any> = {}) =>
    request<any>('/pld/assess/', {
      method: 'POST',
      body: JSON.stringify({ account_id: accountId, product_id: productId, lead_id: leadId, answers })
    }),
  getScoreModels: (productId?: string) =>
    request<ScoreModel[]>(`/pld/models/${productId ? `?product=${productId}` : ''}`),
  saveScoreModel: (model: Partial<ScoreModel>) =>
    model.id
      ? request<ScoreModel>(`/score-models/${model.id}/`, { method: 'PATCH', body: JSON.stringify(model) })
      : request<ScoreModel>('/score-models/', { method: 'POST', body: JSON.stringify(model) }),

  // Phase 4: Assessments & Authorized Score Override
  getAssessments: (params?: { account?: string; product?: string; lead?: string }) => {
    const q = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<AccountProductAssessment[]>(`/icp/assessments/${q}`);
  },
  getAssessmentById: (assessmentId: string) =>
    request<AccountProductAssessment>(`/assessments/${assessmentId}/`),
  overrideAssessment: (assessmentId: string, reason: string, newClassification?: string, newScore?: number) =>
    request<any>('/pld/override/', {
      method: 'POST',
      body: JSON.stringify({
        assessment_id: assessmentId,
        override_reason: reason,
        score_classification: newClassification,
        pld_score: newScore
      })
    }),

  // Phase 4: Dynamic Qualification Questionnaires
  getQuestionnaireForProduct: (productId: string) =>
    request<QuestionnaireTemplate>(`/questionnaires/product/${productId}/`),
  getQuestionnaires: () =>
    request<{ results: QuestionnaireTemplate[] }>('/questionnaires/'),
  getQuestionnaireQuestions: (templateId?: string) =>
    request<{ results: QuestionnaireQuestion[] }>(`/questionnaire-questions/${templateId ? `?template=${templateId}` : ''}`),
  saveQuestionnaireQuestion: (question: Partial<QuestionnaireQuestion>) =>
    question.id
      ? request<QuestionnaireQuestion>(`/questionnaire-questions/${question.id}/`, { method: 'PATCH', body: JSON.stringify(question) })
      : request<QuestionnaireQuestion>('/questionnaire-questions/', { method: 'POST', body: JSON.stringify(question) }),
  saveQuestionAnswerOption: (option: Partial<QuestionAnswerOption>) =>
    option.id
      ? request<QuestionAnswerOption>(`/question-options/${option.id}/`, { method: 'PATCH', body: JSON.stringify(option) })
      : request<QuestionAnswerOption>('/question-options/', { method: 'POST', body: JSON.stringify(option) }),

  // Phase 4: Documented Business Problems Capture
  getLeadProblems: (leadId: string) =>
    request<LeadProblemItem[]>(`/leads/${leadId}/problems/`),
  addLeadProblem: (leadId: string, problemData: {
    problem_name?: string;
    problem_code?: string;
    problem_id?: string;
    category?: string;
    severity?: string;
    frequency?: string;
    business_impact?: string;
    affected_users?: string;
    evidence?: string;
    notes?: string;
  }) =>
    request<LeadProblemItem>(`/leads/${leadId}/problems/`, {
      method: 'POST',
      body: JSON.stringify(problemData)
    }),

  // Accounts & Opportunities
  getAccounts: () => request<{ results: any[] }>('/accounts/'),
  createAccount: (data: any) => request<any>('/accounts/', { method: 'POST', body: JSON.stringify(data) }),
  getOpportunities: () => request<{ results: Opportunity[] }>('/opportunities/'),

  // Phase 3: Partner Portal & Deal Registration
  getPartners: () => request<{ results: any[] }>('/partners/'),
  getPartnerPortalDashboard: (partnerId?: string) =>
    request<any>(`/partner-portal/dashboard/${partnerId ? `?partner_id=${partnerId}` : ''}`),
  submitDealRegistration: (data: any) =>
    request<any>('/deal-registrations/', { method: 'POST', body: JSON.stringify(data) }),
  acceptDealRegistration: (id: string, protectionDays: number = 90) =>
    request<any>(`/deal-registrations/${id}/accept/`, { method: 'POST', body: JSON.stringify({ protection_days: protectionDays }) }),
  rejectDealRegistration: (id: string, reason: string) =>
    request<any>(`/deal-registrations/${id}/reject/`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Phase 6: Product-Configurable Demo Management
  getDemos: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ results: Demo[] }>(`/demos/${q}`);
  },
  getDemo: (id: string) =>
    request<Demo>(`/demos/${id}/`),
  createDemo: (data: Partial<Demo>) =>
    request<Demo>('/demos/', { method: 'POST', body: JSON.stringify(data) }),
  updateDemo: (id: string, data: Partial<Demo>) =>
    request<Demo>(`/demos/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  completeDemo: (id: string, data: { customer_feedback?: string; objections_raised?: string; customer_questions?: string; customer_response?: string; next_action_description?: string; next_action_due_at?: string; fit_assessment?: string }) =>
    request<any>(`/demos/${id}/complete/`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  markDemoNotRequired: (id: string, reason: string) =>
    request<any>(`/demos/${id}/mark-not-required/`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),
  getDemoReadiness: (id: string) =>
    request<DemoReadiness>(`/demos/${id}/readiness/`),
  addDemoParticipant: (demoId: string, data: Partial<DemoParticipant>) =>
    request<DemoParticipant>(`/demos/${demoId}/add-participant/`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  deleteDemoParticipant: (participantId: string) =>
    request<any>(`/demo-participants/${participantId}/`, {
      method: 'DELETE'
    }),
  mapDemoUseCase: (demoId: string, data: { discovery_problem_id?: string; capability_id?: string; notes?: string; was_demonstrated?: boolean }) =>
    request<DemoUseCaseMapping>(`/demos/${demoId}/map-use-case/`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  unmapDemoUseCase: (demoId: string, mappingId: string) =>
    request<{ message: string }>(`/demos/${demoId}/unmap-use-case/`, {
      method: 'POST',
      body: JSON.stringify({ mapping_id: mappingId })
    }),

  // Phase 6: Product-Configurable POC/Pilot Management
  getPOCs: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ results: POC[] }>(`/pocs/${q}`);
  },
  getPOC: (id: string) =>
    request<POC>(`/pocs/${id}/`),
  createPOC: (data: Partial<POC>) =>
    request<POC>('/pocs/', { method: 'POST', body: JSON.stringify(data) }),
  updatePOC: (id: string, data: Partial<POC>) =>
    request<POC>(`/pocs/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  completePOC: (id: string, data: { result_metrics?: Record<string, any>; results_summary?: string; customer_feedback?: string; is_successful?: boolean; next_action_description?: string; next_action_due_at?: string }) =>
    request<any>(`/pocs/${id}/complete/`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  markPOCNotRequired: (id: string, reason: string) =>
    request<any>(`/pocs/${id}/mark-not-required/`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),
  getPOCReadiness: (id: string) =>
    request<POCReadiness>(`/pocs/${id}/readiness/`),
  addPOCParticipant: (pocId: string, data: Partial<POCParticipant>) =>
    request<POCParticipant>(`/pocs/${pocId}/add-participant/`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  deletePOCParticipant: (participantId: string) =>
    request<any>(`/poc-participants/${participantId}/`, {
      method: 'DELETE'
    }),
  addPOCCriterion: (pocId: string, data: Partial<POCSuccessCriterion>) =>
    request<POCSuccessCriterion>(`/pocs/${pocId}/add-criterion/`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updatePOCCriterion: (criterionId: string, data: Partial<POCSuccessCriterion>) =>
    request<POCSuccessCriterion>(`/poc-criteria/${criterionId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  deletePOCCriterion: (criterionId: string) =>
    request<any>(`/poc-criteria/${criterionId}/`, {
      method: 'DELETE'
    }),

  // Activities & Mandatory Next Actions
  getActivities: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ results: any[] }>(`/activities/${q}`);
  },
  createActivity: (data: any) =>
    request<any>('/activities/', { method: 'POST', body: JSON.stringify(data) }),
  getRecordsMissingNextAction: () =>
    request<{ leads_missing_future_action: any[]; leads_overdue_action: any[]; opportunities_missing_future_action: any[]; total_alerts: number }>(
      '/activities/records-missing-next-action/'
    ),

  // Phase 3: Governance & Audit Trail
  getAuditLogs: () => request<{ results: any[] }>('/audit-logs/'),
  getApprovals: () => request<{ results: any[] }>('/approvals/'),

  // Phase 3: Multi-Touch Attribution & Campaign Ingestion
  getAttribution: (model: string = 'W_SHAPED') =>
    request<AttributionData>(`/integrations/attribution/?model=${model}`),
  submitInboundLead: (data: any) =>
    request<any>('/integrations/inbound-lead/', { method: 'POST', body: JSON.stringify(data) }),

  // Phase 3: Advanced Funnel Leakage & Pipeline Velocity
  getLeakageVelocity: () =>
    request<LeakageVelocityData>('/analytics/leakage-velocity/'),

  // Phase 3: Omni-Channel Communications Hub (Email & WhatsApp)
  getCommunications: () =>
    request<{ results: CommunicationMessage[] }>('/communications/'),
  sendTestCommunication: (data: { channel: 'EMAIL' | 'WHATSAPP'; recipient: string; template: string; lead_id?: string }) =>
    request<any>('/communications/send-test/', { method: 'POST', body: JSON.stringify(data) }),

  // Phase 3: ERP Customer Master Bi-Directional Sync Gateway
  getERPConnectors: () =>
    request<{ results: ERPConnectorConfig[] }>('/erp-connectors/'),
  getERPSyncLogs: () =>
    request<{ results: ERPSyncRecord[] }>('/erp-sync-logs/'),
  syncAccountToERP: (connectorId: string, accountId?: string) =>
    request<any>(`/erp-connectors/${connectorId}/sync-account/`, { method: 'POST', body: JSON.stringify({ account_id: accountId }) }),
  resolveERPConflict: (syncRecordId: string, resolution: string) =>
    request<any>('/erp-connectors/resolve-conflict/', { method: 'POST', body: JSON.stringify({ sync_record_id: syncRecordId, resolution }) }),
};
