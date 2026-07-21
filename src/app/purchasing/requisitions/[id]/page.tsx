/**
 * Purchase Requisition Detail/Edit Page (T048)
 * Part of 011-accounting-spec-gap
 */

'use client';

import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { StatusStepper } from '@/components/shared';
import { PRForm } from '@/components/purchasing/PRForm';
import { PRApprovalTimeline } from '@/components/purchasing/PRApprovalTimeline';
import { PRPrintDocument } from '@/components/purchasing/PRPrintDocument';
import { formatNumber } from '@/lib/utils/number-format';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import { Button } from 'devextreme-react/button';
import { Popup } from 'devextreme-react/popup';
import { TextArea } from 'devextreme-react/text-area';
import { SelectBox } from 'devextreme-react/select-box';
import type { PRWithLines } from '@/types/purchase-requisition';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PurchaseRequisitionDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations('purchasing');
  const searchParams = useSearchParams();
  const action = searchParams.get('action');

  const [pr, setPR] = useState<PRWithLines | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Convert to PO modal state
  const [showConvertModal, setShowConvertModal] = useState(action === 'convert');
  const [converting, setConverting] = useState(false);
  const [vendorId, setVendorId] = useState<number | null>(null);
  const [vendors, setVendors] = useState<{ id: number; name: string; code?: string; isActive?: boolean }[]>([]);
  /**
   * Vendor ticked per PR line in the convert dialog, keyed by line id.
   * A PR can list items from several companies — each company must get its own
   * PO — so the buyer picks a vendor per line when the line has none.
   */
  const [lineVendors, setLineVendors] = useState<Record<number, number>>({});

  // Approval action state
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalComments, setApprovalComments] = useState('');
  const [processing, setProcessing] = useState(false);
  // Bumped after an approve/reject so the timeline refetches its history.
  const [timelineRefresh, setTimelineRefresh] = useState(0);

  // Delete PR state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Cancel PR state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const fetchPR = async () => {
      try {
        const response = await fetch(`/api/purchasing/requisitions/${id}`);
        const result = await response.json();
        if (result.success) {
          setPR(result.data);
        } else {
          setError(result.error || 'Failed to load PR');
        }
      } catch (err) {
        setError('Failed to load PR');
      } finally {
        setLoading(false);
      }
    };

    fetchPR();
  }, [id]);

  // PRs raised by the Metaherb storefront always get the Metaherb supplier on PO
  // conversion — the backend forces it regardless of UI, but we also lock the
  // dropdown so the user sees the supplier is pre-determined.
  const isMetaherbPR =
    typeof pr?.externalSource === 'string' &&
    pr.externalSource.trim().toLowerCase().startsWith('metaherb');

  // Fetch vendors for convert modal
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const response = await fetch('/api/vendors?limit=1000&isActive=true');
        const result = await response.json();
        if (result.success) {
          const list = result.data?.items || result.data || [];
          // Defensive: only active vendors should be selectable for a new PO.
          const active = list.filter((v: { isActive?: boolean }) => v.isActive !== false);
          setVendors(active);
          // For a Metaherb PR, pre-select the METAHERB vendor (matched by code) so
          // the locked dropdown shows it. If it doesn't exist yet the backend
          // creates it on convert — the button stays enabled for that case.
          if (isMetaherbPR) {
            const metaherb = active.find(
              (v: { code?: string }) => (v.code || '').toUpperCase() === 'METAHERB',
            );
            setVendorId(metaherb ? metaherb.id : null);
          }
        }
      } catch (err) {
        console.error('Error fetching vendors:', err);
      }
    };

    if (showConvertModal) {
      fetchVendors();
    }
  }, [showConvertModal, isMetaherbPR]);

  // Entry point for the "แปลงเป็นใบสั่งซื้อ" button. If the vendor is already
  // known — the PR carries one, or it's a Metaherb PR (forced server-side) —
  // convert straight away without asking again. Only pop the vendor picker when
  // there's genuinely no vendor to use.
  const handleConvertClick = () => {
    if (pr?.vendorId) {
      runConvert(pr.vendorId);
    } else if (isMetaherbPR) {
      runConvert(null);
    } else {
      setShowConvertModal(true);
    }
  };

  /** Lines that still need a company before the convert can run. */
  const linesMissingVendor = (pr?.lines ?? []).filter(
    (l) => !l.suggestedVendorId && !lineVendors[l.id],
  );

  /** How many POs the current picks would produce — one per distinct vendor. */
  const plannedPoCount = isMetaherbPR
    ? 1
    : new Set(
        (pr?.lines ?? [])
          .map((l) => lineVendors[l.id] ?? l.suggestedVendorId ?? vendorId)
          .filter(Boolean),
      ).size;

  const handleConvertToPO = async () => {
    // A vendor may come from the header pick, the line itself, or the per-line
    // tick — only block when a line would end up with none of them.
    if (!isMetaherbPR && !vendorId && linesMissingVendor.length > 0) {
      setError('กรุณาระบุบริษัทผู้ขายของแต่ละรายการ');
      return;
    }
    await runConvert(vendorId);
  };

  const runConvert = async (useVendorId: number | null) => {
    try {
      setConverting(true);
      setError(null);

      const response = await fetch(`/api/purchasing/requisitions/${id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(useVendorId ? { vendorId: useVendorId } : {}),
          // Only send ticks the buyer actually made.
          ...(Object.keys(lineVendors).length > 0 ? { lineVendors } : {}),
        }),
      });

      const result = await response.json();
      if (result.success) {
        // One PR can now produce SEVERAL POs (one per company). Jumping
        // straight into the first one would hide the rest, so go to the PO list
        // when the split produced more than one.
        const pos = result.data.purchaseOrders ?? [];
        if (pos.length > 1) {
          router.push('/purchasing/orders');
        } else {
          router.push(`/purchasing/orders/${result.data.poId}`);
        }
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถแปลงเป็นใบสั่งซื้อได้');
    } finally {
      setConverting(false);
    }
  };

  const handleApprovalAction = async () => {
    try {
      setProcessing(true);
      setError(null);

      const endpoint = approvalAction === 'approve'
        ? `/api/purchasing/requisitions/${id}/approve`
        : `/api/purchasing/requisitions/${id}/reject`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments: approvalComments,
          reason: approvalComments,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setShowApprovalModal(false);
        // Refresh PR data
        const prResponse = await fetch(`/api/purchasing/requisitions/${id}`);
        const prResult = await prResponse.json();
        if (prResult.success) {
          setPR(prResult.data);
        }
        // Refresh the action timeline to reflect the new approve/reject step.
        setTimelineRefresh((n) => n + 1);
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถดำเนินการอนุมัติ/ปฏิเสธได้');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelPR = async () => {
    try {
      setCancelling(true);
      setError(null);

      const response = await fetch(`/api/purchasing/requisitions/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason || 'Cancelled by user' }),
      });

      const result = await response.json();
      if (result.success) {
        setShowCancelModal(false);
        router.push('/purchasing/requisitions');
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to cancel PR');
    } finally {
      setCancelling(false);
    }
  };

  const handleDeletePR = async () => {
    try {
      setDeleting(true);
      setError(null);

      const response = await fetch(`/api/purchasing/requisitions/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        setShowDeleteModal(false);
        router.push('/purchasing/requisitions');
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete PR');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadIndicator />
      </div>
    );
  }

  if (error && !pr) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
        <button
          className="mt-4 text-blue-600 hover:underline"
          onClick={() => router.push('/purchasing/requisitions')}
        >
          {t('requisitions.detail.backToList')}
        </button>
      </div>
    );
  }

  return (
    <>
    {pr && <PRPrintDocument pr={pr} />}
    <div className="p-4 no-print">
        <div className="mb-4 flex justify-between items-start">
          <div className="flex items-start gap-3">
            <Button
              icon="back"
              type="normal"
              stylingMode="text"
              onClick={() => router.push('/purchasing/requisitions')}
              data-testid="back-btn"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">
                {pr?.prNumber || t('requisitions.detailTitle')}
              </h1>
              <p className="text-gray-600">
                {pr?.status === 'draft' ? t('requisitions.detail.draftSubtitle') : t('requisitions.detail.statusLabel', { status: pr?.status ?? '' })}
              </p>
            </div>
          </div>

          {/* Action buttons based on status */}
          <div className="flex gap-2">
            <Button
              text={t('requisitions.detail.printPr')}
              type="normal"
              stylingMode="outlined"
              icon="print"
              onClick={() => window.print()}
              data-testid="print-pr-btn"
            />
            {pr?.status === 'draft' && (
              <Button
                text={t('requisitions.detail.deletePr')}
                type="danger"
                stylingMode="outlined"
                icon="trash"
                onClick={() => setShowDeleteModal(true)}
                data-testid="delete-pr-btn"
              />
            )}
            {(pr?.status === 'draft' || pr?.status === 'submitted' || pr?.status === 'pending_approval') && (
              <Button
                text={t('requisitions.detail.cancelPr')}
                type="danger"
                stylingMode="outlined"
                icon="close"
                onClick={() => setShowCancelModal(true)}
                data-testid="cancel-pr-btn"
              />
            )}
            {pr?.status === 'pending_approval' && (
              <>
                <Button
                  text={t('requisitions.detail.approve')}
                  type="success"
                  stylingMode="contained"
                  onClick={() => {
                    setApprovalAction('approve');
                    setShowApprovalModal(true);
                  }}
                  data-testid="approve-btn"
                />
                <Button
                  text={t('requisitions.detail.reject')}
                  type="danger"
                  stylingMode="contained"
                  onClick={() => {
                    setApprovalAction('reject');
                    setShowApprovalModal(true);
                  }}
                  data-testid="reject-btn"
                />
              </>
            )}
            {pr?.status === 'approved' && (
              <Button
                text={t('requisitions.detail.convertToPo')}
                type="default"
                stylingMode="contained"
                icon="export"
                onClick={handleConvertClick}
                data-testid="convert-to-po-btn"
              />
            )}
          </div>
        </div>

        {/* Workflow status — สถานะการดำเนินงาน */}
        {pr && (
          <div className="mb-4">
            <StatusStepper
              title={t('requisitions.detail.workflowTitle')}
              current={pr.status}
              steps={[
                { key: 'draft', label: t('requisitions.detail.steps.draft') },
                { key: 'submitted', label: t('requisitions.detail.steps.submitted') },
                { key: 'pending_approval', label: t('requisitions.detail.steps.pendingApproval') },
                { key: 'approved', label: t('requisitions.detail.steps.approved') },
              ]}
            />
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {pr && <PRForm mode="edit" prId={parseInt(id, 10)} initialData={pr} />}

        {/* ผู้ดำเนินการ / ประวัติการอนุมัติ — ใครสร้าง/ส่ง/อนุมัติ/ปฏิเสธ พร้อมวันเวลา */}
        {pr && (
          <div className="mt-6">
            <PRApprovalTimeline prId={parseInt(id, 10)} refreshKey={timelineRefresh} />
          </div>
        )}

        {/* Convert to PO Modal */}
        <Popup
          visible={showConvertModal}
          onHiding={() => setShowConvertModal(false)}
          title={t('requisitions.detail.convertModal.title')}
          width={400}
          height="auto"
          showCloseButton={true}
        >
          <div className="p-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('requisitions.detail.convertModal.selectVendor')}
              </label>
              <SelectBox
                dataSource={vendors}
                value={vendorId}
                onValueChanged={(e) => setVendorId(e.value)}
                displayExpr={(v: { code?: string; name?: string } | null) =>
                  v ? (v.code ? `${v.code} - ${v.name}` : v.name ?? '') : ''
                }
                valueExpr="id"
                placeholder={
                  isMetaherbPR
                    ? 'METAHERB'
                    : t('requisitions.detail.convertModal.selectVendorPlaceholder')
                }
                searchEnabled={!isMetaherbPR}
                disabled={isMetaherbPR}
                data-testid="vendor-select"
              />
              {isMetaherbPR && (
                <p className="mt-1 text-xs text-emerald-700" data-testid="metaherb-vendor-note">
                  ผู้ขายถูกกำหนดเป็น METAHERB อัตโนมัติ (ใบขอซื้อจาก Metaherb)
                </p>
              )}
              {!isMetaherbPR && (
                <p className="mt-1 text-xs text-gray-500">
                  ใช้กับรายการที่ยังไม่ได้ระบุบริษัทด้านล่าง
                </p>
              )}
            </div>

            {/* Per-line vendor. A PR can list items from several companies and
                each company gets its own PO, so the vendor is chosen per line. */}
            {!isMetaherbPR && (pr?.lines?.length ?? 0) > 0 && (
              <div className="mb-4" data-testid="line-vendor-section">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  บริษัทผู้ขายของแต่ละรายการ
                </label>

                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                  {(pr?.lines ?? []).map((line) => {
                    const picked = lineVendors[line.id] ?? line.suggestedVendorId ?? vendorId ?? null;
                    const fromPR = !!line.suggestedVendorId && !lineVendors[line.id];
                    return (
                      <div
                        key={line.id}
                        className="rounded-lg border border-gray-200 p-2"
                        data-testid={`line-vendor-row-${line.id}`}
                      >
                        <div className="mb-1 flex items-baseline justify-between gap-2">
                          <span className="truncate text-xs font-medium" title={line.description}>
                            {line.itemCode ? `${line.itemCode} · ` : ''}{line.description}
                          </span>
                          <span className="shrink-0 text-xs text-gray-500 tabular-nums">
                            {formatNumber(line.quantity)} {line.unitOfMeasure}
                          </span>
                        </div>
                        <SelectBox
                          dataSource={vendors}
                          value={picked}
                          onValueChanged={(e) =>
                            setLineVendors((prev) => ({ ...prev, [line.id]: e.value }))
                          }
                          displayExpr={(v: { code?: string; name?: string } | null) =>
                            v ? (v.code ? `${v.code} - ${v.name}` : v.name ?? '') : ''
                          }
                          valueExpr="id"
                          placeholder="เลือกบริษัทผู้ขาย"
                          searchEnabled
                          data-testid={`line-vendor-select-${line.id}`}
                        />
                        {fromPR && (
                          <p className="mt-1 text-[11px] text-gray-500">
                            มาจากที่ระบุไว้ในใบขอซื้อ
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Tell the buyer how many POs this will make BEFORE they press
                    convert — the split is otherwise invisible until it happens. */}
                {plannedPoCount > 1 && (
                  <p
                    className="mt-2 rounded bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700"
                    data-testid="planned-po-count"
                  >
                    จะสร้างใบสั่งซื้อ {formatNumber(plannedPoCount)} ใบ (แยกตามบริษัท)
                  </p>
                )}
                {linesMissingVendor.length > 0 && !vendorId && (
                  <p className="mt-2 text-xs text-rose-600" data-testid="missing-vendor-warning">
                    ยังไม่ได้ระบุบริษัท {formatNumber(linesMissingVendor.length)} รายการ
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end mt-6">
              <Button
                text={t('requisitions.detail.convertModal.cancel')}
                type="normal"
                onClick={() => setShowConvertModal(false)}
              />
              <Button
                text={converting ? t('requisitions.detail.convertModal.converting') : t('requisitions.detail.convertModal.convert')}
                type="success"
                onClick={handleConvertToPO}
                // Enable the convert once EVERY line has a company to buy from —
                // whether that comes from the header pick, a per-line pick, or the
                // vendor already suggested on the PR. Gating solely on the header
                // vendorId blocked buyers who had (correctly) chosen a vendor per
                // line but left the header picker empty (list item 7 / bug report).
                disabled={
                  converting ||
                  (!isMetaherbPR && linesMissingVendor.length > 0)
                }
                data-testid="confirm-convert-btn"
              />
            </div>
          </div>
        </Popup>

        {/* Approval Action Modal */}
        <Popup
          visible={showApprovalModal}
          onHiding={() => setShowApprovalModal(false)}
          title={approvalAction === 'approve' ? t('requisitions.detail.approvalModal.approveTitle') : t('requisitions.detail.approvalModal.rejectTitle')}
          width={400}
          height="auto"
          showCloseButton={true}
        >
          <div className="p-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {approvalAction === 'approve' ? t('requisitions.detail.approvalModal.commentLabel') : t('requisitions.detail.approvalModal.reasonLabel')}
              </label>
              <TextArea
                value={approvalComments}
                onValueChanged={(e) => setApprovalComments(e.value)}
                height={100}
                placeholder={approvalAction === 'approve' ? t('requisitions.detail.approvalModal.commentPlaceholder') : t('requisitions.detail.approvalModal.reasonPlaceholder')}
                data-testid="approval-comments"
              />
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <Button
                text={t('requisitions.detail.approvalModal.cancel')}
                type="normal"
                onClick={() => setShowApprovalModal(false)}
              />
              <Button
                text={processing ? t('requisitions.detail.approvalModal.processing') : (approvalAction === 'approve' ? t('requisitions.detail.approvalModal.approve') : t('requisitions.detail.approvalModal.reject'))}
                type={approvalAction === 'approve' ? 'success' : 'danger'}
                onClick={handleApprovalAction}
                disabled={processing || (approvalAction === 'reject' && !approvalComments)}
                data-testid="confirm-approval-btn"
              />
            </div>
          </div>
        </Popup>

        {/* Cancel PR Modal */}
        <Popup
          visible={showCancelModal}
          onHiding={() => setShowCancelModal(false)}
          title={t('requisitions.detail.cancelModal.title')}
          width={400}
          height="auto"
          showCloseButton={true}
        >
          <div className="p-4">
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                {t('requisitions.detail.cancelModal.confirm', { prNumber: pr?.prNumber ?? '' })}
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('requisitions.detail.cancelModal.reasonLabel')}
              </label>
              <TextArea
                value={cancelReason}
                onValueChanged={(e) => setCancelReason(e.value)}
                height={100}
                placeholder={t('requisitions.detail.cancelModal.reasonPlaceholder')}
                data-testid="cancel-reason"
              />
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <Button
                text={t('requisitions.detail.cancelModal.close')}
                type="normal"
                onClick={() => setShowCancelModal(false)}
              />
              <Button
                text={cancelling ? t('requisitions.detail.cancelModal.cancelling') : t('requisitions.detail.cancelModal.confirmCancel')}
                type="danger"
                stylingMode="contained"
                onClick={handleCancelPR}
                disabled={cancelling}
                data-testid="confirm-cancel-pr-btn"
              />
            </div>
          </div>
        </Popup>

        {/* Delete PR Modal */}
        <Popup
          visible={showDeleteModal}
          onHiding={() => setShowDeleteModal(false)}
          title={t('requisitions.detail.deleteModal.title')}
          width={400}
          height="auto"
          showCloseButton={true}
        >
          <div className="p-4">
            <p className="text-sm text-gray-600 mb-4">
              {t('requisitions.detail.deleteModal.confirmPrefix')} <strong>{pr?.prNumber}</strong>{t('requisitions.detail.deleteModal.confirmSuffix')}
            </p>

            <div className="flex gap-2 justify-end mt-6">
              <Button
                text={t('requisitions.detail.deleteModal.close')}
                type="normal"
                onClick={() => setShowDeleteModal(false)}
              />
              <Button
                text={deleting ? t('requisitions.detail.deleteModal.deleting') : t('requisitions.detail.deleteModal.confirmDelete')}
                type="danger"
                stylingMode="contained"
                icon="trash"
                onClick={handleDeletePR}
                disabled={deleting}
                data-testid="confirm-delete-pr-btn"
              />
            </div>
          </div>
        </Popup>
    </div>
    </>
  );
}
