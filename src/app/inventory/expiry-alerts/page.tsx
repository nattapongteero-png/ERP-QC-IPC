'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/main-layout';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/components/ui/api-error';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
import { AlertTriangle, Clock, XCircle, CheckCircle } from 'lucide-react';
import { formatNumber, formatMoney } from '@/lib/utils/number-format';

interface ExpiryItem {
  lotNumber: string;
  itemCode: string;
  itemName: string;
  itemNameTh?: string;
  itemNameEn?: string;
  unit?: string;
  quantity: number;
  value?: number;
  expiryDate: string;
  daysToExpiry?: number;
  daysExpired?: number;
}

/**
 * Format a stored expiry date (YYYY-MM-DD or an ISO datetime such as
 * "2026-01-01T00:00:00.000Z") as a plain dd/mm/yyyy string. Strips the time
 * portion the tester saw ("T00:00:00") and never shifts the day (parses the
 * date part directly rather than through the timezone-sensitive Date ctor).
 */
function formatExpiryDate(raw: string | null | undefined): string {
  if (!raw) return '-';
  const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
  }
  return String(raw);
}

/** Resolve the product name to the active locale, falling back gracefully. */
function localizedItemName(item: ExpiryItem, locale: string): string {
  if (locale.startsWith('th')) return item.itemNameTh || item.itemName || item.itemCode;
  return item.itemNameEn || item.itemName || item.itemCode;
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
  const locale = useLocale();
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
    { dataField: 'lotNumber', caption: t('expiryAlerts.columns.lotNumber'), width: 185, cellRender: (cellInfo) => (
      <Link
        href={`/inventory/lots?search=${encodeURIComponent(cellInfo.data.lotNumber)}`}
        className="font-mono whitespace-nowrap text-emerald-700 hover:text-emerald-900 hover:underline"
        data-testid={`expiry-lot-link-${cellInfo.data.lotNumber}`}
      >
        {cellInfo.data.lotNumber}
      </Link>
    ) },
    { dataField: 'itemCode', caption: t('expiryAlerts.columns.itemCode'), width: 155, hideOnMobile: true, cellRender: (cellInfo) => <span className="font-mono whitespace-nowrap">{cellInfo.data.itemCode}</span> },
    { dataField: 'itemName', caption: t('expiryAlerts.columns.itemName'), minWidth: 200, cellRender: (cellInfo) => <span>{localizedItemName(cellInfo.data, locale)}</span> },
    {
      dataField: 'quantity',
      caption: t('expiryAlerts.columns.quantity'),
      width: 130,
      // Show the unit alongside the number (item 46a).
      cellRender: (cellInfo) => (
        <span className="whitespace-nowrap">
          {formatNumber(cellInfo.data.quantity)}
          {cellInfo.data.unit ? ` ${cellInfo.data.unit}` : ''}
        </span>
      ),
    },
    {
      dataField: 'value',
      caption: t('expiryAlerts.columns.value'),
      width: 130,
      alignment: 'right',
      hideOnMobile: true,
      cellRender: (cellInfo) => <span className="whitespace-nowrap">฿{formatMoney(cellInfo.data.value ?? 0)}</span>,
    },
    { dataField: 'expiryDate', caption: t('expiryAlerts.columns.expiryDate'), width: 130, hideOnMobile: true, cellRender: (cellInfo) => <span className="whitespace-nowrap">{formatExpiryDate(cellInfo.data.expiryDate)}</span> },
    {
      dataField: 'daysExpired',
      caption: t('expiryAlerts.columns.daysExpired'),
      // minWidth (not a fixed width) so the longer Thai header isn't clipped.
      minWidth: 150,
      cellRender: (cellInfo) => (
        <Badge variant="danger">
          {t('expiryAlerts.badge.daysAgo', { days: cellInfo.data.daysExpired ?? 0 })}
        </Badge>
      ),
    },
  ];

  const nearExpiryColumns: DxDataGridColumn[] = [
    rowNumberColumn,
    { dataField: 'lotNumber', caption: t('expiryAlerts.columns.lotNumber'), width: 185, cellRender: (cellInfo) => (
      <Link
        href={`/inventory/lots?search=${encodeURIComponent(cellInfo.data.lotNumber)}`}
        className="font-mono whitespace-nowrap text-emerald-700 hover:text-emerald-900 hover:underline"
        data-testid={`expiry-lot-link-${cellInfo.data.lotNumber}`}
      >
        {cellInfo.data.lotNumber}
      </Link>
    ) },
    { dataField: 'itemCode', caption: t('expiryAlerts.columns.itemCode'), width: 155, hideOnMobile: true, cellRender: (cellInfo) => <span className="font-mono whitespace-nowrap">{cellInfo.data.itemCode}</span> },
    { dataField: 'itemName', caption: t('expiryAlerts.columns.itemName'), minWidth: 200, cellRender: (cellInfo) => <span>{localizedItemName(cellInfo.data, locale)}</span> },
    {
      dataField: 'quantity',
      caption: t('expiryAlerts.columns.quantity'),
      width: 130,
      // Show the unit alongside the number (item 46a).
      cellRender: (cellInfo) => (
        <span className="whitespace-nowrap">
          {formatNumber(cellInfo.data.quantity)}
          {cellInfo.data.unit ? ` ${cellInfo.data.unit}` : ''}
        </span>
      ),
    },
    {
      dataField: 'value',
      caption: t('expiryAlerts.columns.value'),
      width: 130,
      alignment: 'right',
      hideOnMobile: true,
      cellRender: (cellInfo) => <span className="whitespace-nowrap">฿{formatMoney(cellInfo.data.value ?? 0)}</span>,
    },
    { dataField: 'expiryDate', caption: t('expiryAlerts.columns.expiryDate'), width: 130, hideOnMobile: true, cellRender: (cellInfo) => <span className="whitespace-nowrap">{formatExpiryDate(cellInfo.data.expiryDate)}</span> },
    {
      dataField: 'daysToExpiry',
      caption: t('expiryAlerts.columns.daysToExpiry'),
      // minWidth (not a fixed width) so the longer Thai header isn't clipped.
      minWidth: 170,
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
        {/* Responsive Page Header */}
        <ResponsivePageHeader
          title={t('expiryAlerts.pageTitle')}
          subtitle={t('expiryAlerts.description')}
          icon={AlertTriangle}
          iconBgColor="bg-amber-100"
          iconColor="text-amber-600"
          actions={
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
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
              />
            </div>
          }
        />

        {/* Error Display */}
        {apiError && (
          <ApiError
            error={apiError.error}
            debug={apiError.debug}
            onRetry={fetchExpiryAlerts}
          />
        )}

        {/* KPI Stat Cards */}
        {!apiError && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <StatCard
              label={t('expiryAlerts.stats.expiredLots')}
              value={expiredCount}
              icon={XCircle}
              iconColor="text-red-500"
              accentColor="border-red-500"
              isLoading={isLoading}
            />
            <StatCard
              label={t('expiryAlerts.stats.expiredValue')}
              value={`฿${formatMoney(expiredValue)}`}
              icon={AlertTriangle}
              iconColor="text-red-500"
              accentColor="border-red-500"
              isLoading={isLoading}
            />
            <StatCard
              label={t('expiryAlerts.stats.nearExpiryLots')}
              value={nearExpiryCount}
              icon={Clock}
              iconColor="text-amber-500"
              accentColor="border-amber-500"
              isLoading={isLoading}
            />
            <StatCard
              label={t('expiryAlerts.stats.nearExpiryValue')}
              value={`฿${formatMoney(nearExpiryValue)}`}
              icon={AlertTriangle}
              iconColor="text-amber-500"
              accentColor="border-amber-500"
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

        {/* Expired Lots Section */}
        {!apiError && !isLoading && expired.length > 0 && (
          <div className="bg-white border border-red-100 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-3 sm:p-4 bg-gradient-to-r from-red-50 to-red-100/30 border-b border-red-100">
              <h2 className="text-base sm:text-lg font-semibold text-red-800 flex items-center gap-2">
                <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                {t('expiryAlerts.sections.expiredTitle', { count: expired.length })}
              </h2>
              <p className="text-xs sm:text-sm text-red-600 mt-1">
                {t('expiryAlerts.sections.expiredDescription')}
              </p>
            </div>
            {isMobile ? (
              <ExpiredLotsMobileList items={expired} t={t} locale={locale} />
            ) : (
              <div className="p-3 sm:p-4">
                <DxDataGrid
                  dataSource={expired}
                  keyExpr="lotNumber"
                  columns={expiredColumns}
                  showBorders
                  noDataText={t('expiryAlerts.noExpired')}
                />
              </div>
            )}
          </div>
        )}

        {/* Near Expiry Lots Section */}
        {!apiError && !isLoading && nearExpiry.length > 0 && (
          <div className="bg-white border border-amber-100 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-3 sm:p-4 bg-gradient-to-r from-amber-50 to-amber-100/30 border-b border-amber-100">
              <h2 className="text-base sm:text-lg font-semibold text-amber-800 flex items-center gap-2">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                {t('expiryAlerts.sections.nearExpiryTitle', { count: nearExpiry.length })}
              </h2>
              <p className="text-xs sm:text-sm text-amber-600 mt-1">
                {t('expiryAlerts.sections.nearExpiryDescription', { days: daysThreshold })}
              </p>
            </div>
            {isMobile ? (
              <NearExpiryLotsMobileList items={nearExpiry} t={t} locale={locale} />
            ) : (
              <div className="p-3 sm:p-4">
                <DxDataGrid
                  dataSource={nearExpiry}
                  keyExpr="lotNumber"
                  columns={nearExpiryColumns}
                  showBorders
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

// ============================================
// Helper Components
// ============================================

/** Mobile card list — Expired lots */
function ExpiredLotsMobileList({ items, t, locale }: { items: ExpiryItem[]; t: TranslateFn; locale: string }) {
  return (
    <div className="p-3 space-y-3 bg-red-50/30">
      {items.map((item) => (
        <div
          key={item.lotNumber}
          className="bg-white border border-red-200 rounded-xl shadow-sm p-4 active:bg-red-50/40 transition-colors"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0 flex-1">
              <Link
                href={`/inventory/lots?search=${encodeURIComponent(item.lotNumber)}`}
                className="font-semibold text-emerald-700 text-base truncate block hover:underline"
              >
                {item.lotNumber}
              </Link>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                {item.itemCode}
              </p>
            </div>
            <Badge variant="danger">
              {t('expiryAlerts.badge.daysAgo', { days: item.daysExpired ?? 0 })}
            </Badge>
          </div>
          <p className="text-sm text-gray-700 truncate mb-2">{localizedItemName(item, locale)}</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600 pt-2 border-t border-gray-100">
            <span className="inline-flex items-center gap-1">
              <span className="text-gray-400">{t('expiryAlerts.mobile.qty')}</span>
              <span className="font-medium text-gray-800">
                {formatNumber(item.quantity)}{item.unit ? ` ${item.unit}` : ''}
              </span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-gray-400">{t('expiryAlerts.columns.value')}</span>
              <span className="font-medium text-gray-800">฿{formatMoney(item.value ?? 0)}</span>
            </span>
            <span className="inline-flex items-center gap-1 col-span-2">
              <span className="text-gray-400">{t('expiryAlerts.mobile.expired')}</span>
              <span className="font-medium text-red-700">{formatExpiryDate(item.expiryDate)}</span>
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
  locale,
}: {
  items: ExpiryItem[];
  t: TranslateFn;
  locale: string;
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
                <Link
                  href={`/inventory/lots?search=${encodeURIComponent(item.lotNumber)}`}
                  className="font-semibold text-emerald-700 text-base truncate block hover:underline"
                >
                  {item.lotNumber}
                </Link>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  {item.itemCode}
                </p>
              </div>
              <Badge variant={variant}>
                {t('expiryAlerts.badge.daysLeft', { days })}
              </Badge>
            </div>
            <p className="text-sm text-gray-700 truncate mb-2">{localizedItemName(item, locale)}</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600 pt-2 border-t border-gray-100">
              <span className="inline-flex items-center gap-1">
                <span className="text-gray-400">{t('expiryAlerts.mobile.qty')}</span>
                <span className="font-medium text-gray-800">
                  {formatNumber(item.quantity)}{item.unit ? ` ${item.unit}` : ''}
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="text-gray-400">{t('expiryAlerts.columns.value')}</span>
                <span className="font-medium text-gray-800">฿{formatMoney(item.value ?? 0)}</span>
              </span>
              <span className="inline-flex items-center gap-1 col-span-2">
                <span className="text-gray-400">{t('expiryAlerts.mobile.expires')}</span>
                <span className="font-medium text-amber-700">
                  {formatExpiryDate(item.expiryDate)}
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
    <div className="bg-white border border-emerald-100 rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)]">
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="h-20 w-20 rounded-2xl bg-emerald-100 flex items-center justify-center mb-5">
          <CheckCircle className="h-10 w-10 text-emerald-600" />
        </div>
        <h3 className="text-lg font-semibold text-[#064E3B] mb-2">
          {t('expiryAlerts.allClear.title')}
        </h3>
        <p className="text-sm text-[#4B7163] max-w-sm">
          {t('expiryAlerts.allClear.description')}
        </p>
      </div>
    </div>
  );
}
