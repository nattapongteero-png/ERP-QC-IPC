'use client';

/**
 * Scale Verification — per-scale history page.
 *
 * Read-only audit view of every verification ever performed on a given
 * scale. Editing is intentionally absent — verification records carry an
 * electronic signature and are immutable under GMP / 21 CFR Part 11.
 *
 * Reached from the main /premises/scale-verification table via the
 * "ประวัติ" link in the actions column.
 */
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import {
  DataGrid,
  Column,
  Paging,
  Pager,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { Scale, CheckCircle2, XCircle, ArrowLeft, Clock } from 'lucide-react';

interface HistoryRow {
  id: number;
  scaleId: number;
  standardWeightId: number;
  certifiedValueSnapshot: number;
  certifiedUnitSnapshot: string;
  actualReading: number;
  deviationAmount: number;
  deviationPercent: number;
  result: 'pass' | 'fail';
  operatorUserId: number;
  performedAt: string;
  validUntil: string | null;
  notes: string | null;
  weightCode: string | null;
  weightDenomination: string | null;
  operatorName: string | null;
}

export default function ScaleHistoryPage() {
  const tp = useTranslations('premises');
  const params = useParams<{ scaleId: string }>();
  const router = useRouter();
  const scaleId = Number(params.scaleId);

  const { data, isLoading, refetch } = useQuery<{
    current: HistoryRow | null;
    history: HistoryRow[];
  }>({
    queryKey: ['scale-history', scaleId],
    queryFn: async () => {
      const res = await fetch(`/api/quality/scale-verifications/scale/${scaleId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !isNaN(scaleId),
  });

  const history = data?.history ?? [];
  const passCount = history.filter((h) => h.result === 'pass').length;
  const failCount = history.filter((h) => h.result === 'fail').length;
  const scaleCode = tp('scaleVerification.history.scaleLabel', { scaleId });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button
          icon="back"
          onClick={() => router.push('/premises/scale-verification')}
          stylingMode="text"
          render={() => (
            <span className="inline-flex items-center gap-1.5 text-sm">
              <ArrowLeft className="w-4 h-4" /> {tp('scaleVerification.history.back')}
            </span>
          )}
        />
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Scale className="w-6 h-6" />
          {tp('scaleVerification.history.title', { scaleCode })}
        </h1>
      </div>
      <p className="text-gray-600 text-sm">
        {tp('scaleVerification.history.subtitle')}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div className="text-xs uppercase text-gray-500">{tp('scaleVerification.history.statTotal')}</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{history.length}</div>
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-emerald-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)] flex items-center justify-between">
          <div>
            <div className="text-xs uppercase text-gray-500">{tp('scaleVerification.history.statPass')}</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{passCount}</div>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-rose-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)] flex items-center justify-between">
          <div>
            <div className="text-xs uppercase text-gray-500">{tp('scaleVerification.history.statFail')}</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{failCount}</div>
          </div>
          <XCircle className="w-5 h-5 text-rose-500" />
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-cyan-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)] flex items-center justify-between">
          <div>
            <div className="text-xs uppercase text-gray-500">{tp('scaleVerification.history.statActive')}</div>
            <div className="text-base font-medium text-gray-900 mt-1">
              {data?.current
                ? tp('scaleVerification.history.hasValidVerification')
                : tp('scaleVerification.history.noValidVerification')}
            </div>
          </div>
          <Clock className="w-5 h-5 text-cyan-500" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button text={tp('scaleVerification.history.refresh')} icon="refresh" onClick={() => refetch()} />
        <span className="text-sm text-gray-500">{tp('scaleVerification.history.itemCount', { count: history.length })}</span>
      </div>

      {/* History grid */}
      <DataGrid
        dataSource={history}
        keyExpr="id"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
        noDataText={isLoading ? tp('scaleVerification.history.loading') : tp('scaleVerification.history.noData')}
      >
        <Paging pageSize={20} />
        <Pager visible showPageSizeSelector allowedPageSizes={[20, 50, 100]} />
        <Column dataField="performedAt" caption={tp('scaleVerification.history.colPerformedAt')} dataType="datetime" width={170} />
        <Column dataField="weightCode" caption={tp('scaleVerification.history.colWeight')} width={110} />
        <Column dataField="weightDenomination" caption={tp('scaleVerification.history.colWeightSize')} width={130} />
        <Column
          caption={tp('scaleVerification.history.colCertifiedValue')}
          width={130}
          cellRender={(c) => {
            const row = c.data as HistoryRow;
            return (
              <span className="font-mono text-xs">
                {row.certifiedValueSnapshot.toFixed(4)} {row.certifiedUnitSnapshot}
              </span>
            );
          }}
        />
        <Column
          caption={tp('scaleVerification.history.colActualReading')}
          dataField="actualReading"
          width={130}
          cellRender={(c) => (
            <span className="font-mono text-xs">{Number(c.value ?? 0).toFixed(4)}</span>
          )}
        />
        <Column
          caption="Δ %"
          dataField="deviationPercent"
          width={100}
          cellRender={(c) => {
            const v = Number(c.value ?? 0);
            const color = Math.abs(v) > 0.1 ? 'text-rose-700' : 'text-gray-700';
            return <span className={`font-mono text-xs ${color}`}>{v.toFixed(4)}%</span>;
          }}
        />
        <Column
          dataField="result"
          caption={tp('scaleVerification.history.colResult')}
          width={90}
          cellRender={(c) => {
            const v = c.value as string;
            return v === 'pass' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-900">
                <CheckCircle2 className="w-3 h-3" /> {tp('scaleVerification.history.resultPass')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-900">
                <XCircle className="w-3 h-3" /> {tp('scaleVerification.history.resultFail')}
              </span>
            );
          }}
        />
        <Column dataField="operatorName" caption={tp('scaleVerification.history.colOperator')} />
        <Column dataField="validUntil" caption={tp('scaleVerification.history.colValidUntil')} dataType="datetime" width={170} />
        <Column dataField="notes" caption={tp('scaleVerification.history.colNotes')} />
      </DataGrid>
    </div>
  );
}
