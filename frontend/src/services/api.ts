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

export interface Discovery {
  id: string;
  lead: string;
  account: string;
  account_name: string;
  current_process_notes: string;
  business_impact_summary: string;
  stakeholders_involved_notes: string;
  decision_process_notes: string;
  timeline_notes: string;
  is_product_mapping_complete: boolean;
  completed_at?: string;
  problems?: Array<{
    id: string;
    problem: string;
    problem_detail: {
      name: string;
      category: string;
      default_severity: string;
      capability_mappings?: Array<{
        capability_name: string;
        module_name: string;
        expected_kpi_impact: string;
      }>;
    };
    severity: string;
    frequency: string;
    impact_description: string;
  }>;
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

  // Discovery
  getDiscoveries: () => request<{ results: Discovery[] }>('/discoveries/'),
  getDiscovery: (id: string) => request<Discovery>(`/discoveries/${id}/`),
  completeDiscoveryMapping: (discoveryId: string) =>
    request<{ message: string; discovery: Discovery }>(`/discoveries/${discoveryId}/complete-mapping/`, {
      method: 'POST'
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

  // ICP & PLD Scoring
  evaluateICP: (accountId: string, productId: string, leadId?: string) =>
    request<any>('/configurations/evaluate-icp/', {
      method: 'POST',
      body: JSON.stringify({ account_id: accountId, product_id: productId, lead_id: leadId })
    }),

  evaluatePLDScore: (assessmentId: string, answers: Record<string, any>) =>
    request<any>('/configurations/evaluate-pld-score/', {
      method: 'POST',
      body: JSON.stringify({ assessment_id: assessmentId, answers })
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

  // Phase 3: POC Trials & KPI Tracking
  getPOCs: () => request<{ results: any[] }>('/pocs/'),
  completePOC: (id: string, resultMetrics: Record<string, any>, feedback: string) =>
    request<any>(`/pocs/${id}/complete/`, {
      method: 'POST',
      body: JSON.stringify({ result_metrics: resultMetrics, customer_feedback: feedback, is_successful: true })
    }),
  markPOCNotRequired: (id: string, reason: string) =>
    request<any>(`/pocs/${id}/mark-not-required/`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),

  // Authorized Assessment Manual Override
  overrideAssessment: (assessmentId: string, reason: string, newClassification?: string, newScore?: number) =>
    request<any>(`/assessments/${assessmentId}/override/`, {
      method: 'POST',
      body: JSON.stringify({ override_reason: reason, score_classification: newClassification, pld_score: newScore })
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
