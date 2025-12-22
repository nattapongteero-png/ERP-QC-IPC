'use client';

/**
 * VMI Portal List Component
 *
 * DataGrid displaying all configured VMI portals with status and actions.
 * This system IS the vendor - shows connections TO external VMI portals.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { DxDataGrid, type DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Item } from 'devextreme-react/data-grid';
import {
  Wifi,
  WifiOff,
  XCircle,
  Edit2,
  Trash2,
  PlayCircle,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DataGridTypes } from 'devextreme-react/data-grid';

// ============================================
// Types
// ============================================

interface VmiPortalConfigSummary {
  id: number;
  name: string;
  portalUrl: string;
  vendorId: string;
  isEnabled: boolean;
  hasApiKey: boolean;
  syncInventoryEnabled: boolean;
  syncItemsEnabled: boolean;
  syncPricesEnabled: boolean;
  orderPollingEnabled: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  lastErrorMessage?: string | null;
  lastInventorySyncAt?: string | null;
  lastItemsSyncAt?: string | null;
  lastPricesSyncAt?: string | null;
  lastOrdersPollAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// API Functions
// ============================================

async function fetchPortals(): Promise<VmiPortalConfigSummary[]> {
  const response = await fetch('/api/settings/vmi');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch portals');
  }
  return result.data;
}

async function deletePortal(id: number): Promise<void> {
  const response = await fetch(`/api/settings/vmi/${id}`, {
    method: 'DELETE',
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete portal');
  }
}

async function testConnection(id: number): Promise<{ connected: boolean; error?: string }> {
  const response = await fetch(`/api/settings/vmi/${id}/test`, {
    method: 'POST',
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Connection test failed');
  }
  return result.data;
}

// ============================================
// Component
// ============================================

export function VmiPortalList() {
  const queryClient = useQueryClient();
  const [testingPortalId, setTestingPortalId] = useState<number | null>(null);

  // Fetch portals
  const {
    data: portals = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['vmi-portals'],
    queryFn: fetchPortals,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deletePortal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vmi-portals'] });
    },
  });

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: testConnection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vmi-portals'] });
    },
    onSettled: () => {
      setTestingPortalId(null);
    },
  });

  // Handle delete portal
  const handleDelete = useCallback(
    async (portal: VmiPortalConfigSummary) => {
      if (window.confirm(`Are you sure you want to delete "${portal.name}"?`)) {
        await deleteMutation.mutateAsync(portal.id);
      }
    },
    [deleteMutation]
  );

  // Handle test connection
  const handleTestConnection = useCallback(
    async (portal: VmiPortalConfigSummary) => {
      setTestingPortalId(portal.id);
      await testMutation.mutateAsync(portal.id);
    },
    [testMutation]
  );

  // Define columns
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'name',
      caption: 'Portal Name',
      width: 200,
    },
    {
      dataField: 'vendorId',
      caption: 'Vendor ID',
      width: 120,
    },
    {
      dataField: 'portalUrl',
      caption: 'Portal URL',
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => (
        <a
          href={cellInfo.value as string}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          {cellInfo.value as string}
        </a>
      ),
    },
    {
      dataField: 'connectionStatus',
      caption: 'Status',
      width: 120,
      alignment: 'center',
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const status = cellInfo.value as string;
        const rowData = cellInfo.data as VmiPortalConfigSummary;

        const statusConfig = {
          connected: { icon: Wifi, color: 'text-green-500', bg: 'bg-green-50' },
          disconnected: { icon: WifiOff, color: 'text-gray-400', bg: 'bg-gray-50' },
          error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
        };

        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.disconnected;
        const Icon = config.icon;

        return (
          <div
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
              config.bg,
              config.color
            )}
            title={rowData.lastErrorMessage || ''}
          >
            <Icon className="h-3 w-3" />
            {status}
          </div>
        );
      },
    },
    {
      dataField: 'isEnabled',
      caption: 'Enabled',
      width: 80,
      alignment: 'center',
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
            cellInfo.value ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
          )}
        >
          {cellInfo.value ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      dataField: 'lastOrdersPollAt',
      caption: 'Last Poll',
      width: 160,
      dataType: 'datetime',
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        if (!cellInfo.value) return <span className="text-gray-400">Never</span>;
        return new Date(cellInfo.value as string).toLocaleString();
      },
    },
    {
      dataField: 'id',
      caption: 'Actions',
      width: 180,
      allowSorting: false,
      allowFiltering: false,
      alignment: 'center',
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const rowData = cellInfo.data as VmiPortalConfigSummary;
        const isTesting = testingPortalId === rowData.id;
        const isDeleting = deleteMutation.isPending;

        return (
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => handleTestConnection(rowData)}
              disabled={isTesting || isDeleting}
              className={cn(
                'p-1.5 rounded hover:bg-gray-100 transition-colors',
                'text-gray-500 hover:text-blue-600',
                isTesting && 'animate-pulse'
              )}
              title="Test Connection"
            >
              <PlayCircle className="h-4 w-4" />
            </button>
            <Link
              href={`/settings/vmi/${rowData.id}`}
              className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-blue-600"
              title="Edit"
            >
              <Edit2 className="h-4 w-4" />
            </Link>
            <button
              onClick={() => handleDelete(rowData)}
              disabled={isDeleting}
              className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-red-600"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <Card elevation="raised">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>VMI Portal Connections</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Configure connections to external VMI portals where this system acts as the vendor/supplier.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="flex items-center gap-3 p-4 mb-4 rounded-lg bg-red-50 text-red-800 border border-red-200">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              {error instanceof Error ? error.message : 'Failed to load portals'}
            </div>
          )}

          <DxDataGrid
            dataSource={portals}
            columns={columns}
            keyExpr="id"
            loading={isLoading}
            height={400}
            paging
            pageSize={10}
            sorting
            filterRow
            searchPanel
            toolbarItems={
              <>
                <Item location="before">
                  <Link href="/settings/vmi/new">
                    <DxButton
                      text="Add Portal"
                      icon="plus"
                      type="success"
                    />
                  </Link>
                </Item>
                <Item location="after">
                  <DxButton
                    icon="refresh"
                    type="normal"
                    onClick={() => refetch()}
                    hint="Refresh list"
                  />
                </Item>
              </>
            }
          />

          {/* Summary Cards */}
          {portals.length > 0 && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                <div className="text-2xl font-bold text-blue-700">{portals.length}</div>
                <div className="text-sm text-blue-600">Total Portals</div>
              </div>
              <div className="p-4 rounded-lg bg-green-50 border border-green-100">
                <div className="text-2xl font-bold text-green-700">
                  {portals.filter((p) => p.connectionStatus === 'connected').length}
                </div>
                <div className="text-sm text-green-600">Connected</div>
              </div>
              <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-100">
                <div className="text-2xl font-bold text-yellow-700">
                  {portals.filter((p) => p.connectionStatus === 'disconnected').length}
                </div>
                <div className="text-sm text-yellow-600">Disconnected</div>
              </div>
              <div className="p-4 rounded-lg bg-red-50 border border-red-100">
                <div className="text-2xl font-bold text-red-700">
                  {portals.filter((p) => p.connectionStatus === 'error').length}
                </div>
                <div className="text-sm text-red-600">Errors</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default VmiPortalList;
