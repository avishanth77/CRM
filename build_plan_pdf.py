import os
import subprocess
import sys
import re

def create_plan_pdf():
    # Read original PLAN file
    plan_path = os.path.join(os.path.dirname(__file__), "PLAN")
    if not os.path.exists(plan_path):
        print(f"Error: {plan_path} does not exist!")
        sys.exit(1)

    # SVG Diagram 1: Multi-Tier Logical Architecture (Section 1.2)
    svg_diagram_1 = """
    <svg viewBox="0 0 1000 680" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <defs>
        <linearGradient id="g-pres" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#EFF6FF"/><stop offset="100%" stop-color="#DBEAFE"/>
        </linearGradient>
        <linearGradient id="g-gw" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#F5F3FF"/><stop offset="100%" stop-color="#EDE9FE"/>
        </linearGradient>
        <linearGradient id="g-srv" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#F0FDF4"/><stop offset="100%" stop-color="#DCFCE7"/>
        </linearGradient>
        <linearGradient id="g-wrk" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFFBEB"/><stop offset="100%" stop-color="#FEF3C7"/>
        </linearGradient>
        <linearGradient id="g-dat" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#F8FAFC"/><stop offset="100%" stop-color="#E2E8F0"/>
        </linearGradient>
        <linearGradient id="g-int" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FDF2F8"/><stop offset="100%" stop-color="#FCE7F3"/>
        </linearGradient>
        <marker id="arr" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#475569"/>
        </marker>
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.08"/>
        </filter>
      </defs>

      <!-- Background -->
      <rect width="1000" height="680" fill="#FFFFFF" rx="8" stroke="#E2E8F0"/>

      <!-- 1. Presentation Layer -->
      <rect x="25" y="20" width="950" height="85" rx="8" fill="url(#g-pres)" stroke="#BFDBFE" stroke-width="1.5" filter="url(#shadow)"/>
      <text x="45" y="42" font-size="11" font-weight="800" fill="#1E40AF" letter-spacing="0.05em">1. PRESENTATION LAYER (CLIENT APPS &amp; PORTALS)</text>
      
      <rect x="45" y="52" width="280" height="42" rx="5" fill="#FFFFFF" stroke="#93C5FD" stroke-width="1"/>
      <text x="185" y="73" font-size="9.5" font-weight="700" fill="#1E3A8A" text-anchor="middle">Internal Web CRM (React SPA)</text>
      <text x="185" y="86" font-size="8" fill="#64748B" text-anchor="middle">Full Admin / Sales / Presales / PLD Workspace</text>

      <rect x="360" y="52" width="280" height="42" rx="5" fill="#FFFFFF" stroke="#93C5FD" stroke-width="1"/>
      <text x="500" y="73" font-size="9.5" font-weight="700" fill="#1E3A8A" text-anchor="middle">Partner Portal (React SPA)</text>
      <text x="500" y="86" font-size="8" fill="#64748B" text-anchor="middle">Isolated Scope, Deal Reg, Enablement</text>

      <rect x="675" y="52" width="280" height="42" rx="5" fill="#FFFFFF" stroke="#93C5FD" stroke-width="1"/>
      <text x="815" y="73" font-size="9.5" font-weight="700" fill="#1E3A8A" text-anchor="middle">Responsive Shell</text>
      <text x="815" y="86" font-size="8" fill="#64748B" text-anchor="middle">Tablet / Mobile Field Access</text>

      <!-- Arrow down to Gateway -->
      <line x1="500" y1="105" x2="500" y2="128" stroke="#475569" stroke-width="1.5" marker-end="url(#arr)"/>

      <!-- 2. API & Gateway Layer -->
      <rect x="25" y="130" width="950" height="75" rx="8" fill="url(#g-gw)" stroke="#DDD6FE" stroke-width="1.5" filter="url(#shadow)"/>
      <text x="45" y="150" font-size="11" font-weight="800" fill="#5B21B6" letter-spacing="0.05em">2. API &amp; GATEWAY LAYER (TRAEFIK / NGINX &amp; AUTH SHIELD)</text>
      
      <rect x="45" y="158" width="280" height="36" rx="5" fill="#FFFFFF" stroke="#C4B5FD" stroke-width="1"/>
      <text x="185" y="180" font-size="9" font-weight="700" fill="#4C1D95" text-anchor="middle">REST Gateway &amp; HTTPS Reverse Proxy</text>

      <rect x="360" y="158" width="280" height="36" rx="5" fill="#FFFFFF" stroke="#C4B5FD" stroke-width="1"/>
      <text x="500" y="180" font-size="9" font-weight="700" fill="#4C1D95" text-anchor="middle">JWT / OAuth2 &amp; RBAC Guard</text>

      <rect x="675" y="158" width="280" height="36" rx="5" fill="#FFFFFF" stroke="#C4B5FD" stroke-width="1"/>
      <text x="815" y="180" font-size="9" font-weight="700" fill="#4C1D95" text-anchor="middle">Rate Limiting &amp; Threat Shield</text>

      <!-- Arrow down to Service Layer -->
      <line x1="500" y1="205" x2="500" y2="228" stroke="#475569" stroke-width="1.5" marker-end="url(#arr)"/>

      <!-- 3. Service Layer (Django + DRF) -->
      <rect x="25" y="230" width="950" height="155" rx="8" fill="url(#g-srv)" stroke="#BBF7D0" stroke-width="1.5" filter="url(#shadow)"/>
      <text x="45" y="250" font-size="11" font-weight="800" fill="#15803D" letter-spacing="0.05em">3. BACKEND APPLICATION &amp; DOMAIN SERVICES (DJANGO 5 + DRF)</text>

      <!-- Row 1 of services -->
      <rect x="45" y="260" width="280" height="34" rx="4" fill="#FFFFFF" stroke="#86EFAC" stroke-width="1"/>
      <text x="185" y="281" font-size="8.5" font-weight="700" fill="#14532D" text-anchor="middle">CRM Core Service (Accounts, Contacts, Leads)</text>

      <rect x="360" y="260" width="280" height="34" rx="4" fill="#FFFFFF" stroke="#86EFAC" stroke-width="1"/>
      <text x="500" y="281" font-size="8.5" font-weight="700" fill="#14532D" text-anchor="middle">Configurable PLD Engine (ICP, Scoring, Gates)</text>

      <rect x="675" y="260" width="280" height="34" rx="4" fill="#FFFFFF" stroke="#86EFAC" stroke-width="1"/>
      <text x="815" y="281" font-size="8.5" font-weight="700" fill="#14532D" text-anchor="middle">Product Master &amp; Versioned Config Service</text>

      <!-- Row 2 of services -->
      <rect x="45" y="300" width="280" height="34" rx="4" fill="#FFFFFF" stroke="#86EFAC" stroke-width="1"/>
      <text x="185" y="321" font-size="8.5" font-weight="700" fill="#14532D" text-anchor="middle">Workflow &amp; State-Machine Engine</text>

      <rect x="360" y="300" width="280" height="34" rx="4" fill="#FFFFFF" stroke="#86EFAC" stroke-width="1"/>
      <text x="500" y="321" font-size="8.5" font-weight="700" fill="#14532D" text-anchor="middle">Partner Lifecycle &amp; Deal Registration</text>

      <rect x="675" y="300" width="280" height="34" rx="4" fill="#FFFFFF" stroke="#86EFAC" stroke-width="1"/>
      <text x="815" y="321" font-size="8.5" font-weight="700" fill="#14532D" text-anchor="middle">Unified Activity &amp; Task Timeline Service</text>

      <!-- Row 3 of services -->
      <rect x="45" y="340" width="280" height="34" rx="4" fill="#FFFFFF" stroke="#86EFAC" stroke-width="1"/>
      <text x="185" y="361" font-size="8.5" font-weight="700" fill="#14532D" text-anchor="middle">Universal Field-Level Audit Logger</text>

      <rect x="360" y="340" width="280" height="34" rx="4" fill="#FFFFFF" stroke="#86EFAC" stroke-width="1"/>
      <text x="500" y="361" font-size="8.5" font-weight="700" fill="#14532D" text-anchor="middle">Notification &amp; Adapter Engine (Comms)</text>

      <rect x="675" y="340" width="280" height="34" rx="4" fill="#FFFFFF" stroke="#86EFAC" stroke-width="1"/>
      <text x="815" y="361" font-size="8.5" font-weight="700" fill="#14532D" text-anchor="middle">PLD Funnel &amp; Leakage Analytics Service</text>

      <!-- Downward arrows to Workers and Data -->
      <line x1="260" y1="385" x2="260" y2="408" stroke="#475569" stroke-width="1.5" marker-end="url(#arr)"/>
      <line x1="740" y1="385" x2="740" y2="408" stroke="#475569" stroke-width="1.5" marker-end="url(#arr)"/>

      <!-- 4. Async Worker Layer -->
      <rect x="25" y="410" width="465" height="110" rx="8" fill="url(#g-wrk)" stroke="#FDE68A" stroke-width="1.5" filter="url(#shadow)"/>
      <text x="45" y="430" font-size="10.5" font-weight="800" fill="#B45309" letter-spacing="0.05em">4. ASYNC &amp; BACKGROUND TASK WORKERS</text>
      
      <rect x="45" y="440" width="205" height="34" rx="4" fill="#FFFFFF" stroke="#FCD34D" stroke-width="1"/>
      <text x="147" y="461" font-size="8" font-weight="700" fill="#78350F" text-anchor="middle">Celery Task Workers</text>
      
      <rect x="260" y="440" width="215" height="34" rx="4" fill="#FFFFFF" stroke="#FCD34D" stroke-width="1"/>
      <text x="367" y="461" font-size="8" font-weight="700" fill="#78350F" text-anchor="middle">Celery Beat Scheduler (SLA / Inactivity)</text>

      <rect x="45" y="480" width="430" height="30" rx="4" fill="#FFFFFF" stroke="#FCD34D" stroke-width="1"/>
      <text x="260" y="500" font-size="8.5" font-weight="700" fill="#78350F" text-anchor="middle">Redis (Message Broker, Cache &amp; Session Store)</text>

      <!-- 5. Data & Storage Layer -->
      <rect x="510" y="410" width="465" height="110" rx="8" fill="url(#g-dat)" stroke="#CBD5E1" stroke-width="1.5" filter="url(#shadow)"/>
      <text x="530" y="430" font-size="10.5" font-weight="800" fill="#334155" letter-spacing="0.05em">5. DATA &amp; STORAGE LAYER</text>

      <rect x="530" y="445" width="205" height="65" rx="5" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.5"/>
      <text x="632" y="475" font-size="9.5" font-weight="800" fill="#0F172A" text-anchor="middle">PostgreSQL 16</text>
      <text x="632" y="492" font-size="8" fill="#64748B" text-anchor="middle">Multi-Tenant / GIN JSONB / Full-Text</text>

      <rect x="750" y="445" width="205" height="65" rx="5" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.5"/>
      <text x="852" y="475" font-size="9.5" font-weight="800" fill="#0F172A" text-anchor="middle">S3 Object Storage</text>
      <text x="852" y="492" font-size="8" fill="#64748B" text-anchor="middle">Proposals, Quotes, POC Collateral</text>

      <!-- Downward arrow to Integration Layer -->
      <line x1="500" y1="520" x2="500" y2="538" stroke="#475569" stroke-width="1.5" marker-end="url(#arr)"/>

      <!-- 6. Integration & External Boundaries -->
      <rect x="25" y="540" width="950" height="115" rx="8" fill="url(#g-int)" stroke="#FBCFE8" stroke-width="1.5" filter="url(#shadow)"/>
      <text x="45" y="562" font-size="11" font-weight="800" fill="#9D174D" letter-spacing="0.05em">6. INTEGRATION &amp; EXTERNAL BOUNDARIES</text>

      <rect x="45" y="575" width="170" height="65" rx="5" fill="#FFFFFF" stroke="#F472B6" stroke-width="1"/>
      <text x="130" y="602" font-size="8.5" font-weight="700" fill="#831843" text-anchor="middle">Website &amp; Forms</text>
      <text x="130" y="618" font-size="7.5" fill="#64748B" text-anchor="middle">Inbound Webhooks</text>

      <rect x="225" y="575" width="170" height="65" rx="5" fill="#FFFFFF" stroke="#F472B6" stroke-width="1"/>
      <text x="310" y="602" font-size="8.5" font-weight="700" fill="#831843" text-anchor="middle">Marketing Ingestion</text>
      <text x="310" y="618" font-size="7.5" fill="#64748B" text-anchor="middle">LinkedIn, Ads, Campaigns</text>

      <rect x="405" y="575" width="175" height="65" rx="5" fill="#FFFFFF" stroke="#F472B6" stroke-width="1"/>
      <text x="492" y="602" font-size="8.5" font-weight="700" fill="#831843" text-anchor="middle">Comms Adapters</text>
      <text x="492" y="618" font-size="7.5" fill="#64748B" text-anchor="middle">WhatsApp / Email Providers</text>

      <rect x="590" y="575" width="180" height="65" rx="5" fill="#FFFFFF" stroke="#F472B6" stroke-width="1"/>
      <text x="680" y="602" font-size="8.5" font-weight="700" fill="#831843" text-anchor="middle">ERP Systems</text>
      <text x="680" y="618" font-size="7.5" fill="#64748B" text-anchor="middle">Odoo, SAP, Microsoft Sync</text>

      <rect x="780" y="575" width="180" height="65" rx="5" fill="#FFFFFF" stroke="#F472B6" stroke-width="1"/>
      <text x="870" y="602" font-size="8.5" font-weight="700" fill="#831843" text-anchor="middle">EntAura AI Boundary</text>
      <text x="870" y="618" font-size="7.5" fill="#64748B" text-anchor="middle">Read Context &amp; Rec. Engine</text>
    </svg>
    """

    # SVG Diagram 2: Clean Layered Architecture (Section 3.2)
    svg_diagram_2 = """
    <svg viewBox="0 0 900 500" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <defs>
        <marker id="arr2" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#3B82F6"/>
        </marker>
        <filter id="shadow2" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.06"/>
        </filter>
      </defs>
      
      <rect width="900" height="500" fill="#F8FAFC" rx="8" stroke="#E2E8F0"/>

      <!-- A: API Layer -->
      <rect x="250" y="25" width="400" height="48" rx="6" fill="#1E3A8A" filter="url(#shadow2)"/>
      <text x="450" y="54" font-size="11" font-weight="800" fill="#FFFFFF" text-anchor="middle">API Layer: DRF ViewSets / Serializers / Filters</text>

      <line x1="450" y1="73" x2="450" y2="105" stroke="#3B82F6" stroke-width="2" marker-end="url(#arr2)"/>

      <!-- B: Service Layer -->
      <rect x="200" y="105" width="500" height="55" rx="6" fill="#2563EB" filter="url(#shadow2)"/>
      <text x="450" y="132" font-size="11" font-weight="800" fill="#FFFFFF" text-anchor="middle">Service Layer: Business &amp; PLD Domain Services</text>
      <text x="450" y="148" font-size="8.5" fill="#BFDBFE" text-anchor="middle">Orchestrates workflows, transactions &amp; cross-domain policies</text>

      <!-- Forking arrows to Core Domain, State Machine, and Event Dispatcher -->
      <path d="M 350 160 L 350 185 L 220 185 L 220 205" fill="none" stroke="#3B82F6" stroke-width="1.8" marker-end="url(#arr2)"/>
      <path d="M 450 160 L 450 205" fill="none" stroke="#3B82F6" stroke-width="1.8" marker-end="url(#arr2)"/>
      <path d="M 550 160 L 550 185 L 680 185 L 680 205" fill="none" stroke="#3B82F6" stroke-width="1.8" marker-end="url(#arr2)"/>

      <!-- C: Core Domain Engine -->
      <rect x="80" y="205" width="280" height="55" rx="6" fill="#FFFFFF" stroke="#3B82F6" stroke-width="1.5" filter="url(#shadow2)"/>
      <text x="220" y="228" font-size="9.5" font-weight="800" fill="#1E3A8A" text-anchor="middle">Core Domain Engine</text>
      <text x="220" y="244" font-size="8" fill="#475569" text-anchor="middle">ICP Evaluator / Score Calculator / Gate Validator</text>

      <!-- D: State Machine & Workflow Transitions -->
      <rect x="375" y="205" width="230" height="55" rx="6" fill="#FFFFFF" stroke="#3B82F6" stroke-width="1.5" filter="url(#shadow2)"/>
      <text x="490" y="228" font-size="9.5" font-weight="800" fill="#1E3A8A" text-anchor="middle">State Machine &amp; Transitions</text>
      <text x="490" y="244" font-size="8" fill="#475569" text-anchor="middle">Pursuit, Opp &amp; Customer Lifecycles</text>

      <!-- F: Event & Notification Dispatcher -->
      <rect x="620" y="205" width="200" height="55" rx="6" fill="#FFFFFF" stroke="#3B82F6" stroke-width="1.5" filter="url(#shadow2)"/>
      <text x="720" y="228" font-size="9.5" font-weight="800" fill="#1E3A8A" text-anchor="middle">Event &amp; Notification</text>
      <text x="720" y="244" font-size="8" fill="#475569" text-anchor="middle">Dispatcher &amp; Signal Triggers</text>

      <!-- Arrows from Domain & State to Data Access Layer -->
      <path d="M 220 260 L 220 290 L 380 290 L 380 320" fill="none" stroke="#3B82F6" stroke-width="1.8" marker-end="url(#arr2)"/>
      <path d="M 490 260 L 490 290 L 430 290 L 430 320" fill="none" stroke="#3B82F6" stroke-width="1.8" marker-end="url(#arr2)"/>

      <!-- Arrow from Event Dispatcher to Async Workers -->
      <path d="M 720 260 L 720 320" fill="none" stroke="#F59E0B" stroke-width="1.8" marker-end="url(#arr2)"/>

      <!-- E: Data Access Layer -->
      <rect x="180" y="320" width="440" height="50" rx="6" fill="#0284C7" filter="url(#shadow2)"/>
      <text x="400" y="344" font-size="10" font-weight="800" fill="#FFFFFF" text-anchor="middle">Data Access Layer: Django ORM Models &amp; Custom QuerySets</text>
      <text x="400" y="358" font-size="8" fill="#E0F2FE" text-anchor="middle">Tenant Isolation, Soft-Delete, Immutable Audit Signal Handlers</text>

      <!-- G: Async Celery Tasks -->
      <rect x="635" y="320" width="190" height="50" rx="6" fill="#D97706" filter="url(#shadow2)"/>
      <text x="730" y="344" font-size="9" font-weight="800" fill="#FFFFFF" text-anchor="middle">Async Celery Tasks</text>
      <text x="730" y="358" font-size="8" fill="#FEF3C7" text-anchor="middle">Webhooks &amp; SLA Timers</text>

      <!-- Arrow to PostgreSQL -->
      <line x1="400" y1="370" x2="400" y2="405" stroke="#3B82F6" stroke-width="2" marker-end="url(#arr2)"/>

      <!-- H: PostgreSQL 16 DB -->
      <rect x="230" y="405" width="340" height="60" rx="8" fill="#0F172A" filter="url(#shadow2)"/>
      <text x="400" y="432" font-size="11" font-weight="800" fill="#38BDF8" text-anchor="middle">PostgreSQL 16 Enterprise Database</text>
      <text x="400" y="449" font-size="8.5" fill="#94A3B8" text-anchor="middle">UUIDv4 PKs | Multi-Tenant GIN Indexing | JSONB Schemas</text>
    </svg>
    """

    # SVG Diagram 3: Complete Entity Relationship Diagram (Section 5)
    svg_diagram_3 = """
    <svg viewBox="0 0 1000 700" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <defs>
        <marker id="erd-arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <circle cx="5" cy="5" r="3" fill="#64748B"/>
        </marker>
      </defs>
      
      <rect width="1000" height="700" fill="#F8FAFC" rx="8" stroke="#E2E8F0"/>

      <!-- Section Clusters -->
      <!-- Cluster 1: Core Master (Blue) -->
      <rect x="20" y="20" width="290" height="310" rx="6" fill="#EFF6FF" stroke="#BFDBFE" stroke-dasharray="4,4"/>
      <text x="35" y="40" font-size="9" font-weight="800" fill="#1E40AF">CORE FOUNDATION &amp; ACCOUNTS</text>

      <!-- Cluster 2: Product & Config (Green) -->
      <rect x="330" y="20" width="330" height="310" rx="6" fill="#F0FDF4" stroke="#BBF7D0" stroke-dasharray="4,4"/>
      <text x="345" y="40" font-size="9" font-weight="800" fill="#15803D">DYNAMIC PRODUCT CONFIG &amp; TAXONOMY</text>

      <!-- Cluster 3: Leads & Discovery (Purple) -->
      <rect x="680" y="20" width="300" height="310" rx="6" fill="#FAF5FF" stroke="#E9D5FF" stroke-dasharray="4,4"/>
      <text x="695" y="40" font-size="9" font-weight="800" fill="#7E22CE">LEADS, DISCOVERY &amp; EVALUATION</text>

      <!-- Cluster 4: Deals, Partners & Commercials (Amber) -->
      <rect x="20" y="350" width="460" height="325" rx="6" fill="#FFFBEB" stroke="#FDE68A" stroke-dasharray="4,4"/>
      <text x="35" y="370" font-size="9" font-weight="800" fill="#B45309">OPPORTUNITIES, PROPOSALS &amp; PARTNERS</text>

      <!-- Cluster 5: Cross-Cutting, Workflows & Audit (Slate) -->
      <rect x="500" y="350" width="480" height="325" rx="6" fill="#F1F5F9" stroke="#CBD5E1" stroke-dasharray="4,4"/>
      <text x="515" y="370" font-size="9" font-weight="800" fill="#334155">TIMELINE, TASKS, APPROVALS &amp; AUDIT</text>

      <!-- Entities inside Cluster 1 -->
      <g transform="translate(35, 55)">
        <rect width="115" height="42" rx="4" fill="#FFFFFF" stroke="#3B82F6"/>
        <text x="57" y="20" font-size="8" font-weight="800" fill="#1E3A8A" text-anchor="middle">TENANT</text>
        <text x="57" y="32" font-size="7" fill="#64748B" text-anchor="middle">id, code, name</text>
      </g>
      <g transform="translate(170, 55)">
        <rect width="125" height="42" rx="4" fill="#FFFFFF" stroke="#3B82F6"/>
        <text x="62" y="20" font-size="8" font-weight="800" fill="#1E3A8A" text-anchor="middle">USER</text>
        <text x="62" y="32" font-size="7" fill="#64748B" text-anchor="middle">id, role, tenant_id</text>
      </g>
      <g transform="translate(35, 115)">
        <rect width="260" height="48" rx="4" fill="#FFFFFF" stroke="#1D4ED8" stroke-width="1.5"/>
        <text x="130" y="20" font-size="8.5" font-weight="800" fill="#1E3A8A" text-anchor="middle">ACCOUNT</text>
        <text x="130" y="34" font-size="7" fill="#475569" text-anchor="middle">id, company_name, domain, employees, type</text>
      </g>
      <g transform="translate(35, 180)">
        <rect width="120" height="45" rx="4" fill="#FFFFFF" stroke="#3B82F6"/>
        <text x="60" y="19" font-size="7.5" font-weight="800" fill="#1E3A8A" text-anchor="middle">CONTACT</text>
        <text x="60" y="31" font-size="6.5" fill="#64748B" text-anchor="middle">account_id, role, email</text>
      </g>
      <g transform="translate(165, 180)">
        <rect width="130" height="45" rx="4" fill="#FFFFFF" stroke="#3B82F6"/>
        <text x="65" y="19" font-size="7.5" font-weight="800" fill="#1E3A8A" text-anchor="middle">ACCOUNT_ATTR</text>
        <text x="65" y="31" font-size="6.5" fill="#64748B" text-anchor="middle">account_id, key, val_json</text>
      </g>
      <g transform="translate(35, 245)">
        <rect width="260" height="45" rx="4" fill="#FFFFFF" stroke="#3B82F6"/>
        <text x="130" y="19" font-size="8" font-weight="800" fill="#1E3A8A" text-anchor="middle">ACCOUNT_PRODUCT</text>
        <text x="130" y="32" font-size="7" fill="#64748B" text-anchor="middle">account_id, product_id, status, arr_mrr</text>
      </g>

      <!-- Entities inside Cluster 2 -->
      <g transform="translate(345, 55)">
        <rect width="140" height="48" rx="4" fill="#FFFFFF" stroke="#16A34A" stroke-width="1.5"/>
        <text x="70" y="20" font-size="8.5" font-weight="800" fill="#14532D" text-anchor="middle">PRODUCT</text>
        <text x="70" y="33" font-size="7" fill="#475569" text-anchor="middle">id, code, name, status</text>
      </g>
      <g transform="translate(500, 55)">
        <rect width="145" height="48" rx="4" fill="#FFFFFF" stroke="#16A34A"/>
        <text x="72" y="19" font-size="7.5" font-weight="800" fill="#14532D" text-anchor="middle">PRODUCT_MODULE</text>
        <text x="72" y="31" font-size="6.5" fill="#64748B" text-anchor="middle">product_id, name, code</text>
      </g>
      <g transform="translate(345, 120)">
        <rect width="300" height="45" rx="4" fill="#FFFFFF" stroke="#16A34A"/>
        <text x="150" y="18" font-size="8" font-weight="800" fill="#14532D" text-anchor="middle">PRODUCT_CONFIG_VERSION</text>
        <text x="150" y="31" font-size="7" fill="#64748B" text-anchor="middle">product_id, version_num, status (Draft/Pub/Archived)</text>
      </g>
      <g transform="translate(345, 180)">
        <rect width="140" height="45" rx="4" fill="#FFFFFF" stroke="#16A34A"/>
        <text x="70" y="18" font-size="7.5" font-weight="800" fill="#14532D" text-anchor="middle">ICP_RULE</text>
        <text x="70" y="30" font-size="6.5" fill="#64748B" text-anchor="middle">config_id, rule_type, weight</text>
      </g>
      <g transform="translate(500, 180)">
        <rect width="145" height="45" rx="4" fill="#FFFFFF" stroke="#16A34A"/>
        <text x="72" y="18" font-size="7.5" font-weight="800" fill="#14532D" text-anchor="middle">SCORE_MODEL</text>
        <text x="72" y="30" font-size="6.5" fill="#64748B" text-anchor="middle">config_id, dim, weight_pct</text>
      </g>
      <g transform="translate(345, 240)">
        <rect width="140" height="45" rx="4" fill="#FFFFFF" stroke="#16A34A"/>
        <text x="70" y="18" font-size="7.5" font-weight="800" fill="#14532D" text-anchor="middle">PROBLEM</text>
        <text x="70" y="30" font-size="6.5" fill="#64748B" text-anchor="middle">code, category, severity</text>
      </g>
      <g transform="translate(500, 240)">
        <rect width="145" height="45" rx="4" fill="#FFFFFF" stroke="#16A34A"/>
        <text x="72" y="18" font-size="7.5" font-weight="800" fill="#14532D" text-anchor="middle">STAGE_GATE</text>
        <text x="72" y="30" font-size="6.5" fill="#64748B" text-anchor="middle">stage_id, condition_rules</text>
      </g>

      <!-- Entities inside Cluster 3 -->
      <g transform="translate(695, 55)">
        <rect width="270" height="50" rx="4" fill="#FFFFFF" stroke="#9333EA" stroke-width="1.5"/>
        <text x="135" y="20" font-size="8.5" font-weight="800" fill="#581C87" text-anchor="middle">LEAD</text>
        <text x="135" y="33" font-size="7" fill="#475569" text-anchor="middle">account_id, product_id, stage_id, status, owner_id</text>
      </g>
      <g transform="translate(695, 120)">
        <rect width="130" height="45" rx="4" fill="#FFFFFF" stroke="#9333EA"/>
        <text x="65" y="18" font-size="7.5" font-weight="800" fill="#581C87" text-anchor="middle">LEAD_TOUCH</text>
        <text x="65" y="30" font-size="6.5" fill="#64748B" text-anchor="middle">lead_id, campaign, utm</text>
      </g>
      <g transform="translate(835, 120)">
        <rect width="130" height="45" rx="4" fill="#FFFFFF" stroke="#9333EA"/>
        <text x="65" y="18" font-size="7.5" font-weight="800" fill="#581C87" text-anchor="middle">LEAD_PROBLEM</text>
        <text x="65" y="30" font-size="6.5" fill="#64748B" text-anchor="middle">lead_id, problem_id</text>
      </g>
      <g transform="translate(695, 180)">
        <rect width="270" height="45" rx="4" fill="#FFFFFF" stroke="#9333EA"/>
        <text x="135" y="18" font-size="8" font-weight="800" fill="#581C87" text-anchor="middle">DISCOVERY &amp; PROBLEMS</text>
        <text x="135" y="30" font-size="7" fill="#64748B" text-anchor="middle">lead_id, account_id, quantified_loss, mapping_ok</text>
      </g>
      <g transform="translate(695, 240)">
        <rect width="130" height="45" rx="4" fill="#FFFFFF" stroke="#9333EA"/>
        <text x="65" y="18" font-size="7.5" font-weight="800" fill="#581C87" text-anchor="middle">DEMO</text>
        <text x="65" y="30" font-size="6.5" fill="#64748B" text-anchor="middle">lead_id, fit_feedback</text>
      </g>
      <g transform="translate(835, 240)">
        <rect width="130" height="45" rx="4" fill="#FFFFFF" stroke="#9333EA"/>
        <text x="65" y="18" font-size="7.5" font-weight="800" fill="#581C87" text-anchor="middle">POC / PILOT</text>
        <text x="65" y="30" font-size="6.5" fill="#64748B" text-anchor="middle">lead_id, kpi_metrics</text>
      </g>

      <!-- Entities inside Cluster 4 -->
      <g transform="translate(35, 385)">
        <rect width="200" height="50" rx="4" fill="#FFFFFF" stroke="#D97706" stroke-width="1.5"/>
        <text x="100" y="20" font-size="8.5" font-weight="800" fill="#78350F" text-anchor="middle">SQL_HANDOFF</text>
        <text x="100" y="34" font-size="7" fill="#475569" text-anchor="middle">lead_id, gate_audit_json, status, sla</text>
      </g>
      <g transform="translate(250, 385)">
        <rect width="215" height="50" rx="4" fill="#FFFFFF" stroke="#D97706" stroke-width="1.5"/>
        <text x="107" y="20" font-size="8.5" font-weight="800" fill="#78350F" text-anchor="middle">OPPORTUNITY</text>
        <text x="107" y="34" font-size="7" fill="#475569" text-anchor="middle">account_id, stage_id, tcv, probability</text>
      </g>
      <g transform="translate(35, 450)">
        <rect width="200" height="45" rx="4" fill="#FFFFFF" stroke="#D97706"/>
        <text x="100" y="18" font-size="8" font-weight="800" fill="#78350F" text-anchor="middle">PROPOSAL</text>
        <text x="100" y="30" font-size="6.5" fill="#64748B" text-anchor="middle">opportunity_id, gross, discount, net</text>
      </g>
      <g transform="translate(250, 450)">
        <rect width="215" height="45" rx="4" fill="#FFFFFF" stroke="#D97706"/>
        <text x="107" y="18" font-size="8" font-weight="800" fill="#78350F" text-anchor="middle">PARTNER</text>
        <text x="107" y="30" font-size="6.5" fill="#64748B" text-anchor="middle">account_id, code, partner_type, status</text>
      </g>
      <g transform="translate(35, 515)">
        <rect width="200" height="45" rx="4" fill="#FFFFFF" stroke="#D97706"/>
        <text x="100" y="18" font-size="7.5" font-weight="800" fill="#78350F" text-anchor="middle">DEAL_REGISTRATION</text>
        <text x="100" y="30" font-size="6.5" fill="#64748B" text-anchor="middle">partner_id, customer_id, expiry</text>
      </g>
      <g transform="translate(250, 515)">
        <rect width="215" height="45" rx="4" fill="#FFFFFF" stroke="#D97706"/>
        <text x="107" y="18" font-size="7.5" font-weight="800" fill="#78350F" text-anchor="middle">PARTNER_COMMISSION</text>
        <text x="107" y="30" font-size="6.5" fill="#64748B" text-anchor="middle">partner_id, opportunity_id, amount</text>
      </g>

      <!-- Entities inside Cluster 5 -->
      <g transform="translate(515, 385)">
        <rect width="215" height="45" rx="4" fill="#FFFFFF" stroke="#475569"/>
        <text x="107" y="18" font-size="8" font-weight="800" fill="#0F172A" text-anchor="middle">ACTIVITY</text>
        <text x="107" y="30" font-size="6.5" fill="#64748B" text-anchor="middle">lead_id, opp_id, type, outcome, next_act</text>
      </g>
      <g transform="translate(745, 385)">
        <rect width="215" height="45" rx="4" fill="#FFFFFF" stroke="#475569"/>
        <text x="107" y="18" font-size="8" font-weight="800" fill="#0F172A" text-anchor="middle">TASK</text>
        <text x="107" y="30" font-size="6.5" fill="#64748B" text-anchor="middle">assigned_to, priority, due_date</text>
      </g>
      <g transform="translate(515, 450)">
        <rect width="215" height="45" rx="4" fill="#FFFFFF" stroke="#475569"/>
        <text x="107" y="18" font-size="8" font-weight="800" fill="#0F172A" text-anchor="middle">STAGE_HISTORY</text>
        <text x="107" y="30" font-size="6.5" fill="#64748B" text-anchor="middle">from_stage, to_stage, reason, override</text>
      </g>
      <g transform="translate(745, 450)">
        <rect width="215" height="45" rx="4" fill="#FFFFFF" stroke="#475569"/>
        <text x="107" y="18" font-size="8" font-weight="800" fill="#0F172A" text-anchor="middle">APPROVAL</text>
        <text x="107" y="30" font-size="6.5" fill="#64748B" text-anchor="middle">type (Gate/Discount), approver_id</text>
      </g>
      <g transform="translate(515, 515)">
        <rect width="445" height="45" rx="4" fill="#0F172A"/>
        <text x="222" y="18" font-size="8.5" font-weight="800" fill="#38BDF8" text-anchor="middle">AUDIT_LOG (IMMUTABLE)</text>
        <text x="222" y="31" font-size="7" fill="#CBD5E1" text-anchor="middle">actor_id, entity_type, entity_id, action, changes_json (old/new diff), timestamp</text>
      </g>

      <!-- Connecting relationship paths -->
      <path d="M 295 135 L 695 80" stroke="#94A3B8" stroke-width="1.2" stroke-dasharray="3,3"/>
      <path d="M 485 80 L 695 80" stroke="#94A3B8" stroke-width="1.2" stroke-dasharray="3,3"/>
      <path d="M 830 105 L 830 180" stroke="#94A3B8" stroke-width="1.2"/>
      <path d="M 830 225 L 830 240" stroke="#94A3B8" stroke-width="1.2"/>
      <path d="M 695 100 L 135 385" stroke="#94A3B8" stroke-width="1.2" stroke-dasharray="3,3"/>
      <path d="M 235 410 L 250 410" stroke="#94A3B8" stroke-width="1.5"/>
      <path d="M 355 435 L 355 450" stroke="#94A3B8" stroke-width="1.2"/>
      <path d="M 135 435 L 135 450" stroke="#94A3B8" stroke-width="1.2"/>
    </svg>
    """

    # SVG Diagram 4: Product Configuration Architecture Class Diagram (Section 10)
    svg_diagram_4 = """
    <svg viewBox="0 0 900 420" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <defs>
        <marker id="diamond" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="8" markerHeight="8" orient="auto">
          <polygon points="6,0 12,6 6,12 0,6" fill="#1E3A8A"/>
        </marker>
        <filter id="shadow4" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.08"/>
        </filter>
      </defs>

      <rect width="900" height="420" fill="#F8FAFC" rx="8" stroke="#E2E8F0"/>

      <!-- Class 1: Product -->
      <g transform="translate(40, 40)" filter="url(#shadow4)">
        <rect width="220" height="110" rx="6" fill="#FFFFFF" stroke="#1E3A8A" stroke-width="1.5"/>
        <rect width="220" height="26" rx="6" fill="#1E3A8A"/>
        <text x="110" y="17" font-size="10" font-weight="800" fill="#FFFFFF" text-anchor="middle">Product</text>
        <text x="15" y="44" font-size="8" fill="#1E293B">+ UUID id</text>
        <text x="15" y="60" font-size="8" fill="#1E293B">+ string code (e.g. VANFORCES)</text>
        <text x="15" y="76" font-size="8" fill="#1E293B">+ string name</text>
        <text x="15" y="92" font-size="8" fill="#1E293B">+ string status</text>
      </g>

      <!-- Class 2: ProductConfigurationVersion -->
      <g transform="translate(340, 40)" filter="url(#shadow4)">
        <rect width="240" height="110" rx="6" fill="#FFFFFF" stroke="#1D4ED8" stroke-width="1.5"/>
        <rect width="240" height="26" rx="6" fill="#1D4ED8"/>
        <text x="120" y="17" font-size="9.5" font-weight="800" fill="#FFFFFF" text-anchor="middle">ProductConfigurationVersion</text>
        <text x="15" y="44" font-size="8" fill="#1E293B">+ UUID id</text>
        <text x="15" y="60" font-size="8" fill="#1E293B">+ int version_number</text>
        <text x="15" y="76" font-size="8" fill="#1E293B">+ string status (Draft/Published/Archived)</text>
        <text x="15" y="92" font-size="8" fill="#1E293B">+ timestamp published_at</text>
      </g>

      <!-- Connection Product to Version -->
      <line x1="260" y1="95" x2="340" y2="95" stroke="#1E3A8A" stroke-width="1.8" marker-start="url(#diamond)"/>
      <text x="300" y="88" font-size="8" font-weight="700" fill="#64748B" text-anchor="middle">1..*</text>

      <!-- 4 Child Classes defined by ProductConfigurationVersion -->
      <!-- ICPRule -->
      <g transform="translate(40, 240)" filter="url(#shadow4)">
        <rect width="180" height="140" rx="6" fill="#FFFFFF" stroke="#15803D" stroke-width="1.2"/>
        <rect width="180" height="24" rx="6" fill="#15803D"/>
        <text x="90" y="16" font-size="9" font-weight="800" fill="#FFFFFF" text-anchor="middle">ICPRule</text>
        <text x="12" y="40" font-size="7.5" fill="#1E293B">+ UUID id</text>
        <text x="12" y="55" font-size="7.5" fill="#1E293B">+ string rule_type (Knockout/Fit)</text>
        <text x="12" y="70" font-size="7.5" fill="#1E293B">+ string field_name</text>
        <text x="12" y="85" font-size="7.5" fill="#1E293B">+ string operator</text>
        <text x="12" y="100" font-size="7.5" fill="#1E293B">+ json target_value</text>
        <text x="12" y="115" font-size="7.5" fill="#1E293B">+ int weight</text>
      </g>

      <!-- ScoreModel -->
      <g transform="translate(250, 240)" filter="url(#shadow4)">
        <rect width="180" height="140" rx="6" fill="#FFFFFF" stroke="#0284C7" stroke-width="1.2"/>
        <rect width="180" height="24" rx="6" fill="#0284C7"/>
        <text x="90" y="16" font-size="9" font-weight="800" fill="#FFFFFF" text-anchor="middle">ScoreModel</text>
        <text x="12" y="40" font-size="7.5" fill="#1E293B">+ UUID id</text>
        <text x="12" y="55" font-size="7.5" fill="#1E293B">+ string dimension_name</text>
        <text x="12" y="70" font-size="7.5" fill="#1E293B">+ int weight_percentage</text>
        <text x="12" y="85" font-size="7.5" fill="#1E293B">+ json input_mapping</text>
      </g>

      <!-- StageGate -->
      <g transform="translate(460, 240)" filter="url(#shadow4)">
        <rect width="180" height="140" rx="6" fill="#FFFFFF" stroke="#D97706" stroke-width="1.2"/>
        <rect width="180" height="24" rx="6" fill="#D97706"/>
        <text x="90" y="16" font-size="9" font-weight="800" fill="#FFFFFF" text-anchor="middle">StageGate</text>
        <text x="12" y="40" font-size="7.5" fill="#1E293B">+ UUID id</text>
        <text x="12" y="55" font-size="7.5" fill="#1E293B">+ string stage_code</text>
        <text x="12" y="70" font-size="7.5" fill="#1E293B">+ json condition_rules</text>
        <text x="12" y="85" font-size="7.5" fill="#1E293B">+ bool is_mandatory</text>
      </g>

      <!-- QuestionnaireTemplate -->
      <g transform="translate(670, 240)" filter="url(#shadow4)">
        <rect width="190" height="140" rx="6" fill="#FFFFFF" stroke="#7C3AED" stroke-width="1.2"/>
        <rect width="190" height="24" rx="6" fill="#7C3AED"/>
        <text x="95" y="16" font-size="9" font-weight="800" fill="#FFFFFF" text-anchor="middle">QuestionnaireTemplate</text>
        <text x="12" y="40" font-size="7.5" fill="#1E293B">+ UUID id</text>
        <text x="12" y="55" font-size="7.5" fill="#1E293B">+ string stage_code</text>
        <text x="12" y="70" font-size="7.5" fill="#1E293B">+ json schema_json</text>
      </g>

      <!-- Connecting lines from Version to child models -->
      <path d="M 420 150 L 420 195 L 130 195 L 130 240" fill="none" stroke="#64748B" stroke-width="1.5"/>
      <path d="M 440 150 L 440 195 L 340 195 L 340 240" fill="none" stroke="#64748B" stroke-width="1.5"/>
      <path d="M 480 150 L 480 195 L 550 195 L 550 240" fill="none" stroke="#64748B" stroke-width="1.5"/>
      <path d="M 500 150 L 500 195 L 765 195 L 765 240" fill="none" stroke="#64748B" stroke-width="1.5"/>
    </svg>
    """

    # SVG Diagram 5: PLD Engine 3 Chained Pipelines (Section 11)
    svg_diagram_5 = """
    <svg viewBox="0 0 950 260" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <defs>
        <marker id="pipe-arr" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563EB"/>
        </marker>
        <filter id="shadow5" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.06"/>
        </filter>
      </defs>

      <rect width="950" height="260" fill="#FFFFFF" rx="8" stroke="#E2E8F0"/>

      <!-- Pipeline 1: ICP Engine -->
      <rect x="20" y="20" width="280" height="220" rx="6" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.5"/>
      <text x="35" y="42" font-size="10" font-weight="800" fill="#1E40AF">PIPELINE 1: ICP ENGINE</text>

      <rect x="35" y="60" width="250" height="65" rx="5" fill="#FFFFFF" stroke="#93C5FD" filter="url(#shadow5)"/>
      <text x="160" y="86" font-size="8.5" font-weight="700" fill="#1E3A8A" text-anchor="middle">Knock-Out Rules</text>
      <text x="160" y="102" font-size="7.5" fill="#475569" text-anchor="middle">Binary Pass / Disqualify Gates</text>

      <line x1="160" y1="125" x2="160" y2="150" stroke="#3B82F6" stroke-width="1.8" marker-end="url(#pipe-arr)"/>

      <rect x="35" y="152" width="250" height="65" rx="5" fill="#FFFFFF" stroke="#93C5FD" filter="url(#shadow5)"/>
      <text x="160" y="178" font-size="8.5" font-weight="700" fill="#1E3A8A" text-anchor="middle">Fit Score Calculation</text>
      <text x="160" y="194" font-size="7.5" fill="#475569" text-anchor="middle">Normalized 0 - 100 Criteria Fit</text>

      <!-- Arrow from Pipe 1 to Pipe 2 -->
      <line x1="300" y1="130" x2="330" y2="130" stroke="#2563EB" stroke-width="2" marker-end="url(#pipe-arr)"/>

      <!-- Pipeline 2: PLD Scoring Engine -->
      <rect x="335" y="20" width="280" height="220" rx="6" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.5"/>
      <text x="350" y="42" font-size="10" font-weight="800" fill="#15803D">PIPELINE 2: PLD SCORING ENGINE</text>

      <rect x="350" y="60" width="250" height="42" rx="4" fill="#FFFFFF" stroke="#86EFAC" filter="url(#shadow5)"/>
      <text x="475" y="82" font-size="8" font-weight="700" fill="#14532D" text-anchor="middle">Gather Dimension Inputs</text>
      <text x="475" y="94" font-size="7" fill="#64748B" text-anchor="middle">Questions &amp; Account Data</text>

      <line x1="475" y1="102" x2="475" y2="118" stroke="#16A34A" stroke-width="1.8" marker-end="url(#pipe-arr)"/>

      <rect x="350" y="120" width="250" height="45" rx="4" fill="#FFFFFF" stroke="#86EFAC" filter="url(#shadow5)"/>
      <text x="475" y="142" font-size="8" font-weight="700" fill="#14532D" text-anchor="middle">Weighted Dimension Sum</text>
      <text x="475" y="154" font-size="7" fill="#64748B" text-anchor="middle">Severity (25%), Value (20%), Tech (15%), etc.</text>

      <line x1="475" y1="165" x2="475" y2="178" stroke="#16A34A" stroke-width="1.8" marker-end="url(#pipe-arr)"/>

      <rect x="350" y="180" width="250" height="42" rx="4" fill="#FFFFFF" stroke="#86EFAC" filter="url(#shadow5)"/>
      <text x="475" y="202" font-size="8" font-weight="700" fill="#14532D" text-anchor="middle">Score Classification</text>
      <text x="475" y="214" font-size="7" fill="#64748B" text-anchor="middle">Nurture / Development / Qualified / Priority</text>

      <!-- Arrow from Pipe 2 to Pipe 3 -->
      <line x1="615" y1="130" x2="645" y2="130" stroke="#2563EB" stroke-width="2" marker-end="url(#pipe-arr)"/>

      <!-- Pipeline 3: Stage Gate Validator -->
      <rect x="650" y="20" width="280" height="220" rx="6" fill="#FFFBEB" stroke="#FDE68A" stroke-width="1.5"/>
      <text x="665" y="42" font-size="10" font-weight="800" fill="#B45309">PIPELINE 3: STAGE GATE VALIDATOR</text>

      <rect x="665" y="60" width="250" height="42" rx="4" fill="#FFFFFF" stroke="#FCD34D" filter="url(#shadow5)"/>
      <text x="790" y="82" font-size="8" font-weight="700" fill="#78350F" text-anchor="middle">Check Mandatory Evidence &amp; Fields</text>
      <text x="790" y="94" font-size="7" fill="#64748B" text-anchor="middle">Documented Problem + Next Action Due</text>

      <line x1="790" y1="102" x2="790" y2="118" stroke="#D97706" stroke-width="1.8" marker-end="url(#pipe-arr)"/>

      <polygon points="790,120 840,145 790,170 740,145" fill="#FFFFFF" stroke="#D97706" stroke-width="1.5"/>
      <text x="790" y="148" font-size="7.5" font-weight="700" fill="#78350F" text-anchor="middle">Gates OK?</text>

      <path d="M 840 145 L 890 145 L 890 190" fill="none" stroke="#16A34A" stroke-width="1.5" marker-end="url(#pipe-arr)"/>
      <text x="870" y="138" font-size="7.5" font-weight="700" fill="#15803D">Yes</text>
      <rect x="830" y="192" width="105" height="35" rx="3" fill="#DCFCE7" stroke="#16A34A"/>
      <text x="882" y="212" font-size="7" font-weight="700" fill="#14532D" text-anchor="middle">Permit Transition</text>

      <path d="M 740 145 L 690 145 L 690 190" fill="none" stroke="#DC2626" stroke-width="1.5" marker-end="url(#pipe-arr)"/>
      <text x="705" y="138" font-size="7.5" font-weight="700" fill="#DC2626">No</text>
      <rect x="660" y="192" width="115" height="35" rx="3" fill="#FEE2E2" stroke="#DC2626"/>
      <text x="717" y="206" font-size="6.5" font-weight="700" fill="#7F1D1D" text-anchor="middle">Block Transition</text>
      <text x="717" y="217" font-size="6" fill="#991B1B" text-anchor="middle">Require Override</text>
    </svg>
    """

    # SVG Diagram 6: State Machine Lifecycle Workflow (Section 12)
    svg_diagram_6 = """
    <svg viewBox="0 0 950 480" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <defs>
        <marker id="sm-arr" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#475569"/>
        </marker>
        <filter id="shadow6" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.06"/>
        </filter>
      </defs>

      <rect width="950" height="480" fill="#F8FAFC" rx="8" stroke="#E2E8F0"/>

      <!-- Lifecycle A: Pursuit (PLD) Lifecycle -->
      <rect x="20" y="15" width="910" height="235" rx="6" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.5"/>
      <text x="35" y="35" font-size="10" font-weight="800" fill="#1E40AF">A. PURSUIT (PLD) LIFECYCLE</text>

      <!-- Row 1 of Pursuit -->
      <circle cx="50" cy="70" r="10" fill="#0F172A"/>
      
      <line x1="60" y1="70" x2="85" y2="70" stroke="#475569" stroke-width="1.5" marker-end="url(#sm-arr)"/>

      <rect x="90" y="50" width="100" height="38" rx="4" fill="#FFFFFF" stroke="#3B82F6" filter="url(#shadow6)"/>
      <text x="140" y="73" font-size="8" font-weight="700" fill="#1E3A8A" text-anchor="middle">New Lead</text>

      <line x1="190" y1="70" x2="225" y2="70" stroke="#475569" stroke-width="1.5" marker-end="url(#sm-arr)"/>

      <rect x="230" y="50" width="100" height="38" rx="4" fill="#FFFFFF" stroke="#3B82F6" filter="url(#shadow6)"/>
      <text x="280" y="73" font-size="8" font-weight="700" fill="#1E3A8A" text-anchor="middle">ICP Check</text>

      <!-- Fail to Disqualified -->
      <path d="M 280 88 L 280 120" stroke="#DC2626" stroke-width="1.2" marker-end="url(#sm-arr)"/>
      <text x="285" y="108" font-size="6.5" fill="#DC2626">Knockout Fail</text>
      <rect x="235" y="120" width="90" height="28" rx="3" fill="#FEE2E2" stroke="#EF4444"/>
      <text x="280" y="138" font-size="7" font-weight="700" fill="#991B1B" text-anchor="middle">Disqualified</text>

      <!-- Pass to Contacting -->
      <line x1="330" y1="70" x2="365" y2="70" stroke="#16A34A" stroke-width="1.5" marker-end="url(#sm-arr)"/>
      <rect x="370" y="50" width="100" height="38" rx="4" fill="#FFFFFF" stroke="#3B82F6" filter="url(#shadow6)"/>
      <text x="420" y="73" font-size="8" font-weight="700" fill="#1E3A8A" text-anchor="middle">Contacting</text>

      <line x1="470" y1="70" x2="505" y2="70" stroke="#475569" stroke-width="1.5" marker-end="url(#sm-arr)"/>
      <rect x="510" y="50" width="105" height="38" rx="4" fill="#FFFFFF" stroke="#3B82F6" filter="url(#shadow6)"/>
      <text x="562" y="73" font-size="8" font-weight="700" fill="#1E3A8A" text-anchor="middle">PLD Qualified</text>

      <line x1="615" y1="70" x2="650" y2="70" stroke="#475569" stroke-width="1.5" marker-end="url(#sm-arr)"/>
      <rect x="655" y="50" width="95" height="38" rx="4" fill="#FFFFFF" stroke="#3B82F6" filter="url(#shadow6)"/>
      <text x="702" y="73" font-size="8" font-weight="700" fill="#1E3A8A" text-anchor="middle">Discovery</text>

      <line x1="750" y1="70" x2="785" y2="70" stroke="#475569" stroke-width="1.5" marker-end="url(#sm-arr)"/>
      <rect x="790" y="50" width="95" height="38" rx="4" fill="#FFFFFF" stroke="#3B82F6" filter="url(#shadow6)"/>
      <text x="837" y="73" font-size="8" font-weight="700" fill="#1E3A8A" text-anchor="middle">Demo / POC</text>

      <!-- Row 2 of Pursuit: SQL and Review -->
      <path d="M 837 88 L 837 180 L 800 180" stroke="#475569" stroke-width="1.5" marker-end="url(#sm-arr)"/>

      <rect x="690" y="160" width="105" height="38" rx="4" fill="#FFFFFF" stroke="#2563EB" stroke-width="1.5" filter="url(#shadow6)"/>
      <text x="742" y="183" font-size="8" font-weight="700" fill="#1D4ED8" text-anchor="middle">SQL Ready</text>

      <line x1="690" y1="180" x2="640" y2="180" stroke="#475569" stroke-width="1.5" marker-end="url(#sm-arr)"/>

      <rect x="525" y="160" width="110" height="38" rx="4" fill="#FFFFFF" stroke="#D97706" stroke-width="1.5" filter="url(#shadow6)"/>
      <text x="580" y="183" font-size="8" font-weight="700" fill="#B45309" text-anchor="middle">Sales Review (SLA)</text>

      <!-- Sales Acceptance / Rejection -->
      <line x1="525" y1="180" x2="470" y2="180" stroke="#16A34A" stroke-width="1.5" marker-end="url(#sm-arr)"/>
      <rect x="350" y="160" width="115" height="38" rx="4" fill="#DCFCE7" stroke="#16A34A" stroke-width="1.5"/>
      <text x="407" y="183" font-size="8" font-weight="800" fill="#14532D" text-anchor="middle">Sales Accepted</text>

      <!-- Sales Rejection path back to Discovery or Nurture -->
      <path d="M 580 160 L 580 130 L 680 130 L 680 90" stroke="#DC2626" stroke-dasharray="3,3" stroke-width="1.2" marker-end="url(#sm-arr)"/>
      <text x="600" y="125" font-size="6.5" fill="#DC2626">Sales Rejected (Reason Req)</text>

      <!-- Lifecycle B: Opportunity Lifecycle -->
      <rect x="20" y="260" width="560" height="205" rx="6" fill="#FFFBEB" stroke="#FDE68A" stroke-width="1.5"/>
      <text x="35" y="280" font-size="10" font-weight="800" fill="#B45309">B. OPPORTUNITY LIFECYCLE</text>

      <!-- Arrow from Accepted to Opportunity Active -->
      <path d="M 407 198 L 407 235 L 110 235 L 110 300" stroke="#16A34A" stroke-width="1.8" marker-end="url(#sm-arr)"/>

      <rect x="50" y="300" width="120" height="38" rx="4" fill="#FFFFFF" stroke="#D97706" filter="url(#shadow6)"/>
      <text x="110" y="323" font-size="8" font-weight="700" fill="#78350F" text-anchor="middle">Opportunity Active</text>

      <line x1="170" y1="320" x2="205" y2="320" stroke="#475569" stroke-width="1.5" marker-end="url(#sm-arr)"/>
      <rect x="210" y="300" width="105" height="38" rx="4" fill="#FFFFFF" stroke="#D97706" filter="url(#shadow6)"/>
      <text x="262" y="323" font-size="8" font-weight="700" fill="#78350F" text-anchor="middle">Proposal Formulated</text>

      <line x1="315" y1="320" x2="350" y2="320" stroke="#475569" stroke-width="1.5" marker-end="url(#sm-arr)"/>
      <rect x="355" y="300" width="95" height="38" rx="4" fill="#FFFFFF" stroke="#D97706" filter="url(#shadow6)"/>
      <text x="402" y="323" font-size="8" font-weight="700" fill="#78350F" text-anchor="middle">Negotiation</text>

      <!-- Won or Lost -->
      <path d="M 450 320 L 490 320 L 490 375 L 450 375" stroke="#16A34A" stroke-width="1.8" marker-end="url(#sm-arr)"/>
      <rect x="355" y="358" width="95" height="35" rx="4" fill="#DCFCE7" stroke="#16A34A"/>
      <text x="402" y="380" font-size="8" font-weight="800" fill="#14532D" text-anchor="middle">Closed Won</text>

      <path d="M 402 338 L 402 415 L 260 415" stroke="#DC2626" stroke-width="1.2" marker-end="url(#sm-arr)"/>
      <rect x="180" y="398" width="80" height="32" rx="3" fill="#FEE2E2" stroke="#EF4444"/>
      <text x="220" y="418" font-size="7" font-weight="700" fill="#991B1B" text-anchor="middle">Closed Lost</text>

      <!-- Lifecycle C: Customer Lifecycle -->
      <rect x="600" y="260" width="330" height="205" rx="6" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.5"/>
      <text x="615" y="280" font-size="10" font-weight="800" fill="#15803D">C. CUSTOMER LIFECYCLE</text>

      <!-- Won to Onboarding -->
      <path d="M 450 375 L 530 375 L 530 320 L 630 320" stroke="#16A34A" stroke-width="1.8" marker-end="url(#sm-arr)"/>

      <rect x="630" y="300" width="125" height="38" rx="4" fill="#FFFFFF" stroke="#16A34A" filter="url(#shadow6)"/>
      <text x="692" y="323" font-size="8" font-weight="700" fill="#14532D" text-anchor="middle">Customer Onboarding</text>

      <line x1="755" y1="320" x2="790" y2="320" stroke="#475569" stroke-width="1.5" marker-end="url(#sm-arr)"/>
      <rect x="795" y="300" width="115" height="38" rx="4" fill="#FFFFFF" stroke="#16A34A" filter="url(#shadow6)"/>
      <text x="852" y="323" font-size="8" font-weight="700" fill="#14532D" text-anchor="middle">Active Adoption</text>

      <!-- Expansion Signal -->
      <path d="M 852 338 L 852 390 L 760 390" stroke="#3B82F6" stroke-width="1.5" marker-end="url(#sm-arr)"/>
      <rect x="635" y="372" width="125" height="36" rx="4" fill="#DBEAFE" stroke="#3B82F6"/>
      <text x="697" y="394" font-size="7.5" font-weight="700" fill="#1E40AF" text-anchor="middle">Expansion Signal</text>

      <!-- Loop back to Opportunity Active -->
      <path d="M 635 390 L 590 390 L 590 250 L 110 250 L 110 300" fill="none" stroke="#2563EB" stroke-dasharray="3,3" stroke-width="1.2"/>
    </svg>
    """

    # SVG Diagram 7: Testing Pyramid (Section 16.1)
    svg_diagram_7 = """
    <svg viewBox="0 0 700 300" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <polygon points="350,20 450,85 250,85" fill="#EF4444" stroke="#DC2626" stroke-width="1.5"/>
      <text x="350" y="60" font-size="9" font-weight="800" fill="#FFFFFF" text-anchor="middle">E2E User Journeys</text>
      <text x="350" y="74" font-size="7.5" fill="#FEE2E2" text-anchor="middle">Playwright (Full Commercial Journeys)</text>

      <polygon points="250,88 450,88 510,150 190,150" fill="#F59E0B" stroke="#D97706" stroke-width="1.5"/>
      <text x="350" y="118" font-size="9.5" font-weight="800" fill="#FFFFFF" text-anchor="middle">Integration &amp; API Contract Tests</text>
      <text x="350" y="134" font-size="8" fill="#FEF3C7" text-anchor="middle">Pytest / DRF APIClient (HTTP 200/400 Envelopes)</text>

      <polygon points="190,153 510,153 570,215 130,215" fill="#3B82F6" stroke="#2563EB" stroke-width="1.5"/>
      <text x="350" y="182" font-size="9.5" font-weight="800" fill="#FFFFFF" text-anchor="middle">Domain Rule &amp; Stage Gate Validation Tests</text>
      <text x="350" y="198" font-size="8" fill="#DBEAFE" text-anchor="middle">Pytest (Hard Problem Gate, SQL SLAs, State Transitions)</text>

      <polygon points="130,218 570,218 630,280 70,280" fill="#10B981" stroke="#059669" stroke-width="1.5"/>
      <text x="350" y="247" font-size="10" font-weight="800" fill="#FFFFFF" text-anchor="middle">Unit Tests: ICP, Scoring, Models &amp; Serializers</text>
      <text x="350" y="263" font-size="8" fill="#D1FAE5" text-anchor="middle">Fast Isolated Pytest Suites (Dynamic Configuration Math)</text>
    </svg>
    """

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>TEXOL Configurable PLD CRM Platform — Technical Foundation Plan & Architecture Specification</title>
<style>
  @page {{
    size: A4;
    margin: 18mm 15mm 20mm 15mm;
    @bottom-right {{
      content: "Page " counter(page);
      font-size: 8pt;
      color: #64748B;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }}
    @bottom-left {{
      content: "TEXOL Configurable PLD CRM — Technical Foundation Plan";
      font-size: 8pt;
      color: #64748B;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }}
  }}

  *, *:before, *:after {{
    box-sizing: border-box;
  }}

  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1E293B;
    background: #FFFFFF;
    line-height: 1.55;
    font-size: 9.2pt;
    margin: 0;
    padding: 0;
  }}

  /* Cover Page */
  .cover-page {{
    min-height: 90vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 40px 20px 20px 20px;
    page-break-after: always;
  }}

  .cover-header {{
    border-bottom: 3px solid #1E3A8A;
    padding-bottom: 25px;
  }}

  .brand-badge {{
    display: inline-block;
    background: #1E3A8A;
    color: #FFFFFF;
    font-weight: 800;
    font-size: 10pt;
    letter-spacing: 0.1em;
    padding: 5px 12px;
    border-radius: 4px;
    text-transform: uppercase;
    margin-bottom: 20px;
  }}

  .cover-title {{
    font-size: 25pt;
    font-weight: 900;
    color: #0F172A;
    line-height: 1.15;
    margin: 0 0 10px 0;
    letter-spacing: -0.02em;
  }}

  .cover-subtitle {{
    font-size: 13pt;
    font-weight: 600;
    color: #2563EB;
    margin: 0 0 20px 0;
    line-height: 1.35;
  }}

  .guiding-principle-card {{
    background: #EFF6FF;
    border-left: 5px solid #2563EB;
    border-radius: 6px;
    padding: 16px 20px;
    margin: 25px 0;
  }}
  .guiding-principle-title {{
    font-size: 9pt;
    font-weight: 800;
    color: #1E40AF;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
  }}
  .guiding-principle-text {{
    font-size: 10.5pt;
    font-weight: 700;
    color: #1E3A8A;
    margin: 0;
    line-height: 1.45;
  }}

  .cover-meta-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    padding: 18px;
    margin-top: 20px;
  }}
  .meta-item {{ font-size: 8.5pt; }}
  .meta-label {{
    font-weight: 700;
    color: #64748B;
    text-transform: uppercase;
    font-size: 7.5pt;
    letter-spacing: 0.05em;
    margin-bottom: 3px;
  }}
  .meta-val {{ font-weight: 600; color: #0F172A; }}

  .cover-footer {{
    border-top: 1px solid #E2E8F0;
    padding-top: 15px;
    font-size: 8pt;
    color: #64748B;
    display: flex;
    justify-content: space-between;
  }}

  /* Headings */
  h1, h2, h3, h4 {{
    color: #0F172A;
    font-weight: 800;
    page-break-after: avoid;
  }}

  h1 {{
    font-size: 15pt;
    border-bottom: 2px solid #E2E8F0;
    padding-bottom: 5px;
    margin-top: 28px;
    margin-bottom: 12px;
    color: #1E3A8A;
  }}

  h2 {{
    font-size: 12pt;
    margin-top: 18px;
    margin-bottom: 8px;
    color: #1E293B;
  }}

  h3 {{
    font-size: 10pt;
    margin-top: 14px;
    margin-bottom: 6px;
    color: #334155;
  }}

  h4 {{
    font-size: 9.2pt;
    margin-top: 10px;
    margin-bottom: 4px;
    color: #475569;
  }}

  p {{
    margin: 0 0 9px 0;
    text-align: justify;
  }}

  ul, ol {{
    margin: 0 0 10px 0;
    padding-left: 20px;
  }}
  li {{ margin-bottom: 3.5px; }}

  /* Tables */
  table {{
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 16px 0;
    font-size: 8pt;
    page-break-inside: avoid;
  }}

  th, td {{
    border: 1px solid #CBD5E1;
    padding: 6px 9px;
    text-align: left;
    vertical-align: top;
  }}

  th {{
    background-color: #F1F5F9;
    color: #0F172A;
    font-weight: 700;
  }}

  tr:nth-child(even) td {{
    background-color: #F8FAFC;
  }}

  /* Diagram Container */
  .diagram-container {{
    margin: 14px 0 18px 0;
    padding: 12px;
    background: #FFFFFF;
    border: 1px solid #CBD5E1;
    border-radius: 8px;
    page-break-inside: avoid;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }}

  .diagram-title {{
    font-size: 9pt;
    font-weight: 800;
    color: #1E3A8A;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }}

  .diagram-caption {{
    font-size: 7.5pt;
    color: #64748B;
    margin-top: 6px;
    font-style: italic;
  }}

  /* Code & Pre */
  pre {{
    background: #0F172A;
    color: #E2E8F0;
    padding: 10px 14px;
    border-radius: 6px;
    font-family: Consolas, "Courier New", monospace;
    font-size: 7.5pt;
    overflow-x: auto;
    line-height: 1.45;
    margin: 10px 0 14px 0;
    page-break-inside: avoid;
  }}

  code {{
    font-family: Consolas, "Courier New", monospace;
    background: #F1F5F9;
    color: #0F172A;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 8pt;
  }}

  /* Badges & Tags */
  .badge {{
    display: inline-block;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 7pt;
    font-weight: 700;
    text-transform: uppercase;
  }}
  .badge-primary {{ background: #DBEAFE; color: #1E40AF; }}
  .badge-success {{ background: #D1FAE5; color: #065F46; }}
  .badge-warning {{ background: #FEF3C7; color: #92400E; }}
  .badge-danger {{ background: #FEE2E2; color: #991B1B; }}

  .page-break {{
    page-break-after: always;
  }}
</style>
</head>
<body>

<!-- Cover Page -->
<div class="cover-page">
  <div class="cover-header">
    <div class="brand-badge">TEXOL Technical Specification &amp; Implementation Blueprint</div>
    <h1 class="cover-title">TEXOL Configurable PLD CRM Platform</h1>
    <div class="cover-subtitle">Technical Foundation Plan &amp; Comprehensive Architecture Specification</div>
    
    <div class="guiding-principle-card">
      <div class="guiding-principle-title">Core Guiding Principle</div>
      <div class="guiding-principle-text">The CRM Core is 100% generic. Products are configurations, never code branches or product-specific database tables. VanForces™ is the first product configuration.</div>
    </div>
  </div>

  <div class="cover-meta-grid">
    <div class="meta-item">
      <div class="meta-label">Primary Source Documents</div>
      <div class="meta-val">TEXOL Configurable PLD CRM Master Specification &amp; VanForces Requirements v1.1</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Architecture Release Version</div>
      <div class="meta-val">Version 1.0 — Architecture &amp; Foundation Freeze</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Document Date &amp; Scope</div>
      <div class="meta-val">October 2026 | Full 17-Section Architecture Plan</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Technology Foundation</div>
      <div class="meta-val">Django 5.x REST Framework + PostgreSQL 16 + React 18 / Vite</div>
    </div>
  </div>

  <div class="cover-footer">
    <div>TEXOL Proprietary &amp; Confidential</div>
    <div>Complete Architecture, Domain Models, Workflows, Schemas &amp; Verification Plans</div>
  </div>
</div>

<!-- SECTION 1 -->
<h1>1. System Architecture</h1>

<h3>1.1 Architectural Principles</h3>
<ol>
  <li><strong>Generic Commercial Core vs. Dynamic PLD Engine</strong>: Universal commercial entities (Accounts, Contacts, Leads, Opportunities, Activities, Partners) reside in CRM Core. Qualification rules, ICP criteria, problem definitions, capability mappings, scoring dimensions, and stage gates reside in the dynamic PLD Engine.</li>
  <li><strong>Product as Configuration, Not Code</strong>: No table shall ever be named <code>vanforces_lead</code>, <code>entaura_pld</code>, or contain hardcoded product columns (e.g. <code>van_count</code>). Product-specific attributes are handled via versioned configuration schemas and generic EAV/JSONB attribute models (<code>account_attribute</code>).</li>
  <li><strong>Multi-Product First</strong>: A single organization/account can hold multiple product relationships (prospect, evaluation, customer, expansion) simultaneously. A lead can express interest in multiple products. An opportunity can contain multi-product line items.</li>
  <li><strong>Partner Organisation Multi-Tenancy Scope</strong>: External partners authenticate into a shared platform but are strictly isolated server-side to their assigned organisation scope and authorised products.</li>
  <li><strong>EntAura AI Boundary</strong>: AI/ML services consume structured CRM context and event streams via secure APIs; transactional business rules and database integrity are enforced strictly by the backend core.</li>
</ol>

<h3>1.2 Multi-Tier Logical Architecture</h3>
<div class="diagram-container">
  <div class="diagram-title">Diagram 1: Multi-Tier Logical &amp; Container Architecture</div>
  {svg_diagram_1}
  <div class="diagram-caption">End-to-end multi-tier architecture spanning Presentation, API Gateway, Application Services, Celery Workers, PostgreSQL Data Store, and External Boundaries.</div>
</div>

<div class="page-break"></div>

<!-- SECTION 2 -->
<h1>2. Frontend Architecture</h1>

<h3>2.1 Technology Stack &amp; Design System</h3>
<ul>
  <li><strong>Framework</strong>: React 18+ with TypeScript (strict mode enabled).</li>
  <li><strong>Build System</strong>: Vite (high performance, modern ESM bundling).</li>
  <li><strong>Styling &amp; Theme</strong>: Vanilla CSS / Tailwind CSS design system with an enterprise, high-contrast dark/light theme (Slate/Deep Blue palette) featuring glassmorphism accents, micro-animations, and strict WCAG 2.1 AA accessibility (color-blind friendly status indicators).</li>
  <li><strong>State Management</strong>:
    <ul>
      <li>Server State &amp; Caching: <strong>TanStack Query (React Query v5)</strong> for optimistic UI updates, background re-fetching, and cache invalidation.</li>
      <li>Global UI State: <strong>Zustand</strong> for light client-side state (active product filter, work queue layout, drawer toggles).</li>
    </ul>
  </li>
  <li><strong>Form Engine</strong>: <strong>React Hook Form</strong> paired with <strong>Zod</strong> schema validation and a <strong>Dynamic Form Renderer</strong> that dynamically builds qualification forms from JSON-defined product questionnaire templates.</li>
  <li><strong>Component Primitives</strong>: Radix UI / Headless UI for fully accessible dialogs, popovers, dropdowns, and tabs.</li>
  <li><strong>Icons &amp; Visuals</strong>: Lucide React.</li>
  <li><strong>Routing</strong>: React Router v6 with nested route layouts and data loader guards.</li>
</ul>

<h3>2.2 Frontend Modular Architecture</h3>
<pre>
frontend/
├── src/
│   ├── assets/                # Design tokens, global CSS, brand assets
│   ├── components/
│   │   ├── common/            # Button, Input, Modal, Badge, Dropdown, Table, EmptyState
│   │   ├── layout/            # AppShell, Sidebar, Header, Breadcrumbs, PartnerShell
│   │   ├── dynamic-forms/     # JSON-driven dynamic questionnaire &amp; gate checklist components
│   │   ├── pld/               # ScoreBadge, DimensionBreakdown, GateCard, FunnelVisualizer
│   │   ├── timeline/          # Unified ActivityTimeline, NextActionBanner
│   │   └── audit/             # FieldChangeHistoryDrawer, DiffViewer
│   ├── features/
│   │   ├── dashboard/         # Executive, PLD, and Partner dashboard views
│   │   ├── accounts/          # Account360, AccountList, AccountProductList
│   │   ├── contacts/          # ContactDirectory, ContactCard
│   │   ├── leads/             # LeadQueue, LeadIntakeModal, LeadTouchList
│   │   ├── pld-qualification/ # LeadQualificationWorkspace, ICPCheckPanel, ProblemSelector
│   │   ├── discovery/         # DiscoveryWorkspace, ProblemMappingMatrix
│   │   ├── demo/              # DemoScheduler, DemoFeedbackModal, DemoList
│   │   ├── poc/               # POCTracker, KPIBaselineMatrix, POCResultModal
│   │   ├── sql-handoff/       # SQLReadinessGateChecklist, SalesAcceptanceModal
│   │   ├── opportunities/     # OpportunityPipelineKanban, OpportunityDetailWorkspace
│   │   ├── proposals/         # ProposalBuilder, VersionHistory, DiscountApprovalModal
│   │   ├── partners/          # PartnerDirectory, DealRegistrationForm, CommissionReport
│   │   └── product-config/    # ProductStudio, ICPRuleBuilder, ScoreModelEditor, GateManager
│   ├── hooks/                 # useAuth, usePLDScore, useGateValidator, useTenantScope
│   ├── services/api/          # Axios / Fetch client with interceptors and typed endpoint SDK
│   ├── store/                 # Zustand slices for UI and active context
│   └── types/                 # Shared TypeScript models generated from backend schemas
</pre>

<!-- SECTION 3 -->
<h1>3. Backend Architecture</h1>

<h3>3.1 Technology Stack</h3>
<ul>
  <li><strong>Language &amp; Framework</strong>: Python 3.12+ with Django 5.x &amp; Django REST Framework (DRF).</li>
  <li><strong>Database Driver</strong>: <code>psycopg3</code> (native async support, connection pooling).</li>
  <li><strong>Task Queue</strong>: Celery 5.x with Redis 7.x as message broker and result backend.</li>
  <li><strong>API Documentation</strong>: <code>drf-spectacular</code> generating OpenAPI 3.1 / Swagger schemas.</li>
  <li><strong>Filtering &amp; Search</strong>: <code>django-filter</code> + PostgreSQL full-text search (<code>pg_trgm</code>).</li>
</ul>

<h3>3.2 Clean Layered Architecture</h3>
<div class="diagram-container">
  <div class="diagram-title">Diagram 2: Clean Layered Backend Architecture</div>
  {svg_diagram_2}
  <div class="diagram-caption">Data flow through API layer, domain services, dynamic evaluation engines, ORM querysets, and data stores.</div>
</div>

<h3>3.3 Dynamic Engine Strategy (Zero Hardcoded Product Logic)</h3>
<p>To maintain 100% product-agnostic code:</p>
<ul>
  <li>Product specifications are loaded into <code>ProductConfigurationVersion</code> records.</li>
  <li>The backend services load the active configuration version for the target product ID.</li>
  <li>ICP rules evaluate against Account and Lead data via a rule parser supporting operators: <code>EQUALS</code>, <code>NOT_EQUALS</code>, <code>GREATER_THAN</code>, <code>LESS_THAN</code>, <code>IN</code>, <code>CONTAINS</code>, <code>BETWEEN</code>.</li>
  <li>PLD scoring dynamically resolves dimension weights and value mapping functions from the DB-configured score model.</li>
  <li>Gate conditions are stored as structured rule definitions in <code>stage_gate.condition_rules</code> (JSONB) and validated deterministically before any stage progression is allowed.</li>
</ul>

<div class="page-break"></div>

<!-- SECTION 4 -->
<h1>4. PostgreSQL Database Architecture</h1>

<h3>4.1 Database Design Guidelines</h3>
<ol>
  <li><strong>Primary Keys</strong>: Universal <code>UUIDv4</code> primary keys across all domain entities (prevents enumeration attacks, simplifies distributed integration and partner isolation).</li>
  <li><strong>Audit Timestamps</strong>: All tables inherit from an abstract <code>TimeStampedModel</code> (<code>created_at</code>, <code>updated_at</code>, <code>created_by_id</code>, <code>updated_by_id</code>).</li>
  <li><strong>Soft Deletion</strong>: Business records utilize <code>is_deleted</code> and <code>deleted_at</code> fields to preserve audit history and foreign key referential integrity.</li>
  <li><strong>Data Isolation (Tenant &amp; Partner)</strong>: Every domain table includes <code>tenant_id</code> (defaults to TEXOL internal tenant, ready for multi-tenancy) and partner-specific tables carry <code>partner_id</code> with foreign key indexes.</li>
  <li><strong>JSONB with GIN Indexing</strong>: Used for:
    <ul>
      <li>Dynamic product-specific attributes (<code>account_attribute.value_json</code>)</li>
      <li>Rule definitions and gate conditions (<code>icp_rule.condition_json</code>, <code>stage_gate.condition_rules</code>)</li>
      <li>Historical rule snapshots (<code>score_assessment.dimension_scores_snapshot</code>)</li>
      <li>Field-level audit diffs (<code>audit_log.changes_json</code>)</li>
    </ul>
  </li>
  <li><strong>Indexing Strategy</strong>:
    <ul>
      <li>B-tree indexes on foreign keys, status fields, timestamps, and owner IDs.</li>
      <li>Composite indexes for frequent query pairs: <code>(account_id, product_id)</code>, <code>(stage_id, status)</code>, <code>(owner_id, next_activity_due)</code>.</li>
      <li>Trigram indexes (<code>pg_trgm</code>) on company name, contact email, and phone for fast duplicate detection.</li>
    </ul>
  </li>
</ol>

<!-- SECTION 5 -->
<h1>5. Complete Entity Relationship Diagram (ERD)</h1>

<div class="diagram-container">
  <div class="diagram-title">Diagram 3: Complete PostgreSQL Entity-Relationship Diagram (ERD)</div>
  {svg_diagram_3}
  <div class="diagram-caption">Complete entity relationship diagram covering Core Foundation, Dynamic Product Catalog, Leads &amp; Qualification, Deal Execution, and Universal Audit Trail.</div>
</div>

<h3>5.1 Detailed Table Schemas (41 Tables)</h3>

<h4>Core Commercial Master</h4>
<ol>
  <li><strong><code>accounts</code></strong>: <code>id (UUID PK)</code>, <code>tenant_id</code>, <code>company_name</code>, <code>legal_name</code>, <code>trade_name</code>, <code>account_type (Prospect/Customer/Partner/Vendor)</code>, <code>industry</code>, <code>sub_industry</code>, <code>country</code>, <code>state</code>, <code>city</code>, <code>company_size_band</code>, <code>website</code>, <code>domain</code>, <code>phone</code>, <code>employees_count</code>, <code>distribution_centers_count</code>, <code>primary_owner_id (FK User)</code>, <code>is_deleted</code>, timestamps.</li>
  <li><strong><code>account_attributes</code></strong>: <code>id (UUID PK)</code>, <code>account_id (FK)</code>, <code>product_id (FK)</code>, <code>attribute_key (e.g. salesmen_count, van_count, outlet_count, sku_count, current_erp)</code>, <code>attribute_value_json (JSONB)</code>, timestamps.</li>
  <li><strong><code>contacts</code></strong>: <code>id (UUID PK)</code>, <code>account_id (FK)</code>, <code>first_name</code>, <code>last_name</code>, <code>designation</code>, <code>email</code>, <code>phone</code>, <code>mobile</code>, <code>linkedin_url</code>, <code>role_type (Decision Maker/Champion/Influencer/Technical/Finance/User)</code>, <code>decision_level</code>, <code>preferred_channel</code>, <code>is_primary</code>, <code>consent_status</code>, timestamps.</li>
  <li><strong><code>account_products</code></strong>: <code>id (UUID PK)</code>, <code>account_id (FK)</code>, <code>product_id (FK)</code>, <code>status (Prospect/Evaluation/Customer/Inactive/Expansion)</code>, <code>contract_value</code>, <code>arr_mrr</code>, <code>renewal_date</code>, <code>health_score</code>, timestamps. <em>(Unique: account_id, product_id)</em>.</li>
</ol>

<h4>Product Catalog &amp; Dynamic PLD Configuration</h4>
<ol start="5">
  <li><strong><code>products</code></strong>: <code>id (UUID PK)</code>, <code>code (e.g. VANFORCES, ENTAURA, TASKFORCES)</code>, <code>name</code>, <code>category</code>, <code>status (Draft/Internal/Active/Sunset/Archived)</code>, <code>owner_id (FK User)</code>, timestamps.</li>
  <li><strong><code>product_modules</code></strong>: <code>id (UUID PK)</code>, <code>product_id (FK)</code>, <code>name</code>, <code>code</code>, <code>description</code>, <code>is_active</code>, timestamps.</li>
  <li><strong><code>product_capabilities</code></strong>: <code>id (UUID PK)</code>, <code>product_id (FK)</code>, <code>module_id (FK)</code>, <code>name</code>, <code>code</code>, <code>description</code>, <code>is_active</code>, timestamps.</li>
  <li><strong><code>problems</code></strong>: <code>id (UUID PK)</code>, <code>code</code>, <code>category (Sales/Distribution/Management/Integration/Compliance)</code>, <code>name</code>, <code>description</code>, <code>default_severity</code>, timestamps.</li>
  <li><strong><code>problem_capabilities</code></strong>: <code>id (UUID PK)</code>, <code>problem_id (FK)</code>, <code>capability_id (FK)</code>, <code>expected_kpi_impact</code>, timestamps.</li>
  <li><strong><code>product_configuration_versions</code></strong>: <code>id (UUID PK)</code>, <code>product_id (FK)</code>, <code>version_number (e.g. 1, 2, 3)</code>, <code>status (Draft/Published/Archived)</code>, <code>published_at</code>, <code>published_by_id (FK User)</code>, timestamps.</li>
  <li><strong><code>icp_rules</code></strong>: <code>id (UUID PK)</code>, <code>config_version_id (FK)</code>, <code>rule_type (Knockout/Fit)</code>, <code>field_name</code>, <code>operator (EQ/NEQ/GT/LT/IN/CONTAINS)</code>, <code>target_value_json</code>, <code>weight</code>, <code>points</code>, <code>is_mandatory</code>, timestamps.</li>
  <li><strong><code>score_models</code></strong>: <code>id (UUID PK)</code>, <code>config_version_id (FK)</code>, <code>dimension_name (Problem Severity/Business Value/Decision Access/Timeline/Technical Fit/Commercial Potential)</code>, <code>weight_percentage</code>, <code>input_mapping_json</code>, timestamps.</li>
  <li><strong><code>questionnaire_templates</code></strong>: <code>id (UUID PK)</code>, <code>config_version_id (FK)</code>, <code>title</code>, <code>stage_code (PLD_QUALIFICATION/DISCOVERY)</code>, <code>schema_json (JSON-Schema of questions, types, feeds_dimension)</code>, timestamps.</li>
  <li><strong><code>pipeline_stages</code></strong>: <code>id (UUID PK)</code>, <code>config_version_id (FK)</code>, <code>pipeline_type (Pursuit/Opportunity/Customer)</code>, <code>stage_code</code>, <code>stage_name</code>, <code>sequence_order</code>, <code>is_required (True=Mandatory, False=Optional)</code>, timestamps.</li>
  <li><strong><code>stage_gates</code></strong>: <code>id (UUID PK)</code>, <code>pipeline_stage_id (FK)</code>, <code>gate_code</code>, <code>gate_name</code>, <code>condition_rules_json</code>, <code>is_mandatory</code>, timestamps.</li>
</ol>

<div class="page-break"></div>

<h4>Leads &amp; Attribution</h4>
<ol start="16">
  <li><strong><code>leads</code></strong>: <code>id (UUID PK)</code>, <code>account_id (FK)</code>, <code>contact_id (FK)</code>, <code>primary_product_id (FK)</code>, <code>source_id (FK LeadSource)</code>, <code>partner_id (FK Partner nullable)</code>, <code>owner_id (FK User)</code>, <code>current_stage_id (FK PipelineStage)</code>, <code>status (Active/Nurture/Disqualified/Converted)</code>, <code>nurture_reason</code>, <code>disqualification_reason</code>, <code>last_activity_at</code>, <code>next_activity_due_at</code>, <code>next_action_description</code>, timestamps.</li>
  <li><strong><code>lead_product_interests</code></strong>: <code>id (UUID PK)</code>, <code>lead_id (FK)</code>, <code>product_id (FK)</code>, <code>interest_level (High/Medium/Low)</code>, <code>is_primary</code>, <code>evidence_notes</code>, timestamps.</li>
  <li><strong><code>lead_touches</code></strong>: <code>id (UUID PK)</code>, <code>lead_id (FK)</code>, <code>campaign_id (FK nullable)</code>, <code>partner_id (FK nullable)</code>, <code>source_id (FK LeadSource)</code>, <code>touch_type (Inbound Form/LinkedIn/Email/Event/Direct Call)</code>, <code>touch_date</code>, <code>utm_parameters_json</code>, timestamps.</li>
  <li><strong><code>lead_problems</code></strong>: <code>id (UUID PK)</code>, <code>lead_id (FK)</code>, <code>problem_id (FK)</code>, <code>problem_notes</code>, timestamps.</li>
</ol>

<h4>PLD Assessments &amp; Qualification</h4>
<ol start="20">
  <li><strong><code>account_product_assessments</code></strong>: <code>id (UUID PK)</code>, <code>account_id (FK)</code>, <code>product_id (FK)</code>, <code>config_version_id (FK)</code>, <code>lead_id (FK nullable)</code>, <code>icp_knockout_status (Passed/Failed)</code>, <code>icp_fit_score (0-100)</code>, <code>pld_score (0-100)</code>, <code>score_classification (Nurture/Development/Qualified/High Priority)</code>, <code>assessed_at</code>, <code>assessed_by_id (FK User)</code>, timestamps.</li>
  <li><strong><code>score_assessments</code></strong>: <code>id (UUID PK)</code>, <code>assessment_id (FK)</code>, <code>dimension_name</code>, <code>input_value_json</code>, <code>raw_score</code>, <code>weighted_score</code>, <code>evidence_text</code>, timestamps.</li>
</ol>

<h4>Discovery, Evaluation, Demos &amp; POCs</h4>
<ol start="22">
  <li><strong><code>discoveries</code></strong>: <code>id (UUID PK)</code>, <code>lead_id (FK)</code>, <code>account_id (FK)</code>, <code>conducted_by_id (FK User)</code>, <code>current_process_notes</code>, <code>business_impact_summary</code>, <code>stakeholders_involved_notes</code>, <code>decision_process_notes</code>, <code>timeline_notes</code>, <code>budget_notes</code>, <code>technical_constraints_notes</code>, <code>is_product_mapping_complete</code>, timestamps.</li>
  <li><strong><code>discovery_problems</code></strong>: <code>id (UUID PK)</code>, <code>discovery_id (FK)</code>, <code>problem_id (FK)</code>, <code>lead_problem_id (FK nullable)</code>, <code>severity (High/Medium/Low)</code>, <code>frequency (Daily/Weekly/Monthly)</code>, <code>impact_description</code>, <code>quantified_loss_value</code>, timestamps.</li>
  <li><strong><code>demos</code></strong>: <code>id (UUID PK)</code>, <code>account_id (FK)</code>, <code>lead_id (FK)</code>, <code>discovery_id (FK nullable)</code>, <code>opportunity_id (FK nullable)</code>, <code>scheduled_at</code>, <code>conducted_at</code>, <code>presenter_id (FK User)</code>, <code>participants_notes</code>, <code>demonstrated_use_cases_json</code>, <code>customer_feedback</code>, <code>objections_raised</code>, <code>fit_assessment</code>, <code>next_action_due_at</code>, <code>status (Scheduled/Completed/Cancelled/Not Required)</code>, <code>not_required_reason</code>, timestamps.</li>
  <li><strong><code>pocs</code></strong>: <code>id (UUID PK)</code>, <code>account_id (FK)</code>, <code>lead_id (FK)</code>, <code>discovery_id (FK nullable)</code>, <code>opportunity_id (FK nullable)</code>, <code>owner_id (FK User)</code>, <code>scope_description</code>, <code>users_count</code>, <code>geography_coverage</code>, <code>start_date</code>, <code>end_date</code>, <code>success_criteria_json</code>, <code>baseline_metrics_json</code>, <code>result_metrics_json</code>, <code>status (Planned/Active/Review/Completed/Failed/Cancelled/Not Required)</code>, <code>not_required_reason</code>, timestamps.</li>
  <li><strong><code>sql_handoffs</code></strong>: <code>id (UUID PK)</code>, <code>lead_id (FK)</code>, <code>product_id (FK)</code>, <code>pld_executive_id (FK User)</code>, <code>assigned_sales_owner_id (FK User)</code>, <code>gate_audit_results_json</code>, <code>sla_expires_at</code>, <code>status (Pending/Accepted/Rejected)</code>, <code>decision_date</code>, <code>rejection_reason_notes</code>, timestamps.</li>
</ol>

<h4>Opportunities &amp; Proposals</h4>
<ol start="27">
  <li><strong><code>opportunities</code></strong>: <code>id (UUID PK)</code>, <code>account_id (FK)</code>, <code>primary_contact_id (FK)</code>, <code>owner_id (FK User)</code>, <code>sql_handoff_id (FK nullable)</code>, <code>type (New/Expansion/Renewal)</code>, <code>stage_id (FK PipelineStage)</code>, <code>status (Open/Won/Lost)</code>, <code>total_contract_value</code>, <code>arr_mrr</code>, <code>pricing_plan</code>, <code>seat_units_count</code>, <code>contract_term_months</code>, <code>currency (ISO 4217, e.g. USD, SAR, INR)</code>, <code>probability_pct</code>, <code>expected_close_date</code>, <code>loss_reason_category</code>, <code>loss_reason_notes</code>, timestamps.</li>
  <li><strong><code>opportunity_products</code></strong>: <code>id (UUID PK)</code>, <code>opportunity_id (FK)</code>, <code>product_id (FK)</code>, <code>quantity</code>, <code>unit_price</code>, <code>total_amount</code>, <code>term_months</code>, timestamps.</li>
  <li><strong><code>opportunity_capabilities</code></strong>: <code>id (UUID PK)</code>, <code>opportunity_id (FK)</code>, <code>capability_id (FK)</code>, timestamps.</li>
  <li><strong><code>partner_influences</code></strong>: <code>id (UUID PK)</code>, <code>opportunity_id (FK)</code>, <code>partner_id (FK)</code>, <code>influence_type (Originator/Sponsor/Co-Seller/Implementer)</code>, <code>influence_pct</code>, timestamps.</li>
  <li><strong><code>proposals</code></strong>: <code>id (UUID PK)</code>, <code>opportunity_id (FK)</code>, <code>version_number</code>, <code>proposal_document_url</code>, <code>gross_amount</code>, <code>discount_pct</code>, <code>net_amount</code>, <code>valid_until</code>, <code>status (Draft/Submitted/Approved/Rejected/Expired)</code>, <code>approval_required_flag</code>, timestamps.</li>
</ol>

<h4>Partner Framework</h4>
<ol start="32">
  <li><strong><code>partners</code></strong>: <code>id (UUID PK)</code>, <code>account_id (FK Organization)</code>, <code>partner_code</code>, <code>partner_type (ERP Partner/SAP Partner/Odoo Partner/SI/Consultant/Referral)</code>, <code>territory</code>, <code>status (Prospect/Onboarding/Enabled/Authorised/Active/Suspended/Inactive)</code>, <code>partner_manager_id (FK User)</code>, timestamps.</li>
  <li><strong><code>partner_users</code></strong>: <code>id (UUID PK)</code>, <code>partner_id (FK)</code>, <code>user_id (FK User)</code>, <code>partner_role (Admin/Sales/Presales)</code>, <code>is_active</code>, timestamps.</li>
  <li><strong><code>partner_products</code></strong>: <code>id (UUID PK)</code>, <code>partner_id (FK)</code>, <code>product_id (FK)</code>, <code>authorization_status (Certified/Authorized/Under Evaluation)</code>, <code>territory</code>, <code>commission_rate_pct</code>, <code>valid_from</code>, <code>valid_to</code>, timestamps.</li>
  <li><strong><code>deal_registrations</code></strong>: <code>id (UUID PK)</code>, <code>partner_id (FK)</code>, <code>registered_by_user_id (FK User)</code>, <code>customer_account_id (FK Account)</code>, <code>product_id (FK)</code>, <code>expected_deal_value</code>, <code>evidence_notes</code>, <code>protection_expiry_date</code>, <code>status (Submitted/Under Review/Accepted/Rejected/Expired)</code>, <code>rejection_reason</code>, timestamps.</li>
  <li><strong><code>partner_commissions</code></strong>: <code>id (UUID PK)</code>, <code>partner_id (FK)</code>, <code>opportunity_id (FK)</code>, <code>deal_registration_id (FK nullable)</code>, <code>commission_amount</code>, <code>calculation_basis</code>, <code>payment_status (Accrued/Approved/Paid)</code>, <code>paid_at</code>, timestamps.</li>
</ol>

<h4>Cross-Cutting &amp; Governance</h4>
<ol start="37">
  <li><strong><code>activities</code></strong>: <code>id (UUID PK)</code>, <code>account_id (FK nullable)</code>, <code>lead_id (FK nullable)</code>, <code>opportunity_id (FK nullable)</code>, <code>activity_type (Call/Email/WhatsApp/Meeting/Discovery/Demo/POC/Follow-up/Site Visit/Partner Meeting)</code>, <code>subject</code>, <code>description_notes</code>, <code>conducted_at</code>, <code>due_date</code>, <code>outcome_notes</code>, <code>next_action_description</code>, <code>next_action_due_at</code>, <code>performed_by_id (FK User)</code>, timestamps.</li>
  <li><strong><code>tasks</code></strong>: <code>id (UUID PK)</code>, <code>assigned_to_id (FK User)</code>, <code>related_lead_id (FK nullable)</code>, <code>related_opportunity_id (FK nullable)</code>, <code>task_type (First Contact/Follow-up/Gate Missing/SLA Expiry/POC Review)</code>, <code>priority (Urgent/High/Medium/Low)</code>, <code>due_date</code>, <code>is_completed</code>, <code>completed_at</code>, timestamps.</li>
  <li><strong><code>stage_histories</code></strong>: <code>id (UUID PK)</code>, <code>record_type (Lead/Opportunity/POC/DealRegistration)</code>, <code>record_id (UUID)</code>, <code>from_stage_id (FK nullable)</code>, <code>to_stage_id (FK PipelineStage)</code>, <code>transition_reason</code>, <code>is_override</code>, <code>override_approved_by_id (FK User nullable)</code>, <code>changed_by_id (FK User)</code>, <code>created_at</code>.</li>
  <li><strong><code>approvals</code></strong>: <code>id (UUID PK)</code>, <code>record_type</code>, <code>record_id</code>, <code>approval_type (Stage Gate Override/Discount Exception/Score Override)</code>, <code>requested_by_id (FK User)</code>, <code>approver_id (FK User nullable)</code>, <code>status (Pending/Approved/Rejected)</code>, <code>justification_notes</code>, <code>decision_notes</code>, <code>decision_date</code>, timestamps.</li>
  <li><strong><code>audit_logs</code></strong>: <code>id (UUID PK)</code>, <code>actor_id (FK User nullable)</code>, <code>actor_email</code>, <code>actor_role</code>, <code>ip_address</code>, <code>entity_type</code>, <code>entity_id</code>, <code>action (CREATE/UPDATE/DELETE/GATE_OVERRIDE/LOGIN)</code>, <code>changes_json (diff of old vs new fields)</code>, <code>timestamp</code>.</li>
</ol>

<div class="page-break"></div>

<!-- SECTION 6 -->
<h1>6. Django App / Module Structure</h1>

<p>The backend application is structured inside <code>backend/</code> across single-responsibility domain apps:</p>
<pre>
backend/
├── manage.py
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── local.py
│   │   └── production.py
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
├── apps/
│   ├── core/                        # Abstract models, UUID base, tenant context, utility validators
│   ├── authentication/              # Custom User, JWT tokens, RBAC permissions, Partner user profile
│   ├── accounts/                    # Accounts, Dynamic Account Attributes, Contacts, Account-Product states
│   ├── products/                    # Products, Modules, Capabilities, Problems, Problem-Capability mapping
│   ├── pld_engine/                  # Versioned Config, ICP Rules, Scoring Models, Dynamic Questionnaires
│   ├── leads/                       # Leads, Multi-product interest, Multi-touch attribution, Lead Problems
│   ├── discovery/                   # Discovery, Discovery Problems, Use-case mappings
│   ├── evaluations/                 # Demos, POCs/Pilots, KPI Baseline/Target tracking
│   ├── sales_handoff/               # SQL Gate evaluation, Sales Acceptance/Rejection workflow, SLAs
│   ├── opportunities/               # Opportunities, Multi-product lines, Capability demands, Proposals
│   ├── partners/                    # Partner Master, Authorizations, Deal Registrations, Commissions
│   ├── activities/                  # Unified Activity timeline, Tasks, Next-action alerts &amp; escalations
│   ├── workflows/                   # State Machine definitions, Stage History, Approvals &amp; Gate Overrides
│   ├── audit_logging/               # Automated signal/middleware audit tracker, field diff recorder
│   ├── notifications/               # In-app alerts, Celery workers, Email/WhatsApp provider adapters
│   ├── analytics/                   # Funnel calculations, leakage analysis, Executive KPI aggregation
│   └── integrations/                # Inbound webhooks (forms, LinkedIn), ERP adapter hooks, EntAura AI API
</pre>

<!-- SECTION 7 -->
<h1>7. REST API Structure</h1>

<p>All endpoints adhere to <code>/api/v1/</code> prefix with standardized JSON envelopes, pagination, and error representations.</p>

<h3>7.1 Key Endpoints Matrix</h3>

<table>
  <thead>
    <tr>
      <th style="width: 18%;">Domain Area</th>
      <th style="width: 14%;">HTTP Method</th>
      <th style="width: 38%;">Endpoint URI</th>
      <th style="width: 30%;">Purpose &amp; Architectural Context</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Auth &amp; Profile</strong></td>
      <td><code>POST</code><br><code>GET</code></td>
      <td><code>/api/v1/auth/token/</code><br><code>/api/v1/auth/me/</code></td>
      <td>JWT token acquisition<br>Current user profile, permissions, partner scope</td>
    </tr>
    <tr>
      <td><strong>Accounts</strong></td>
      <td><code>GET / POST</code><br><code>GET/PUT/PATCH</code><br><code>GET / POST</code><br><code>GET</code></td>
      <td><code>/api/v1/accounts/</code><br><code>/api/v1/accounts/{{id}}/</code><br><code>/api/v1/accounts/{{id}}/attributes/</code><br><code>/api/v1/accounts/{{id}}/products/</code></td>
      <td>List/filter accounts, create account<br>Retrieve/update account<br>Get/upsert dynamic product attributes<br>Multi-product relationships &amp; status</td>
    </tr>
    <tr>
      <td><strong>Contacts</strong></td>
      <td><code>GET / POST</code></td>
      <td><code>/api/v1/contacts/</code></td>
      <td>List and create contacts</td>
    </tr>
    <tr>
      <td><strong>Products &amp; Config</strong></td>
      <td><code>GET</code><br><code>GET / POST</code><br><code>POST</code><br><code>GET</code></td>
      <td><code>/api/v1/products/</code><br><code>/api/v1/products/{{id}}/configurations/</code><br><code>/api/v1/products/{{id}}/configurations/{{vid}}/publish/</code><br><code>/api/v1/products/{{id}}/questionnaires/</code></td>
      <td>List active products<br>List or draft configuration versions<br>Publish configuration version (Admin only)<br>Fetch dynamic questionnaire template for stage</td>
    </tr>
    <tr>
      <td><strong>Problems &amp; Taxonomy</strong></td>
      <td><code>GET / POST</code><br><code>GET</code></td>
      <td><code>/api/v1/problems/</code><br><code>/api/v1/problems/mapping/</code></td>
      <td>Master problem library<br>Problem to capability mappings</td>
    </tr>
    <tr>
      <td><strong>Leads &amp; PLD</strong></td>
      <td><code>GET / POST</code><br><code>POST</code><br><code>GET / PUT</code><br><code>POST</code><br><code>POST</code></td>
      <td><code>/api/v1/leads/</code><br><code>/api/v1/leads/intake/</code><br><code>/api/v1/leads/{{id}}/product-interests/</code><br><code>/api/v1/leads/{{id}}/evaluate-icp/</code><br><code>/api/v1/leads/{{id}}/evaluate-pld-score/</code></td>
      <td>Lead directory with PLD filter presets<br>Public/webhook lead ingestion<br>Manage multi-product interests<br>Trigger automatic ICP check<br>Submit questionnaire answers &amp; compute score</td>
    </tr>
    <tr>
      <td><strong>Discovery</strong></td>
      <td><code>GET / POST</code><br><code>POST</code><br><code>POST</code></td>
      <td><code>/api/v1/discoveries/</code><br><code>/api/v1/discoveries/{{id}}/problems/</code><br><code>/api/v1/discoveries/{{id}}/complete-mapping/</code></td>
      <td>Create or retrieve discovery workspace<br>Link confirmed problems &amp; quantify impact<br>Validate product mapping gate</td>
    </tr>
    <tr>
      <td><strong>Demo &amp; POC</strong></td>
      <td><code>GET / POST</code><br><code>POST</code><br><code>POST</code><br><code>GET / POST</code><br><code>POST</code></td>
      <td><code>/api/v1/demos/</code><br><code>/api/v1/demos/{{id}}/complete/</code><br><code>/api/v1/demos/{{id}}/mark-not-required/</code><br><code>/api/v1/pocs/</code><br><code>/api/v1/pocs/{{id}}/complete/</code></td>
      <td>Schedule/log demo<br>Complete demo with feedback &amp; next action<br>Skip demo with required reason<br>Plan and manage POC tracker<br>Record POC actuals &amp; success criteria</td>
    </tr>
    <tr>
      <td><strong>SQL Handoff</strong></td>
      <td><code>GET</code><br><code>POST</code><br><code>POST</code><br><code>POST</code></td>
      <td><code>/api/v1/leads/{{id}}/sql-gate-status/</code><br><code>/api/v1/leads/{{id}}/mark-sql-ready/</code><br><code>/api/v1/sql-handoffs/{{id}}/accept/</code><br><code>/api/v1/sql-handoffs/{{id}}/reject/</code></td>
      <td>Inspect gate readiness checklist<br>Validate gates and trigger handoff<br>Sales accept -&gt; converts to Opportunity<br>Sales reject with reason -&gt; returns to PLD</td>
    </tr>
    <tr>
      <td><strong>Opportunities</strong></td>
      <td><code>GET / POST</code><br><code>POST</code><br><code>POST</code></td>
      <td><code>/api/v1/opportunities/</code><br><code>/api/v1/opportunities/{{id}}/proposals/</code><br><code>/api/v1/opportunities/{{id}}/transition-stage/</code></td>
      <td>Opportunity list and pipeline Kanban<br>Generate/upload versioned proposal<br>Stage movement with gate enforcement</td>
    </tr>
    <tr>
      <td><strong>Partners</strong></td>
      <td><code>GET / POST</code><br><code>GET / POST</code><br><code>POST</code></td>
      <td><code>/api/v1/partners/</code><br><code>/api/v1/deal-registrations/</code><br><code>/api/v1/deal-registrations/{{id}}/decide/</code></td>
      <td>Manage partner directory<br>Submit/review protected deal registration<br>Accept or Reject deal registration</td>
    </tr>
    <tr>
      <td><strong>Cross-Cutting</strong></td>
      <td><code>GET / POST</code><br><code>POST</code><br><code>GET</code><br><code>GET</code></td>
      <td><code>/api/v1/activities/</code><br><code>/api/v1/approvals/{{id}}/decide/</code><br><code>/api/v1/analytics/funnel/</code><br><code>/api/v1/audit/</code></td>
      <td>Unified timeline logging<br>Approve/reject gate or discount exception<br>PLD Funnel &amp; leakage metrics<br>Filterable entity audit trail</td>
    </tr>
    <tr>
      <td><strong>EntAura AI API</strong></td>
      <td><code>GET</code></td>
      <td><code>/api/v1/ai/context/{{entity_type}}/{{id}}/</code></td>
      <td>Structured context extraction for LLM</td>
    </tr>
  </tbody>
</table>

<div class="page-break"></div>

<!-- SECTION 8 -->
<h1>8. React Route Structure</h1>

<pre>
/
├── login                                       # Authentication
├── unauthorized                                # Access Denied Screen
├── app/                                        # Internal TEXOL CRM Shell
│   ├── dashboard                               # Executive &amp; Funnel Dashboard
│   ├── queue                                   # PLD Executive Work Queue
│   ├── accounts/
│   │   ├── :id                                 # Account 360 Workspace
│   │   └── index                               # Accounts Directory
│   ├── contacts/index                          # Contact Directory
│   ├── leads/
│   │   ├── :id/qualification                   # One-Screen PLD Qualification
│   │   ├── :id/discovery                       # Discovery &amp; Problem Mapping
│   │   ├── :id/sql-readiness                   # SQL Gate Checklist &amp; Handoff
│   │   └── index                               # Lead Queue &amp; Intake
│   ├── demos/index                             # Demo Management &amp; Schedules
│   ├── pocs/index                              # POC Tracker &amp; KPI Baseline
│   ├── opportunities/
│   │   ├── pipeline                            # Opportunity Kanban Board
│   │   ├── :id                                 # Opportunity 360 &amp; Proposal
│   │   └── index                               # Opportunity List
│   ├── partners/
│   │   ├── :id                                 # Partner 360 &amp; Authorizations
│   │   └── index                               # Partner Network Management
│   ├── product-studio/
│   │   ├── :productId/versions                 # Configuration Version Manager
│   │   ├── :productId/icp                      # Knockout &amp; Fit Rule Editor
│   │   ├── :productId/scoring                  # Dimension Weights &amp; Point Editor
│   │   ├── :productId/gates                    # Pipeline Stage &amp; Gate Editor
│   │   ├── :productId/questionnaire            # Dynamic Question Builder
│   │   └── index                               # Product Catalog
│   ├── analytics/
│   │   ├── funnel                              # PLD Funnel Leakage Analysis
│   │   └── attribution                         # Source / Campaign / Partner ROI
│   └── settings/
│       ├── users                               # User &amp; Role Matrix
│       ├── approvals                           # Pending Gate/Discount Approvals
│       └── audit                               # Universal Audit Log Viewer
└── partner-portal/                             # Partner Portal (Scoped Shell)
    ├── dashboard                               # Partner Deal &amp; Commission KPI
    ├── register-deal                           # Protected Deal Registration
    ├── my-deals                                # Registered Deals &amp; Stage Status
    ├── enablement                              # Certified Products &amp; Collateral
    └── activities                              # Partner Activity Log
</pre>

<!-- SECTION 9 -->
<h1>9. Authentication and RBAC Architecture</h1>

<h3>9.1 User Roles Matrix (12 Roles)</h3>
<ol>
  <li><strong>Platform Admin</strong>: Global system access, user management, configuration publishing, override approvals.</li>
  <li><strong>TEXOL Management</strong>: Global read visibility across all products, funnel analytics, revenue reports, executive approvals.</li>
  <li><strong>Sales Manager</strong>: Team/territory pipeline visibility, SQL acceptance monitoring, SLA escalations, discount approvals.</li>
  <li><strong>Sales / BDM</strong>: Assigned accounts/opportunities, SQL acceptance/rejection, proposal generation, commercial negotiations.</li>
  <li><strong>PLD Executive</strong>: Assigned leads, qualification questionnaires, problem documentation, discovery sessions, SQL readiness preparation.</li>
  <li><strong>Solution Consultant (Presales)</strong>: Discovery technical fit, demo execution, POC parameterization, KPI verification.</li>
  <li><strong>Marketing</strong>: Campaign management, lead source configuration, top-of-funnel intake, attribution analytics.</li>
  <li><strong>Product Manager</strong>: Product catalog ownership, ICP definition, problem/capability taxonomy, scoring model authoring.</li>
  <li><strong>Customer Success</strong>: Post-sale onboarding, account-product adoption tracking, expansion signal identification.</li>
  <li><strong>Partner Manager</strong>: Partner onboarding, product authorization, deal registration review, commission payouts.</li>
  <li><strong>Partner User</strong>: Strictly scoped to own partner organization: deal submission, tracking own leads/deals, collateral access.</li>
  <li><strong>Finance / Operations</strong>: Commercial reporting, margin checks, contract audits, commission validation.</li>
</ol>

<h3>9.2 Data Scoping &amp; Row-Level Security</h3>
<p>The system enforces 4 hierarchical data scoping tiers:</p>
<ul>
  <li><strong>Global Scope</strong>: Platform Admin, TEXOL Management.</li>
  <li><strong>Territory / Team Scope</strong>: Sales Managers, Partner Managers.</li>
  <li><strong>Owner Scope</strong>: Sales BDM, PLD Executives, Solution Consultants (see records where <code>owner_id == user.id</code> OR record is explicitly shared).</li>
  <li><strong>Partner Organisation Scope (Strict Tenant Isolation)</strong>: Enforced via <code>PartnerScopedQuerySet</code> filtering <code>WHERE partner_id = request.user.partner_user.partner_id</code>. Partner users cannot see other partners' data, margins, or internal TEXOL notes.</li>
</ul>

<div class="page-break"></div>

<!-- SECTION 10 -->
<h1>10. Product Configuration Architecture</h1>

<div class="diagram-container">
  <div class="diagram-title">Diagram 4: Product Configuration Architecture Class Diagram</div>
  {svg_diagram_4}
  <div class="diagram-caption">Dynamic Product Metamodel: Product relates 1-to-many with immutable versions, defining modular rules, scoring models, and gates.</div>
</div>

<h3>10.1 Versioning Lifecycle &amp; Historical Reproducibility</h3>
<ul>
  <li>Product Managers modify rules in a <strong><code>Draft</code></strong> configuration version.</li>
  <li>Upon validation, clicking "Publish Version" transitions status to <strong><code>Published</code></strong> and sets prior versions to <strong><code>Archived</code></strong>.</li>
  <li>Whenever an ICP Check or PLD Score Assessment is executed, the record stores:
    <ul>
      <li><code>product_id</code></li>
      <li><code>config_version_id</code> (the exact immutable version used)</li>
      <li>Dimension input values and resulting score points</li>
    </ul>
  </li>
  <li><strong>Result</strong>: Historical qualification scores remain 100% explainable and reproducible even if the product manager later rebalances weights.</li>
</ul>

<!-- SECTION 11 -->
<h1>11. PLD Engine Architecture</h1>

<p>The PLD Engine operates as 3 discrete, chained evaluation pipelines:</p>

<div class="diagram-container">
  <div class="diagram-title">Diagram 5: PLD Engine 3-Pipeline Architecture</div>
  {svg_diagram_5}
  <div class="diagram-caption">Pipeline 1 (ICP Engine) feeds into Pipeline 2 (PLD 6-Dimension Scorer), which validates against Pipeline 3 (Stage Gate Validator).</div>
</div>

<h3>11.1 ICP Engine Logic</h3>
<ol>
  <li><strong>Knock-Out Check</strong>: Evaluates binary criteria (e.g. Industry in allowed list, geography within supported territories). If any knockout rule fails, <code>icp_knockout_status = FAILED</code> and the record transitions to <code>Disqualified</code> or <code>Nurture</code>.</li>
  <li><strong>Fit Score</strong>: Non-knockout criteria (e.g. employee count, digital maturity) calculate a normalized 0–100 score.</li>
</ol>

<h3>11.2 PLD Scoring Engine</h3>
<p>Calculates score across the 6 standard dimensions using active version weights (VanForces illustrative weights shown):</p>
<ul>
  <li>Problem Severity (25%)</li>
  <li>Business Value (20%)</li>
  <li>Decision-Maker Access (15%)</li>
  <li>Timeline (10%)</li>
  <li>Technical Fit (15%)</li>
  <li>Commercial Potential (15%)</li>
</ul>
<p><strong>Score Output Classifications</strong>:</p>
<ul>
  <li><code>0–30</code>: <strong>Nurture</strong></li>
  <li><code>31–60</code>: <strong>PLD Development</strong></li>
  <li><code>61–80</code>: <strong>Qualified PLD</strong></li>
  <li><code>81–100</code>: <strong>High Priority</strong></li>
</ul>
<p><em>Key Architecture Rule</em>: <strong>Scores determine priority; Stage Gates control progression.</strong> A lead with score 90/100 still cannot advance without at least one documented business problem!</p>

<div class="page-break"></div>

<!-- SECTION 12 -->
<h1>12. Workflow &amp; State-Machine Architecture</h1>

<div class="diagram-container">
  <div class="diagram-title">Diagram 6: Commercial Lifecycles State Machine</div>
  {svg_diagram_6}
  <div class="diagram-caption">Connected state transitions across Pursuit (PLD), Opportunity (Commercial Execution), and Customer (Adoption &amp; Expansion) lifecycles.</div>
</div>

<h3>12.1 Transition &amp; Stage Gate Rules</h3>
<ol>
  <li><strong>Backward Transitions</strong>: Moving backwards (e.g. SQL Ready back to Discovery) requires a <code>transition_reason</code> captured in <code>stage_history</code>.</li>
  <li><strong>Skipping Stages</strong>:
    <ul>
      <li>If a stage is marked <code>is_required=False</code> in the product pipeline, the user can mark it "Not Required" with an explanatory reason.</li>
      <li>If <code>is_required=True</code>, skipping requires an explicit <code>APPROVAL</code> record authorized by a Manager/Admin.</li>
    </ul>
  </li>
  <li><strong>Mandatory Next Action Rule</strong>: No active commercial record can be saved without a valid <code>next_activity_due_at</code> and <code>next_action_description</code>.</li>
</ol>

<!-- SECTION 13 -->
<h1>13. Audit Architecture</h1>

<h3>13.1 Universal Audit Pattern</h3>
<p>The audit architecture guarantees non-repudiation and enterprise traceability:</p>
<ul>
  <li><strong>Mechanism</strong>: Handled via Django model signals (<code>post_save</code>, <code>post_delete</code>) and a custom <code>AuditMiddleware</code> that injects the current <code>actor</code>, <code>ip_address</code>, and <code>user_agent</code> into thread-local context.</li>
  <li><strong>Tracked Changes</strong>:
    <ul>
      <li>Entity Creation &amp; Deletion</li>
      <li>Field modifications: captures <code>{{ field_name: {{ "old": old_val, "new": new_val }} }}</code></li>
      <li>Gate Overrides and Approvals</li>
      <li>PLD Score Overrides and Re-evaluations</li>
      <li>Ownership and Assignment changes</li>
      <li>Deal Registration decisions</li>
    </ul>
  </li>
  <li><strong>Immutability</strong>: The <code>audit_logs</code> table has database-level write-once rules; updates and deletions are disabled for audit records.</li>
</ul>

<!-- SECTION 14 -->
<h1>14. Notification &amp; Integration Architecture</h1>

<h3>14.1 Notification Architecture</h3>
<ul>
  <li><strong>In-App Alerts</strong>: Real-time notifications via WebSocket / polling for SLA breaches, approvals, and high-score leads.</li>
  <li><strong>Adapter Pattern for Channels</strong>:
    <ul>
      <li>Email Adapter: Pluggable interface (<code>EmailProvider</code>) supporting SMTP, SendGrid, and AWS SES.</li>
      <li>WhatsApp Adapter: Pluggable interface (<code>WhatsAppProvider</code>) supporting Twilio, Infobip, and Meta Cloud API.</li>
    </ul>
  </li>
</ul>

<h3>14.2 Integration Boundaries</h3>
<ol>
  <li><strong>Inbound Webhooks</strong>: Public endpoints for website inquiry forms and marketing campaign platforms (with signature verification).</li>
  <li><strong>ERP Integration Gateway</strong>: Inbound/outbound REST hooks for synchronizing customer master data and ERP presence signals.</li>
  <li><strong>EntAura AI Boundary</strong>: EntAura AI interacts exclusively via authenticated read endpoints (<code>/api/v1/ai/context/...</code>) and submits recommendations through an asynchronous queue. EntAura <strong>never</strong> executes direct un-audited transactional writes to the CRM.</li>
</ol>

<div class="page-break"></div>

<!-- SECTION 15 -->
<h1>15. Development Phases</h1>

<table>
  <thead>
    <tr>
      <th style="width: 15%;">Phase</th>
      <th style="width: 25%;">Milestone Name</th>
      <th style="width: 30%;">Scope Covered</th>
      <th style="width: 30%;">Deliverables &amp; Outcomes</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><span class="badge badge-primary">Phase 1</span></td>
      <td><strong>Core Foundation &amp; PLD MVP</strong></td>
      <td>Accounts, Contacts, Leads, Dynamic Product Config Master, ICP Engine, Problem Library, Questionnaire Engine, PLD Scoring, Discovery, Demo, SQL Handoff, Opportunity, Activity &amp; Audit Trail</td>
      <td>Usable end-to-end PLD CRM with VanForces as first product configuration</td>
    </tr>
    <tr>
      <td><span class="badge badge-primary">Phase 2</span></td>
      <td><strong>Evaluation &amp; Deal Lifecycle</strong></td>
      <td>POC/Pilot tracker, Versioned Proposals, Discount Approvals, Partner Master, Partner Portal, Deal Registration, SLAs &amp; Notifications</td>
      <td>Complete commercial negotiation &amp; partner collaboration</td>
    </tr>
    <tr>
      <td><span class="badge badge-primary">Phase 3</span></td>
      <td><strong>Multi-Touch &amp; Advanced Integrations</strong></td>
      <td>Multi-touch campaign attribution, Email/WhatsApp adapters, ERP customer master sync, Advanced funnel leakage reports</td>
      <td>Automated omni-channel tracking and ERP alignment</td>
    </tr>
    <tr>
      <td><span class="badge badge-primary">Phase 4</span></td>
      <td><strong>EntAura AI &amp; Telemetry</strong></td>
      <td>EntAura context retrieval APIs, AI lead prioritization, discovery summarizer, next best action recommender, product telemetry ingestion</td>
      <td>Closed-loop AI-assisted product-led growth</td>
    </tr>
  </tbody>
</table>

<!-- SECTION 16 -->
<h1>16. Testing Strategy</h1>

<h3>16.1 Testing Pyramid &amp; QA Layers</h3>
<div class="diagram-container">
  <div class="diagram-title">Diagram 7: Testing Pyramid &amp; Verification Tiers</div>
  {svg_diagram_7}
  <div class="diagram-caption">Four-tiered testing architecture ensuring domain accuracy, API contracts, security rules, and end-to-end user journeys.</div>
</div>

<h3>16.2 Acceptance Test Matrix (from Specifications)</h3>
<ol>
  <li><strong>AT-001 (Account Duplication)</strong>: System checks domain/website; triggers warning and deduplication options.</li>
  <li><strong>AT-002 (Multi-Product Interest)</strong>: Lead can attach VanForces and TaskForces with independent primary flags and interest levels.</li>
  <li><strong>AT-003 (Dynamic ICP Configuration)</strong>: Admin alters ICP industry criteria in UI; new leads evaluate against revised rules without backend restart.</li>
  <li><strong>AT-004 (PLD Score Repeatability)</strong>: Identical questionnaire inputs yield exact score; dimension breakdown verified.</li>
  <li><strong>AT-005 (Gate Enforcement)</strong>: Attempting to mark SQL Ready without documented problem impact or timeline is rejected with HTTP 400.</li>
  <li><strong>AT-006 (Sales Handoff SLA)</strong>: SQL Ready record notifies sales owner; rejection returns lead to PLD with mandatory reason.</li>
  <li><strong>AT-007 (Partner Tenant Isolation)</strong>: Partner A user queries <code>/api/v1/leads/</code> and receives zero records belonging to Partner B or direct TEXOL leads.</li>
  <li><strong>AT-008 (Deal Registration Conflict)</strong>: Submitting deal registration for customer/product under existing protection triggers conflict review.</li>
  <li><strong>AT-009 (Audit Completeness)</strong>: Changing opportunity value or stage logs old and new value with user ID and timestamp in audit trail.</li>
  <li><strong>AT-010 (Optional Stage Progression)</strong>: When Demo is marked optional in product config, lead advances with reason "Not Required" without triggering approval override.</li>
</ol>

<div class="page-break"></div>

<!-- SECTION 17 -->
<h1>17. Open Decisions &amp; Configuration Register</h1>

<p><em>In accordance with Section 23 of the specifications, all unresolved business items are categorized as <code>CONFIGURABLE / PENDING</code>:</em></p>

<table>
  <thead>
    <tr>
      <th style="width: 14%;">Decision ID</th>
      <th style="width: 26%;">Topic / Specification Item</th>
      <th style="width: 20%;">Specification Status</th>
      <th style="width: 40%;">Architecture Implementation Strategy</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>OD-01</strong></td>
      <td>Multi-Tenant vs. Single-Org Multi-Product</td>
      <td><span class="badge badge-warning">CONFIGURABLE / PENDING</span></td>
      <td>Database includes <code>tenant_id</code> on all tables from Day 1, defaulted to TEXOL internal tenant. Ready for multi-tenant activation without schema migration.</td>
    </tr>
    <tr>
      <td><strong>OD-02</strong></td>
      <td>Exact VanForces ICP Knockout vs Fit rules</td>
      <td><span class="badge badge-warning">CONFIGURABLE / PENDING</span></td>
      <td>Implemented as DB configuration rows (<code>icp_rules</code>), fully editable by Admin via UI.</td>
    </tr>
    <tr>
      <td><strong>OD-03</strong></td>
      <td>Exact PLD Score Dimension Weights &amp; Thresholds</td>
      <td><span class="badge badge-warning">CONFIGURABLE / PENDING</span></td>
      <td>Implemented as DB configuration rows (<code>score_models</code>), versioned and editable.</td>
    </tr>
    <tr>
      <td><strong>OD-04</strong></td>
      <td>SQL Acceptance SLA Duration</td>
      <td><span class="badge badge-warning">CONFIGURABLE / PENDING</span></td>
      <td>Parameterized in system configuration (default: 48 hours).</td>
    </tr>
    <tr>
      <td><strong>OD-05</strong></td>
      <td>Revenue Attribution Rule (First Touch / Last Touch / Registered Partner / Weighted)</td>
      <td><span class="badge badge-warning">CONFIGURABLE / PENDING</span></td>
      <td>All touches captured in <code>lead_touches</code>; attribution engine implements pluggable strategy selectable by Admin.</td>
    </tr>
    <tr>
      <td><strong>OD-06</strong></td>
      <td>Partner Deal Protection Expiry Duration</td>
      <td><span class="badge badge-warning">CONFIGURABLE / PENDING</span></td>
      <td>Configurable per partner tier (default: 90 days).</td>
    </tr>
    <tr>
      <td><strong>OD-07</strong></td>
      <td>WhatsApp &amp; Email Provider Selection</td>
      <td><span class="badge badge-warning">CONFIGURABLE / PENDING</span></td>
      <td>Abstract adapter pattern implemented; mock provider for development, ready for Twilio/SES.</td>
    </tr>
    <tr>
      <td><strong>OD-08</strong></td>
      <td>EntAura AI Read/Write Permissions Scope</td>
      <td><span class="badge badge-warning">CONFIGURABLE / PENDING</span></td>
      <td>EntAura restricted to read-only API endpoints in Phase 1; action suggestions require human approval.</td>
    </tr>
    <tr>
      <td><strong>OD-09</strong></td>
      <td>Multilingual Scope (English vs Arabic)</td>
      <td><span class="badge badge-warning">CONFIGURABLE / PENDING</span></td>
      <td>i18n support enabled in Django (<code>gettext</code>) and React (<code>i18next</code>); English first, RTL/Arabic strings ready.</td>
    </tr>
  </tbody>
</table>

</body>
</html>
"""

    output_html_path = os.path.join(os.path.dirname(__file__), "PLAN.html")
    with open(output_html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"[OK] Generated HTML: {output_html_path} ({len(html_content)} bytes)")

    # Locate Chrome / Edge
    browser_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]

    browser_bin = None
    for bp in browser_paths:
        if os.path.exists(bp):
            browser_bin = bp
            break

    if not browser_bin:
        print("ERROR: Neither Edge nor Chrome found on system to render PDF.")
        sys.exit(1)

    print(f"[INFO] Using browser binary: {browser_bin}")

    pdf_output_path = os.path.join(os.path.dirname(__file__), "TEXOL_CRM_PLAN.pdf")
    pdf_alt_path = os.path.join(os.path.dirname(__file__), "TEXOL_PLD_CRM_Technical_Foundation_Plan.pdf")

    cmd = [
        browser_bin,
        "--headless",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_output_path}",
        output_html_path
    ]

    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"[ERROR] Browser returned error code {res.returncode}: {res.stderr}")
        sys.exit(res.returncode)

    if os.path.exists(pdf_output_path):
        size = os.path.getsize(pdf_output_path)
        print(f"[SUCCESS] PDF created: {pdf_output_path} ({size:,} bytes)")
        
        # Also copy to alternate path
        import shutil
        shutil.copyfile(pdf_output_path, pdf_alt_path)
        print(f"[SUCCESS] Secondary copy created: {pdf_alt_path}")
    else:
        print("[ERROR] Output PDF file not created.")
        sys.exit(1)

if __name__ == "__main__":
    create_plan_pdf()
