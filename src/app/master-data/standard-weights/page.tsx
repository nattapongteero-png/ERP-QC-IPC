'use client';

/**
 * Standard Weights admin (master data)
 * Feature: 021-scale-verification
 */
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid, Column, Paging, Editing } from 'devextreme-react/data-grid';
import type { DataGridRef } from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { Popup } from 'devextreme-react/popup';
import { SelectBox } from 'devextreme-react/select-box';
import { NumberBox } from 'devextreme-react/number-box';
import { DateBox } from 'devextreme-react/date-box';
import { Scale, Plus, AlertTriangle, Edit, Trash2 } from 'lucide-react';
import { BackButton } from '@/components/shared/BackButton';
import {
  ACCURACY_CLASSES,
  type StandardWeight,
  type AccuracyClass,
} from '@/types/scale-verification';

interface NewWeightForm {
  code: string;
  denominationValue: number;
  denominationUnit: 'g' | 'kg' | 'mg';
  accuracyClass: AccuracyClass;
  certificateNumber: string;
  certificateIssuer: string;
  certificateIssueDate: string;
  certificateExpiryDate: string;
}

const EMPTY_FORM: NewWeightForm = {
  code: '',
  denominationValue: 0,
  denominationUnit: 'g',
  accuracyClass: 'E2',
  certificateNumber: '',
  certificateIssuer: '',
  certificateIssueDate: new Date().toISOString().slice(0, 10),
  certificateExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
};

export default function StandardWeightsPage() {
  const t = useTranslations('scaleVerification');
  const qc = useQueryClient();
  const gridRef = useRef<DataGridRef>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<NewWeightForm>(EMPTY_FORM);

  const handleDelete = async (row: StandardWeight) => {
    if (!confirm(`${t('table.columns.actions')}: ${row.code}?`)) return;
    const res = await fetch(`/api/master-data/standard-weights/${row.id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body?.error ?? 'Failed to delete');
      return;
    }
    qc.invalidateQueries({ queryKey: ['standard-weights-admin'] });
    qc.invalidateQueries({ queryKey: ['standard-weights'] });
    await refetch();
  };

  const { data, refetch } = useQuery<StandardWeight[]>({
    queryKey: ['standard-weights-admin'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/standard-weights?includeInactive=true');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/master-data/standard-weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Failed');
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['standard-weights-admin'] });
      qc.invalidateQueries({ queryKey: ['standard-weights'] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    },
  });

  return (
    <div className="p-6 space-y-4">
      <BackButton href="/master-data" label="ข้อมูลหลัก" />
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="w-6 h-6" />
            {t('page.standardWeights')}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button text={t('actions.refresh')} onClick={() => refetch()} />
          <Button
            type="default"
            stylingMode="contained"
            onClick={() => setCreateOpen(true)}
            render={() => (
              <span className="inline-flex items-center gap-1">
                <Plus className="w-4 h-4" />
                {t('actions.addWeight')}
              </span>
            )}
          />
        </div>
      </header>

      <DataGrid
        ref={gridRef}
        dataSource={data ?? []}
        keyExpr="id"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
        onRowUpdating={async (e) => {
          const merged = { ...e.oldData, ...e.newData } as StandardWeight;
          const res = await fetch(`/api/master-data/standard-weights/${merged.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              certificateNumber: merged.certificateNumber,
              certificateIssuer: merged.certificateIssuer,
              certificateIssueDate: merged.certificateIssueDate,
              certificateExpiryDate: merged.certificateExpiryDate,
              ownerDepartment: merged.ownerDepartment,
              isActive: merged.isActive,
              notes: merged.notes,
            }),
          });
          if (!res.ok) {
            e.cancel = true;
            return;
          }
          await refetch();
        }}
      >
        <Paging pageSize={20} />
        <Editing mode="row" allowUpdating useIcons />
        <Column dataField="code" caption={t('table.columns.code')} width={120} allowEditing={false} />
        <Column
          caption={t('table.columns.denomination')}
          cellRender={(c) => {
            const r = c.data as StandardWeight;
            return `${r.denominationValue} ${r.denominationUnit}`;
          }}
          width={160}
        />
        <Column dataField="accuracyClass" caption={t('table.columns.accuracyClass')} width={100} />
        <Column dataField="certificateNumber" caption={t('table.columns.certificateNumber')} />
        <Column
          dataField="certificateExpiryDate"
          caption={t('table.columns.certificateExpiryDate')}
          width={160}
          cellRender={(c) => {
            const v = String(c.value ?? '');
            const days = Math.floor(
              (new Date(v).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
            );
            if (days < 0)
              return <span className="text-rose-700 font-medium">{v} (หมดอายุ)</span>;
            if (days <= 30)
              return <span className="text-amber-700 font-medium">{v} (อีก {days} วัน)</span>;
            return v;
          }}
        />
        <Column dataField="ownerDepartment" caption="หน่วยงานเจ้าของ" />
        <Column dataField="isActive" caption="ใช้งาน" dataType="boolean" width={80} />
        <Column
          caption={t('table.columns.actions')}
          width={110}
          alignment="center"
          allowEditing={false}
          allowSorting={false}
          cellRender={(c) => {
            const r = c.data as StandardWeight;
            return (
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  title={t('table.columns.actions')}
                  className="p-1.5 rounded text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                  onClick={() => gridRef.current?.instance()?.editRow(c.rowIndex)}
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title={t('table.columns.actions')}
                  className="p-1.5 rounded text-slate-600 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                  onClick={() => handleDelete(r)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          }}
        />
      </DataGrid>

      <Popup
        visible={createOpen}
        onHiding={() => setCreateOpen(false)}
        showCloseButton
        title={t('actions.addWeight')}
        width={620}
        height="auto"
      >
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t('form.code.label')} *</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="SW-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('form.accuracyClass.label')} *
              </label>
              <SelectBox
                dataSource={ACCURACY_CLASSES}
                value={form.accuracyClass}
                onValueChanged={(e) => setForm({ ...form, accuracyClass: e.value as AccuracyClass })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('form.denominationValue.label')} *
              </label>
              <NumberBox
                value={form.denominationValue}
                onValueChanged={(e) => setForm({ ...form, denominationValue: Number(e.value ?? 0) })}
                min={0}
                step={0.0001}
                format="#0.0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('form.denominationUnit.label')} *
              </label>
              <SelectBox
                dataSource={['g', 'kg', 'mg']}
                value={form.denominationUnit}
                onValueChanged={(e) => setForm({ ...form, denominationUnit: e.value as 'g' | 'kg' | 'mg' })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">
                {t('form.certificateNumber.label')} *
              </label>
              <input
                type="text"
                value={form.certificateNumber}
                onChange={(e) => setForm({ ...form, certificateNumber: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">
                {t('form.certificateIssuer.label')} *
              </label>
              <input
                type="text"
                value={form.certificateIssuer}
                onChange={(e) => setForm({ ...form, certificateIssuer: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="NIMT / SCG / ..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('form.certificateIssueDate.label')} *
              </label>
              <DateBox
                value={form.certificateIssueDate}
                onValueChanged={(e) =>
                  setForm({
                    ...form,
                    certificateIssueDate:
                      typeof e.value === 'string'
                        ? e.value.slice(0, 10)
                        : new Date(e.value as Date).toISOString().slice(0, 10),
                  })
                }
                type="date"
                displayFormat="yyyy-MM-dd"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('form.certificateExpiryDate.label')} *
              </label>
              <DateBox
                value={form.certificateExpiryDate}
                onValueChanged={(e) =>
                  setForm({
                    ...form,
                    certificateExpiryDate:
                      typeof e.value === 'string'
                        ? e.value.slice(0, 10)
                        : new Date(e.value as Date).toISOString().slice(0, 10),
                  })
                }
                type="date"
                displayFormat="yyyy-MM-dd"
              />
            </div>
          </div>

          {createMut.error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded p-3 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {String((createMut.error as Error).message)}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button text={t('actions.cancel')} stylingMode="text" onClick={() => setCreateOpen(false)} />
            <Button
              type="default"
              stylingMode="contained"
              text={t('actions.save')}
              disabled={
                createMut.isPending ||
                !form.code ||
                !form.certificateNumber ||
                !form.certificateIssuer ||
                form.denominationValue <= 0
              }
              onClick={() => createMut.mutate()}
            />
          </div>
        </div>
      </Popup>
    </div>
  );
}
