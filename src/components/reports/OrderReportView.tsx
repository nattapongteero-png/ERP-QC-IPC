'use client';

/**
 * Shared view for the Purchasing and Sales reports.
 *
 * Both reports answer the same questions over the same shape (summary,
 * by-status, by-party, by-month, rows), so they share one component. What
 * differs is only the labels, the party column, and the detail columns — passed
 * in by the page rather than forked into two near-identical files.
 */

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import * as XLSX from 'xlsx';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { formatNumber, formatBaht } from '@/lib/utils/number-format';
import { cn } from '@/lib/utils/cn';
import { FileText, ShoppingCart, Coins, Users, Ban } from 'lucide-react';

export interface StatusBucket { status: string; count: number; value: number }
export interface PartyBucket { name: string; code: string | null; orders: number; value: number }
export interface MonthBucket { month: string; orders: number; value: number }
export interface ReportSummary {
  orders: number;
  value: number;
  avgOrderValue: number | null;
  voidedOrders: number;
  voidedValue: number;
  parties: number;
}
export interface OrderReport<Row> {
  summary: ReportSummary;
  byStatus: StatusBucket[];
  byParty: PartyBucket[];
  byMonth: MonthBucket[];
  rows: Row[];
  generatedAt: string;
}

interface Props<Row extends Record<string, unknown>> {
  /** Page title / subtitle already translated by the caller. */
  title: string;
  subtitle: string;
  data: OrderReport<Row> | null;
  isLoading: boolean;
  dateFrom: string;
  dateTo: string;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  onRefresh: () => void;
  /** Grid columns for the detail rows. */
  columns: DxDataGridColumn[];
  /** Heading for the by-vendor / by-customer table. */
  partyLabel: string;
  /** Maps a detail row to a flat object for the xlsx sheet. */
  exportRow: (row: Row) => Record<string, string | number>;
  /** Filename stem, e.g. 'purchase-report'. */
  exportName: string;
  /** Translates a status code to a display label. */
  statusLabel: (status: string) => string;
}

export function OrderReportView<Row extends Record<string, unknown>>({
  title,
  subtitle,
  data,
  isLoading,
  dateFrom,
  dateTo,
  onDateFrom,
  onDateTo,
  onRefresh,
  columns,
  partyLabel,
  exportRow,
  exportName,
  statusLabel,
}: Props<Row>) {
  const t = useTranslations('reports.orderReport');

  const maxPartyValue = useMemo(
    () => Math.max(1, ...(data?.byParty ?? []).map((p) => p.value)),
    [data],
  );
  const maxMonthValue = useMemo(
    () => Math.max(1, ...(data?.byMonth ?? []).map((m) => m.value)),
    [data],
  );

  /**
   * Four sheets: what the operator sees on screen, each on its own tab, so the
   * file is the report rather than a bare row dump.
   */
  const handleExport = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();

    const summary = [
      { รายการ: t('kpi.orders'), ค่า: data.summary.orders },
      { รายการ: t('kpi.value'), ค่า: data.summary.value },
      {
        รายการ: t('kpi.avg'),
        ค่า: data.summary.avgOrderValue ?? '-',
      },
      { รายการ: t('kpi.parties'), ค่า: data.summary.parties },
      { รายการ: t('kpi.voided'), ค่า: data.summary.voidedOrders },
      { รายการ: t('export.voidedValue'), ค่า: data.summary.voidedValue },
      { รายการ: t('export.dateFrom'), ค่า: dateFrom || '-' },
      { รายการ: t('export.dateTo'), ค่า: dateTo || '-' },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summary);
    wsSummary['!cols'] = [{ wch: 28 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, t('export.sheetSummary'));

    const wsStatus = XLSX.utils.json_to_sheet(
      data.byStatus.map((s) => ({
        [t('table.status')]: statusLabel(s.status),
        [t('table.orders')]: s.count,
        [t('table.value')]: s.value,
      })),
    );
    wsStatus['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsStatus, t('export.sheetStatus'));

    const wsParty = XLSX.utils.json_to_sheet(
      data.byParty.map((p) => ({
        [partyLabel]: p.name,
        [t('table.code')]: p.code ?? '',
        [t('table.orders')]: p.orders,
        [t('table.value')]: p.value,
      })),
    );
    wsParty['!cols'] = [{ wch: 34 }, { wch: 14 }, { wch: 12 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsParty, t('export.sheetParty'));

    const wsRows = XLSX.utils.json_to_sheet(data.rows.map(exportRow));
    XLSX.utils.book_append_sheet(wb, wsRows, t('export.sheetDetail'));

    const ts = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${exportName}-${ts}.xlsx`);
  };

  const s = data?.summary;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
      <ResponsivePageHeader
        title={title}
        subtitle={subtitle}
        icon={FileText}
        iconBgColor="bg-violet-100"
        iconColor="text-violet-600"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              text={t('actions.refresh')}
              stylingMode="outlined"
              onClick={onRefresh}
            />
            <DxButton
              icon="xlsxfile"
              text={t('actions.export')}
              stylingMode="outlined"
              onClick={handleExport}
              disabled={!data || data.rows.length === 0}
              elementAttr={{ 'data-testid': 'btn-export-report' }}
            />
          </div>
        }
      />

      {/* Date range */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">{t('filter.from')}</label>
            <DxDateBox
              value={dateFrom || undefined}
              onValueChange={(v: unknown) =>
                onDateFrom(v ? String(v).slice(0, 10) : '')
              }
              displayFormat="yyyy-MM-dd"
              width={170}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">{t('filter.to')}</label>
            <DxDateBox
              value={dateTo || undefined}
              onValueChange={(v: unknown) =>
                onDateTo(v ? String(v).slice(0, 10) : '')
              }
              displayFormat="yyyy-MM-dd"
              width={170}
            />
          </div>
          {(dateFrom || dateTo) && (
            <DxButton
              text={t('filter.clear')}
              stylingMode="text"
              onClick={() => {
                onDateFrom('');
                onDateTo('');
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('kpi.orders')}
          value={formatNumber(s?.orders ?? 0)}
          icon={ShoppingCart}
          tone="blue"
          isLoading={isLoading}
        />
        <StatCard
          label={t('kpi.value')}
          value={formatBaht(s?.value ?? 0)}
          icon={Coins}
          tone="emerald"
          isLoading={isLoading}
        />
        <StatCard
          label={t('kpi.avg')}
          // Null means "no orders to average" — show a dash, never a fake ฿0.
          value={s?.avgOrderValue === null || s?.avgOrderValue === undefined
            ? '-'
            : formatBaht(s.avgOrderValue)}
          icon={FileText}
          tone="violet"
          isLoading={isLoading}
        />
        <StatCard
          label={t('kpi.parties')}
          value={formatNumber(s?.parties ?? 0)}
          icon={Users}
          tone="amber"
          isLoading={isLoading}
        />
      </div>

      {/* Voided notice — shown only when there is something to disclose, so the
          totals above can never be mistaken for including cancelled orders. */}
      {s && s.voidedOrders > 0 && (
        <div
          className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          data-testid="report-voided-note"
        >
          <Ban className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {t('voidedNote', {
              count: formatNumber(s.voidedOrders),
              value: formatBaht(s.voidedValue),
            })}
          </span>
        </div>
      )}

      {/* By status + by party */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-bold">{t('section.byStatus')}</h3>
            {!data || data.byStatus.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">{t('empty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                      <th className="py-2 text-left font-semibold">{t('table.status')}</th>
                      <th className="py-2 text-right font-semibold">{t('table.orders')}</th>
                      <th className="py-2 text-right font-semibold">{t('table.value')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byStatus.map((b) => (
                      <tr key={b.status} className="border-b border-gray-100 last:border-0">
                        <td className="py-2">{statusLabel(b.status)}</td>
                        <td className="py-2 text-right tabular-nums">{formatNumber(b.count)}</td>
                        <td className="py-2 text-right tabular-nums">{formatBaht(b.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-bold">{partyLabel}</h3>
            {!data || data.byParty.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">{t('empty')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.byParty.slice(0, 8).map((p) => (
                  <div key={p.code || p.name} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate" title={p.name}>{p.name}</span>
                      <span className="shrink-0 tabular-nums font-medium">{formatBaht(p.value)}</span>
                    </div>
                    <div className="h-1.5 rounded bg-gray-100">
                      <div
                        className="h-full rounded bg-violet-500"
                        style={{ width: `${Math.max(2, (p.value / maxPartyValue) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* By month */}
      {data && data.byMonth.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-bold">{t('section.byMonth')}</h3>
            <div className="flex items-end gap-2 overflow-x-auto pb-1" style={{ minHeight: 120 }}>
              {data.byMonth.map((m) => (
                <div key={m.month} className="flex min-w-[54px] flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] tabular-nums text-gray-500">
                    {formatNumber(Math.round(m.value / 1000))}k
                  </span>
                  <div
                    className={cn('w-full rounded-t bg-violet-500')}
                    style={{ height: `${Math.max(4, (m.value / maxMonthValue) * 80)}px` }}
                    title={formatBaht(m.value)}
                  />
                  <span className="text-[10px] text-gray-500">{m.month.slice(5)}/{m.month.slice(2, 4)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail rows */}
      <Card>
        <CardContent className="p-0">
          <DxDataGrid
            dataSource={(data?.rows ?? []) as Record<string, unknown>[]}
            columns={columns}
            keyExpr="id"
            pageSize={20}
            sorting
            responsiveColumns
            noDataText={t('empty')}
          />
        </CardContent>
      </Card>
    </div>
  );
}
