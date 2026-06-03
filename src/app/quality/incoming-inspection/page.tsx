'use client';

/**
 * Incoming Inspection — QC perspective dashboard
 * Feature: 020-goods-receipt
 */
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  DataGrid,
  Column,
  FilterRow,
  Paging,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { ClipboardCheck, AlertTriangle, FlaskConical, Clock } from 'lucide-react';
import type { IncomingDashboardCounts } from '@/types/goods-receipt';

interface PendingQaItem {
  grnId: number;
  grnNumber: string;
  lineId: number;
  itemCode: string;
  itemName: string;
  actualQuantity: number;
  unit: string;
  qcSampleId: number | null;
  qcSampleStatus: string | null;
  ageDays: number;
  vendorName: string | null;
}

interface QuarantineAging {
  bands: Array<{ label: string; minDays: number; maxDays: number | null; count: number }>;
  items: Array<{
    lotId: number;
    lotNumber: string;
    itemCode: string;
    itemName: string;
    quantity: number;
    unit: string;
    ageDays: number;
    grnNumber: string | null;
    warehouseName: string;
    receivedDate: string;
  }>;
}

export default function IncomingInspectionPage() {
  const t = useTranslations('goodsReceipt');

  const { data: counts } = useQuery<IncomingDashboardCounts>({
    queryKey: ['grn-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/quality/incoming-inspection/dashboard');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: pending, refetch: refetchPending } = useQuery<{ items: PendingQaItem[]; total: number }>({
    queryKey: ['pending-qa'],
    queryFn: async () => {
      const res = await fetch('/api/quality/incoming-inspection/pending-qa');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const { data: aging } = useQuery<QuarantineAging>({
    queryKey: ['quarantine-aging'],
    queryFn: async () => {
      const res = await fetch('/api/quality/incoming-inspection/quarantine-aging');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical className="w-6 h-6" />
            {t('page.incomingInspection')}
          </h1>
        </div>
        <Button text={t('actions.refresh')} onClick={() => refetchPending()} />
      </header>

      {/* Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <div className="text-xs uppercase opacity-70 text-indigo-900">{t('tiles.pendingQa')}</div>
          <div className="text-3xl font-bold text-indigo-900 mt-1">{counts?.pendingQaCount ?? 0}</div>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
          <div className="text-xs uppercase opacity-70 text-rose-900">{t('tiles.quarantineAging')}</div>
          <div className="text-3xl font-bold text-rose-900 mt-1">{counts?.quarantineAgingCount ?? 0}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="text-xs uppercase opacity-70 text-amber-900">{t('tiles.staleQc')}</div>
          <div className="text-3xl font-bold text-amber-900 mt-1">{counts?.staleQcSampleCount ?? 0}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="text-xs uppercase opacity-70 text-emerald-900">{t('tiles.releasedToday')}</div>
          <div className="text-3xl font-bold text-emerald-900 mt-1">{counts?.releasedTodayCount ?? 0}</div>
        </div>
      </div>

      {/* Aging bands */}
      {aging && aging.bands.length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Quarantine Aging Distribution
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {aging.bands.map((b) => (
              <div key={b.label} className="border rounded p-3">
                <div className="text-xs opacity-70">{b.label}</div>
                <div className="text-2xl font-bold mt-1">{b.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending QA list */}
      <div className="bg-white border rounded-lg">
        <div className="p-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" />
            {t('tiles.pendingQa')} ({pending?.total ?? 0})
          </h2>
        </div>
        <DataGrid
          dataSource={pending?.items ?? []}
          keyExpr="lineId"
          showBorders
          showRowLines
          rowAlternationEnabled
          columnAutoWidth
          data-testid="pending-qa-grid"
        >
          <FilterRow visible />
          <Paging pageSize={20} />
          <Column
            dataField="grnNumber"
            caption={t('table.columns.grnNumber')}
            cellRender={(c) => (
              <Link
                href={`/inventory/goods-receipt/${c.data.grnId}`}
                className="text-blue-600 hover:underline"
              >
                {c.value}
              </Link>
            )}
          />
          <Column dataField="itemCode" caption="Code" width={120} />
          <Column dataField="itemName" caption={t('table.columns.item')} />
          <Column dataField="vendorName" caption={t('table.columns.vendor')} />
          <Column dataField="actualQuantity" caption={t('table.columns.actualQty')} dataType="number" width={120} />
          <Column dataField="unit" caption="Unit" width={80} />
          <Column dataField="qcSampleStatus" caption={t('table.columns.qcStatus')} width={120} />
          <Column dataField="ageDays" caption={t('table.columns.ageDays')} width={100} />
        </DataGrid>
      </div>

      {/* Quarantine items table */}
      {aging && aging.items.length > 0 && (
        <div className="bg-white border rounded-lg">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Quarantine Lots
            </h2>
          </div>
          <DataGrid
            dataSource={aging.items}
            keyExpr="lotId"
            showBorders
            showRowLines
            rowAlternationEnabled
            columnAutoWidth
          >
            <FilterRow visible />
            <Paging pageSize={20} />
            <Column dataField="lotNumber" caption="Lot" />
            <Column dataField="itemCode" caption="Item Code" />
            <Column dataField="itemName" caption="Item Name" />
            <Column dataField="quantity" caption="Qty" dataType="number" width={100} />
            <Column dataField="unit" caption="Unit" width={80} />
            <Column dataField="warehouseName" caption="Warehouse" width={150} />
            <Column dataField="grnNumber" caption="GRN" />
            <Column dataField="ageDays" caption={t('table.columns.ageDays')} width={100} />
          </DataGrid>
        </div>
      )}
    </div>
  );
}
