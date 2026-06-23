'use client';

/**
 * Material Withdrawal — List Page (all requests, filterable)
 *
 * Feature: 018-material-withdrawal-approval
 */

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { DataGrid, Column, FilterRow, HeaderFilter, Paging } from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import { TextBox } from 'devextreme-react/text-box';
import { Layers, CheckCircle2, Clock, XCircle, Ban, PackageCheck } from 'lucide-react';
import { MaterialWithdrawalDetailDialog } from '@/components/production/material-withdrawal-detail-dialog';
import { MaterialWithdrawalApprovalActions } from '@/components/production/material-withdrawal-approval-actions';
import type {
  MaterialWithdrawalRequestSummary,
  WithdrawalStatus,
  PaginatedRequests,
} from '@/types/material-withdrawal';

const STATUS_OPTIONS: { value: WithdrawalStatus | ''; key: string }[] = [
  { value: '', key: 'all' },
  { value: 'pending', key: 'pending' },
  { value: 'approved', key: 'approved' },
  { value: 'released', key: 'released' },
  { value: 'rejected', key: 'rejected' },
  { value: 'cancelled', key: 'cancelled' },
];

export default function MaterialWithdrawalListPage() {
  const t = useTranslations('material-withdrawal');
  const searchParams = useSearchParams();
  // Allow deep-linking to a status view, e.g. /material-withdrawal?status=pending
  // (the old /pending route redirects here pre-filtered to the approval queue).
  const initialStatus = (searchParams.get('status') as WithdrawalStatus | null) ?? '';
  const [statusFilter, setStatusFilter] = useState<WithdrawalStatus | ''>(
    STATUS_OPTIONS.some((o) => o.value === initialStatus) ? initialStatus : '',
  );
  const [searchText, setSearchText] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useQuery<PaginatedRequests>({
    queryKey: ['material-withdrawal', 'list', { status: statusFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('pageSize', '100');
      const res = await fetch(`/api/material-withdrawal/requests?${params}`);
      if (!res.ok) throw new Error('Failed to load requests');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    const q = searchText.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      JSON.stringify(i).toLowerCase().includes(q)
    );
  }, [data, searchText]);

  const counts = useMemo(() => {
    const items = data?.items ?? [];
    return {
      total: data?.total ?? items.length,
      pending: items.filter((i) => i.status === 'pending').length,
      approved: items.filter((i) => i.status === 'approved').length,
      released: items.filter((i) => i.status === 'released').length,
      rejected: items.filter((i) => i.status === 'rejected').length,
    };
  }, [data]);

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="w-6 h-6" />
            {t('page.title')}
          </h1>
          <p className="text-[#4B7163] text-sm mt-1">{t('page.description')}</p>
        </div>
        <Button text={t('buttons.refresh')} onClick={() => refetch()} />
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          label={t('table.columns.id')}
          value={counts.total}
          icon={Layers}
          accent="border-l-blue-500"
          iconCls="text-blue-500"
        />
        <KpiCard
          label={t('status.pending')}
          value={counts.pending}
          icon={Clock}
          accent="border-l-amber-500"
          iconCls="text-amber-500"
        />
        <KpiCard
          label={t('status.approved')}
          value={counts.approved}
          icon={CheckCircle2}
          accent="border-l-blue-500"
          iconCls="text-blue-500"
        />
        <KpiCard
          label={t('status.released')}
          value={counts.released}
          icon={PackageCheck}
          accent="border-l-emerald-500"
          iconCls="text-emerald-500"
        />
        <KpiCard
          label={t('status.rejected')}
          value={counts.rejected}
          icon={XCircle}
          accent="border-l-rose-500"
          iconCls="text-rose-500"
        />
      </div>

      {/* Filters — status + search on one compact top row */}
      <div className="flex flex-wrap items-center gap-3 rounded-[18px] border border-emerald-100 bg-white p-3 shadow-[0_6px_20px_rgba(6,78,59,0.07)]">
        <span className="text-sm font-medium text-[#064E3B]">{t('table.columns.status')}</span>
        <SelectBox
          dataSource={STATUS_OPTIONS.map((opt) => ({
            value: opt.value,
            label: opt.key === 'all' ? 'ทั้งหมด' : t(`status.${opt.key as WithdrawalStatus}`),
          }))}
          displayExpr="label"
          valueExpr="value"
          value={statusFilter}
          width={220}
          onValueChanged={(e) => setStatusFilter(e.value as WithdrawalStatus | '')}
        />
        <div className="ml-auto w-full sm:w-64">
          <TextBox
            value={searchText}
            onValueChanged={(e) => setSearchText((e.value as string) ?? '')}
            placeholder="ค้นหา..."
            mode="search"
            width="100%"
            // Stop the browser from offering email/password autofill on this
            // free-text register search (it mistook it for a login field).
            inputAttr={{
              autoComplete: 'off',
              name: 'withdrawal-search',
              'data-lpignore': 'true',
              'data-form-type': 'other',
            }}
          />
        </div>
      </div>

      {/* Grid */}
      <DataGrid
        dataSource={filteredItems}
        keyExpr="id"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
        noDataText={isLoading ? 'Loading...' : '—'}
        onRowClick={(e) => {
          const row = e.data as MaterialWithdrawalRequestSummary;
          setOpenId(row.id);
        }}
      >
        <FilterRow visible={false} />
        <HeaderFilter visible={false} />
        <Paging pageSize={20} />
        <Column dataField="id" caption={t('table.columns.id')} width={90} />
        <Column
          dataField="workOrderNumber"
          caption={t('table.columns.workOrder')}
          minWidth={200}
          cellRender={(c) => {
            const row = c.data as MaterialWithdrawalRequestSummary;
            return (
              <div className="leading-tight">
                <div className="font-medium text-gray-900">
                  {row.workOrderNumber ?? `WO-${row.workOrderId}`}
                </div>
                {(row.productName || row.productCode) && (
                  <div className="text-xs text-gray-500">
                    {row.productCode ? `${row.productCode} · ` : ''}{row.productName ?? ''}
                  </div>
                )}
              </div>
            );
          }}
        />
        <Column dataField="status" caption={t('table.columns.status')} width={130}
          cellRender={(c) => <StatusBadge status={c.value as WithdrawalStatus} />}
        />
        <Column dataField="reasonType" caption={t('table.columns.reason')}
          cellRender={(c) => <span>{t(`form.reason.options.${c.value as string}` as Parameters<typeof t>[0])}</span>}
        />
        <Column dataField="requestedBy.name" caption={t('table.columns.requestedBy')} />
        <Column dataField="requestedAt" caption={t('table.columns.requestedAt')} dataType="datetime" />
      </DataGrid>

      <MaterialWithdrawalDetailDialog
        visible={openId !== null}
        requestId={openId}
        onClose={() => setOpenId(null)}
        actions={(detail) =>
          detail.status === 'pending' ? (
            <MaterialWithdrawalApprovalActions
              request={detail}
              onApproved={() => {
                setOpenId(null);
                refetch();
              }}
              onRejected={() => {
                setOpenId(null);
                refetch();
              }}
            />
          ) : null
        }
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  iconCls,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  iconCls: string;
}) {
  // White card + tone-coloured left accent bar + coloured icon (matches StatCard).
  return (
    <div className={`rounded-[14px] border border-gray-200 border-l-4 ${accent} bg-white p-4 flex items-center justify-between gap-3 shadow-[0_6px_20px_rgba(6,78,59,0.06)]`}>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
      <span className={`inline-flex items-center justify-center w-10 h-10 ${iconCls}`}>
        <Icon className="w-5 h-5" />
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: WithdrawalStatus }) {
  const t = useTranslations('material-withdrawal');
  const classes: Record<WithdrawalStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-blue-100 text-blue-800',
    released: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-200 text-gray-700',
  };
  const Icon = (
    {
      pending: Clock,
      approved: CheckCircle2,
      released: PackageCheck,
      rejected: XCircle,
      cancelled: Ban,
    } as const
  )[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${classes[status]}`}>
      <Icon className="w-3 h-3" />
      {t(`status.${status}`)}
    </span>
  );
}
