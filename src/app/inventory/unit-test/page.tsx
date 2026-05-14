'use client';

import { useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { PageHeader } from '@/components/ui/page-header';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { Beaker, Box, Pill, Scale, Calculator, RotateCcw, AlertCircle } from 'lucide-react';
import {
  calculateIssuance,
  calculateReturn,
  type UnitConfig,
  type IssuanceResult,
  type ReturnResult,
} from '@/lib/utils/unit-conversion';

interface SetupState {
  primaryUnit: string;
  secondaryUnit: string;
  weightUnit: string;
  conversionRate: number | null;
  secondaryToWeightRate: number | null;
  weightTrackingEnabled: boolean;
}

const defaultSetup: SetupState = {
  primaryUnit: 'กล่อง',
  secondaryUnit: 'แคปซูล',
  weightUnit: 'กรัม',
  conversionRate: 1000,
  secondaryToWeightRate: 0.1,
  weightTrackingEnabled: true,
};

function trySafe<T>(fn: () => T): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: fn() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export default function UnitConversionTestPage() {
  const [setup, setSetup] = useState<SetupState>(defaultSetup);
  const [requestedSU, setRequestedSU] = useState<number | null>(1700);
  const [actualWeight, setActualWeight] = useState<number | null>(175);

  const config: UnitConfig = useMemo(
    () => ({
      primaryUnit: setup.primaryUnit,
      secondaryUnit: setup.secondaryUnit,
      weightUnit: setup.weightUnit,
      conversionRate: setup.conversionRate,
      secondaryToWeightRate: setup.secondaryToWeightRate,
      weightTrackingEnabled: setup.weightTrackingEnabled,
    }),
    [setup]
  );

  const issuance = useMemo(() => {
    if (!requestedSU || !setup.conversionRate) return null;
    return trySafe(() => calculateIssuance(requestedSU, config));
  }, [requestedSU, config, setup.conversionRate]);

  const returnCalc = useMemo(() => {
    const totalIssuedSU = issuance?.ok ? issuance.value.actualIssuedSU : null;
    if (!actualWeight || !totalIssuedSU || !setup.weightTrackingEnabled) return null;
    return trySafe(() => calculateReturn(actualWeight, totalIssuedSU, config));
  }, [actualWeight, issuance, config, setup.weightTrackingEnabled]);

  const reset = () => {
    setSetup(defaultSetup);
    setRequestedSU(1700);
    setActualWeight(175);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader
            title="3-Level Unit Conversion (Test)"
            description="ทดสอบ logic การแปลงหน่วย, การปัดเศษเบิกจ่าย และการคืนเศษวัตถุดิบ"
          />
          <button
            onClick={reset}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to defaults
          </button>
        </div>

        {/* Setup */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <header className="mb-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100">
              <Scale className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Step 1 — Setup Units & Ratios</h3>
              <p className="text-xs text-gray-500">ระบุหน่วยและอัตราแปลง 3 ระดับ</p>
            </div>
          </header>

          <div className="grid grid-cols-3 gap-4">
            <Field label={`Primary Unit (PU)`} hint="หน่วยจัดเก็บ/ขาย เช่น กล่อง">
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={setup.primaryUnit}
                onChange={(e) => setSetup((s) => ({ ...s, primaryUnit: e.target.value }))}
              />
            </Field>
            <Field label="Secondary Unit (SU)" hint="หน่วยใช้งาน/นับ เช่น แคปซูล">
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={setup.secondaryUnit}
                onChange={(e) => setSetup((s) => ({ ...s, secondaryUnit: e.target.value }))}
              />
            </Field>
            <Field label={`Ratio1: 1 ${setup.primaryUnit || 'PU'} = ? ${setup.secondaryUnit || 'SU'}`}>
              <DxNumberBox
                value={setup.conversionRate}
                onValueChange={(v) => setSetup((s) => ({ ...s, conversionRate: v }))}
                placeholder="e.g. 1000"
                format="#,##0.###"
              />
            </Field>
          </div>

          <div className="mt-4 rounded-xl bg-gray-50 border border-gray-200 p-4">
            <DxCheckBox
              text="เปิดใช้งานหน่วยชั่ง (Weight Unit)"
              value={setup.weightTrackingEnabled}
              onValueChange={(v) =>
                setSetup((s) => ({ ...s, weightTrackingEnabled: v }))
              }
            />
            {setup.weightTrackingEnabled && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <Field label="Weight Unit (WU)" hint="หน่วยชั่งจริง เช่น กรัม">
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    value={setup.weightUnit}
                    onChange={(e) => setSetup((s) => ({ ...s, weightUnit: e.target.value }))}
                  />
                </Field>
                <Field
                  label={`Ratio2: 1 ${setup.secondaryUnit || 'SU'} = ? ${setup.weightUnit || 'WU'}`}
                  hint="น้ำหนักต่อ 1 หน่วยรอง"
                >
                  <DxNumberBox
                    value={setup.secondaryToWeightRate}
                    onValueChange={(v) =>
                      setSetup((s) => ({ ...s, secondaryToWeightRate: v }))
                    }
                    placeholder="e.g. 0.1"
                    format="#,##0.######"
                  />
                </Field>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-xl bg-blue-50 border border-blue-100 p-3 text-sm text-blue-700">
            <strong>Conversion summary:</strong>{' '}
            1 {setup.primaryUnit} = {setup.conversionRate?.toLocaleString() ?? '?'} {setup.secondaryUnit}
            {setup.weightTrackingEnabled && setup.secondaryToWeightRate ? (
              <>
                {' '}; 1 {setup.secondaryUnit} = {setup.secondaryToWeightRate} {setup.weightUnit}
              </>
            ) : null}
          </div>
        </section>

        {/* Issuance */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <header className="mb-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100">
              <Box className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Step 2 — Issuance (เบิกจ่าย)</h3>
              <p className="text-xs text-gray-500">ระบุจำนวน SU ที่ต้องการเบิก → ระบบปัดขึ้นเป็น PU</p>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-6">
            <Field
              label={`จำนวนที่ต้องการเบิก (${setup.secondaryUnit || 'SU'})`}
              hint="ระบบจะปัดขึ้นเป็นจำนวน PU เต็ม"
            >
              <DxNumberBox
                value={requestedSU}
                onValueChange={setRequestedSU}
                format="#,##0.###"
                placeholder="e.g. 1700"
              />
            </Field>

            <IssuanceResultCard
              setup={setup}
              issuance={issuance}
            />
          </div>
        </section>

        {/* Return */}
        {setup.weightTrackingEnabled && (
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <header className="mb-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-100">
                <Beaker className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Step 3 — Return (รับคืนเศษ)</h3>
                <p className="text-xs text-gray-500">
                  ระบุน้ำหนักที่ใช้จริง → ระบบคำนวณเศษคืนคลังในหน่วย {setup.primaryUnit}
                </p>
              </div>
            </header>

            <div className="grid grid-cols-2 gap-6">
              <Field
                label={`น้ำหนักที่ใช้จริง (${setup.weightUnit || 'WU'})`}
                hint="ตัวเลขที่ชั่งหน้างานหลังผลิตเสร็จ"
              >
                <DxNumberBox
                  value={actualWeight}
                  onValueChange={setActualWeight}
                  format="#,##0.###"
                  placeholder="e.g. 175"
                />
              </Field>

              <ReturnResultCard
                setup={setup}
                returnCalc={returnCalc}
                issuance={issuance}
              />
            </div>
          </section>
        )}

        {/* Validation reminders */}
        <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
          <div className="flex items-center gap-2 font-medium text-gray-700 mb-1">
            <Pill className="h-4 w-4" /> Test cases ที่ต้อง pass
          </div>
          <ol className="list-decimal pl-5 space-y-1">
            <li>1 กล่อง = 1,000 แคปซูล, 1 แคปซูล = 0.1 กรัม</li>
            <li>เบิก <code className="bg-white px-1 rounded">1,700</code> แคปซูล → ระบบต้องบอกว่าจ่าย <strong>2 กล่อง</strong> (2,000 แคปซูล)</li>
            <li>ใช้จริง <code className="bg-white px-1 rounded">175 กรัม</code> (= 1,750 แคปซูล) → ระบบต้องบอกว่าคืนคลัง <strong>0.25 กล่อง</strong> (Zero Cost)</li>
          </ol>
        </section>
      </div>
    </MainLayout>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

function IssuanceResultCard({
  setup,
  issuance,
}: {
  setup: SetupState;
  issuance: { ok: true; value: IssuanceResult } | { ok: false; error: string } | null;
}) {
  if (!issuance) {
    return (
      <Note tone="muted" icon={<Calculator className="h-4 w-4" />}>
        กรอก Ratio1 และจำนวน {setup.secondaryUnit || 'SU'} เพื่อดูผลคำนวณ
      </Note>
    );
  }
  if (!issuance.ok) {
    return (
      <Note tone="error" icon={<AlertCircle className="h-4 w-4" />}>
        {issuance.error}
      </Note>
    );
  }
  const { puToIssue, actualIssuedSU, remainderSU, requestedSU } = issuance.value;
  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm space-y-1.5">
      <div className="text-amber-900 text-base font-semibold">
        จ่ายจริง: {puToIssue.toLocaleString()} {setup.primaryUnit} ({actualIssuedSU.toLocaleString()} {setup.secondaryUnit})
      </div>
      <div className="text-amber-700">ขอเบิก: {requestedSU.toLocaleString()} {setup.secondaryUnit}</div>
      <div className="text-amber-700">
        เศษเหลือหน้างาน: <strong>{remainderSU.toLocaleString()}</strong> {setup.secondaryUnit}
      </div>
    </div>
  );
}

function ReturnResultCard({
  setup,
  returnCalc,
  issuance,
}: {
  setup: SetupState;
  returnCalc: { ok: true; value: ReturnResult } | { ok: false; error: string } | null;
  issuance: { ok: true; value: IssuanceResult } | { ok: false; error: string } | null;
}) {
  if (!returnCalc || !issuance?.ok) {
    return (
      <Note tone="muted" icon={<Calculator className="h-4 w-4" />}>
        กรอก Step 2 และน้ำหนักที่ใช้จริงเพื่อดูผลคำนวณ
      </Note>
    );
  }
  if (!returnCalc.ok) {
    return (
      <Note tone="error" icon={<AlertCircle className="h-4 w-4" />}>
        {returnCalc.error}
      </Note>
    );
  }
  const { actualUsedSU, returnedSU, returnedPU } = returnCalc.value;
  return (
    <div className="rounded-xl bg-purple-50 border border-purple-200 p-4 text-sm space-y-1.5">
      <div className="text-purple-900 text-base font-semibold">
        คืนคลัง: {returnedPU.toLocaleString(undefined, { maximumFractionDigits: 4 })} {setup.primaryUnit}{' '}
        <span className="text-xs font-normal bg-purple-200 px-2 py-0.5 rounded ml-1">Zero Cost</span>
      </div>
      <div className="text-purple-700">
        ใช้จริง: {actualUsedSU.toLocaleString(undefined, { maximumFractionDigits: 3 })} {setup.secondaryUnit}
      </div>
      <div className="text-purple-700">
        เศษคืน: {returnedSU.toLocaleString(undefined, { maximumFractionDigits: 3 })} {setup.secondaryUnit}
      </div>
    </div>
  );
}

function Note({
  children,
  tone,
  icon,
}: {
  children: React.ReactNode;
  tone: 'muted' | 'error';
  icon: React.ReactNode;
}) {
  const toneClass =
    tone === 'error'
      ? 'bg-red-50 border-red-200 text-red-700'
      : 'bg-gray-50 border-gray-200 text-gray-500';
  return (
    <div className={`rounded-xl border p-4 text-sm flex items-start gap-2 ${toneClass}`}>
      <span className="mt-0.5">{icon}</span>
      <div>{children}</div>
    </div>
  );
}
