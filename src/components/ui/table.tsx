'use client';

import { ReactNode, HTMLAttributes, forwardRef } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Column<T> {
  /** Unique column key */
  key: string;
  /** Column header text */
  header?: string;
  /** Alias for header */
  title?: string;
  /** Cell render function */
  render?: (item: T, index: number) => ReactNode;
  /** Sortable column */
  sortable?: boolean;
  /** Column alignment */
  align?: 'left' | 'center' | 'right';
  /** Column width */
  width?: string;
  /** Additional header class */
  headerClassName?: string;
  /** Additional cell class */
  cellClassName?: string;
  /** Legacy className prop */
  className?: string;
}

interface TableProps<T> extends HTMLAttributes<HTMLDivElement> {
  /** Column definitions */
  columns: Column<T>[];
  /** Data array */
  data: T[];
  /** Row key field */
  keyField?: keyof T;
  /** Loading state */
  isLoading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Row click handler */
  onRowClick?: (item: T, index: number) => void;
  /** Custom row renderer */
  renderRow?: (item: T, index: number) => ReactNode;
  /** Current sort column */
  sortColumn?: string;
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Sort change handler */
  onSortChange?: (column: string, direction: 'asc' | 'desc') => void;
  /** Striped rows */
  striped?: boolean;
  /** Hoverable rows */
  hoverable?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Sticky header */
  stickyHeader?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Table<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  isLoading,
  emptyMessage = 'No data available',
  onRowClick,
  renderRow,
  sortColumn,
  sortDirection,
  onSortChange,
  striped = false,
  hoverable = true,
  compact = false,
  stickyHeader = false,
  className,
  ...props
}: TableProps<T>) {
  const handleSort = (column: Column<T>) => {
    if (!column.sortable || !onSortChange) return;

    const newDirection =
      sortColumn === column.key && sortDirection === 'asc' ? 'desc' : 'asc';
    onSortChange(column.key, newDirection);
  };

  const getSortIcon = (column: Column<T>) => {
    if (!column.sortable) return null;

    if (sortColumn === column.key) {
      return sortDirection === 'asc' ? (
        <ChevronUp className="h-4 w-4" />
      ) : (
        <ChevronDown className="h-4 w-4" />
      );
    }
    return <ChevronsUpDown className="h-4 w-4 opacity-40" />;
  };

  const alignmentClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  if (isLoading) {
    return (
      <div className={cn('overflow-x-auto rounded-lg border border-gray-200', className)} {...props}>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    compact ? 'px-4 py-2' : 'px-6 py-3',
                    'text-left text-xs font-semibold text-gray-600 uppercase tracking-wider',
                    column.headerClassName || column.className
                  )}
                  style={{ width: column.width }}
                >
                  {column.header || column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {[...Array(5)].map((_, rowIndex) => (
              <tr key={rowIndex} className="animate-pulse">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(compact ? 'px-4 py-2' : 'px-6 py-4')}
                  >
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12 text-gray-500',
          'bg-gray-50/50 rounded-lg border border-dashed border-gray-200',
          className
        )}
        {...props}
      >
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={cn('overflow-x-auto rounded-lg border border-gray-200', className)}
      {...props}
    >
      <table className="min-w-full divide-y divide-gray-200">
        <thead
          className={cn(
            'bg-gray-50',
            stickyHeader && 'sticky top-0 z-10'
          )}
        >
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  compact ? 'px-4 py-2' : 'px-6 py-3',
                  'text-xs font-semibold text-gray-600 uppercase tracking-wider',
                  alignmentClasses[column.align || 'left'],
                  column.sortable && 'cursor-pointer select-none hover:bg-gray-100',
                  'transition-colors duration-150',
                  'motion-reduce:transition-none',
                  column.headerClassName || column.className
                )}
                style={{ width: column.width }}
                onClick={() => handleSort(column)}
                role={column.sortable ? 'button' : undefined}
                aria-sort={
                  sortColumn === column.key
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                <div
                  className={cn(
                    'flex items-center gap-1',
                    column.align === 'center' && 'justify-center',
                    column.align === 'right' && 'justify-end'
                  )}
                >
                  <span>{column.header || column.title}</span>
                  {getSortIcon(column)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {renderRow
            ? data.map((item, index) => renderRow(item, index))
            : data.map((item, index) => (
                <tr
                  key={keyField ? String(item[keyField]) : index}
                  className={cn(
                    'transition-colors duration-150',
                    'motion-reduce:transition-none',
                    striped && index % 2 === 1 && 'bg-gray-50/50',
                    hoverable && 'hover:bg-emerald-50/50',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={() => onRowClick?.(item, index)}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        compact ? 'px-4 py-2' : 'px-6 py-4',
                        'whitespace-nowrap text-sm text-gray-900',
                        alignmentClasses[column.align || 'left'],
                        column.cellClassName || column.className
                      )}
                    >
                      {column.render
                        ? column.render(item, index)
                        : String(item[column.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

// Table Skeleton Component
interface TableSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Number of columns */
  columns?: number;
  /** Number of rows */
  rows?: number;
  /** Compact mode */
  compact?: boolean;
  /** Show header */
  showHeader?: boolean;
}

export const TableSkeleton = forwardRef<HTMLDivElement, TableSkeletonProps>(
  (
    {
      className,
      columns = 5,
      rows = 5,
      compact = false,
      showHeader = true,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'overflow-x-auto rounded-lg border border-gray-200',
          'animate-pulse',
          className
        )}
        aria-label="Loading table data"
        role="status"
        {...props}
      >
        <table className="min-w-full divide-y divide-gray-200">
          {showHeader && (
            <thead className="bg-gray-50">
              <tr>
                {[...Array(columns)].map((_, i) => (
                  <th
                    key={i}
                    className={cn(compact ? 'px-4 py-2' : 'px-6 py-3')}
                  >
                    <div className="h-3 bg-gray-200 rounded w-20" />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="bg-white divide-y divide-gray-100">
            {[...Array(rows)].map((_, rowIndex) => (
              <tr key={rowIndex}>
                {[...Array(columns)].map((_, colIndex) => (
                  <td
                    key={colIndex}
                    className={cn(compact ? 'px-4 py-2' : 'px-6 py-4')}
                  >
                    <div
                      className="h-4 bg-gray-200 rounded"
                      style={{
                        width: `${60 + Math.random() * 30}%`,
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }
);

TableSkeleton.displayName = 'TableSkeleton';

// Individual Table Row Skeleton
interface TableRowSkeletonProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Number of columns */
  columns?: number;
  /** Compact mode */
  compact?: boolean;
}

export const TableRowSkeleton = forwardRef<
  HTMLTableRowElement,
  TableRowSkeletonProps
>(({ className, columns = 5, compact = false, ...props }, ref) => {
  return (
    <tr ref={ref} className={cn('animate-pulse', className)} {...props}>
      {[...Array(columns)].map((_, i) => (
        <td key={i} className={cn(compact ? 'px-4 py-2' : 'px-6 py-4')}>
          <div
            className="h-4 bg-gray-200 rounded"
            style={{ width: `${60 + Math.random() * 30}%` }}
          />
        </td>
      ))}
    </tr>
  );
});

TableRowSkeleton.displayName = 'TableRowSkeleton';
