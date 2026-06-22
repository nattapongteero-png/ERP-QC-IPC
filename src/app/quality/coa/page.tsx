'use client';

/**
 * COA List Page (Phase 4)
 *
 * Lists all Certificate of Analysis documents with filters and KPI cards.
 * COA is generated from a released QC sample — operators get there from
 * /quality/qc-entry/[id] when sample.status === 'released'.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { Badge } from '@/components/ui/badge';
import {
  Award,
  CheckCircle2,
  Clock,
  Ban,
  Layers,
  AlertTriangle,
} from 'lucide-react';

interface CoaListRow {
  id: number;
  coaNumber: string;
  sampleId: number;
  productId: number;
  productCode: string | null;
  productName: string | null;
  lotNumber: string;
  customerId: number | null;
  customerName: string | null;
  issueDate: string;
  status: string;
  conclusion: string;
  createdAt: string;
}

type TFn = (key: string) => string;

function buildStatusOptions(t: TFn) {
  return [
    { value: '', label: t('coa.list.statusOptions.all') },
    { value: 'draft', label: t('coa.list.statusOptions.draft') },
    { value: 'review', label: t('coa.list.statusOptions.review') },
    { value: 'approved', label: t('coa.list.statusOptions.approved') },
    { value: 'issued', label: t('coa.list.statusOptions.issued') },
    { value: 'superseded', label: t('coa.list.statusOptions.superseded') },
    { value: 'revoked', label: t('coa.list.statusOptions.revoked') },
  ];
}

function formatDateTh(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(dateStr);
  }
}

function statusBadge(
  status: string,
  t: TFn,
): {
  variant: 'default' | 'success' | 'warning' | 'danger' | 'info';
  label: string;
} {
  switch (status) {
    case 'draft':
      return { variant: 'default', label: t('coa.list.status.draft') };
    case 'review':
      return { variant: 'warning', label: t('coa.list.status.review') };
    case 'approved':
      return { variant: 'info', label: t('coa.list.status.approved') };
    case 'issued':
      return { variant: 'success', label: t('coa.list.status.issued') };
    case 'superseded':
      return { variant: 'warning', label: t('coa.list.status.superseded') };
    case 'revoked':
      return { variant: 'danger', label: t('coa.list.status.revoked') };
    default:
      return { variant: 'default', label: status };
  }
}

function conclusionBadge(c: string, t: TFn) {
  if (c === 'complies')
    return <Badge variant="success">{t('coa.list.conclusion.complies')}</Badge>;
  if (c === 'does_not_comply')
    return <Badge variant="danger">{t('coa.list.conclusion.doesNotComply')}</Badge>;
  return <Badge variant="warning">{t('coa.list.conclusion.partial')}</Badge>;
}

export default function CoaListPage() {
  const router = useRouter();
  const t = useTranslations('quality');
  const [rows, setRows] = useState<CoaListRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const fetchCoa = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '200');
      if (statusFilter) params.set('status', statusFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await fetch(`/api/quality/coa?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRows(data.data?.items || []);
      } else {
        setRows([]);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchCoa();
  }, [fetchCoa]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.coaNumber?.toLowerCase().includes(q) ||
        r.lotNumber?.toLowerCase().includes(q) ||
        r.productName?.toLowerCase().includes(q) ||
        r.productCode?.toLowerCase().includes(q) ||
        r.customerName?.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const issuedToday = rows.filter(
      (r) => r.status === 'issued' && String(r.issueDate).slice(0, 10) === todayStr,
    ).length;
    const pendingReview = rows.filter(
      (r) => r.status === 'draft' || r.status === 'review',
    ).length;
    const superseded = rows.filter((r) => r.status === 'superseded').length;
    const revoked = rows.filter((r) => r.status === 'revoked').length;
    return { issuedToday, pendingReview, superseded, revoked };
  }, [rows]);

  const columns: DxDataGridColumn[] = [
    {
      caption: t('coa.list.columns.no'),
      width: 60,
      alignment: 'center',
      allowFiltering: false,
      allowSorting: false,
      cellRender: (cell) => (
        <span className="text-sm text-gray-500">{(cell.rowIndex ?? 0) + 1}</span>
      ),
    },
    {
      dataField: 'coaNumber',
      caption: 'COA #',
      width: 180,
      cellRender: (cell) => (
        <span className="font-mono font-semibold text-gray-900">{cell.data.coaNumber}</span>
      ),
    },
    {
      dataField: 'issueDate',
      caption: t('coa.list.columns.issueDate'),
      width: 130,
      cellRender: (cell) => (
        <span className="text-sm">{formatDateTh(cell.data.issueDate)}</span>
      ),
    },
    {
      dataField: 'productName',
      caption: t('coa.list.columns.product'),
      minWidth: 220,
      cellRender: (cell) => (
        <div>
          <p className="font-mono text-xs text-gray-500">{cell.data.productCode || '—'}</p>
          <p className="font-medium text-gray-900 truncate">{cell.data.productName || '—'}</p>
        </div>
      ),
    },
    {
      dataField: 'lotNumber',
      caption: t('coa.list.columns.lotNumber'),
      width: 140,
      cellRender: (cell) =>
        cell.data.lotNumber ? (
          <span className="font-mono text-sm">{cell.data.lotNumber}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      dataField: 'customerName',
      caption: t('coa.list.columns.customer'),
      minWidth: 160,
      hideOnMobile: true,
      cellRender: (cell) => (
        <span className="text-sm">{cell.data.customerName || '—'}</span>
      ),
    },
    {
      dataField: 'status',
      caption: t('coa.list.columns.status'),
      width: 130,
      cellRender: (cell) => {
        const s = statusBadge(cell.data.status, t);
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
    {
      dataField: 'conclusion',
      caption: t('coa.list.columns.conclusion'),
      width: 130,
      alignment: 'center',
      cellRender: (cell) => conclusionBadge(cell.data.conclusion, t),
    },
    {
      dataField: '_actions',
      caption: t('coa.list.columns.actions'),
      width: 110,
      alignment: 'center',
      allowFiltering: false,
      allowSorting: false,
      cellRender: (cell) => (
        <DxButton
          text={t('coa.list.actions.view')}
          stylingMode="outlined"
          type="default"
          onClick={() => router.push(`/quality/coa/${cell.data.id}`)}
        />
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
        <ResponsivePageHeader
          title="Certificate of Analysis"
          subtitle={t('coa.list.subtitle')}
          icon={Award}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-600"
          breadcrumbs={[
            { label: t('coa.list.breadcrumbQuality'), href: '/quality' },
            { label: 'COA' },
          ]}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <DxButton
                icon="refresh"
                text={t('coa.list.refresh')}
                stylingMode="outlined"
                onClick={fetchCoa}
              />
              <DxButton
                icon="preferences"
                text={t('coa.list.configureTemplates')}
                stylingMode="outlined"
                onClick={() => router.push('/quality/coa/templates')}
              />
              <DxButton
                icon="plus"
                text={t('coa.list.issueFromSample')}
                type="default"
                onClick={() => router.push('/quality/qc-entry?status=released')}
              />
            </div>
          }
        />

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            label={t('coa.list.kpi.issuedToday')}
            value={stats.issuedToday}
            icon={CheckCircle2}
            iconColor="text-emerald-500"
            accentColor="border-emerald-500"
          />
          <StatCard
            label={t('coa.list.kpi.pendingReview')}
            value={stats.pendingReview}
            icon={Clock}
            iconColor="text-amber-500"
            accentColor="border-amber-500"
          />
          <StatCard
            label={t('coa.list.kpi.superseded')}
            value={stats.superseded}
            icon={Layers}
            iconColor="text-orange-500"
            accentColor="border-orange-500"
          />
          <StatCard
            label={t('coa.list.kpi.revoked')}
            value={stats.revoked}
            icon={Ban}
            iconColor="text-red-500"
            accentColor="border-red-500"
          />
        </div>

        {/* Filter row */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 md:p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <DxTextBox
                placeholder={t('coa.list.searchPlaceholder')}
                value={search}
                onValueChange={setSearch}
                showClearButton
                mode="search"
              />
            </div>
            <DxSelectBox
              value={statusFilter}
              items={buildStatusOptions(t)}
              displayExpr="label"
              valueExpr="value"
              onValueChange={(v) => setStatusFilter(String(v ?? ''))}
              labelMode="hidden"
            />
            <div className="grid grid-cols-2 gap-2">
              <DxDateBox
                value={dateFrom}
                onValueChange={(v) => setDateFrom(v || '')}
                placeholder={t('coa.list.dateFrom')}
              />
              <DxDateBox
                value={dateTo}
                onValueChange={(v) => setDateTo(v || '')}
                placeholder={t('coa.list.dateTo')}
              />
            </div>
          </div>
        </div>

        {/* Data grid */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-gray-500">{t('coa.list.loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-emerald-500" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                {t('coa.list.empty.title')}
              </h3>
              <p className="text-sm text-gray-500 max-w-sm mb-4">
                {t('coa.list.empty.description')}
              </p>
              <DxButton
                icon="plus"
                text={t('coa.list.empty.viewReleased')}
                type="default"
                onClick={() => router.push('/quality/qc-entry?status=released')}
              />
            </div>
          ) : (
            <DxDataGrid
              dataSource={filtered}
              keyExpr="id"
              columns={columns}
              sorting
              pageSize={20}
              height="auto"
              noDataText={t('coa.list.noData')}
              onRowClick={(e) => {
                if (e?.data?.id) {
                  router.push(`/quality/coa/${e.data.id}`);
                }
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}
