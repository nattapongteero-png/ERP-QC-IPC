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
import { useTranslations, useLocale } from 'next-intl';
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
import { MobileListView } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
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
import { toLocalDateStr } from '@/lib/utils/date-format';
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
    color: string;
    bgColor: string;
    borderColor: string;
    iconBg: string;
  }
> = {
  inventory: {
    icon: Package,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconBg: 'bg-blue-100',
  },
  items: {
    icon: Tag,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    iconBg: 'bg-purple-100',
  },
  prices: {
    icon: DollarSign,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
  },
  orders: {
    icon: Database,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    iconBg: 'bg-orange-100',
  },
};

const STATUS_CONFIG: Record<
  VmiSyncStatus,
  {
    icon: typeof CheckCircle;
    color: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
  }
> = {
  running: {
    icon: Loader2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
  },
  completed: {
    icon: CheckCircle,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
  },
  partial: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
  },
};

const TRIGGER_CONFIG: Record<string, { icon: typeof Play }> = {
  manual: { icon: Play },
  scheduled: { icon: Clock },
  threshold: { icon: Zap },
  auto: { icon: RefreshCw },
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

function formatDateTime(dateString: string, locale: string): string {
  return new Date(dateString).toLocaleString(locale === 'th' ? 'th-TH' : 'en-US', {
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
  const t = useTranslations('vmi');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { isMobile } = useMobile();
  const [lastResults, setLastResults] = useState<Record<VmiSyncType, SyncResult[] | null>>({
    inventory: null,
    items: null,
    prices: null,
    orders: null,
  });

  const formatTimeAgo = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t('sync.time.justNow');
    if (diffMins < 60) return t('sync.time.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('sync.time.hoursAgo', { count: diffHours });
    return t('sync.time.daysAgo', { count: diffDays });
  }, [t]);

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

  // History items with row numbers for DataGrid
  const historyItemsWithRowNum = useMemo(() => {
    return (historyData?.items || []).map((item, index) => ({ ...item, _rowNumber: index + 1 }));
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
          `vmi-sync-history-${toLocalDateStr(new Date())}.xlsx`
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
          <div className="font-medium text-gray-900">{t(`sync.syncTypes.${type}.name`)}</div>
          <div className="text-xs text-gray-500">{t(`sync.syncTypes.${type}.label`)}</div>
        </div>
      </div>
    );
  }, [t]);

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
        {t(`sync.status.${status}`)}
      </div>
    );
  }, [t]);

  const renderTriggerCell = useCallback((cellInfo: DataGridTypes.ColumnCellTemplateData) => {
    const triggerKey = (cellInfo.value as string) || 'manual';
    const trigger = TRIGGER_CONFIG[triggerKey] || TRIGGER_CONFIG.manual;
    const Icon = trigger.icon;
    const triggerLabelKey = (['manual', 'scheduled', 'threshold', 'auto'].includes(triggerKey)
      ? triggerKey
      : 'manual') as 'manual' | 'scheduled' | 'threshold' | 'auto';
    return (
      <div className="flex items-center gap-1.5 text-gray-600">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-sm">{t(`sync.trigger.${triggerLabelKey}`)}</span>
      </div>
    );
  }, [t]);

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
            <span>{rowData.itemsFailed} {t('sync.history.failedSuffix')}</span>
          </div>
        )}
      </div>
    );
  }, [t]);

  const renderDateTimeCell = useCallback((cellInfo: DataGridTypes.ColumnCellTemplateData) => {
    if (!cellInfo.value) return <span className="text-gray-400">-</span>;

    const dateStr = cellInfo.value as string;
    return (
      <div className="py-1">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
          <Calendar className="h-3.5 w-3.5 text-gray-400" />
          {formatDateTime(dateStr, locale)}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5 ml-5">
          <Timer className="h-3 w-3" />
          {formatTimeAgo(dateStr)}
        </div>
      </div>
    );
  }, [formatTimeAgo, locale]);

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

  // Mobile card renderer for sync history
  const renderSyncHistoryCard = useCallback((item: SyncHistoryItem) => {
    const syncConfig = SYNC_TYPE_CONFIG[item.syncType];
    const statusConfig = STATUS_CONFIG[item.status];
    const SyncIcon = syncConfig?.icon || Package;
    const StatusIcon = statusConfig?.icon || CheckCircle;
    const percentage = item.itemsTotal > 0
      ? Math.round((item.itemsProcessed / item.itemsTotal) * 100)
      : 0;
    const duration = formatDuration(item.startedAt, item.completedAt);

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-300 transition-all">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {syncConfig && (
              <div className={cn('p-2 rounded-lg flex-shrink-0', syncConfig.iconBg)}>
                <SyncIcon className={cn('h-4 w-4', syncConfig.color)} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 truncate">
                {syncConfig ? t(`sync.syncTypes.${item.syncType}.name`) : item.syncType}
              </p>
              {item.portalName && (
                <p className="text-xs text-gray-500 truncate">{item.portalName}</p>
              )}
            </div>
          </div>
          {statusConfig && (
            <div
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0',
                statusConfig.bgColor,
                statusConfig.textColor,
                statusConfig.borderColor,
              )}
            >
              <StatusIcon
                className={cn('h-3 w-3', item.status === 'running' && 'animate-spin')}
              />
              {t(`sync.status.${item.status}`)}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600">
              {item.itemsProcessed.toLocaleString()}/{item.itemsTotal.toLocaleString()}
            </span>
            <span
              className={cn(
                'font-semibold',
                percentage === 100 && item.itemsFailed === 0
                  ? 'text-emerald-600'
                  : item.itemsFailed > 0
                  ? 'text-amber-600'
                  : 'text-gray-600',
              )}
            >
              {percentage}%
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                item.itemsFailed > 0
                  ? 'bg-amber-500'
                  : item.status === 'failed'
                  ? 'bg-red-500'
                  : 'bg-emerald-500',
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
          {item.itemsFailed > 0 && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              {item.itemsFailed} {t('sync.history.failedSuffix')}
            </p>
          )}
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="h-3 w-3" />
            {formatTimeAgo(item.startedAt)}
          </div>
          {duration !== '-' && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Timer className="h-3 w-3" />
              {duration}
            </div>
          )}
        </div>

        {item.errorMessage && (
          <div className="mt-2 pt-2 border-t border-red-100 text-xs text-red-700 bg-red-50 -mx-4 -mb-4 px-4 py-2 rounded-b-xl">
            <span className="font-semibold">{t('sync.mobileCard.errorLabel')}</span> {item.errorMessage}
          </div>
        )}
      </div>
    );
  }, [t, formatTimeAgo]);

  // Master detail render
  const renderMasterDetail = useCallback((e: DataGridTypes.MasterDetailTemplateData) => {
    const rowData = e.data as SyncHistoryItem;
    const triggerKey = (['manual', 'scheduled', 'threshold', 'auto'].includes(rowData.triggerType)
      ? rowData.triggerType
      : 'manual') as 'manual' | 'scheduled' | 'threshold' | 'auto';
    return (
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {t('sync.masterDetail.syncInfo')}
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('sync.masterDetail.syncId')}</span>
                <span className="font-mono text-gray-900">#{rowData.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('sync.masterDetail.portalId')}</span>
                <span className="font-mono text-gray-900">#{rowData.portalId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('sync.masterDetail.duration')}</span>
                <span className="text-gray-900">{formatDuration(rowData.startedAt, rowData.completedAt)}</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {t('sync.masterDetail.results')}
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('sync.masterDetail.processed')}</span>
                <span className="text-emerald-600 font-medium">{rowData.itemsProcessed.toLocaleString()} {t('sync.masterDetail.itemsUnit')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('sync.masterDetail.failed')}</span>
                <span className={cn(
                  'font-medium',
                  rowData.itemsFailed > 0 ? 'text-red-600' : 'text-gray-400'
                )}>
                  {rowData.itemsFailed > 0 ? `${rowData.itemsFailed.toLocaleString()} ${t('sync.masterDetail.itemsUnit')}` : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('sync.masterDetail.total')}</span>
                <span className="text-gray-900 font-medium">{rowData.itemsTotal.toLocaleString()} {t('sync.masterDetail.itemsUnit')}</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {t('sync.masterDetail.executedBy')}
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('sync.masterDetail.trigger')}</span>
                <span className="text-gray-900">{TRIGGER_CONFIG[rowData.triggerType] ? t(`sync.trigger.${triggerKey}`) : rowData.triggerType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('sync.masterDetail.by')}</span>
                <span className="text-gray-900">{rowData.triggeredByName || t('sync.masterDetail.system')}</span>
              </div>
            </div>
          </div>
        </div>
        {rowData.errorMessage && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="text-xs font-semibold text-red-800 uppercase tracking-wide mb-1">
              {t('sync.masterDetail.errorMessage')}
            </h4>
            <p className="text-sm text-red-700 font-mono">{rowData.errorMessage}</p>
          </div>
        )}
      </div>
    );
  }, [t]);

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
          return { text: t('sync.card.noItemsToSync'), type: 'warning' as const };
        }
        return {
          text: failed > 0
            ? t('sync.card.syncSuccessWithFailures', { processed, failed })
            : t('sync.card.syncSuccess', { processed }),
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
                <h3 className="font-bold text-gray-900">{t(`sync.syncTypes.${syncType}.name`)}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{t(`sync.syncTypes.${syncType}.description`)}</p>
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
                          {t(`sync.status.${lastSync.status}`)}
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
              <span className="text-sm text-gray-500">{t('sync.card.noHistory')}</span>
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
            text={isRunning ? t('sync.card.syncing') : t('sync.card.syncLabel', { label: t(`sync.syncTypes.${syncType}.name`) })}
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
                {t('sync.breadcrumb.portal')}
              </Link>
              <ChevronRight className="h-4 w-4" />
              <span className="text-white font-medium">{t('sync.breadcrumb.synchronization')}</span>
            </nav>

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <h1 className="text-3xl font-bold mb-2">{t('sync.header.title')}</h1>
                <p className="text-indigo-200 text-lg">
                  {t('sync.header.subtitle')}
                </p>
              </div>

              {/* Quick Stats */}
              <div className="flex flex-wrap items-center gap-4 lg:gap-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 min-w-[90px]">
                  <div className="text-3xl font-bold">{stats.totalSyncs}</div>
                  <div className="text-xs text-indigo-200 mt-0.5">{t('sync.header.totalSyncs')}</div>
                </div>
                <div className="bg-emerald-500/20 backdrop-blur-sm rounded-xl px-4 py-3 min-w-[90px] border border-emerald-400/30">
                  <div className="text-3xl font-bold text-emerald-300">{stats.successfulToday}</div>
                  <div className="text-xs text-emerald-200 mt-0.5">{t('sync.header.successfulToday')}</div>
                </div>
                <div className="bg-red-500/20 backdrop-blur-sm rounded-xl px-4 py-3 min-w-[90px] border border-red-400/30">
                  <div className="text-3xl font-bold text-red-300">{stats.failedToday}</div>
                  <div className="text-xs text-red-200 mt-0.5">{t('sync.header.failedToday')}</div>
                </div>
                {stats.isRunning && (
                  <div className="bg-yellow-500/20 backdrop-blur-sm rounded-xl px-4 py-3 border border-yellow-400/30 flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-yellow-300" />
                    <span className="text-sm text-yellow-200">{t('sync.header.running')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6">
              <DxButton
                icon="refresh"
                text={t('sync.header.refresh')}
                type="normal"
                stylingMode="text"
                onClick={() => refetch()}
                className="!text-white hover:!bg-white/10"
              />
              <Link href="/settings/vmi">
                <DxButton
                  icon="preferences"
                  text={t('sync.header.portalSettings')}
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
                <h3 className="font-bold text-gray-900 text-lg">{t('sync.syncAll.title')}</h3>
                <p className="text-sm text-gray-600">
                  {t('sync.syncAll.description')}
                </p>
              </div>
            </div>
            <DxButton
              text={isAnySyncing ? t('sync.syncAll.syncing') : t('sync.syncAll.button')}
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
                  {t('sync.help.title')}
                </h4>
                <div className="text-sm text-amber-800 space-y-2">
                  <p>{t('sync.help.intro')}</p>
                  <ol className="list-decimal list-inside space-y-1.5 ml-2">
                    <li>
                      <strong>{t('sync.help.step1Label')}</strong> - {t('sync.help.step1Detail')}{' '}
                      <Link href="/settings/vmi" className="underline hover:text-amber-900 font-medium">
                        {t('sync.help.step1Link')}
                      </Link>
                    </li>
                    <li>
                      <strong>{t('sync.help.step2Label')}</strong> - {t('sync.help.step2Detail')}{' '}
                      <Link href="/inventory/items" className="underline hover:text-amber-900 font-medium">
                        {t('sync.help.step2Link')}
                      </Link>{' '}
                      {t('sync.help.step2Suffix')}
                    </li>
                    <li>
                      <strong>{t('sync.help.step3Label')}</strong> - {t('sync.help.step3Detail')}
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
                <h3 className="font-bold text-gray-900 text-lg">{t('sync.history.title')}</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {t('sync.history.subtitle')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DxButton
                icon="refresh"
                type="normal"
                stylingMode="text"
                onClick={() => refetch()}
                hint={t('sync.history.refreshHint')}
              />
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-3 p-4 m-4 rounded-lg bg-red-50 text-red-800 border border-red-200">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <span>{error instanceof Error ? error.message : t('sync.history.loadError')}</span>
            </div>
          )}

          {/* Mobile Card View */}
          {isMobile ? (
            <div className="p-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-32 rounded-xl bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : !historyData?.items || historyData.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center mb-3">
                    <Activity className="h-8 w-8 text-indigo-600" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900 mb-1">
                    {t('sync.history.empty')}
                  </p>
                  <p className="text-sm text-gray-500 max-w-sm">
                    {t('sync.history.emptyHint')}
                  </p>
                </div>
              ) : (
                <MobileListView
                  items={historyData.items}
                  keyExpr="id"
                  renderCard={renderSyncHistoryCard}
                  emptyMessage={t('sync.history.empty')}
                  gap="md"
                />
              )}
            </div>
          ) : (
          <DataGrid
            key={locale}
            dataSource={historyItemsWithRowNum}
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
            noDataText={t('sync.history.empty')}
            onExporting={handleExporting}
            className="dx-card-grid"
          >
            <LoadPanel enabled={isLoading} />
            <SearchPanel visible={true} placeholder={t('sync.history.searchPlaceholder')} width={250} />
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
                  text={t('sync.history.filterButton')}
                  type="normal"
                  stylingMode="text"
                  hint={t('sync.history.filterHint')}
                />
              </Item>
              <Item name="exportButton" location="after" />
            </Toolbar>

            <Column
              caption={t('items.grid.columns.rowNum')}
              width={60}
              alignment="center"
              allowFiltering={false}
              allowSorting={false}
              allowGrouping={false}
              allowExporting={false}
              cellRender={(cellInfo) => (
                <span className="text-gray-500 text-sm font-medium">
                  {cellInfo.rowIndex + 1}
                </span>
              )}
            />

            <Column
              dataField="syncType"
              caption={t('sync.history.columns.syncType')}
              width={160}
              cellRender={renderSyncTypeCell}
              allowHeaderFiltering={true}
            >
              <HeaderFilter dataSource={[
                { text: t('sync.history.headerFilter.inventory'), value: 'inventory' },
                { text: t('sync.history.headerFilter.items'), value: 'items' },
                { text: t('sync.history.headerFilter.prices'), value: 'prices' },
              ]} />
            </Column>

            <Column
              dataField="status"
              caption={t('sync.history.columns.status')}
              width={130}
              cellRender={renderStatusCell}
              allowHeaderFiltering={true}
            >
              <HeaderFilter dataSource={[
                { text: t('sync.history.headerFilter.completed'), value: 'completed' },
                { text: t('sync.history.headerFilter.failed'), value: 'failed' },
                { text: t('sync.history.headerFilter.partial'), value: 'partial' },
                { text: t('sync.history.headerFilter.running'), value: 'running' },
              ]} />
            </Column>

            <Column
              dataField="triggerType"
              caption={t('sync.history.columns.trigger')}
              width={100}
              cellRender={renderTriggerCell}
              allowHeaderFiltering={true}
            >
              <HeaderFilter dataSource={[
                { text: t('sync.history.headerFilter.manual'), value: 'manual' },
                { text: t('sync.history.headerFilter.scheduled'), value: 'scheduled' },
                { text: t('sync.history.headerFilter.auto'), value: 'auto' },
              ]} />
            </Column>

            <Column
              dataField="itemsProcessed"
              caption={t('sync.history.columns.progress')}
              width={180}
              cellRender={renderProgressCell}
              allowFiltering={false}
              allowHeaderFiltering={false}
            />

            <Column
              dataField="startedAt"
              caption={t('sync.history.columns.startedAt')}
              dataType="datetime"
              width={180}
              cellRender={renderDateTimeCell}
              sortOrder="desc"
              sortIndex={0}
            />

            <Column
              dataField="completedAt"
              caption={t('sync.history.columns.duration')}
              width={100}
              cellRender={renderDurationCell}
              allowFiltering={false}
            />

            <Column
              dataField="portalName"
              caption={t('sync.history.columns.portal')}
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
              infoText={t('sync.history.pagerInfoText')}
            />

            <Summary>
              <TotalItem column="itemsProcessed" summaryType="sum" displayFormat={t('sync.history.totalSummary')} />
            </Summary>
          </DataGrid>
          )}
        </div>

        {/* Info Section */}
        <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-indigo-50 rounded-xl border border-indigo-200 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-indigo-100">
              <Info className="h-6 w-6 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-indigo-900 mb-4">
                {t('sync.info.title')}
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
                          <strong className="text-indigo-900">{t(`sync.syncTypes.${key as VmiSyncType}.label`)} {t('sync.info.syncSuffix')}</strong>
                        </div>
                        <p className="text-sm text-indigo-700">
                          {t(`sync.syncTypes.${key as VmiSyncType}.description`)}
                        </p>
                      </div>
                    );
                  })}
              </div>
              <div className="mt-4 pt-4 border-t border-indigo-200 flex items-center gap-2 text-sm text-indigo-700">
                <TrendingUp className="h-4 w-4" />
                <strong>{t('sync.info.autoSyncLabel')}</strong>{' '}
                {t('sync.info.autoSyncDescription')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
