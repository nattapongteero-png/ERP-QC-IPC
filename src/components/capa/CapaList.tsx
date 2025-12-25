'use client';

/**
 * CAPA List Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * Displays list of CAPAs with filtering and status indicators.
 */

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DxDataGrid, type DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import { AlertTriangle, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { Capa, CapaListParams, CapaStatus, CapaPriority } from '@/types/capa';

// ============================================
// Types
// ============================================

interface CapaListProps {
  status?: CapaStatus;
  priority?: CapaPriority;
  sourceType?: 'deviation' | 'complaint' | 'audit_finding' | 'other';
  onCapaSelect?: (capa: Capa) => void;
  onNewCapa?: () => void;
}

// ============================================
// API Functions
// ============================================

interface ApiError extends Error {
  details?: string;
  stack?: string;
}

async function fetchCapas(params: CapaListParams): Promise<{
  capas: Capa[];
  total: number;
}> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.priority) searchParams.set('priority', params.priority);
  if (params.sourceType) searchParams.set('sourceType', params.sourceType);
  if (params.overdue) searchParams.set('overdue', 'true');
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());

  const response = await fetch(`/api/capa?${searchParams.toString()}`);
  const result = await response.json();
  if (!result.success) {
    const error = new Error(result.error || 'Failed to fetch CAPAs') as ApiError;
    error.details = result.details;
    error.stack = result.stack || error.stack;
    throw error;
  }
  return result.data;
}

// ============================================
// Component
// ============================================

export function CapaList({
  status,
  priority,
  sourceType,
  onCapaSelect,
  onNewCapa,
}: CapaListProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['capas', { status, priority, sourceType, page, limit: pageSize }],
    queryFn: () => fetchCapas({ status, priority, sourceType, page, limit: pageSize }),
  });

  const apiError = error as ApiError | null;

  // Handle row click
  const handleRowClick = useCallback((e: { data: Capa }) => {
    onCapaSelect?.(e.data);
  }, [onCapaSelect]);

  // Priority badge render
  const renderPriority = (cellData: { value: CapaPriority }) => {
    const priorityColors: Record<CapaPriority, string> = {
      low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityColors[cellData.value]}`}>
        {cellData.value.toUpperCase()}
      </span>
    );
  };

  // Status render
  const renderStatus = (cellData: { value: CapaStatus }) => {
    return <WorkflowStatusBadge status={cellData.value} />;
  };

  // Source type render
  const renderSourceType = (cellData: { value: string }) => {
    const labels: Record<string, string> = {
      deviation: 'Deviation',
      complaint: 'Complaint',
      audit_finding: 'Audit Finding',
      other: 'Other',
    };
    return labels[cellData.value] || cellData.value;
  };

  // Overdue indicator
  const renderOverdue = (cellData: { data: Capa }) => {
    if (cellData.data.isOverdue) {
      return (
        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs">Overdue</span>
        </span>
      );
    }
    return null;
  };

  // Action progress render
  const renderActionProgress = (cellData: { data: Capa }) => {
    const { actionCount = 0, actionsCompleted = 0 } = cellData.data;
    if (actionCount === 0) return <span className="text-muted-foreground text-xs">No actions</span>;

    const isComplete = actionsCompleted === actionCount;
    return (
      <div className="flex items-center gap-2">
        {isComplete ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <Clock className="h-4 w-4 text-yellow-600" />
        )}
        <span className="text-xs">
          {actionsCompleted}/{actionCount}
        </span>
      </div>
    );
  };

  // Error state
  if (error && apiError) {
    return (
      <div className="bg-card border rounded-lg shadow-sm p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-red-800 dark:text-red-200">
                Error: {apiError.message}
              </h3>
              {apiError.details && (
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {apiError.details}
                </p>
              )}
              {apiError.stack && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowErrorDetails(!showErrorDetails)}
                    className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400 hover:underline"
                  >
                    {showErrorDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {showErrorDetails ? 'Hide' : 'Show'} Stack Trace
                  </button>
                  {showErrorDetails && (
                    <pre className="mt-2 p-3 bg-red-100 dark:bg-red-900/40 rounded text-xs overflow-x-auto text-red-800 dark:text-red-200 font-mono whitespace-pre-wrap">
                      {apiError.stack}
                    </pre>
                  )}
                </div>
              )}
              <div className="mt-4">
                <DxButton
                  text="Retry"
                  onClick={() => refetch()}
                  stylingMode="outlined"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const columns = [
    {
      dataField: 'capaNumber',
      caption: 'CAPA #',
      width: 140,
      fixed: true,
    },
    {
      dataField: 'title',
      caption: 'Title',
      minWidth: 200,
    },
    {
      dataField: 'sourceType',
      caption: 'Source',
      width: 120,
      cellRender: renderSourceType,
    },
    {
      dataField: 'type',
      caption: 'Type',
      width: 100,
      cellRender: (cellData: { value?: string }) => (
        <span className="capitalize">{cellData.value || ''}</span>
      ),
    },
    {
      dataField: 'priority',
      caption: 'Priority',
      width: 100,
      cellRender: renderPriority,
    },
    {
      dataField: 'status',
      caption: 'Status',
      width: 130,
      cellRender: renderStatus,
    },
    {
      dataField: 'isOverdue',
      caption: '',
      width: 80,
      cellRender: renderOverdue,
    },
    {
      dataField: 'actionCount',
      caption: 'Actions',
      width: 100,
      cellRender: renderActionProgress,
    },
    {
      dataField: 'ownerName',
      caption: 'Owner',
      width: 150,
    },
    {
      dataField: 'dueDate',
      caption: 'Due Date',
      width: 110,
      dataType: 'date',
    },
  ];

  return (
    <div className="bg-card border rounded-lg shadow-sm">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="text-lg font-semibold">CAPAs</h3>
        <div className="flex items-center gap-2">
          <DxButton
            text="Refresh"
            icon="refresh"
            onClick={() => refetch()}
            stylingMode="outlined"
          />
          {onNewCapa && (
            <DxButton
              text="New CAPA"
              icon="add"
              onClick={onNewCapa}
              type="success"
            />
          )}
        </div>
      </div>

      <DxDataGrid
        dataSource={data?.capas || []}
        columns={columns as DxDataGridColumn[]}
        showBorders={false}
        rowAlternationEnabled
        onRowClick={handleRowClick}
        paging
        pageSize={pageSize}
        allowedPageSizes={[10, 20, 50]}
        loading={isLoading}
        noDataText="No CAPAs found"
        height="auto"
      />
    </div>
  );
}
