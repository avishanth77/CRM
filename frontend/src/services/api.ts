const CANDIDATE_BASE_URLS = [
  import.meta.env.VITE_API_BASE,
  'http://localhost:8000/api/v1',
  'http://localhost:8001/api/v1',
].filter(Boolean) as string[];

let activeApiBase = CANDIDATE_BASE_URLS[0];
export const API_BASE = activeApiBase;

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  name: string;
  role: string;
  role_display: string;
  is_superuser: boolean;
  is_partner_user: boolean;
  is_active?: boolean;
  territory?: string;
  phone?: string;
  allowed_workspaces: string[];
  capabilities: {
    can_override_scores?: boolean;
    can_accept_sql?: boolean;
    can_publish_configs?: boolean;
    can_sync_erp?: boolean;
    can_view_audit?: boolean;
    can_manage_partners?: boolean;
    can_edit_proposals?: boolean;
  };
  partner_details?: {
    partner_id: string;
    partner_name: string;
    partner_role: string;
  } | null;
}

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
  description?: string;
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

export interface Territory {
  id: string;
  name: string;
  code: string;
  country: string;
  regional_manager?: string | null;
  regional_manager_name?: string | null;
  regional_manager_email?: string | null;
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface LeadSource {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface Industry {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}


export interface Account {
  id: string;
  company_name: string;
  legal_name?: string;
  trade_name?: string;
  account_type?: string;
  industry?: string;
  sub_industry?: string;
  country?: string;
  state?: string;
  city?: string;
  territory?: string;
  address?: string;
  company_size_band?: string;
  website?: string;
  domain?: string;
  phone?: string;
  employees_count?: number;
  distribution_centers_count?: number;
  is_target_account?: boolean;
  target_tier?: string;
  source?: string;
  partner?: string;
  partner_name?: string;
  primary_owner?: string;
  primary_owner_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Lead {
  id: string;
  account: string;
  account_name: string;
  account_country?: string;
  account_state?: string;
  account_city?: string;
  account_address?: string;
  territory?: string;
  contact?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_designation?: string;
  owner?: string;
  owner_name?: string;
  owner_email?: string;
  partner?: string;
  partner_name?: string;
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
  domain?: string;
  industry?: string;
  employees_count?: number;
  pld_score?: number | null;
  score_classification?: string | null;
  icp_knockout_passed?: boolean | null;
  icp_result?: 'PASS' | 'FAIL' | 'PENDING' | null;
  icp_fit_score?: number | null;
  icp_reasons?: string[];
  nurture_reason?: string;
  disqualification_reason?: string;
  source?: string;
  source_name?: string;
  touches?: any[];
  estimated_opportunity_value?: number;
  timeline_expectation?: string;
  created_at: string;
  updated_at?: string;
}

export interface LeadActionLog {
  id: string;
  action_type: string;
  action_category: string;
  title: string;
  timestamp: string;
  date_formatted: string;
  time_formatted: string;
  actor_name: string;
  actor_role: string;
  status: string;
  description: string;
  outcome?: string;
  details?: Record<string, any>;
  source: string;
}

export interface LeadActionLogsResponse {
  lead_id: string;
  account_name: string;
  total_actions: number;
  last_action_at?: string;
  logs: LeadActionLog[];
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
  is_overridden?: boolean;
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
  question?: string;
  code?: string;
  label: string;
  value?: string;
  order?: number;
  points?: number;
  score_value?: number;
  knockout_flag?: boolean;
  feeds_dimension?: string;
  is_active?: boolean;
}

export interface QuestionnaireQuestion {
  id: string;
  template?: string;
  code: string;
  question_text: string;
  question_type: string;
  category?: string;
  order: number;
  is_required: boolean;
  help_text?: string;
  feeds_dimension: string;
  weight?: number;
  dimension_weight_points?: number;
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
  gate_name?: string;
  details?: string;
  satisfied?: boolean;
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

export interface SQLReadinessGate {
  gate_code: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'MISSING' | 'BLOCKED';
  is_mandatory: boolean;
  description: string;
  evidence: string;
}

export interface SQLReadinessData {
  is_ready: boolean;
  status: 'READY' | 'NOT_READY';
  checklist: SQLReadinessGate[];
  missing_gates: string[];
  what_we_know: string[];
  what_is_missing: string[];
}

export interface SQLHandoff {
  id: string;
  lead: string;
  account?: string;
  company_name: string;
  contact_name?: string;
  product: string;
  product_name: string;
  pld_executive?: string;
  pld_executive_name?: string;
  assigned_sales_owner?: string;
  sales_owner_name?: string;
  previous_owner?: string;
  previous_owner_name?: string;
  ownership_transferred_at?: string;
  estimated_value: number;
  currency: string;
  readiness_status: string;
  qualification_evidence: {
    what_we_know?: string[];
    what_is_missing?: string[];
  };
  gate_audit_results: SQLReadinessGate[];
  is_override: boolean;
  override_reason?: string;
  override_approved_by?: string;
  override_approved_by_name?: string;
  override_approved_at?: string;
  original_gate_results?: any;
  sla_duration_hours: number;
  sql_ready_at?: string;
  submitted_at?: string;
  sla_expires_at?: string;
  is_sla_overdue: boolean;
  sla_remaining_hours: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  decision_date?: string;
  rejection_reason?: string;
  opportunity_id?: string;
  is_target_account?: boolean;
  target_tier?: string;
  source?: string;
  created_at: string;
  updated_at: string;
}

export interface OpportunityModuleItem {
  id: string;
  opportunity: string;
  module: string;
  module_name: string;
  module_code: string;
  is_included: boolean;
  notes?: string;
}

export interface OpportunityCapabilityItem {
  id: string;
  opportunity: string;
  capability: string;
  capability_name: string;
  capability_code: string;
  module_name: string;
}

export interface Opportunity {
  id: string;
  account: string;
  account_name: string;
  primary_contact?: string;
  primary_contact_name?: string;
  owner?: string;
  owner_name?: string;
  sql_handoff?: string;
  opportunity_type: 'NEW' | 'EXPANSION' | 'RENEWAL';
  stage?: string;
  stage_name?: string;
  stage_code?: string;
  status: 'OPEN' | 'WON' | 'LOST';
  product?: string;
  product_name?: string;
  product_code?: string;
  total_contract_value: number;
  arr: number;
  mrr: number;
  arr_mrr: number;
  pricing_plan?: string;
  seat_units_count: number;
  contract_term_months: number;
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
  competitor?: string;
  loss_reason_category?: string;
  loss_reason_notes?: string;
  last_activity_at?: string;
  next_activity_due_at?: string;
  next_action_description?: string;
  product_lines?: Array<{
    id?: string;
    product_name: string;
    product_code: string;
    quantity: number;
    unit_price?: number;
    total_amount: number;
  }>;
  selected_modules?: OpportunityModuleItem[];
  required_capabilities?: OpportunityCapabilityItem[];
  created_at: string;
  updated_at?: string;
}

export interface AccountProduct {
  id: string;
  account: string;
  account_name?: string;
  product: string;
  product_name?: string;
  product_code?: string;
  status: 'PROSPECT' | 'EVALUATION' | 'CUSTOMER' | 'INACTIVE' | 'EXPANSION';
  contract_value: number;
  arr_mrr: number;
  renewal_date?: string;
  health_score: number;
  created_at?: string;
  updated_at?: string;
}

// Phase 8: Proposal / Quote, Approvals, & Negotiation
export interface ProposalItem {
  id: string;
  product: string;
  product_name: string;
  module?: string;
  module_name?: string;
  capability?: string;
  capability_name?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  discount_amount: number;
  line_total: number;
}

export interface ProposalVersion {
  id: string;
  proposal: string;
  version_number: number;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SENT' | 'ACCEPTED' | 'EXPIRED' | 'SUPERSEDED';
  currency: string;
  valid_from?: string;
  valid_until?: string;
  gross_amount: number;
  discount_pct: number;
  discount_amount: number;
  discount_reason?: string;
  tax_pct: number;
  tax_amount: number;
  net_amount: number;
  contract_term_months: number;
  payment_terms: string;
  approval_required_flag: boolean;
  approval_request?: {
    id: string;
    approval_type: string;
    status: string;
    requested_by_name?: string;
    approver_name?: string;
    justification_notes?: string;
    decision_notes?: string;
    created_at: string;
    decision_date?: string;
  };
  proposal_document_url?: string;
  created_by?: string;
  created_by_name?: string;
  sent_at?: string;
  sent_by_name?: string;
  sent_to?: string;
  approved_at?: string;
  rejected_at?: string;
  notes?: string;
  items: ProposalItem[];
  is_expired?: boolean;
  created_at: string;
}

export interface Proposal {
  id: string;
  opportunity: string;
  account?: string;
  account_name?: string;
  primary_contact?: string;
  primary_contact_name?: string;
  product?: string;
  product_name?: string;
  proposal_number: string;
  title: string;
  owner?: string;
  owner_name?: string;
  version_number: number;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SENT' | 'ACCEPTED' | 'EXPIRED' | 'SUPERSEDED';
  currency: string;
  valid_from?: string;
  valid_until?: string;
  gross_amount: number;
  discount_pct: number;
  discount_amount: number;
  discount_reason?: string;
  tax_pct: number;
  tax_amount: number;
  net_amount: number;
  contract_term_months: number;
  payment_terms: string;
  approval_required_flag: boolean;
  proposal_document_url?: string;
  sent_at?: string;
  sent_by_name?: string;
  sent_to?: string;
  approved_at?: string;
  rejected_at?: string;
  notes?: string;
  current_version_details?: ProposalVersion;
  versions: ProposalVersion[];
  is_expired?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ApprovalRule {
  id: string;
  rule_name: string;
  product?: string;
  product_name?: string;
  rule_type: 'DISCOUNT_PERCENT' | 'TOTAL_VALUE' | 'PRICING_EXCEPTION' | 'COMMERCIAL_EXCEPTION';
  threshold_value: number;
  approver_role: string;
  approval_sequence: number;
  is_active: boolean;
  created_at: string;
}

// Phase 9: Unified Activities, Tasks, Notifications, SLA Engine, Work Queue
export type ActivityType =
  | 'CALL'
  | 'EMAIL'
  | 'WHATSAPP'
  | 'MEETING'
  | 'DISCOVERY'
  | 'DEMO'
  | 'POC'
  | 'FOLLOW_UP'
  | 'SITE_VISIT'
  | 'PARTNER_MEETING'
  | 'PROPOSAL_SENT'
  | 'PROPOSAL_REVIEW'
  | 'NEGOTIATION'
  | 'CUSTOM'
  | (string & {});

export type ActivityStatus = 'PLANNED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
export type NextActionStatus = 'NO_NEXT_ACTION' | 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON' | 'SCHEDULED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'URGENT';
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';
export type SLAStatus = 'WITHIN_SLA' | 'DUE_SOON' | 'AT_RISK' | 'BREACHED' | 'COMPLETED';

export interface Activity {
  id: string;
  account?: string;
  account_name?: string;
  contact?: string;
  contact_name?: string;
  lead?: string;
  lead_name?: string;
  opportunity?: string;
  opportunity_name?: string;
  proposal?: string;
  discovery?: string;
  demo?: string;
  poc?: string;
  activity_type: ActivityType;
  custom_activity_type?: string;
  subject: string;
  description_notes?: string;
  notes?: string;
  conducted_at: string;
  duration_minutes?: number;
  status: ActivityStatus;
  priority: TaskPriority;
  outcome_notes?: string;
  next_action_description?: string;
  next_action_due_at?: string;
  next_activity_due_at?: string;
  next_action_status?: NextActionStatus;
  performed_by?: string;
  performed_by_name?: string;
  assigned_to?: string;
  created_at: string;
}

export interface Task {
  id: string;
  assigned_to: string;
  assigned_to_name: string;
  created_by?: string;
  related_lead?: string;
  related_lead_title?: string;
  related_opportunity?: string;
  related_account?: string;
  related_account_name?: string;
  related_contact?: string;
  related_discovery?: string;
  related_demo?: string;
  related_poc?: string;
  related_proposal?: string;
  related_handoff?: string;
  source_activity?: string;
  title: string;
  description?: string;
  task_type: string;
  priority: TaskPriority;
  due_date: string;
  status: TaskStatus;
  is_completed: boolean;
  is_overdue: boolean;
  completed_at?: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  recipient: string;
  recipient_name: string;
  recipient_email: string;
  title: string;
  message: string;
  notification_type: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  is_read: boolean;
  read_at?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  action_url?: string;
  email_dispatched?: boolean;
  created_at: string;
}

export interface SLADefinition {
  id: string;
  name: string;
  entity_type: string;
  target_duration_hours: number;
  warning_threshold_pct: number;
  escalation_role: string;
  escalation_action: string;
  is_active: boolean;
  description?: string;
  created_at: string;
}

export interface SLATracker {
  id: string;
  definition: string;
  definition_name: string;
  entity_type: string;
  entity_id: string;
  assigned_user?: string;
  assigned_user_name?: string;
  start_time: string;
  due_time: string;
  completed_time?: string;
  status: SLAStatus;
  remaining_hours: number;
  is_escalated: boolean;
  escalated_at?: string;
  created_at: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger_type: string;
  is_active: boolean;
  conditions_json: Record<string, any>;
  action_type: string;
  action_config_json: Record<string, any>;
  last_run_at?: string;
  execution_count: number;
  created_at: string;
}

export interface WorkQueueData {
  role_view?: string;
  today?: {
    tasks: Task[];
    follow_ups_leads: Array<{
      id: string;
      account_id?: string | null;
      account_name: string;
      product_name: string;
      owner_name: string;
      status: string;
      next_action?: string;
      next_action_due?: string | null;
      created_at: string;
    }>;
    follow_ups_opps: Array<{
      id: string;
      account_id?: string | null;
      account_name: string;
      product_name: string;
      value: string;
      total_contract_value: number;
      owner_name: string;
      stage_name: string;
      status: string;
      next_action?: string;
      next_action_due?: string | null;
      created_at: string;
    }>;
    sql_acceptance: Array<{
      id: string;
      account_name: string;
      product_name: string;
      sales_owner: string;
      status: string;
      sla_expires_at?: string | null;
      is_sla_overdue: boolean;
      sla_remaining_hours: number;
      estimated_value: number;
    }>;
    scheduled_activities: Activity[];
    count: number;
  };
  overdue?: {
    tasks: Task[];
    follow_ups_leads: any[];
    follow_ups_opps: any[];
    sla_breaches: SLATracker[];
    count: number;
  };
  at_risk?: {
    slas_at_risk: SLATracker[];
    inactive_opportunities: any[];
    proposals_expiring: any[];
    count: number;
  };
  no_next_action?: {
    leads: any[];
    opportunities: any[];
    count: number;
  };
  upcoming?: {
    tasks: Task[];
    activities: Activity[];
    nurture_reengagement: any[];
    count: number;
  };
  overdue_tasks: Task[];
  due_today_tasks: Task[];
  upcoming_tasks: Task[];
  leads_missing_next_action: Array<{
    id: string;
    account_name: string;
    product_name: string;
    owner_name: string;
    status: string;
    created_at: string;
  }>;
  opportunities_missing_next_action: Array<{
    id: string;
    account_name: string;
    value: string;
    owner_name: string;
    status: string;
    created_at: string;
  }>;
  slas_at_risk: SLATracker[];
  counts: {
    today?: number;
    overdue: number;
    due_today: number;
    upcoming: number;
    no_next_action: number;
    sla_alerts: number;
  };
}

export interface ExecutiveAnalyticsData {
  period?: any;
  kpis: {
    target_accounts: number;
    total_leads: number;
    pld_qualified: number;
    sqls?: number;
    sql_count?: number;
    sales_accepted: number;
    opportunities?: number;
    opportunities_count?: number;
    open_opportunities?: number;
    won_opportunities?: number;
    lost_opportunities?: number;
    pipeline_value: number;
    weighted_pipeline: number;
    won_value: number;
    win_rate?: number;
    average_deal_size?: number;
    average_funnel_duration_days?: number;
    qualification_rate?: number;
    acceptance_rate?: number;
    currency?: string;
  };
  rates?: {
    lead_to_pld_rate?: number;
    pld_to_sql_rate?: number;
    sql_to_accepted_rate?: number;
    win_rate?: number;
    avg_funnel_duration_days?: number;
  };
  funnel?: Array<{
    stage_key: string;
    stage_name: string;
    sequence?: number;
    count: number;
    conversion_rate: number;
    drop_off_rate?: number;
    avg_days_in_stage?: number;
    dwell_days?: number;
  }>;
  funnel_stages?: Array<{
    stage_name: string;
    code: string;
    count: number;
    conversion_rate: number;
  }>;
  pipeline_by_stage?: Array<{ stage: string; value: number; count: number }>;
  pipeline_by_owner?: Array<{ owner: string; value: number; count: number }>;
  pipeline_by_product?: Array<{ product_name: string; product_code?: string; value?: number; count?: number; open_pipeline_value?: number; opportunities_count?: number }>;
  product_breakdown?: Array<{
    product_id?: string;
    product_code: string;
    product_name: string;
    leads_count: number;
    opportunities_count: number;
    open_pipeline_value: number;
    won_revenue: number;
  }>;
  pipeline_by_type?: Array<{ type: string; type_code?: string; value: number; count: number }>;
  activity_health?: {
    activities_today: number;
    activities_this_week: number;
    total_activities?: number;
    completed_activities?: number;
    completion_rate?: number;
    overdue_tasks: number;
  };
  sla_health?: {
    total?: number;
    total_slas?: number;
    met?: number;
    within_sla?: number;
    due_soon?: number;
    at_risk?: number;
    breached?: number;
    breached_sla?: number;
    compliance_rate?: number;
    sla_adherence_rate?: number;
  };
}

export interface PLDAnalyticsData {
  kpis: {
    total_leads: number;
    icp_pass_count: number;
    icp_fail_count: number;
    icp_pass_rate: number;
    qualified_count: number;
    qualification_rate: number;
    average_pld_score: number;
    nurture_count: number;
    disqualified_count: number;
  };
  score_distribution: Array<{
    range: string;
    label: string;
    count: number;
  }>;
  alerts: {
    leads_without_problems: number;
    leads_without_next_action: number;
  };
  stage_distribution: Array<{
    stage: string;
    count: number;
    avg_days_in_stage: number;
  }>;
  high_score_leads: Array<{
    id: string;
    company_name: string;
    product_name: string;
    stage: string;
    score: number;
    problems_count: number;
  }>;
}

export interface SalesAnalyticsData {
  kpis: {
    active_opportunities: number;
    pipeline_value: number;
    weighted_pipeline: number;
    won_count: number;
    lost_count: number;
    won_value: number;
    win_rate: number;
    arr: number;
    mrr: number;
    average_deal_size: number;
    average_sales_cycle_days: number;
  };
  by_stage: Array<{
    stage: string;
    value: number;
    weighted_value: number;
    count: number;
  }>;
  by_owner: Array<{
    owner: string;
    value: number;
    count: number;
  }>;
  by_product: Array<{
    product: string;
    value: number;
    count: number;
  }>;
  by_type: Array<{
    type: string;
    value: number;
    count: number;
  }>;
  by_close_month: Array<{
    month: string;
    value: number;
    count: number;
  }>;
  attention: {
    inactive_opportunities_count: number;
    inactive_opportunities: Array<{
      id: string;
      name: string;
      stage: string;
      value: number;
      owner: string;
      days_inactive: number;
    }>;
    overdue_activities: number;
    upcoming_activities: number;
    pending_proposals: number;
    sqls_awaiting_acceptance: number;
  };
}

export interface MarketingAnalyticsData {
  kpis: {
    total_leads: number;
    icp_pass_rate: number;
    qualification_rate: number;
    pipeline_value: number;
    won_value: number;
  };
  sources: Array<{
    source: string;
    leads: number;
    icp_pass_rate: number;
    qualification_rate: number;
    sqls: number;
    opportunities: number;
    pipeline: number;
    won_value: number;
  }>;
  campaigns: Array<{
    name: string;
    leads: number;
    budget: number;
    pipeline: number;
    won_value: number;
  }>;
}

export interface ProductAnalyticsData {
  products: Array<{
    id: string;
    name: string;
    code: string;
    leads: number;
    pld_qualified: number;
    sqls: number;
    opportunities: number;
    pipeline: number;
    won_count: number;
    won_value: number;
    conversion_rate: number;
    average_pld_score: number;
  }>;
  module_interest: Array<{
    name: string;
    product: string;
    count: number;
  }>;
  capability_demand: Array<{
    name: string;
    demand_count: number;
  }>;
}

export interface PartnerAnalyticsData {
  kpis: {
    total_partners: number;
    deal_registrations: number;
    approved_registrations: number;
    pending_registrations: number;
    partner_pipeline_value: number;
    partner_won_value: number;
    commissions_earned: number;
  };
  partner_list: Array<{
    id: string;
    name: string;
    tier: string;
    territory: string;
    deals: number;
    commission_pct: number;
  }>;
}

export interface ActivitySLAAnalyticsData {
  activities: {
    today: number;
    this_week: number;
    total: number;
    by_type: Array<{ type: string; count: number }>;
    by_owner: Array<{ owner: string; count: number }>;
  };
  tasks: {
    completed: number;
    overdue: number;
    upcoming: number;
  };
  sla: {
    within_sla: number;
    due_soon: number;
    at_risk: number;
    breached: number;
    compliance_rate: number;
    average_response_time_hours: number;
    average_acceptance_time_hours: number;
    overdue_records: Array<{
      id: string;
      rule_name: string;
      entity_type: string;
      entity_name: string;
      due_at: string;
      breached_by_hours: number;
      status: string;
    }>;
  };
  governance: {
    no_next_action_records: number;
  };
  bottlenecks: {
    highest_dropoff_stages: Array<{ stage: string; dropoff_rate: number }>;
    longest_duration_stages: Array<{ stage: string; avg_days: number }>;
    stuck_opportunities_count: number;
  };
}

export interface FunnelConversionData {
  stages: Array<{
    stage_key: string;
    stage_name: string;
    sequence: number;
    count: number;
    conversion_rate: number;
    drop_off_rate: number;
    avg_days_in_stage: number;
    dwell_days: number;
  }>;
  conversions: {
    lead_to_pld_qual: number;
    pld_to_sql: number;
    sql_to_sales_accepted: number;
    accepted_to_opportunity: number;
    opportunity_to_won: number;
    win_rate: number;
    loss_rate: number;
  };
  velocity: {
    avg_sales_cycle_days: number;
    avg_time_to_sql_days: number;
    avg_time_to_acceptance_days: number;
    avg_time_to_opportunity_days: number;
    avg_time_to_won_days: number;
  };
}

export interface OwnerPerformanceData {
  owners: Array<{
    id: string;
    name: string;
    leads: number;
    pld_qualified: number;
    sqls: number;
    sales_accepted: number;
    opportunities: number;
    pipeline: number;
    wins: number;
    won_value: number;
    activities: number;
    overdue_tasks: number;
  }>;
}

export interface ReportTableData {
  report_name: string;
  total_rows: number;
  current_page: number;
  total_pages: number;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, any>>;
}

export interface OperationalMetrics {
  activities_today: number;
  overdue_tasks: number;
  tasks_due_today: number;
  leads_no_next_action: number;
  opportunities_inactive: number;
  sla_at_risk: number;
  sla_breached: number;
  sql_acceptance_pending: number;
  proposal_expiry_alerts: number;
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

let isRefreshingToken = false;
let refreshSubscribers: Array<(token: string) => void> = [];
let lastAuthExpiredDispatch = 0;

function notifyAuthExpired() {
  const now = Date.now();
  if (now - lastAuthExpiredDispatch > 3000) {
    lastAuthExpiredDispatch = now;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('texol-auth-expired'));
    }
  }
}

function onTokenRefreshed(newToken: string) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('texol_access_token') || localStorage.getItem('access_token')) : null;
  const refreshToken = typeof localStorage !== 'undefined' ? localStorage.getItem('texol_refresh_token') : null;

  const authHeaders: Record<string, string> = {};
  const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/token');
  const isAuthBypassEndpoint = isAuthEndpoint || endpoint.includes('/auth/logout');
  if (token && !isAuthEndpoint) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders,
    ...(options.headers as Record<string, string> || {})
  };

  const basesToTry = [activeApiBase, ...CANDIDATE_BASE_URLS.filter((b) => b !== activeApiBase)];
  let lastError: any = null;

  for (const base of basesToTry) {
    try {
      const url = `${base}${endpoint}`;
      let response = await fetch(url, {
        credentials: 'include',
        ...options,
        headers
      });

      // Handle 401 Unauthorized: Attempt automatic token refresh
      if (response.status === 401 && refreshToken && !isAuthBypassEndpoint) {
        if (!isRefreshingToken) {
          isRefreshingToken = true;
          try {
            const refreshRes = await fetch(`${base}/auth/token/refresh/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh: refreshToken })
            });

            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              const newToken = refreshData.access;
              if (newToken) {
                localStorage.setItem('texol_access_token', newToken);
                onTokenRefreshed(newToken);
                headers['Authorization'] = `Bearer ${newToken}`;
                response = await fetch(url, {
                  credentials: 'include',
                  ...options,
                  headers
                });
              }
            } else {
              // Refresh failed / expired: clean session
              localStorage.removeItem('texol_access_token');
              localStorage.removeItem('texol_refresh_token');
              localStorage.removeItem('texol_auth_user');
              notifyAuthExpired();
            }
          } catch {
            // Network failure during refresh
          } finally {
            isRefreshingToken = false;
          }
        } else {
          // Wait for token refresh in-flight
          const retryPromise = new Promise<T>((resolve, reject) => {
            addRefreshSubscriber(async (newToken: string) => {
              try {
                headers['Authorization'] = `Bearer ${newToken}`;
                const retryRes = await fetch(url, {
                  credentials: 'include',
                  ...options,
                  headers
                });
                if (!retryRes.ok) throw new Error(`Retry failed with status ${retryRes.status}`);
                const data = await retryRes.json();
                resolve(data);
              } catch (retryErr) {
                reject(retryErr);
              }
            });
          });
          return retryPromise;
        }
      }

      if (!response.ok) {
        let errorMsg = null;
        try {
          const errorBody = await response.json();
          errorMsg = errorBody.error || errorBody.message || errorBody.detail || (typeof errorBody === 'string' ? errorBody : null);
        } catch {
          // ignore parsing error on error response
        }
        if (response.status === 401 && !isAuthBypassEndpoint) {
          localStorage.removeItem('texol_access_token');
          localStorage.removeItem('texol_refresh_token');
          localStorage.removeItem('texol_auth_user');
          notifyAuthExpired();
        }
        throw new Error(errorMsg || `API request failed with status ${response.status}`);
      }
      activeApiBase = base;
      if (response.status === 204 || response.status === 205) {
        return {} as T;
      }
      const rawText = await response.text();
      if (!rawText || !rawText.trim()) {
        return {} as T;
      }
      try {
        return JSON.parse(rawText);
      } catch {
        return {} as T;
      }
    } catch (err: any) {
      lastError = err;
      if (err.message && err.message.startsWith('API request failed')) {
        throw err;
      }
      if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
        throw err;
      }
      continue;
    }
  }

  throw lastError || new Error(`Network request to ${endpoint} failed across all candidate endpoints`);
}

export const api = {
  // Analytics
  getFunnelAnalytics: () => request<FunnelData>('/analytics/funnel/'),

  // Products
  getProducts: () => request<{ results: Product[] }>('/products/'),
  createProduct: (data: {
    name: string;
    code?: string;
    category?: string;
    description?: string;
    status?: string;
  }) => request<Product>('/products/', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: Partial<Product>) =>
    request<Product>(`/products/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProduct: (id: string) =>
    request<{ message?: string }>(`/products/${id}/`, { method: 'DELETE' }),
  getProblems: () => request<{ results: any[] }>('/problems/'),

  // Configurations
  getConfigurations: () => request<{ results: any[] }>('/configurations/'),

  // Leads
  getLeads: (params?: Record<string, any>) => {
    const q = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<{ results: Lead[] }>(`/leads/${q}`);
  },
  getLead: (id: string) => request<Lead>(`/leads/${id}/`),
  createLead: (data: any) => request<Lead>('/leads/', { method: 'POST', body: JSON.stringify(data) }),
  updateLead: (id: string, data: any) => request<Lead>(`/leads/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLead: (id: string) => request<{ message?: string }>(`/leads/${id}/`, { method: 'DELETE' }),

  // Lead Sources (Origination Channels)
  getLeadSources: () => request<LeadSource[] | { results: LeadSource[] }>('/sources/'),
  createLeadSource: (data: { name: string; code?: string; is_active?: boolean }) =>
    request<LeadSource>('/sources/', { method: 'POST', body: JSON.stringify(data) }),
  updateLeadSource: (id: string, data: Partial<LeadSource>) =>
    request<LeadSource>(`/sources/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLeadSource: (id: string) =>
    request<{ message?: string }>(`/sources/${id}/`, { method: 'DELETE' }),
  checkDuplicates: (data: { company_name?: string; domain?: string; email?: string; phone?: string }) =>
    request<{ has_duplicates: boolean; duplicate_count: number; duplicates: any[] }>('/leads/check-duplicates/', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getLeadActionLogs: (id: string) => request<LeadActionLogsResponse>(`/leads/${id}/action-logs/`),
  logLeadAction: (id: string, data: {
    action_type?: string;
    subject?: string;
    title?: string;
    conducted_at?: string;
    duration_minutes?: number;
    description_notes?: string;
    outcome_notes?: string;
    next_action_description?: string;
    next_activity_due_at?: string;
    status?: string;
    priority?: string;
  }) => request<{ message: string; activity_id: string; conducted_at: string; lead: Lead }>(`/leads/${id}/log-action/`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  restoreNurtureLead: (leadId: string) =>
    request<{ message: string; lead: Lead; moved_to?: string; queue_name?: string }>(`/leads/${leadId}/restore-active/`, {
      method: 'POST'
    }),
  moveToNurturePool: (leadId: string, data: { reason: string; status?: 'NURTURE' | 'DISQUALIFIED'; is_icp_failure?: boolean }) =>
    request<{ message: string; lead: Lead; moved_to?: string }>(`/leads/${leadId}/move-to-nurture/`, {
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

  // Phase 7: SQL Readiness & Sales Acceptance Handoff
  getSQLReadiness: (leadId: string, estimatedValue?: number) => {
    const q = estimatedValue !== undefined ? `&estimated_value=${estimatedValue}` : '';
    return request<SQLReadinessData>(`/sql-handoffs/readiness/?lead_id=${leadId}${q}`);
  },
  submitSQLHandoff: (data: {
    lead_id: string;
    estimated_value?: number;
    assigned_sales_owner_id?: string;
    sla_duration_hours?: number;
    is_override?: boolean;
    override_reason?: string;
  }) =>
    request<{ message: string; handoff: SQLHandoff }>('/sql-handoffs/submit/', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  overrideSQLHandoff: (handoffId: string, reason: string) =>
    request<{ message: string; handoff: SQLHandoff }>(`/sql-handoffs/${handoffId}/override/`, {
      method: 'POST',
      body: JSON.stringify({ override_reason: reason })
    }),
  getPendingSQLHandoffs: () =>
    request<SQLHandoff[]>('/sql-handoffs/pending/'),
  getSQLHandoffs: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ results: SQLHandoff[] }>(`/sql-handoffs/${q}`);
  },
  getSQLHandoff: (id: string) =>
    request<SQLHandoff>(`/sql-handoffs/${id}/`),
  acceptSQLHandoff: (handoffId: string, data?: { new_sales_owner_id?: string }) =>
    request<{ message: string; opportunity_id: string; handoff: SQLHandoff }>(`/sql-handoffs/${handoffId}/accept/`, {
      method: 'POST',
      body: JSON.stringify(data || {})
    }),
  rejectSQLHandoff: (
    handoffId: string,
    reasonOrPayload: string | { rejection_reason?: string; reason?: string; return_to_stage?: string; return_target?: string },
    returnTarget: string = 'NURTURE'
  ) => {
    let payload: { rejection_reason: string; return_target: string };
    if (typeof reasonOrPayload === 'string') {
      payload = { rejection_reason: reasonOrPayload, return_target: returnTarget };
    } else {
      payload = {
        rejection_reason: reasonOrPayload.rejection_reason || reasonOrPayload.reason || '',
        return_target: reasonOrPayload.return_to_stage || reasonOrPayload.return_target || returnTarget
      };
    }
    return request<{ message: string; return_target: string; handoff: SQLHandoff }>(`/sql-handoffs/${handoffId}/reject/`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  getSQLHandoffHistory: (handoffId: string) =>
    request<{ handoff_id: string; gate_audit_results: any; original_gate_results: any; qualification_evidence: any; stage_history: any[] }>(`/sql-handoffs/${handoffId}/history/`),

  // Phase 7: Commercial Opportunity Management
  getOpportunities: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ results: Opportunity[] }>(`/opportunities/${q}`);
  },
  getOpportunity: (id: string) =>
    request<Opportunity>(`/opportunities/${id}/`),
  createOpportunityFromSQL: (sqlHandoffId: string) =>
    request<{ message: string; opportunity: Opportunity }>('/opportunities/create-from-sql/', {
      method: 'POST',
      body: JSON.stringify({ sql_handoff_id: sqlHandoffId })
    }),
  updateOpportunity: (id: string, data: Partial<Opportunity>) =>
    request<Opportunity>(`/opportunities/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  updateOpportunityCommercials: (id: string, data: Partial<Opportunity>) =>
    request<{ message: string; opportunity: Opportunity }>(`/opportunities/${id}/update-commercials/`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  transitionOpportunityStage: (
    id: string,
    targetStageIdOrPayload: string | { target_stage_id: string; transition_reason?: string; reason?: string },
    reason?: string
  ) => {
    let payload: { target_stage_id: string; reason?: string };
    if (typeof targetStageIdOrPayload === 'string') {
      payload = { target_stage_id: targetStageIdOrPayload, reason };
    } else {
      payload = {
        target_stage_id: targetStageIdOrPayload.target_stage_id,
        reason: targetStageIdOrPayload.transition_reason || targetStageIdOrPayload.reason || reason
      };
    }
    return request<{ message: string; opportunity: Opportunity }>(`/opportunities/${id}/transition-stage/`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  logOpportunityActivity: (opportunityId: string, data: any) =>
    request<any>('/activities/', {
      method: 'POST',
      body: JSON.stringify({ opportunity: opportunityId, ...data })
    }),
  getOpportunityActivities: (id: string) =>
    request<any[]>(`/opportunities/${id}/activities/`),
  getOpportunityHistory: (id: string) =>
    request<any[]>(`/opportunities/${id}/history/`),
  markOpportunityWon: (id: string) =>
    request<{ message: string; opportunity: Opportunity }>(`/opportunities/${id}/mark-won/`, {
      method: 'POST'
    }),
  markOpportunityLost: (id: string, category: string, notes?: string, competitor?: string) =>
    request<Opportunity>(`/opportunities/${id}/mark-lost/`, {
      method: 'POST',
      body: JSON.stringify({ loss_reason_category: category, loss_reason_notes: notes, competitor })
    }),
  transitionOpportunityToNegotiation: (id: string, reason?: string) =>
    request<{ message: string; opportunity: Opportunity }>(`/opportunities/${id}/to-negotiation/`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),
  reEngageOpportunity: (id: string, data?: { reason?: string; stage_code?: string }) =>
    request<{ message: string; opportunity: Opportunity }>(`/opportunities/${id}/re-engage/`, {
      method: 'POST',
      body: JSON.stringify(data || {})
    }),
  getOpportunityProposals: (id: string) =>
    request<Proposal[]>(`/opportunities/${id}/proposals/`),

  // Phase 8: Commercial Proposal / Quote & Approvals
  getProposals: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ results: Proposal[] }>(`/proposals/${q}`);
  },
  getProposal: (id: string) =>
    request<Proposal>(`/proposals/${id}/`),
  createProposal: (data: any) =>
    request<Proposal>('/proposals/', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  createProposalVersion: (proposalId: string, data: any) =>
    request<{ message: string; proposal: Proposal; version: ProposalVersion }>(`/proposals/${proposalId}/create-version/`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  sendProposal: (
    proposalId: string,
    data?: {
      version_number?: number;
      recipient_email?: string;
      next_action_description?: string;
      next_activity_due_at?: string;
    }
  ) =>
    request<{ message: string; proposal: Proposal }>(`/proposals/${proposalId}/send/`, {
      method: 'POST',
      body: JSON.stringify(data || {})
    }),
  requestProposalApproval: (proposalId: string, data?: { version_number?: number; reason?: string }) =>
    request<{ message: string; proposal: Proposal }>(`/proposals/${proposalId}/request-approval/`, {
      method: 'POST',
      body: JSON.stringify(data || {})
    }),
  approveProposal: (proposalId: string, data?: { version_number?: number; comments?: string; user_id?: string; user_email?: string }) => {
    let authPayload: Record<string, any> = {};
    const authUserStr = typeof localStorage !== 'undefined' ? localStorage.getItem('texol_auth_user') : null;
    if (authUserStr) {
      try {
        const u = JSON.parse(authUserStr);
        if (u?.id) authPayload.user_id = u.id;
        if (u?.email) authPayload.user_email = u.email;
      } catch {
        // ignore
      }
    }
    return request<{ message: string; proposal: Proposal }>(`/proposals/${proposalId}/approve/`, {
      method: 'POST',
      body: JSON.stringify({ ...authPayload, ...(data || {}) })
    });
  },
  rejectProposal: (proposalId: string, data: { rejection_reason: string; version_number?: number; user_id?: string; user_email?: string }) => {
    let authPayload: Record<string, any> = {};
    const authUserStr = typeof localStorage !== 'undefined' ? localStorage.getItem('texol_auth_user') : null;
    if (authUserStr) {
      try {
        const u = JSON.parse(authUserStr);
        if (u?.id) authPayload.user_id = u.id;
        if (u?.email) authPayload.user_email = u.email;
      } catch {
        // ignore
      }
    }
    return request<{ message: string; proposal: Proposal }>(`/proposals/${proposalId}/reject/`, {
      method: 'POST',
      body: JSON.stringify({ ...authPayload, ...data })
    });
  },
  expireProposal: (proposalId: string, versionNumber?: number) =>
    request<{ message: string; proposal: Proposal }>(`/proposals/${proposalId}/expire/`, {
      method: 'POST',
      body: JSON.stringify({ version_number: versionNumber })
    }),
  syncProposalSeats: (proposalId: string, data?: { version_number?: number; quantity?: number; unit_price?: number }) =>
    request<{ message: string; proposal: Proposal }>(`/proposals/${proposalId}/sync-seats/`, {
      method: 'POST',
      body: JSON.stringify(data || {})
    }),
  updateProposalItem: (itemId: string, data: Partial<ProposalItem>) =>
    request<ProposalItem>(`/proposal-items/${itemId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  getProposalHistory: (proposalId: string) =>
    request<any[]>(`/proposals/${proposalId}/history/`),
  getApprovalRules: () =>
    request<{ results: ApprovalRule[] }>('/approval-rules/'),
  createApprovalRule: (data: Partial<ApprovalRule>) =>
    request<ApprovalRule>('/approval-rules/', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Gate & Transitions
  validateGate: (leadId: string, targetStageId: string) =>
    request<StageGateChecklist>('/configurations/validate-gate/', {
      method: 'POST',
      body: JSON.stringify({ lead_id: leadId, target_stage_id: targetStageId })
    }),

  transitionLeadStage: (
    leadId: string,
    targetStageId: string,
    reason?: string,
    isOverride: boolean = false,
    emailOptions?: {
      send_stage_email?: boolean;
      custom_email_subject?: string;
      custom_email_body?: string;
      custom_recipient_email?: string;
    },
    assignedSalesOwnerId?: string
  ) =>
    request<{ message: string; lead: Lead; stage_email?: any }>(`/leads/${leadId}/transition-stage/`, {
      method: 'POST',
      body: JSON.stringify({
        target_stage_id: targetStageId,
        transition_reason: reason,
        is_override: isOverride,
        assigned_sales_owner_id: assignedSalesOwnerId,
        ...(emailOptions || {})
      })
    }),

  assignLeadSalesOwner: (
    leadId: string,
    data: {
      sales_user_id: string;
      notes?: string;
      schedule_task?: boolean;
    }
  ) =>
    request<{ message: string; lead: Lead; assigned_user: any }>(`/leads/${leadId}/assign-sales/`, {
      method: 'POST',
      body: JSON.stringify(data)
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
  deleteICPRule: (id: string) =>
    request<any>(`/icp-rules/${id}/`, { method: 'DELETE' }),
  saveICPProfile: (profile: Partial<ICPProfile>) =>
    profile.id
      ? request<ICPProfile>(`/icp-profiles/${profile.id}/`, { method: 'PATCH', body: JSON.stringify(profile) })
      : request<ICPProfile>('/icp-profiles/', { method: 'POST', body: JSON.stringify(profile) }),

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
  addQuestionOption: (questionId: string, label: string, points: number = 50, value?: string) =>
    request<QuestionAnswerOption>('/question-options/', {
      method: 'POST',
      body: JSON.stringify({
        question: questionId,
        label,
        value: value || label,
        points
      })
    }),
  deleteQuestionOption: (optionId: string) =>
    request<any>(`/question-options/${optionId}/`, { method: 'DELETE' }),
  deleteQuestionnaireQuestion: (questionId: string) =>
    request<any>(`/questionnaire-questions/${questionId}/`, { method: 'DELETE' }),

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

  // Accounts, Contacts & Opportunities
  getAccounts: () => request<{ results: any[] }>('/accounts/'),
  getAccount: (id: string) => request<any>(`/accounts/${id}/`),
  createAccount: (data: any) => request<any>('/accounts/', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id: string, data: any) => request<any>(`/accounts/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  getContacts: (accountId?: string) => request<{ results: any[] }>(`/contacts/${accountId ? `?account=${accountId}` : ''}`),
  getContact: (id: string) => request<any>(`/contacts/${id}/`),
  createContact: (data: any) => request<any>('/contacts/', { method: 'POST', body: JSON.stringify(data) }),
  updateContact: (id: string, data: any) => request<any>(`/contacts/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  upsertAccountAttributes: (accountId: string, productId: string, attributes: Record<string, any>) =>
    request<any>(`/accounts/${accountId}/upsert-attributes/`, {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, attributes })
    }),
  createRenewalOpportunity: (accountId: string, data: { product_id?: string; opportunity_type?: 'RENEWAL' | 'EXPANSION'; value?: number; term_months?: number; notes?: string }) =>
    request<{ message: string; opportunity: Opportunity }>(`/accounts/${accountId}/create-renewal-opportunity/`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getAccountProducts: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ results: AccountProduct[] }>(`/account-products/${q}`);
  },
  updateAccountProduct: (id: string, data: Partial<AccountProduct>) =>
    request<AccountProduct>(`/account-products/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

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
  initPOC: (leadId?: string, accountId?: string) =>
    request<POC>('/pocs/init/', {
      method: 'POST',
      body: JSON.stringify({ lead_id: leadId, account_id: accountId })
    }),
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
    return request<{ results: Activity[] }>(`/activities/${q}`);
  },
  createActivity: (data: Partial<Activity>) =>
    request<Activity>('/activities/', { method: 'POST', body: JSON.stringify(data) }),
  completeActivity: (id: string, data?: any) =>
    request<Activity>(`/activities/${id}/complete/`, { method: 'POST', body: JSON.stringify(data || {}) }),
  cancelActivity: (id: string) =>
    request<Activity>(`/activities/${id}/cancel/`, { method: 'POST' }),
  getRecordsMissingNextAction: () =>
    request<{ leads_missing_future_action: any[]; leads_overdue_action: any[]; opportunities_missing_future_action: any[]; total_alerts: number }>(
      '/activities/records-missing-next-action/'
    ),

  // Tasks Management
  getTasks: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ results: Task[] }>(`/tasks/${q}`);
  },
  createTask: (data: Partial<Task>) =>
    request<Task>('/tasks/', { method: 'POST', body: JSON.stringify(data) }),
  completeTask: (id: string) =>
    request<Task>(`/tasks/${id}/complete/`, { method: 'POST' }),
  cancelTask: (id: string) =>
    request<Task>(`/tasks/${id}/cancel/`, { method: 'POST' }),

  // Centralized Notifications
  getNotifications: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ results: NotificationItem[] }>(`/notifications/${q}`);
  },
  markNotificationRead: (id: string) =>
    request<any>(`/notifications/${id}/mark-read/`, { method: 'POST' }),
  markAllNotificationsRead: () =>
    request<any>('/notifications/mark-all-read/', { method: 'POST' }),
  getUnreadNotificationCount: () =>
    request<{ unread_count: number }>('/notifications/unread-count/'),

  // Configurable SLA Engine
  getSLADefinitions: () =>
    request<{ results: SLADefinition[] }>('/sla-definitions/'),
  getSLATrackers: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ results: SLATracker[] }>(`/sla-trackers/${q}`);
  },
  evaluateSLAs: () =>
    request<any>('/sla-trackers/evaluate-all/', { method: 'POST' }),

  // Configurable Automation Rules
  getAutomationRules: () =>
    request<{ results: AutomationRule[] }>('/automation-rules/'),
  runAutomations: () =>
    request<any>('/automation-rules/run-all/', { method: 'POST' }),

  // Operational Work Queue & Dashboard Metrics
  getWorkQueue: (roleView?: string) => {
    const q = roleView ? `?role_view=${encodeURIComponent(roleView)}` : '';
    return request<WorkQueueData>(`/work-queue/${q}`);
  },
  rescheduleWorkQueueTask: (taskId: string, newDueDate: string, reason?: string) =>
    request<any>('/work-queue/action/reschedule-task/', {
      method: 'POST',
      body: JSON.stringify({ task_id: taskId, new_due_date: newDueDate, reason })
    }),
  scheduleWorkQueueNextAction: (data: { entity_type: 'LEAD' | 'OPPORTUNITY'; entity_id: string; description: string; due_date: string; activity_type?: string }) =>
    request<any>('/work-queue/action/schedule-next-action/', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getOperationalMetrics: () =>
    request<OperationalMetrics>('/operational-metrics/'),

  // Phase 10: Dedicated Analytics Dashboards
  getExecutiveAnalytics: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<ExecutiveAnalyticsData>(`/analytics/executive/${q}`);
  },
  getPLDAnalytics: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<PLDAnalyticsData>(`/analytics/pld/${q}`);
  },
  getSalesAnalytics: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<SalesAnalyticsData>(`/analytics/sales/${q}`);
  },
  getMarketingAnalytics: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<MarketingAnalyticsData>(`/analytics/marketing/${q}`);
  },
  getProductAnalytics: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<ProductAnalyticsData>(`/analytics/product/${q}`);
  },
  getPartnerAnalytics: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<PartnerAnalyticsData>(`/analytics/partner/${q}`);
  },
  getActivitySLAAnalytics: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<ActivitySLAAnalyticsData>(`/analytics/activity-sla/${q}`);
  },
  getFunnelConversions: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<FunnelConversionData>(`/analytics/funnel-conversions/${q}`);
  },
  getOwnerPerformance: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<OwnerPerformanceData>(`/analytics/owners/${q}`);
  },

  // Phase 10: Standard Reports & CSV Export
  getReportTable: (params: Record<string, any>) => {
    const q = '?' + new URLSearchParams(params as Record<string, string>).toString();
    return request<ReportTableData>(`/analytics/reports/${q}`);
  },
  getReportCSVDownloadUrl: (params: Record<string, any>) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return `${activeApiBase}/analytics/reports/export/?${query}`;
  },

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
  sendTestCommunication: (data: { channel: 'EMAIL' | 'WHATSAPP'; recipient: string; template: string; lead_id?: string; subject?: string; body?: string }) =>
    request<any>('/communications/send-test/', { method: 'POST', body: JSON.stringify(data) }),
  getStageTemplates: () =>
    request<Array<{ key: string; stage_name: string; subject: string; body_preview: string }>>('/communications/stage-templates/'),

  // Customer Stage Notification Emails
  getLeadStageEmailPreview: (leadId: string, stageId?: string, status?: string) => {
    const q = new URLSearchParams();
    if (stageId) q.append('stage_id', stageId);
    if (status) q.append('status', status);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{
      template_code: string;
      stage_name: string;
      recipient_name: string;
      recipient_email: string | null;
      has_recipient_email: boolean;
      company_name: string;
      product_name: string;
      sales_rep_name: string;
      sales_rep_email: string;
      subject: string;
      body: string;
    }>(`/leads/${leadId}/stage-email-preview/${qs}`);
  },
  sendLeadStageEmail: (leadId: string, data?: {
    stage_id?: string;
    subject?: string;
    body?: string;
    recipient_email?: string;
    status?: string;
  }) =>
    request<{
      success: boolean;
      email_sent: boolean;
      message_id: string;
      status: string;
      recipient_name: string;
      recipient_email: string | null;
      subject: string;
      stage_code: string;
      stage_name: string;
      error_message?: string;
    }>(`/leads/${leadId}/send-stage-email/`, {
      method: 'POST',
      body: JSON.stringify(data || {})
    }),
  getOpportunityStageEmailPreview: (oppId: string, stageId?: string, status?: string) => {
    const q = new URLSearchParams();
    if (stageId) q.append('stage_id', stageId);
    if (status) q.append('status', status);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{
      template_code: string;
      stage_name: string;
      recipient_name: string;
      recipient_email: string | null;
      has_recipient_email: boolean;
      company_name: string;
      product_name: string;
      sales_rep_name: string;
      sales_rep_email: string;
      subject: string;
      body: string;
    }>(`/opportunities/${oppId}/stage-email-preview/${qs}`);
  },
  sendOpportunityStageEmail: (oppId: string, data?: {
    stage_id?: string;
    subject?: string;
    body?: string;
    recipient_email?: string;
    status?: string;
  }) =>
    request<{
      success: boolean;
      email_sent: boolean;
      message_id: string;
      status: string;
      recipient_name: string;
      recipient_email: string | null;
      subject: string;
      stage_code: string;
      stage_name: string;
      error_message?: string;
    }>(`/opportunities/${oppId}/send-stage-email/`, {
      method: 'POST',
      body: JSON.stringify(data || {})
    }),

  // Phase 3: ERP Customer Master Bi-Directional Sync Gateway
  getERPConnectors: () =>
    request<{ results: ERPConnectorConfig[] }>('/erp-connectors/'),
  getERPSyncLogs: () =>
    request<{ results: ERPSyncRecord[] }>('/erp-sync-logs/'),
  syncAccountToERP: (connectorId: string, accountId?: string) =>
    request<any>(`/erp-connectors/${connectorId}/sync-account/`, { method: 'POST', body: JSON.stringify({ account_id: accountId }) }),
  resolveERPConflict: (syncRecordId: string, resolution: string) =>
    request<any>('/erp-connectors/resolve-conflict/', { method: 'POST', body: JSON.stringify({ sync_record_id: syncRecordId, resolution }) }),

  // Pipeline Stages
  getPipelineStages: () =>
    request<{ results: any[] }>('/stages/'),

  // Authentication & Role-Based Authorization
  login: (data: { username: string; password: string }) =>
    request<{ message: string; user: AuthUser; access?: string; refresh?: string; tokens?: { access: string; refresh: string } }>('/auth/login/', { method: 'POST', body: JSON.stringify(data) }),
  obtainToken: (data: { username?: string; email?: string; password: string }) =>
    request<{ access: string; refresh: string; user?: AuthUser }>('/auth/token/', { method: 'POST', body: JSON.stringify(data) }),
  refreshToken: (refresh: string) =>
    request<{ access: string }>('/auth/token/refresh/', { method: 'POST', body: JSON.stringify({ refresh }) }),
  verifyToken: (token: string) =>
    request<Record<string, any>>('/auth/token/verify/', { method: 'POST', body: JSON.stringify({ token }) }),
  logout: () => {
    const refresh = typeof localStorage !== 'undefined' ? localStorage.getItem('texol_refresh_token') : null;
    return request<{ message: string }>('/auth/logout/', {
      method: 'POST',
      body: JSON.stringify({ refresh })
    }).catch(() => ({ message: 'Logged out' }));
  },
  getCurrentUser: () =>
    request<AuthUser>('/auth/me/'),
  changePassword: (data: { current_password: string; new_password: string; confirm_password?: string }) =>
    request<{ message: string }>('/auth/password-change/', { method: 'POST', body: JSON.stringify(data) }),
  getUsers: () =>
    request<{ results: AuthUser[] }>('/users/'),

  // Staff & Partner Administration (Admin Only)
  getStaffUsers: () =>
    request<{ count: number; results: AuthUser[] }>('/admin/staff/'),
  createStaffUser: (data: {
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    password?: string;
    territory?: string;
    phone?: string;
  }) =>
    request<{ message: string; user: AuthUser }>('/admin/staff/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteStaffUser: (userId: string) =>
    request<{ message: string }>(`/admin/staff/${userId}/`, {
      method: 'DELETE',
    }),
  updateStaffUser: (userId: string, data: Partial<AuthUser> & { password?: string; manager_id?: string }) =>
    request<{ message: string; user: AuthUser }>(`/admin/staff/${userId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Territories & Geographic Regions (Admin & Regional Scoping)
  getTerritories: (activeOnly = false) =>
    request<{ count: number; results: Territory[] } | Territory[]>(
      `/territories/${activeOnly ? '?active_only=true' : ''}`
    ),
  createTerritory: (data: Partial<Territory>) =>
    request<Territory>('/territories/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTerritory: (id: string, data: Partial<Territory>) =>
    request<Territory>(`/territories/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteTerritory: (id: string) =>
    request<{ message: string }>(`/territories/${id}/`, {
      method: 'DELETE',
    }),

  // Master Industries & Vertical Sectors
  getIndustries: (includeInactive = false) =>
    request<{ count: number; results: Industry[] } | Industry[]>(
      `/industries/${includeInactive ? '?include_inactive=true' : ''}`
    ),
  createIndustry: (data: { name: string; code?: string; description?: string }) =>
    request<Industry>('/industries/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateIndustry: (id: string, data: Partial<Industry>) =>
    request<Industry>(`/industries/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteIndustry: (id: string) =>
    request<{ message: string }>(`/industries/${id}/`, {
      method: 'DELETE',
    }),
  createPartnerAdmin: (data: {
    company_name: string;
    domain?: string;
    partner_code: string;
    partner_type: string;
    territory?: string;
    status?: string;
    contact_name?: string;
    contact_email?: string;
    contact_password?: string;
    partner_role?: string;
  }) =>
    request<{ message: string; partner: any }>('/partners/admin-create/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  addPartnerUser: (
    partnerId: string,
    data: {
      first_name: string;
      last_name: string;
      email: string;
      password?: string;
      partner_role?: string;
    }
  ) =>
    request<{ message: string; partner: any }>(`/partners/${partnerId}/add-user/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePartner: (partnerId: string, data: any) =>
    request<{ message?: string; partner: any }>(`/partners/${partnerId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deletePartner: (partnerId: string) =>
    request<{ message: string }>(`/partners/${partnerId}/`, {
      method: 'DELETE',
    }),
  deactivatePartner: (partnerId: string, reason?: string) =>
    request<{ message: string; partner: any }>(`/partners/${partnerId}/deactivate/`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  activatePartner: (partnerId: string, reason?: string) =>
    request<{ message: string; partner: any }>(`/partners/${partnerId}/activate/`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};
