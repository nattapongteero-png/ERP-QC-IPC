'use client';

/**
 * Pest Control Logs Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * List and record pest control service logs.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toLocalDateStr } from '@/lib/utils/date-format';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { PestControlLogList } from '@/components/sanitation';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { DxTagBox } from '@/components/ui/dx-tag-box';
import type {
  PestControlLog,
  PestControlLogCreate,
  PestControlLogListResponse,
  PestControlServiceType,
} from '@/types/sanitation';

// ============================================
// API Functions
// ============================================

async function fetchLogs(params: Record<string, string>): Promise<PestControlLogListResponse> {
  const searchParams = new URLSearchParams(params);
  const response = await fetch(`/api/sanitation/pest-control?${searchParams}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function createLog(data: PestControlLogCreate): Promise<PestControlLog> {
  const response = await fetch('/api/sanitation/pest-control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function verifyLog(logId: number): Promise<PestControlLog> {
  const response = await fetch(`/api/sanitation/pest-control/${logId}/verify`, {
    method: 'POST',
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

// ============================================
// Component
// ============================================

const SERVICE_TYPE_VALUES = ['', 'routine', 'emergency', 'follow_up'] as const;
const AREA_OPTION_KEYS = [
  'production',
  'warehouse',
  'lab',
  'office',
  'loadingBay',
  'surrounding',
  'kitchen',
  'restroom',
] as const;

export default function PestControlLogsPage() {
  const router = useRouter();
  const t = useTranslations('gmp');
  const tp = useTranslations('premises');
  const queryClient = useQueryClient();

  const serviceTypeOptions = SERVICE_TYPE_VALUES.map((value) => ({
    value,
    text: tp('sanitation.pestControl.serviceType.' + (value || 'all')),
  }));

  // Areas serviced: store the translated label as value (matches API string[] contract)
  const areaOptions = AREA_OPTION_KEYS.map((key) => tp('sanitation.pestControl.areas.' + key));

  const [serviceTypeFilter, setServiceTypeFilter] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState<Partial<PestControlLogCreate>>({
    serviceDate: toLocalDateStr(new Date()),
    serviceType: 'routine',
    areasServiced: [],
    findingsCount: 0,
    followUpRequired: false,
  });

  const queryParams: Record<string, string> = { limit: '50' };
  if (serviceTypeFilter) queryParams.serviceType = serviceTypeFilter;

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['pest-control-logs', queryParams],
    queryFn: () => fetchLogs(queryParams),
  });

  const createMutation = useMutation({
    mutationFn: createLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pest-control-logs'] });
      queryClient.invalidateQueries({ queryKey: ['sanitation-trends'] });
      setShowCreateDialog(false);
      setFormData({
        serviceDate: toLocalDateStr(new Date()),
        serviceType: 'routine',
        areasServiced: [],
        findingsCount: 0,
        followUpRequired: false,
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: verifyLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pest-control-logs'] });
    },
  });

  const handleCreate = () => {
    if (
      !formData.serviceDate ||
      !formData.contractorName ||
      !formData.serviceType ||
      !formData.areasServiced?.length
    ) {
      return;
    }
    createMutation.mutate(formData as PestControlLogCreate);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title={t('sanitation.pestControl.title')}
        subtitle={t('sanitation.pestControl.description')}
        breadcrumbs={[
          { label: tp('sanitation.common.breadcrumbPremises'), href: '/premises' },
          { label: t('sanitation.pageTitle'), href: '/premises/sanitation' },
          { label: t('sanitation.pestControl.title') },
        ]}
        onBack={() => router.push('/premises/sanitation')}
        actions={
          <DxButton
            text={tp('sanitation.pestControl.recordService')}
            icon="plus"
            onClick={() => setShowCreateDialog(true)}
            type="default"
          />
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <DxSelectBox
          items={serviceTypeOptions}
          value={serviceTypeFilter}
          onValueChanged={(e) => setServiceTypeFilter(e.value)}
          displayExpr="text"
          valueExpr="value"
          width={160}
          placeholder={tp('sanitation.pestControl.serviceTypePlaceholder')}
        />
      </div>

      {/* Log List */}
      <div className="bg-card border rounded-lg p-4">
        <PestControlLogList
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
        title={tp('sanitation.pestControl.dialogTitle')}
        width={600}
        height="auto"
      >
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{tp('sanitation.pestControl.form.serviceDate')} *</label>
              <DxDateBox
                value={formData.serviceDate}
                onValueChanged={(e) =>
                  setFormData({
                    ...formData,
                    serviceDate:
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
              <label className="block text-sm font-medium mb-1">{tp('sanitation.pestControl.form.serviceType')} *</label>
              <DxSelectBox
                items={serviceTypeOptions.filter((o) => o.value)}
                value={formData.serviceType}
                onValueChanged={(e) =>
                  setFormData({ ...formData, serviceType: e.value as PestControlServiceType })
                }
                displayExpr="text"
                valueExpr="value"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{tp('sanitation.pestControl.form.contractorName')} *</label>
              <DxTextBox
                value={formData.contractorName || ''}
                onValueChanged={(e) => setFormData({ ...formData, contractorName: e.value })}
                placeholder={tp('sanitation.pestControl.form.contractorNamePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{tp('sanitation.pestControl.form.technicianName')}</label>
              <DxTextBox
                value={formData.technicianName || ''}
                onValueChanged={(e) => setFormData({ ...formData, technicianName: e.value })}
                placeholder={tp('sanitation.pestControl.form.technicianNamePlaceholder')}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{tp('sanitation.pestControl.form.areasServiced')} *</label>
            <DxTagBox
              items={areaOptions}
              value={formData.areasServiced}
              onValueChanged={(e) => setFormData({ ...formData, areasServiced: e.value })}
              showSelectionControls
              searchEnabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{tp('sanitation.pestControl.form.treatmentMethod')}</label>
            <DxTextBox
              value={formData.treatmentMethod || ''}
              onValueChanged={(e) => setFormData({ ...formData, treatmentMethod: e.value })}
              placeholder={tp('sanitation.pestControl.form.treatmentMethodPlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{tp('sanitation.pestControl.form.findingsCount')}</label>
              <DxNumberBox
                value={formData.findingsCount}
                onValueChanged={(e) => setFormData({ ...formData, findingsCount: e.value })}
                min={0}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <DxCheckBox
                value={formData.followUpRequired}
                onValueChanged={(e) =>
                  setFormData({ ...formData, followUpRequired: e.value })
                }
              />
              <label className="text-sm">{tp('sanitation.pestControl.form.followUpRequired')}</label>
            </div>
          </div>

          {formData.followUpRequired && (
            <div>
              <label className="block text-sm font-medium mb-1">{tp('sanitation.pestControl.form.followUpDate')}</label>
              <DxDateBox
                value={formData.followUpDate}
                onValueChanged={(e) =>
                  setFormData({
                    ...formData,
                    followUpDate:
                      typeof e.value === 'string'
                        ? e.value
                        : e.value ? toLocalDateStr(e.value) : '',
                  })
                }
                type="date"
                displayFormat="yyyy-MM-dd"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">{tp('sanitation.pestControl.form.findings')}</label>
            <DxTextArea
              value={formData.findings || ''}
              onValueChanged={(e) => setFormData({ ...formData, findings: e.value })}
              placeholder={tp('sanitation.pestControl.form.findingsPlaceholder')}
              height={80}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{tp('sanitation.pestControl.form.recommendations')}</label>
            <DxTextArea
              value={formData.recommendations || ''}
              onValueChanged={(e) => setFormData({ ...formData, recommendations: e.value })}
              placeholder={tp('sanitation.pestControl.form.recommendationsPlaceholder')}
              height={80}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <DxButton
              text={tp('sanitation.common.cancel')}
              onClick={() => setShowCreateDialog(false)}
              stylingMode="outlined"
            />
            <DxButton
              text={tp('sanitation.common.save')}
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
