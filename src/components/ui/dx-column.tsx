"use client";

/**
 * DxColumn wrapper component
 * This is a placeholder for compatibility with child-based column definitions.
 * The actual column rendering is handled by DxDataGrid's columns prop.
 */

import type { DataGridTypes } from 'devextreme-react/data-grid';
import type React from 'react';

export interface DxColumnProps {
  /** Field name in data source */
  dataField?: string;
  /** Column header caption */
  caption?: string;
  /** Data type */
  dataType?: 'string' | 'number' | 'date' | 'boolean' | 'object' | 'datetime';
  /** Column width */
  width?: number | string;
  /** Minimum width */
  minWidth?: number;
  /** Allow sorting */
  allowSorting?: boolean;
  /** Allow filtering */
  allowFiltering?: boolean;
  /** Allow header filter */
  allowHeaderFiltering?: boolean;
  /** Column visibility */
  visible?: boolean;
  /** Column alignment */
  alignment?: 'left' | 'center' | 'right';
  /** Date format */
  format?: string | { type?: string; precision?: number };
  /** Custom cell template */
  cellRender?: (cellInfo: DataGridTypes.ColumnCellTemplateData) => React.ReactNode;
  /** Editable */
  allowEditing?: boolean;
  /** Sorting order */
  sortOrder?: 'asc' | 'desc';
  /** Sort index */
  sortIndex?: number;
  /** Fixed position */
  fixed?: boolean;
  /** Fixed position side */
  fixedPosition?: 'left' | 'right';
  /** CSS class */
  cssClass?: string;
  /** Calculate cell value */
  calculateCellValue?: (rowData: Record<string, unknown>) => unknown;
  /** Calculate filter expression */
  calculateFilterExpression?: (
    filterValue: unknown,
    selectedFilterOperation: string,
    target: string
  ) => unknown;
  /** Custom filter operations */
  filterOperations?: string[];
  /** Allow grouping */
  allowGrouping?: boolean;
  /** Group index */
  groupIndex?: number;
  /** Children (unused) */
  children?: React.ReactNode;
}

/**
 * DxColumn is a compatibility wrapper.
 * Note: In our DxDataGrid implementation, columns are passed as a prop, not as children.
 * This component exists for compatibility with code that uses the child-based pattern.
 * It doesn't render anything - the column definitions are extracted by the parent component.
 */
export function DxColumn(_props: DxColumnProps): null {
  // This component doesn't render anything
  // It's used for declarative column definitions that are extracted by the parent
  return null;
}

export default DxColumn;
