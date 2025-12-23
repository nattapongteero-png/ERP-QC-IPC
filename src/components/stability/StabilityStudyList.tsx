'use client';

/**
 * Stability Study List Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * Professional DataGrid showing stability studies with advanced features.
 */

import { useRouter } from 'next/navigation';
import DataGrid, {
  Column,
  Paging,
  Pager,
  SearchPanel,
  FilterRow,
  HeaderFilter,
  ColumnChooser,
  Export,
  Grouping,
  GroupPanel,
  Summary,
  TotalItem,
  Toolbar,
  Item,
  Scrolling,
  Selection,
  MasterDetail,
} from 'devextreme-react/data-grid';
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';
import { exportDataGrid } from 'devextreme/excel_exporter';
import type { ExportingEvent } from 'devextreme/ui/data_grid';
import {
  Play,
  CheckCircle,
  XCircle,
  Pause,
  AlertTriangle,
  Clock,
  Beaker,
  ThermometerSun,
  Zap,
  Eye,
  MoreHorizontal,
} from 'lucide-react';
import type { StabilityStudy, StabilityStudyStatus } from '@/types/stability';

interface StabilityStudyListProps {
  studies: StabilityStudy[];
  loading?: boolean;
  showMasterDetail?: boolean;
  height?: number | string;
}

const statusConfig: Record<
  StabilityStudyStatus,
  { label: string; bgColor: string; textColor: string; borderColor: string; icon: React.ReactNode }
> = {
  active: {
    label: 'Active',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    icon: <Play className="h-3.5 w-3.5" />,
  },
  completed: {
    label: 'Completed',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  },
  cancelled: {
    label: 'Cancelled',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  on_hold: {
    label: 'On Hold',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    icon: <Pause className="h-3.5 w-3.5" />,
  },
};

const studyTypeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  long_term: { label: 'Long Term', color: 'text-blue-600', icon: <ThermometerSun className="h-3.5 w-3.5" /> },
  accelerated: { label: 'Accelerated', color: 'text-red-600', icon: <Zap className="h-3.5 w-3.5" /> },
  intermediate: { label: 'Intermediate', color: 'text-amber-600', icon: <Beaker className="h-3.5 w-3.5" /> },
};

// Helper function to format dates
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Helper function to calculate days until due
function getDaysUntilDue(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const dueDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Master detail component for samples
function SamplesDetail({ data }: { data: { data: StabilityStudy } }) {
  const study = data.data;
  return (
    <div className="p-4 bg-gray-50 border-t border-gray-200">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Protocol:</span>
          <p className="font-medium">{study.protocolNumber || '-'}</p>
        </div>
        <div>
          <span className="text-gray-500">Chamber Location:</span>
          <p className="font-medium">{study.chamberLocation || '-'}</p>
        </div>
        <div>
          <span className="text-gray-500">Current Timepoint:</span>
          <p className="font-medium">{study.currentTimepoint !== null ? `${study.currentTimepoint}M` : '-'}</p>
        </div>
        <div>
          <span className="text-gray-500">Created By:</span>
          <p className="font-medium">{study.createdByName || '-'}</p>
        </div>
      </div>
    </div>
  );
}

export function StabilityStudyList({
  studies,
  loading = false,
  showMasterDetail = false,
  height = 'auto',
}: StabilityStudyListProps) {
  const router = useRouter();

  const handleExporting = (e: ExportingEvent) => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Stability Studies');

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }) => {
        if (gridCell?.rowType === 'header') {
          excelCell.font = { bold: true };
          excelCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE8F5E9' },
          };
        }
      },
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Stability_Studies_${new Date().toISOString().split('T')[0]}.xlsx`
        );
      });
    });
    e.cancel = true;
  };

  const renderStatusCell = (cellData: { value: StabilityStudyStatus }) => {
    const config = statusConfig[cellData.value];
    if (!config) return cellData.value;
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bgColor} ${config.textColor} ${config.borderColor}`}
      >
        {config.icon}
        {config.label}
      </span>
    );
  };

  const renderStudyNumberCell = (cellData: { data: StabilityStudy }) => {
    const study = cellData.data;
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono font-semibold text-emerald-700">{study.studyNumber}</span>
        {study.oosCount > 0 && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
            <AlertTriangle className="h-3 w-3" />
            OOS
          </span>
        )}
      </div>
    );
  };

  const renderProductCell = (cellData: { data: StabilityStudy }) => {
    const study = cellData.data;
    return (
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">{study.productName}</p>
        <p className="text-xs text-gray-500 truncate">Lot: {study.lotNumber}</p>
      </div>
    );
  };

  const renderNextDueCell = (cellData: { data: StabilityStudy }) => {
    const study = cellData.data;
    if (!study.nextDueDate || study.status !== 'active') {
      return <span className="text-gray-400">-</span>;
    }

    const daysUntilDue = getDaysUntilDue(study.nextDueDate);
    if (daysUntilDue === null) return '-';

    if (daysUntilDue < 0) {
      return (
        <div className="flex items-center gap-1.5 text-red-600">
          <div className="p-1 bg-red-100 rounded">
            <AlertTriangle className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="text-xs font-semibold">Overdue</p>
            <p className="text-xs">{Math.abs(daysUntilDue)} days</p>
          </div>
        </div>
      );
    } else if (daysUntilDue <= 7) {
      return (
        <div className="flex items-center gap-1.5 text-amber-600">
          <div className="p-1 bg-amber-100 rounded">
            <Clock className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="text-xs font-semibold">{formatDate(study.nextDueDate)}</p>
            <p className="text-xs">{daysUntilDue}d remaining</p>
          </div>
        </div>
      );
    } else if (daysUntilDue <= 30) {
      return (
        <div className="flex items-center gap-1.5 text-blue-600">
          <div className="p-1 bg-blue-100 rounded">
            <Clock className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="text-xs font-medium">{formatDate(study.nextDueDate)}</p>
            <p className="text-xs text-gray-500">{daysUntilDue}d</p>
          </div>
        </div>
      );
    }
    return (
      <div className="text-gray-600">
        <p className="text-xs">{formatDate(study.nextDueDate)}</p>
      </div>
    );
  };

  const renderTimepointCell = (cellData: { data: StabilityStudy }) => {
    const study = cellData.data;
    if (study.currentTimepoint === null) {
      return <span className="text-gray-400">-</span>;
    }
    return (
      <div className="flex items-center gap-1">
        <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 bg-indigo-50 text-indigo-700 font-semibold text-xs rounded-full">
          {study.currentTimepoint}M
        </span>
      </div>
    );
  };

  const renderOOSCell = (cellData: { value: number }) => {
    const count = cellData.value || 0;
    if (count === 0) {
      return (
        <span className="inline-flex items-center justify-center min-w-[1.5rem] px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
          0
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center min-w-[1.5rem] px-2 py-0.5 bg-red-100 text-red-700 font-bold text-xs rounded-full">
        {count}
      </span>
    );
  };

  const renderActionsCell = (cellData: { data: StabilityStudy }) => {
    const study = cellData.data;
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/gmp/stability/studies/${study.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
          title="View Details"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          title="More Options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="stability-study-list">
      <DataGrid
        dataSource={studies}
        showBorders={false}
        showRowLines
        showColumnLines={false}
        rowAlternationEnabled
        hoverStateEnabled
        height={height}
        columnAutoWidth
        wordWrapEnabled={false}
        onExporting={handleExporting}
        onRowClick={(e) => {
          if (e.data && e.rowType === 'data') {
            router.push(`/gmp/stability/studies/${e.data.id}`);
          }
        }}
        className="dx-card rounded-lg overflow-hidden"
      >
        {/* Toolbar */}
        <Toolbar>
          <Item name="groupPanel" />
          <Item location="after" name="columnChooserButton" />
          <Item location="after" name="exportButton" />
          <Item location="after" name="searchPanel" />
        </Toolbar>

        {/* Features */}
        <SearchPanel visible placeholder="Search studies..." width={250} />
        <FilterRow visible />
        <HeaderFilter visible />
        <ColumnChooser enabled mode="select" />
        <Grouping autoExpandAll={false} />
        <GroupPanel visible />
        <Scrolling mode="virtual" />
        <Selection mode="single" />

        {/* Export */}
        <Export enabled allowExportSelectedData formats={['xlsx']} />

        {/* Paging */}
        <Paging defaultPageSize={15} />
        <Pager
          showPageSizeSelector
          allowedPageSizes={[10, 15, 25, 50]}
          showInfo
          showNavigationButtons
          displayMode="adaptive"
        />

        {/* Master Detail */}
        {showMasterDetail && (
          <MasterDetail enabled component={SamplesDetail} />
        )}

        {/* Columns */}
        <Column
          dataField="studyNumber"
          caption="Study #"
          width={160}
          fixed
          cellRender={renderStudyNumberCell}
        />
        <Column
          caption="Product / Lot"
          minWidth={200}
          cellRender={renderProductCell}
          allowFiltering={false}
        />
        <Column
          dataField="protocolNumber"
          caption="Protocol"
          width={130}
          visible={false}
        />
        <Column
          dataField="startDate"
          caption="Start Date"
          dataType="date"
          format="dd MMM yyyy"
          width={120}
        />
        <Column
          dataField="currentTimepoint"
          caption="Timepoint"
          width={100}
          alignment="center"
          cellRender={renderTimepointCell}
        />
        <Column
          caption="Next Due"
          width={140}
          cellRender={renderNextDueCell}
          allowFiltering={false}
          allowSorting={false}
        />
        <Column
          dataField="oosCount"
          caption="OOS"
          width={70}
          alignment="center"
          cellRender={renderOOSCell}
        />
        <Column
          dataField="status"
          caption="Status"
          width={120}
          cellRender={renderStatusCell}
        />
        <Column
          caption=""
          width={80}
          cellRender={renderActionsCell}
          allowFiltering={false}
          allowSorting={false}
          allowGrouping={false}
          fixed
          fixedPosition="right"
        />

        {/* Summary */}
        <Summary>
          <TotalItem column="studyNumber" summaryType="count" displayFormat="Total: {0}" />
        </Summary>
      </DataGrid>

      <style jsx global>{`
        .stability-study-list .dx-datagrid {
          background: transparent;
        }
        .stability-study-list .dx-datagrid-headers {
          background: linear-gradient(to bottom, #f9fafb, #f3f4f6);
          border-bottom: 2px solid #e5e7eb;
        }
        .stability-study-list .dx-datagrid-headers .dx-header-row > td {
          font-weight: 600;
          color: #374151;
          padding: 12px 8px;
        }
        .stability-study-list .dx-datagrid-rowsview .dx-row > td {
          padding: 10px 8px;
          vertical-align: middle;
        }
        .stability-study-list .dx-datagrid-rowsview .dx-row:hover {
          background-color: #f0fdf4 !important;
          cursor: pointer;
        }
        .stability-study-list .dx-datagrid-rowsview .dx-row-alt > td {
          background-color: #fafafa;
        }
        .stability-study-list .dx-datagrid-search-panel {
          margin-left: 0;
        }
        .stability-study-list .dx-toolbar {
          padding: 8px 12px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }
        .stability-study-list .dx-datagrid-group-panel {
          padding: 8px;
        }
        .stability-study-list .dx-datagrid-pager {
          padding: 12px;
          background: #f9fafb;
          border-top: 1px solid #e5e7eb;
        }
      `}</style>
    </div>
  );
}
