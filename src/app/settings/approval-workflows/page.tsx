'use client';

/**
 * Approval Workflows List Page (T027)
 * Professional data grid with filtering, search, and CRUD operations
 * Pattern aligned with /template module
 */

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  GitBranch,
  Filter,
  Eye,
  Edit,
  Trash2,
} from 'lucide-react';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  Sorting,
  HeaderFilter,
  LoadPanel,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import SelectBox from 'devextreme-react/select-box';
import TextBox from 'devextreme-react/text-box';
import notify from 'devextreme/ui/notify';
import { Card, CardContent } from '@/components/ui/card';
import type { ApprovalFlowWithDetails, DocumentType } from '@/types/approval-workflow';

// Page header component similar to TemplatePageHeader
function PageHeader({
  title,
  subtitle,
  icon: Icon,
  iconClassName,
  onRefresh,
  isRefreshing,
  actions,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconClassName?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${iconClassName || 'from-blue-500 to-indigo-600'} text-white shadow-lg`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">{title}</h1>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {onRefresh && (
          <Button
            icon={isRefreshing ? 'spindown' : 'refresh'}
            stylingMode="text"
            hint="Refresh"
            onClick={onRefresh}
            disabled={isRefreshing}
            data-testid="refresh-btn"
          />
        )}
        {actions}
      </div>
    </div>
  );
}

const documentTypeLabels: Record<DocumentType, string> = {
  purchase_requisition: 'Purchase Requisition',
  purchase_order: 'Purchase Order',
  ap_invoice: 'AP Invoice',
  ar_invoice: 'AR Invoice',
  payment: 'Payment',
  credit_note: 'Credit Note',
  debit_note: 'Debit Note',
};

const documentTypeOptions = [
  { value: '', label: 'All Document Types' },
  ...Object.entries(documentTypeLabels).map(([value, label]) => ({ value, label })),
];

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

async function fetchFlows(params?: { documentType?: string; isActive?: string }): Promise<ApprovalFlowWithDetails[]> {
  const searchParams = new URLSearchParams();
  if (params?.documentType) searchParams.set('documentType', params.documentType);
  if (params?.isActive) searchParams.set('isActive', params.isActive);

  const res = await fetch(`/api/settings/approval-flows?${searchParams.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch workflows');
  const data = await res.json();
  return data.data || [];
}

async function deleteFlow(id: number): Promise<void> {
  const res = await fetch(`/api/settings/approval-flows/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete workflow');
  }
}

export default function ApprovalWorkflowsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = React.useState('');
  const [documentTypeFilter, setDocumentTypeFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [selectedFlow, setSelectedFlow] = React.useState<ApprovalFlowWithDetails | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const { data: flowsData = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['approval-flows', documentTypeFilter, statusFilter],
    queryFn: () => fetchFlows({
      documentType: documentTypeFilter || undefined,
      isActive: statusFilter ? (statusFilter === 'active' ? 'true' : 'false') : undefined,
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFlow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-flows'] });
      notify('Workflow deleted successfully', 'success', 3000);
      setShowDeleteConfirm(false);
      setSelectedFlow(null);
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Filter flows based on search text (client-side filtering)
  const flows = React.useMemo(() => {
    if (!searchText.trim()) return flowsData;

    const searchLower = searchText.toLowerCase().trim();
    return flowsData.filter((flow) =>
      flow.name?.toLowerCase().includes(searchLower) ||
      flow.description?.toLowerCase().includes(searchLower)
    );
  }, [flowsData, searchText]);

  const handleRowClick = (e: { data: ApprovalFlowWithDetails }) => {
    router.push(`/settings/approval-workflows/${e.data.id}`);
  };

  const handleDelete = (flow: ApprovalFlowWithDetails) => {
    setSelectedFlow(flow);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (selectedFlow) {
      deleteMutation.mutate(selectedFlow.id);
    }
  };

  const renderStatusCell = (cellData: { data: ApprovalFlowWithDetails }) => {
    return (
      <span
        className={`px-2 py-1 text-xs rounded-full ${
          cellData.data.isActive
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800'
        }`}
      >
        {cellData.data.isActive ? 'Active' : 'Inactive'}
      </span>
    );
  };

  const renderDocumentTypeCell = (cellData: { data: ApprovalFlowWithDetails }) => {
    return <span>{documentTypeLabels[cellData.data.documentType as DocumentType]}</span>;
  };

  const renderActionsCell = (cellData: { data: ApprovalFlowWithDetails }) => {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/settings/approval-workflows/${cellData.data.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title="View"
          data-testid={`view-btn-${cellData.data.id}`}
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/settings/approval-workflows/${cellData.data.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
          title="Edit"
          data-testid={`edit-btn-${cellData.data.id}`}
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(cellData.data);
          }}
          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Delete"
          data-testid={`delete-btn-${cellData.data.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <PageHeader
        title="Approval Workflows"
        subtitle="Manage approval workflows for different document types"
        icon={GitBranch}
        iconClassName="from-purple-500 to-pink-600"
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        actions={
          <Button
            text="New Workflow"
            icon="add"
            type="success"
            onClick={() => router.push('/settings/approval-workflows/new')}
            data-testid="new-workflow-btn"
          />
        }
      />

      {/* Delete Confirmation */}
      {showDeleteConfirm && selectedFlow && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-800">Confirm Delete</p>
                <p className="text-sm text-red-600">
                  Are you sure you want to delete &quot;{selectedFlow.name}&quot;? This action cannot be undone.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text="Cancel"
                  stylingMode="outlined"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedFlow(null);
                  }}
                />
                <Button
                  text={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  icon={deleteMutation.isPending ? 'spindown' : 'trash'}
                  type="danger"
                  onClick={confirmDelete}
                  disabled={deleteMutation.isPending}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters & Statistics */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filters:</span>
              </div>
              <div className="w-56">
                <TextBox
                  value={searchText}
                  onValueChanged={(e) => setSearchText(e.value || '')}
                  valueChangeEvent="keyup"
                  placeholder="Search workflows..."
                  showClearButton
                  mode="search"
                  data-testid="search-input"
                />
              </div>
              <div className="w-48">
                <SelectBox
                  dataSource={documentTypeOptions}
                  displayExpr="label"
                  valueExpr="value"
                  value={documentTypeFilter}
                  onValueChanged={(e) => setDocumentTypeFilter(e.value)}
                  placeholder="Document Type"
                  data-testid="document-type-filter"
                />
              </div>
              <div className="w-36">
                <SelectBox
                  dataSource={statusOptions}
                  displayExpr="label"
                  valueExpr="value"
                  value={statusFilter}
                  onValueChanged={(e) => setStatusFilter(e.value)}
                  placeholder="Status"
                  data-testid="status-filter"
                />
              </div>
              {(searchText || documentTypeFilter || statusFilter) && (
                <Button
                  text="Clear"
                  stylingMode="text"
                  onClick={() => {
                    setSearchText('');
                    setDocumentTypeFilter('');
                    setStatusFilter('');
                  }}
                  data-testid="clear-filters-btn"
                />
              )}
            </div>

            {/* Compact Statistics */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-md">
                <span className="text-gray-500">Total:</span>
                <span className="font-semibold text-gray-900">{flowsData.length}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-md">
                <span className="text-green-600">Active:</span>
                <span className="font-semibold text-green-700">{flows.filter((f) => f.isActive).length}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-md">
                <span className="text-gray-500">Inactive:</span>
                <span className="font-semibold text-gray-700">{flows.filter((f) => !f.isActive).length}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Grid */}
      <Card>
        <CardContent className="p-0">
          <DataGrid
            dataSource={flows}
            keyExpr="id"
            showBorders={false}
            showRowLines
            rowAlternationEnabled
            hoverStateEnabled
            columnAutoWidth
            onRowClick={handleRowClick}
            className="min-h-[400px]"
            data-testid="workflows-grid"
          >
            <LoadPanel enabled={isLoading} />
            <FilterRow visible />
            <HeaderFilter visible />
            <Sorting mode="multiple" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo
              showNavigationButtons
            />

            <Column dataField="id" caption="ID" width={70} />
            <Column dataField="name" caption="Name" minWidth={200} />
            <Column
              dataField="documentType"
              caption="Document Type"
              width={180}
              cellRender={renderDocumentTypeCell}
            />
            <Column dataField="priority" caption="Priority" width={80} alignment="center" />
            <Column
              dataField="isActive"
              caption="Status"
              width={100}
              cellRender={renderStatusCell}
              alignment="center"
            />
            <Column
              caption="Rules"
              width={80}
              calculateCellValue={(data: ApprovalFlowWithDetails) => data.rules?.length || 0}
              alignment="center"
            />
            <Column
              caption="Steps"
              width={80}
              calculateCellValue={(data: ApprovalFlowWithDetails) => data.steps?.length || 0}
              alignment="center"
            />
            <Column
              caption="Actions"
              width={120}
              cellRender={renderActionsCell}
              allowFiltering={false}
              allowSorting={false}
              alignment="center"
            />
          </DataGrid>
        </CardContent>
      </Card>
    </div>
  );
}
