'use client';

/**
 * Sanitation Schedules Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * List and manage sanitation schedules.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { SanitationScheduleList } from '@/components/sanitation';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import type { SanitationSchedule, SanitationScheduleCreate, AreaType, SanitationFrequency } from '@/types/sanitation';

// ============================================
// API Functions
// ============================================

async function fetchSchedules(params: Record<string, string>): Promise<SanitationSchedule[]> {
  const searchParams = new URLSearchParams(params);
  const response = await fetch(`/api/sanitation/schedules?${searchParams}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function createSchedule(data: SanitationScheduleCreate): Promise<SanitationSchedule> {
  const response = await fetch('/api/sanitation/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

// ============================================
// Component
// ============================================

const areaTypeOptions = [
  { value: '', text: 'ทุกพื้นที่' },
  { value: 'production', text: 'พื้นที่ผลิต' },
  { value: 'warehouse', text: 'คลังจัดเก็บ' },
  { value: 'lab', text: 'ห้องปฏิบัติการ' },
  { value: 'office', text: 'สำนักงาน' },
];

const frequencyOptions = [
  { value: '', text: 'ทุกความถี่' },
  { value: 'daily', text: 'รายวัน' },
  { value: 'weekly', text: 'รายสัปดาห์' },
  { value: 'monthly', text: 'รายเดือน' },
  { value: 'quarterly', text: 'รายไตรมาส' },
];

export default function SanitationSchedulesPage() {
  const router = useRouter();
  const t = useTranslations('gmp');
  const queryClient = useQueryClient();

  const [areaTypeFilter, setAreaTypeFilter] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState<Partial<SanitationScheduleCreate>>({
    verificationRequired: true,
  });

  const queryParams: Record<string, string> = {};
  if (areaTypeFilter) queryParams.areaType = areaTypeFilter;
  if (frequencyFilter) queryParams.frequency = frequencyFilter;

  const { data: schedules, isLoading } = useQuery({
    queryKey: ['sanitation-schedules', queryParams],
    queryFn: () => fetchSchedules(queryParams),
  });

  const createMutation = useMutation({
    mutationFn: createSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sanitation-schedules'] });
      setShowCreateDialog(false);
      setFormData({ verificationRequired: true });
    },
  });

  const handleCreate = () => {
    if (!formData.name || !formData.areaType || !formData.frequency || !formData.method) {
      return;
    }
    createMutation.mutate(formData as SanitationScheduleCreate);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title={t('sanitation.schedules.title')}
        subtitle={t('sanitation.schedules.description')}
        breadcrumbs={[
          { label: 'อาคารและสถานที่', href: '/premises' },
          { label: t('sanitation.pageTitle'), href: '/premises/sanitation' },
          { label: t('sanitation.schedules.title') },
        ]}
        onBack={() => router.push('/premises/sanitation')}
        actions={
          <DxButton
            text="เพิ่มกำหนดการ"
            icon="plus"
            onClick={() => setShowCreateDialog(true)}
            type="default"
          />
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <DxSelectBox
          items={areaTypeOptions}
          value={areaTypeFilter}
          onValueChanged={(e) => setAreaTypeFilter(e.value)}
          displayExpr="text"
          valueExpr="value"
          width={160}
          placeholder="ประเภทพื้นที่"
        />
        <DxSelectBox
          items={frequencyOptions}
          value={frequencyFilter}
          onValueChanged={(e) => setFrequencyFilter(e.value)}
          displayExpr="text"
          valueExpr="value"
          width={160}
          placeholder="ความถี่"
        />
      </div>

      {/* Schedule List */}
      <div className="bg-card border rounded-lg p-4">
        <SanitationScheduleList
          schedules={schedules || []}
          loading={isLoading}
          onViewLogs={(scheduleId) =>
            router.push(`/gmp/sanitation/logs?scheduleId=${scheduleId}`)
          }
          onRecordLog={(scheduleId) =>
            router.push(`/gmp/sanitation/logs?scheduleId=${scheduleId}&new=1`)
          }
        />
      </div>

      {/* Create Dialog */}
      <DxPopup
        visible={showCreateDialog}
        onHiding={() => setShowCreateDialog(false)}
        title="เพิ่มกำหนดการสุขาภิบาล"
        width={500}
        height="auto"
      >
        <div className="space-y-4 p-4">
          <div>
            <label className="block text-sm font-medium mb-1">ชื่อกำหนดการ *</label>
            <DxTextBox
              value={formData.name || ''}
              onValueChanged={(e) => setFormData({ ...formData, name: e.value })}
              placeholder="กรอกชื่อกำหนดการ"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">ประเภทพื้นที่ *</label>
              <DxSelectBox
                items={areaTypeOptions.filter((o) => o.value)}
                value={formData.areaType || ''}
                onValueChanged={(e) =>
                  setFormData({ ...formData, areaType: e.value as AreaType })
                }
                displayExpr="text"
                valueExpr="value"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ความถี่ *</label>
              <DxSelectBox
                items={frequencyOptions.filter((o) => o.value)}
                value={formData.frequency || ''}
                onValueChanged={(e) =>
                  setFormData({ ...formData, frequency: e.value as SanitationFrequency })
                }
                displayExpr="text"
                valueExpr="value"
              />
            </div>
          </div>

          {formData.frequency === 'weekly' && (
            <div>
              <label className="block text-sm font-medium mb-1">วันในสัปดาห์</label>
              <DxSelectBox
                items={[
                  { value: 0, text: 'อาทิตย์' },
                  { value: 1, text: 'จันทร์' },
                  { value: 2, text: 'อังคาร' },
                  { value: 3, text: 'พุธ' },
                  { value: 4, text: 'พฤหัสบดี' },
                  { value: 5, text: 'ศุกร์' },
                  { value: 6, text: 'เสาร์' },
                ]}
                value={formData.dayOfWeek}
                onValueChanged={(e) => setFormData({ ...formData, dayOfWeek: e.value })}
                displayExpr="text"
                valueExpr="value"
              />
            </div>
          )}

          {(formData.frequency === 'monthly' || formData.frequency === 'quarterly') && (
            <div>
              <label className="block text-sm font-medium mb-1">วันที่ของเดือน</label>
              <DxNumberBox
                value={formData.dayOfMonth}
                onValueChanged={(e) => setFormData({ ...formData, dayOfMonth: e.value })}
                min={1}
                max={31}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">วิธีทำความสะอาด *</label>
            <DxTextArea
              value={formData.method || ''}
              onValueChanged={(e) => setFormData({ ...formData, method: e.value })}
              placeholder="อธิบายวิธีการทำความสะอาด"
              height={80}
            />
          </div>

          <div className="flex items-center gap-2">
            <DxCheckBox
              value={formData.verificationRequired}
              onValueChanged={(e) =>
                setFormData({ ...formData, verificationRequired: e.value })
              }
            />
            <label className="text-sm">ต้องมีการตรวจสอบ</label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <DxButton
              text="ยกเลิก"
              onClick={() => setShowCreateDialog(false)}
              stylingMode="outlined"
            />
            <DxButton
              text="สร้าง"
              onClick={handleCreate}
              type="default"
              disabled={createMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
