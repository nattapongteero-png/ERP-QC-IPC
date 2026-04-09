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

// Standard IPC criteria catalog by dosage form
interface StandardCriteria {
  nameEn: string;
  nameTh: string;
  unit: string;
  dosageForms: string[];
}

const STANDARD_IPC_CRITERIA: StandardCriteria[] = [
  // Capsule
  { nameEn: 'Weight Variation', nameTh: 'การทดสอบความแปรผันของน้ำหนัก', unit: 'mg', dosageForms: ['capsule', 'tablet'] },
  { nameEn: 'Disintegration Time', nameTh: 'การทดสอบการแตกตัว', unit: 'min', dosageForms: ['capsule', 'tablet'] },
  { nameEn: 'Moisture Content', nameTh: 'การทดสอบความชื้น', unit: '%', dosageForms: ['capsule', 'powder'] },
  { nameEn: 'Appearance / Color / Odor', nameTh: 'การตรวจสอบลักษณะภายนอก สี และกลิ่น', unit: '', dosageForms: ['capsule', 'tablet', 'liquid', 'cream', 'ointment'] },
  // Tablet
  { nameEn: 'Hardness Test', nameTh: 'การทดสอบความแข็งของเม็ดยา', unit: 'N', dosageForms: ['tablet'] },
  { nameEn: 'Friability Test', nameTh: 'การทดสอบความกร่อนของเม็ดยา', unit: '%', dosageForms: ['tablet'] },
  { nameEn: 'Thickness & Diameter', nameTh: 'การวัดความหนาและเส้นผ่านศูนย์กลาง', unit: 'mm', dosageForms: ['tablet'] },
  // Liquid
  { nameEn: 'pH Value', nameTh: 'การวัดค่าความเป็นกรด-ด่าง', unit: '', dosageForms: ['liquid', 'cream', 'ointment'] },
  { nameEn: 'Specific Gravity / Density', nameTh: 'การวัดความถ่วงจำเพาะ', unit: 'g/mL', dosageForms: ['liquid'] },
  { nameEn: 'Viscosity', nameTh: 'การวัดความหนืด', unit: 'cP', dosageForms: ['liquid', 'cream', 'ointment'] },
  // Semi-solid
  { nameEn: 'Homogeneity', nameTh: 'การตรวจสอบความเป็นเนื้อเดียวกัน', unit: '', dosageForms: ['cream', 'ointment'] },
];

const CUSTOM_OPTION_VALUE = '__custom__';

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
  const [isCustomName, setIsCustomName] = React.useState(() => {
    // In edit mode, check if name matches a standard criteria
    if (mode === 'edit' && initialData.name) {
      return !STANDARD_IPC_CRITERIA.some(c => c.nameEn === initialData.name);
    }
    return false;
  });

  // Filter standard criteria by selected dosage form (show all if none selected)
  const filteredCriteria = React.useMemo(() => {
    const items = formData.dosageForm
      ? STANDARD_IPC_CRITERIA.filter(c => c.dosageForms.includes(formData.dosageForm!))
      : STANDARD_IPC_CRITERIA;
    return items;
  }, [formData.dosageForm]);

  /**
   * Parse specification string and auto-calculate Min/Max
   * Supports: "300 ± 5%", "300 +/- 5%", "300±5%", "300 ± 10"
   */
  const parseSpecification = (spec: string): { center: number; deviation: number; isPercent: boolean } | null => {
    if (!spec) return null;
    // Match: [center] ± [deviation]% or [center] +/- [deviation]%
    const match = spec.match(/^\s*([\d.]+)\s*(?:±|\+\/?-)\s*([\d.]+)\s*(%?)\s*/);
    if (!match) return null;
    const center = parseFloat(match[1]);
    const deviation = parseFloat(match[2]);
    const isPercent = match[3] === '%';
    if (isNaN(center) || isNaN(deviation)) return null;
    return { center, deviation, isPercent };
  };

  const handleSpecChange = (spec: string) => {
    const parsed = parseSpecification(spec);
    if (parsed) {
      const delta = parsed.isPercent ? (parsed.center * parsed.deviation / 100) : parsed.deviation;
      const minVal = Math.round((parsed.center - delta) * 10000) / 10000;
      const maxVal = Math.round((parsed.center + delta) * 10000) / 10000;
      setFormData({ ...formData, specification: spec, minValue: minVal, maxValue: maxVal });
    } else {
      setFormData({ ...formData, specification: spec });
    }
  };

  const specParsed = parseSpecification(formData.specification || '');

  // Handle standard criteria selection
  const handleSelectStandard = (nameEn: string) => {
    if (nameEn === CUSTOM_OPTION_VALUE) {
      setIsCustomName(true);
      setFormData({ ...formData, name: '', nameTh: '' });
      return;
    }
    setIsCustomName(false);
    const std = STANDARD_IPC_CRITERIA.find(c => c.nameEn === nameEn);
    if (std) {
      setFormData({
        ...formData,
        name: std.nameEn,
        nameTh: std.nameTh,
        unit: std.unit || formData.unit || '',
      });
    }
  };

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

          {/* Standard criteria selector or custom input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">หัวข้อการทดสอบ (Test Name) *</label>
            <DxSelectBox
              value={isCustomName ? CUSTOM_OPTION_VALUE : (formData.name || '')}
              onValueChanged={(e) => handleSelectStandard(e.value)}
              dataSource={[
                ...filteredCriteria.map(c => ({ value: c.nameEn, display: `${c.nameEn} — ${c.nameTh}` })),
                { value: CUSTOM_OPTION_VALUE, display: '➕ เพิ่มหัวข้อใหม่ (Add Custom Criteria)' },
              ]}
              valueExpr="value"
              displayExpr="display"
              placeholder="เลือกหัวข้อมาตรฐาน หรือเพิ่มใหม่"
              searchEnabled
              showClearButton
            />
            {formData.name && !isCustomName && (
              <p className="text-xs text-emerald-600 mt-1">
                TH: {formData.nameTh} | Unit: {formData.unit || '-'}
              </p>
            )}
          </div>

          {/* Custom name inputs - only shown when "Add Custom" is selected */}
          {isCustomName && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-amber-50 rounded-lg p-4 border border-amber-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (EN) *</label>
                <DxTextBox value={formData.name || ''} onValueChanged={(e) => setFormData({ ...formData, name: e.value })} placeholder="e.g., Custom Test Name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ (TH)</label>
                <DxTextBox value={formData.nameTh || ''} onValueChanged={(e) => setFormData({ ...formData, nameTh: e.value })} placeholder="เช่น หัวข้อทดสอบกำหนดเอง" />
              </div>
            </div>
          )}

          {formData.criteriaType !== 'checkbox' && (
          <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Specification</label>
            <DxTextBox
              value={formData.specification || ''}
              onValueChanged={(e) => handleSpecChange(e.value)}
              placeholder="เช่น 300 ± 5% หรือ 200 ± 10"
            />
            <p className="text-xs text-gray-500 mt-1">
              รูปแบบ: [ค่ากลาง] ± [ค่าเบี่ยงเบน]% — ระบบคำนวณ Min/Max ให้อัตโนมัติ
            </p>
            {specParsed && (
              <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm">
                <span className="text-emerald-800 font-medium">
                  ค่ากลาง: {specParsed.center} | เบี่ยงเบน: {specParsed.deviation}{specParsed.isPercent ? '%' : ''} →{' '}
                  Min = <strong>{formData.minValue}</strong>, Max = <strong>{formData.maxValue}</strong>
                  {formData.unit ? ` ${formData.unit}` : ''}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Value {specParsed && <span className="text-xs text-emerald-600">(คำนวณอัตโนมัติ)</span>}
              </label>
              <DxNumberBox
                value={formData.minValue ?? undefined}
                onValueChanged={(e) => setFormData({ ...formData, minValue: e.value })}
                placeholder="e.g., 190"
                readOnly={!!specParsed}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Value {specParsed && <span className="text-xs text-emerald-600">(คำนวณอัตโนมัติ)</span>}
              </label>
              <DxNumberBox
                value={formData.maxValue ?? undefined}
                onValueChanged={(e) => setFormData({ ...formData, maxValue: e.value })}
                placeholder="e.g., 210"
                readOnly={!!specParsed}
              />
            </div>
          </div>
          </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Method</label>
            <DxTextBox value={formData.testMethod || ''} onValueChanged={(e) => setFormData({ ...formData, testMethod: e.value })} placeholder="e.g., USP Weight Variation" />
          </div>

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
