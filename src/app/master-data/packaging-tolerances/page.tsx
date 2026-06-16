'use client';

/**
 * Packaging Tolerances — admin CRUD page
 * Feature 019, Phase 8
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid, Column, Editing, FilterRow, Paging } from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { Popup } from 'devextreme-react/popup';
import { NumberBox } from 'devextreme-react/number-box';
import { SelectBox } from 'devextreme-react/select-box';
import { TextArea } from 'devextreme-react/text-area';
import { Sliders, Plus } from 'lucide-react';
import type { PackagingTolerance, PackagingCategory } from '@/types/packaging';
import { PACKAGING_CATEGORIES } from '@/types/packaging';

export default function PackagingTolerancesPage() {
  const t = useTranslations('packaging');
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [newCat, setNewCat] = useState<PackagingCategory>('other');
  const [newPct, setNewPct] = useState(1);
  const [newNotes, setNewNotes] = useState('');

  const { data, refetch } = useQuery<PackagingTolerance[]>({
    queryKey: ['packaging-tolerances'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/packaging-tolerances?includeInactive=true');
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
  });

  const updateMut = useMutation({
    mutationFn: async (input: { id: number; patch: Partial<PackagingTolerance> }) => {
      const res = await fetch(`/api/master-data/packaging-tolerances/${input.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tolerancePercent: input.patch.tolerancePercent,
          isActive: input.patch.isActive,
          notes: input.patch.notes,
        }),
      });
      if (!res.ok) throw new Error('Update failed');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packaging-tolerances'] }),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/master-data/packaging-tolerances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packagingCategory: newCat,
          tolerancePercent: newPct,
          notes: newNotes || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Create failed');
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packaging-tolerances'] });
      setAddOpen(false);
      setNewCat('other');
      setNewPct(1);
      setNewNotes('');
    },
  });

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sliders className="w-6 h-6" />
            {t('tolerances.title')}
          </h1>
          <p className="text-[#4B7163] text-sm mt-1">
            ตั้งค่าเกณฑ์ Variance Tolerance ของแต่ละหมวด Packaging — ใช้ในการตรวจสอบ Return
          </p>
        </div>
        <div className="flex gap-2">
          <Button text={t('buttons.refresh')} onClick={() => refetch()} />
          <Button
            type="default"
            stylingMode="contained"
            onClick={() => setAddOpen(true)}
            render={() => (
              <span className="inline-flex items-center gap-1">
                <Plus className="w-4 h-4" />
                เพิ่มหมวด
              </span>
            )}
          />
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
          const newValue = { ...e.oldData, ...e.newData };
          await updateMut.mutateAsync({ id: e.key as number, patch: newValue });
        }}
      >
        <FilterRow visible={false} />
        <Paging pageSize={20} />
        <Editing mode="row" allowUpdating />
        <Column
          dataField="packagingCategory"
          caption={t('tolerances.columns.category')}
          allowEditing={false}
          cellRender={(c) => (
            <span className="font-medium">
              {t(`tolerances.categories.${c.value as PackagingCategory}`)}
            </span>
          )}
          width={150}
        />
        <Column
          dataField="tolerancePercent"
          caption={t('tolerances.columns.tolerancePercent')}
          dataType="number"
          format="#0.00 %"
          width={180}
          cellRender={(c) => (
            <span className="font-semibold">{Number(c.value).toFixed(2)}%</span>
          )}
        />
        <Column
          dataField="isActive"
          caption={t('tolerances.columns.isActive')}
          dataType="boolean"
          width={120}
        />
        <Column dataField="notes" caption={t('tolerances.columns.notes')} />
      </DataGrid>

      {/* Add tolerance popup */}
      <Popup
        visible={addOpen}
        onHiding={() => setAddOpen(false)}
        showCloseButton
        title="เพิ่มหมวด Tolerance"
        width={480}
        height="auto"
      >
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('tolerances.columns.category')} *
            </label>
            <SelectBox
              dataSource={PACKAGING_CATEGORIES.map((c) => ({
                value: c,
                label: t(`tolerances.categories.${c}`),
              }))}
              displayExpr="label"
              valueExpr="value"
              value={newCat}
              onValueChanged={(e) => setNewCat(e.value as PackagingCategory)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('tolerances.columns.tolerancePercent')} *
            </label>
            <NumberBox
              value={newPct}
              min={0}
              max={100}
              step={0.1}
              showSpinButtons
              format="#0.00 %"
              onValueChanged={(e) => setNewPct(Number(e.value ?? 0))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('tolerances.columns.notes')}</label>
            <TextArea
              value={newNotes}
              height={60}
              onValueChanged={(e) => setNewNotes(String(e.value ?? ''))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button text={t('buttons.cancel')} stylingMode="text" onClick={() => setAddOpen(false)} />
            <Button
              type="default"
              stylingMode="contained"
              text="เพิ่ม"
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending}
            />
          </div>
        </div>
      </Popup>
    </div>
  );
}
