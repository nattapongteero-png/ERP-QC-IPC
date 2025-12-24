'use client';

/**
 * VMI Sync Page - Redesigned
 *
 * Professional page for managing VMI synchronization to external portals.
 * Features improved DevExtreme DataGrid with search, filters, and better UX.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/main-layout';
import DataGrid, {
  Column,
  Paging,
  Pager,
  Sorting,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Toolbar,
  Item,
  Export,
  LoadPanel,
  Summary,
  TotalItem,
  MasterDetail,
} from 'devextreme-react/data-grid';
import { exportDataGrid } from 'devextreme/excel_exporter';
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';
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
  Activity,
  Database,
  Zap,
  HelpCircle,
  Info,
  Play,
  ExternalLink,
  Calendar,
  Timer,
  ChevronRight,
  TrendingUp,
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
  errorMessage?: string | null;
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
    iconBg: string;
    description: string;
  }
> = {
  inventory: {
    icon: Package,
    label: 'Inventory',
    labelTh: 'สินค้าคงคลัง',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconBg: 'bg-blue-100',
    description: 'ส่งระดับสต็อกปัจจุบันไปยัง VMI Portal',
  },
  items: {
    icon: Tag,
    label: 'Items',
    labelTh: 'รายการสินค้า',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    iconBg: 'bg-purple-100',
    description: 'อัปเดตแคตตาล็อกสินค้าพร้อมรหัส TPP/TTMT',
  },
  prices: {
    icon: DollarSign,
    label: 'Prices',
    labelTh: 'ราคา',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    description: 'ส่งข้อมูลราคาปัจจุบัน',
  },
  orders: {
    icon: Database,
    label: 'Orders',
    labelTh: 'คำสั่งซื้อ',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    iconBg: 'bg-orange-100',
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
    textColor: string;
    borderColor: string;
  }
> = {
  running: {
    icon: Loader2,
    label: 'Running',
    labelTh: 'กำลังทำงาน',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
  },
  completed: {
    icon: CheckCircle,
    label: 'Completed',
    labelTh: 'สำเร็จ',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
  },
  partial: {
    icon: AlertTriangle,
    label: 'Partial',
    labelTh: 'บางส่วน',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    labelTh: 'ล้มเหลว',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
  },
};

const TRIGGER_CONFIG: Record<string, { label: string; labelTh: string; icon: typeof Play }> = {
  manual: { label: 'Manual', labelTh: 'Manual', icon: Play },
  scheduled: { label: 'Scheduled', labelTh: 'Scheduled', icon: Clock },
  threshold: { label: 'Threshold', labelTh: 'Threshold', icon: Zap },
  auto: { label: 'Auto', labelTh: 'Auto', icon: RefreshCw },
};

// ============================================
// API Functions
// ============================================

async function fetchSyncHistory(): Promise<{
  items: SyncHistoryItem[];
  total: number;
}> {
  const response = await fetch('/api/vmi-sync/status?limit=100');
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

function formatDuration(startedAt: string, completedAt?: string | null): string {
  if (!completedAt) return '-';
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const durationMs = end - start;

  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
  return `${(durationMs / 60000).toFixed(1)}m`;
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

  // Sync mutations - defined separately to comply with React hooks rules
  const inventoryMutation = useMutation({
    mutationFn: () => triggerSync('inventory'),
    onSuccess: (results) => {
      setLastResults((prev) => ({ ...prev, inventory: results }));
      queryClient.invalidateQueries({ queryKey: ['vmi-sync-history'] });
    },
  });

  const itemsMutation = useMutation({
    mutationFn: () => triggerSync('items'),
    onSuccess: (results) => {
      setLastResults((prev) => ({ ...prev, items: results }));
      queryClient.invalidateQueries({ queryKey: ['vmi-sync-history'] });
    },
  });

  const pricesMutation = useMutation({
    mutationFn: () => triggerSync('prices'),
    onSuccess: (results) => {
      setLastResults((prev) => ({ ...prev, prices: results }));
      queryClient.invalidateQueries({ queryKey: ['vmi-sync-history'] });
    },
  });

  const isAnySyncing =
    inventoryMutation.isPending || itemsMutation.isPending || pricesMutation.isPending;

  // Get last sync for each type - using useMemo to avoid recalculation
  const getLastSync = useCallback((syncType: VmiSyncType): SyncHistoryItem | null => {
    if (!historyData?.items) return null;
    const matching = historyData.items.filter((item) => item.syncType === syncType);
    return matching.length > 0 ? matching[matching.length - 1] : null;
  }, [historyData]);

  // Calculate stats with useMemo
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      totalSyncs: historyData?.total || 0,
      successfulToday: historyData?.items?.filter(
        (item) =>
          item.status === 'completed' &&
          new Date(item.startedAt).toDateString() === today
      ).length || 0,
      failedToday: historyData?.items?.filter(
        (item) =>
          item.status === 'failed' &&
          new Date(item.startedAt).toDateString() === today
      ).length || 0,
      partialToday: historyData?.items?.filter(
        (item) =>
          item.status === 'partial' &&
          new Date(item.startedAt).toDateString() === today
      ).length || 0,
      isRunning: historyData?.items?.some((item) => item.status === 'running') || false,
    };
  }, [historyData]);

  // Handle Excel export
  const handleExporting = useCallback((e: DataGridTypes.ExportingEvent) => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('VMI Sync History');

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `vmi-sync-history-${new Date().toISOString().split('T')[0]}.xlsx`
        );
      });
    });
  }, []);

  // Cell render functions
  const renderSyncTypeCell = useCallback((cellInfo: DataGridTypes.ColumnCellTemplateData) => {
    const type = cellInfo.value as VmiSyncType;
    const config = SYNC_TYPE_CONFIG[type];
    if (!config) return <span>{type}</span>;

    const Icon = config.icon;
    return (
      <div className="flex items-center gap-2.5 py-1">
        <div className={cn('p-1.5 rounded-lg', config.iconBg)}>
          <Icon className={cn('h-4 w-4', config.color)} />
        </div>
        <div>
          <div className="font-medium text-gray-900">{config.labelTh}</div>
          <div className="text-xs text-gray-500">{config.label}</div>
        </div>
      </div>
    );
  }, []);

  const renderStatusCell = useCallback((cellInfo: DataGridTypes.ColumnCellTemplateData) => {
    const status = cellInfo.value as VmiSyncStatus;
    const config = STATUS_CONFIG[status];
    if (!config) return <span>{status}</span>;

    const Icon = config.icon;
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border',
          config.bgColor,
          config.textColor,
          config.borderColor
        )}
      >
        <Icon className={cn('h-3.5 w-3.5', status === 'running' && 'animate-spin')} />
        {config.labelTh}
      </div>
    );
  }, []);

  const renderTriggerCell = useCallback((cellInfo: DataGridTypes.ColumnCellTemplateData) => {
    const trigger = TRIGGER_CONFIG[cellInfo.value as string] || TRIGGER_CONFIG.manual;
    const Icon = trigger.icon;
    return (
      <div className="flex items-center gap-1.5 text-gray-600">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-sm">{trigger.labelTh}</span>
      </div>
    );
  }, []);

  const renderProgressCell = useCallback((cellInfo: DataGridTypes.ColumnCellTemplateData) => {
    const rowData = cellInfo.data as SyncHistoryItem;
    const percentage = rowData.itemsTotal > 0
      ? Math.round((rowData.itemsProcessed / rowData.itemsTotal) * 100)
      : 0;

    const hasFailures = rowData.itemsFailed > 0;
    const barColor = hasFailures ? 'bg-amber-500' : rowData.status === 'failed' ? 'bg-red-500' : 'bg-emerald-500';

    return (
      <div className="py-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-900">
            {rowData.itemsProcessed.toLocaleString()}/{rowData.itemsTotal.toLocaleString()}
          </span>
          <span className={cn(
            'text-xs font-semibold',
            percentage === 100 && !hasFailures ? 'text-emerald-600' :
            hasFailures ? 'text-amber-600' : 'text-gray-600'
          )}>
            {percentage}%
          </span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-300', barColor)}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {hasFailures && (
          <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
            <XCircle className="h-3 w-3" />
            <span>{rowData.itemsFailed} ล้มเหลว</span>
          </div>
        )}
      </div>
    );
  }, []);

  const renderDateTimeCell = useCallback((cellInfo: DataGridTypes.ColumnCellTemplateData) => {
    if (!cellInfo.value) return <span className="text-gray-400">-</span>;

    const dateStr = cellInfo.value as string;
    return (
      <div className="py-1">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
          <Calendar className="h-3.5 w-3.5 text-gray-400" />
          {formatDateTime(dateStr)}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5 ml-5">
          <Timer className="h-3 w-3" />
          {formatTimeAgo(dateStr)}
        </div>
      </div>
    );
  }, []);

  const renderDurationCell = useCallback((cellInfo: DataGridTypes.ColumnCellTemplateData) => {
    const rowData = cellInfo.data as SyncHistoryItem;
    const duration = formatDuration(rowData.startedAt, rowData.completedAt);

    if (duration === '-') {
      return <span className="text-gray-400">-</span>;
    }

    return (
      <div className="flex items-center gap-1.5 text-sm text-gray-600">
        <Timer className="h-3.5 w-3.5" />
        {duration}
      </div>
    );
  }, []);

  const renderPortalCell = useCallback((cellInfo: DataGridTypes.ColumnCellTemplateData) => {
    if (!cellInfo.value) return <span className="text-gray-400">-</span>;
    return (
      <div className="flex items-center gap-1.5">
        <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-sm font-medium text-gray-700">{cellInfo.value}</span>
      </div>
    );
  }, []);

  // Master detail render
  const renderMasterDetail = useCallback((e: DataGridTypes.MasterDetailTemplateData) => {
    const rowData = e.data as SyncHistoryItem;
    return (
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              ข้อมูลการซิงค์
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Sync ID:</span>
                <span className="font-mono text-gray-900">#{rowData.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Portal ID:</span>
                <span className="font-mono text-gray-900">#{rowData.portalId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ระยะเวลา:</span>
                <span className="text-gray-900">{formatDuration(rowData.startedAt, rowData.completedAt)}</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              ผลลัพธ์
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">ประมวลผลแล้ว:</span>
                <span className="text-emerald-600 font-medium">{rowData.itemsProcessed.toLocaleString()} รายการ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ล้มเหลว:</span>
                <span className={cn(
                  'font-medium',
                  rowData.itemsFailed > 0 ? 'text-red-600' : 'text-gray-400'
                )}>
                  {rowData.itemsFailed > 0 ? `${rowData.itemsFailed.toLocaleString()} รายการ` : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ทั้งหมด:</span>
                <span className="text-gray-900 font-medium">{rowData.itemsTotal.toLocaleString()} รายการ</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              ผู้ดำเนินการ
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Trigger:</span>
                <span className="text-gray-900">{TRIGGER_CONFIG[rowData.triggerType]?.labelTh || rowData.triggerType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">โดย:</span>
                <span className="text-gray-900">{rowData.triggeredByName || 'System'}</span>
              </div>
            </div>
          </div>
        </div>
        {rowData.errorMessage && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="text-xs font-semibold text-red-800 uppercase tracking-wide mb-1">
              Error Message
            </h4>
            <p className="text-sm text-red-700 font-mono">{rowData.errorMessage}</p>
          </div>
        )}
      </div>
    );
  }, []);

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
      <div className={cn(
        'relative overflow-hidden rounded-xl border-2 bg-white shadow-sm transition-all duration-200 hover:shadow-md',
        config.borderColor
      )}>
        {/* Gradient accent */}
        <div className={cn('absolute top-0 left-0 right-0 h-1', config.bgColor.replace('bg-', 'bg-gradient-to-r from-').replace('-50', '-400'), 'to-transparent')} />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-3 rounded-xl', config.iconBg)}>
                <Icon className={cn('h-6 w-6', config.color)} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{config.labelTh}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{config.description}</p>
              </div>
            </div>
          </div>

          {/* Last sync info */}
          {lastSync && (
            <div className={cn('p-3 rounded-lg mb-4', config.bgColor)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
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
                        <span className={cn('text-sm font-medium', statusConfig.color)}>
                          {statusConfig.labelTh}
                        </span>
                      </>
                    );
                  })()}
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">
                    {lastSync.itemsProcessed}/{lastSync.itemsTotal}
                  </div>
                  <div className="text-xs text-gray-500">{formatTimeAgo(lastSync.startedAt)}</div>
                </div>
              </div>
            </div>
          )}

          {!lastSync && (
            <div className="p-3 rounded-lg bg-gray-50 mb-4 text-center">
              <span className="text-sm text-gray-500">ยังไม่มีประวัติการซิงค์</span>
            </div>
          )}

          {/* Result message */}
          {result && (
            <div
              className={cn(
                'flex items-center gap-2 text-sm mb-4 px-3 py-2 rounded-lg border',
                result.type === 'error' && 'bg-red-50 text-red-700 border-red-200',
                result.type === 'warning' && 'bg-amber-50 text-amber-700 border-amber-200',
                result.type === 'success' && 'bg-emerald-50 text-emerald-700 border-emerald-200'
              )}
            >
              {result.type === 'error' && <XCircle className="h-4 w-4 flex-shrink-0" />}
              {result.type === 'warning' && <AlertTriangle className="h-4 w-4 flex-shrink-0" />}
              {result.type === 'success' && <CheckCircle className="h-4 w-4 flex-shrink-0" />}
              <span className="truncate">{result.text}</span>
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
            className="!h-10"
          >
            {isRunning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          </DxButton>
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 p-6 text-white shadow-xl">
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute right-1/3 top-1/2 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
          </div>

          <div className="relative">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-indigo-200 mb-4">
              <Link href="/vmi" className="hover:text-white transition-colors">
                VMI Portal
              </Link>
              <ChevronRight className="h-4 w-4" />
              <span className="text-white font-medium">Synchronization</span>
            </nav>

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <h1 className="text-3xl font-bold mb-2">VMI Synchronization</h1>
                <p className="text-indigo-200 text-lg">
                  จัดการการซิงค์ข้อมูลไปยัง VMI Portal
                </p>
              </div>

              {/* Quick Stats */}
              <div className="flex flex-wrap items-center gap-4 lg:gap-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 min-w-[90px]">
                  <div className="text-3xl font-bold">{stats.totalSyncs}</div>
                  <div className="text-xs text-indigo-200 mt-0.5">ทั้งหมด</div>
                </div>
                <div className="bg-emerald-500/20 backdrop-blur-sm rounded-xl px-4 py-3 min-w-[90px] border border-emerald-400/30">
                  <div className="text-3xl font-bold text-emerald-300">{stats.successfulToday}</div>
                  <div className="text-xs text-emerald-200 mt-0.5">สำเร็จวันนี้</div>
                </div>
                <div className="bg-red-500/20 backdrop-blur-sm rounded-xl px-4 py-3 min-w-[90px] border border-red-400/30">
                  <div className="text-3xl font-bold text-red-300">{stats.failedToday}</div>
                  <div className="text-xs text-red-200 mt-0.5">ล้มเหลววันนี้</div>
                </div>
                {stats.isRunning && (
                  <div className="bg-yellow-500/20 backdrop-blur-sm rounded-xl px-4 py-3 border border-yellow-400/30 flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-yellow-300" />
                    <span className="text-sm text-yellow-200">กำลังทำงาน</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {renderSyncCard('inventory', inventoryMutation)}
          {renderSyncCard('items', itemsMutation)}
          {renderSyncCard('prices', pricesMutation)}
        </div>

        {/* Sync All Action */}
        <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 rounded-xl border border-indigo-200 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">ซิงค์ทั้งหมด</h3>
                <p className="text-sm text-gray-600">
                  ซิงค์ข้อมูลทุกประเภทตามลำดับ: Inventory → Items → Prices
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
              className="!px-6"
            >
              {isAnySyncing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            </DxButton>
          </div>
        </div>

        {/* Help Alert */}
        {(lastResults.inventory?.[0]?.itemsTotal === 0 ||
          lastResults.items?.[0]?.itemsTotal === 0 ||
          lastResults.prices?.[0]?.itemsTotal === 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-amber-100">
                <HelpCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-amber-900 mb-2">
                  ไม่พบรายการที่ต้องซิงค์?
                </h4>
                <div className="text-sm text-amber-800 space-y-2">
                  <p>ในการซิงค์รายการไปยัง VMI Portal คุณต้อง:</p>
                  <ol className="list-decimal list-inside space-y-1.5 ml-2">
                    <li>
                      <strong>กำหนดค่า VMI Portal</strong> - ตั้งค่าการเชื่อมต่ออย่างน้อย 1 portal ใน{' '}
                      <Link href="/settings/vmi" className="underline hover:text-amber-900 font-medium">
                        ตั้งค่า → VMI Portals
                      </Link>
                    </li>
                    <li>
                      <strong>เปิดใช้งาน VMI Sync บนสินค้า</strong> - ไปที่{' '}
                      <Link href="/inventory/items" className="underline hover:text-amber-900 font-medium">
                        คลังสินค้า → รายการสินค้า
                      </Link>{' '}
                      และเปิดใช้งาน &quot;VMI Sync Enabled&quot;
                    </li>
                    <li>
                      <strong>เพิ่มรหัสมาตรฐาน VMI</strong> - เพิ่มรหัส TPP/TTMT ในส่วน VMI Standard Codes
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sync History DataGrid */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Card Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-100">
                <Activity className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">ประวัติการซิงค์</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  คลิกที่แถวเพื่อดูรายละเอียดเพิ่มเติม
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DxButton
                icon="refresh"
                type="normal"
                stylingMode="text"
                onClick={() => refetch()}
                hint="รีเฟรช"
              />
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-3 p-4 m-4 rounded-lg bg-red-50 text-red-800 border border-red-200">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <span>{error instanceof Error ? error.message : 'ไม่สามารถโหลดประวัติการซิงค์'}</span>
            </div>
          )}

          {/* DataGrid */}
          <DataGrid
            dataSource={historyData?.items || []}
            keyExpr="id"
            showBorders={false}
            showRowLines={true}
            showColumnLines={false}
            rowAlternationEnabled={true}
            allowColumnReordering={true}
            allowColumnResizing={true}
            columnAutoWidth={true}
            wordWrapEnabled={false}
            height={500}
            noDataText="ไม่มีประวัติการซิงค์"
            onExporting={handleExporting}
            className="dx-card-grid"
          >
            <LoadPanel enabled={isLoading} />
            <SearchPanel visible={true} placeholder="ค้นหา..." width={250} />
            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <Sorting mode="multiple" />
            <Export enabled={true} allowExportSelectedData={false} />

            <MasterDetail enabled={true} component={renderMasterDetail} />

            <Toolbar>
              <Item name="searchPanel" location="before" />
              <Item location="after">
                <DxButton
                  icon="filter"
                  text="ตัวกรอง"
                  type="normal"
                  stylingMode="text"
                  hint="แสดง/ซ่อนตัวกรอง"
                />
              </Item>
              <Item name="exportButton" location="after" />
            </Toolbar>

            <Column
              dataField="syncType"
              caption="ประเภท"
              width={160}
              cellRender={renderSyncTypeCell}
              allowHeaderFiltering={true}
            >
              <HeaderFilter dataSource={[
                { text: 'สินค้าคงคลัง', value: 'inventory' },
                { text: 'รายการสินค้า', value: 'items' },
                { text: 'ราคา', value: 'prices' },
              ]} />
            </Column>

            <Column
              dataField="status"
              caption="สถานะ"
              width={130}
              cellRender={renderStatusCell}
              allowHeaderFiltering={true}
            >
              <HeaderFilter dataSource={[
                { text: 'สำเร็จ', value: 'completed' },
                { text: 'ล้มเหลว', value: 'failed' },
                { text: 'บางส่วน', value: 'partial' },
                { text: 'กำลังทำงาน', value: 'running' },
              ]} />
            </Column>

            <Column
              dataField="triggerType"
              caption="Trigger"
              width={100}
              cellRender={renderTriggerCell}
              allowHeaderFiltering={true}
            >
              <HeaderFilter dataSource={[
                { text: 'Manual', value: 'manual' },
                { text: 'Scheduled', value: 'scheduled' },
                { text: 'Auto', value: 'auto' },
              ]} />
            </Column>

            <Column
              dataField="itemsProcessed"
              caption="ความคืบหน้า"
              width={180}
              cellRender={renderProgressCell}
              allowFiltering={false}
              allowHeaderFiltering={false}
            />

            <Column
              dataField="startedAt"
              caption="เวลาเริ่มต้น"
              dataType="datetime"
              width={180}
              cellRender={renderDateTimeCell}
              sortOrder="desc"
              sortIndex={0}
            />

            <Column
              dataField="completedAt"
              caption="ระยะเวลา"
              width={100}
              cellRender={renderDurationCell}
              allowFiltering={false}
            />

            <Column
              dataField="portalName"
              caption="Portal"
              width={140}
              cellRender={renderPortalCell}
              allowHeaderFiltering={true}
            />

            <Paging defaultPageSize={20} />
            <Pager
              visible={true}
              showPageSizeSelector={true}
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo={true}
              infoText="หน้า {0} จาก {1} ({2} รายการ)"
            />

            <Summary>
              <TotalItem column="itemsProcessed" summaryType="sum" displayFormat="รวม: {0} รายการ" />
            </Summary>
          </DataGrid>
        </div>

        {/* Info Section */}
        <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-indigo-50 rounded-xl border border-indigo-200 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-indigo-100">
              <Info className="h-6 w-6 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-indigo-900 mb-4">
                เกี่ยวกับ VMI Synchronization
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.entries(SYNC_TYPE_CONFIG)
                  .filter(([key]) => key !== 'orders')
                  .map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <div key={key} className="bg-white/60 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className={cn('h-5 w-5', config.color)} />
                          <strong className="text-indigo-900">{config.label} Sync</strong>
                        </div>
                        <p className="text-sm text-indigo-700">
                          {config.description}
                        </p>
                      </div>
                    );
                  })}
              </div>
              <div className="mt-4 pt-4 border-t border-indigo-200 flex items-center gap-2 text-sm text-indigo-700">
                <TrendingUp className="h-4 w-4" />
                <strong>Auto Sync:</strong>{' '}
                ระบบจะซิงค์อัตโนมัติทุก 15 นาที ทั้งแบบ Client-side และ Server-side (Vercel Cron)
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
