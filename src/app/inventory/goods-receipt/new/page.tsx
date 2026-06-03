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
  const { data: pos } = useQuery<POOption[]>({
    queryKey: ['po-list-for-grn'],
    queryFn: async () => {
      const res = await fetch('/api/purchasing/orders?status=approved&pageSize=200');
      if (!res.ok) return [];
      const j = await res.json();
      return Array.isArray(j) ? j : Array.isArray(j.items) ? j.items : Array.isArray(j.orders) ? j.orders : [];
    },
  });

  const { data: wos } = useQuery<WOOption[]>({
    queryKey: ['wo-list-for-grn'],
    queryFn: async () => {
      const res = await fetch('/api/production/work-orders?pageSize=200');
      if (!res.ok) return [];
      const j = await res.json();
      return Array.isArray(j) ? j : Array.isArray(j.items) ? j.items : Array.isArray(j.workOrders) ? j.workOrders : [];
    },
  });

  const { data: warehouses } = useQuery<WarehouseOption[]>({
    queryKey: ['warehouses-for-grn'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/warehouses');
      if (!res.ok) return [];
      const j = await res.json();
      return Array.isArray(j) ? j : Array.isArray(j.items) ? j.items : [];
    },
  });

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
          receivedDate: receivedDate.toISOString().slice(0, 10),
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
              dataSource={pos ?? []}
              displayExpr={(item: POOption) =>
                item ? `${item.poNumber}${item.vendorName ? ' — ' + item.vendorName : ''}` : ''
              }
              valueExpr="id"
              value={poId}
              searchEnabled
              onValueChanged={(e) => setPoId(e.value as number | null)}
            />
          </div>
        )}

        {sourceType === 'wo' && (
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.wo.label')}</label>
            <SelectBox
              dataSource={wos ?? []}
              displayExpr={(item: WOOption) => {
                if (!item) return '';
                const n = item.woNumber ?? item.workOrderNumber ?? `WO-${item.id}`;
                return `${n}${item.productName ? ' — ' + item.productName : ''}`;
              }}
              valueExpr="id"
              value={woId}
              searchEnabled
              onValueChanged={(e) => setWoId(e.value as number | null)}
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
            height={80}
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
