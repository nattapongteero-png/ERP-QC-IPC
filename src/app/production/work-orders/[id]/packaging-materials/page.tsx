'use client';

/**
 * Packaging Materials page for a Work Order — combines Issue + Return + Verify + Approve queues
 * Feature 019 — MVP single page (split into sub-pages as needed)
 */

import { use, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from 'devextreme-react/button';
import { Box, CheckCircle2, Clock, Plus, Undo2 } from 'lucide-react';
import { PackagingIssuanceDialog } from '@/components/production/packaging-issuance-dialog';
import { PackagingReturnDialog } from '@/components/production/packaging-return-dialog';
import { ElectronicSignatureDialog } from '@/components/shared/ElectronicSignatureDialog';
import type { IssuanceDetail, ReturnDetail } from '@/types/packaging';

interface PackagingMaterialsPageProps {
  params: Promise<{ id: string }>;
}

export default function PackagingMaterialsPage({ params }: PackagingMaterialsPageProps) {
  const { id } = use(params);
  const workOrderId = Number.parseInt(id, 10);
  const t = useTranslations('packaging');
  const qc = useQueryClient();

  const [issueOpen, setIssueOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState<IssuanceDetail | null>(null);
  const [verifyIssuanceTarget, setVerifyIssuanceTarget] = useState<IssuanceDetail | null>(null);
  const [verifyReturnTarget, setVerifyReturnTarget] = useState<ReturnDetail | null>(null);
  const [approveTarget, setApproveTarget] = useState<ReturnDetail | null>(null);

  const { data: issuances, refetch: refetchIssue } = useQuery<IssuanceDetail[]>({
    queryKey: ['packaging-issuances', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/packaging-issuances`);
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: returns, refetch: refetchReturns } = useQuery<ReturnDetail[]>({
    queryKey: ['packaging-returns', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/packaging-returns`);
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000,
  });

  const verifyIssuanceMut = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const res = await fetch(
        `/api/production/work-orders/${workOrderId}/packaging-issuances/${id}/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Verify failed');
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packaging-issuances', workOrderId] });
      setVerifyIssuanceTarget(null);
    },
  });

  const verifyReturnMut = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const res = await fetch(
        `/api/production/work-orders/${workOrderId}/packaging-returns/${id}/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Verify failed');
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packaging-returns', workOrderId] });
      setVerifyReturnTarget(null);
    },
  });

  const approveMut = useMutation({
    mutationFn: async ({
      id,
      finalStatus,
      password,
    }: {
      id: number;
      finalStatus: 'approved_reusable' | 'approved_quarantine' | 'rejected';
      password: string;
    }) => {
      const res = await fetch(
        `/api/production/work-orders/${workOrderId}/packaging-returns/${id}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ finalStatus, password }),
        },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Approve failed');
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packaging-returns', workOrderId] });
      setApproveTarget(null);
    },
  });

  const pendingVerifyIssuances = issuances?.filter((i) => i.flowStatus === 'pending_verification') ?? [];
  const issuedIssuances = issuances?.filter((i) => i.flowStatus === 'issued') ?? [];
  const pendingReturnVerify = returns?.filter((r) => !r.verifiedAt && r.status === 'pending_qa_approval') ?? [];
  const pendingQAApproval = returns?.filter((r) => r.verifiedAt && r.status === 'pending_qa_approval') ?? [];

  return (
    <>
      <div className="p-6 space-y-4">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Box className="w-6 h-6" />
              {t('page.title')} — WO #{workOrderId}
            </h1>
            <p className="text-[#4B7163] text-sm mt-1">{t('page.description')}</p>
          </div>
          <div className="flex gap-2">
            <Button
              text={t('buttons.refresh')}
              onClick={() => {
                refetchIssue();
                refetchReturns();
              }}
            />
            <Button
              type="default"
              stylingMode="contained"
              onClick={() => setIssueOpen(true)}
              render={() => (
                <span className="inline-flex items-center gap-1">
                  <Plus className="w-4 h-4" />
                  {t('buttons.issue')}
                </span>
              )}
            />
          </div>
        </header>

        {/* Pending Verify Issuance */}
        {pendingVerifyIssuances.length > 0 && (
          <section className="rounded-md border bg-white p-4">
            <h2 className="font-semibold mb-2 flex items-center gap-1">
              <Clock className="w-4 h-4 text-amber-600" />
              {t('status.pending_verification')} ({pendingVerifyIssuances.length})
            </h2>
            <ul className="space-y-2">
              {pendingVerifyIssuances.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between border rounded-md px-3 py-2"
                >
                  <div className="text-sm">
                    <div className="font-medium">
                      #{i.id} — {i.itemName} · {i.quantity} {i.unit}
                    </div>
                    <div className="text-gray-500 text-xs">
                      Container: <code>{i.containerLabel}</code> · {i.operator.name}
                    </div>
                  </div>
                  <Button
                    text={t('buttons.verify')}
                    type="success"
                    stylingMode="outlined"
                    onClick={() => setVerifyIssuanceTarget(i)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Issued (can be returned) */}
        {issuedIssuances.length > 0 && (
          <section className="rounded-md border bg-white p-4">
            <h2 className="font-semibold mb-2 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {t('status.issued')} ({issuedIssuances.length})
            </h2>
            <ul className="space-y-2">
              {issuedIssuances.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between border rounded-md px-3 py-2"
                >
                  <div className="text-sm">
                    <div className="font-medium">
                      #{i.id} — {i.itemName} · {i.quantity} {i.unit}
                    </div>
                    <div className="text-gray-500 text-xs">
                      Container: <code>{i.containerLabel}</code>
                    </div>
                  </div>
                  <Button
                    text={t('buttons.return')}
                    stylingMode="outlined"
                    onClick={() => setReturnTarget(i)}
                    render={() => (
                      <span className="inline-flex items-center gap-1">
                        <Undo2 className="w-4 h-4" />
                        {t('buttons.return')}
                      </span>
                    )}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Pending Verify Return */}
        {pendingReturnVerify.length > 0 && (
          <section className="rounded-md border bg-white p-4">
            <h2 className="font-semibold mb-2">
              {t('common.returns')} — {t('status.pending_qa_approval')} (Verify Pending)
              ({pendingReturnVerify.length})
            </h2>
            <ul className="space-y-2">
              {pendingReturnVerify.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between border rounded-md px-3 py-2"
                >
                  <div className="text-sm">
                    <div className="font-medium">
                      #{r.id} — {r.itemName} · used {r.usedQty} / return {r.returnQty} / variance{' '}
                      {r.varianceQty}
                    </div>
                    <div className="text-gray-500 text-xs">
                      Returner: {r.returner.name} · {t(`form.proposedStatus.options.${r.proposedStatus}`)}
                    </div>
                  </div>
                  <Button
                    text={t('buttons.verify')}
                    type="success"
                    stylingMode="outlined"
                    onClick={() => setVerifyReturnTarget(r)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Pending QA Approval */}
        {pendingQAApproval.length > 0 && (
          <section className="rounded-md border bg-amber-50 p-4">
            <h2 className="font-semibold mb-2">
              QA Pending Approval (Triple Independence) ({pendingQAApproval.length})
            </h2>
            <ul className="space-y-2">
              {pendingQAApproval.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between border rounded-md bg-white px-3 py-2"
                >
                  <div className="text-sm">
                    <div className="font-medium">
                      #{r.id} — {r.itemName} · Variance {r.varianceQty} ({r.variancePercent.toFixed(2)}%)
                      {r.outsideTolerance && (
                        <span className="ml-2 text-red-600">⚠ outside tolerance</span>
                      )}
                    </div>
                    <div className="text-gray-500 text-xs">
                      Returner: {r.returner.name} · Verifier: {r.verifier?.name ?? '—'} · Proposed:{' '}
                      {t(`form.proposedStatus.options.${r.proposedStatus}`)}
                    </div>
                  </div>
                  <Button
                    text={t('buttons.approve')}
                    type="default"
                    stylingMode="contained"
                    onClick={() => setApproveTarget(r)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {!pendingVerifyIssuances.length &&
          !issuedIssuances.length &&
          !pendingReturnVerify.length &&
          !pendingQAApproval.length && (
            <div className="rounded-md border bg-white p-8 text-center text-gray-500">
              ยังไม่มีข้อมูล Packaging Material ใน Work Order นี้
            </div>
          )}
      </div>

      {/* Issuance dialog (minimal — empty lots/rooms list; real data via prop drilling later) */}
      <PackagingIssuanceDialog
        visible={issueOpen}
        onClose={() => setIssueOpen(false)}
        workOrderId={workOrderId}
        bomOptions={[]}
        lots={[]}
        rooms={[]}
      />

      {/* Return dialog */}
      <PackagingReturnDialog
        visible={returnTarget !== null}
        onClose={() => setReturnTarget(null)}
        workOrderId={workOrderId}
        issuance={returnTarget}
      />

      {/* Verify issuance e-sig */}
      <ElectronicSignatureDialog
        visible={verifyIssuanceTarget !== null}
        title={t('buttons.verify')}
        action="verify"
        meaning="I verify this packaging issuance (Dual Control)."
        isLoading={verifyIssuanceMut.isPending}
        onSign={async (password) => {
          try {
            await verifyIssuanceMut.mutateAsync({ id: verifyIssuanceTarget!.id, password });
            return { success: true };
          } catch (e) {
            return { success: false, error: e instanceof Error ? e.message : 'Failed' };
          }
        }}
        onCancel={() => setVerifyIssuanceTarget(null)}
      />

      {/* Verify return e-sig */}
      <ElectronicSignatureDialog
        visible={verifyReturnTarget !== null}
        title={t('buttons.verify')}
        action="verify"
        meaning="I verify this packaging return (Dual Control)."
        isLoading={verifyReturnMut.isPending}
        onSign={async (password) => {
          try {
            await verifyReturnMut.mutateAsync({ id: verifyReturnTarget!.id, password });
            return { success: true };
          } catch (e) {
            return { success: false, error: e instanceof Error ? e.message : 'Failed' };
          }
        }}
        onCancel={() => setVerifyReturnTarget(null)}
      />

      {/* QA approve e-sig — default Reusable for MVP */}
      <ElectronicSignatureDialog
        visible={approveTarget !== null}
        title={t('approval.approveTitle')}
        action="approve"
        meaning="I approve this packaging return as Reusable (QA, Triple Independence)."
        isLoading={approveMut.isPending}
        onSign={async (password) => {
          try {
            await approveMut.mutateAsync({
              id: approveTarget!.id,
              finalStatus: 'approved_reusable',
              password,
            });
            return { success: true };
          } catch (e) {
            return { success: false, error: e instanceof Error ? e.message : 'Failed' };
          }
        }}
        onCancel={() => setApproveTarget(null)}
      />
    </>
  );
}
