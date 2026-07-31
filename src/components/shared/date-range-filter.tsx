'use client';

/**
 * DateRangeFilter — reusable "from / to" date range filter row.
 *
 * Used by list pages (Purchase Requisitions, Purchase Orders, ...) to filter
 * records by a date field. Emits ISO date strings (YYYY-MM-DD) or '' when cleared.
 * Shows a "clear" button only when at least one bound is set.
 */

import { useTranslations } from 'next-intl';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { CalendarRange, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface DateRangeFilterProps {
  /** "From" date (ISO YYYY-MM-DD) or '' */
  from: string;
  /** "To" date (ISO YYYY-MM-DD) or '' */
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  /** Optional label shown before the inputs */
  label?: string;
  className?: string;
  'data-testid'?: string;
}

export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  label,
  className,
  'data-testid': testId,
}: DateRangeFilterProps) {
  const tCommon = useTranslations('common');
  const hasValue = !!from || !!to;

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      data-testid={testId}
    >
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 whitespace-nowrap">
        <CalendarRange className="h-4 w-4 text-gray-400" />
        {label || tCommon('filters.dateRange')}
      </span>
      <DxDateBox
        value={from}
        onValueChange={onFromChange}
        placeholder={tCommon('filters.from')}
        labelMode="hidden"
        showClearButton
        max={to || undefined}
        width={190}
        data-testid={testId ? `${testId}-from` : 'date-range-from'}
      />
      <span className="text-gray-400">–</span>
      <DxDateBox
        value={to}
        onValueChange={onToChange}
        placeholder={tCommon('filters.to')}
        labelMode="hidden"
        showClearButton
        min={from || undefined}
        width={190}
        data-testid={testId ? `${testId}-to` : 'date-range-to'}
      />
      {hasValue && (
        <button
          type="button"
          onClick={() => {
            onFromChange('');
            onToChange('');
          }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          data-testid={testId ? `${testId}-clear` : 'date-range-clear'}
        >
          <X className="h-3.5 w-3.5" />
          {tCommon('actions.clear')}
        </button>
      )}
    </div>
  );
}
