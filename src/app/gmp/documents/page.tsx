'use client';

/**
 * GMP Document Control Dashboard
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * Professional dashboard for managing GMP controlled documents with:
 * - Responsive page header with icon + actions
 * - KPI stat cards (Total / Active / Draft / Pending Approval)
 * - Mobile card view with tap-to-view + action footer
 * - Empty state + no-results state + loading skeletons
 * - DataGrid for desktop with advanced filtering
 * - Pending approvals panel + status charts
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import DataGrid, {
  Column,
  Paging,
  Pager,
  SearchPanel,
  Sorting,
  LoadPanel,
  MasterDetail,
  StateStoring,
} from 'devextreme-react/data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DocumentApprovalDialog } from '@/components/documents';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
import {
  FileText,
  Clock,
  AlertCircle,
  Bell,
  CheckCircle,
  FilePlus,
  Archive,
  Eye,
  Edit,
  Folder,
  Trash2,
  Search,
  SearchX,
  FileCheck,
  ChevronRight,
  XCircle,
  Calendar,
  Building2,
} from 'lucide-react';
import type { Document, DocumentStatus, DocumentType, PendingApproval } from '@/types/documents';

// ============================================
// Types
// ============================================

interface DocumentDashboard {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  pendingApprovals: number;
  upForReview: number;
}

type TabKey = 'all' | 'active' | 'draft' | 'pending_review' | 'obsolete';

// next-intl translator type (compatible superset for helper components)
type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

// ============================================
// API Functions
// ============================================

async function fetchDashboard(): Promise<DocumentDashboard> {
  const response = await fetch('/api/documents/dashboard');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch dashboard');
  }
  return result.data;
}

async function fetchDocuments(): Promise<{ documents: Document[]; total: number }> {
  const response = await fetch('/api/documents?limit=1000');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch documents');
  }
  return result.data;
}

async function fetchDocumentTypes(): Promise<DocumentType[]> {
  const response = await fetch('/api/documents/types');
  const result = await response.json();
  if (!result.success) return [];
  return result.data;
}

async function fetchPendingApprovals(): Promise<PendingApproval[]> {
  const response = await fetch('/api/documents/approvals');
  const result = await response.json();
  if (!result.success) return [];
  return result.data;
}

// ============================================
// Helper Functions
// ============================================

function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '-';
  }
}

// ============================================
// Sub-Components
// ============================================

interface PendingApprovalsCardProps {
  approvals: PendingApproval[];
  onSelect: (approval: PendingApproval) => void;
}

function PendingApprovalsCard({ approvals, onSelect }: PendingApprovalsCardProps) {
  if (approvals.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-3 sm:mb-4 flex items-center gap-2">
        <Bell className="h-5 w-5" />
        Documents Awaiting Your Approval
        <span className="ml-auto px-2.5 py-0.5 bg-amber-500 text-white rounded-full text-xs font-bold">
          {approvals.length}
        </span>
      </h3>
      <div className="space-y-2">
        {approvals.slice(0, 5).map((approval) => (
          <div
            key={approval.id}
            className="flex items-start sm:items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg cursor-pointer hover:shadow-sm transition-all border border-transparent hover:border-amber-300 dark:hover:border-amber-700 gap-2 flex-col sm:flex-row"
            onClick={() => onSelect(approval)}
          >
            <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex-shrink-0">
                <FileCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{approval.documentTitle}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {approval.documentNumber} • Version {approval.versionNumber}
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right flex-shrink-0 flex sm:block items-center gap-2">
              <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded text-xs font-medium capitalize">
                {approval.approvalRole}
              </span>
              <p className="text-xs text-gray-400 mt-0 sm:mt-1">
                by {approval.submittedBy}
              </p>
            </div>
          </div>
        ))}
        {approvals.length > 5 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 text-center py-2 font-medium">
            +{approvals.length - 5} more pending approvals
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function GmpDocumentsDashboardPage() {
  const router = useRouter();
  const t = useTranslations('gmp');
  // DevExtreme DataGrid initializes column captions at mount only — locale
  // switching doesn't trigger caption refresh. Re-mounting via key={locale}
  // forces DevExtreme to re-read all captions in the active language.
  const locale = useLocale();
  const { isMobile } = useMobile();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchText, setSearchText] = useState('');
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);

  // Fetch dashboard data
  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['documents-dashboard'],
    queryFn: fetchDashboard,
  });

  // Fetch all documents for the grid
  const { data: documentsData, isLoading: documentsLoading, refetch: refetchDocuments } = useQuery({
    queryKey: ['documents-all'],
    queryFn: fetchDocuments,
  });

  // Fetch document types (preserved for future filter support)
  useQuery({
    queryKey: ['document-types'],
    queryFn: fetchDocumentTypes,
  });

  // Fetch pending approvals
  const { data: pendingApprovals, refetch: refetchApprovals } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: fetchPendingApprovals,
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Failed to delete');
    },
    onSuccess: () => {
      refetchDocuments();
      refetchDashboard();
    },
  });

  const handleDelete = useCallback((doc: Document) => {
    if (doc.status !== 'draft') return;
    const confirmed = window.confirm(`ลบเอกสาร "${doc.title}" (${doc.documentNumber})?\nเอกสารที่ลบแล้วจะไม่สามารถกู้คืนได้`);
    if (confirmed) {
      deleteMutation.mutate(doc.id);
    }
  }, [deleteMutation]);

  // Filter documents based on active tab + search
  const filteredDocuments = useMemo(() => {
    let docs: Document[] = documentsData?.documents || [];

    switch (activeTab) {
      case 'active':
        docs = docs.filter(d => d.status === 'active');
        break;
      case 'draft':
        docs = docs.filter(d => d.status === 'draft');
        break;
      case 'pending_review':
        // Documents with pending version approval - would need version status check
        docs = docs.filter(d => d.status === 'draft');
        break;
      case 'obsolete':
        docs = docs.filter(d => d.status === 'obsolete' || d.status === 'archived');
        break;
      default:
        break;
    }

    const q = searchText.trim().toLowerCase();
    if (q) {
      docs = docs.filter(d =>
        (d.documentNumber || '').toLowerCase().includes(q) ||
        (d.title || '').toLowerCase().includes(q) ||
        (d.typeName || '').toLowerCase().includes(q) ||
        (d.departmentName || '').toLowerCase().includes(q)
      );
    }

    return docs.map((item, index) => ({ ...item, _rowNumber: index + 1 }));
  }, [documentsData?.documents, activeTab, searchText]);

  // Tab configuration
  const tabs: Array<{ key: TabKey; label: string; count: number }> = useMemo(() => {
    const totalAll = dashboard?.total ?? documentsData?.documents?.length ?? 0;
    const activeCount = dashboard?.byStatus?.active ?? 0;
    const draftCount = dashboard?.byStatus?.draft ?? 0;
    const pendingCount = dashboard?.upForReview ?? 0;
    const obsoleteCount = (dashboard?.byStatus?.obsolete || 0) + (dashboard?.byStatus?.archived || 0);
    return [
      { key: 'all', label: t('documents.tabs.all'), count: totalAll },
      { key: 'active', label: t('documents.tabs.active'), count: activeCount },
      { key: 'draft', label: t('documents.tabs.draft'), count: draftCount },
      { key: 'pending_review', label: t('documents.tabs.pendingReview'), count: pendingCount },
      { key: 'obsolete', label: t('documents.tabs.obsoleteArchived'), count: obsoleteCount },
    ];
    // t depends on locale — listing it here causes tabs to re-compute when
    // the user switches language so labels follow the active locale.
  }, [dashboard, documentsData?.documents?.length, t]);

  // Handlers
  const handleRefresh = useCallback(() => {
    refetchDashboard();
    refetchDocuments();
    refetchApprovals();
  }, [refetchDashboard, refetchDocuments, refetchApprovals]);

  const handleRowClick = useCallback((e: { data: Document }) => {
    router.push(`/gmp/documents/${e.data.id}`);
  }, [router]);

  const handleNewDocument = useCallback(() => {
    router.push('/gmp/documents/new');
  }, [router]);

  const handleView = useCallback((doc: Document) => {
    router.push(`/gmp/documents/${doc.id}`);
  }, [router]);

  const handleEdit = useCallback((doc: Document) => {
    router.push(`/gmp/documents/${doc.id}?edit=1`);
  }, [router]);

  const handleClearFilters = useCallback(() => {
    setSearchText('');
    setActiveTab('all');
  }, []);

  const handleApprovalSelect = useCallback((approval: PendingApproval) => {
    setSelectedApproval(approval);
    setApprovalDialogOpen(true);
  }, []);

  const handleApprovalClose = useCallback(() => {
    setApprovalDialogOpen(false);
    setSelectedApproval(null);
  }, []);

  const handleApprovalSuccess = useCallback(() => {
    handleApprovalClose();
    handleRefresh();
  }, [handleApprovalClose, handleRefresh]);

  // Cell renderers
  const renderStatus = useCallback((cellData: { value: DocumentStatus }) => {
    return <WorkflowStatusBadge status={cellData.value} />;
  }, []);

  const renderDocumentNumber = useCallback((cellData: { data: Document }) => {
    return (
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
        <span className="font-mono text-sm font-medium">{cellData.data.documentNumber}</span>
      </div>
    );
  }, []);

  const renderVersion = useCallback((cellData: { value: string | null }) => {
    if (!cellData.value) return <span className="text-gray-400">-</span>;
    return (
      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
        v{cellData.value}
      </span>
    );
  }, []);

  const renderActions = useCallback((cellData: { data: Document }) => {
    const doc = cellData.data;
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/gmp/documents/${doc.id}`);
          }}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          title={t('documents.tooltips.viewDocument')}
        >
          <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/gmp/documents/${doc.id}?edit=1`);
          }}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          title={t('documents.tooltips.editDocument')}
        >
          <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        {doc.status === 'draft' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(doc);
            }}
            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
            title={t('documents.tooltips.deleteDraft')}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        )}
      </div>
    );
    // Include t so tooltips refresh when locale changes.
  }, [router, handleDelete, deleteMutation.isPending, t]);

  // Master detail template
  const masterDetailTemplate = useCallback((e: { data: Document }) => {
    const doc = e.data;
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Document Type</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
            {doc.typeName || 'N/A'}
          </p>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Department</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {doc.departmentName || 'N/A'}
          </p>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Created By</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {doc.createdByName || 'N/A'}
          </p>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Retention</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {doc.retentionYears} years
          </p>
        </div>
      </div>
    );
  }, []);

  const isLoading = dashboardLoading || documentsLoading;
  const totalDocs = documentsData?.documents?.length ?? 0;
  const showEmptyState = !isLoading && totalDocs === 0;
  const showNoResultsState = !isLoading && totalDocs > 0 && filteredDocuments.length === 0;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('documents.pageTitle')}
        subtitle={t('documents.description')}
        icon={FileText}
        iconBgColor="bg-violet-100"
        iconColor="text-violet-600"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              text={t('documents.actions.refresh')}
              stylingMode="outlined"
              onClick={handleRefresh}
              className="hidden sm:inline-flex"
            />
            <DxButton
              icon="doc"
              text={t('documents.actions.viewDocument')}
              stylingMode="outlined"
              onClick={() => router.push('/gmp/documents')}
              className="hidden md:inline-flex"
            />
            <DxButton
              icon="plus"
              text={t('documents.actions.newDocument')}
              type="success"
              onClick={handleNewDocument}
            />
          </div>
        }
      />

      {/* KPI Stat Cards - 4 primary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('documents.stats.total')}
          value={dashboard?.total ?? totalDocs}
          icon={FileText}
          iconColor="text-violet-500"
          accentColor="border-violet-500"
          isLoading={isLoading}
          onClick={() => setActiveTab('all')}
        />
        <StatCard
          label={t('documents.stats.active')}
          value={dashboard?.byStatus?.active ?? 0}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
          onClick={() => setActiveTab('active')}
        />
        <StatCard
          label={t('documents.stats.draft')}
          value={dashboard?.byStatus?.draft ?? 0}
          icon={FilePlus}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={isLoading}
          onClick={() => setActiveTab('draft')}
        />
        <StatCard
          label={t('documents.stats.pendingApproval')}
          value={pendingApprovals?.length ?? 0}
          icon={Clock}
          iconColor="text-orange-500"
          accentColor="border-orange-500"
          isLoading={isLoading}
        />
      </div>

      {/* Secondary stats row — visible only on xl+ */}
      <div className="hidden xl:grid grid-cols-3 gap-3 md:gap-4">
        <StatCard
          label={t('documents.stats.upForReview')}
          value={dashboard?.upForReview ?? 0}
          icon={AlertCircle}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('documents.stats.obsoleteArchived')}
          value={(dashboard?.byStatus?.obsolete || 0) + (dashboard?.byStatus?.archived || 0)}
          icon={Archive}
          iconColor="text-gray-400"
          accentColor="border-gray-400"
          isLoading={isLoading}
        />
        <StatCard
          label={t('documents.stats.documentTypes')}
          value={Object.keys(dashboard?.byType || {}).length}
          icon={Folder}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />
      </div>

      {/* Pending Approvals */}
      {pendingApprovals && pendingApprovals.length > 0 && (
        <PendingApprovalsCard
          approvals={pendingApprovals}
          onSelect={handleApprovalSelect}
        />
      )}

      {/* Document List Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 min-w-0 overflow-hidden">
        {/* Filter / Tab row */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-50/50 to-white dark:from-gray-900/20 dark:to-gray-800">
          <div className="flex items-center gap-1 p-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto scrollbar-thin snap-x">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px] ${
                    isActive
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search row */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('documents.search.placeholder')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            <FileText className="h-4 w-4 text-gray-400" />
            <span>{filteredDocuments.length} / {totalDocs}</span>
          </div>
        </div>

        {/* Content: Loading / Empty / No results / Mobile Cards / Desktop Grid */}
        {isLoading ? (
          isMobile ? (
            <DocumentCardSkeletonList count={4} />
          ) : (
            <DataGridLoadingSkeleton />
          )
        ) : showEmptyState ? (
          <EmptyState onCreate={handleNewDocument} t={t} />
        ) : showNoResultsState ? (
          <NoResultsState onClear={handleClearFilters} t={t} />
        ) : isMobile ? (
          <DocumentCardList
            documents={filteredDocuments}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            deleteDisabled={deleteMutation.isPending}
            t={t}
          />
        ) : (
          <DataGrid
            key={locale}
            dataSource={filteredDocuments}
            keyExpr="id"
            showBorders={false}
            showRowLines={true}
            showColumnLines={false}
            rowAlternationEnabled={true}
            hoverStateEnabled={true}
            onRowClick={handleRowClick}
            wordWrapEnabled={false}
            columnAutoWidth={true}
            height={600}
            className="dx-card-grid"
          >
            <LoadPanel enabled={true} />
            <StateStoring enabled={true} type="localStorage" storageKey="documentGridState" />
            <SearchPanel visible={false} />
            <Sorting mode="multiple" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector={true}
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo={true}
              showNavigationButtons={true}
            />
            <MasterDetail enabled={true} component={masterDetailTemplate} />

            <Column
              dataField="_rowNumber"
              caption={t('items.grid.columns.rowNum')}
              width={60}
              alignment="center"
              allowFiltering={false}
              allowSorting={false}
              allowGrouping={false}
              cellRender={(cellInfo) => (
                <span className="text-gray-500 text-sm font-medium">
                  {cellInfo.data._rowNumber}
                </span>
              )}
            />
            <Column
              dataField="documentNumber"
              caption={t('documents.table.columns.documentNumber')}
              minWidth={140}
              fixed={true}
              cellRender={renderDocumentNumber}
            />
            <Column dataField="title" caption={t('documents.table.columns.title')} minWidth={240} />
            <Column dataField="typeName" caption={t('documents.table.columns.type')} minWidth={130} />
            <Column dataField="departmentName" caption={t('documents.table.columns.department')} minWidth={140} />
            <Column
              dataField="currentVersionNumber"
              caption={t('documents.table.columns.version')}
              minWidth={90}
              alignment="center"
              cellRender={renderVersion}
            />
            <Column
              dataField="status"
              caption={t('documents.table.columns.status')}
              minWidth={120}
              cellRender={renderStatus}
            />
            <Column dataField="createdByName" caption={t('documents.table.columns.createdBy')} minWidth={130} />
            <Column
              dataField="updatedAt"
              caption={t('documents.table.columns.lastUpdated')}
              minWidth={130}
              dataType="date"
              format="dd MMM yyyy"
              sortOrder="desc"
            />
            <Column
              caption={t('documents.table.columns.actions')}
              minWidth={120}
              cellRender={renderActions}
              allowFiltering={false}
              allowSorting={false}
            />
          </DataGrid>
        )}
      </div>

      {/* Approval Dialog */}
      <DocumentApprovalDialog
        approval={selectedApproval}
        open={approvalDialogOpen}
        onClose={handleApprovalClose}
        onSuccess={handleApprovalSuccess}
      />
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

/** Mobile Card List — replaces DataGrid on mobile viewports. */
function DocumentCardList({
  documents,
  onView,
  onEdit,
  onDelete,
  deleteDisabled,
  t,
}: {
  documents: Document[];
  onView: (doc: Document) => void;
  onEdit: (doc: Document) => void;
  onDelete: (doc: Document) => void;
  deleteDisabled: boolean;
  t: TranslateFn;
}) {
  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; icon: React.ReactNode }> = {
      draft: { color: 'bg-amber-100 text-amber-800', icon: <FilePlus className="h-3 w-3" /> },
      active: { color: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle className="h-3 w-3" /> },
      obsolete: { color: 'bg-gray-100 text-gray-700', icon: <Archive className="h-3 w-3" /> },
      archived: { color: 'bg-blue-100 text-blue-700', icon: <Archive className="h-3 w-3" /> },
    };
    const config = map[status] || { color: 'bg-gray-100 text-gray-700', icon: null };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide ${config.color}`}>
        {config.icon}
        {status}
      </span>
    );
  };

  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30 dark:bg-gray-900/20">
      {documents.map((doc) => {
        const isDraft = doc.status === 'draft';
        return (
          <div
            key={doc.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 dark:active:bg-gray-700 transition-all"
          >
            {/* Card body: tap to view */}
            <button
              type="button"
              onClick={() => onView(doc)}
              className="w-full text-left p-4 flex items-start gap-3"
            >
              <div className="h-11 w-11 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-gray-900 dark:text-white text-sm truncate">{doc.documentNumber}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200 truncate mt-0.5" title={doc.title}>{doc.title}</p>
                  </div>
                  {statusBadge(doc.status)}
                </div>

                {/* Type / department line */}
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600 dark:text-gray-400">
                  {doc.typeName && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <Folder className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{doc.typeName}</span>
                    </span>
                  )}
                  {doc.departmentName && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <Building2 className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{doc.departmentName}</span>
                    </span>
                  )}
                </div>

                {/* Tags row */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {doc.currentVersionNumber && (
                    <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 px-2 py-0.5 rounded">
                      v{doc.currentVersionNumber}
                    </span>
                  )}
                  {doc.updatedAt && (
                    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 px-2 py-0.5 rounded">
                      <Calendar className="h-3 w-3" />
                      {formatDate(doc.updatedAt)}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0 mt-1" />
            </button>

            {/* Card footer: action buttons (touch-friendly) */}
            <div className="flex items-center border-t border-gray-100 dark:border-gray-700 divide-x divide-gray-100 dark:divide-gray-700">
              <button
                type="button"
                onClick={() => onView(doc)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-900/30 active:bg-indigo-100 transition-colors min-h-[44px]"
              >
                <Eye className="h-4 w-4" />
                <span>{t('documents.actions.viewDocument') || 'View'}</span>
              </button>
              <button
                type="button"
                onClick={() => onEdit(doc)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/30 active:bg-emerald-100 transition-colors min-h-[44px]"
              >
                <Edit className="h-4 w-4" />
                <span>{t('documents.actions.editDocument') || 'Edit'}</span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(doc)}
                disabled={!isDraft || deleteDisabled}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/30 active:bg-red-100 transition-colors min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Loading skeleton for mobile card list */
function DocumentCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-gray-200 rounded" />
              <div className="h-3 w-1/3 bg-gray-200 rounded" />
              <div className="h-3 w-2/3 bg-gray-200 rounded" />
              <div className="flex gap-2 pt-1">
                <div className="h-5 w-16 bg-gray-200 rounded-full" />
                <div className="h-5 w-20 bg-gray-200 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Loading skeleton for desktop DataGrid area */
function DataGridLoadingSkeleton() {
  return (
    <div className="p-4 space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-lg animate-pulse">
          <div className="h-8 w-8 rounded-lg bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/4 bg-gray-200 rounded" />
            <div className="h-2 w-1/6 bg-gray-200 rounded" />
          </div>
          <div className="h-6 w-20 bg-gray-200 rounded-full" />
          <div className="h-6 w-16 bg-gray-200 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Empty State — shown when there are zero documents at all */
function EmptyState({ onCreate, t }: { onCreate: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-violet-100 flex items-center justify-center mb-5">
        <FileText className="h-10 w-10 text-violet-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        ยังไม่มีเอกสาร GMP
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        เริ่มต้นการจัดการเอกสาร GMP ของคุณโดยสร้างเอกสารใหม่ฉบับแรก
      </p>
      <DxButton
        text={t('documents.actions.newDocument')}
        icon="plus"
        type="success"
        onClick={onCreate}
      />
    </div>
  );
}

/** No Results State — shown when filter/search yields zero results */
function NoResultsState({ onClear, t }: { onClear: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('documents.noResultsTitle')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('documents.noResultsDescription')}
      </p>
      <DxButton
        text={t('common.clearFilters')}
        icon="clear"
        stylingMode="outlined"
        onClick={onClear}
      />
    </div>
  );
}

// Preserve XCircle import usage for future empty/status states
void XCircle;
