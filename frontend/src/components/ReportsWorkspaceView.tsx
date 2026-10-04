import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Download, Search, RefreshCw, ChevronLeft, ChevronRight, 
  ArrowUpDown, AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import type { ReportTableData } from '../services/api';
import { DateRangeSelector } from './analytics/DateRangeSelector';

const REPORT_OPTIONS = [
  { key: 'pipeline_by_owner', label: 'Pipeline by Owner' },
  { key: 'pipeline_by_stage', label: 'Pipeline by Stage' },
  { key: 'leads_by_source', label: 'Leads by Source' },
  { key: 'pld_conversion', label: 'PLD Qualification & Conversion' },
  { key: 'opportunity_performance', label: 'Opportunity Performance' },
  { key: 'activity_performance', label: 'Activity Performance' },
  { key: 'sla_performance', label: 'SLA Performance & Breaches' }
];

export const ReportsWorkspaceView: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<string>('pipeline_by_owner');
  const [data, setData] = useState<ReportTableData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [dateRange, setDateRange] = useState<string>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(20);
  const [sortBy, setSortBy] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const normalizedColumns = useMemo(() => {
    if (!data) return [];
    const cols = data.columns || (data as any).headers;
    if (!cols || !Array.isArray(cols)) return [];
    if (cols.length > 0 && typeof cols[0] === 'object' && cols[0].key) {
      return cols as { key: string; label: string }[];
    }
    if (data.rows && data.rows.length > 0) {
      const keys = Object.keys(data.rows[0]);
      return keys.map((key, i) => ({
        key,
        label: typeof cols[i] === 'string' ? cols[i] : key.replace(/_/g, ' ').toUpperCase()
      }));
    }
    return (cols as any[]).map(h => ({ key: String(h).toLowerCase().replace(/[^a-z0-9]/g, '_'), label: String(h) }));
  }, [data]);

  useEffect(() => {
    setPage(1);
    setSortBy('');
  }, [selectedReport]);

  useEffect(() => {
    loadReport();
  }, [selectedReport, dateRange, customStart, customEnd, searchQuery, page, sortBy, sortDir]);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {
        report_type: selectedReport,
        page,
        page_size: pageSize,
        sort_dir: sortDir
      };
      if (dateRange) params.date_range = dateRange;
      if (customStart) params.start_date = customStart;
      if (customEnd) params.end_date = customEnd;
      if (searchQuery) params.search = searchQuery;
      if (sortBy) params.sort_by = sortBy;
      const res = await api.getReportTable(params);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch report');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnKey);
      setSortDir('asc');
    }
  };

  const handleExportCSV = () => {
    const params: Record<string, string> = {
      report_type: selectedReport,
    };
    if (dateRange) params.date_range = dateRange;
    if (customStart) params.start_date = customStart;
    if (customEnd) params.end_date = customEnd;
    if (searchQuery) params.search = searchQuery;
    const downloadUrl = api.getReportCSVDownloadUrl(params);
    window.open(downloadUrl, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Export Action */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        paddingBottom: '8px',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Enterprise Reports Hub
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Configurable tabular reports, sorting, pagination, and real-time CSV streaming export.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn btn-primary"
            onClick={handleExportCSV}
            style={{ fontSize: '0.82rem', padding: '8px 16px' }}
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Report Selection Tabs */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '6px',
        background: 'var(--bg-surface-elevated)',
        borderRadius: '10px',
        border: '1px solid var(--border-subtle)'
      }}>
        {REPORT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSelectedReport(opt.key)}
            style={{
              padding: '8px 14px',
              borderRadius: '7px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: selectedReport === opt.key ? 'var(--primary)' : 'transparent',
              color: selectedReport === opt.key ? '#FFFFFF' : 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '6px 12px',
          width: '280px'
        }}>
          <Search size={15} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search report rows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              outline: 'none',
              width: '100%'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <DateRangeSelector
            selectedRange={dateRange}
            onRangeChange={setDateRange}
            customStartDate={customStart}
            customEndDate={customEnd}
            onCustomDateChange={(start, end) => {
              setCustomStart(start);
              setCustomEnd(end);
            }}
          />

          <button
            className="btn btn-secondary"
            onClick={loadReport}
            style={{ padding: '8px 12px' }}
            title="Refresh report"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '14px 18px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '10px',
          color: 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button className="btn btn-outline" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '0.75rem' }} onClick={loadReport}>
            Retry
          </button>
        </div>
      )}

      {/* Report Table Card */}
      <div className="glass-panel" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              {data?.report_name || 'Report Table'}
            </h3>
          </div>
          <span className="badge badge-info">
            {data?.total_rows ?? 0} Total Records
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <div className="animate-spin" style={{ display: 'inline-block', marginBottom: '8px' }}>⏳</div>
            <p>Loading report data...</p>
          </div>
        ) : (!data?.rows || data.rows.length === 0) ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px' }}>
            No records match the current report criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  {normalizedColumns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{
                        padding: '10px 14px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{col.label}</span>
                        <ArrowUpDown size={12} color={sortBy === col.key ? 'var(--primary)' : 'var(--text-muted)'} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {normalizedColumns.map((col) => {
                      const val = row[col.key];
                      const isNumber = typeof val === 'number';
                      const formatted = isNumber && (col.key.includes('value') || col.key.includes('pipeline') || col.key.includes('won'))
                        ? `$${val.toLocaleString()}`
                        : val ?? '-';
                      return (
                        <td key={col.key} style={{ padding: '12px 14px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          {formatted}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {data && data.total_pages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)'
          }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Showing Page {data.current_page} of {data.total_pages} ({data.total_rows} rows)
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <button
                className="btn btn-outline"
                disabled={page >= data.total_pages}
                onClick={() => setPage(page + 1)}
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
