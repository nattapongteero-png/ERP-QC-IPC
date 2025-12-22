'use client';

/**
 * Pest Control Logs Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * List and record pest control service logs.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

const serviceTypeOptions = [
  { value: '', text: 'All Types' },
  { value: 'routine', text: 'Routine' },
  { value: 'emergency', text: 'Emergency' },
  { value: 'follow_up', text: 'Follow-up' },
];

const areaOptions = [
  'Production Area',
  'Warehouse',
  'Laboratory',
  'Office',
  'Loading Dock',
  'Perimeter',
  'Kitchen/Cafeteria',
  'Restrooms',
];

export default function PestControlLogsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [serviceTypeFilter, setServiceTypeFilter] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState<Partial<PestControlLogCreate>>({
    serviceDate: new Date().toISOString().split('T')[0],
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
        serviceDate: new Date().toISOString().split('T')[0],
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
        title="Pest Control"
        subtitle="Record and track pest control services"
        onBack={() => router.push('/gmp/sanitation')}
        actions={
          <DxButton
            text="Record Service"
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
          placeholder="Service Type"
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
        title="Record Pest Control Service"
        width={600}
        height="auto"
      >
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Service Date *</label>
              <DxDateBox
                value={formData.serviceDate}
                onValueChanged={(e) =>
                  setFormData({
                    ...formData,
                    serviceDate:
                      typeof e.value === 'string'
                        ? e.value
                        : e.value?.toISOString().split('T')[0],
                  })
                }
                type="date"
                displayFormat="yyyy-MM-dd"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Service Type *</label>
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
              <label className="block text-sm font-medium mb-1">Contractor Name *</label>
              <DxTextBox
                value={formData.contractorName || ''}
                onValueChanged={(e) => setFormData({ ...formData, contractorName: e.value })}
                placeholder="Company name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Technician Name</label>
              <DxTextBox
                value={formData.technicianName || ''}
                onValueChanged={(e) => setFormData({ ...formData, technicianName: e.value })}
                placeholder="Technician name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Areas Serviced *</label>
            <DxTagBox
              items={areaOptions}
              value={formData.areasServiced}
              onValueChanged={(e) => setFormData({ ...formData, areasServiced: e.value })}
              showSelectionControls
              searchEnabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Treatment Method</label>
            <DxTextBox
              value={formData.treatmentMethod || ''}
              onValueChanged={(e) => setFormData({ ...formData, treatmentMethod: e.value })}
              placeholder="Describe treatment method"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Findings Count</label>
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
              <label className="text-sm">Follow-up Required</label>
            </div>
          </div>

          {formData.followUpRequired && (
            <div>
              <label className="block text-sm font-medium mb-1">Follow-up Date</label>
              <DxDateBox
                value={formData.followUpDate}
                onValueChanged={(e) =>
                  setFormData({
                    ...formData,
                    followUpDate:
                      typeof e.value === 'string'
                        ? e.value
                        : e.value?.toISOString().split('T')[0],
                  })
                }
                type="date"
                displayFormat="yyyy-MM-dd"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Findings</label>
            <DxTextArea
              value={formData.findings || ''}
              onValueChanged={(e) => setFormData({ ...formData, findings: e.value })}
              placeholder="Describe any pest findings"
              height={80}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Recommendations</label>
            <DxTextArea
              value={formData.recommendations || ''}
              onValueChanged={(e) => setFormData({ ...formData, recommendations: e.value })}
              placeholder="Recommendations from service provider"
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
