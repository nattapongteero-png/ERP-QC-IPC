'use client';

/**
 * Scale Verification Banner — used inside Material Weighing dialog
 *
 * - Lets operator pick the scale they're using.
 * - Checks the scale's current verification.
 * - Shows green/red banner depending on whether a passing verification
 *   exists within the verificationIntervalHours window.
 * - Provides a jump-to-verification link.
 *
 * Feature: 021-scale-verification (integration with material weighing)
 */
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { SelectBox } from 'devextreme-react/select-box';
import { CheckCircle2, AlertTriangle, Droplets, ExternalLink } from 'lucide-react';

interface ScaleOption {
  scaleId: number;
  scaleCode: string;
  scaleName: string;
  status: string;
  lastVerifiedAt: string | null;
  lastResult: string | null;
}

interface Verification {
  id: number;
  scaleId: number;
  result: 'pass' | 'fail';
  performedAt: string;
  validUntil: string;
  deviationPercent: number;
}

interface Props {
  scaleId: number | undefined;
  onScaleChange: (id: number | undefined) => void;
  isWaterMaterial: boolean;
}

export function ScaleVerificationBanner({ scaleId, onScaleChange, isWaterMaterial }: Props) {
  const { data: dashboard } = useQuery<{ items: ScaleOption[] }>({
    queryKey: ['scale-verifications-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/quality/scale-verifications');
      if (!res.ok) return { items: [] };
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: current } = useQuery<{ current: Verification | null }>({
    queryKey: ['scale-current-verification', scaleId],
    queryFn: async () => {
      if (!scaleId) return { current: null };
      const res = await fetch(`/api/quality/scale-verifications/scale/${scaleId}`);
      if (!res.ok) return { current: null };
      return res.json();
    },
    enabled: !!scaleId,
    refetchInterval: 60_000,
  });

  if (isWaterMaterial) {
    return (
      <div className="bg-sky-50 border border-sky-200 rounded p-3 flex items-center gap-2 text-sky-900 text-sm">
        <Droplets className="w-4 h-4" />
        <span>วัสดุประเภทน้ำ — ไม่ต้องตรวจเครื่องชั่งก่อนชั่ง</span>
      </div>
    );
  }

  const scales = dashboard?.items ?? [];
  const verification = current?.current;
  const validUntilDate = verification ? new Date(verification.validUntil) : null;
  const isCurrentValid =
    !!verification && verification.result === 'pass' && validUntilDate! > new Date();

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          เครื่องชั่งที่ใช้ * (Feature 021 — Pre-Use Verification)
        </label>
        <SelectBox
          dataSource={scales}
          displayExpr={(s: ScaleOption) =>
            s ? `${s.scaleCode} — ${s.scaleName} (${s.status})` : ''
          }
          valueExpr="scaleId"
          value={scaleId ?? null}
          onValueChanged={(e) => onScaleChange((e.value as number | null) ?? undefined)}
          searchEnabled
          placeholder="เลือกเครื่องชั่ง"
        />
      </div>

      {scaleId && isCurrentValid && verification && (
        <div className="bg-emerald-50 border border-emerald-200 rounded p-3 flex items-start gap-2 text-emerald-900 text-sm">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-medium">เครื่องชั่งผ่านการตรวจสอบ ใช้งานได้</div>
            <div className="text-xs mt-0.5 opacity-80">
              ตรวจล่าสุด {new Date(verification.performedAt).toLocaleString('th-TH')} ·
              Δ {verification.deviationPercent.toFixed(4)}% · หมดอายุการตรวจ{' '}
              {validUntilDate!.toLocaleString('th-TH')}
            </div>
          </div>
        </div>
      )}

      {scaleId && !isCurrentValid && (
        <div className="bg-rose-50 border border-rose-200 rounded p-3 flex items-start gap-2 text-rose-900 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-medium">เครื่องชั่งยังไม่ผ่านการตรวจสอบ (ภายในเวลาที่กำหนด)</div>
            <div className="text-xs mt-0.5 opacity-80">
              ต้องตรวจเครื่องชั่งด้วยลูกตุ้มมาตรฐานก่อนชั่งวัตถุดิบทุกครั้ง
            </div>
            <Link
              href="/premises/scale-verification"
              target="_blank"
              className="inline-flex items-center gap-1 mt-2 text-xs font-medium underline"
            >
              เปิดหน้าตรวจเครื่องชั่ง <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
