'use client';

/**
 * Goods Receipt — New GRN
 * Feature: 020-goods-receipt
 */
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { SelectBox } from 'devextreme-react/select-box';
import { DateBox } from 'devextreme-react/date-box';
import { TextArea } from 'devextreme-react/text-area';
import { RadioGroup } from 'devextreme-react/radio-group';
import { Button } from 'devextreme-react/button';
import { Plus, ArrowLeft } from 'lucide-react';
import type { GrnSourceType } from '@/types/goods-receipt';

interface POOption {
  id: number;
  poNumber: string;
  vendorName?: string;
  status?: string;
}
interface WOOption {
  id: number;
  woNumber?: string;
  workOrderNumber?: string;
  productName?: string;
  status?: string;
}
interface WarehouseOption {
  id: number;
  name: string;
  code?: string;
  type?: string;
}

export default function NewGrnPage() {
  const t = useTranslations('goodsReceipt');
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sourceType, setSourceType] = useState<GrnSourceType>(() => {
    if (searchParams.get('woId')) return 'wo';
    return 'po';
  });
  const [poId, setPoId] = useState<number | null>(
    searchParams.get('poId') ? Number(searchParams.get('poId')) : null,
  );
  const [woId, setWoId] = useState<number | null>(
    searchParams.get('woId') ? Number(searchParams.get('woId')) : null,
  );
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [receivedDate, setReceivedDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState('');

  // Load options
  // All three list APIs in this project wrap responses as
  // { success, data: { items, total, ... }, message } via the shared
  // createPaginatedResponse helper. The earlier extractor only checked
  // j.items / j.orders / j.workOrders, missing the j.data.items path
  // and leaving every dropdown empty. unwrapList handles the wrapped
  // shape AND a handful of legacy shapes so this won't silently break
  // if a single endpoint deviates.
  const unwrapList = (j: any): any[] => {
    if (Array.isArray(j)) return j;
    if (Array.isArray(j?.data)) return j.data;
    if (Array.isArray(j?.data?.items)) return j.data.items;
    if (Array.isArray(j?.data?.orders)) return j.data.orders;
    if (Array.isArray(j?.data?.workOrders)) return j.data.workOrders;
    if (Array.isArray(j?.items)) return j.items;
    if (Array.isArray(j?.orders)) return j.orders;
    if (Array.isArray(j?.workOrders)) return j.workOrders;
    return [];
  };

  const { data: pos } = useQuery<POOption[]>({
    queryKey: ['po-list-for-grn'],
    queryFn: async () => {
      const res = await fetch('/api/purchasing/orders?status=approved&pageSize=200');
      if (!res.ok) return [];
      return unwrapList(await res.json());
    },
  });

  const { data: wos } = useQuery<WOOption[]>({
    queryKey: ['wo-list-for-grn'],
    queryFn: async () => {
      const res = await fetch('/api/production/work-orders?pageSize=200');
      if (!res.ok) return [];
      return unwrapList(await res.json());
    },
  });

  const { data: warehouses } = useQuery<WarehouseOption[]>({
    queryKey: ['warehouses-for-grn'],
    queryFn: async () => {
      // Endpoint is /api/warehouses (no /inventory prefix); the previous
      // path 404'd and the catch silently returned [] so the dropdown
      // stayed empty.
      const res = await fetch('/api/warehouses?pageSize=200');
      if (!res.ok) return [];
      return unwrapList(await res.json());
    },
  });

  // Existing GRNs — so we can hide PO/WO that already have an active
  // (non-cancelled) GRN against them. Cancelled GRNs are excluded so a
  // PO whose only GRN was cancelled reappears in the dropdown.
  const { data: existingGrns } = useQuery<Array<{ sourceType: 'po' | 'wo'; poId: number | null; woId: number | null; status: string }>>({
    queryKey: ['existing-grns-for-filter'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/goods-receipts?pageSize=500');
      if (!res.ok) return [];
      const list = unwrapList(await res.json());
      return list.map((g: any) => ({
        sourceType: g.sourceType,
        poId: g.poId ?? null,
        woId: g.woId ?? null,
        status: g.status,
      }));
    },
  });

  // POs / WOs that are already consumed by an active GRN — used to
  // filter them out of the source dropdowns below.
  const usedPoIds = new Set<number>(
    (existingGrns ?? [])
      .filter((g) => g.sourceType === 'po' && g.status !== 'cancelled' && g.poId)
      .map((g) => g.poId as number),
  );
  const usedWoIds = new Set<number>(
    (existingGrns ?? [])
      .filter((g) => g.sourceType === 'wo' && g.status !== 'cancelled' && g.woId)
      .map((g) => g.woId as number),
  );
  const availablePos = (pos ?? []).filter((p) => !usedPoIds.has(p.id));
  const availableWos = (wos ?? []).filter((w) => !usedWoIds.has(w.id));

  // Pick default quarantine warehouse if available
  useEffect(() => {
    if (warehouses && warehouses.length > 0 && warehouseId == null) {
      const qWh = warehouses.find((w) => (w.type ?? '').toLowerCase() === 'quarantine') ?? warehouses[0];
      if (qWh) setWarehouseId(qWh.id);
    }
  }, [warehouses, warehouseId]);

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/inventory/goods-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType,
          poId: sourceType === 'po' ? poId : null,
          woId: sourceType === 'wo' ? woId : null,
          warehouseId,
          // Local-timezone YYYY-MM-DD. Do NOT use toISOString() — it is UTC,
          // so an evening pick in ICT can roll back to the previous day.
          receivedDate: `${receivedDate.getFullYear()}-${String(receivedDate.getMonth() + 1).padStart(2, '0')}-${String(receivedDate.getDate()).padStart(2, '0')}`,
          notes: notes || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Create failed');
      return body;
    },
    onSuccess: (result) => {
      const grnId = result?.grn?.id;
      if (grnId) router.push(`/inventory/goods-receipt/${grnId}`);
    },
  });

  const canSubmit = !!warehouseId && ((sourceType === 'po' && !!poId) || (sourceType === 'wo' && !!woId));

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <header className="flex items-center gap-3 mb-4">
        <Button icon="back" onClick={() => router.back()} stylingMode="text" />
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Plus className="w-6 h-6" />
          {t('page.new')}
        </h1>
      </header>

      <div className="bg-white border rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">{t('form.sourceType.label')}</label>
          <RadioGroup
            items={[
              { value: 'po', label: t('sourceType.po') },
              { value: 'wo', label: t('sourceType.wo') },
            ]}
            valueExpr="value"
            displayExpr="label"
            value={sourceType}
            onValueChanged={(e) => setSourceType(e.value as GrnSourceType)}
            layout="horizontal"
          />
        </div>

        {sourceType === 'po' && (
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.po.label')}</label>
            <SelectBox
              dataSource={availablePos}
              displayExpr={(item: POOption) =>
                item ? `${item.poNumber}${item.vendorName ? ' — ' + item.vendorName : ''}` : ''
              }
              valueExpr="id"
              value={poId}
              searchEnabled
              onValueChanged={(e) => setPoId(e.value as number | null)}
              noDataText="ไม่มีใบสั่งซื้อรอรับ (ทุกใบมี GRN แล้ว)"
            />
          </div>
        )}

        {sourceType === 'wo' && (
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.wo.label')}</label>
            <SelectBox
              dataSource={availableWos}
              displayExpr={(item: WOOption) => {
                if (!item) return '';
                const n = item.woNumber ?? item.workOrderNumber ?? `WO-${item.id}`;
                return `${n}${item.productName ? ' — ' + item.productName : ''}`;
              }}
              valueExpr="id"
              value={woId}
              searchEnabled
              onValueChanged={(e) => setWoId(e.value as number | null)}
              noDataText="ไม่มีใบสั่งผลิตรอรับ (ทุกใบมี GRN แล้ว)"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">{t('form.warehouse.label')}</label>
          <SelectBox
            dataSource={warehouses ?? []}
            displayExpr={(w: WarehouseOption) => (w ? `${w.code ?? ''} ${w.name}` : '')}
            valueExpr="id"
            value={warehouseId}
            onValueChanged={(e) => setWarehouseId(e.value as number | null)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('form.receivedDate.label')}</label>
          <DateBox
            value={receivedDate}
            onValueChanged={(e) => e.value && setReceivedDate(new Date(e.value as Date))}
            type="date"
            displayFormat="yyyy-MM-dd"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('form.notes.label')}</label>
          <TextArea
            value={notes}
            height={120}
            onValueChanged={(e) => setNotes(String(e.value ?? ''))}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button text={t('actions.cancel')} stylingMode="text" onClick={() => router.back()} />
          <Button
            type="default"
            stylingMode="contained"
            text={t('actions.create')}
            onClick={() => createMut.mutate()}
            disabled={!canSubmit || createMut.isPending}
          />
        </div>

        {createMut.error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded p-3 text-sm">
            {String((createMut.error as Error).message)}
          </div>
        )}
      </div>
    </div>
  );
}

