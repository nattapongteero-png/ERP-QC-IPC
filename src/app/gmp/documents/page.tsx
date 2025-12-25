'use client';

/**
 * GMP Document Control Dashboard
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * Professional dashboard for managing GMP controlled documents with:
 * - KPI cards with document statistics
 * - Status and Type distribution charts
 * - Pending approvals panel
 * - Tabbed data views
 * - Enhanced data grid with advanced filtering
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Selection,
  Sorting,
  ColumnChooser,
  Export,
  Toolbar,
  Item,
  LoadPanel,
  MasterDetail,
  StateStoring,
} from 'devextreme-react/data-grid';
import { PieChart, Series, Label, Legend, Tooltip, Connector } from 'devextreme-react/pie-chart';
import { Chart, CommonSeriesSettings, Series as ChartSeries, ArgumentAxis, ValueAxis, Legend as ChartLegend, Tooltip as ChartTooltip } from 'devextreme-react/chart';
import Button from 'devextreme-react/button';
import { DocumentApprovalDialog } from '@/components/documents';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import {
  FileText,
  Clock,
  AlertCircle,
  Bell,
  CheckCircle,
  FolderOpen,
  FileCheck,
  FilePlus,
  FileX,
  Archive,
  Eye,
  Edit,
  Folder,
  BarChart3,
  PieChart as PieChartIcon,
  Users,
  Calendar,
  TrendingUp,
  Shield,
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

interface TabConfig {
  id: TabKey;
  text: string;
  icon: React.ElementType;
  badge?: number;
}

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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ============================================
// Sub-Components
// ============================================

interface KpiCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  onClick?: () => void;
}

function KpiCard({ title, value, subtitle, icon: Icon, iconBg, iconColor, onClick }: KpiCardProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconBg}`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

interface PendingApprovalsCardProps {
  approvals: PendingApproval[];
  onSelect: (approval: PendingApproval) => void;
}

function PendingApprovalsCard({ approvals, onSelect }: PendingApprovalsCardProps) {
  if (approvals.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-4 flex items-center gap-2">
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
            className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg cursor-pointer hover:shadow-sm transition-all border border-transparent hover:border-amber-300 dark:hover:border-amber-700"
            onClick={() => onSelect(approval)}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <FileCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-medium text-sm text-gray-900 dark:text-white">{approval.documentTitle}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {approval.documentNumber} • Version {approval.versionNumber}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded text-xs font-medium capitalize">
                {approval.approvalRole}
              </span>
              <p className="text-xs text-gray-400 mt-1">
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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
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

  // Fetch document types
  const { data: documentTypes } = useQuery({
    queryKey: ['document-types'],
    queryFn: fetchDocumentTypes,
  });

  // Fetch pending approvals
  const { data: pendingApprovals, refetch: refetchApprovals } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: fetchPendingApprovals,
  });

  // Filter documents based on active tab
  const filteredDocuments = useMemo(() => {
    if (!documentsData?.documents) return [];

    switch (activeTab) {
      case 'active':
        return documentsData.documents.filter(d => d.status === 'active');
      case 'draft':
        return documentsData.documents.filter(d => d.status === 'draft');
      case 'pending_review':
        // Documents with pending version approval - would need version status check
        return documentsData.documents.filter(d => d.status === 'draft');
      case 'obsolete':
        return documentsData.documents.filter(d => d.status === 'obsolete' || d.status === 'archived');
      default:
        return documentsData.documents;
    }
  }, [documentsData?.documents, activeTab]);

  // Chart data
  const statusChartData = useMemo(() => {
    if (!dashboard?.byStatus) return [];
    const statusLabels: Record<string, string> = {
      draft: 'Draft',
      active: 'Active',
      obsolete: 'Obsolete',
      archived: 'Archived',
    };
    const statusColors: Record<string, string> = {
      draft: '#f59e0b',
      active: '#22c55e',
      obsolete: '#6b7280',
      archived: '#3b82f6',
    };
    return Object.entries(dashboard.byStatus)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        status: statusLabels[status] || status,
        count,
        color: statusColors[status] || '#6b7280',
      }));
  }, [dashboard?.byStatus]);

  const typeChartData = useMemo(() => {
    if (!dashboard?.byType) return [];
    return Object.entries(dashboard.byType)
      .filter(([, count]) => count > 0)
      .slice(0, 8) // Top 8 types
      .map(([type, count]) => ({
        type,
        count,
      }));
  }, [dashboard?.byType]);

  // Tab configuration
  const tabs: TabConfig[] = useMemo(() => [
    { id: 'all', text: 'All Documents', icon: Folder, badge: dashboard?.total },
    { id: 'active', text: 'Active', icon: CheckCircle, badge: dashboard?.byStatus?.active },
    { id: 'draft', text: 'Draft', icon: FilePlus, badge: dashboard?.byStatus?.draft },
    { id: 'pending_review', text: 'Pending Review', icon: Clock, badge: dashboard?.upForReview },
    { id: 'obsolete', text: 'Obsolete/Archived', icon: Archive, badge: (dashboard?.byStatus?.obsolete || 0) + (dashboard?.byStatus?.archived || 0) },
  ], [dashboard]);

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
        <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
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
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/gmp/documents/${cellData.data.id}`);
          }}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          title="View document"
        >
          <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/gmp/documents/${cellData.data.id}/edit`);
          }}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          title="Edit document"
        >
          <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
    );
  }, [router]);

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <FolderOpen className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                GMP Document Control
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Manage controlled documents, versions, and approvals • GMP Chapter 5 Compliance
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                icon="refresh"
                text="Refresh"
                stylingMode="outlined"
                onClick={handleRefresh}
              />
              <Button
                icon="plus"
                text="New Document"
                type="success"
                onClick={handleNewDocument}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1920px] mx-auto px-6 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <KpiCard
            title="Total Documents"
            value={dashboard?.total || 0}
            subtitle="Controlled documents"
            icon={FileText}
            iconBg="bg-blue-100 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
            onClick={() => setActiveTab('all')}
          />
          <KpiCard
            title="Active"
            value={dashboard?.byStatus?.active || 0}
            subtitle="Currently effective"
            icon={CheckCircle}
            iconBg="bg-green-100 dark:bg-green-900/30"
            iconColor="text-green-600 dark:text-green-400"
            onClick={() => setActiveTab('active')}
          />
          <KpiCard
            title="Draft"
            value={dashboard?.byStatus?.draft || 0}
            subtitle="Under preparation"
            icon={FilePlus}
            iconBg="bg-yellow-100 dark:bg-yellow-900/30"
            iconColor="text-yellow-600 dark:text-yellow-400"
            onClick={() => setActiveTab('draft')}
          />
          <KpiCard
            title="Pending Approvals"
            value={pendingApprovals?.length || 0}
            subtitle="Awaiting review"
            icon={Clock}
            iconBg={pendingApprovals?.length ? "bg-amber-100 dark:bg-amber-900/30" : "bg-gray-100 dark:bg-gray-800"}
            iconColor={pendingApprovals?.length ? "text-amber-600 dark:text-amber-400" : "text-gray-400"}
          />
          <KpiCard
            title="Up for Review"
            value={dashboard?.upForReview || 0}
            subtitle="Review period ending"
            icon={AlertCircle}
            iconBg={dashboard?.upForReview ? "bg-red-100 dark:bg-red-900/30" : "bg-gray-100 dark:bg-gray-800"}
            iconColor={dashboard?.upForReview ? "text-red-600 dark:text-red-400" : "text-gray-400"}
          />
        </div>

        {/* Pending Approvals */}
        {pendingApprovals && pendingApprovals.length > 0 && (
          <PendingApprovalsCard
            approvals={pendingApprovals}
            onSelect={handleApprovalSelect}
          />
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <PieChartIcon className="w-4 h-4" />
              Status Distribution
            </h3>
            {statusChartData.length > 0 ? (
              <PieChart
                id="status-pie"
                dataSource={statusChartData}
                type="doughnut"
                innerRadius={0.65}
                palette={statusChartData.map(d => d.color)}
              >
                <Series argumentField="status" valueField="count">
                  <Label visible={true} position="inside" customizeText={(e: { valueText: string }) => e.valueText}>
                    <Connector visible={false} />
                  </Label>
                </Series>
                <Legend
                  visible={true}
                  horizontalAlignment="right"
                  verticalAlignment="top"
                  itemTextPosition="right"
                />
                <Tooltip enabled={true} />
              </PieChart>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </div>

          {/* Document Types Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Documents by Type
            </h3>
            {typeChartData.length > 0 ? (
              <Chart
                id="type-chart"
                dataSource={typeChartData}
                rotated={true}
              >
                <CommonSeriesSettings type="bar" argumentField="type" valueField="count" />
                <ChartSeries
                  name="Count"
                  color="#10b981"
                  barWidth={25}
                />
                <ArgumentAxis />
                <ValueAxis />
                <ChartLegend visible={false} />
                <ChartTooltip enabled={true} />
              </Chart>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Tabs and Data Grid */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          {/* Custom Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-4">
            <div className="flex items-center gap-1 overflow-x-auto py-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.text}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      activeTab === tab.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Data Grid */}
          <DataGrid
            dataSource={filteredDocuments}
            showBorders={false}
            showRowLines={true}
            showColumnLines={false}
            rowAlternationEnabled={true}
            hoverStateEnabled={true}
            onRowClick={handleRowClick}
            wordWrapEnabled={false}
            columnAutoWidth={true}
            height="calc(100vh - 600px)"
            className="dx-card-grid"
          >
            <LoadPanel enabled={true} />
            <StateStoring enabled={true} type="localStorage" storageKey="documentGridState" />
            <SearchPanel visible={true} width={250} placeholder="Search documents..." />
            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <Sorting mode="multiple" />
            <ColumnChooser enabled={true} mode="select" />
            <Export enabled={true} allowExportSelectedData={true} />
            <Selection mode="multiple" showCheckBoxesMode="onClick" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector={true}
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo={true}
              showNavigationButtons={true}
            />
            <MasterDetail enabled={true} component={masterDetailTemplate} />

            <Column
              dataField="documentNumber"
              caption="Document No."
              width={150}
              fixed={true}
              cellRender={renderDocumentNumber}
            />
            <Column dataField="title" caption="Title" minWidth={250} />
            <Column dataField="typeName" caption="Type" width={150} />
            <Column dataField="departmentName" caption="Department" width={150} />
            <Column
              dataField="currentVersionNumber"
              caption="Version"
              width={90}
              alignment="center"
              cellRender={renderVersion}
            />
            <Column
              dataField="status"
              caption="Status"
              width={120}
              cellRender={renderStatus}
            />
            <Column dataField="createdByName" caption="Created By" width={130} />
            <Column
              dataField="updatedAt"
              caption="Last Updated"
              width={130}
              dataType="date"
              format="dd MMM yyyy"
              sortOrder="desc"
            />
            <Column
              caption="Actions"
              width={90}
              cellRender={renderActions}
              allowFiltering={false}
              allowSorting={false}
            />

            <Toolbar>
              <Item name="searchPanel" />
              <Item name="columnChooserButton" />
              <Item name="exportButton" />
            </Toolbar>
          </DataGrid>
        </div>
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
