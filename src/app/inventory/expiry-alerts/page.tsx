'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/components/ui/api-error';
// ResponsivePageHeader, StatCard removed — Style E uses inline hero + custom KPI cards
import { useMobile } from '@/hooks/use-mobile';
import { AlertTriangle, Clock, XCircle, CheckCircle } from 'lucide-react';

interface ExpiryItem {
  lotNumber: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  expiryDate: string;
  daysToExpiry?: number;
  daysExpired?: number;
}

interface ExpiryReport {
  expired: ExpiryItem[];
  nearExpiry: ExpiryItem[];
  summary: {
    expiredCount: number;
    expiredValue: number;
    nearExpiryCount: number;
    nearExpiryValue: number;
  };
}

interface ApiErrorState {
  error: string;
  debug?: {
    message: string;
    stack?: string;
    name?: string;
    cause?: string;
    code?: string;
    path?: string;
    timestamp: string;
  };
}

// next-intl's Translator expects specific value types; use a superset-compatible shape.
type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

// Day-threshold options; labels translated at render time.
const DAYS_OPTIONS_CONFIG: Array<{ value: string; translationKey: string }> = [
  { value: '30', translationKey: 'next30' },
  { value: '60', translationKey: 'next60' },
  { value: '90', translationKey: 'next90' },
  { value: '180', translationKey: 'next180' },
];

export default function ExpiryAlertsPage() {
  const t = useTranslations('inventory');
  const { isMobile } = useMobile();
  const [report, setReport] = useState<ExpiryReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<ApiErrorState | null>(null);
  const [daysThreshold, setDaysThreshold] = useState('90');

  const fetchExpiryAlerts = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/reports/expiry?days=${daysThreshold}`);
      const data = await res.json();
      if (data.success) {
        setReport(data.data?.data || null);
      } else {
        setApiError({
          error: data.error || 'Unknown error',
          debug: data.debug,
        });
      }
    } catch (error) {
      console.error('Failed to fetch expiry alerts:', error);
      setApiError({
        error: error instanceof Error ? error.message : 'Network error',
        debug: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
          timestamp: new Date().toISOString(),
        } : undefined,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpiryAlerts();
  }, [daysThreshold]);

  // Rebuild day-threshold option labels when locale changes.
  const daysOptions = useMemo(
    () =>
      DAYS_OPTIONS_CONFIG.map(({ value, translationKey }) => ({
        value,
        label: t(`expiryAlerts.daysOptions.${translationKey}`),
      })),
    [t],
  );

  // Reusable row-number column matching /inventory/items.
  const rowNumberColumn: DxDataGridColumn = {
    dataField: '_rowNumber',
    caption: t('items.grid.columns.rowNum'),
    width: 60,
    alignment: 'center',
    allowFiltering: false,
    allowSorting: false,
    cellRender: (cellInfo) => (
      <span className="text-gray-500 text-sm font-medium">
        {cellInfo.data._rowNumber}
      </span>
    ),
  };

  const expiredColumns: DxDataGridColumn[] = [
    rowNumberColumn,
    { dataField: 'lotNumber', caption: t('expiryAlerts.columns.lotNumber'), width: 150 },
    { dataField: 'itemCode', caption: t('expiryAlerts.columns.itemCode'), width: 120, hideOnMobile: true },
    { dataField: 'itemName', caption: t('expiryAlerts.columns.itemName'), minWidth: 200 },
    {
      dataField: 'quantity',
      caption: t('expiryAlerts.columns.quantity'),
      width: 120,
      cellRender: (cellInfo) => cellInfo.data.quantity.toLocaleString(),
    },
    { dataField: 'expiryDate', caption: t('expiryAlerts.columns.expiryDate'), width: 120, hideOnMobile: true },
    {
      dataField: 'daysExpired',
      caption: t('expiryAlerts.columns.daysExpired'),
      width: 130,
      cellRender: (cellInfo) => (
        <Badge variant="danger">
          {t('expiryAlerts.badge.daysAgo', { days: cellInfo.data.daysExpired ?? 0 })}
        </Badge>
      ),
    },
  ];

  const nearExpiryColumns: DxDataGridColumn[] = [
    rowNumberColumn,
    { dataField: 'lotNumber', caption: t('expiryAlerts.columns.lotNumber'), width: 150 },
    { dataField: 'itemCode', caption: t('expiryAlerts.columns.itemCode'), width: 120, hideOnMobile: true },
    { dataField: 'itemName', caption: t('expiryAlerts.columns.itemName'), minWidth: 200 },
    {
      dataField: 'quantity',
      caption: t('expiryAlerts.columns.quantity'),
      width: 120,
      cellRender: (cellInfo) => cellInfo.data.quantity.toLocaleString(),
    },
    { dataField: 'expiryDate', caption: t('expiryAlerts.columns.expiryDate'), width: 120, hideOnMobile: true },
    {
      dataField: 'daysToExpiry',
      caption: t('expiryAlerts.columns.daysToExpiry'),
      width: 140,
      cellRender: (cellInfo) => {
        const days = cellInfo.data.daysToExpiry || 0;
        const variant = days <= 30 ? 'danger' : days <= 60 ? 'secondary' : 'default';
        return <Badge variant={variant}>{t('expiryAlerts.badge.daysLeft', { days })}</Badge>;
      },
    },
  ];

  // Tag with display row number (mirrors /inventory/items pattern).
  const expired = (report?.expired || []).map((item, index) => ({ ...item, _rowNumber: index + 1 }));
  const nearExpiry = (report?.nearExpiry || []).map((item, index) => ({ ...item, _rowNumber: index + 1 }));
  const expiredCount = report?.summary.expiredCount || 0;
  const expiredValue = report?.summary.expiredValue || 0;
  const nearExpiryCount = report?.summary.nearExpiryCount || 0;
  const nearExpiryValue = report?.summary.nearExpiryValue || 0;

  const showAllClearEmpty =
    !isLoading && !apiError && expired.length === 0 && nearExpiry.length === 0;

  return (
    <MainLayout>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
        {/* Style E Hero — clinical pharma-grade with sky-600 accent */}
        <div className="bg-white rounded-md p-5 lg:p-6 border-2 border-sky-100">
          <div className="border-l-4 border-sky-600 bg-sky-50 rounded-r-md p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-md bg-sky-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-sky-700 uppercase tracking-wider">
                  Pharmaceutical Inventory · Expiry Surveillance
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5 truncate">
                  {t('expiryAlerts.pageTitle')}
                </h1>
                <p className="text-sm text-slate-600 mt-0.5">{t('expiryAlerts.description')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <DxSelectBox
                items={daysOptions}
                value={daysThreshold}
                onValueChange={setDaysThreshold}
                valueExpr="value"
                displayExpr="label"
                width={isMobile ? undefined : 170}
              />
              <DxButton
                text={t('expiryAlerts.refresh')}
                icon="refresh"
                type="normal"
                stylingMode="outlined"
                onClick={fetchExpiryAlerts}
                className="hidden sm:inline-flex"
              />
              {/* Mobile-only icon-only refresh */}
              <DxButton
                icon="refresh"
                stylingMode="outlined"
                onClick={fetchExpiryAlerts}
                className="sm:hidden"
              />
            </div>
          </div>
        </div>

        {/* Error Display */}
        {apiError && (
          <ApiError
            error={apiError.error}
            debug={apiError.debug}
            onRetry={fetchExpiryAlerts}
          />
        )}

        {/* Style E KPI Cards — solid borders + Current/Δ Week split */}
        {!apiError && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StyleEKpiCard
              label={t('expiryAlerts.stats.expiredLots')}
              value={expiredCount.toLocaleString()}
              icon={XCircle}
              accent="rose"
              isLoading={isLoading}
            />
            <StyleEKpiCard
              label={t('expiryAlerts.stats.expiredValue')}
              value={`฿${expiredValue.toLocaleString()}`}
              icon={AlertTriangle}
              accent="rose"
              isLoading={isLoading}
            />
            <StyleEKpiCard
              label={t('expiryAlerts.stats.nearExpiryLots')}
              value={nearExpiryCount.toLocaleString()}
              icon={Clock}
              accent="amber"
              isLoading={isLoading}
            />
            <StyleEKpiCard
              label={t('expiryAlerts.stats.nearExpiryValue')}
              value={`฿${nearExpiryValue.toLocaleString()}`}
              icon={AlertTriangle}
              accent="amber"
              isLoading={isLoading}
            />
          </div>
        )}

        {/* Loading skeletons */}
        {isLoading && !apiError && (
          isMobile ? (
            <ExpiryCardSkeletonList count={4} />
          ) : (
            <DataGridLoadingSkeleton />
          )
        )}

        {/* Empty state — all clear */}
        {showAllClearEmpty && <AllClearEmptyState t={t} />}

        {/* Expired Lots Section — Style E panel */}
        {!apiError && !isLoading && expired.length > 0 && (
          <div className="bg-white rounded-md border-2 border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-rose-50 border-b-2 border-rose-200 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-rose-700 flex-shrink-0" />
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  {t('expiryAlerts.sections.expiredTitle', { count: expired.length })}
                </h2>
                <p className="text-xs text-rose-700 mt-0.5">
                  {t('expiryAlerts.sections.expiredDescription')}
                </p>
              </div>
            </div>
            {isMobile ? (
              <ExpiredLotsMobileList items={expired} t={t} />
            ) : (
              <div className="p-3 sm:p-4">
                <DxDataGrid
                  dataSource={expired}
                  keyExpr="lotNumber"
                  columns={expiredColumns}
                  showBorders
                  height={420}
                  noDataText={t('expiryAlerts.noExpired')}
                />
              </div>
            )}
          </div>
        )}

        {/* Near Expiry Lots Section — Style E panel */}
        {!apiError && !isLoading && nearExpiry.length > 0 && (
          <div className="bg-white rounded-md border-2 border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 border-b-2 border-amber-200 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-700 flex-shrink-0" />
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  {t('expiryAlerts.sections.nearExpiryTitle', { count: nearExpiry.length })}
                </h2>
                <p className="text-xs text-amber-700 mt-0.5">
                  {t('expiryAlerts.sections.nearExpiryDescription', { days: daysThreshold })}
                </p>
              </div>
            </div>
            {isMobile ? (
              <NearExpiryLotsMobileList items={nearExpiry} t={t} />
            ) : (
              <div className="p-3 sm:p-4">
                <DxDataGrid
                  dataSource={nearExpiry}
                  keyExpr="lotNumber"
                  columns={nearExpiryColumns}
                  showBorders
                  height={420}
                  noDataText={t('expiryAlerts.noNearExpiry')}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

// Style E clinical KPI card — accent-bordered with Current + Δ Week split.
type StyleEKpiAccent = 'sky' | 'emerald' | 'rose' | 'amber';
function StyleEKpiCard({
  label,
  value,
  icon: Icon,
  accent,
  isLoading,
}: {
  label: string;
  value: string | number;
  icon: typeof AlertTriangle;
  accent: StyleEKpiAccent;
  isLoading?: boolean;
}) {
  const colors =
    accent === 'sky' ? 'border-sky-200 bg-sky-50/50' :
    accent === 'emerald' ? 'border-emerald-200 bg-emerald-50/50' :
    accent === 'rose' ? 'border-rose-200 bg-rose-50/50' :
    'border-amber-200 bg-amber-50/50';
  const iconColor =
    accent === 'sky' ? 'text-sky-600' :
    accent === 'emerald' ? 'text-emerald-600' :
    accent === 'rose' ? 'text-rose-600' :
    'text-amber-600';
  return (
    <div className={`bg-white rounded-md border-2 ${colors} p-4`}>
      <div className="flex items-start justify-between mb-3 pb-2 border-b border-slate-200">
        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide truncate">
          {label}
        </div>
        <Icon className={`w-4 h-4 ${iconColor} flex-shrink-0`} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] uppercase text-slate-500">Current</div>
          {isLoading ? (
            <div className="h-7 w-16 bg-slate-200 rounded animate-pulse mt-1" />
          ) : (
            <div className={`text-2xl font-bold tabular-nums ${iconColor} truncate`}>{value}</div>
          )}
        </div>
        <div>
          <div className="text-[10px] uppercase text-slate-500">Δ Week</div>
          <div className="text-sm font-semibold text-slate-700 tabular-nums">—</div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

/** Mobile card list — Expired lots */
function ExpiredLotsMobileList({ items, t }: { items: ExpiryItem[]; t: TranslateFn }) {
  return (
    <div className="p-3 space-y-3 bg-red-50/30">
      {items.map((item) => (
        <div
          key={item.lotNumber}
          className="bg-white border border-red-200 rounded-xl shadow-sm p-4 active:bg-red-50/40 transition-colors"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 text-base truncate">
                {item.lotNumber}
              </p>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                {item.itemCode}
              </p>
            </div>
            <Badge variant="danger">
              {t('expiryAlerts.badge.daysAgo', { days: item.daysExpired ?? 0 })}
            </Badge>
          </div>
          <p className="text-sm text-gray-700 truncate mb-2">{item.itemName}</p>
          <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-100">
            <span className="inline-flex items-center gap-1">
              <span className="text-gray-400">{t('expiryAlerts.mobile.qty')}</span>
              <span className="font-medium text-gray-800">
                {item.quantity.toLocaleString()}
              </span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-gray-400">{t('expiryAlerts.mobile.expired')}</span>
              <span className="font-medium text-red-700">{item.expiryDate}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Mobile card list — Near-expiry lots */
function NearExpiryLotsMobileList({
  items,
  t,
}: {
  items: ExpiryItem[];
  t: TranslateFn;
}) {
  return (
    <div className="p-3 space-y-3 bg-amber-50/30">
      {items.map((item) => {
        const days = item.daysToExpiry ?? 0;
        const variant: 'danger' | 'secondary' | 'default' =
          days <= 30 ? 'danger' : days <= 60 ? 'secondary' : 'default';
        const accentBorder =
          days <= 30 ? 'border-red-200' :
          days <= 60 ? 'border-amber-200' : 'border-gray-200';
        return (
          <div
            key={item.lotNumber}
            className={`bg-white border ${accentBorder} rounded-xl shadow-sm p-4 active:bg-amber-50/40 transition-colors`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 text-base truncate">
                  {item.lotNumber}
                </p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  {item.itemCode}
                </p>
              </div>
              <Badge variant={variant}>
                {t('expiryAlerts.badge.daysLeft', { days })}
              </Badge>
            </div>
            <p className="text-sm text-gray-700 truncate mb-2">{item.itemName}</p>
            <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-100">
              <span className="inline-flex items-center gap-1">
                <span className="text-gray-400">{t('expiryAlerts.mobile.qty')}</span>
                <span className="font-medium text-gray-800">
                  {item.quantity.toLocaleString()}
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="text-gray-400">{t('expiryAlerts.mobile.expires')}</span>
                <span className="font-medium text-amber-700">
                  {item.expiryDate}
                </span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Skeleton — mobile card list */
function ExpiryCardSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="p-3 space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse"
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="space-y-2 flex-1">
              <div className="h-4 w-1/2 bg-gray-200 rounded" />
              <div className="h-3 w-1/4 bg-gray-200 rounded" />
            </div>
            <div className="h-5 w-20 bg-gray-200 rounded-full" />
          </div>
          <div className="h-3 w-3/4 bg-gray-200 rounded mb-3" />
          <div className="flex justify-between pt-2 border-t border-gray-100">
            <div className="h-3 w-16 bg-gray-200 rounded" />
            <div className="h-3 w-20 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton — desktop DataGrid */
function DataGridLoadingSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-lg animate-pulse"
        >
          <div className="h-8 w-32 bg-gray-200 rounded" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 bg-gray-200 rounded" />
            <div className="h-2 w-1/5 bg-gray-200 rounded" />
          </div>
          <div className="h-6 w-20 bg-gray-200 rounded-full" />
          <div className="h-6 w-24 bg-gray-200 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** All-clear empty state — no expired or near-expiry lots */
function AllClearEmptyState({ t }: { t: TranslateFn }) {
  return (
    <div className="bg-white border border-emerald-100 rounded-xl shadow-sm">
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="h-20 w-20 rounded-2xl bg-emerald-100 flex items-center justify-center mb-5">
          <CheckCircle className="h-10 w-10 text-emerald-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {t('expiryAlerts.allClear.title')}
        </h3>
        <p className="text-sm text-gray-500 max-w-sm">
          {t('expiryAlerts.allClear.description')}
        </p>
      </div>
    </div>
  );
}
