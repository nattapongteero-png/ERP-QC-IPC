'use client';

/**
 * Sanitation Logs Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * List and record sanitation logs.
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toLocalDateStr } from '@/lib/utils/date-format';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { SanitationLogList } from '@/components/sanitation';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxTextBox } from '@/components/ui/dx-text-box';
import type {
  SanitationLog,
  SanitationLogCreate,
  SanitationLogListResponse,
  SanitationSchedule,
  SanitationLogStatus,
} from '@/types/sanitation';

// ============================================
// API Functions
// ============================================

async function fetchLogs(params: Record<string, string>): Promise<SanitationLogListResponse> {
  const searchParams = new URLSearchParams(params);
  const response = await fetch(`/api/sanitation/logs?${searchParams}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function fetchSchedules(): Promise<SanitationSchedule[]> {
  const response = await fetch('/api/sanitation/schedules?isActive=true');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function createLog(data: SanitationLogCreate): Promise<SanitationLog> {
  const response = await fetch('/api/sanitation/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function verifyLog(logId: number): Promise<SanitationLog> {
  const response = await fetch(`/api/sanitation/logs/${logId}/verify`, {
    method: 'POST',
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

// ============================================
// Component
// ============================================

const statusOptions = [
  { value: '', text: 'All Statuses' },
  { value: 'completed', text: 'Completed' },
  { value: 'partial', text: 'Partial' },
  { value: 'missed', text: 'Missed' },
];

export default function SanitationLogsPage() {
  const router = useRouter();
  const t = useTranslations('gmp');
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const scheduleIdParam = searchParams.get('scheduleId');
  const showNewParam = searchParams.get('new');

  const [scheduleFilter, setScheduleFilter] = useState(scheduleIdParam || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(showNewParam === '1');
  const [formData, setFormData] = useState<Partial<SanitationLogCreate>>({
    scheduleId: scheduleIdParam ? parseInt(scheduleIdParam, 10) : undefined,
    performedDate: toLocalDateStr(new Date()),
    status: 'completed',
  });

  const queryParams: Record<string, string> = { limit: '50' };
  if (scheduleFilter) queryParams.scheduleId = scheduleFilter;
  if (statusFilter) queryParams.status = statusFilter;

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['sanitation-logs', queryParams],
    queryFn: () => fetchLogs(queryParams),
  });

  const { data: schedules } = useQuery({
    queryKey: ['sanitation-schedules-active'],
    queryFn: fetchSchedules,
  });

  const createMutation = useMutation({
    mutationFn: createLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sanitation-logs'] });
      queryClient.invalidateQueries({ queryKey: ['sanitation-pending'] });
      setShowCreateDialog(false);
      setFormData({
        performedDate: toLocalDateStr(new Date()),
        status: 'completed',
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: verifyLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sanitation-logs'] });
    },
  });

  const handleCreate = () => {
    if (!formData.scheduleId || !formData.performedDate || !formData.status) {
      return;
    }
    createMutation.mutate(formData as SanitationLogCreate);
  };

  const scheduleOptions = [
    { id: '', name: 'All Schedules' },
    ...(schedules || []).map((s) => ({ id: String(s.id), name: s.name })),
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title={t('sanitation.logs.title')}
        subtitle={t('sanitation.logs.description')}
        onBack={() => router.push('/gmp/sanitation')}
        actions={
          <DxButton
            text="Record Log"
            icon="plus"
            onClick={() => setShowCreateDialog(true)}
            type="default"
          />
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <DxSelectBox
          items={scheduleOptions}
          value={scheduleFilter}
          onValueChanged={(e) => setScheduleFilter(e.value)}
          displayExpr="name"
          valueExpr="id"
          width={200}
          placeholder="Filter by Schedule"
        />
        <DxSelectBox
          items={statusOptions}
          value={statusFilter}
          onValueChanged={(e) => setStatusFilter(e.value)}
          displayExpr="text"
          valueExpr="value"
          width={160}
          placeholder="Status"
        />
      </div>

      {/* Log List */}
      <div className="bg-card border rounded-lg p-4">
        <SanitationLogList
          logs={logsData?.logs || []}
          loading={isLoading}
          canVerify={true}
          onVerify={(logId) => verifyMutation.mutate(logId)}
        />
      </div>

      {/* Create Dialog */}
      <DxPopup
        visible={showCreateDialog}
        onHiding={() => setShowCreateDialog(false)}
        title="Record Sanitation Log"
        width={500}
        height="auto"
      >
        <div className="space-y-4 p-4">
          <div>
            <label className="block text-sm font-medium mb-1">Schedule *</label>
            <DxSelectBox
              items={(schedules || []) as unknown as Array<{ id: number; name: string }>}
              value={formData.scheduleId}
              onValueChanged={(e) => setFormData({ ...formData, scheduleId: e.value })}
              displayExpr="name"
              valueExpr="id"
              placeholder="Select schedule"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Performed Date *</label>
              <DxDateBox
                value={formData.performedDate}
                onValueChanged={(e) =>
                  setFormData({
                    ...formData,
                    performedDate:
                      typeof e.value === 'string'
                        ? e.value
                        : e.value ? toLocalDateStr(e.value) : '',
                  })
                }
                type="date"
                displayFormat="yyyy-MM-dd"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status *</label>
              <DxSelectBox
                items={statusOptions.filter((o) => o.value)}
                value={formData.status}
                onValueChanged={(e) =>
                  setFormData({ ...formData, status: e.value as SanitationLogStatus })
                }
                displayExpr="text"
                valueExpr="value"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Chemicals Used</label>
            <DxTextBox
              value={formData.chemicalsUsed || ''}
              onValueChanged={(e) => setFormData({ ...formData, chemicalsUsed: e.value })}
              placeholder="List chemicals used"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <DxTextArea
              value={formData.notes || ''}
              onValueChanged={(e) => setFormData({ ...formData, notes: e.value })}
              placeholder="Additional notes"
              height={80}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <DxButton
              text="Cancel"
              onClick={() => setShowCreateDialog(false)}
              stylingMode="outlined"
            />
            <DxButton
              text="Record"
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
