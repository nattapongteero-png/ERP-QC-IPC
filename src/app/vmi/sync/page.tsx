'use client';

/**
 * VMI Sync Page
 *
 * Page for managing VMI synchronization to external portals.
 * Displays sync status, history, and manual trigger controls.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { MainLayout } from '@/components/layout/main-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxDataGrid, type DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { VmiSyncStatusCard, VmiSyncTrigger } from '@/components/vmi';
import { DxButton } from '@/components/ui/dx-button';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { DataGridTypes } from 'devextreme-react/data-grid';
import type { VmiSyncType, VmiSyncStatus } from '@/types/vmi';

// ============================================
// Types
// ============================================

interface SyncHistoryItem {
  id: number;
  portalId: number;
  portalName?: string;
  syncType: VmiSyncType;
  triggerType: string;
  status: VmiSyncStatus;
  itemsTotal: number;
  itemsProcessed: number;
  itemsFailed: number;
  startedAt: string;
  completedAt?: string | null;
  triggeredByName?: string | null;
}

// ============================================
// API Functions
// ============================================

async function fetchSyncHistory(): Promise<{
  items: SyncHistoryItem[];
  total: number;
}> {
  const response = await fetch('/api/vmi-sync/status?limit=50');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch sync history');
  }
  return result.data;
}

// ============================================
// Component
// ============================================

export default function VmiSyncPage() {
  // Fetch sync history
  const {
    data: historyData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['vmi-sync-history'],
    queryFn: fetchSyncHistory,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Get last sync for each type
  const getLastSync = (syncType: VmiSyncType): SyncHistoryItem | null => {
    if (!historyData?.items) return null;
    return historyData.items.find((item) => item.syncType === syncType) || null;
  };

  // Check if any sync is running
  const isAnyRunning = historyData?.items?.some((item) => item.status === 'running') || false;

  // Define columns for history grid
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'syncType',
      caption: 'Type',
      width: 100,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const typeLabels: Record<string, string> = {
          inventory: 'Inventory',
          items: 'Items',
          prices: 'Prices',
          orders: 'Orders',
        };
        const typeColors: Record<string, string> = {
          inventory: 'bg-blue-50 text-blue-700',
          items: 'bg-purple-50 text-purple-700',
          prices: 'bg-green-50 text-green-700',
          orders: 'bg-orange-50 text-orange-700',
        };
        const type = cellInfo.value as string;
        return (
          <span className={cn('px-2 py-1 rounded text-xs font-medium', typeColors[type])}>
            {typeLabels[type] || type}
          </span>
        );
      },
    },
    {
      dataField: 'status',
      caption: 'Status',
      width: 100,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const statusColors: Record<string, string> = {
          running: 'bg-blue-50 text-blue-700',
          completed: 'bg-green-50 text-green-700',
          partial: 'bg-yellow-50 text-yellow-700',
          failed: 'bg-red-50 text-red-700',
        };
        const status = cellInfo.value as string;
        return (
          <span className={cn('px-2 py-1 rounded text-xs font-medium', statusColors[status])}>
            {status}
          </span>
        );
      },
    },
    {
      dataField: 'triggerType',
      caption: 'Trigger',
      width: 100,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const triggerLabels: Record<string, string> = {
          manual: 'Manual',
          scheduled: 'Scheduled',
          threshold: 'Threshold',
        };
        return triggerLabels[cellInfo.value as string] || cellInfo.value;
      },
    },
    {
      dataField: 'itemsProcessed',
      caption: 'Synced',
      width: 80,
      alignment: 'center',
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const rowData = cellInfo.data as SyncHistoryItem;
        return (
          <span>
            <span className="text-green-600 font-medium">{rowData.itemsProcessed}</span>
            <span className="text-gray-400">/{rowData.itemsTotal}</span>
          </span>
        );
      },
    },
    {
      dataField: 'itemsFailed',
      caption: 'Failed',
      width: 70,
      alignment: 'center',
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const value = cellInfo.value as number;
        if (value === 0) return <span className="text-gray-400">-</span>;
        return <span className="text-red-600 font-medium">{value}</span>;
      },
    },
    {
      dataField: 'startedAt',
      caption: 'Started',
      dataType: 'datetime',
      width: 160,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        if (!cellInfo.value) return '-';
        return new Date(cellInfo.value as string).toLocaleString();
      },
    },
    {
      dataField: 'completedAt',
      caption: 'Completed',
      dataType: 'datetime',
      width: 160,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        if (!cellInfo.value) return <span className="text-gray-400">Running...</span>;
        return new Date(cellInfo.value as string).toLocaleString();
      },
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="VMI Synchronization"
          description="Manage outbound synchronization of inventory, items, and prices to VMI Portals."
          breadcrumb={[
            { label: 'VMI', href: '/vmi' },
            { label: 'Sync' },
          ]}
          actions={
            <DxButton
              icon="refresh"
              type="normal"
              onClick={() => refetch()}
              hint="Refresh"
            />
          }
        />

        {/* Sync Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <VmiSyncStatusCard
            syncType="inventory"
            lastSync={getLastSync('inventory')}
            isRunning={isAnyRunning && getLastSync('inventory')?.status === 'running'}
          />
          <VmiSyncStatusCard
            syncType="items"
            lastSync={getLastSync('items')}
            isRunning={isAnyRunning && getLastSync('items')?.status === 'running'}
          />
          <VmiSyncStatusCard
            syncType="prices"
            lastSync={getLastSync('prices')}
            isRunning={isAnyRunning && getLastSync('prices')?.status === 'running'}
          />
        </div>

        {/* Manual Sync Trigger */}
        <VmiSyncTrigger
          onSyncComplete={() => refetch()}
        />

        {/* Sync History */}
        <Card elevation="raised">
          <CardHeader>
            <CardTitle>Sync History</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-center gap-3 p-4 mb-4 rounded-lg bg-red-50 text-red-800 border border-red-200">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                {error instanceof Error ? error.message : 'Failed to load sync history'}
              </div>
            )}

            <DxDataGrid
              dataSource={historyData?.items || []}
              columns={columns}
              keyExpr="id"
              loading={isLoading}
              height={400}
              paging
              pageSize={20}
              sorting
              noDataText="No sync history available"
            />
          </CardContent>
        </Card>

        {/* Help Section */}
        <div className="p-6 bg-blue-50 rounded-lg border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">About VMI Synchronization</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>
              <strong>Inventory Sync:</strong> Pushes current stock levels to VMI Portals so hospitals
              can see your available inventory.
            </p>
            <p>
              <strong>Items Sync:</strong> Updates the product catalog on VMI Portals, including
              TPP/TTMT codes for standardized identification.
            </p>
            <p>
              <strong>Prices Sync:</strong> Sends current pricing information to VMI Portals for
              order calculations.
            </p>
            <p className="mt-4">
              <strong>Sync Triggers:</strong> Use manual sync for immediate updates, or configure
              scheduled sync intervals in Portal Settings.
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
