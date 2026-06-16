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
import {
  DataGrid,
  Column,
  Paging,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { Popup } from 'devextreme-react/popup';
import { SelectBox } from 'devextreme-react/select-box';
import { NumberBox } from 'devextreme-react/number-box';
import { TextArea } from 'devextreme-react/text-area';
import { Scale, CheckCircle2, XCircle, AlertTriangle, History } from 'lucide-react';
import { BackButton } from '@/components/shared/BackButton';
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
}

export default function ScaleVerificationPage() {
  const t = useTranslations('scaleVerification');
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
      return res.json();
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  // Only weights whose certificate is still valid + active
  const validWeights = (weights ?? []).filter(
    (w) => w.isActive && w.certificateExpiryDate >= today,
  );

  const expiringSoonCount = (weights ?? []).filter((w) => {
    const expiry = new Date(w.certificateExpiryDate);
    const inDays = Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return inDays >= 0 && inDays <= 30 && w.isActive;
  }).length;

  const scales = data?.items ?? [];
  const activeCount = scales.filter((s) => s.status === 'active').length;
  const oosCount = scales.filter((s) => s.status === 'out_of_service').length;

  const verifyMut = useMutation({
    mutationFn: async () => {
      if (!activeScale || !weightId) throw new Error('Missing fields');
      const res = await fetch('/api/quality/scale-verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scaleId: activeScale.scaleId,
          standardWeightId: weightId,
          actualReading: reading,
          notes: notes || null,
          signature: { password: password || 'verify' },
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
      <BackButton href="/premises" label="อาคารและสถานที่" />
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
          <div className="text-3xl font-bold text-gray-900 mt-1">{scales.filter((s) => s.lastVerifiedAt?.slice(0, 10) === today).length}</div>
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-amber-500 rounded-[14px] p-4 flex items-center justify-between shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div>
            <div className="text-xs uppercase text-gray-500">{t('tiles.expiringSoon')}</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{expiringSoonCount}</div>
          </div>
          <AlertTriangle className="w-5 h-5 text-amber-500" />
        </div>
      </div>

      <DataGrid
        dataSource={scales}
        keyExpr="scaleId"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
        data-testid="scales-grid"
      >
        <Paging pageSize={20} />
        <Column dataField="scaleCode" caption={t('table.columns.scaleCode')} width={120} />
        <Column dataField="scaleName" caption={t('table.columns.scaleName')} />
        <Column
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
        <Column dataField="lastVerifiedAt" caption={t('table.columns.lastVerifiedAt')} dataType="datetime" width={160} />
        <Column
          caption="ลูกตุ้มที่ใช้"
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
        <Column
          caption="ค่าที่อ่านได้"
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
        <Column
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
        <Column
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
        <Column
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
                      <History className="w-4 h-4" /> ประวัติ
                    </span>
                  )}
                />
              </div>
            );
          }}
        />
      </DataGrid>

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
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.standardWeight.label')} *</label>
            <SelectBox
              dataSource={validWeights}
              displayExpr={(w: StandardWeight) =>
                w ? `${w.code} — ${w.denominationValue} ${w.denominationUnit} (${w.accuracyClass}) · cert ${w.certificateExpiryDate}` : ''
              }
              valueExpr="id"
              value={weightId}
              onValueChanged={(e) => setWeightId(e.value as number | null)}
              searchEnabled
            />
            {validWeights.length === 0 && (
              <p className="text-xs text-rose-700 mt-1">
                ไม่มีลูกตุ้มที่ใบรับรองยังไม่หมดอายุ — กรุณาเพิ่มในทะเบียน
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('form.actualReading.label')} *</label>
            <NumberBox
              value={reading}
              onValueChanged={(e) => setReading(Number(e.value ?? 0))}
              step={0.0001}
              format="#0.0000"
              min={0}
              showSpinButtons
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('form.notes.label')}</label>
            <TextArea
              value={notes}
              height={60}
              onValueChanged={(e) => setNotes(String(e.value ?? ''))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="ลงนามด้วย password"
            />
          </div>

          {verifyMut.error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded p-3 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {String((verifyMut.error as Error).message)}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button text={t('actions.cancel')} stylingMode="text" onClick={() => setVerifyOpen(false)} />
            <Button
              type="success"
              stylingMode="contained"
              text={t('actions.verify')}
              disabled={!weightId || verifyMut.isPending}
              onClick={() => verifyMut.mutate()}
            />
          </div>
        </div>
      </Popup>
    </div>
  );
}
