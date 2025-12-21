/**
 * ResponsiveDataGrid Component Contract
 * Feature: 007-hr-personnel-management
 * Date: 2025-12-21
 *
 * A wrapper around DevExtreme DataGrid that adds responsive features:
 * - Automatic column hiding based on viewport
 * - Optional mobile card view
 * - Consistent height calculations
 */

import type { LucideIcon } from 'lucide-react';

/**
 * Column definition with responsive settings
 */
export interface ResponsiveColumn<T = unknown> {
  /** Field name from data source */
  dataField: keyof T | string;

  /** Display header caption */
  caption: string;

  /** Column data type */
  dataType?: 'string' | 'number' | 'date' | 'boolean' | 'datetime';

  /** Column width (pixels or percentage) */
  width?: number | string;

  /** Minimum width in pixels */
  minWidth?: number;

  /** Column visibility */
  visible?: boolean;

  /**
   * Hiding priority (lower = hidden first on narrow screens)
   * 0-1: Hidden on xs (<576px)
   * 2-3: Hidden on sm (<768px)
   * 4-5: Hidden on md (<992px)
   * 6+:  Never hidden automatically
   */
  hidingPriority?: number;

  /** Allow sorting on this column */
  allowSorting?: boolean;

  /** Allow filtering on this column */
  allowFiltering?: boolean;

  /** Custom cell renderer */
  cellRender?: (data: { value: unknown; data: T; rowIndex: number }) => React.ReactNode;

  /** Fixed column position */
  fixed?: boolean;

  /** Which side to fix the column */
  fixedPosition?: 'left' | 'right';

  /** Text alignment */
  alignment?: 'left' | 'center' | 'right';

  /** Format string for dates/numbers */
  format?: string;

  /** Show this field in mobile card view */
  showInMobile?: boolean;

  /** Priority in mobile card view (higher = shown first) */
  mobilePriority?: number;

  /** Mobile card field type for special rendering */
  mobileFieldType?: 'title' | 'subtitle' | 'meta' | 'status' | 'hidden';
}

/**
 * Props for ResponsiveDataGrid component
 */
export interface ResponsiveDataGridProps<T = unknown> {
  // === Required Props ===

  /** Data source for the grid */
  dataSource: T[];

  /** Column definitions with responsive settings */
  columns: ResponsiveColumn<T>[];

  /** Unique key field */
  keyExpr: keyof T | string;

  // === Optional Props ===

  /**
   * Grid height
   * @default "calc(100vh - 280px)"
   */
  height?: string | number;

  /** Show search panel */
  searchEnabled?: boolean;

  /** Show filter row */
  filterRowEnabled?: boolean;

  /** Enable row selection */
  selectionEnabled?: boolean;

  /** Selection mode */
  selectionMode?: 'single' | 'multiple';

  /** Selected keys (controlled) */
  selectedKeys?: (string | number)[];

  /** Selection change handler */
  onSelectionChange?: (keys: (string | number)[]) => void;

  /** Row click handler */
  onRowClick?: (row: T) => void;

  /** Row double-click handler */
  onRowDblClick?: (row: T) => void;

  /** Custom row actions renderer (for actions column) */
  renderRowActions?: (row: T) => React.ReactNode;

  /** Loading state */
  isLoading?: boolean;

  /** Message when no data */
  emptyMessage?: string;

  /**
   * Custom mobile card renderer
   * If provided, overrides default mobile card
   */
  renderMobileCard?: (row: T) => React.ReactNode;

  /**
   * Use built-in mobile card view
   * @default false - uses DevExtreme adaptive columns
   */
  useMobileCardView?: boolean;

  /**
   * Breakpoint for mobile card view (pixels)
   * @default 768
   */
  mobileBreakpoint?: number;

  /** Export to Excel enabled */
  exportEnabled?: boolean;

  /** Export file name */
  exportFileName?: string;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Component Behavior Contract:
 *
 * 1. COLUMN HIDING:
 *    - Uses DevExtreme columnHidingEnabled=true
 *    - Columns are hidden based on hidingPriority
 *    - Adaptive detail row shows hidden columns on expand
 *
 * 2. MOBILE CARD VIEW:
 *    - When useMobileCardView=true and viewport < mobileBreakpoint
 *    - Renders data as cards instead of grid rows
 *    - Uses columns with showInMobile=true
 *    - Orders by mobilePriority (higher first)
 *
 * 3. HEIGHT CALCULATION:
 *    - Default: calc(100vh - 280px) accounts for header/padding
 *    - Adjusts for filter row if filterRowEnabled=true
 *
 * 4. SELECTION:
 *    - Uses DevExtreme selection component
 *    - Checkbox column when selectionEnabled=true
 *    - Fires onSelectionChange with array of keys
 *
 * 5. ROW ACTIONS:
 *    - If renderRowActions provided, adds fixed actions column
 *    - Actions column fixed to right
 *    - Never hidden on narrow screens
 *
 * 6. LOADING STATE:
 *    - Shows DevExtreme loading indicator
 *    - Disables interaction during load
 *
 * 7. EXPORT:
 *    - Excel export via DevExtreme when exportEnabled=true
 *    - Uses exportFileName or defaults to "export"
 */

// Example Usage:
/*
import { ResponsiveDataGrid, ResponsiveColumn } from '@/components/shared/responsive-data-grid';
import { DxButton } from '@/components/ui/dx-button';

interface Employee {
  id: number;
  employeeCode: string;
  fullName: string;
  position: string;
  department: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
}

const columns: ResponsiveColumn<Employee>[] = [
  {
    dataField: 'employeeCode',
    caption: 'รหัส',
    width: 100,
    hidingPriority: 6, // Never hide
    showInMobile: true,
    mobilePriority: 10,
    mobileFieldType: 'title',
  },
  {
    dataField: 'fullName',
    caption: 'ชื่อ-นามสกุล',
    hidingPriority: 6, // Never hide
    showInMobile: true,
    mobilePriority: 9,
    mobileFieldType: 'title',
  },
  {
    dataField: 'position',
    caption: 'ตำแหน่ง',
    hidingPriority: 4, // Hidden on tablet
    showInMobile: true,
    mobilePriority: 7,
    mobileFieldType: 'subtitle',
  },
  {
    dataField: 'department',
    caption: 'แผนก',
    hidingPriority: 3,
    showInMobile: true,
    mobilePriority: 6,
    mobileFieldType: 'subtitle',
  },
  {
    dataField: 'email',
    caption: 'อีเมล',
    hidingPriority: 2, // Hidden early
    showInMobile: false,
  },
  {
    dataField: 'phone',
    caption: 'โทรศัพท์',
    hidingPriority: 1, // Hidden first
    showInMobile: true,
    mobilePriority: 3,
    mobileFieldType: 'meta',
  },
  {
    dataField: 'status',
    caption: 'สถานะ',
    hidingPriority: 5,
    showInMobile: true,
    mobilePriority: 8,
    mobileFieldType: 'status',
    cellRender: ({ value }) => (
      <span className={value === 'active' ? 'text-green-600' : 'text-gray-500'}>
        {value === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
      </span>
    ),
  },
];

<ResponsiveDataGrid
  dataSource={employees}
  columns={columns}
  keyExpr="id"
  searchEnabled
  filterRowEnabled
  selectionEnabled
  selectionMode="multiple"
  selectedKeys={selectedIds}
  onSelectionChange={setSelectedIds}
  onRowClick={(row) => router.push(`/hr/employees/${row.id}`)}
  renderRowActions={(row) => (
    <div className="flex gap-1">
      <DxButton icon="edit" stylingMode="text" hint="แก้ไข" />
      <DxButton icon="trash" stylingMode="text" hint="ลบ" />
    </div>
  )}
  useMobileCardView
  mobileBreakpoint={768}
  exportEnabled
  exportFileName="employees"
/>
*/

// Mobile Card Structure (when useMobileCardView=true):
/*
┌─────────────────────────────────────────────────┐
│ [Checkbox] EMP001 - สมชาย ใจดี             [●]  │  ← title + status
│            Production Manager                   │  ← subtitle
│            Manufacturing Dept                   │  ← subtitle
│            📞 081-234-5678                     │  ← meta
│                                        [⋮]     │  ← actions
└─────────────────────────────────────────────────┘
*/
