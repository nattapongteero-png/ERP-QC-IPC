'use client';

/**
 * Change Control List Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 *
 * Professional dashboard for managing GMP change requests with:
 * - KPI cards showing change statistics by status and priority
 * - DevExtreme DataGrid with filtering and sorting
 * - Navigate to detail page on row click
 * - Create new change request button
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
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
  StateStoring,
} from 'devextreme-react/data-grid';
import Button from 'devextreme-react/button';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import {
  FileEdit,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Eye,
  Plus,
  RefreshCw,
} from 'lucide-react';
import type { ChangeRequest, ChangeStatus, ChangeType, ChangePriority } from '@/types/change-control';

// ============================================
// Types
// ============================================

interface ChangeDashboard {
  total: number;
  byStatus: Record<ChangeStatus, number>;
  byPriority: Record<ChangePriority, number>;
  byType: Record<ChangeType, number>;
}

// ============================================
// API Functions
// ============================================

async function fetchChangeRequests(): Promise<{ changes: ChangeRequest[]; total: number }> {
  const response = await fetch('/api/changes?limit=1000');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch change requests');
  }
  return result.data;
}

// ============================================
// Helper Functions
// ============================================

function calculateDashboard(changes: ChangeRequest[]): ChangeDashboard {
  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const byType: Record<string, number> = {};

  changes.forEach((change) => {
    byStatus[change.status] = (byStatus[change.status] || 0) + 1;
    byPriority[change.priority] = (byPriority[change.priority] || 0) + 1;
    byType[change.changeType] = (byType[change.changeType] || 0) + 1;
  });

  return {
    total: changes.length,
    byStatus: byStatus as Record<ChangeStatus, number>,
    byPriority: byPriority as Record<ChangePriority, number>,
    byType: byType as Record<ChangeType, number>,
  };
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

// ============================================
// Main Component
// ============================================

export default function ChangeControlListPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<ChangeStatus | undefined>();

  // Fetch all change requests
  const { data: changesData, isLoading, refetch } = useQuery({
    queryKey: ['changes-all'],
    queryFn: fetchChangeRequests,
  });

  // Calculate dashboard stats
  const dashboard = useMemo(() => {
    if (!changesData?.changes) return null;
    return calculateDashboard(changesData.changes);
  }, [changesData?.changes]);

  // Filter changes based on status filter
  const filteredChanges = useMemo(() => {
    if (!changesData?.changes) return [];
    if (!statusFilter) return changesData.changes;
    return changesData.changes.filter((c) => c.status === statusFilter);
  }, [changesData?.changes, statusFilter]);

  // Handlers
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleRowClick = useCallback((e: { data: ChangeRequest }) => {
    router.push(`/gmp/changes/${e.data.id}`);
  }, [router]);

  const handleNewChange = useCallback(() => {
    router.push('/gmp/changes/new');
  }, [router]);

  // Cell renderers
  const renderStatus = useCallback((cellData: { value: ChangeStatus }) => {
    return <WorkflowStatusBadge status={cellData.value} />;
  }, []);

  const renderChangeNumber = useCallback((cellData: { data: ChangeRequest }) => {
    return (
      <div className="flex items-center gap-2">
        <FileEdit className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        <span className="font-mono text-sm font-medium">{cellData.data.changeNumber}</span>
      </div>
    );
  }, []);

  const renderPriority = useCallback((cellData: { value: ChangePriority }) => {
    const colors: Record<ChangePriority, string> = {
      low: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
      urgent: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${colors[cellData.value]}`}>
        {cellData.value}
      </span>
    );
  }, []);

  const renderChangeType = useCallback((cellData: { value: ChangeType }) => {
    const labels: Record<ChangeType, string> = {
      process: 'Process',
      equipment: 'Equipment',
      document: 'Document',
      supplier: 'Supplier',
      formula: 'Formula',
      other: 'Other',
    };
    return <span className="capitalize">{labels[cellData.value]}</span>;
  }, []);

  const renderTargetDate = useCallback((cellData: { value: string | null }) => {
    if (!cellData.value) return <span className="text-gray-400">-</span>;
    const date = new Date(cellData.value);
    const today = new Date();
    const isOverdue = date < today;
    return (
      <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
        {date.toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </span>
    );
  }, []);

  const renderActions = useCallback((cellData: { data: ChangeRequest }) => {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/gmp/changes/${cellData.data.id}`);
          }}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          title="View change request"
        >
          <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
    );
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <FileEdit className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                Change Control
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Manage change requests and approval workflows • GMP Chapter 8 Compliance
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
                text="New Change Request"
                type="success"
                onClick={handleNewChange}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1920px] mx-auto px-6 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <KpiCard
            title="Total Changes"
            value={dashboard?.total || 0}
            subtitle="All change requests"
            icon={FileEdit}
            iconBg="bg-blue-100 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
            onClick={() => setStatusFilter(undefined)}
          />
          <KpiCard
            title="Draft"
            value={dashboard?.byStatus?.draft || 0}
            subtitle="In preparation"
            icon={FileEdit}
            iconBg="bg-gray-100 dark:bg-gray-800"
            iconColor="text-gray-600 dark:text-gray-400"
            onClick={() => setStatusFilter('draft')}
          />
          <KpiCard
            title="Pending Review"
            value={dashboard?.byStatus?.pending_review || 0}
            subtitle="Awaiting approval"
            icon={Clock}
            iconBg="bg-yellow-100 dark:bg-yellow-900/30"
            iconColor="text-yellow-600 dark:text-yellow-400"
            onClick={() => setStatusFilter('pending_review')}
          />
          <KpiCard
            title="Approved"
            value={dashboard?.byStatus?.approved || 0}
            subtitle="Ready to implement"
            icon={CheckCircle}
            iconBg="bg-green-100 dark:bg-green-900/30"
            iconColor="text-green-600 dark:text-green-400"
            onClick={() => setStatusFilter('approved')}
          />
          <KpiCard
            title="Implemented"
            value={dashboard?.byStatus?.implemented || 0}
            subtitle="Changes applied"
            icon={CheckCircle}
            iconBg="bg-blue-100 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
            onClick={() => setStatusFilter('implemented')}
          />
          <KpiCard
            title="Closed"
            value={dashboard?.byStatus?.closed || 0}
            subtitle="Completed"
            icon={CheckCircle}
            iconBg="bg-emerald-100 dark:bg-emerald-900/30"
            iconColor="text-emerald-600 dark:text-emerald-400"
            onClick={() => setStatusFilter('closed')}
          />
        </div>

        {/* Data Grid */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <DataGrid
            dataSource={filteredChanges}
            showBorders={false}
            showRowLines={true}
            showColumnLines={false}
            rowAlternationEnabled={true}
            hoverStateEnabled={true}
            onRowClick={handleRowClick}
            wordWrapEnabled={false}
            columnAutoWidth={true}
            height="calc(100vh - 400px)"
            className="dx-card-grid"
          >
            <LoadPanel enabled={true} />
            <StateStoring enabled={true} type="localStorage" storageKey="changeControlGridState" />
            <SearchPanel visible={true} width={250} placeholder="Search changes..." />
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

            <Column
              dataField="changeNumber"
              caption="Change No."
              width={150}
              fixed={true}
              cellRender={renderChangeNumber}
            />
            <Column dataField="title" caption="Title" minWidth={250} />
            <Column
              dataField="changeType"
              caption="Type"
              width={120}
              cellRender={renderChangeType}
            />
            <Column
              dataField="priority"
              caption="Priority"
              width={100}
              alignment="center"
              cellRender={renderPriority}
            />
            <Column
              dataField="status"
              caption="Status"
              width={140}
              cellRender={renderStatus}
            />
            <Column dataField="ownerName" caption="Owner" width={150} />
            <Column
              dataField="targetDate"
              caption="Target Date"
              width={130}
              dataType="date"
              cellRender={renderTargetDate}
            />
            <Column
              dataField="createdAt"
              caption="Created"
              width={130}
              dataType="date"
              format="dd MMM yyyy"
              sortOrder="desc"
            />
            <Column
              caption="Actions"
              width={80}
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
    </div>
  );
}
