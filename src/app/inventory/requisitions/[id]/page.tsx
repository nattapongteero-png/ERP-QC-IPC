'use client';

/**
 * Material Requisition — Detail page.
 *
 * The list (/inventory/requisitions) is a DxDataGrid; clicking a row navigates
 * here. There is no single-requisition endpoint, so we fetch the list and find
 * the row by its rowKey (the route param, e.g. "wo-123" or "wd-45"). Shows the
 * requisition's info + materials and the approve (BOM) / release (out-of-BOM)
 * actions that used to live inline in the list's accordion.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { StatusStepper } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { DxButton } from '@/components/ui/dx-button';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, AlertTriangle, ArrowLeft } from 'lucide-react';
import { formatNumber } from '@/lib/utils/number-format';
import { RequisitionMaterialsTable } from '../_MaterialsTable';
import {
  rowKey,
  formatDateTh,
  isInsufficient,
  type RequisitionRow,
} from '../_lib';

export default function RequisitionDetailPage() {
  const params = useParams<{ id: string }>();
  const raw = decodeURIComponent(params.id);
  const router = useRouter();
  const t = useTranslations('inventory');
  const toast = useToast();

  const [rows, setRows] = useState<RequisitionRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [releasing, setReleasing] = useState(false);

  const fetchRequisitions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory/requisitions?status=all');
      const j = await res.json();
      if (j?.success) setRows((j.data ?? []) as RequisitionRow[]);
      else toast.error(t('requisitions.toast.loadFailed'), j?.error || '');
    } catch (err) {
      toast.error(t('requisitions.toast.loadFailed'), String(err));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void fetchRequisitions();
  }, [fetchRequisitions]);

  const row = rows?.find((r) => rowKey(r) === raw) ?? null;

  const reasonLabel = useCallback(
    (reasonType: string) => {
      const key = `requisitions.reasons.${reasonType}`;
      const translated = t(key);
      return translated === key ? reasonType : translated;
    },
    [t],
  );

  // ----- Actions -----
  const approve = async () => {
    if (!row) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/production/work-orders/${row.workOrderId}/requisition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (data.success) {
        const issued = (data.data?.issued ?? []) as {
          itemCode: string;
          puToIssue: number;
          pu: string;
          suIssued: number;
          su: string;
        }[];
        if (issued.length > 0) {
          const lines = issued
            .map((i) =>
              t('requisitions.toast.issuedLine', {
                code: i.itemCode,
                pu: formatNumber(i.puToIssue),
                puUnit: i.pu,
                su: formatNumber(i.suIssued),
                suUnit: i.su,
              }),
            )
            .join('\n');
          toast.success(t('requisitions.toast.approveReleaseSuccess'), lines);
        } else {
          toast.success(t('requisitions.toast.approveSuccess'));
        }
        await fetchRequisitions();
      } else {
        toast.error(t('requisitions.toast.approveFailed'), data.error || '');
      }
    } catch (err) {
      toast.error(t('requisitions.toast.approveFailed'), String(err));
    } finally {
      setApproving(false);
    }
  };

  const release = async () => {
    if (!row?.requestId) return;
    setReleasing(true);
    try {
      const res = await fetch(`/api/material-withdrawal/requests/${row.requestId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        toast.success(t('requisitions.toast.releaseSuccess'), t('requisitions.toast.releaseSuccessDetail'));
        await fetchRequisitions();
      } else {
        toast.error(t('requisitions.toast.releaseFailed'), data.error || '');
      }
    } catch (err) {
      toast.error(t('requisitions.toast.releaseFailed'), String(err));
    } finally {
      setReleasing(false);
    }
  };

  // ----- Loading / not-found -----
  if (loading && !rows) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <DxLoadIndicator height={40} width={40} />
        </div>
      </MainLayout>
    );
  }

  if (!row) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto p-6 text-center">
          <p className="text-gray-500 mb-4">{t('requisitions.empty')}</p>
          <DxButton
            text="กลับ"
            icon="back"
            stylingMode="outlined"
            onClick={() => router.push('/inventory/requisitions')}
          />
        </div>
      </MainLayout>
    );
  }

  const insufficient = row.materials.some(isInsufficient);
  const isOob = row.source === 'out_of_bom';
  const released = row.workflowStatus === 'released';
  const approved = isOob ? row.workflowStatus === 'approved' : row.requisitionStatus === 'approved';

  // Stepper: 2 steps, current per source/state. Reuse badge labels.
  const stepKey = isOob
    ? released
      ? 'released'
      : 'awaitingRelease'
    : approved
      ? 'approved'
      : 'awaitingApproval';
  const steps = isOob
    ? [
        { key: 'awaitingRelease', label: t('requisitions.badges.awaitingRelease') },
        { key: 'released', label: t('requisitions.badges.released') },
      ]
    : [
        { key: 'awaitingApproval', label: t('requisitions.badges.awaitingApproval') },
        { key: 'approved', label: t('requisitions.badges.approved') },
      ];

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <button
              onClick={() => router.push('/inventory/requisitions')}
              className="mt-1 text-gray-400 hover:text-gray-700"
              aria-label="กลับ"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
              <ClipboardList className="h-7 w-7 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">{row.woNumber}</h1>
              <p className="text-sm text-gray-500">
                Batch {row.batchNumber}
                {row.productName ? ` · ${row.productName}` : ''}
                {row.productCode ? ` (${row.productCode})` : ''}
              </p>
              {isOob && row.reasonType && (
                <p className="text-xs text-blue-600 mt-0.5">
                  {t('requisitions.reason', { reason: reasonLabel(row.reasonType) })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {insufficient && !released && (
              <Badge variant="danger" dot>
                <AlertTriangle className="h-3 w-3 mr-1" /> {t('requisitions.badges.insufficient')}
              </Badge>
            )}
            <Badge variant={approved || released ? 'success' : 'warning'} dot>
              {isOob
                ? released
                  ? t('requisitions.badges.released')
                  : t('requisitions.badges.awaitingRelease')
                : approved
                  ? t('requisitions.badges.approved')
                  : t('requisitions.badges.awaitingApproval')}
            </Badge>
          </div>
        </div>

        {/* Status stepper */}
        <StatusStepper title="สถานะการดำเนินงาน" current={stepKey} steps={steps} />

        {/* Requisition info */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <Field label={t('requisitions.requestedBy', { name: '' }).replace(':', '').trim()} value={row.requestedBy ?? '—'} />
            <Field label="วันที่ขอเบิก" value={formatDateTh(row.requestedAt)} />
            {row.approvedBy && <Field label="อนุมัติโดย" value={row.approvedBy} />}
            {row.approvedAt && <Field label="วันที่อนุมัติ" value={formatDateTh(row.approvedAt)} />}
            {isOob && row.releasedBy && <Field label="จ่ายโดย" value={row.releasedBy} />}
            {isOob && row.releasedAt && <Field label="วันที่จ่าย" value={formatDateTh(row.releasedAt)} />}
          </div>
        </div>

        {/* Materials */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('requisitions.table.materialName')}</h3>
          <RequisitionMaterialsTable materials={row.materials} t={t} />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          {!isOob && !approved && (
            <>
              {insufficient && (
                <span className="text-xs text-red-600">{t('requisitions.insufficientCannotApprove')}</span>
              )}
              <DxButton
                text={approving ? t('requisitions.approvingBtn') : t('requisitions.approveBtn')}
                type="success"
                disabled={approving || insufficient}
                onClick={approve}
              />
            </>
          )}
          {isOob && !released && (
            <>
              {insufficient && (
                <span className="text-xs text-red-600">{t('requisitions.insufficientCannotRelease')}</span>
              )}
              <DxButton
                text={releasing ? t('requisitions.releasingBtn') : t('requisitions.releaseBtn')}
                type="success"
                disabled={releasing || insufficient}
                onClick={release}
              />
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 min-w-[110px]">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
