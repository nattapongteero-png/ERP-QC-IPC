"use client";

import DataGrid, {
  Column,
  Paging,
  Pager,
  Sorting,
  FilterRow,
  HeaderFilter,
  Selection,
  Export,
  ColumnChooser,
  Scrolling,
  LoadPanel,
  SearchPanel,
  Toolbar,
  Item,
  Summary,
  TotalItem,
  Editing,
  GroupPanel,
} from 'devextreme-react/data-grid';
import type { DataGridTypes } from 'devextreme-react/data-grid';

// Re-export DevExtreme components for direct use
export {
  Column as DxColumn,
  Paging as DxPaging,
  Pager as DxPager,
  Sorting as DxSorting,
  FilterRow as DxFilterRow,
  HeaderFilter as DxHeaderFilter,
  Selection as DxSelection,
  Export as DxExport,
  ColumnChooser as DxColumnChooser,
  Scrolling as DxScrolling,
  LoadPanel as DxLoadPanel,
  SearchPanel as DxSearchPanel,
  Toolbar as DxToolbar,
  Item as DxItem,
  Summary as DxSummary,
  TotalItem as DxTotalItem,
  Editing as DxEditing,
};
import { exportDataGrid } from 'devextreme/excel_exporter';
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';
import { useMemo } from 'react';
import { useMobile } from '@/hooks/use-mobile';

export interface DxDataGridColumn {
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
  /** Cell value calculation */
  calculateCellValue?: (rowData: Record<string, unknown>) => unknown;
  /** Fixed column */
  fixed?: boolean;
  /** Fixed position */
  fixedPosition?: 'left' | 'right';
  /** Allow editing */
  allowEditing?: boolean;
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Sort index */
  sortIndex?: number;
  /** Group index for grouping */
  groupIndex?: number;
  /** Hide this column on mobile devices (< 768px) */
  hideOnMobile?: boolean;
  /** Hide this column on tablets (768px - 1024px) */
  hideOnTablet?: boolean;
  /** Column type (e.g., 'buttons' for action columns) */
  type?: 'buttons' | 'selection' | 'adaptive';
  /** Button definitions for type='buttons' columns */
  buttons?: Array<{
    name?: string;
    hint?: string;
    icon?: string;
    text?: string;
    visible?: boolean | ((options: { row?: { data: unknown } }) => boolean);
    onClick?: (e: { row?: { data: unknown } }) => void;
  }>;
}

export interface DxDataGridProps<T = Record<string, unknown>> {
  /** Data source */
  dataSource: T[];
  /** Column definitions (optional if using DxColumn children) */
  columns?: DxDataGridColumn[];
  /** Children (for using DxColumn, DxSearchPanel, etc. directly) */
  children?: React.ReactNode;
  /** Row key field */
  keyExpr?: string;
  /** Show borders */
  showBorders?: boolean;
  /** Show row lines */
  showRowLines?: boolean;
  /** Show column lines */
  showColumnLines?: boolean;
  /** Row alternation color */
  rowAlternationEnabled?: boolean;
  /** Allow column reordering */
  allowColumnReordering?: boolean;
  /** Allow column resizing */
  allowColumnResizing?: boolean;
  /** Column auto width */
  columnAutoWidth?: boolean;
  /** Word wrap */
  wordWrapEnabled?: boolean;
  /** Height */
  height?: number | string;
  /** Width */
  width?: number | string;
  /** No data text */
  noDataText?: string;
  /** Enable paging */
  paging?: boolean;
  /** Page size */
  pageSize?: number;
  /** Page size options */
  allowedPageSizes?: number[];
  /** Enable sorting */
  sorting?: boolean;
  /** Enable filter row */
  filterRow?: boolean;
  /** Enable header filter */
  headerFilter?: boolean;
  /** Enable selection */
  selection?: 'none' | 'single' | 'multiple';
  /** Selected row keys (controlled) */
  selectedRowKeys?: (string | number)[];
  /** Selection change handler */
  onSelectionChanged?: (e: DataGridTypes.SelectionChangedEvent) => void;
  /** Enable export */
  export?: boolean;
  /** Export file name */
  exportFileName?: string;
  /** Enable column chooser */
  columnChooser?: boolean;
  /** Enable virtual scrolling */
  virtualScrolling?: boolean;
  /** Enable search panel */
  searchPanel?: boolean;
  /** Row click handler */
  onRowClick?: (e: DataGridTypes.RowClickEvent) => void;
  /** Row double click handler */
  onRowDblClick?: (e: DataGridTypes.RowDblClickEvent) => void;
  /** Custom CSS class */
  className?: string;
  /** Loading state */
  loading?: boolean;
  /** Custom toolbar items */
  toolbarItems?: React.ReactNode;
  /** Reference to DataGrid component for accessing methods */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataGridRef?: React.RefObject<any>;
  /** Height on mobile devices (< 768px) */
  mobileHeight?: number | string;
  /** Height on tablets (768px - 1024px) */
  tabletHeight?: number | string;
  /** Enable responsive column hiding based on hideOnMobile/hideOnTablet column props */
  responsiveColumns?: boolean;
  /** Fill available height (use with flex container) - overrides height props on tablet */
  fillHeight?: boolean;
  /** Element attributes for testing */
  elementAttr?: Record<string, string>;
  /** Enable group panel (drag columns to group) */
  groupPanel?: boolean;
}

/**
 * DevExtreme DataGrid wrapper with sorting, filtering, export, and virtual scrolling
 *
 * @example
 * ```tsx
 * <DxDataGrid
 *   dataSource={items}
 *   keyExpr="id"
 *   columns={[
 *     { dataField: 'code', caption: 'รหัส', width: 100 },
 *     { dataField: 'nameTh', caption: 'ชื่อ' },
 *     { dataField: 'type', caption: 'ประเภท' },
 *     { dataField: 'quantity', caption: 'จำนวน', dataType: 'number' },
 *   ]}
 *   sorting
 *   filterRow
 *   export
 *   exportFileName="items"
 *   virtualScrolling
 *   onRowClick={(e) => handleRowClick(e.data)}
 * />
 * ```
 */
export function DxDataGrid<T = Record<string, unknown>>({
  dataSource,
  columns,
  children,
  keyExpr = 'id',
  showBorders = true,
  showRowLines = true,
  showColumnLines = false,
  rowAlternationEnabled = true,
  allowColumnReordering = true,
  allowColumnResizing = true,
  columnAutoWidth = true,
  wordWrapEnabled = false,
  height,
  width,
  noDataText = 'ไม่มีข้อมูล',
  paging = true,
  pageSize = 20,
  allowedPageSizes = [10, 20, 50, 100],
  sorting = true,
  filterRow = false,
  headerFilter = false,
  selection = 'none',
  selectedRowKeys,
  onSelectionChanged,
  export: enableExport = false,
  exportFileName = 'export',
  columnChooser = false,
  virtualScrolling = false,
  searchPanel = false,
  onRowClick,
  onRowDblClick,
  className,
  loading = false,
  toolbarItems,
  dataGridRef,
  mobileHeight,
  tabletHeight,
  responsiveColumns = true,
  fillHeight = false,
  elementAttr,
  groupPanel = false,
}: DxDataGridProps<T>) {
  // Detect device type for responsive behavior
  const { isMobile, isTablet } = useMobile();

  // Calculate responsive height
  // On tablet with fillHeight, use 100% to fill flex container
  const responsiveHeight = useMemo(() => {
    if (fillHeight && isTablet) return '100%';
    if (isMobile && mobileHeight) return mobileHeight;
    if (isTablet && tabletHeight) return tabletHeight;
    return height;
  }, [isMobile, isTablet, mobileHeight, tabletHeight, height, fillHeight]);

  // Filter columns based on device type when responsiveColumns is enabled
  const responsiveFilteredColumns = useMemo(() => {
    if (!columns) return [];
    if (!responsiveColumns) return columns;

    return columns.filter((col) => {
      // Hide on mobile if specified
      if (isMobile && col.hideOnMobile) return false;
      // Hide on tablet if specified
      if (isTablet && col.hideOnTablet) return false;
      return true;
    });
  }, [columns, isMobile, isTablet, responsiveColumns]);

  const handleExporting = (e: DataGridTypes.ExportingEvent) => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Data');

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `${exportFileName}.xlsx`);
      });
    });
  };

  return (
    <DataGrid
      ref={dataGridRef}
      dataSource={dataSource}
      keyExpr={keyExpr}
      showBorders={showBorders}
      showRowLines={showRowLines}
      showColumnLines={showColumnLines}
      rowAlternationEnabled={rowAlternationEnabled}
      allowColumnReordering={allowColumnReordering}
      allowColumnResizing={allowColumnResizing}
      columnAutoWidth={columnAutoWidth}
      wordWrapEnabled={wordWrapEnabled}
      height={responsiveHeight}
      width={width}
      noDataText={noDataText}
      onRowClick={onRowClick}
      onRowDblClick={onRowDblClick}
      className={className}
      selectedRowKeys={selectedRowKeys}
      onSelectionChanged={onSelectionChanged}
      onExporting={enableExport ? handleExporting : undefined}
      focusedRowEnabled={selection !== 'none'}
      elementAttr={elementAttr}
    >
      <LoadPanel enabled={loading} />

      {paging && !virtualScrolling && (
        <>
          <Paging enabled defaultPageSize={pageSize} />
          <Pager
            visible
            showPageSizeSelector
            allowedPageSizes={allowedPageSizes}
            showInfo
            infoText="หน้า {0} จาก {1} ({2} รายการ)"
          />
        </>
      )}

      {virtualScrolling && (
        <Scrolling mode="virtual" rowRenderingMode="virtual" />
      )}

      {sorting && <Sorting mode="multiple" />}

      {filterRow && <FilterRow visible />}

      {headerFilter && <HeaderFilter visible />}

      {selection !== 'none' && (
        <Selection mode={selection} selectAllMode="allPages" showCheckBoxesMode="always" />
      )}

      {enableExport && (
        <Export enabled allowExportSelectedData={selection !== 'none'} />
      )}

      {columnChooser && (
        <ColumnChooser enabled mode="select" />
      )}

      {groupPanel && (
        <GroupPanel visible emptyPanelText="ลากคอลัมน์มาวางที่นี่เพื่อจัดกลุ่ม" />
      )}

      {/* Explicitly control SearchPanel visibility - always render but control visible prop */}
      <SearchPanel visible={searchPanel} placeholder="ค้นหา..." />

      {(toolbarItems || enableExport || columnChooser) && (
        <Toolbar>
          {toolbarItems}
          {enableExport && <Item name="exportButton" location="after" />}
          {columnChooser && <Item name="columnChooserButton" location="after" />}
        </Toolbar>
      )}

      {/* Render columns from columns prop if provided */}
      {responsiveFilteredColumns.map((col, index) => (
        <Column
          key={col.dataField || `col-${index}`}
          dataField={col.dataField}
          caption={col.caption}
          dataType={col.dataType}
          width={col.width}
          minWidth={col.minWidth}
          allowSorting={col.allowSorting}
          allowFiltering={col.allowFiltering}
          allowHeaderFiltering={col.allowHeaderFiltering}
          visible={col.visible}
          alignment={col.alignment}
          format={col.format}
          cellRender={col.cellRender}
          calculateCellValue={col.calculateCellValue}
          fixed={col.fixed}
          fixedPosition={col.fixedPosition}
          allowEditing={col.allowEditing}
          sortOrder={col.sortOrder}
          sortIndex={col.sortIndex}
          groupIndex={col.groupIndex}
        />
      ))}

      {/* Render children if provided (for DxColumn, DxSearchPanel, etc.) */}
      {children}
    </DataGrid>
  );
}
