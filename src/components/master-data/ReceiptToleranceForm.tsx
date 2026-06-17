'use client';

/**
 * Receipt Tolerance Form Component
 * Reusable form for creating and editing receipt tolerances.
 * Feature: 020-goods-receipt
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxSwitch } from '@/components/ui/dx-switch';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { SwitchTypes } from 'devextreme-react/switch';
import { useToast } from '@/hooks/use-toast';
import { Sliders } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CHECKLIST_CATEGORIES, type ChecklistCategory } from '@/types/goods-receipt';
import type { ReceiptTolerance } from '@/types/goods-receipt';

const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  raw_material: 'วัตถุดิบ',
  finished_goods: 'สินค้าสำเร็จรูป',
};

const categoryOptions = CHECKLIST_CATEGORIES.map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c],
}));

interface ReceiptToleranceFormProps {
  mode: 'create' | 'edit';
  id?: number;
}

export function ReceiptToleranceForm({ mode, id }: ReceiptToleranceFormProps) {
  const { data: existing, isLoading } = useQuery<ReceiptTolerance>({
    queryKey: ['receipt-tolerance', id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/receipt-tolerances/${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
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

  const initialData = existing
    ? {
        category: existing.category,
        tolerancePercent: existing.tolerancePercent,
        isActive: existing.isActive ?? true,
        notes: existing.notes ?? '',
      }
    : {
        category: CHECKLIST_CATEGORIES[0],
        tolerancePercent: 0,
        isActive: true,
        notes: '',
      };

  return (
    <ReceiptToleranceFormInner
      key={id ?? 'new'}
      mode={mode}
      id={id}
      initialData={initialData}
      existing={existing}
    />
  );
}

interface FormData {
  category: ChecklistCategory;
  tolerancePercent: number;
  isActive: boolean;
  notes: string;
}

function ReceiptToleranceFormInner({
  mode,
  id,
  initialData,
  existing,
}: ReceiptToleranceFormProps & { initialData: FormData; existing?: ReceiptTolerance }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [formData, setFormData] = React.useState<FormData>(initialData);

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (mode === 'edit' && id) {
        const res = await fetch(`/api/master-data/receipt-tolerances/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tolerancePercent: data.tolerancePercent,
            isActive: data.isActive,
            notes: data.notes || null,
          }),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error);
        return result.data;
      } else {
        const res = await fetch('/api/master-data/receipt-tolerances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: data.category,
            tolerancePercent: data.tolerancePercent,
            isActive: data.isActive,
            notes: data.notes || null,
          }),
        });
        const result = await res.json();
        if (!result.success && !res.ok) throw new Error(result.error ?? 'Failed');
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt-tolerances'] });
      toast.success(
        mode === 'edit' ? 'อัปเดตสำเร็จ' : 'สร้างสำเร็จ',
        `เกณฑ์ ${CATEGORY_LABELS[formData.category]} ถูก${mode === 'edit' ? 'อัปเดต' : 'สร้าง'}เรียบร้อย`
      );
      router.push('/master-data/receipt-tolerances');
    },
    onError: (error: Error) => {
      toast.error('ผิดพลาด', error.message);
    },
  });

  const handleSave = () => {
    if (formData.tolerancePercent < 0 || formData.tolerancePercent > 100) {
      toast.error('ข้อมูลไม่ถูกต้อง', 'เกณฑ์ต้องอยู่ระหว่าง 0–100');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleCancel = () => {
    router.push('/master-data/receipt-tolerances');
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-4xl mx-auto">
      <ResponsivePageHeader
        title={mode === 'edit' ? 'แก้ไขเกณฑ์ Tolerance' : 'เพิ่มเกณฑ์ Tolerance ใหม่'}
        subtitle={
          mode === 'edit'
            ? `กำลังแก้ไข ${CATEGORY_LABELS[existing?.category ?? formData.category]}`
            : 'กำหนดเกณฑ์ความคลาดเคลื่อนที่ยอมรับได้สำหรับการตรวจรับ'
        }
        icon={Sliders}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        breadcrumbs={[
          { label: 'ข้อมูลหลัก', href: '/master-data' },
          { label: 'เกณฑ์ Tolerance ตรวจรับ', href: '/master-data/receipt-tolerances' },
          { label: mode === 'edit' ? 'แก้ไข' : 'เพิ่มใหม่' },
        ]}
        actions={
          <div className="flex gap-2">
            <DxButton
              text="ยกเลิก"
              icon="back"
              stylingMode="outlined"
              onClick={handleCancel}
            />
            <DxButton
              text={saveMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              icon="save"
              type="success"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            />
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-emerald-600" />
            ข้อมูลเกณฑ์ Tolerance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">หมวดสินค้า *</label>
              <DxSelectBox
                dataSource={categoryOptions}
                displayExpr="label"
                valueExpr="value"
                value={formData.category}
                onValueChanged={(e) => setFormData({ ...formData, category: e.value as ChecklistCategory })}
                placeholder="เลือกหมวด"
                disabled={mode === 'edit'}
                data-testid="tolerance-category-select"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เกณฑ์ความคลาดเคลื่อน (%) *</label>
              <DxNumberBox
                value={formData.tolerancePercent}
                onValueChanged={(e) => setFormData({ ...formData, tolerancePercent: Number(e.value ?? 0) })}
                min={0}
                max={100}
                format="#0.00"
                showSpinButtons
                data-testid="tolerance-percent-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
            <DxTextBox
              value={formData.notes}
              onValueChanged={(e) => setFormData({ ...formData, notes: e.value ?? '' })}
              placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ)"
              data-testid="tolerance-notes-input"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <DxSwitch
              value={formData.isActive}
              onValueChanged={(e: SwitchTypes.ValueChangedEvent) =>
                setFormData({ ...formData, isActive: e.value })
              }
              data-testid="tolerance-active-switch"
            />
            <span className="text-sm text-gray-700">ใช้งาน</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pt-4">
        <DxButton text="ยกเลิก" stylingMode="outlined" onClick={handleCancel} />
        <DxButton
          text={saveMutation.isPending ? 'กำลังบันทึก...' : mode === 'edit' ? 'อัปเดตเกณฑ์' : 'สร้างเกณฑ์'}
          type="success"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          data-testid="tolerance-save-btn"
        />
      </div>
    </div>
  );
}
