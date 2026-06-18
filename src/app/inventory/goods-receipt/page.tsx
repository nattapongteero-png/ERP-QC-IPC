'use client';

/**
 * Goods Receipt — list / dashboard
 * Feature: 020-goods-receipt
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  DxDataGrid,
  DxColumn,
  DxFilterRow,
  DxPaging,
  DxHeaderFilter,
} from '@/components/ui/dx-data-grid';
import { Button } from 'devextreme-react/button';
import { Popup } from 'devextreme-react/popup';
import { TextArea } from 'devextreme-react/text-area';
import { ClipboardCheck, Plus, AlertTriangle, CheckCircle2, Hourglass, FlaskConical } from 'lucide-react';
import { BackButton } from '@/components/shared/BackButton';
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
  canCancel: boolean;
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

  const qc = useQueryClient();

  const { data, refetch } = useQuery<{ items: GrnListItem[]; total: number }>({
    queryKey: ['grn-list'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/goods-receipts?pageSize=100');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  // Cancel a GRN straight from the register (so a cancelled PO/WO can be
  // re-selected via "+ สร้าง GRN"). Backend enforces creator + 24h window +
  // all-lines-still-created; the list `canCancel` flag hides obviously-invalid rows.
  const [cancelTarget, setCancelTarget] = useState<GrnListItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const cancelMut = useMutation({
    mutationFn: async () => {
      if (!cancelTarget) return;
      const res = await fetch(`/api/inventory/goods-receipts/${cancelTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'ยกเลิกใบรับของไม่สำเร็จ');
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grn-list'] });
      qc.invalidateQueries({ queryKey: ['grn-dashboard'] });
      setCancelTarget(null);
      setCancelReason('');
    },
  });

  // White card + left accent bar + coloured icon (matches the shared StatCard
  // style used system-wide). `accent` = left bar colour, `iconCls` = icon tint.
  const tiles = [
    {
      label: t('tiles.pendingChecklist'),
      value: counts?.pendingChecklistCount ?? 0,
      icon: <Hourglass className="w-5 h-5" />,
      accent: 'border-l-amber-500',
      iconCls: 'text-amber-500',
    },
    {
      label: t('tiles.pendingQa'),
      value: counts?.pendingQaCount ?? 0,
      icon: <FlaskConical className="w-5 h-5" />,
      accent: 'border-l-blue-500',
      iconCls: 'text-blue-500',
    },
    {
      label: t('tiles.releasedToday'),
      value: counts?.releasedTodayCount ?? 0,
      icon: <CheckCircle2 className="w-5 h-5" />,
      accent: 'border-l-emerald-500',
      iconCls: 'text-emerald-500',
    },
    {
      label: t('tiles.quarantineAging'),
      value: counts?.quarantineAgingCount ?? 0,
      icon: <AlertTriangle className="w-5 h-5" />,
      accent: 'border-l-rose-500',
      iconCls: 'text-rose-500',
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <BackButton href="/inventory" label="Inventory" />
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-[#064E3B]">
            <ClipboardCheck className="w-6 h-6" />
            {t('page.title')}
          </h1>
          <p className="text-[#4B7163] text-sm mt-1">{t('page.subtitle')}</p>
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
            className={`bg-white border border-gray-200 border-l-4 ${tile.accent} rounded-[14px] p-4 flex items-center justify-between shadow-[0_6px_20px_rgba(6,78,59,0.06)]`}
          >
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{tile.label}</div>
              <div className="text-3xl font-bold mt-1 text-gray-900">{tile.value}</div>
            </div>
            <div className={tile.iconCls}>{tile.icon}</div>
          </div>
        ))}
      </div>

      {/* List */}
      <DxDataGrid
        dataSource={data?.items ?? []}
        keyExpr="id"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
        onRowClick={(e) => router.push(`/inventory/goods-receipt/${e.key}`)}
        elementAttr={{ 'data-testid': 'grn-list-grid' }}
        paging={false}
      >
        <DxFilterRow visible={false} />
        <DxHeaderFilter visible={false} />
        <DxPaging defaultPageSize={20} />
        <DxColumn dataField="grnNumber" caption={t('table.columns.grnNumber')} width={150} />
        <DxColumn
          dataField="sourceType"
          caption={t('table.columns.sourceType')}
          width={160}
          cellRender={(c) => {
            const v = c.value as 'po' | 'wo';
            const cls =
              v === 'po'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200';
            return (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}
                title={t(`sourceType.${v}`)}
              >
                {t(`sourceTypeShort.${v}`)}
              </span>
            );
          }}
        />
        <DxColumn
          dataField="vendorName"
          caption={t('table.columns.vendor')}
          calculateCellValue={(row: GrnListItem) =>
            row.sourceType === 'po' ? row.vendorName ?? '-' : 'WO'
          }
        />
        <DxColumn dataField="receivedDate" caption={t('table.columns.receivedDate')} width={140} dataType="date" />
        <DxColumn dataField="lineCount" caption={t('table.columns.lineCount')} width={100} />
        <DxColumn
          dataField="status"
          caption={t('table.columns.status')}
          width={150}
          cellRender={(c) => (
            <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-gray-100">
              {t(`status.header.${c.value as string}`)}
            </span>
          )}
        />
        <DxColumn
          caption=""
          width={130}
          allowFiltering={false}
          allowSorting={false}
          cellRender={(c) => {
            const row = c.data as GrnListItem;
            if (!row.canCancel) return null;
            return (
              <Button
                text={t('actions.cancelGrn')}
                type="danger"
                stylingMode="outlined"
                icon="trash"
                width={120}
                onClick={(e) => {
                  // Stop the row-click navigation to the detail page.
                  (e.event as Event | undefined)?.stopPropagation?.();
                  setCancelTarget(row);
                }}
              />
            );
          }}
        />
      </DxDataGrid>

      {/* Cancel GRN popup */}
      <Popup
        visible={!!cancelTarget}
        onHiding={() => setCancelTarget(null)}
        dragEnabled={false}
        hideOnOutsideClick
        showTitle
        title={t('actions.cancelGrn')}
        width={460}
        height="auto"
        container=".dx-viewport"
      >
        {cancelTarget && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-800">{cancelTarget.grnNumber}</p>
            <p className="text-sm text-gray-600">{t('cancel.warning')}</p>
            <div>
              <label className="block text-sm font-medium mb-1">{t('cancel.reasonLabel')}</label>
              <TextArea
                value={cancelReason}
                onValueChanged={(e) => setCancelReason(e.value ?? '')}
                height={90}
                placeholder={t('cancel.reasonPlaceholder')}
              />
            </div>
            {cancelMut.isError && (
              <p className="text-sm text-red-600">{(cancelMut.error as Error)?.message}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button text={t('actions.cancel')} stylingMode="text" onClick={() => setCancelTarget(null)} />
              <Button
                text={t('actions.cancelGrn')}
                type="danger"
                stylingMode="contained"
                disabled={cancelReason.trim().length < 10 || cancelMut.isPending}
                onClick={() => cancelMut.mutate()}
              />
            </div>
          </div>
        )}
      </Popup>
    </div>
  );
}
