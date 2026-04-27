'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import notify from 'devextreme/ui/notify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { PageHeader } from '@/components/ui/page-header';
import { QC_TEST_CATEGORIES } from '@/lib/validation/qc-test-catalog';

type CategoryLabel = { value: string; label: string };

const CATEGORY_OPTIONS: CategoryLabel[] = [
  { value: 'chemical', label: 'Chemical (เคมี)' },
  { value: 'physical', label: 'Physical (กายภาพ)' },
  { value: 'microbial', label: 'Microbial (จุลชีววิทยา)' },
  { value: 'sensory', label: 'Sensory (ประสาทสัมผัส)' },
  { value: 'stability', label: 'Stability (ความคงตัว)' },
  { value: 'other', label: 'Other (อื่นๆ)' },
];

type FormState = {
  code: string;
  name: string;
  nameTh: string;
  category: (typeof QC_TEST_CATEGORIES)[number];
  testMethod: string;
  defaultUnit: string;
  defaultMin: string | number;
  defaultMax: string | number;
  description: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  code: '',
  name: '',
  nameTh: '',
  category: 'other',
  testMethod: '',
  defaultUnit: '',
  defaultMin: '',
  defaultMax: '',
  description: '',
  isActive: true,
};

interface Props {
  mode: 'create' | 'edit';
  id?: number;
}

export function QcTestCatalogForm({ mode, id }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/quality/test-catalog/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success && j.data) {
          const d = j.data;
          setForm({
            code: d.code ?? '',
            name: d.name ?? '',
            nameTh: d.nameTh ?? '',
            category: d.category ?? 'other',
            testMethod: d.testMethod ?? '',
            defaultUnit: d.defaultUnit ?? '',
            defaultMin: d.defaultMin ?? '',
            defaultMax: d.defaultMax ?? '',
            description: d.description ?? '',
            isActive: d.isActive ?? true,
          });
        } else {
          notify('ไม่พบข้อมูล', 'error', 3000);
          router.push('/quality/test-catalog');
        }
      })
      .catch(() => notify('โหลดข้อมูลไม่สำเร็จ', 'error', 3000))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [mode, id, router]);

  const update = <K extends keyof FormState>(key: K, val: FormState[K]) => setForm((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    if (!form.code.trim()) return notify('กรุณากรอกรหัส (Code)', 'warning', 3000);
    if (!form.name.trim()) return notify('กรุณากรอกชื่อ Test (Name)', 'warning', 3000);

    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      nameTh: form.nameTh.trim() || null,
      category: form.category,
      testMethod: form.testMethod.trim() || null,
      defaultUnit: form.defaultUnit.trim() || null,
      defaultMin: form.defaultMin === '' || form.defaultMin === null ? null : Number(form.defaultMin),
      defaultMax: form.defaultMax === '' || form.defaultMax === null ? null : Number(form.defaultMax),
      description: form.description.trim() || null,
      isActive: form.isActive,
    };

    setSaving(true);
    try {
      const url = mode === 'create' ? '/api/quality/test-catalog' : `/api/quality/test-catalog/${id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok || !j?.success) {
        const err = j?.error || 'บันทึกไม่สำเร็จ';
        notify(err, 'error', 4000);
        return;
      }
      notify(mode === 'create' ? 'เพิ่มรายการเรียบร้อย' : 'บันทึกการแก้ไขเรียบร้อย', 'success', 2000);
      router.push('/quality/test-catalog');
    } catch (err) {
      notify('บันทึกไม่สำเร็จ — กรุณาลองใหม่', 'error', 4000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={mode === 'create' ? 'เพิ่ม QC Test ใหม่' : 'แก้ไข QC Test'}
        description="Master data สำหรับรายการทดสอบที่ใช้กำหนด Quality Spec"
      />

      {loading ? (
        <div className="text-center py-8 text-gray-500">กำลังโหลด...</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ข้อมูล Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1">
                  รหัส (Code) <span className="text-red-500">*</span>
                </label>
                <DxTextBox
                  value={form.code}
                  onValueChange={(v) => update('code', v ?? '')}
                  placeholder="PH / MOISTURE / HARDNESS"
                  disabled={mode === 'edit'}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">
                  หมวด (Category) <span className="text-red-500">*</span>
                </label>
                <DxSelectBox
                  dataSource={CATEGORY_OPTIONS}
                  valueExpr="value"
                  displayExpr="label"
                  value={form.category}
                  onValueChange={(v) => update('category', v as FormState['category'])}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">
                  ชื่อ Test (EN) <span className="text-red-500">*</span>
                </label>
                <DxTextBox
                  value={form.name}
                  onValueChange={(v) => update('name', v ?? '')}
                  placeholder="pH Value / Moisture Content"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">ชื่อ Test (TH)</label>
                <DxTextBox
                  value={form.nameTh}
                  onValueChange={(v) => update('nameTh', v ?? '')}
                  placeholder="ค่ากรด-ด่าง / ปริมาณความชื้น"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">วิธีทดสอบ (Method)</label>
                <DxTextBox
                  value={form.testMethod}
                  onValueChange={(v) => update('testMethod', v ?? '')}
                  placeholder="USP <791> / SOP-QC-001"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">หน่วยเริ่มต้น (Default Unit)</label>
                <DxTextBox
                  value={form.defaultUnit}
                  onValueChange={(v) => update('defaultUnit', v ?? '')}
                  placeholder="mg / % / mm"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Min (ค่าต่ำสุด — อ้างอิง)</label>
                <DxTextBox
                  value={String(form.defaultMin ?? '')}
                  onValueChange={(v) => update('defaultMin', v ?? '')}
                  placeholder="5.5"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Max (ค่าสูงสุด — อ้างอิง)</label>
                <DxTextBox
                  value={String(form.defaultMax ?? '')}
                  onValueChange={(v) => update('defaultMax', v ?? '')}
                  placeholder="7.5"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">คำอธิบาย (Description)</label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                rows={3}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="รายละเอียดเพิ่มเติม / SOP link / หมายเหตุ"
              />
            </div>

            <div>
              <DxCheckBox
                value={form.isActive}
                onValueChange={(v) => update('isActive', v ?? true)}
                text="Active (แสดงให้เลือกในฟอร์ม Quality Spec)"
              />
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <DxButton
                text={saving ? 'กำลังบันทึก...' : 'บันทึก'}
                type="default"
                icon="save"
                disabled={saving}
                onClick={handleSave}
              />
              <DxButton
                text="ยกเลิก"
                icon="close"
                disabled={saving}
                onClick={() => router.push('/quality/test-catalog')}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
