'use client';

/**
 * Scale Verification — main dashboard
 * Feature: 021-scale-verification
 *
 * Lives under the Premises & Facilities (อาคารและสถานที่) module — GMP
 * "Premises and Equipment". Backend API stays at /api/quality/scale-verifications.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { DxDataGrid, DxColumn, DxPaging } from '@/components/ui/dx-data-grid';
import { Button } from 'devextreme-react/button';
import { Popup } from 'devextreme-react/popup';
import { SelectBox } from 'devextreme-react/select-box';
import { NumberBox } from 'devextreme-react/number-box';
import { TextArea } from 'devextreme-react/text-area';
import { Scale, CheckCircle2, XCircle, AlertTriangle, History } from 'lucide-react';
import { BackButton } from '@/components/shared/BackButton';
import { toLocalDateStr } from '@/lib/utils/date-format';
import type { ScaleVerification, StandardWeight } from '@/types/scale-verification';

interface ScaleRow {
  scaleId: number;
  scaleCode: string;
  scaleName: string;
  status: string;
  lastVerifiedAt: string | null;
  lastResult: string | null;
  // Last-verification detail surfaced on the dashboard so operators
  // don't have to drill into history to see the most recent reading
  // and the weight that was used.
  lastActualReading: number | null;
  lastCertifiedValue: number | null;
  lastDeviationPercent: number | null;
  lastWeightCode: string | null;
  lastWeightDenomination: string | null;
  minVerificationWeightG: number | null;
  maxVerificationWeightG: number | null;
  calibrationCertNumber: string | null;
  calibrationExpiryDate: string | null;
}

// Convert a standard weight's denomination to grams (matches the server's
// toGrams) so we can compare it to a scale's min/max verification range.
function weightToGrams(value: number, unit: string | null | undefined): number {
  switch ((unit ?? '').toLowerCase()) {
    case 'kg':
      return value * 1000;
    case 'mg':
      return value / 1000;
    default:
      return value; // g
  }
}

// Translate the known server-side scale-verification errors into clear language
// so the operator understands what to fix instead of seeing a raw English
// message. The premises translator (tp) is passed in from the call site.
function translateVerifyError(msg: string, tp: (key: string) => string): string {
  if (/exceeds 10/i.test(msg) || /wrong weight/i.test(msg)) {
    return tp('scaleVerification.index.errorExtremeDeviation');
  }
  if (/below minimum/i.test(msg)) {
    return tp('scaleVerification.index.errorBelowMinimum');
  }
  if (/above maximum/i.test(msg)) {
    return tp('scaleVerification.index.errorAboveMaximum');
  }
  if (/inactive/i.test(msg)) {
    return tp('scaleVerification.index.errorInactive');
  }
  return msg;
}

export default function ScaleVerificationPage() {
  const t = useTranslations('scaleVerification');
  const tp = useTranslations('premises');
  const router = useRouter();
  const qc = useQueryClient();
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [activeScale, setActiveScale] = useState<ScaleRow | null>(null);
  const [weightId, setWeightId] = useState<number | null>(null);
  const [reading, setReading] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [password, setPassword] = useState('');

  const { data, refetch } = useQuery<{ items: ScaleRow[] }>({
    queryKey: ['scale-verifications-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/quality/scale-verifications');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const { data: weights } = useQuery<StandardWeight[]>({
    queryKey: ['standard-weights'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/standard-weights');
      if (!res.ok) return [];
      const body = await res.json();
      return (body?.data ?? body) as StandardWeight[];
    },
  });

  // LOCAL today (YYYY-MM-DD). NOT toISOString() — that is UTC and in ICT (UTC+7)
  // it can name the previous/next calendar day, which made "ตรวจสอบวันนี้" miss
  // verifications actually done today.
  const today = toLocalDateStr(new Date());

  // Local YYYY-MM-DD of a stored timestamp. performedAt comes back as a JS Date
  // (MySQL) → String(Date) is "Fri Jun 19 2026 …", whose .slice(0,10) is
  // "Fri Jun 19" and never matched today. Parsing via new Date() then formatting
  // local components handles both MySQL (Date) and SQLite (ISO string) shapes.
  const toLocalDay = (value: string | null | undefined): string | null => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : toLocalDateStr(d);
  };

  // Only weights whose certificate is still valid + active
  const validWeights = (weights ?? []).filter(
    (w) => w.isActive && w.certificateExpiryDate >= today,
  );

  // Does a standard weight fit the active scale's verification range? A weight
  // outside [min,max] is rejected server-side, so we want to keep it out of the
  // dropdown (or at least warn) instead of letting the operator pick a 1g weight
  // for a scale whose minimum is 1000g and then fail no matter what they type.
  const weightFitsScale = (w: StandardWeight): boolean => {
    if (!activeScale) return true;
    const g = weightToGrams(Number(w.denominationValue), w.denominationUnit);
    if (activeScale.minVerificationWeightG != null && g < activeScale.minVerificationWeightG) return false;
    if (activeScale.maxVerificationWeightG != null && g > activeScale.maxVerificationWeightG) return false;
    return true;
  };
  const fittingWeights = validWeights.filter(weightFitsScale);

  const expiringSoonCount = (weights ?? []).filter((w) => {
    const expiry = new Date(w.certificateExpiryDate);
    const inDays = Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return inDays >= 0 && inDays <= 30 && w.isActive;
  }).length;

  const scales = data?.items ?? [];
  const activeCount = scales.filter((s) => s.status === 'active').length;
  const oosCount = scales.filter((s) => s.status === 'out_of_service').length;

  // The selected standard weight (for the verify form) + a client-side check
  // that mirrors the server's "extreme deviation" guard (reading > 10× the
  // certified value ⇒ almost certainly the wrong weight was picked / a typo).
  // Surfacing it inline, in Thai, BEFORE submit avoids the cryptic English
  // server error and the repeated failed POSTs.
  const selectedWeight = validWeights.find((w) => w.id === weightId) ?? null;
  const extremeReading =
    selectedWeight != null &&
    reading > 0 &&
    Number(selectedWeight.denominationValue) > 0 &&
    (reading > Number(selectedWeight.denominationValue) * 10 ||
      reading < Number(selectedWeight.denominationValue) / 10);

  const verifyMut = useMutation({
    mutationFn: async () => {
      if (!activeScale || !weightId) throw new Error('Missing fields');
      if (!password.trim()) throw new Error(tp('scaleVerification.index.errorPasswordRequired'));
      const res = await fetch('/api/quality/scale-verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scaleId: activeScale.scaleId,
          standardWeightId: weightId,
          actualReading: reading,
          notes: notes || null,
          signature: { password: password.trim() },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Failed');
      return body as ScaleVerification;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scale-verifications-dashboard'] });
      setVerifyOpen(false);
      setActiveScale(null);
      setWeightId(null);
      setReading(0);
      setNotes('');
      setPassword('');
    },
  });

  return (
    <div className="p-6 space-y-4">
      <BackButton href="/premises" label={tp('scaleVerification.common.back')} />
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="w-6 h-6" />
            {t('page.title')}
          </h1>
          <p className="text-gray-600 text-sm mt-1">{t('page.subtitle')}</p>
        </div>
        <Button text={t('actions.refresh')} onClick={() => refetch()} />
      </header>

      {/* Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 border-l-4 border-l-emerald-500 rounded-[14px] p-4 flex items-center justify-between shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">{t('tiles.scalesActive')}</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{activeCount}</div>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-rose-500 rounded-[14px] p-4 flex items-center justify-between shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">{t('tiles.scalesOos')}</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{oosCount}</div>
          </div>
          <XCircle className="w-5 h-5 text-rose-500" />
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div className="text-xs uppercase text-gray-500">{t('tiles.verificationsToday')}</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{scales.filter((s) => toLocalDay(s.lastVerifiedAt) === today).length}</div>
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-amber-500 rounded-[14px] p-4 flex items-center justify-between shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div>
            <div className="text-xs uppercase text-gray-500">{t('tiles.expiringSoon')}</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{expiringSoonCount}</div>
          </div>
          <AlertTriangle className="w-5 h-5 text-amber-500" />
        </div>
      </div>

      <DxDataGrid
        dataSource={scales}
        keyExpr="scaleId"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
        elementAttr={{ 'data-testid': 'scales-grid' }}
        paging={false}
      >
        <DxPaging defaultPageSize={20} />
        <DxColumn dataField="scaleCode" caption={t('table.columns.scaleCode')} width={120} />
        <DxColumn dataField="scaleName" caption={t('table.columns.scaleName')} />
        <DxColumn
          caption={tp('scaleVerification.index.colCalibrationCert')}
          width={170}
          cellRender={(c) => {
            const row = c.data as ScaleRow;
            if (!row.calibrationCertNumber) {
              return <span className="text-xs text-amber-600">{tp('scaleVerification.index.certNotSpecified')}</span>;
            }
            // Warn when the scale's own calibration cert is expired / near expiry.
            const exp = row.calibrationExpiryDate ? new Date(row.calibrationExpiryDate) : null;
            const days = exp ? Math.ceil((exp.getTime() - Date.now()) / 86400000) : null;
            const tone =
              days == null ? 'text-gray-600'
                : days < 0 ? 'text-rose-700 font-medium'
                : days <= 30 ? 'text-amber-700'
                : 'text-gray-700';
            const expiryText = row.calibrationExpiryDate
              ? new Date(row.calibrationExpiryDate).toLocaleDateString('th-TH')
              : '';
            return (
              <div className="text-xs leading-tight">
                <div className="font-mono text-gray-800">{row.calibrationCertNumber}</div>
                {row.calibrationExpiryDate && (
                  <div className={tone}>
                    {days != null && days < 0
                      ? tp('scaleVerification.index.certExpired', { date: expiryText })
                      : tp('scaleVerification.index.certExpires', { date: expiryText })}
                    {days != null && days >= 0 && days <= 30
                      ? ' ' + tp('scaleVerification.index.certDaysLeft', { days })
                      : ''}
                  </div>
                )}
              </div>
            );
          }}
        />
        <DxColumn
          dataField="status"
          caption={t('table.columns.status')}
          width={150}
          cellRender={(c) => {
            const v = String(c.value ?? 'active');
            const color =
              v === 'active'
                ? 'bg-emerald-100 text-emerald-900'
                : v === 'out_of_service'
                  ? 'bg-rose-100 text-rose-900'
                  : 'bg-amber-100 text-amber-900';
            return <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${color}`}>{t(`status.${v}` as any)}</span>;
          }}
        />
        <DxColumn dataField="lastVerifiedAt" caption={t('table.columns.lastVerifiedAt')} dataType="datetime" width={160} />
        <DxColumn
          caption={tp('scaleVerification.index.colWeightUsed')}
          width={140}
          cellRender={(c) => {
            const row = c.data as ScaleRow;
            if (!row.lastWeightCode) return <span className="text-gray-400">—</span>;
            return (
              <div className="text-xs">
                <div className="font-mono font-medium text-gray-900">{row.lastWeightCode}</div>
                {row.lastWeightDenomination && (
                  <div className="text-gray-500">{row.lastWeightDenomination}</div>
                )}
              </div>
            );
          }}
        />
        <DxColumn
          caption={tp('scaleVerification.index.colActualReading')}
          width={130}
          cellRender={(c) => {
            const row = c.data as ScaleRow;
            if (row.lastActualReading == null) return <span className="text-gray-400">—</span>;
            return (
              <div className="text-xs font-mono">
                <div>{row.lastActualReading.toFixed(4)}</div>
                {row.lastCertifiedValue != null && (
                  <div className="text-gray-500">
                    cert {row.lastCertifiedValue.toFixed(4)}
                  </div>
                )}
              </div>
            );
          }}
        />
        <DxColumn
          caption="Δ %"
          width={90}
          cellRender={(c) => {
            const row = c.data as ScaleRow;
            if (row.lastDeviationPercent == null) return <span className="text-gray-400">—</span>;
            const v = row.lastDeviationPercent;
            const cls = Math.abs(v) > 0.1 ? 'text-rose-700' : 'text-gray-700';
            return <span className={`font-mono text-xs ${cls}`}>{v.toFixed(4)}%</span>;
          }}
        />
        <DxColumn
          dataField="lastResult"
          caption={t('table.columns.lastResult')}
          width={100}
          cellRender={(c) => {
            const v = c.value as string | null;
            if (!v) return '—';
            return v === 'pass' ? (
              <span className="text-emerald-700 font-medium">{t('result.pass')}</span>
            ) : (
              <span className="text-rose-700 font-medium">{t('result.fail')}</span>
            );
          }}
        />
        <DxColumn
          caption={t('table.columns.actions')}
          width={250}
          cellRender={(c) => {
            const row = c.data as ScaleRow;
            return (
              <div className="flex items-center gap-2">
                <Button
                  text={t('actions.verify')}
                  type="default"
                  stylingMode="outlined"
                  onClick={() => {
                    setActiveScale(row);
                    setVerifyOpen(true);
                  }}
                />
                <Button
                  type="normal"
                  stylingMode="text"
                  onClick={() =>
                    router.push(`/premises/scale-verification/${row.scaleId}/history`)
                  }
                  render={() => (
                    <span className="inline-flex items-center gap-1 text-sm text-indigo-700">
                      <History className="w-4 h-4" /> {tp('scaleVerification.index.history')}
                    </span>
                  )}
                />
              </div>
            );
          }}
        />
      </DxDataGrid>

      {/* Verify Popup */}
      <Popup
        visible={verifyOpen}
        onHiding={() => setVerifyOpen(false)}
        showCloseButton
        title={`${t('actions.verify')} — ${activeScale?.scaleCode ?? ''}`}
        width={560}
        height="auto"
      >
        <div className="p-4 space-y-3">
          {/* Decoy fields absorb browser credential autofill so it doesn't land
              on the reading / password inputs. */}
          <input type="text" name="fake-username" autoComplete="username" tabIndex={-1} aria-hidden="true"
            style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} readOnly />
          <input type="password" name="fake-password" autoComplete="new-password" tabIndex={-1} aria-hidden="true"
            style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} readOnly />
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.standardWeight.label')} *</label>
            {/* Only weights that fit this scale's range are offered, so the
                operator can't pick one that will always fail. */}
            <SelectBox
              dataSource={fittingWeights}
              displayExpr={(w: StandardWeight) =>
                w ? `${w.code} — ${w.denominationValue} ${w.denominationUnit} (${w.accuracyClass}) · cert ${w.certificateExpiryDate}` : ''
              }
              valueExpr="id"
              value={weightId}
              onValueChanged={(e) => setWeightId(e.value as number | null)}
              searchEnabled
              noDataText={tp('scaleVerification.index.noWeightFits')}
              inputAttr={{ autoComplete: 'off', name: 'scale-verify-weight', 'data-lpignore': 'true', 'data-form-type': 'other' }}
            />
            {(activeScale?.minVerificationWeightG != null || activeScale?.maxVerificationWeightG != null) && (
              <p className="text-xs text-gray-500 mt-1">
                {tp('scaleVerification.index.weightRangeLabel')}{' '}
                <b>
                  {activeScale?.minVerificationWeightG ?? 0}
                  {' – '}
                  {activeScale?.maxVerificationWeightG ?? '∞'} g
                </b>
              </p>
            )}
            {validWeights.length === 0 ? (
              <p className="text-xs text-rose-700 mt-1">
                {tp('scaleVerification.index.noValidWeights')}
              </p>
            ) : fittingWeights.length === 0 ? (
              <p className="text-xs text-rose-700 mt-1">
                {tp('scaleVerification.index.noFittingWeights')}
              </p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {t('form.actualReading.label')} *
              {selectedWeight && (
                <span className="text-gray-500 font-normal">
                  {' '}{tp('scaleVerification.index.readingUnit', { unit: selectedWeight.denominationUnit })}
                </span>
              )}
            </label>
            <NumberBox
              value={reading}
              onValueChanged={(e) => setReading(Number(e.value ?? 0))}
              step={0.0001}
              format="#0.0000"
              min={0}
              showSpinButtons
              inputAttr={{ autoComplete: 'off', name: 'scale-verify-reading', 'data-lpignore': 'true', 'data-form-type': 'other' }}
            />
            {selectedWeight && (
              <p className="text-xs text-gray-500 mt-1">
                {tp('scaleVerification.index.placeWeightHint', {
                  code: selectedWeight.code,
                  value: Number(selectedWeight.denominationValue),
                  unit: selectedWeight.denominationUnit,
                })}
              </p>
            )}
            {extremeReading && (
              <div className="mt-2 bg-rose-50 border border-rose-200 text-rose-900 rounded p-3 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  {tp('scaleVerification.index.extremeReadingWarning', {
                    reading,
                    value: Number(selectedWeight?.denominationValue),
                    unit: selectedWeight?.denominationUnit ?? '',
                  })}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('form.notes.label')}</label>
            <TextArea
              value={notes}
              height={60}
              onValueChanged={(e) => setNotes(String(e.value ?? ''))}
              inputAttr={{ autoComplete: 'off', name: 'scale-verify-notes', 'data-lpignore': 'true', 'data-form-type': 'other' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder={tp('scaleVerification.index.passwordPlaceholder')}
              autoComplete="new-password"
              data-lpignore="true"
              data-form-type="other"
            />
          </div>

          {verifyMut.error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded p-3 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {translateVerifyError(String((verifyMut.error as Error).message), tp)}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button text={t('actions.cancel')} stylingMode="text" onClick={() => setVerifyOpen(false)} />
            <Button
              type="success"
              stylingMode="contained"
              text={t('actions.verify')}
              disabled={!weightId || !password.trim() || verifyMut.isPending || extremeReading}
              onClick={() => verifyMut.mutate()}
            />
          </div>
        </div>
      </Popup>
    </div>
  );
}
