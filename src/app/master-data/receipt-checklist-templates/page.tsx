'use client';

/**
 * Receipt Checklist Templates admin
 * Feature: 020-goods-receipt
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid, Column, Paging } from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { Popup } from 'devextreme-react/popup';
import { SelectBox } from 'devextreme-react/select-box';
import { CheckBox } from 'devextreme-react/check-box';
import { ListChecks, Plus } from 'lucide-react';
import { BackButton } from '@/components/shared/BackButton';
import { CHECKLIST_CATEGORIES, type ChecklistCategory, type ChecklistTemplate } from '@/types/goods-receipt';

interface NewItemRow {
  label: string;
  isMandatory: boolean;
  sortOrder: number;
}

export default function ReceiptChecklistTemplatesPage() {
  const t = useTranslations('goodsReceipt');
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<ChecklistCategory>('raw_material');
  const [newItems, setNewItems] = useState<NewItemRow[]>([
    { label: '', isMandatory: true, sortOrder: 1 },
  ]);

  const { data } = useQuery<ChecklistTemplate[]>({
    queryKey: ['receipt-templates'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/receipt-checklist-templates?includeHistorical=true');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/master-data/receipt-checklist-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: newCategory,
          items: newItems.filter((it) => it.label.trim().length > 0),
        }),
      });
      if (!res.ok) throw new Error('Create failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receipt-templates'] });
      setCreateOpen(false);
      setNewItems([{ label: '', isMandatory: true, sortOrder: 1 }]);
    },
  });

  return (
    <div className="p-6 space-y-4">
      <BackButton href="/master-data" label="Master Data" />
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListChecks className="w-6 h-6" />
            {t('page.templates')}
          </h1>
        </div>
        <Button
          type="default"
          stylingMode="contained"
          onClick={() => setCreateOpen(true)}
          render={() => (
            <span className="inline-flex items-center gap-1">
              <Plus className="w-4 h-4" />
              {t('checklist.newVersion')}
            </span>
          )}
        />
      </header>

      <DataGrid
        dataSource={data ?? []}
        keyExpr="id"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
      >
        <Paging pageSize={20} />
        <Column
          dataField="category"
          caption={t('tolerances.columns.category')}
          width={180}
          cellRender={(c) => t(`category.${c.value as ChecklistCategory}`)}
        />
        <Column dataField="version" caption="Version" width={100} />
        <Column
          dataField="isCurrent"
          caption={t('checklist.currentVersion')}
          dataType="boolean"
          width={150}
        />
        <Column
          caption="Items"
          cellRender={(c) => {
            const items = (c.data as ChecklistTemplate).items;
            return (
              <ol className="text-xs space-y-1 list-decimal pl-4">
                {items.map((it) => (
                  <li key={it.id}>
                    {it.label}
                    {it.isMandatory && <span className="text-rose-600"> *</span>}
                  </li>
                ))}
              </ol>
            );
          }}
        />
        <Column dataField="createdAt" caption="Created" width={180} />
      </DataGrid>

      {/* Create popup */}
      <Popup
        visible={createOpen}
        onHiding={() => setCreateOpen(false)}
        showCloseButton
        title={t('checklist.newVersion')}
        width={720}
        height="auto"
      >
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('tolerances.columns.category')}
            </label>
            <SelectBox
              dataSource={CHECKLIST_CATEGORIES.map((c) => ({ value: c, label: t(`category.${c}`) }))}
              displayExpr="label"
              valueExpr="value"
              value={newCategory}
              onValueChanged={(e) => setNewCategory(e.value as ChecklistCategory)}
            />
          </div>

          <div className="border-t pt-3">
            <div className="text-sm font-medium mb-2">Items</div>
            {newItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-center mb-2">
                <span className="text-sm text-gray-500 w-6 text-right">{idx + 1}.</span>
                <input
                  type="text"
                  className="flex-1 border rounded px-2 py-1"
                  value={item.label}
                  onChange={(e) =>
                    setNewItems((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, label: e.target.value } : it)),
                    )
                  }
                  placeholder="Checklist item label"
                />
                <CheckBox
                  value={item.isMandatory}
                  text={t('checklist.mandatory')}
                  onValueChanged={(e) =>
                    setNewItems((prev) =>
                      prev.map((it, i) =>
                        i === idx ? { ...it, isMandatory: Boolean(e.value) } : it,
                      ),
                    )
                  }
                />
                <Button
                  icon="trash"
                  stylingMode="text"
                  onClick={() => setNewItems((prev) => prev.filter((_, i) => i !== idx))}
                />
              </div>
            ))}
            <Button
              text="+ Add item"
              stylingMode="text"
              onClick={() =>
                setNewItems((prev) => [
                  ...prev,
                  { label: '', isMandatory: true, sortOrder: prev.length + 1 },
                ])
              }
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              text={t('actions.cancel')}
              stylingMode="text"
              onClick={() => setCreateOpen(false)}
            />
            <Button
              type="default"
              stylingMode="contained"
              text={t('actions.create')}
              disabled={createMut.isPending || newItems.every((it) => it.label.trim().length === 0)}
              onClick={() => createMut.mutate()}
            />
          </div>
        </div>
      </Popup>
    </div>
  );
}
