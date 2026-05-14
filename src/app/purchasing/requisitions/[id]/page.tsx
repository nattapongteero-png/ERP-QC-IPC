/**
 * Purchase Requisition Detail/Edit Page (T048)
 * Part of 011-accounting-spec-gap
 */

'use client';

import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PRForm } from '@/components/purchasing/PRForm';
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
  const [vendors, setVendors] = useState<{ id: number; name: string }[]>([]);

  // Approval action state
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalComments, setApprovalComments] = useState('');
  const [processing, setProcessing] = useState(false);

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

  // Fetch vendors for convert modal
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const response = await fetch('/api/vendors?limit=1000');
        const result = await response.json();
        if (result.success) {
          setVendors(result.data?.items || result.data || []);
        }
      } catch (err) {
        console.error('Error fetching vendors:', err);
      }
    };

    if (showConvertModal) {
      fetchVendors();
    }
  }, [showConvertModal]);

  const handleConvertToPO = async () => {
    if (!vendorId) {
      setError('Please select a vendor');
      return;
    }

    try {
      setConverting(true);
      setError(null);

      const response = await fetch(`/api/purchasing/requisitions/${id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId }),
      });

      const result = await response.json();
      if (result.success) {
        router.push(`/purchasing/orders/${result.data.poId}`);
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to convert to PO');
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
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process approval');
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
          ← Back to Requisitions
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
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
                {pr?.status === 'draft' ? 'Edit and submit for approval' : `Status: ${pr?.status}`}
              </p>
            </div>
          </div>

          {/* Action buttons based on status */}
          <div className="flex gap-2">
            {pr?.status === 'draft' && (
              <Button
                text="ลบใบ PR"
                type="danger"
                stylingMode="outlined"
                icon="trash"
                onClick={() => setShowDeleteModal(true)}
                data-testid="delete-pr-btn"
              />
            )}
            {(pr?.status === 'draft' || pr?.status === 'submitted' || pr?.status === 'pending_approval') && (
              <Button
                text="ยกเลิกใบ PR"
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
                  text="Approve"
                  type="success"
                  stylingMode="contained"
                  onClick={() => {
                    setApprovalAction('approve');
                    setShowApprovalModal(true);
                  }}
                  data-testid="approve-btn"
                />
                <Button
                  text="Reject"
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
                text="Convert to PO"
                type="default"
                stylingMode="contained"
                icon="export"
                onClick={() => setShowConvertModal(true)}
                data-testid="convert-to-po-btn"
              />
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {pr && <PRForm mode="edit" prId={parseInt(id, 10)} initialData={pr} />}

        {/* Convert to PO Modal */}
        <Popup
          visible={showConvertModal}
          onHiding={() => setShowConvertModal(false)}
          title="Convert to Purchase Order"
          width={400}
          height={250}
          showCloseButton={true}
        >
          <div className="p-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Vendor
              </label>
              <SelectBox
                dataSource={vendors}
                value={vendorId}
                onValueChanged={(e) => setVendorId(e.value)}
                displayExpr="name"
                valueExpr="id"
                placeholder="Choose a vendor..."
                searchEnabled={true}
                data-testid="vendor-select"
              />
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <Button
                text="Cancel"
                type="normal"
                onClick={() => setShowConvertModal(false)}
              />
              <Button
                text={converting ? 'Converting...' : 'Convert'}
                type="success"
                onClick={handleConvertToPO}
                disabled={converting || !vendorId}
                data-testid="confirm-convert-btn"
              />
            </div>
          </div>
        </Popup>

        {/* Approval Action Modal */}
        <Popup
          visible={showApprovalModal}
          onHiding={() => setShowApprovalModal(false)}
          title={approvalAction === 'approve' ? 'Approve PR' : 'Reject PR'}
          width={400}
          height={300}
          showCloseButton={true}
        >
          <div className="p-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {approvalAction === 'approve' ? 'Comments (optional)' : 'Reason for rejection'}
              </label>
              <TextArea
                value={approvalComments}
                onValueChanged={(e) => setApprovalComments(e.value)}
                height={100}
                placeholder={approvalAction === 'approve' ? 'Add comments...' : 'Enter rejection reason...'}
                data-testid="approval-comments"
              />
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <Button
                text="Cancel"
                type="normal"
                onClick={() => setShowApprovalModal(false)}
              />
              <Button
                text={processing ? 'Processing...' : (approvalAction === 'approve' ? 'Approve' : 'Reject')}
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
          title="ยกเลิกใบขอซื้อ (Cancel PR)"
          width={400}
          height={300}
          showCloseButton={true}
        >
          <div className="p-4">
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                คุณต้องการยกเลิกใบขอซื้อ {pr?.prNumber} ใช่หรือไม่?
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เหตุผลในการยกเลิก (Reason)
              </label>
              <TextArea
                value={cancelReason}
                onValueChanged={(e) => setCancelReason(e.value)}
                height={100}
                placeholder="ระบุเหตุผลในการยกเลิก..."
                data-testid="cancel-reason"
              />
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <Button
                text="ปิด"
                type="normal"
                onClick={() => setShowCancelModal(false)}
              />
              <Button
                text={cancelling ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
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
          title="ลบใบขอซื้อ (Delete PR)"
          width={400}
          height={220}
          showCloseButton={true}
        >
          <div className="p-4">
            <p className="text-sm text-gray-600 mb-4">
              คุณต้องการลบใบขอซื้อ <strong>{pr?.prNumber}</strong> ใช่หรือไม่? การลบจะไม่สามารถย้อนกลับได้
            </p>

            <div className="flex gap-2 justify-end mt-6">
              <Button
                text="ปิด"
                type="normal"
                onClick={() => setShowDeleteModal(false)}
              />
              <Button
                text={deleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
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
  );
}
