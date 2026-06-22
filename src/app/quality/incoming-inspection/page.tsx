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
  Paging,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { ClipboardCheck, AlertTriangle, FlaskConical, Clock } from 'lucide-react';
import { BackButton } from '@/components/shared/BackButton';
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
  lineStatus: string;
  qcResult: 'pending' | 'passed' | 'failed';
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
  const tq = useTranslations('quality');

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
      <BackButton href="/quality" label={tq('incomingInspection.backLabel')} />
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div className="text-xs uppercase text-gray-500">{t('tiles.pendingChecklist')}</div>
          <div className="text-3xl font-bold text-gray-900 mt-1" data-testid="tile-pending-checklist">{counts?.pendingChecklistCount ?? 0}</div>
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-cyan-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div className="text-xs uppercase text-gray-500">{t('tiles.pendingQa')}</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{counts?.pendingQaCount ?? 0}</div>
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-emerald-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div className="text-xs uppercase text-gray-500">{t('tiles.passed')}</div>
          <div className="text-3xl font-bold text-gray-900 mt-1" data-testid="tile-passed">{counts?.passedCount ?? 0}</div>
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-rose-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div className="text-xs uppercase text-gray-500">{t('tiles.rejected')}</div>
          <div className="text-3xl font-bold text-gray-900 mt-1" data-testid="tile-rejected">{counts?.rejectedCount ?? 0}</div>
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-amber-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div className="text-xs uppercase text-gray-500">{t('tiles.staleQc')}</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{counts?.staleQcSampleCount ?? 0}</div>
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-teal-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div className="text-xs uppercase text-gray-500">{t('tiles.releasedToday')}</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{counts?.releasedTodayCount ?? 0}</div>
        </div>
      </div>

      {/* Aging bands */}
      {aging && aging.bands.length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> {tq('incomingInspection.agingDistribution')}
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
          <Column dataField="itemCode" caption={tq('incomingInspection.columns.itemCode')} width={120} />
          <Column dataField="itemName" caption={t('table.columns.item')} />
          <Column dataField="vendorName" caption={t('table.columns.vendor')} />
          <Column dataField="actualQuantity" caption={t('table.columns.actualQty')} dataType="number" width={120} />
          <Column dataField="unit" caption={tq('incomingInspection.columns.unit')} width={80} />
          <Column
            dataField="qcResult"
            caption={t('table.columns.result')}
            width={120}
            cellRender={(c) => {
              const r = c.value as 'pending' | 'passed' | 'failed';
              const cls =
                r === 'passed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : r === 'failed'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800';
              return (
                <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${cls}`} data-testid={`qc-result-${c.data.lineId}`}>
                  {t(`result.${r}`)}
                </span>
              );
            }}
          />
          <Column dataField="qcSampleStatus" caption={t('table.columns.qcStatus')} width={120} />
          <Column dataField="ageDays" caption={t('table.columns.ageDays')} width={100} />
        </DataGrid>
      </div>

      {/* Quarantine items table */}
      {aging && aging.items.length > 0 && (
        <div className="bg-white border rounded-lg">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {tq('incomingInspection.quarantineLots')}
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
            <Paging pageSize={20} />
            <Column dataField="lotNumber" caption={tq('incomingInspection.columns.lot')} />
            <Column dataField="itemCode" caption={tq('incomingInspection.columns.itemCodeFull')} />
            <Column dataField="itemName" caption={tq('incomingInspection.columns.itemName')} />
            <Column dataField="quantity" caption={tq('incomingInspection.columns.quantity')} dataType="number" width={100} />
            <Column dataField="unit" caption={tq('incomingInspection.columns.unit')} width={80} />
            <Column dataField="warehouseName" caption={tq('incomingInspection.columns.warehouse')} width={150} />
            <Column dataField="grnNumber" caption="GRN" />
            <Column dataField="ageDays" caption={t('table.columns.ageDays')} width={100} />
          </DataGrid>
        </div>
      )}
    </div>
  );
}
