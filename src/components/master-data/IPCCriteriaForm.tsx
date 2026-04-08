'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxSwitch } from '@/components/ui/dx-switch';
import { SwitchTypes } from 'devextreme-react/switch';
import { useToast } from '@/hooks/use-toast';
import { FlaskConical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface IPCCriteria {
  id: number;
  code: string;
  name: string;
  nameTh: string | null;
  testMethod: string | null;
  specification: string | null;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  sampleSize: number;
  checkIntervalMinutes: number;
  isCritical: boolean;
  isActive: boolean;
  dosageForm: string | null;
  criteriaType: string;
  tolerancePercent: number;
}

interface Props {
  mode: 'create' | 'edit';
  id?: number;
}

export function IPCCriteriaForm({ mode, id }: Props) {
  const { data: existing, isLoading } = useQuery<IPCCriteria>({
    queryKey: ['ipc-criteria', id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/ipc-criteria?id=${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    enabled: mode === 'edit' && !!id,
  });

  if (mode === 'edit' && (isLoading || !existing)) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading...</div></div>;
  }

  const initialData: Partial<IPCCriteria> = existing || {
    code: '', name: '', nameTh: '', testMethod: '', specification: '',
    minValue: null, maxValue: null, unit: '', sampleSize: 5,
    checkIntervalMinutes: 30, isCritical: false, isActive: true,
    dosageForm: null, criteriaType: 'numeric', tolerancePercent: 0,
  };

  return <IPCCriteriaFormInner key={id || 'new'} mode={mode} id={id} initialData={initialData} />;
}

function IPCCriteriaFormInner({ mode, id, initialData }: Props & { initialData: Partial<IPCCriteria> }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formData, setFormData] = React.useState<Partial<IPCCriteria>>(initialData);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<IPCCriteria>) => {
      const method = mode === 'edit' ? 'PUT' : 'POST';
      const payload = mode === 'edit' ? { ...data, id } : data;
      const res = await fetch('/api/master-data/ipc-criteria', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ipc-criteria'] });
      toast.success(mode === 'edit' ? 'Updated' : 'Created', 'IPC criteria saved successfully.');
      router.push('/master-data/ipc-criteria');
    },
    onError: (error: Error) => toast.error('Error', error.message),
  });

  const handleSave = () => {
    if (!formData.code || !formData.name) {
      toast.error('Validation', 'Code and Name are required.');
      return;
    }
    saveMutation.mutate(formData);
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-4xl mx-auto">
      <ResponsivePageHeader
        title={mode === 'edit' ? 'Edit IPC Criteria' : 'New IPC Criteria'}
        subtitle={mode === 'edit' ? `Editing ${initialData.name || ''}` : 'Create a new In-Process Control criteria'}
        icon={FlaskConical}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'IPC Criteria', href: '/master-data/ipc-criteria' },
          { label: mode === 'edit' ? 'Edit' : 'New' },
        ]}
        actions={
          <div className="flex gap-2">
            <DxButton text="Cancel" icon="back" stylingMode="outlined" onClick={() => router.push('/master-data/ipc-criteria')} />
            <DxButton text={saveMutation.isPending ? 'Saving...' : 'Save'} icon="save" type="success" onClick={handleSave} disabled={saveMutation.isPending} />
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-emerald-600" />
            Criteria Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <DxTextBox value={formData.code || ''} onValueChanged={(e) => setFormData({ ...formData, code: e.value })} placeholder="e.g., IPC-WV-001" />
            </div>
            {formData.criteriaType !== 'checkbox' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <DxTextBox value={formData.unit || ''} onValueChanged={(e) => setFormData({ ...formData, unit: e.value })} placeholder="e.g., mg, mm, min" />
            </div>
            )}
          </div>

          {/* Dosage Form and Criteria Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รูปแบบยา (Dosage Form)</label>
              <DxSelectBox
                value={formData.dosageForm || ''}
                onValueChanged={(e) => setFormData({ ...formData, dosageForm: e.value || null })}
                items={[
                  { value: 'capsule', label: 'Capsule' },
                  { value: 'tablet', label: 'Tablet' },
                  { value: 'powder', label: 'Powder' },
                  { value: 'liquid', label: 'Liquid' },
                  { value: 'cream', label: 'Cream' },
                  { value: 'ointment', label: 'Ointment' },
                  { value: 'suppository', label: 'Suppository' },
                  { value: 'other', label: 'Other' },
                ]}
                placeholder="Select dosage form"
                showClearButton
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทเกณฑ์ (Criteria Type) *</label>
              <DxSelectBox
                value={formData.criteriaType || 'numeric'}
                onValueChanged={(e) => setFormData({ ...formData, criteriaType: e.value })}
                items={[
                  { value: 'numeric', text: 'ตัวเลข (Numeric) — ใส่ค่าวัด + เทียบ Min/Max' },
                  { value: 'checkbox', text: 'ติ๊กเลือก (Checkbox) — ผ่าน/ไม่ผ่าน' },
                ]}
                valueExpr="value"
                displayExpr="text"
              />
            </div>
          </div>

          {/* Tolerance Percent */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tolerance ±%</label>
              <DxNumberBox
                value={formData.tolerancePercent ?? 0}
                onValueChanged={(e) => setFormData({ ...formData, tolerancePercent: e.value })}
                min={0}
                max={100}
                format="#0.##'%'"
              />
              <p className="text-xs text-gray-500 mt-1">0% = ทุก sample ต้องผ่าน, 10% = ยอมให้ไม่ผ่านได้ 10%</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ (TH)</label>
            <DxTextBox value={formData.nameTh || ''} onValueChanged={(e) => setFormData({ ...formData, nameTh: e.value })} placeholder="เช่น การตรวจน้ำหนักแคปซูล" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name (EN) *</label>
            <DxTextBox value={formData.name || ''} onValueChanged={(e) => setFormData({ ...formData, name: e.value })} placeholder="e.g., Capsule Weight Variation" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Specification</label>
            <DxTextBox value={formData.specification || ''} onValueChanged={(e) => setFormData({ ...formData, specification: e.value })} placeholder="e.g., 200 ± 10 mg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Method</label>
            <DxTextBox value={formData.testMethod || ''} onValueChanged={(e) => setFormData({ ...formData, testMethod: e.value })} placeholder="e.g., USP Weight Variation" />
          </div>

          {formData.criteriaType !== 'checkbox' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Value</label>
              <DxNumberBox value={formData.minValue ?? undefined} onValueChanged={(e) => setFormData({ ...formData, minValue: e.value })} placeholder="e.g., 190" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Value</label>
              <DxNumberBox value={formData.maxValue ?? undefined} onValueChanged={(e) => setFormData({ ...formData, maxValue: e.value })} placeholder="e.g., 210" />
            </div>
          </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sample Size</label>
              <DxNumberBox value={formData.sampleSize ?? 5} onValueChanged={(e) => setFormData({ ...formData, sampleSize: e.value })} min={1} />
              <p className="text-xs text-gray-500 mt-1">Number of samples per test</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check Interval (min)</label>
              <DxNumberBox value={formData.checkIntervalMinutes ?? 30} onValueChanged={(e) => setFormData({ ...formData, checkIntervalMinutes: e.value })} min={1} />
              <p className="text-xs text-gray-500 mt-1">How often to run this test</p>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <div className="flex items-center gap-2">
              <DxSwitch value={formData.isCritical ?? false} onValueChanged={(e: SwitchTypes.ValueChangedEvent) => setFormData({ ...formData, isCritical: e.value })} />
              <span className="text-sm text-gray-700">Critical Test</span>
            </div>
            <div className="flex items-center gap-2">
              <DxSwitch value={formData.isActive !== false} onValueChanged={(e: SwitchTypes.ValueChangedEvent) => setFormData({ ...formData, isActive: e.value })} />
              <span className="text-sm text-gray-700">Active</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pt-4">
        <DxButton text="Cancel" stylingMode="outlined" onClick={() => router.push('/master-data/ipc-criteria')} />
        <DxButton text={saveMutation.isPending ? 'Saving...' : (mode === 'edit' ? 'Update' : 'Create')} type="success" onClick={handleSave} disabled={saveMutation.isPending} />
      </div>
    </div>
  );
}
