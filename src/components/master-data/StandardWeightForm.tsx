'use client';

/**
 * Standard Weight Form Component
 * Reusable form for creating and editing standard weights (ลูกตุ้มมาตรฐาน)
 * Feature: 021-scale-verification
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxSwitch } from '@/components/ui/dx-switch';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { useToast } from '@/hooks/use-toast';
import { Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ACCURACY_CLASSES, type StandardWeight, type AccuracyClass } from '@/types/scale-verification';

interface StandardWeightFormProps {
  mode: 'create' | 'edit';
  id?: number;
}

const DENOMINATION_UNITS = ['g', 'kg', 'mg'] as const;
type DenominationUnit = (typeof DENOMINATION_UNITS)[number];

// OIML accuracy classes with a plain-language hint per class (most→least
// precise) so users who don't know the metrology codes understand what to pick.
const ACCURACY_CLASS_DESCRIPTIONS: Record<string, string> = {
  E1: 'เที่ยงตรงสูงสุด — สอบเทียบลูกตุ้มมาตรฐานอื่น',
  E2: 'เที่ยงตรงสูง — สอบเทียบเครื่องชั่งความละเอียดสูง',
  F1: 'เที่ยงตรงปานกลาง — เครื่องชั่งในห้องปฏิบัติการ',
  F2: 'เที่ยงตรงทั่วไป — เครื่องชั่งงานผลิต',
  M1: 'งานทั่วไป — เครื่องชั่งการค้า/อุตสาหกรรม',
  M2: 'งานหยาบ — เครื่องชั่งทั่วไป',
  M3: 'งานหยาบที่สุด',
};
const ACCURACY_CLASS_OPTIONS = ACCURACY_CLASSES.map((c) => ({
  value: c,
  label: ACCURACY_CLASS_DESCRIPTIONS[c] ? `${c} — ${ACCURACY_CLASS_DESCRIPTIONS[c]}` : c,
}));
const UNIT_OPTIONS = DENOMINATION_UNITS.map((u) => ({ value: u, label: u }));

const TODAY = new Date().toISOString().slice(0, 10);
const NEXT_YEAR = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

interface FormState {
  code: string;
  denominationValue: number;
  denominationUnit: DenominationUnit;
  accuracyClass: AccuracyClass;
  certificateNumber: string;
  certificateIssuer: string;
  certificateIssueDate: string;
  certificateExpiryDate: string;
  ownerDepartment: string;
  isActive: boolean;
  notes: string;
}

const EMPTY_FORM: FormState = {
  code: '',
  denominationValue: 0,
  denominationUnit: 'g',
  accuracyClass: 'E2',
  certificateNumber: '',
  certificateIssuer: '',
  certificateIssueDate: TODAY,
  certificateExpiryDate: NEXT_YEAR,
  ownerDepartment: '',
  isActive: true,
  notes: '',
};

/** Read-only labelled value, styled to match the form's input fields. */
function ReadOnlyField({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div
        className="w-full rounded-[11px] border border-[#D9EFE4] bg-[#F4FAF7] px-3 py-2 text-[#0F2E22] min-h-[40px] flex items-center"
        data-testid={testId}
      >
        {value || '—'}
      </div>
    </div>
  );
}

export function StandardWeightForm({ mode, id }: StandardWeightFormProps) {
  const { data: existingWeight, isLoading: isLoadingWeight } = useQuery<StandardWeight | undefined>({
    queryKey: ['standard-weight-single', id],
    queryFn: async () => {
      const res = await fetch('/api/master-data/standard-weights?includeInactive=true');
      if (!res.ok) throw new Error('Failed to load');
      const body = await res.json();
      const list: StandardWeight[] = body?.data ?? body;
      return list.find((w) => w.id === id);
    },
    enabled: mode === 'edit' && !!id,
  });

  if (mode === 'edit' && (isLoadingWeight || !existingWeight)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">กำลังโหลด...</div>
      </div>
    );
  }

  const initialData: FormState = existingWeight
    ? {
        code: existingWeight.code || '',
        denominationValue: existingWeight.denominationValue ?? 0,
        denominationUnit: (existingWeight.denominationUnit as DenominationUnit) || 'g',
        accuracyClass: existingWeight.accuracyClass || 'E2',
        certificateNumber: existingWeight.certificateNumber || '',
        certificateIssuer: existingWeight.certificateIssuer || '',
        certificateIssueDate: existingWeight.certificateIssueDate
          ? String(existingWeight.certificateIssueDate).slice(0, 10)
          : TODAY,
        certificateExpiryDate: existingWeight.certificateExpiryDate
          ? String(existingWeight.certificateExpiryDate).slice(0, 10)
          : NEXT_YEAR,
        ownerDepartment: existingWeight.ownerDepartment || '',
        isActive: existingWeight.isActive ?? true,
        notes: existingWeight.notes || '',
      }
    : EMPTY_FORM;

  return (
    <StandardWeightFormInner
      key={id ?? 'new'}
      mode={mode}
      id={id}
      initialData={initialData}
      existingWeight={existingWeight}
    />
  );
}

function StandardWeightFormInner({
  mode,
  id,
  initialData,
  existingWeight,
}: StandardWeightFormProps & {
  initialData: FormState;
  existingWeight?: StandardWeight;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useTranslations('scaleVerification');

  const [formData, setFormData] = React.useState<FormState>(initialData);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: async (data: FormState) => {
      if (mode === 'edit' && id) {
        // PUT — only the updatable fields accepted by the [id] route
        const res = await fetch(`/api/master-data/standard-weights/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            certificateNumber: data.certificateNumber,
            certificateIssuer: data.certificateIssuer,
            certificateIssueDate: data.certificateIssueDate,
            certificateExpiryDate: data.certificateExpiryDate,
            ownerDepartment: data.ownerDepartment || null,
            isActive: data.isActive,
            notes: data.notes || null,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? 'Failed to update');
        return body;
      } else {
        // POST — full create payload
        const res = await fetch('/api/master-data/standard-weights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: data.code,
            denominationValue: data.denominationValue,
            denominationUnit: data.denominationUnit,
            accuracyClass: data.accuracyClass,
            certificateNumber: data.certificateNumber,
            certificateIssuer: data.certificateIssuer,
            certificateIssueDate: data.certificateIssueDate,
            certificateExpiryDate: data.certificateExpiryDate,
            ownerDepartment: data.ownerDepartment || null,
            notes: data.notes || null,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? 'Failed to create');
        return body;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['standard-weights-admin'] });
      queryClient.invalidateQueries({ queryKey: ['standard-weights'] });
      toast.success(
        mode === 'edit' ? 'อัปเดตสำเร็จ' : 'สร้างสำเร็จ',
        mode === 'edit'
          ? `อัปเดตลูกตุ้ม ${formData.code} เรียบร้อย`
          : `สร้างลูกตุ้ม ${formData.code} เรียบร้อย`,
      );
      router.push('/master-data/standard-weights');
    },
    onError: (error: Error) => {
      toast.error('ผิดพลาด', error.message);
    },
  });

  const handleSave = () => {
    if (!formData.code) {
      toast.error('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกรหัสลูกตุ้ม');
      return;
    }
    if (!formData.certificateNumber) {
      toast.error('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกเลขที่ใบรับรอง');
      return;
    }
    if (!formData.certificateIssuer) {
      toast.error('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกผู้ออกใบรับรอง');
      return;
    }
    if (formData.denominationValue <= 0) {
      toast.error('ข้อมูลไม่ครบถ้วน', 'ค่าน้ำหนักต้องมากกว่า 0');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleCancel = () => {
    router.push('/master-data/standard-weights');
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-4xl mx-auto">
      <ResponsivePageHeader
        title={mode === 'edit' ? 'แก้ไขลูกตุ้มมาตรฐาน' : 'เพิ่มลูกตุ้มมาตรฐาน'}
        subtitle={
          mode === 'edit'
            ? `กำลังแก้ไข ${existingWeight?.code || ''}`
            : 'เพิ่มลูกตุ้มมาตรฐานใหม่สำหรับการตรวจสอบเครื่องชั่ง'
        }
        icon={Scale}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        breadcrumbs={[
          { label: 'ข้อมูลหลัก', href: '/master-data' },
          { label: t('page.standardWeights'), href: '/master-data/standard-weights' },
          { label: mode === 'edit' ? 'แก้ไข' : 'เพิ่มใหม่' },
        ]}
        actions={
          <div className="flex gap-2">
            <DxButton text="ยกเลิก" icon="back" stylingMode="outlined" onClick={handleCancel} />
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

      {/* ── Identity ──
          Shown in BOTH modes. On create the fields are editable; on edit they
          are read-only (the PUT route does not accept code / denomination /
          accuracy class — they are immutable once the weight exists). Rendering
          them read-only on edit means the user actually SEES which weight they
          are editing instead of a form that looks empty like "add new". */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-emerald-600" />
            ข้อมูลลูกตุ้ม
            {mode === 'edit' && (
              <span className="text-xs font-normal text-gray-400">(แก้ไขไม่ได้)</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === 'edit' ? (
            // Edit mode — identity is immutable (the PUT route rejects these
            // fields). Render as read-only text rather than disabled DevExtreme
            // editors: a readOnly DxSelectBox shows its placeholder instead of
            // the selected label, which made Class/หน่วย look empty.
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ReadOnlyField label={`${t('form.code.label')}`} value={formData.code} testId="sw-code" />
              <ReadOnlyField
                label={`${t('form.accuracyClass.label')}`}
                value={
                  ACCURACY_CLASS_OPTIONS.find((o) => o.value === formData.accuracyClass)?.label ??
                  formData.accuracyClass
                }
              />
              <ReadOnlyField
                label={`${t('form.denominationValue.label')}`}
                value={Number(formData.denominationValue).toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 4,
                })}
              />
              <ReadOnlyField
                label={`${t('form.denominationUnit.label')}`}
                value={
                  UNIT_OPTIONS.find((o) => o.value === formData.denominationUnit)?.label ??
                  formData.denominationUnit
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('form.code.label')} *
                </label>
                <DxTextBox
                  value={formData.code}
                  onValueChange={(v) => set('code', v)}
                  placeholder="เช่น SW-001"
                  elementAttr={{ 'data-testid': 'sw-code' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('form.accuracyClass.label')} *
                </label>
                <DxSelectBox
                  dataSource={ACCURACY_CLASS_OPTIONS}
                  displayExpr="label"
                  valueExpr="value"
                  value={formData.accuracyClass}
                  onValueChanged={(e) => set('accuracyClass', e.value as AccuracyClass)}
                  placeholder="เลือกชั้นความแม่นยำ"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('form.denominationValue.label')} *
                </label>
                <DxNumberBox
                  value={formData.denominationValue}
                  onValueChange={(v) => set('denominationValue', v ?? 0)}
                  min={0}
                  step={0.0001}
                  format="#0.0000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('form.denominationUnit.label')} *
                </label>
                <DxSelectBox
                  dataSource={UNIT_OPTIONS}
                  displayExpr="label"
                  valueExpr="value"
                  value={formData.denominationUnit}
                  onValueChanged={(e) => set('denominationUnit', e.value as DenominationUnit)}
                  placeholder="เลือกหน่วย"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Certificate ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-800">ข้อมูลใบรับรอง</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('form.certificateNumber.label')} *
              </label>
              <DxTextBox
                value={formData.certificateNumber}
                onValueChange={(v) => set('certificateNumber', v)}
                placeholder="เลขที่ใบรับรอง"
                elementAttr={{ 'data-testid': 'sw-cert-number' }}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('form.certificateIssuer.label')} *
              </label>
              <DxTextBox
                value={formData.certificateIssuer}
                onValueChange={(v) => set('certificateIssuer', v)}
                placeholder="เช่น NIMT / สถาบันมาตรวิทยาฯ"
                elementAttr={{ 'data-testid': 'sw-cert-issuer' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('form.certificateIssueDate.label')} *
              </label>
              <DxDateBox
                value={formData.certificateIssueDate}
                onValueChange={(v) => set('certificateIssueDate', v)}
                type="date"
                displayFormat="yyyy-MM-dd"
                data-testid="sw-cert-issue-date"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('form.certificateExpiryDate.label')} *
              </label>
              <DxDateBox
                value={formData.certificateExpiryDate}
                onValueChange={(v) => set('certificateExpiryDate', v)}
                type="date"
                displayFormat="yyyy-MM-dd"
                data-testid="sw-cert-expiry-date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Additional info ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-800">ข้อมูลเพิ่มเติม</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">หน่วยงานเจ้าของ</label>
            <DxTextBox
              value={formData.ownerDepartment}
              onValueChange={(v) => set('ownerDepartment', v)}
              placeholder="เช่น QC / Production"
              elementAttr={{ 'data-testid': 'sw-owner-dept' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
            <DxTextArea
              value={formData.notes}
              onValueChange={(v) => set('notes', v)}
              placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ)"
              height={90}
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <DxSwitch
              value={formData.isActive}
              onValueChange={(v) => set('isActive', v)}
              elementAttr={{ 'data-testid': 'sw-is-active' }}
            />
            <span className="text-sm text-gray-700">ใช้งาน</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Bottom actions ── */}
      <div className="flex justify-end gap-2 pt-2">
        <DxButton text="ยกเลิก" stylingMode="outlined" onClick={handleCancel} />
        <DxButton
          text={
            saveMutation.isPending
              ? 'กำลังบันทึก...'
              : mode === 'edit'
              ? 'อัปเดตลูกตุ้ม'
              : 'สร้างลูกตุ้ม'
          }
          type="success"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          elementAttr={{ 'data-testid': 'sw-save-btn' }}
        />
      </div>
    </div>
  );
}
