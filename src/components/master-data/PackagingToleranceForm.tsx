'use client';

/**
 * Packaging Tolerance Form Component
 * Reusable form for creating and editing packaging tolerance records.
 * Fields: packagingCategory (create only), tolerancePercent, isActive, notes.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSwitch } from '@/components/ui/dx-switch';
import { SwitchTypes } from 'devextreme-react/switch';
import TextArea from 'devextreme-react/text-area';
import { useToast } from '@/hooks/use-toast';
import { Sliders } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PackagingTolerance, PackagingCategory } from '@/types/packaging';
import { PACKAGING_CATEGORIES } from '@/types/packaging';

interface PackagingToleranceFormProps {
  mode: 'create' | 'edit';
  id?: number;
}

interface FormData {
  packagingCategory: PackagingCategory;
  tolerancePercent: number;
  isActive: boolean;
  notes: string;
}

export function PackagingToleranceForm({ mode, id }: PackagingToleranceFormProps) {
  const { data: existing, isLoading } = useQuery<PackagingTolerance>({
    queryKey: ['packaging-tolerance', id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/packaging-tolerances/${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Failed to load');
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

  const initialData: FormData = existing
    ? {
        packagingCategory: existing.packagingCategory,
        tolerancePercent: existing.tolerancePercent,
        isActive: existing.isActive ?? true,
        notes: existing.notes ?? '',
      }
    : {
        packagingCategory: 'other',
        tolerancePercent: 1,
        isActive: true,
        notes: '',
      };

  return (
    <PackagingToleranceFormInner
      key={id ?? 'new'}
      mode={mode}
      id={id}
      initialData={initialData}
      existing={existing}
    />
  );
}

function PackagingToleranceFormInner({
  mode,
  id,
  initialData,
  existing,
}: PackagingToleranceFormProps & { initialData: FormData; existing?: PackagingTolerance }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useTranslations('packaging');

  const [formData, setFormData] = React.useState<FormData>(initialData);

  const categoryOptions = PACKAGING_CATEGORIES.map((c) => ({
    value: c,
    label: t(`tolerances.categories.${c}`),
  }));

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (mode === 'edit') {
        const res = await fetch(`/api/master-data/packaging-tolerances/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tolerancePercent: data.tolerancePercent,
            isActive: data.isActive,
            notes: data.notes || undefined,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result?.error ?? 'Update failed');
        return result;
      } else {
        const res = await fetch('/api/master-data/packaging-tolerances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packagingCategory: data.packagingCategory,
            tolerancePercent: data.tolerancePercent,
            notes: data.notes || undefined,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result?.error ?? 'Create failed');
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging-tolerances'] });
      if (mode === 'edit') {
        queryClient.invalidateQueries({ queryKey: ['packaging-tolerance', id] });
      }
      const catLabel = categoryOptions.find((c) => c.value === formData.packagingCategory)?.label ?? formData.packagingCategory;
      toast.success(
        mode === 'edit' ? 'อัปเดตสำเร็จ' : 'สร้างสำเร็จ',
        `Tolerance หมวด "${catLabel}" ถูก${mode === 'edit' ? 'อัปเดต' : 'สร้าง'}เรียบร้อยแล้ว`,
      );
      router.push('/master-data/packaging-tolerances');
    },
    onError: (error: Error) => {
      toast.error('ผิดพลาด', error.message);
    },
  });

  const handleSave = () => {
    if (mode === 'create' && !formData.packagingCategory) {
      toast.error('ข้อมูลไม่ครบถ้วน', 'กรุณาเลือกหมวด Packaging');
      return;
    }
    if (formData.tolerancePercent < 0 || formData.tolerancePercent > 100) {
      toast.error('ข้อมูลไม่ถูกต้อง', 'Tolerance ต้องอยู่ระหว่าง 0–100%');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleCancel = () => {
    router.push('/master-data/packaging-tolerances');
  };

  const pageTitle = mode === 'edit'
    ? `แก้ไข Tolerance`
    : 'เพิ่มหมวด Tolerance';

  const pageSubtitle = mode === 'edit'
    ? `กำลังแก้ไข: ${categoryOptions.find((c) => c.value === existing?.packagingCategory)?.label ?? existing?.packagingCategory ?? ''}`
    : 'ตั้งค่าเกณฑ์ Variance Tolerance ของหมวด Packaging ใหม่';

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-4xl mx-auto">
      <ResponsivePageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        icon={Sliders}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        onBack={handleCancel}
        breadcrumbs={[
          { label: 'ข้อมูลหลัก', href: '/master-data' },
          { label: t('tolerances.title'), href: '/master-data/packaging-tolerances' },
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
            ข้อมูล Tolerance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Category — fixed in edit mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('tolerances.columns.category')} *
            </label>
            {mode === 'create' ? (
              <DxSelectBox
                dataSource={categoryOptions}
                displayExpr="label"
                valueExpr="value"
                value={formData.packagingCategory}
                onValueChanged={(e) =>
                  setFormData({ ...formData, packagingCategory: e.value as PackagingCategory })
                }
                placeholder="เลือกหมวด Packaging"
              />
            ) : (
              <div
                className="px-3 py-2 rounded bg-gray-50 border border-gray-200 text-sm text-gray-700"
                data-testid="packaging-tolerance-category-readonly"
              >
                {categoryOptions.find((c) => c.value === formData.packagingCategory)?.label ?? formData.packagingCategory}
              </div>
            )}
          </div>

          {/* Tolerance percent */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('tolerances.columns.tolerancePercent')} * (0–100)
            </label>
            <DxNumberBox
              value={formData.tolerancePercent}
              min={0}
              max={100}
              step={0.1}
              showSpinButtons
              format="#0.00"
              onValueChanged={(e) =>
                setFormData({ ...formData, tolerancePercent: Number(e.value ?? 0) })
              }
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('tolerances.columns.notes')}
            </label>
            <TextArea
              value={formData.notes}
              height={80}
              maxLength={500}
              onValueChanged={(e) =>
                setFormData({ ...formData, notes: String(e.value ?? '') })
              }
              data-testid="packaging-tolerance-notes"
            />
          </div>

          {/* isActive */}
          <div className="flex items-center gap-2 pt-2">
            <DxSwitch
              value={formData.isActive}
              onValueChanged={(e: SwitchTypes.ValueChangedEvent) =>
                setFormData({ ...formData, isActive: e.value })
              }
            />
            <span className="text-sm text-gray-700">{t('tolerances.columns.isActive')}</span>
          </div>
        </CardContent>
      </Card>

      {/* Bottom actions */}
      <div className="flex justify-end gap-2 pt-4">
        <DxButton
          text="ยกเลิก"
          stylingMode="outlined"
          onClick={handleCancel}
        />
        <DxButton
          text={
            saveMutation.isPending
              ? 'กำลังบันทึก...'
              : mode === 'edit'
              ? 'อัปเดต Tolerance'
              : 'สร้าง Tolerance'
          }
          type="success"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          data-testid="packaging-tolerance-save-btn"
        />
      </div>
    </div>
  );
}
