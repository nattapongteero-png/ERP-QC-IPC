'use client';

/**
 * Work Center Form Component
 * Creates/edits work center configurations with labor and overhead rates
 * Feature: 014-unit-cost (US6 - Work Center Configuration)
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from 'devextreme-react/button';
import { TextBox } from 'devextreme-react/text-box';
import { NumberBox } from 'devextreme-react/number-box';
import { SelectBox } from 'devextreme-react/select-box';
import { Switch } from 'devextreme-react/switch';
import notify from 'devextreme/ui/notify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsivePageHeader } from '@/components/shared';
import { Factory, DollarSign, Clock, Loader2 } from 'lucide-react';
import type { WorkCenter, WorkCenterCreate, WorkCenterUpdate } from '@/types/unit-cost';

export interface WorkCenterFormProps {
  mode: 'create' | 'edit';
  workCenterId?: number;
}

interface OrgUnit {
  id: number;
  code: string;
  name: string;
}

interface FormData {
  code: string;
  name: string;
  nameTh: string;
  orgUnitId: number | null;
  laborRatePerHour: number;
  overheadRatePerHour: number;
  machineRatePerHour: number;
  capacityHoursPerDay: number | undefined;
  isActive: boolean;
}

const initialFormData: FormData = {
  code: '',
  name: '',
  nameTh: '',
  orgUnitId: null,
  laborRatePerHour: 0,
  overheadRatePerHour: 0,
  machineRatePerHour: 0,
  capacityHoursPerDay: 8,
  isActive: true,
};

export function WorkCenterForm({ mode, workCenterId }: WorkCenterFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch work center data for edit mode
  const { data: workCenter, isLoading: isLoadingWorkCenter } = useQuery<WorkCenter>({
    queryKey: ['work-center', workCenterId],
    queryFn: async () => {
      const res = await fetch(`/api/cost/work-centers/${workCenterId}`);
      if (!res.ok) throw new Error('Failed to fetch work center');
      const json = await res.json();
      return json.data;
    },
    enabled: mode === 'edit' && !!workCenterId,
  });

  // Fetch org units for dropdown
  const { data: orgUnits } = useQuery<OrgUnit[]>({
    queryKey: ['org-units'],
    queryFn: async () => {
      const res = await fetch('/api/hr/org-units?isActive=true');
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (workCenter && mode === 'edit') {
      setFormData({
        code: workCenter.code,
        name: workCenter.name,
        nameTh: workCenter.nameTh || '',
        orgUnitId: workCenter.orgUnitId,
        laborRatePerHour: workCenter.laborRatePerHour,
        overheadRatePerHour: workCenter.overheadRatePerHour,
        machineRatePerHour: workCenter.machineRatePerHour,
        capacityHoursPerDay: workCenter.capacityHoursPerDay ?? undefined,
        isActive: workCenter.isActive,
      });
    }
  }, [workCenter, mode]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: WorkCenterCreate) => {
      const res = await fetch('/api/cost/work-centers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to create work center');
      }
      return res.json();
    },
    onSuccess: () => {
      notify('Work center created successfully', 'success', 3000);
      queryClient.invalidateQueries({ queryKey: ['work-centers'] });
      router.push('/cost/work-centers');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: WorkCenterUpdate) => {
      const res = await fetch(`/api/cost/work-centers/${workCenterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to update work center');
      }
      return res.json();
    },
    onSuccess: () => {
      notify('Work center updated successfully', 'success', 3000);
      queryClient.invalidateQueries({ queryKey: ['work-centers'] });
      queryClient.invalidateQueries({ queryKey: ['work-center', workCenterId] });
      router.push('/cost/work-centers');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.code.trim()) {
      notify('Code is required', 'warning', 3000);
      return;
    }
    if (!formData.name.trim()) {
      notify('Name is required', 'warning', 3000);
      return;
    }

    setIsSaving(true);
    try {
      if (mode === 'create') {
        await createMutation.mutateAsync({
          code: formData.code.trim(),
          name: formData.name.trim(),
          nameTh: formData.nameTh.trim() || null,
          orgUnitId: formData.orgUnitId,
          laborRatePerHour: formData.laborRatePerHour,
          overheadRatePerHour: formData.overheadRatePerHour,
          machineRatePerHour: formData.machineRatePerHour,
          capacityHoursPerDay: formData.capacityHoursPerDay ?? null,
          isActive: formData.isActive,
        });
      } else {
        await updateMutation.mutateAsync({
          code: formData.code.trim(),
          name: formData.name.trim(),
          nameTh: formData.nameTh.trim() || null,
          orgUnitId: formData.orgUnitId,
          laborRatePerHour: formData.laborRatePerHour,
          overheadRatePerHour: formData.overheadRatePerHour,
          machineRatePerHour: formData.machineRatePerHour,
          capacityHoursPerDay: formData.capacityHoursPerDay ?? null,
          isActive: formData.isActive,
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (mode === 'edit' && isLoadingWorkCenter) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading work center...</span>
      </div>
    );
  }

  const totalRate = formData.laborRatePerHour + formData.overheadRatePerHour + formData.machineRatePerHour;

  return (
    <div className="space-y-6">
      <ResponsivePageHeader
        title={mode === 'create' ? 'New Work Center' : `Edit Work Center: ${workCenter?.code || ''}`}
        subtitle="Configure labor and overhead rates for production costing"
        icon={Factory}
        onBack={() => router.push('/cost/work-centers')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code <span className="text-red-500">*</span>
              </label>
              <TextBox
                value={formData.code}
                onValueChanged={(e) => setFormData({ ...formData, code: e.value || '' })}
                placeholder="e.g., WC-MIX-01"
                maxLength={20}
                disabled={mode === 'edit'}
                data-testid="work-center-code"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name (English) <span className="text-red-500">*</span>
              </label>
              <TextBox
                value={formData.name}
                onValueChanged={(e) => setFormData({ ...formData, name: e.value || '' })}
                placeholder="e.g., Mixing Station 1"
                maxLength={100}
                data-testid="work-center-name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name (Thai)
              </label>
              <TextBox
                value={formData.nameTh}
                onValueChanged={(e) => setFormData({ ...formData, nameTh: e.value || '' })}
                placeholder="e.g., สถานีผสม 1"
                maxLength={100}
                data-testid="work-center-name-th"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization Unit
              </label>
              <SelectBox
                dataSource={orgUnits || []}
                displayExpr="name"
                valueExpr="id"
                value={formData.orgUnitId}
                onValueChanged={(e) => setFormData({ ...formData, orgUnitId: e.value })}
                placeholder="Select org unit..."
                showClearButton
                searchEnabled
                data-testid="work-center-org-unit"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                value={formData.isActive}
                onValueChanged={(e) => setFormData({ ...formData, isActive: e.value })}
                data-testid="work-center-active"
              />
              <label className="text-sm font-medium text-gray-700">
                Active
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Rates Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Hourly Rates (THB/hour)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Labor Rate
              </label>
              <NumberBox
                value={formData.laborRatePerHour}
                onValueChanged={(e) => setFormData({ ...formData, laborRatePerHour: e.value ?? 0 })}
                min={0}
                format="#,##0.00"
                showSpinButtons
                data-testid="work-center-labor-rate"
              />
              <p className="text-xs text-gray-500 mt-1">Direct labor cost per hour</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Overhead Rate
              </label>
              <NumberBox
                value={formData.overheadRatePerHour}
                onValueChanged={(e) => setFormData({ ...formData, overheadRatePerHour: e.value ?? 0 })}
                min={0}
                format="#,##0.00"
                showSpinButtons
                data-testid="work-center-overhead-rate"
              />
              <p className="text-xs text-gray-500 mt-1">Indirect costs (utilities, supervision, etc.)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Machine Rate
              </label>
              <NumberBox
                value={formData.machineRatePerHour}
                onValueChanged={(e) => setFormData({ ...formData, machineRatePerHour: e.value ?? 0 })}
                min={0}
                format="#,##0.00"
                showSpinButtons
                data-testid="work-center-machine-rate"
              />
              <p className="text-xs text-gray-500 mt-1">Equipment depreciation and maintenance</p>
            </div>

            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Total Rate per Hour:</span>
                <span className="text-lg font-bold text-blue-600">
                  {totalRate.toLocaleString('th-TH', { minimumFractionDigits: 2 })} THB
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Capacity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Capacity Hours per Day
              </label>
              <NumberBox
                value={formData.capacityHoursPerDay}
                onValueChanged={(e) => setFormData({ ...formData, capacityHoursPerDay: e.value })}
                min={0}
                max={24}
                format="#,##0.0"
                showSpinButtons
                data-testid="work-center-capacity"
              />
              <p className="text-xs text-gray-500 mt-1">Available working hours per day (max 24)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          text="Cancel"
          icon="arrowleft"
          stylingMode="outlined"
          onClick={() => router.push('/cost/work-centers')}
        />
        <Button
          text={isSaving ? 'Saving...' : mode === 'create' ? 'Create Work Center' : 'Save Changes'}
          icon="save"
          type="default"
          onClick={handleSubmit}
          disabled={isSaving}
          data-testid="save-work-center"
        />
      </div>
    </div>
  );
}

export default WorkCenterForm;
