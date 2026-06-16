'use client';

/**
 * Material Withdrawal — List Page (all requests, filterable)
 *
 * Feature: 018-material-withdrawal-approval
 */

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { DataGrid, Column, FilterRow, HeaderFilter, Paging, SearchPanel } from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import { Layers, CheckCircle2, Clock, XCircle, Ban } from 'lucide-react';
import { MaterialWithdrawalDetailDialog } from '@/components/production/material-withdrawal-detail-dialog';
import type {
  MaterialWithdrawalRequestSummary,
  WithdrawalStatus,
  PaginatedRequests,
} from '@/types/material-withdrawal';

const STATUS_OPTIONS: { value: WithdrawalStatus | ''; key: string }[] = [
  { value: '', key: 'all' },
  { value: 'pending', key: 'pending' },
  { value: 'approved', key: 'approved' },
  { value: 'rejected', key: 'rejected' },
  { value: 'cancelled', key: 'cancelled' },
];

export default function MaterialWithdrawalListPage() {
  const t = useTranslations('material-withdrawal');
  const [statusFilter, setStatusFilter] = useState<WithdrawalStatus | ''>('');
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

  const counts = useMemo(() => {
    const items = data?.items ?? [];
    return {
      total: data?.total ?? items.length,
      pending: items.filter((i) => i.status === 'pending').length,
      approved: items.filter((i) => i.status === 'approved').length,
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
      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label={t('table.columns.id')}
          value={counts.total}
          icon={Layers}
          color="bg-blue-100 text-blue-700"
        />
        <KpiCard
          label={t('status.pending')}
          value={counts.pending}
          icon={Clock}
          color="bg-amber-100 text-amber-700"
        />
        <KpiCard
          label={t('status.approved')}
          value={counts.approved}
          icon={CheckCircle2}
          color="bg-emerald-100 text-emerald-700"
        />
        <KpiCard
          label={t('status.rejected')}
          value={counts.rejected}
          icon={XCircle}
          color="bg-red-100 text-red-700"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 rounded-[18px] border border-emerald-100 bg-white p-3 shadow-[0_6px_20px_rgba(6,78,59,0.07)]">
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
      </div>

      {/* Grid */}
      <DataGrid
        dataSource={data?.items ?? []}
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
        <SearchPanel visible width={240} />
        <FilterRow visible={false} />
        <HeaderFilter visible={false} />
        <Paging pageSize={20} />
        <Column dataField="id" caption={t('table.columns.id')} width={100} />
        <Column dataField="workOrderId" caption={t('table.columns.workOrder')} width={130} />
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
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-[18px] border border-emerald-100 bg-white p-3 flex items-center gap-3 shadow-[0_6px_20px_rgba(6,78,59,0.07)]">
      <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${color}`}>
        <Icon className="w-5 h-5" />
      </span>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-[#4B7163]">{label}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: WithdrawalStatus }) {
  const t = useTranslations('material-withdrawal');
  const classes: Record<WithdrawalStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-200 text-gray-700',
  };
  const Icon = (
    {
      pending: Clock,
      approved: CheckCircle2,
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
