'use client';

/**
 * Receipt Tolerances admin
 * Feature: 020-goods-receipt
 */
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid, Column, Editing, Paging } from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { Sliders } from 'lucide-react';
import type { ReceiptTolerance, ChecklistCategory } from '@/types/goods-receipt';

export default function ReceiptTolerancesPage() {
  const t = useTranslations('goodsReceipt');
  const qc = useQueryClient();

  const { data, refetch } = useQuery<ReceiptTolerance[]>({
    queryKey: ['receipt-tolerances'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/receipt-tolerances?includeInactive=true');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const upsertMut = useMutation({
    mutationFn: async (patch: Partial<ReceiptTolerance> & { category: ChecklistCategory }) => {
      const res = await fetch('/api/master-data/receipt-tolerances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Update failed');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['receipt-tolerances'] }),
  });

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sliders className="w-6 h-6" />
            {t('tolerances.title')}
          </h1>
          <p className="text-gray-600 text-sm mt-1">{t('tolerances.subtitle')}</p>
        </div>
        <Button text={t('actions.refresh')} onClick={() => refetch()} />
      </header>

      <DataGrid
        dataSource={data ?? []}
        keyExpr="id"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
        onRowUpdating={async (e) => {
          const old = e.oldData as ReceiptTolerance;
          const merged = { ...old, ...e.newData };
          await upsertMut.mutateAsync({
            category: merged.category,
            tolerancePercent: merged.tolerancePercent,
            isActive: merged.isActive,
            notes: merged.notes,
          });
        }}
      >
        <Paging pageSize={20} />
        <Editing mode="row" allowUpdating />
        <Column
          dataField="category"
          caption={t('tolerances.columns.category')}
          allowEditing={false}
          width={180}
          cellRender={(c) => (
            <span className="font-medium">{t(`category.${c.value as ChecklistCategory}`)}</span>
          )}
        />
        <Column
          dataField="tolerancePercent"
          caption={t('tolerances.columns.tolerancePercent')}
          dataType="number"
          format="#0.00 %"
          width={180}
        />
        <Column dataField="isActive" caption={t('tolerances.columns.isActive')} dataType="boolean" width={100} />
        <Column dataField="notes" caption={t('tolerances.columns.notes')} />
      </DataGrid>
    </div>
  );
}
