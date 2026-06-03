'use client';

/**
 * Goods Receipt — list / dashboard
 * Feature: 020-goods-receipt
 */
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  DataGrid,
  Column,
  FilterRow,
  Paging,
  HeaderFilter,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { ClipboardCheck, Plus, AlertTriangle, CheckCircle2, Hourglass, FlaskConical } from 'lucide-react';
import type { IncomingDashboardCounts } from '@/types/goods-receipt';

interface GrnListItem {
  id: number;
  grnNumber: string;
  sourceType: 'po' | 'wo';
  status: string;
  receivedDate: string;
  vendorId: number | null;
  vendorName: string | null;
  lineCount: number;
}

export default function GoodsReceiptListPage() {
  const t = useTranslations('goodsReceipt');
  const router = useRouter();

  const { data: counts } = useQuery<IncomingDashboardCounts>({
    queryKey: ['grn-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/quality/incoming-inspection/dashboard');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data, refetch } = useQuery<{ items: GrnListItem[]; total: number }>({
    queryKey: ['grn-list'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/goods-receipts?pageSize=100');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const tiles = [
    {
      label: t('tiles.pendingChecklist'),
      value: counts?.pendingChecklistCount ?? 0,
      icon: <Hourglass className="w-5 h-5" />,
      cls: 'bg-amber-50 border-amber-200 text-amber-900',
    },
    {
      label: t('tiles.pendingQa'),
      value: counts?.pendingQaCount ?? 0,
      icon: <FlaskConical className="w-5 h-5" />,
      cls: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    },
    {
      label: t('tiles.releasedToday'),
      value: counts?.releasedTodayCount ?? 0,
      icon: <CheckCircle2 className="w-5 h-5" />,
      cls: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    },
    {
      label: t('tiles.quarantineAging'),
      value: counts?.quarantineAgingCount ?? 0,
      icon: <AlertTriangle className="w-5 h-5" />,
      cls: 'bg-rose-50 border-rose-200 text-rose-900',
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6" />
            {t('page.title')}
          </h1>
          <p className="text-gray-600 text-sm mt-1">{t('page.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button text={t('actions.refresh')} onClick={() => refetch()} />
          <Button
            type="default"
            stylingMode="contained"
            onClick={() => router.push('/inventory/goods-receipt/new')}
            render={() => (
              <span className="inline-flex items-center gap-1">
                <Plus className="w-4 h-4" />
                {t('actions.create')}
              </span>
            )}
          />
        </div>
      </header>

      {/* Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={`border rounded-lg p-4 flex items-center justify-between ${tile.cls}`}
          >
            <div>
              <div className="text-xs uppercase tracking-wide opacity-70">{tile.label}</div>
              <div className="text-3xl font-bold mt-1">{tile.value}</div>
            </div>
            <div className="opacity-60">{tile.icon}</div>
          </div>
        ))}
      </div>

      {/* List */}
      <DataGrid
        dataSource={data?.items ?? []}
        keyExpr="id"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
        onRowClick={(e) => router.push(`/inventory/goods-receipt/${e.key}`)}
        data-testid="grn-list-grid"
      >
        <FilterRow visible />
        <HeaderFilter visible />
        <Paging pageSize={20} />
        <Column dataField="grnNumber" caption={t('table.columns.grnNumber')} width={150} />
        <Column
          dataField="sourceType"
          caption={t('table.columns.sourceType')}
          width={120}
          cellRender={(c) => t(`sourceType.${c.value as 'po' | 'wo'}`)}
        />
        <Column
          dataField="vendorName"
          caption={t('table.columns.vendor')}
          calculateCellValue={(row: GrnListItem) =>
            row.sourceType === 'po' ? row.vendorName ?? '-' : 'WO'
          }
        />
        <Column dataField="receivedDate" caption={t('table.columns.receivedDate')} width={140} dataType="date" />
        <Column dataField="lineCount" caption={t('table.columns.lineCount')} width={100} />
        <Column
          dataField="status"
          caption={t('table.columns.status')}
          width={150}
          cellRender={(c) => (
            <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-gray-100">
              {t(`status.header.${c.value as string}`)}
            </span>
          )}
        />
      </DataGrid>
    </div>
  );
}
