'use client';

/**
 * Material Return Detail (Phase 4)
 *
 * Warehouse staff lands here to inspect a return before approving/rejecting.
 * Mirrors design §6.2:
 *   - Source/Receipt info card (header)
 *   - Lines table (Item / Source Lot / Issued / Used / Return / Variance ...)
 *   - Approve / Reject (only when status='submitted')
 *     - Approve → confirmation prompt → POST {action:'approve'}
 *     - Reject  → DxPopup with required reason → POST {action:'reject', reason}
 *   - After approval: show created lot numbers + deviation links
 *   - Print summary (window.print)
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { ResponsivePageHeader, StatusStepper } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup, DxConfirmDialog } from '@/components/ui/dx-popup';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowDownToLine,
  AlertTriangle,
  Package,
  XCircle,
} from 'lucide-react';

interface ReturnDetailLine {
  id: number;
  itemId: number;
  itemCode: string | null;
  itemName: string | null;
  sourceLot: {
    id: number;
    lotNumber: string;
    quantityRemaining: number;
    warehouseId: number;
    expiryDate: string | null;
  } | null;
  returnedLot: {
    id: number;
    lotNumber: string;
    status: string;
    quantity: number;
  } | null;
  issuedQty: number;
  issuedUnit: string;
  usedQty: number;
  usedUnit: string;
  returnQty: number;
  returnUnit: string;
  expectedVarianceQty: number | null;
  varianceQty: number;
  variancePct: number;
  varianceReason: string;
  varianceExplanation: string | null;
  isOutsideTolerance: boolean;
  returnContainerLabel: string | null;
  returnContainerType: string | null;
  notes: string | null;
  deviation: {
    id: number;
    deviationNumber: string;
    severity: string;
    status: string;
  } | null;
}

interface ReturnDetail {
  id: number;
  returnNumber: string;
  workOrderId: number | null;
  woNumber: string | null;
  receivingWarehouseId: number;
  warehouseName: string | null;
  status: string;
  returnDate: string;
  returnedBy: number;
  returnedByName: string | null;
  approvedBy: number | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lines: ReturnDetailLine[];
}

function formatDateTh(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateStr);
  }
}

function statusInfo(status: string) {
  switch (status) {
    case 'submitted':
      return { variant: 'warning' as const, labelKey: 'detail.statusInfo.submitted' };
    case 'received':
      return { variant: 'success' as const, labelKey: 'detail.statusInfo.received' };
    case 'rejected':
      return { variant: 'danger' as const, labelKey: 'detail.statusInfo.rejected' };
    default:
      return { variant: 'default' as const, labelKey: null };
  }
}

export default function MaterialReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations('inventory');

  const returnId = Number(params.id);
  const [detail, setDetail] = useState<ReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const fetchDetail = useCallback(async () => {
    if (!Number.isFinite(returnId)) {
      setError(t('returns.detail.invalidId'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/returns/${returnId}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.error || t('returns.detail.loadFailed'));
        setDetail(null);
      } else {
        setDetail(data.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [returnId, t]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await fetch(`/api/inventory/returns/${returnId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(t('returns.detail.toast.approveFailed'), data.error || 'Unknown error');
      } else {
        const newLotCount = data.data?.newLots?.length ?? 0;
        const devCount = data.data?.deviationsCreated?.length ?? 0;
        toast.success(
          t('returns.detail.toast.approveSuccess'),
          devCount > 0
            ? t('returns.detail.toast.approveSuccessDetailWithDev', { lots: newLotCount, devs: devCount })
            : t('returns.detail.toast.approveSuccessDetail', { lots: newLotCount }),
        );
        await fetchDetail();
      }
    } catch (e) {
      toast.error(t('returns.detail.toast.approveFailed'), e instanceof Error ? e.message : 'Network error');
    } finally {
      setApproving(false);
      setShowApproveConfirm(false);
    }
  };

  const handleCancelApproval = async () => {
    if (!confirm(t('returns.detail.cancelConfirm'))) {
      return;
    }
    setCancelling(true);
    try {
      const res = await fetch(`/api/inventory/returns/${returnId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel-approval' }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(t('returns.detail.toast.cancelFailed'), data.error || 'Unknown error');
      } else {
        toast.success(t('returns.detail.toast.cancelSuccess'), t('returns.detail.toast.cancelSuccessDetail'));
        await fetchDetail();
      }
    } catch (e) {
      toast.error(t('returns.detail.toast.cancelFailed'), e instanceof Error ? e.message : 'Network error');
    } finally {
      setCancelling(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error(t('returns.detail.toast.reasonRequired'), t('returns.detail.toast.reasonRequiredDetail'));
      return;
    }
    setRejecting(true);
    try {
      const res = await fetch(`/api/inventory/returns/${returnId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(t('returns.detail.toast.rejectFailed'), data.error || 'Unknown error');
      } else {
        toast.success(t('returns.detail.toast.rejectSuccess'), t('returns.detail.toast.rejectSuccessDetail'));
        setShowRejectDialog(false);
        setRejectReason('');
        await fetchDetail();
      }
    } catch (e) {
      toast.error(t('returns.detail.toast.rejectFailed'), e instanceof Error ? e.message : 'Network error');
    } finally {
      setRejecting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <DxLoadIndicator />
        </div>
      </MainLayout>
    );
  }

  if (error || !detail) {
    return (
      <MainLayout>
        <div className="flex flex-col gap-5 p-4 md:p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-red-800">{t('returns.detail.loadFailedTitle')}</p>
              <p className="text-sm text-red-700">{error || t('returns.detail.notFound')}</p>
            </div>
            <DxButton
              text={t('returns.detail.back')}
              icon="back"
              stylingMode="outlined"
              onClick={() => router.push('/inventory/returns')}
            />
          </div>
        </div>
      </MainLayout>
    );
  }

  const sInfo = statusInfo(detail.status);
  const canAct = detail.status === 'submitted';
  const canCancel = detail.status === 'received';

  // Aggregate created lots/deviations across lines for the post-approval banner.
  const createdLots = detail.lines.filter((l) => l.returnedLot).map((l) => l.returnedLot!);
  const linkedDeviations = detail.lines.filter((l) => l.deviation).map((l) => l.deviation!);

  const lineColumns: DxDataGridColumn[] = [
    {
      dataField: 'itemCode',
      caption: t('returns.detail.columns.material'),
      minWidth: 200,
      cellRender: (cell) => (
        <div>
          <p className="font-mono text-xs text-gray-500">{cell.data.itemCode}</p>
          <p className="font-medium text-gray-900">{cell.data.itemName}</p>
        </div>
      ),
    },
    {
      dataField: 'sourceLot.lotNumber',
      caption: t('returns.detail.columns.sourceLot'),
      width: 160,
      cellRender: (cell) =>
        cell.data.sourceLot ? (
          <span className="font-mono text-sm">{cell.data.sourceLot.lotNumber}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      dataField: 'issuedQty',
      caption: t('returns.detail.columns.issued'),
      width: 110,
      alignment: 'right',
      cellRender: (cell) => (
        <span>
          {Number(cell.data.issuedQty).toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
          <span className="text-xs text-gray-500">{cell.data.issuedUnit}</span>
        </span>
      ),
    },
    {
      dataField: 'usedQty',
      caption: t('returns.detail.columns.used'),
      width: 110,
      alignment: 'right',
      cellRender: (cell) => (
        <span>
          {Number(cell.data.usedQty).toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
          <span className="text-xs text-gray-500">{cell.data.usedUnit}</span>
        </span>
      ),
    },
    {
      dataField: 'returnQty',
      caption: t('returns.detail.columns.returned'),
      width: 110,
      alignment: 'right',
      cellRender: (cell) => (
        <span className="font-medium text-emerald-700">
          {Number(cell.data.returnQty).toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
          <span className="text-xs text-gray-500">{cell.data.returnUnit}</span>
        </span>
      ),
    },
    {
      dataField: 'varianceQty',
      caption: t('returns.detail.columns.variance'),
      width: 110,
      alignment: 'right',
      cellRender: (cell) => (
        <span>
          {Number(cell.data.varianceQty).toLocaleString(undefined, { maximumFractionDigits: 4 })}
        </span>
      ),
    },
    {
      dataField: 'variancePct',
      caption: t('returns.detail.columns.variancePct'),
      width: 100,
      alignment: 'right',
      cellRender: (cell) => {
        const outside = cell.data.isOutsideTolerance;
        return (
          <span
            className={
              'font-medium ' + (outside ? 'text-red-600' : 'text-gray-700')
            }
          >
            {Number(cell.data.variancePct).toFixed(2)}%
          </span>
        );
      },
    },
    {
      dataField: 'varianceReason',
      caption: t('returns.detail.columns.reason'),
      width: 140,
      cellRender: (cell) => <span className="text-sm capitalize">{String(cell.data.varianceReason).replace(/_/g, ' ')}</span>,
    },
    {
      dataField: 'isOutsideTolerance',
      caption: t('returns.detail.columns.outsideTolerance'),
      width: 110,
      alignment: 'center',
      cellRender: (cell) =>
        cell.data.isOutsideTolerance ? (
          <Badge variant="danger">{t('returns.detail.outsideTolerance')}</Badge>
        ) : (
          <Badge variant="success">OK</Badge>
        ),
    },
    {
      dataField: 'returnContainerLabel',
      caption: t('returns.detail.columns.container'),
      minWidth: 160,
      cellRender: (cell) => (
        <div>
          <p className="font-mono text-xs">{cell.data.returnContainerLabel || '—'}</p>
          {cell.data.returnContainerType && (
            <p className="text-xs text-gray-500 capitalize">{cell.data.returnContainerType}</p>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full print:p-0">
        <div className="print:hidden">
          <ResponsivePageHeader
            title={t('returns.detail.title', { number: detail.returnNumber })}
            subtitle={
              detail.woNumber ? t('returns.detail.subtitleWo', { wo: detail.woNumber }) : t('returns.detail.subtitleNoWo')
            }
            icon={ArrowDownToLine}
            iconBgColor="bg-purple-100"
            iconColor="text-purple-600"
            breadcrumbs={[
              { label: t('returns.breadcrumbs.inventory'), href: '/inventory' },
              { label: t('returns.breadcrumbs.returns'), href: '/inventory/returns' },
              { label: detail.returnNumber },
            ]}
            actions={
              <div className="flex items-center gap-2 flex-wrap">
                <DxButton
                  text={t('returns.detail.back')}
                  icon="back"
                  stylingMode="outlined"
                  onClick={() => router.push('/inventory/returns')}
                />
                <DxButton
                  text={t('returns.detail.print')}
                  icon="print"
                  stylingMode="outlined"
                  onClick={handlePrint}
                />
                {canAct && (
                  <>
                    <DxButton
                      text={t('returns.detail.reject')}
                      icon="close"
                      type="danger"
                      stylingMode="outlined"
                      onClick={() => {
                        setRejectReason('');
                        setShowRejectDialog(true);
                      }}
                      disabled={approving || rejecting}
                    />
                    <DxButton
                      text={t('returns.detail.approveReceive')}
                      icon="check"
                      type="success"
                      onClick={() => setShowApproveConfirm(true)}
                      disabled={approving || rejecting}
                    />
                  </>
                )}
                {canCancel && (
                  <DxButton
                    text={cancelling ? t('returns.detail.cancelling') : t('returns.detail.cancelApproval')}
                    icon="undo"
                    type="danger"
                    stylingMode="outlined"
                    onClick={handleCancelApproval}
                    disabled={cancelling}
                  />
                )}
              </div>
            }
          />
        </div>

        {/* Status Stepper — a return ends in ONE of two outcomes (received OR
            rejected), they are not sequential. So the second step is the
            outcome itself: "รับคืนแล้ว" normally, or "ปฏิเสธ" (red) when the
            request was rejected — never both, which is what confused users. */}
        <div className="mb-6 print:hidden">
          {String(detail.status).toLowerCase() === 'rejected' ? (
            <StatusStepper
              title={t('returns.detail.stepper.title')}
              steps={[
                { key: 'submitted', label: t('returns.detail.stepper.submitted') },
                { key: 'rejected', label: t('returns.detail.stepper.rejected'), icon: XCircle },
              ]}
              current="rejected"
              tone="violet"
            />
          ) : (
            <StatusStepper
              title={t('returns.detail.stepper.title')}
              steps={[
                { key: 'submitted', label: t('returns.detail.stepper.submitted') },
                { key: 'received', label: t('returns.detail.stepper.received') },
              ]}
              current={String(detail.status).toLowerCase()}
            />
          )}
        </div>

        {/* Print-only header */}
        <div className="hidden print:block">
          <h1 className="text-2xl font-bold">{detail.returnNumber}</h1>
          <p className="text-sm">
            {detail.woNumber ? `WO #${detail.woNumber}` : ''} · {formatDateTh(detail.returnDate)}
          </p>
        </div>

        {/* Header info card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{t('returns.detail.fields.status')}</p>
              <div className="mt-1">
                <Badge variant={sInfo.variant}>{sInfo.labelKey ? t(`returns.${sInfo.labelKey}`) : detail.status}</Badge>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{t('returns.detail.fields.returnDate')}</p>
              <p className="mt-1 text-sm font-medium">{formatDateTh(detail.returnDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{t('returns.detail.fields.returnedBy')}</p>
              <p className="mt-1 text-sm font-medium">{detail.returnedByName || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{t('returns.detail.fields.warehouse')}</p>
              <p className="mt-1 text-sm font-medium">{detail.warehouseName || '—'}</p>
            </div>
            {detail.approvedAt && (
              <>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{t('returns.detail.fields.approvedDate')}</p>
                  <p className="mt-1 text-sm font-medium">{formatDateTh(detail.approvedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{t('returns.detail.fields.approvedBy')}</p>
                  <p className="mt-1 text-sm font-medium">{detail.approvedByName || '—'}</p>
                </div>
              </>
            )}
          </div>
          {detail.notes && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{t('returns.detail.fields.notes')}</p>
              <p className="mt-1 text-sm">{detail.notes}</p>
            </div>
          )}
          {detail.rejectionReason && (
            <div className="mt-4 pt-4 border-t border-red-100 bg-red-50 -mx-4 -mb-4 md:-mx-6 md:-mb-6 px-4 md:px-6 py-3 rounded-b-xl">
              <p className="text-xs text-red-700 uppercase tracking-wide font-semibold">
                {t('returns.detail.fields.rejectionReason')}
              </p>
              <p className="mt-1 text-sm text-red-900">{detail.rejectionReason}</p>
            </div>
          )}
        </div>

        {/* Post-approval results */}
        {detail.status === 'received' && createdLots.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Package className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-emerald-900">{t('returns.detail.newLotsCreated')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {createdLots.map((lot) => (
                    <span
                      key={lot.id}
                      className="inline-flex items-center gap-2 px-2 py-1 bg-white border border-emerald-300 rounded text-xs"
                    >
                      <span className="font-mono font-medium">{lot.lotNumber}</span>
                      <span className="text-gray-600">
                        {Number(lot.quantity).toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })}
                      </span>
                      <Badge variant={lot.status === 'released' ? 'success' : 'warning'}>
                        {lot.status}
                      </Badge>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {linkedDeviations.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-900">{t('returns.detail.relatedDeviations')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {linkedDeviations.map((dev) => (
                    <a
                      key={dev.id}
                      href={`/quality/deviations/${dev.id}`}
                      className="inline-flex items-center gap-2 px-2 py-1 bg-white border border-amber-300 rounded text-xs hover:bg-amber-100 transition"
                    >
                      <span className="font-mono font-medium">{dev.deviationNumber}</span>
                      <Badge variant={dev.severity === 'major' ? 'danger' : 'warning'}>
                        {dev.severity}
                      </Badge>
                      <span className="text-gray-600">{dev.status}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lines table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-sm font-semibold text-gray-700">
              {t('returns.detail.linesTitle', { count: detail.lines.length })}
            </h2>
          </div>
          <DxDataGrid
            dataSource={detail.lines}
            keyExpr="id"
            columns={lineColumns}
            sorting
            pageSize={50}
            height="auto"
            noDataText={t('returns.detail.noLines')}
          />
        </div>
      </div>

      {/* Approve confirmation */}
      <DxConfirmDialog
        visible={showApproveConfirm}
        title={t('returns.detail.approveConfirm.title')}
        message={t('returns.detail.approveConfirm.message')}
        confirmText={approving ? t('returns.detail.approveConfirm.confirming') : t('returns.detail.approveConfirm.confirm')}
        confirmType="success"
        cancelText={t('returns.detail.approveConfirm.cancel')}
        onConfirm={handleApprove}
        onCancel={() => setShowApproveConfirm(false)}
      />

      {/* Reject dialog with required reason */}
      <DxPopup
        visible={showRejectDialog}
        onHiding={() => {
          if (!rejecting) setShowRejectDialog(false);
        }}
        title={t('returns.detail.rejectDialog.title')}
        width={480}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-700">
            {t('returns.detail.rejectDialog.prompt')}
          </p>
          <DxTextArea
            value={rejectReason}
            onValueChanged={(e) => setRejectReason(String(e.value || ''))}
            placeholder={t('returns.detail.rejectDialog.placeholder')}
            height={100}
          />
          <div className="flex justify-end gap-2 pt-2 border-t">
            <DxButton
              text={t('returns.detail.rejectDialog.cancel')}
              stylingMode="outlined"
              onClick={() => setShowRejectDialog(false)}
              disabled={rejecting}
            />
            <DxButton
              text={rejecting ? t('returns.detail.rejectDialog.rejecting') : t('returns.detail.rejectDialog.confirm')}
              type="danger"
              onClick={handleReject}
              disabled={rejecting || !rejectReason.trim()}
            />
          </div>
        </div>
      </DxPopup>
    </MainLayout>
  );
}

