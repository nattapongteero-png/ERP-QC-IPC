'use client';

/**
 * Sampling Plan Form Component
 * Reusable form for creating and editing QC sampling plans (Audit QC5)
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxSwitch } from '@/components/ui/dx-switch';
import { SwitchTypes } from 'devextreme-react/switch';
import { useToast } from '@/hooks/use-toast';
import { Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrganicGridTheme } from '@/components/ui/organic-grid-theme';

interface PlanRow {
  id: number;
  code: string;
  name: string;
  itemId: number | null;
  itemCode: string | null;
  itemName: string | null;
  category: string | null;
  inspectionLevel: 'I' | 'II' | 'III';
  aql: number;
  sampleSize: number | null;
  acceptNumber: number | null;
  rejectNumber: number | null;
  frequency: string;
  standardRef: string | null;
  defaultSampleQty: number | null;
  defaultRetainQty: number | null;
  isActive: boolean;
  notes: string | null;
}

type FormData = {
  code: string;
  name: string;
  itemId: number | null;
  category: string;
  inspectionLevel: 'I' | 'II' | 'III';
  aql: number;
  sampleSize: number | null;
  acceptNumber: number | null;
  rejectNumber: number | null;
  frequency: string;
  standardRef: string;
  defaultSampleQty: number | null;
  defaultRetainQty: number | null;
  notes: string;
  isActive: boolean;
};

const FREQ_OPTIONS = [
  { id: 'every_lot', name: 'ทุกล็อต (every_lot)' },
  { id: 'random_30pct', name: 'สุ่ม 30% (random_30pct)' },
  { id: 'random_10pct', name: 'สุ่ม 10% (random_10pct)' },
  { id: 'reduced', name: 'ลดความถี่ (reduced)' },
  { id: 'tightened', name: 'เพิ่มความถี่ (tightened)' },
  { id: 'skip_lot', name: 'ข้ามบางล็อต (skip_lot)' },
];

const LEVEL_OPTIONS = [
  { id: 'I', name: 'Level I — ตรวจน้อย (สุ่มจำนวนน้อย ใช้เมื่อคุณภาพนิ่ง)' },
  { id: 'II', name: 'Level II — ปกติ (ค่าเริ่มต้นทั่วไป)' },
  { id: 'III', name: 'Level III — ตรวจเข้ม (สุ่มจำนวนมาก ใช้เมื่อพบปัญหาบ่อย)' },
];

const DEFAULT_FORM: FormData = {
  code: '',
  name: '',
  itemId: null,
  category: '',
  inspectionLevel: 'II',
  aql: 1.0,
  sampleSize: null,
  acceptNumber: null,
  rejectNumber: null,
  frequency: 'every_lot',
  standardRef: 'ISO 2859-1',
  defaultSampleQty: null,
  defaultRetainQty: null,
  notes: '',
  isActive: true,
};

export interface SamplingPlanFormProps {
  mode: 'create' | 'edit';
  id?: number;
}

export function SamplingPlanForm({ mode, id }: SamplingPlanFormProps) {
  const { data: existing, isLoading } = useQuery<PlanRow>({
    queryKey: ['sampling-plan', id],
    queryFn: async () => {
      // The GET list endpoint is used — fetch the single record by loading all and filtering,
      // OR use list and pick. The API has no GET /[id], so we use the list.
      const res = await fetch('/api/master-data/sampling-plans');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const found = (data.data as PlanRow[]).find((r) => r.id === id);
      if (!found) throw new Error('ไม่พบแผนชักตัวอย่าง');
      return found;
    },
    enabled: mode === 'edit' && !!id,
  });

  if (mode === 'edit' && (isLoading || !existing)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">กำลังโหลด...</div>
      </div>
    );
  }

  const initialData: FormData = existing
    ? {
        code: existing.code || '',
        name: existing.name || '',
        itemId: existing.itemId ?? null,
        category: existing.category || '',
        inspectionLevel: existing.inspectionLevel || 'II',
        aql: Number(existing.aql ?? 1.0),
        sampleSize: existing.sampleSize ?? null,
        acceptNumber: existing.acceptNumber ?? null,
        rejectNumber: existing.rejectNumber ?? null,
        frequency: existing.frequency || 'every_lot',
        standardRef: existing.standardRef || '',
        defaultSampleQty: existing.defaultSampleQty ?? null,
        defaultRetainQty: existing.defaultRetainQty ?? null,
        notes: existing.notes || '',
        isActive: existing.isActive ?? true,
      }
    : { ...DEFAULT_FORM };

  return <SamplingPlanFormInner key={id || 'new'} mode={mode} id={id} initialData={initialData} existing={existing} />;
}

function SamplingPlanFormInner({
  mode,
  id,
  initialData,
  existing,
}: SamplingPlanFormProps & { initialData: FormData; existing?: PlanRow }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [formData, setFormData] = React.useState<FormData>(initialData);

  // Fetch items list for item-binding dropdown
  const { data: itemsData } = useQuery<{ id: number; code: string; nameTh: string }[]>({
    queryKey: ['items-for-sampling-plan'],
    queryFn: async () => {
      const res = await fetch('/api/items?limit=500');
      const json = await res.json();
      return json?.data?.items || json?.data || [];
    },
  });
  const items = itemsData || [];

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const url = mode === 'edit' ? `/api/master-data/sampling-plans/${id}` : '/api/master-data/sampling-plans';
      const method = mode === 'edit' ? 'PUT' : 'POST';
      const payload = {
        ...data,
        category: data.category.trim() || null,
        standardRef: data.standardRef.trim() || null,
        notes: data.notes.trim() || null,
      };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'บันทึกไม่สำเร็จ');
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sampling-plans'] });
      queryClient.invalidateQueries({ queryKey: ['sampling-plan', id] });
      toast.success(
        mode === 'edit' ? 'อัปเดตแผนแล้ว' : 'สร้างแผนเรียบร้อย',
        `${formData.name} ถูก${mode === 'edit' ? 'อัปเดต' : 'สร้าง'}เรียบร้อยแล้ว`,
      );
      router.push('/master-data/sampling-plans');
    },
    onError: (error: Error) => {
      toast.error('ผิดพลาด', error.message);
    },
  });

  const handleSave = () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกรหัสและชื่อแผน');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleCancel = () => {
    router.push('/master-data/sampling-plans');
  };

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="organic-grid flex flex-col gap-5 p-4 md:p-6 w-full max-w-4xl mx-auto">
      <OrganicGridTheme />

      <ResponsivePageHeader
        title={mode === 'edit' ? 'แก้ไขแผนชักตัวอย่าง' : 'เพิ่มแผนชักตัวอย่างใหม่'}
        subtitle={
          mode === 'edit'
            ? `กำลังแก้ไข ${existing?.code || ''} — ${existing?.name || ''}`
            : 'สร้างแผนชักตัวอย่าง QC ใหม่'
        }
        icon={Layers}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        onBack={handleCancel}
        breadcrumbs={[
          { label: 'ข้อมูลหลัก', href: '/master-data' },
          { label: 'แผนชักตัวอย่าง QC', href: '/master-data/sampling-plans' },
          { label: mode === 'edit' ? 'แก้ไข' : 'เพิ่มใหม่' },
        ]}
        actions={
          <div className="flex gap-2">
            <DxButton text="ยกเลิก" icon="back" stylingMode="outlined" onClick={handleCancel} />
            <DxButton
              text={saveMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              icon="save"
              type="success"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="sampling-plan-save"
            />
          </div>
        }
      />

      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-emerald-600" />
            ข้อมูลแผน
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รหัสแผน *</label>
              <DxTextBox
                value={formData.code}
                onValueChanged={(e) => set('code', (e.value || '').toLowerCase())}
                placeholder="เช่น rm-herb-default"
                disabled={mode === 'edit'}
                data-testid="plan-code"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อแผน *</label>
              <DxTextBox
                value={formData.name}
                onValueChanged={(e) => set('name', e.value || '')}
                placeholder="ชื่อแผนชักตัวอย่าง"
                data-testid="plan-name"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scope */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ขอบเขตการใช้งาน</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-gray-500">
            ผูกกับรายการเฉพาะ หรือ หมวดหมู่ (เลือกอย่างใดอย่างหนึ่ง) หากไม่ผูกจะเป็นค่าเริ่มต้นทั่วไป
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รายการ (Item)</label>
              <DxSelectBox
                dataSource={[
                  { id: null as number | null, name: '— ไม่ผูก —' },
                  ...items.map((i) => ({ id: i.id, name: `${i.code} — ${i.nameTh}` })),
                ]}
                valueExpr="id"
                displayExpr="name"
                value={formData.itemId}
                onValueChanged={(e) => set('itemId', e.value)}
                searchEnabled
                placeholder="เลือกรายการ (ไม่บังคับ)"
                data-testid="plan-item"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่ (Category)</label>
              <DxTextBox
                value={formData.category}
                onValueChanged={(e) => set('category', e.value || '')}
                placeholder="หรือผูกกับหมวดหมู่"
                data-testid="plan-category"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AQL Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">พารามิเตอร์การชักตัวอย่าง (AQL)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ระดับการตรวจสอบ</label>
              <DxSelectBox
                dataSource={LEVEL_OPTIONS}
                valueExpr="id"
                displayExpr="name"
                value={formData.inspectionLevel}
                onValueChanged={(e) => set('inspectionLevel', e.value)}
                placeholder="เลือกระดับ"
                data-testid="plan-inspection-level"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">AQL</label>
              <DxNumberBox
                value={formData.aql}
                format="#,##0.00"
                onValueChanged={(e) => set('aql', Number(e.value ?? 1.0))}
                placeholder="1.00"
                data-testid="plan-aql"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ความถี่การชักตัวอย่าง</label>
              <DxSelectBox
                dataSource={FREQ_OPTIONS}
                valueExpr="id"
                displayExpr="name"
                value={formData.frequency}
                onValueChanged={(e) => set('frequency', e.value)}
                placeholder="เลือกความถี่"
                data-testid="plan-frequency"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ขนาดตัวอย่าง (n)</label>
              <DxNumberBox
                value={formData.sampleSize ?? undefined}
                onValueChanged={(e) => set('sampleSize', e.value ?? null)}
                placeholder="ระบุขนาดตัวอย่าง"
                data-testid="plan-sample-size"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนยอมรับ (Ac)</label>
              <DxNumberBox
                value={formData.acceptNumber ?? undefined}
                onValueChanged={(e) => set('acceptNumber', e.value ?? null)}
                placeholder="ระบุจำนวนยอมรับ"
                data-testid="plan-accept-number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนปฏิเสธ (Re)</label>
              <DxNumberBox
                value={formData.rejectNumber ?? undefined}
                onValueChanged={(e) => set('rejectNumber', e.value ?? null)}
                placeholder="ระบุจำนวนปฏิเสธ"
                data-testid="plan-reject-number"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reference & Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ค่าอ้างอิงและค่าเริ่มต้น</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">อ้างอิงมาตรฐาน</label>
              <DxTextBox
                value={formData.standardRef}
                onValueChanged={(e) => set('standardRef', e.value || '')}
                placeholder="เช่น ISO 2859-1"
                data-testid="plan-standard-ref"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนตัวอย่าง (ค่าเริ่มต้น)</label>
              <DxNumberBox
                value={formData.defaultSampleQty ?? undefined}
                onValueChanged={(e) => set('defaultSampleQty', e.value ?? null)}
                placeholder="ระบุปริมาณ"
                data-testid="plan-default-sample-qty"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเก็บสำรอง (ค่าเริ่มต้น)</label>
              <DxNumberBox
                value={formData.defaultRetainQty ?? undefined}
                onValueChanged={(e) => set('defaultRetainQty', e.value ?? null)}
                placeholder="ระบุปริมาณ"
                data-testid="plan-default-retain-qty"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
            <DxTextArea
              value={formData.notes}
              onValueChanged={(e) => set('notes', e.value || '')}
              placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ)"
              height={80}
              data-testid="plan-notes"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <DxSwitch
              value={formData.isActive}
              onValueChanged={(e: SwitchTypes.ValueChangedEvent) => set('isActive', e.value)}
            />
            <span className="text-sm text-gray-700">ใช้งาน</span>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <DxButton text="ยกเลิก" stylingMode="outlined" onClick={handleCancel} />
        <DxButton
          text={saveMutation.isPending ? 'กำลังบันทึก...' : mode === 'edit' ? 'อัปเดตแผน' : 'สร้างแผน'}
          type="success"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          data-testid="sampling-plan-save-bottom"
        />
      </div>
    </div>
  );
}
