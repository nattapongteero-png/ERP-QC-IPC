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

const AREA_TYPE_VALUES = ['', 'production', 'warehouse', 'lab', 'office'] as const;
const FREQUENCY_VALUES = ['', 'daily', 'weekly', 'monthly', 'quarterly'] as const;
const DAY_OF_WEEK_VALUES = [0, 1, 2, 3, 4, 5, 6] as const;

export default function SanitationSchedulesPage() {
  const router = useRouter();
  const t = useTranslations('gmp');
  const tp = useTranslations('premises');
  const queryClient = useQueryClient();

  const areaTypeOptions = AREA_TYPE_VALUES.map((value) => ({
    value,
    text: value ? tp('sanitation.common.area.' + value) : tp('sanitation.schedules.areaType.all'),
  }));

  const frequencyOptions = FREQUENCY_VALUES.map((value) => ({
    value,
    text: tp('sanitation.schedules.frequency.' + (value || 'all')),
  }));

  const dayOfWeekOptions = DAY_OF_WEEK_VALUES.map((value) => ({
    value,
    text: tp('sanitation.schedules.dayOfWeek.' + value),
  }));

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
          { label: tp('sanitation.common.breadcrumbPremises'), href: '/premises' },
          { label: t('sanitation.pageTitle'), href: '/premises/sanitation' },
          { label: t('sanitation.schedules.title') },
        ]}
        onBack={() => router.push('/premises/sanitation')}
        actions={
          <DxButton
            text={tp('sanitation.schedules.addSchedule')}
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
          placeholder={tp('sanitation.schedules.areaTypePlaceholder')}
        />
        <DxSelectBox
          items={frequencyOptions}
          value={frequencyFilter}
          onValueChanged={(e) => setFrequencyFilter(e.value)}
          displayExpr="text"
          valueExpr="value"
          width={160}
          placeholder={tp('sanitation.schedules.frequencyPlaceholder')}
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
        title={tp('sanitation.schedules.dialogTitle')}
        width={500}
        height="auto"
      >
        <div className="space-y-4 p-4">
          <div>
            <label className="block text-sm font-medium mb-1">{tp('sanitation.schedules.form.name')} *</label>
            <DxTextBox
              value={formData.name || ''}
              onValueChanged={(e) => setFormData({ ...formData, name: e.value })}
              placeholder={tp('sanitation.schedules.form.namePlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{tp('sanitation.schedules.form.areaType')} *</label>
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
              <label className="block text-sm font-medium mb-1">{tp('sanitation.schedules.form.frequency')} *</label>
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
              <label className="block text-sm font-medium mb-1">{tp('sanitation.schedules.form.dayOfWeek')}</label>
              <DxSelectBox
                items={dayOfWeekOptions}
                value={formData.dayOfWeek}
                onValueChanged={(e) => setFormData({ ...formData, dayOfWeek: e.value })}
                displayExpr="text"
                valueExpr="value"
              />
            </div>
          )}

          {(formData.frequency === 'monthly' || formData.frequency === 'quarterly') && (
            <div>
              <label className="block text-sm font-medium mb-1">{tp('sanitation.schedules.form.dayOfMonth')}</label>
              <DxNumberBox
                value={formData.dayOfMonth}
                onValueChanged={(e) => setFormData({ ...formData, dayOfMonth: e.value })}
                min={1}
                max={31}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">{tp('sanitation.schedules.form.method')} *</label>
            <DxTextArea
              value={formData.method || ''}
              onValueChanged={(e) => setFormData({ ...formData, method: e.value })}
              placeholder={tp('sanitation.schedules.form.methodPlaceholder')}
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
            <label className="text-sm">{tp('sanitation.schedules.form.verificationRequired')}</label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <DxButton
              text={tp('sanitation.common.cancel')}
              onClick={() => setShowCreateDialog(false)}
              stylingMode="outlined"
            />
            <DxButton
              text={tp('sanitation.common.create')}
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
