'use client';

/**
 * Maintenance Plan Template Form Component
 * Reusable form for creating and editing maintenance plan templates
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSwitch } from '@/components/ui/dx-switch';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import type { SwitchTypes } from 'devextreme-react/switch';
import { useToast } from '@/hooks/use-toast';
import { Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MaintenancePlanTemplate } from '@/types/equipment-notifications';

export interface MaintenancePlanTemplateFormProps {
  mode: 'create' | 'edit';
  id?: number;
}

const MAINTENANCE_TYPES = [
  { value: 'preventive', label: 'เชิงป้องกัน (Preventive)' },
  { value: 'calibration', label: 'การสอบเทียบ (Calibration)' },
  { value: 'inspection', label: 'การตรวจสอบ (Inspection)' },
  { value: 'corrective', label: 'แก้ไข (Corrective)' },
];

const INTERVAL_TYPES = [
  { value: 'days', label: 'วัน' },
  { value: 'weeks', label: 'สัปดาห์' },
  { value: 'months', label: 'เดือน' },
  { value: 'hours', label: 'ชั่วโมง' },
  { value: 'units', label: 'หน่วย' },
];

interface FormData {
  name: string;
  description: string;
  maintenanceType: string;
  intervalType: string;
  intervalValue: number;
  alertDaysBefore: number;
  isActive: boolean;
}

const EMPTY_FORM: FormData = {
  name: '',
  description: '',
  maintenanceType: 'preventive',
  intervalType: 'months',
  intervalValue: 6,
  alertDaysBefore: 14,
  isActive: true,
};

export function MaintenancePlanTemplateForm({ mode, id }: MaintenancePlanTemplateFormProps) {
  const { data: existing, isLoading } = useQuery<MaintenancePlanTemplate>({
    queryKey: ['mp-template', id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/maintenance-plan-templates/${id}`);
      if (!res.ok) throw new Error('ไม่พบข้อมูลแม่แบบ');
      return res.json();
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
        name: existing.name ?? '',
        description: existing.description ?? '',
        maintenanceType: existing.maintenanceType ?? 'preventive',
        intervalType: existing.intervalType ?? 'months',
        intervalValue: existing.intervalValue ?? 6,
        alertDaysBefore: existing.alertDaysBefore ?? 14,
        isActive: existing.isActive ?? true,
      }
    : { ...EMPTY_FORM };

  return (
    <MaintenancePlanTemplateFormInner
      key={id ?? 'new'}
      mode={mode}
      id={id}
      initialData={initialData}
      existing={existing}
    />
  );
}

function MaintenancePlanTemplateFormInner({
  mode,
  id,
  initialData,
  existing,
}: MaintenancePlanTemplateFormProps & {
  initialData: FormData;
  existing?: MaintenancePlanTemplate;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [formData, setFormData] = React.useState<FormData>(initialData);

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (mode === 'edit') {
        const res = await fetch(`/api/master-data/maintenance-plan-templates/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? 'Failed to update');
        return body;
      } else {
        const res = await fetch('/api/master-data/maintenance-plan-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? 'Failed to create');
        return body;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mp-templates'] });
      queryClient.invalidateQueries({ queryKey: ['mp-template', id] });
      toast.success(
        mode === 'edit' ? 'อัปเดตแม่แบบแล้ว' : 'สร้างแม่แบบแล้ว',
        `${formData.name} ถูก${mode === 'edit' ? 'อัปเดต' : 'สร้าง'}เรียบร้อยแล้ว`,
      );
      router.push('/master-data/maintenance-plan-templates');
    },
    onError: (error: Error) => {
      toast.error('ผิดพลาด', error.message);
    },
  });

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อแม่แบบ');
      return;
    }
    if (!formData.maintenanceType) {
      toast.error('ข้อมูลไม่ครบถ้วน', 'กรุณาเลือกประเภทการบำรุงรักษา');
      return;
    }
    if (!formData.intervalType) {
      toast.error('ข้อมูลไม่ครบถ้วน', 'กรุณาเลือกหน่วยรอบ');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleCancel = () => {
    router.push('/master-data/maintenance-plan-templates');
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-4xl mx-auto">
      <ResponsivePageHeader
        title={mode === 'edit' ? 'แก้ไขแม่แบบแผนบำรุงรักษา' : 'เพิ่มแม่แบบแผนบำรุงรักษา'}
        subtitle={
          mode === 'edit'
            ? `กำลังแก้ไข ${existing?.name ?? ''}`
            : 'สร้างแม่แบบแผนบำรุงรักษาใหม่'
        }
        icon={Wrench}
        iconBgColor="bg-amber-100"
        iconColor="text-amber-600"
        breadcrumbs={[
          { label: 'ข้อมูลหลัก', href: '/master-data' },
          {
            label: 'แม่แบบแผนบำรุงรักษา',
            href: '/master-data/maintenance-plan-templates',
          },
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
            <Wrench className="h-5 w-5 text-amber-600" />
            ข้อมูลแม่แบบ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* ชื่อ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อแม่แบบ *</label>
            <DxTextBox
              value={formData.name}
              onValueChanged={(e) => setFormData({ ...formData, name: e.value ?? '' })}
              placeholder="เช่น บำรุงรักษาเชิงป้องกันทุก 6 เดือน"
              elementAttr={{ 'data-testid': 'mpt-name' }}
            />
          </div>

          {/* รายละเอียด */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
            <DxTextBox
              value={formData.description}
              onValueChanged={(e) => setFormData({ ...formData, description: e.value ?? '' })}
              placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
              elementAttr={{ 'data-testid': 'mpt-description' }}
            />
          </div>

          {/* ประเภท + หน่วยรอบ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ประเภทการบำรุงรักษา *
              </label>
              <div data-testid="mpt-maintenance-type">
              <DxSelectBox
                dataSource={MAINTENANCE_TYPES}
                displayExpr="label"
                valueExpr="value"
                value={formData.maintenanceType}
                onValueChanged={(e) =>
                  setFormData({ ...formData, maintenanceType: String(e.value ?? '') })
                }
                placeholder="เลือกประเภท"
              />
            </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">หน่วยรอบ *</label>
              <div data-testid="mpt-interval-type">
              <DxSelectBox
                dataSource={INTERVAL_TYPES}
                displayExpr="label"
                valueExpr="value"
                value={formData.intervalType}
                onValueChanged={(e) =>
                  setFormData({ ...formData, intervalType: String(e.value ?? '') })
                }
                placeholder="เลือกหน่วย"
              />
            </div>
            </div>
          </div>

          {/* ค่ารอบ + แจ้งเตือนล่วงหน้า */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ค่ารอบ *</label>
              <DxNumberBox
                value={formData.intervalValue}
                min={1}
                step={1}
                showSpinButtons
                onValueChanged={(e) =>
                  setFormData({ ...formData, intervalValue: Number(e.value ?? 1) })
                }
                placeholder="เช่น 6"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                แจ้งเตือนล่วงหน้า (วัน)
              </label>
              <DxNumberBox
                value={formData.alertDaysBefore}
                min={0}
                max={365}
                step={1}
                showSpinButtons
                onValueChanged={(e) =>
                  setFormData({ ...formData, alertDaysBefore: Number(e.value ?? 0) })
                }
                placeholder="เช่น 14"
              />
            </div>
          </div>

          {/* สถานะ */}
          <div
            className="flex items-center gap-2 pt-2"
            data-testid="mpt-active-toggle"
          >
            <DxSwitch
              value={formData.isActive}
              onValueChanged={(e: SwitchTypes.ValueChangedEvent) =>
                setFormData({ ...formData, isActive: e.value })
              }
            />
            <span className="text-sm text-gray-700">ใช้งาน</span>
          </div>
        </CardContent>
      </Card>

      {/* Bottom actions */}
      <div className="flex justify-end gap-2 pt-4">
        <DxButton text="ยกเลิก" stylingMode="outlined" onClick={handleCancel} />
        <DxButton
          text={
            saveMutation.isPending
              ? 'กำลังบันทึก...'
              : mode === 'edit'
                ? 'อัปเดตแม่แบบ'
                : 'สร้างแม่แบบ'
          }
          type="success"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          elementAttr={{ 'data-testid': 'mpt-save-btn' }}
        />
      </div>
    </div>
  );
}
