'use client';

/**
 * VMI Sync Page
 *
 * Professional page for managing VMI synchronization to external portals.
 * Displays sync status, history, and manual trigger controls.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { useState } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/main-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxDataGrid, type DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  Package,
  Tag,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
  ArrowUpRight,
  Activity,
  Database,
  Zap,
  Settings,
  HelpCircle,
  TrendingUp,
  Info,
  Play,
  ExternalLink,
} from 'lucide-react';
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

interface SyncResult {
  syncId: number;
  portalId: number;
  portalName: string;
  syncType: VmiSyncType;
  status: VmiSyncStatus;
  itemsTotal: number;
  itemsProcessed: number;
  itemsFailed: number;
  duration: number;
  errors?: Array<{ itemId: number; itemCode?: string; error: string }>;
}

// ============================================
// Config
// ============================================

const SYNC_TYPE_CONFIG: Record<
  VmiSyncType,
  {
    icon: typeof Package;
    label: string;
    labelTh: string;
    color: string;
    bgColor: string;
    borderColor: string;
    description: string;
  }
> = {
  inventory: {
    icon: Package,
    label: 'Inventory',
    labelTh: 'สินค้าคงคลัง',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
    description: 'ส่งระดับสต็อกปัจจุบันไปยัง VMI Portal',
  },
  items: {
    icon: Tag,
    label: 'Items',
    labelTh: 'รายการสินค้า',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-500',
    description: 'อัปเดตแคตตาล็อกสินค้าพร้อมรหัส TPP/TTMT',
  },
  prices: {
    icon: DollarSign,
    label: 'Prices',
    labelTh: 'ราคา',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
    description: 'ส่งข้อมูลราคาปัจจุบัน',
  },
  orders: {
    icon: Database,
    label: 'Orders',
    labelTh: 'คำสั่งซื้อ',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-500',
    description: 'ดึงคำสั่งซื้อจาก VMI Portal',
  },
};

const STATUS_CONFIG: Record<
  VmiSyncStatus,
  {
    icon: typeof CheckCircle;
    label: string;
    labelTh: string;
    color: string;
    bgColor: string;
  }
> = {
  running: {
    icon: Loader2,
    label: 'Running',
    labelTh: 'กำลังทำงาน',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  completed: {
    icon: CheckCircle,
    label: 'Completed',
    labelTh: 'สำเร็จ',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  partial: {
    icon: AlertTriangle,
    label: 'Partial',
    labelTh: 'บางส่วน',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    labelTh: 'ล้มเหลว',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
};

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

async function triggerSync(syncType: VmiSyncType): Promise<SyncResult[]> {
  const response = await fetch(`/api/vmi-sync/${syncType}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Sync failed');
  }

  if (result.data.results) {
    return result.data.results;
  }
  return [result.data];
}

// ============================================
// Helper Functions
// ============================================

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'เมื่อสักครู่';
  if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
  return `${diffDays} วันที่แล้ว`;
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================
// Component
// ============================================

export default function VmiSyncPage() {
  const queryClient = useQueryClient();
  const [lastResults, setLastResults] = useState<Record<VmiSyncType, SyncResult[] | null>>({
    inventory: null,
    items: null,
    prices: null,
    orders: null,
  });

  // Fetch sync history
  const {
    data: historyData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['vmi-sync-history'],
    queryFn: fetchSyncHistory,
    refetchInterval: 30000,
  });

  // Sync mutations
  const createSyncMutation = (syncType: VmiSyncType) =>
    useMutation({
      mutationFn: () => triggerSync(syncType),
      onSuccess: (results) => {
        setLastResults((prev) => ({ ...prev, [syncType]: results }));
        queryClient.invalidateQueries({ queryKey: ['vmi-sync-history'] });
      },
    });

  const inventoryMutation = createSyncMutation('inventory');
  const itemsMutation = createSyncMutation('items');
  const pricesMutation = createSyncMutation('prices');

  const isAnySyncing =
    inventoryMutation.isPending || itemsMutation.isPending || pricesMutation.isPending;

  // Get last (most recent) sync for each type
  const getLastSync = (syncType: VmiSyncType): SyncHistoryItem | null => {
    if (!historyData?.items) return null;
    // Data is ordered by startedAt ascending (oldest first), so we need to find the last matching item
    const matching = historyData.items.filter((item) => item.syncType === syncType);
    return matching.length > 0 ? matching[matching.length - 1] : null;
  };

  // Calculate stats
  const stats = {
    totalSyncs: historyData?.total || 0,
    successfulToday: historyData?.items?.filter(
      (item) =>
        item.status === 'completed' &&
        new Date(item.startedAt).toDateString() === new Date().toDateString()
    ).length || 0,
    failedToday: historyData?.items?.filter(
      (item) =>
        item.status === 'failed' &&
        new Date(item.startedAt).toDateString() === new Date().toDateString()
    ).length || 0,
    isRunning: historyData?.items?.some((item) => item.status === 'running') || false,
  };

  // Define columns for history grid
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'syncType',
      caption: 'ประเภท',
      width: 130,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const type = cellInfo.value as VmiSyncType;
        const config = SYNC_TYPE_CONFIG[type];
        const Icon = config?.icon || Package;
        return (
          <div className="flex items-center gap-2">
            <div className={cn('p-1.5 rounded', config?.bgColor)}>
              <Icon className={cn('h-4 w-4', config?.color)} />
            </div>
            <span className="font-medium">{config?.labelTh || type}</span>
          </div>
        );
      },
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 120,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const status = cellInfo.value as VmiSyncStatus;
        const config = STATUS_CONFIG[status];
        const Icon = config?.icon || Clock;
        return (
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
              config?.bgColor,
              config?.color
            )}
          >
            <Icon className={cn('h-3.5 w-3.5', status === 'running' && 'animate-spin')} />
            {config?.labelTh || status}
          </div>
        );
      },
    },
    {
      dataField: 'triggerType',
      caption: 'ทริกเกอร์',
      width: 100,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const triggerLabels: Record<string, { label: string; icon: typeof Play }> = {
          manual: { label: 'Manual', icon: Play },
          scheduled: { label: 'Scheduled', icon: Clock },
          threshold: { label: 'Threshold', icon: Zap },
        };
        const trigger = triggerLabels[cellInfo.value as string];
        const Icon = trigger?.icon || Play;
        return (
          <div className="flex items-center gap-1.5 text-gray-600">
            <Icon className="h-3.5 w-3.5" />
            <span className="text-sm">{trigger?.label || cellInfo.value}</span>
          </div>
        );
      },
    },
    {
      dataField: 'itemsProcessed',
      caption: 'ความคืบหน้า',
      width: 150,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const rowData = cellInfo.data as SyncHistoryItem;
        const percentage =
          rowData.itemsTotal > 0
            ? Math.round((rowData.itemsProcessed / rowData.itemsTotal) * 100)
            : 0;
        return (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">
                {rowData.itemsProcessed}/{rowData.itemsTotal}
              </span>
              <span className="font-medium">{percentage}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  rowData.itemsFailed > 0 ? 'bg-amber-500' : 'bg-green-500'
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      dataField: 'itemsFailed',
      caption: 'ล้มเหลว',
      width: 80,
      alignment: 'center',
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const value = cellInfo.value as number;
        if (value === 0) return <span className="text-gray-400">-</span>;
        return (
          <span className="inline-flex items-center gap-1 text-red-600 font-medium">
            <XCircle className="h-3.5 w-3.5" />
            {value}
          </span>
        );
      },
    },
    {
      dataField: 'startedAt',
      caption: 'เริ่มต้น',
      dataType: 'datetime',
      width: 160,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        if (!cellInfo.value) return '-';
        return (
          <div className="text-sm">
            <div className="font-medium">{formatDateTime(cellInfo.value as string)}</div>
            <div className="text-xs text-gray-500">{formatTimeAgo(cellInfo.value as string)}</div>
          </div>
        );
      },
    },
    {
      dataField: 'portalName',
      caption: 'Portal',
      width: 140,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        if (!cellInfo.value) return <span className="text-gray-400">-</span>;
        return (
          <div className="flex items-center gap-1.5 text-gray-700">
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="text-sm">{cellInfo.value}</span>
          </div>
        );
      },
    },
  ];

  // Render sync control card
  const renderSyncCard = (
    syncType: VmiSyncType,
    mutation: typeof inventoryMutation
  ) => {
    const config = SYNC_TYPE_CONFIG[syncType];
    const Icon = config.icon;
    const lastSync = getLastSync(syncType);
    const lastResult = lastResults[syncType];
    const isRunning = mutation.isPending;
    const hasError = mutation.isError;

    const getResultMessage = () => {
      if (hasError) {
        return {
          text: (mutation.error as Error).message,
          type: 'error' as const,
        };
      }
      if (lastResult && lastResult.length > 0) {
        const total = lastResult.reduce((sum, r) => sum + r.itemsTotal, 0);
        const processed = lastResult.reduce((sum, r) => sum + r.itemsProcessed, 0);
        const failed = lastResult.reduce((sum, r) => sum + r.itemsFailed, 0);

        if (total === 0) {
          return { text: 'ไม่พบรายการที่ต้องซิงค์', type: 'warning' as const };
        }
        return {
          text: `ซิงค์สำเร็จ ${processed} รายการ${failed > 0 ? `, ล้มเหลว ${failed}` : ''}`,
          type: failed > 0 ? ('warning' as const) : ('success' as const),
        };
      }
      return null;
    };

    const result = getResultMessage();

    return (
      <Card elevation="raised" className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-stretch">
            {/* Colored accent bar */}
            <div className={cn('w-1.5', config.borderColor.replace('border-', 'bg-'))} />

            <div className="flex-1 p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2.5 rounded-xl', config.bgColor)}>
                    <Icon className={cn('h-5 w-5', config.color)} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{config.labelTh}</h3>
                    <p className="text-xs text-gray-500">{config.description}</p>
                  </div>
                </div>
              </div>

              {/* Last sync info */}
              {lastSync && (
                <div className="flex items-center gap-4 mb-3 text-sm">
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const statusConfig = STATUS_CONFIG[lastSync.status];
                      const StatusIcon = statusConfig.icon;
                      return (
                        <>
                          <StatusIcon
                            className={cn(
                              'h-4 w-4',
                              statusConfig.color,
                              lastSync.status === 'running' && 'animate-spin'
                            )}
                          />
                          <span className={statusConfig.color}>{statusConfig.labelTh}</span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatTimeAgo(lastSync.startedAt)}</span>
                  </div>
                  <div className="text-gray-500">
                    {lastSync.itemsProcessed}/{lastSync.itemsTotal} รายการ
                  </div>
                </div>
              )}

              {!lastSync && (
                <div className="text-sm text-gray-500 mb-3">ยังไม่มีประวัติการซิงค์</div>
              )}

              {/* Result message */}
              {result && (
                <div
                  className={cn(
                    'flex items-center gap-2 text-sm mb-3 px-3 py-2 rounded-lg',
                    result.type === 'error' && 'bg-red-50 text-red-700',
                    result.type === 'warning' && 'bg-amber-50 text-amber-700',
                    result.type === 'success' && 'bg-green-50 text-green-700'
                  )}
                >
                  {result.type === 'error' && <XCircle className="h-4 w-4" />}
                  {result.type === 'warning' && <AlertTriangle className="h-4 w-4" />}
                  {result.type === 'success' && <CheckCircle className="h-4 w-4" />}
                  {result.text}
                </div>
              )}

              {/* Sync button */}
              <DxButton
                text={isRunning ? 'กำลังซิงค์...' : `ซิงค์${config.labelTh}`}
                icon={isRunning ? undefined : 'refresh'}
                type="default"
                stylingMode="contained"
                onClick={() => mutation.mutate()}
                disabled={isAnySyncing}
                width="100%"
              >
                {isRunning && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              </DxButton>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
            <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10" />
            <div className="absolute right-1/4 top-1/2 h-24 w-24 rounded-full bg-white/5" />
          </div>

          <div className="relative">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-indigo-100 mb-4">
              <Link href="/vmi" className="hover:text-white transition-colors">
                VMI
              </Link>
              <span>/</span>
              <span className="text-white">Synchronization</span>
            </nav>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold mb-1">VMI Synchronization</h1>
                <p className="text-indigo-100">
                  จัดการการซิงค์ข้อมูลไปยัง VMI Portal
                </p>
              </div>

              {/* Quick Stats */}
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.totalSyncs}</div>
                  <div className="text-xs text-indigo-200">ทั้งหมด</div>
                </div>
                <div className="w-px h-10 bg-white/20" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-300">{stats.successfulToday}</div>
                  <div className="text-xs text-indigo-200">สำเร็จวันนี้</div>
                </div>
                <div className="w-px h-10 bg-white/20" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-300">{stats.failedToday}</div>
                  <div className="text-xs text-indigo-200">ล้มเหลววันนี้</div>
                </div>
                {stats.isRunning && (
                  <>
                    <div className="w-px h-10 bg-white/20" />
                    <div className="flex items-center gap-2 text-yellow-300">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm">กำลังทำงาน</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-4">
              <DxButton
                icon="refresh"
                text="รีเฟรช"
                type="normal"
                stylingMode="text"
                onClick={() => refetch()}
                className="!text-white hover:!bg-white/10"
              />
              <Link href="/settings/vmi">
                <DxButton
                  icon="preferences"
                  text="ตั้งค่า Portal"
                  type="normal"
                  stylingMode="text"
                  className="!text-white hover:!bg-white/10"
                />
              </Link>
            </div>
          </div>
        </div>

        {/* Sync Control Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {renderSyncCard('inventory', inventoryMutation)}
          {renderSyncCard('items', itemsMutation)}
          {renderSyncCard('prices', pricesMutation)}
        </div>

        {/* Sync All Action */}
        <Card elevation="raised">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">ซิงค์ทั้งหมด</h3>
                  <p className="text-sm text-gray-500">
                    ซิงค์ข้อมูลทุกประเภทพร้อมกัน (Inventory → Items → Prices)
                  </p>
                </div>
              </div>
              <DxButton
                text={isAnySyncing ? 'กำลังซิงค์...' : 'ซิงค์ทั้งหมด'}
                icon={isAnySyncing ? undefined : 'refresh'}
                type="success"
                stylingMode="contained"
                onClick={async () => {
                  await inventoryMutation.mutateAsync();
                  await itemsMutation.mutateAsync();
                  await pricesMutation.mutateAsync();
                }}
                disabled={isAnySyncing}
              >
                {isAnySyncing && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              </DxButton>
            </div>
          </CardContent>
        </Card>

        {/* Help Alert - Show when sync returns 0 items */}
        {(lastResults.inventory?.[0]?.itemsTotal === 0 ||
          lastResults.items?.[0]?.itemsTotal === 0 ||
          lastResults.prices?.[0]?.itemsTotal === 0) && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <HelpCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-amber-900 mb-2">
                    ไม่พบรายการที่ต้องซิงค์?
                  </h4>
                  <div className="text-sm text-amber-800 space-y-2">
                    <p>ในการซิงค์รายการไปยัง VMI Portal คุณต้อง:</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>
                        <strong>กำหนดค่า VMI Portal</strong> - ตั้งค่าการเชื่อมต่ออย่างน้อย 1 portal ใน{' '}
                        <Link href="/settings/vmi" className="underline hover:text-amber-900">
                          ตั้งค่า → VMI Portals
                        </Link>
                      </li>
                      <li>
                        <strong>เปิดใช้งาน VMI Sync บนสินค้า</strong> - ไปที่{' '}
                        <Link href="/inventory/items" className="underline hover:text-amber-900">
                          คลังสินค้า → รายการสินค้า
                        </Link>{' '}
                        และเปิดใช้งาน &quot;VMI Sync Enabled&quot;
                      </li>
                      <li>
                        <strong>เพิ่มรหัสมาตรฐาน VMI</strong> - เพิ่มรหัส TPP/TTMT ในส่วน VMI Standard
                        Codes
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sync History */}
        <Card elevation="raised">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100">
                  <Activity className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <CardTitle>ประวัติการซิงค์</CardTitle>
                  <p className="text-sm text-gray-500 mt-0.5">
                    แสดงประวัติการซิงค์ล่าสุด 50 รายการ
                  </p>
                </div>
              </div>
              <DxButton
                icon="refresh"
                type="normal"
                stylingMode="text"
                onClick={() => refetch()}
                hint="รีเฟรช"
              />
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-center gap-3 p-4 mb-4 rounded-lg bg-red-50 text-red-800 border border-red-200">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                {error instanceof Error ? error.message : 'ไม่สามารถโหลดประวัติการซิงค์'}
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
              noDataText="ไม่มีประวัติการซิงค์"
            />
          </CardContent>
        </Card>

        {/* Info Section */}
        <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-indigo-100">
                <Info className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-indigo-900 mb-3">
                  เกี่ยวกับ VMI Synchronization
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-4 w-4 text-blue-600" />
                      <strong className="text-indigo-800">Inventory Sync</strong>
                    </div>
                    <p className="text-sm text-indigo-700">
                      ส่งระดับสต็อกปัจจุบันไปยัง VMI Portal เพื่อให้ลูกค้าเห็นสินค้าคงคลังของคุณ
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="h-4 w-4 text-purple-600" />
                      <strong className="text-indigo-800">Items Sync</strong>
                    </div>
                    <p className="text-sm text-indigo-700">
                      อัปเดตแคตตาล็อกสินค้าบน VMI Portal รวมถึงรหัส TPP/TTMT
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <strong className="text-indigo-800">Prices Sync</strong>
                    </div>
                    <p className="text-sm text-indigo-700">
                      ส่งข้อมูลราคาปัจจุบันไปยัง VMI Portal สำหรับการคำนวณคำสั่งซื้อ
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-indigo-200">
                  <div className="flex items-center gap-2 text-sm text-indigo-700">
                    <Zap className="h-4 w-4" />
                    <strong>Sync Triggers:</strong>{' '}
                    ใช้ Manual sync สำหรับอัปเดตทันที หรือกำหนดตารางเวลาใน Portal Settings
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
