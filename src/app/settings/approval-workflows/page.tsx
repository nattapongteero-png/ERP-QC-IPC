'use client';

/**
 * Approval Workflows List Page (T027)
 * Professional data grid with filtering, search, and CRUD operations
 * Pattern aligned with /template module
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
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

const DOCUMENT_TYPES: DocumentType[] = [
  'purchase_requisition',
  'purchase_order',
  'ap_invoice',
  'ar_invoice',
  'payment',
  'credit_note',
  'debit_note',
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
  const t = useTranslations('settings');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = React.useState('');
  const [documentTypeFilter, setDocumentTypeFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [selectedFlow, setSelectedFlow] = React.useState<ApprovalFlowWithDetails | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const documentTypeOptions = React.useMemo(() => [
    { value: '', label: t('approvalWorkflows.allDocumentTypes') },
    ...DOCUMENT_TYPES.map((dt) => ({
      value: dt,
      label: t(`approvalWorkflows.documentTypes.${dt}`),
    })),
  ], [t]);

  const statusOptions = React.useMemo(() => [
    { value: '', label: t('approvalWorkflows.allStatus') },
    { value: 'active', label: t('approvalWorkflows.active') },
    { value: 'inactive', label: t('approvalWorkflows.inactive') },
  ], [t]);

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
      notify(t('approvalWorkflows.deleteSuccess'), 'success', 3000);
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
        {cellData.data.isActive ? t('approvalWorkflows.active') : t('approvalWorkflows.inactive')}
      </span>
    );
  };

  const renderDocumentTypeCell = (cellData: { data: ApprovalFlowWithDetails }) => {
    return <span>{t(`approvalWorkflows.documentTypes.${cellData.data.documentType}`)}</span>;
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
          title={t('approvalWorkflows.view')}
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
          title={t('approvalWorkflows.edit')}
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
          title={t('approvalWorkflows.delete')}
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
        title={t('approvalWorkflows.title')}
        subtitle={t('approvalWorkflows.description')}
        icon={GitBranch}
        iconClassName="from-purple-500 to-pink-600"
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        actions={
          <Button
            text={t('approvalWorkflows.newWorkflow')}
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
                <p className="font-medium text-red-800">{t('approvalWorkflows.confirmDelete')}</p>
                <p className="text-sm text-red-600">
                  {t('approvalWorkflows.confirmDeleteMessage', { name: selectedFlow.name })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text={t('vmiPortalEdit.cancel')}
                  stylingMode="outlined"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedFlow(null);
                  }}
                />
                <Button
                  text={deleteMutation.isPending ? t('approvalWorkflows.deleting') : t('approvalWorkflows.delete')}
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
                <span className="text-sm font-medium text-gray-700">{t('approvalWorkflows.filters')}</span>
              </div>
              <div className="w-56">
                <TextBox
                  value={searchText}
                  onValueChanged={(e) => setSearchText(e.value || '')}
                  valueChangeEvent="keyup"
                  placeholder={t('approvalWorkflows.searchPlaceholder')}
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
                  placeholder={t('approvalWorkflows.documentType')}
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
                  placeholder={t('approvalWorkflows.grid.status')}
                  data-testid="status-filter"
                />
              </div>
              {(searchText || documentTypeFilter || statusFilter) && (
                <Button
                  text={t('approvalWorkflows.clear')}
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
                <span className="text-gray-500">{t('approvalWorkflows.total')}:</span>
                <span className="font-semibold text-gray-900">{flowsData.length}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-md">
                <span className="text-green-600">{t('approvalWorkflows.active')}:</span>
                <span className="font-semibold text-green-700">{flows.filter((f) => f.isActive).length}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-md">
                <span className="text-gray-500">{t('approvalWorkflows.inactive')}:</span>
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

            <Column dataField="id" caption={t('approvalWorkflows.grid.id')} width={70} />
            <Column dataField="name" caption={t('approvalWorkflows.grid.name')} minWidth={200} />
            <Column
              dataField="documentType"
              caption={t('approvalWorkflows.grid.documentType')}
              width={180}
              cellRender={renderDocumentTypeCell}
            />
            <Column dataField="priority" caption={t('approvalWorkflows.grid.priority')} width={80} alignment="center" />
            <Column
              dataField="isActive"
              caption={t('approvalWorkflows.grid.status')}
              width={100}
              cellRender={renderStatusCell}
              alignment="center"
            />
            <Column
              caption={t('approvalWorkflows.grid.rules')}
              width={80}
              calculateCellValue={(data: ApprovalFlowWithDetails) => data.rules?.length || 0}
              alignment="center"
            />
            <Column
              caption={t('approvalWorkflows.grid.steps')}
              width={80}
              calculateCellValue={(data: ApprovalFlowWithDetails) => data.steps?.length || 0}
              alignment="center"
            />
            <Column
              caption={t('approvalWorkflows.grid.actions')}
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
