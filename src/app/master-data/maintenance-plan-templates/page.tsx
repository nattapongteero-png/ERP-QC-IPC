'use client';

/**
 * Maintenance Plan Templates admin
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { DataGrid, Column, Paging, Editing } from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { Popup } from 'devextreme-react/popup';
import { SelectBox } from 'devextreme-react/select-box';
import { NumberBox } from 'devextreme-react/number-box';
import { Wrench, Plus, Trash2 } from 'lucide-react';
import { BackButton } from '@/components/shared/BackButton';
import type { MaintenancePlanTemplate } from '@/types/equipment-notifications';

const MAINTENANCE_TYPES = ['preventive', 'calibration', 'inspection', 'corrective'];
const INTERVAL_TYPES = ['days', 'weeks', 'months', 'hours', 'units'];

interface NewForm {
  name: string;
  description: string;
  maintenanceType: string;
  intervalType: string;
  intervalValue: number;
  alertDaysBefore: number;
}

const EMPTY: NewForm = {
  name: '',
  description: '',
  maintenanceType: 'preventive',
  intervalType: 'months',
  intervalValue: 6,
  alertDaysBefore: 14,
};

export default function MaintenancePlanTemplatesPage() {
  const t = useTranslations('equipmentNotifications');
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<NewForm>(EMPTY);

  const { data } = useQuery<MaintenancePlanTemplate[]>({
    queryKey: ['mp-templates'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/maintenance-plan-templates?includeInactive=true');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/master-data/maintenance-plan-templates/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to delete');
      }
      return res.json().catch(() => null);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mp-templates'] });
    },
  });

  const handleDelete = (r: MaintenancePlanTemplate) => {
    if (!confirm(`ลบแม่แบบ "${r.name}" ?`)) return;
    deleteMut.mutate(r.id);
  };

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/master-data/maintenance-plan-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Failed');
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mp-templates'] });
      setCreateOpen(false);
      setForm(EMPTY);
    },
  });

  return (
    <div className="p-6 space-y-4">
      <BackButton href="/master-data" label="ข้อมูลหลัก" />
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wrench className="w-6 h-6" />
          {t('page.templates')}
        </h1>
        <Button
          type="default"
          stylingMode="contained"
          onClick={() => setCreateOpen(true)}
          render={() => (
            <span className="inline-flex items-center gap-1">
              <Plus className="w-4 h-4" />
              เพิ่มแม่แบบ
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
        onRowUpdating={async (e) => {
          const merged = { ...e.oldData, ...e.newData } as MaintenancePlanTemplate;
          const res = await fetch(`/api/master-data/maintenance-plan-templates/${merged.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(merged),
          });
          if (!res.ok) {
            e.cancel = true;
            return;
          }
          qc.invalidateQueries({ queryKey: ['mp-templates'] });
        }}
      >
        <Paging pageSize={20} />
        <Editing mode="row" allowUpdating useIcons />
        <Column dataField="name" caption="ชื่อ" />
        <Column dataField="description" caption="รายละเอียด" />
        <Column dataField="maintenanceType" caption="ประเภท" width={140} />
        <Column
          caption="รอบ"
          cellRender={(c) => {
            const r = c.data as MaintenancePlanTemplate;
            return `${r.intervalValue} ${r.intervalType}`;
          }}
        />
        <Column dataField="alertDaysBefore" caption="แจ้งเตือนล่วงหน้า (วัน)" width={150} />
        <Column dataField="isActive" caption="ใช้งาน" dataType="boolean" width={80} />
        <Column
          caption="การดำเนินการ"
          width={110}
          alignment="center"
          allowSorting={false}
          allowFiltering={false}
          cellRender={(c) => {
            const r = c.data as MaintenancePlanTemplate;
            return (
              <button
                type="button"
                title="ลบ"
                aria-label="ลบ"
                onClick={() => handleDelete(r)}
                disabled={deleteMut.isPending}
                className="p-1.5 rounded text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            );
          }}
        />
      </DataGrid>

      <Popup
        visible={createOpen}
        onHiding={() => setCreateOpen(false)}
        showCloseButton
        title="เพิ่มแม่แบบแผนบำรุงรักษา"
        width={580}
        height="auto"
      >
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">ชื่อ *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="เช่น บำรุงรักษาเชิงป้องกันทุก 6 เดือน"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">รายละเอียด</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">ประเภทการบำรุงรักษา *</label>
              <SelectBox
                dataSource={MAINTENANCE_TYPES}
                value={form.maintenanceType}
                onValueChanged={(e) => setForm({ ...form, maintenanceType: String(e.value) })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">หน่วยรอบ *</label>
              <SelectBox
                dataSource={INTERVAL_TYPES}
                value={form.intervalType}
                onValueChanged={(e) => setForm({ ...form, intervalType: String(e.value) })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ค่ารอบ *</label>
              <NumberBox
                value={form.intervalValue}
                min={1}
                step={1}
                showSpinButtons
                onValueChanged={(e) => setForm({ ...form, intervalValue: Number(e.value ?? 0) })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">แจ้งเตือนล่วงหน้า (วัน)</label>
              <NumberBox
                value={form.alertDaysBefore}
                min={0}
                max={365}
                step={1}
                showSpinButtons
                onValueChanged={(e) => setForm({ ...form, alertDaysBefore: Number(e.value ?? 0) })}
              />
            </div>
          </div>
          {createMut.error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded p-3 text-sm">
              {String((createMut.error as Error).message)}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button text="ยกเลิก" stylingMode="text" onClick={() => setCreateOpen(false)} />
            <Button
              type="default"
              stylingMode="contained"
              text="บันทึก"
              disabled={!form.name || createMut.isPending}
              onClick={() => createMut.mutate()}
            />
          </div>
        </div>
      </Popup>
    </div>
  );
}
