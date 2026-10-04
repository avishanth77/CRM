import React, { useState } from 'react';
import { Calendar } from 'lucide-react';

export interface DateRangeSelectorProps {
  // Format 1
  selectedRange?: string;
  onRangeChange?: (range: string) => void;
  customStartDate?: string;
  customEndDate?: string;
  onCustomDateChange?: (start: string, end: string) => void;

  // Format 2 (backward compatibility)
  period?: string;
  onPeriodChange?: (period: string, startDate?: string, endDate?: string) => void;
  startDate?: string;
  endDate?: string;
}

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  selectedRange,
  onRangeChange,
  customStartDate,
  customEndDate,
  onCustomDateChange,
  period,
  onPeriodChange,
  startDate,
  endDate
}) => {
  const currentPeriod = selectedRange || period || 'all';
  const currentStart = customStartDate || startDate || '';
  const currentEnd = customEndDate || endDate || '';

  const [showCustom, setShowCustom] = useState<boolean>(
    currentPeriod.toLowerCase() === 'custom'
  );
  const [startVal, setStartVal] = useState<string>(currentStart);
  const [endVal, setEndVal] = useState<string>(currentEnd);

  const periods = [
    { label: 'All Time', value: 'all' },
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'This Week', value: 'this_week' },
    { label: 'Last Week', value: 'last_week' },
    { label: 'This Month', value: 'this_month' },
    { label: 'Last Month', value: 'last_month' },
    { label: 'This Quarter', value: 'this_quarter' },
    { label: 'Last Quarter', value: 'last_quarter' },
    { label: 'This Year', value: 'this_year' },
    { label: 'Custom Range...', value: 'custom' },
  ];

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val.toLowerCase() === 'custom') {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      if (onRangeChange) onRangeChange(val);
      if (onPeriodChange) onPeriodChange(val);
    }
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (startVal && endVal) {
      if (onCustomDateChange) onCustomDateChange(startVal, endVal);
      if (onRangeChange) onRangeChange('custom');
      if (onPeriodChange) onPeriodChange('custom', startVal, endVal);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: '6px 12px'
      }}>
        <Calendar size={15} color="var(--text-muted)" />
        <select
          value={currentPeriod.toLowerCase()}
          onChange={handleSelect}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: '0.82rem',
            fontWeight: 600,
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          {periods.map(p => (
            <option key={p.value} value={p.value} style={{ background: 'var(--bg-surface-elevated)' }}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {showCustom && (
        <form onSubmit={handleApplyCustom} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="date"
            required
            value={startVal}
            onChange={(e) => setStartVal(e.target.value)}
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '5px 8px',
              fontSize: '0.78rem',
              color: 'var(--text-primary)'
            }}
          />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>to</span>
          <input
            type="date"
            required
            value={endVal}
            onChange={(e) => setEndVal(e.target.value)}
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '5px 8px',
              fontSize: '0.78rem',
              color: 'var(--text-primary)'
            }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: '5px 10px', fontSize: '0.75rem' }}
          >
            Apply
          </button>
        </form>
      )}
    </div>
  );
};
