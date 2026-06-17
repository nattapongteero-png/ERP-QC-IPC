'use client';

/**
 * Receipt Tolerances admin
 * Feature: 020-goods-receipt
 */
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid, Column, Editing, Paging } from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { Sliders, Plus, Trash2 } from 'lucide-react';
import { BackButton } from '@/components/shared/BackButton';
import { OrganicGridTheme } from '@/components/ui/organic-grid-theme';
import { CHECKLIST_CATEGORIES } from '@/types/goods-receipt';
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

  // Categories that do not yet have a tolerance row — the genuine "create" targets.
  const existingCategories = new Set((data ?? []).map((r) => r.category));
  const missingCategories = CHECKLIST_CATEGORIES.filter((c) => !existingCategories.has(c));

  const handleAdd = async () => {
    const category = missingCategories[0];
    if (!category) return;
    await upsertMut.mutateAsync({ category, tolerancePercent: 0, isActive: true });
  };

  const handleDelete = async (row: ReceiptTolerance) => {
    if (!row?.id) return;
    if (!confirm('ยืนยันการปิดใช้งานรายการนี้?')) return;
    // No hard-delete endpoint exists for this resource; deactivate via the upsert API.
    await upsertMut.mutateAsync({ category: row.category, isActive: false });
  };

  return (
    <div className="organic-grid p-6 space-y-4">
      <OrganicGridTheme />
      <BackButton href="/master-data" label="ข้อมูลหลัก" />
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sliders className="w-6 h-6" />
            {t('tolerances.title')}
          </h1>
          <p className="text-[#4B7163] text-sm mt-1">{t('tolerances.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAdd}
            disabled={missingCategories.length === 0 || upsertMut.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            เพิ่ม
          </button>
          <Button text={t('actions.refresh')} onClick={() => refetch()} />
        </div>
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
        <Column
          caption="จัดการ"
          width={110}
          alignment="center"
          allowEditing={false}
          allowSorting={false}
          allowFiltering={false}
          cellRender={(c) => {
            const row = c.data as ReceiptTolerance;
            return (
              <button
                type="button"
                title="ปิดใช้งาน"
                onClick={() => handleDelete(row)}
                disabled={!row.isActive || upsertMut.isPending}
                className="rounded p-1.5 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            );
          }}
        />
      </DataGrid>
    </div>
  );
}
