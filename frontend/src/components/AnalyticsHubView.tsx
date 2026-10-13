import React, { useState } from 'react';
import { 
  BarChart3, Award, Briefcase, Share2, Box, Handshake, 
  Activity, GitCommit, Users, FileText
} from 'lucide-react';
import type { Product } from '../services/api';
import { ExecutiveDashboardView } from './ExecutiveDashboardView';
import { PLDDashboardView } from './PLDDashboardView';
import { SalesDashboardView } from './SalesDashboardView';
import { MarketingDashboardView } from './MarketingDashboardView';
import { ProductAnalyticsView } from './ProductAnalyticsView';
import { PartnerDashboardFoundationView } from './PartnerDashboardFoundationView';
import { ActivitySLADashboardView } from './ActivitySLADashboardView';
import { FunnelConversionsAnalyticsView } from './FunnelConversionsAnalyticsView';
import { OwnerPerformanceView } from './OwnerPerformanceView';
import { ReportsWorkspaceView } from './ReportsWorkspaceView';
import { ErrorBoundary } from './common/ErrorBoundary';

interface AnalyticsHubViewProps {
  products: Product[];
  onNavigateToLead?: (leadId: string) => void;
  onNavigateToOpportunity?: (oppId: string) => void;
  onNavigateToProposal?: (propId: string) => void;
  onNavigateToSQL?: () => void;
  onNavigateToTab?: (tab: string) => void;
  defaultSubTab?: string;
}

export const AnalyticsHubView: React.FC<AnalyticsHubViewProps> = ({
  products,
  onNavigateToLead,
  onNavigateToOpportunity,
  onNavigateToProposal,
  onNavigateToSQL,
  onNavigateToTab,
  defaultSubTab = 'executive'
}) => {
  const [subTab, setSubTab] = useState<string>(defaultSubTab);

  const TABS = [
    { key: 'executive', label: 'Executive', icon: <BarChart3 size={15} /> },
    { key: 'pld', label: 'PLD Qualification', icon: <Award size={15} /> },
    { key: 'sales', label: 'Sales & Pipeline', icon: <Briefcase size={15} /> },
    { key: 'marketing', label: 'Marketing Channels', icon: <Share2 size={15} /> },
    { key: 'product', label: 'Product Demand', icon: <Box size={15} /> },
    { key: 'partner', label: 'Partner Foundation', icon: <Handshake size={15} /> },
    { key: 'activity_sla', label: 'Activity & SLA', icon: <Activity size={15} /> },
    { key: 'funnel', label: 'Funnel & Conversions', icon: <GitCommit size={15} /> },
    { key: 'owners', label: 'Owner Performance', icon: <Users size={15} /> },
    { key: 'reports', label: 'Reports Hub & Export', icon: <FileText size={15} /> }
  ];

  const currentTab = TABS.find(t => t.key === subTab);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sub-Navigation Pill Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        overflowX: 'auto',
        padding: '6px',
        background: 'var(--bg-surface-elevated)',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle)'
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              whiteSpace: 'nowrap',
              background: subTab === tab.key ? 'var(--primary)' : 'transparent',
              color: subTab === tab.key ? '#FFFFFF' : 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* View Switcher with Error Boundary */}
      <ErrorBoundary key={subTab} fallbackTitle={`Unable to load ${currentTab?.label || 'Analytics'} view`}>
        {subTab === 'executive' && (
          <ExecutiveDashboardView
            products={products}
            onNavigateToEntity={(type, id) => {
              if (type === 'lead' && onNavigateToLead) onNavigateToLead(id);
              else if (type === 'opportunity' && onNavigateToOpportunity) onNavigateToOpportunity(id);
            }}
            onNavigateToTab={onNavigateToTab}
          />
        )}

        {subTab === 'pld' && (
          <PLDDashboardView
            products={products}
            onNavigateToLead={onNavigateToLead}
          />
        )}

        {subTab === 'sales' && (
          <SalesDashboardView
            products={products}
            onNavigateToOpportunity={onNavigateToOpportunity}
            onNavigateToProposal={onNavigateToProposal}
            onNavigateToSQL={onNavigateToSQL}
          />
        )}

        {subTab === 'marketing' && (
          <MarketingDashboardView
            products={products}
            onNavigateToTab={onNavigateToTab}
          />
        )}

        {subTab === 'product' && (
          <ProductAnalyticsView />
        )}

        {subTab === 'partner' && (
          <PartnerDashboardFoundationView />
        )}

        {subTab === 'activity_sla' && (
          <ActivitySLADashboardView
            onNavigateToTab={onNavigateToTab}
          />
        )}

        {subTab === 'funnel' && (
          <FunnelConversionsAnalyticsView
            products={products}
            onNavigateToTab={onNavigateToTab}
          />
        )}

        {subTab === 'owners' && (
          <OwnerPerformanceView />
        )}

        {subTab === 'reports' && (
          <ReportsWorkspaceView />
        )}
      </ErrorBoundary>
    </div>
  );
};
