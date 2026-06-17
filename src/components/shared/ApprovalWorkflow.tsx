/**
 * ApprovalWorkflow Component (T025)
 * Shared component for displaying approval workflow status and actions
 */

'use client';

import { useState } from 'react';
import { Button } from 'devextreme-react/button';
import { TextArea } from 'devextreme-react/text-area';
import { Popup } from 'devextreme-react/popup';
import { SelectBox } from 'devextreme-react/select-box';
import type {
  ApprovalRequestWithDetails,
  ApprovalRequestStepStatus,
  DocumentType,
} from '@/types/approval-workflow';

interface ApprovalWorkflowProps {
  documentType: DocumentType;
  documentId: number;
  currentUserId: number;
  approvalRequest: ApprovalRequestWithDetails | null;
  onApprove?: () => void;
  onReject?: () => void;
  onDelegate?: () => void;
  onSubmit?: () => void;
  isLoading?: boolean;
}

const statusColors: Record<ApprovalRequestStepStatus | 'pending' | 'approved' | 'rejected' | 'cancelled', string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  delegated: 'bg-blue-100 text-blue-800',
  timed_out: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

export function ApprovalWorkflow({
  documentType,
  documentId,
  currentUserId,
  approvalRequest,
  onApprove,
  onReject,
  onDelegate,
  onSubmit,
  isLoading = false,
}: ApprovalWorkflowProps) {
  const [showApprovePopup, setShowApprovePopup] = useState(false);
  const [showRejectPopup, setShowRejectPopup] = useState(false);
  const [showDelegatePopup, setShowDelegatePopup] = useState(false);
  const [comments, setComments] = useState('');
  const [delegateTo, setDelegateTo] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Check if current user can take action
  const currentStep = approvalRequest?.steps.find(
    (s) =>
      s.stepOrder === approvalRequest.currentStepOrder &&
      s.assignedTo === currentUserId &&
      s.status === 'pending'
  );
  const canApprove = !!currentStep && approvalRequest?.status === 'pending';
  const canReject = !!currentStep && approvalRequest?.status === 'pending';
  const canDelegate = false; // TODO: Check step.canDelegate from flow definition

  const handleApprove = async () => {
    if (!approvalRequest) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/approval/requests/${approvalRequest.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments, approverId: currentUserId }),
      });
      if (response.ok) {
        setShowApprovePopup(false);
        setComments('');
        onApprove?.();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!approvalRequest || !comments.trim()) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/approval/requests/${approvalRequest.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments, approverId: currentUserId }),
      });
      if (response.ok) {
        setShowRejectPopup(false);
        setComments('');
        onReject?.();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelegate = async () => {
    if (!approvalRequest || !delegateTo) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/approval/requests/${approvalRequest.id}/delegate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delegateTo, comments, approverId: currentUserId }),
      });
      if (response.ok) {
        setShowDelegatePopup(false);
        setComments('');
        setDelegateTo(null);
        onDelegate?.();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitForApproval = async () => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/approval/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType,
          documentId,
          requestedBy: currentUserId,
        }),
      });
      if (response.ok) {
        onSubmit?.();
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  // No approval request yet - show submit button
  if (!approvalRequest) {
    return (
      <div className="border rounded-lg p-4 bg-gray-50" data-testid="approval-workflow-panel">
        <h3 className="text-sm font-medium text-gray-700 mb-3">ขั้นตอนการอนุมัติ</h3>
        <div className="text-sm text-gray-500 mb-3">
          เอกสารนี้ยังไม่ได้ส่งเพื่อขออนุมัติ
        </div>
        <Button
          text="ส่งเพื่อขออนุมัติ"
          type="default"
          stylingMode="contained"
          onClick={handleSubmitForApproval}
          disabled={actionLoading}
          data-testid="submit-for-approval-btn"
        />
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 bg-gray-50" data-testid="approval-workflow-panel">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">ขั้นตอนการอนุมัติ</h3>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[approvalRequest.status]}`}
          data-testid="approval-status"
        >
          {approvalRequest.status.toUpperCase()}
        </span>
      </div>

      <div className="text-sm text-gray-600 mb-3">
        ลำดับขั้น: <span className="font-medium">{approvalRequest.flow.name}</span>
      </div>

      {/* Steps timeline */}
      <div className="space-y-2 mb-4" data-testid="approval-steps">
        {approvalRequest.steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex items-center gap-2 p-2 rounded ${
              step.stepOrder === approvalRequest.currentStepOrder && approvalRequest.status === 'pending'
                ? 'bg-yellow-50 border border-yellow-200'
                : step.status === 'approved'
                ? 'bg-green-50'
                : step.status === 'rejected'
                ? 'bg-red-50'
                : 'bg-white'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                step.status === 'approved'
                  ? 'bg-green-500 text-white'
                  : step.status === 'rejected'
                  ? 'bg-red-500 text-white'
                  : step.stepOrder === approvalRequest.currentStepOrder
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-300 text-gray-600'
              }`}
            >
              {index + 1}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{step.assignedToName || `ผู้ใช้ #${step.assignedTo}`}</div>
              {step.delegatedFromName && (
                <div className="text-xs text-gray-500">
                  มอบหมายจาก: {step.delegatedFromName}
                </div>
              )}
              {step.actionDate && (
                <div className="text-xs text-gray-500">
                  {step.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว'}: {new Date(step.actionDate).toLocaleString()}
                </div>
              )}
              {step.comments && (
                <div className="text-xs text-gray-600 italic">&quot;{step.comments}&quot;</div>
              )}
            </div>
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${statusColors[step.status]}`}
            >
              {step.status}
            </span>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      {approvalRequest.status === 'pending' && (canApprove || canReject || canDelegate) && (
        <div className="flex gap-2 mt-4" data-testid="approval-actions">
          {canApprove && (
            <Button
              text="อนุมัติ"
              type="success"
              stylingMode="contained"
              onClick={() => setShowApprovePopup(true)}
              disabled={actionLoading}
              data-testid="approve-btn"
            />
          )}
          {canReject && (
            <Button
              text="ปฏิเสธ"
              type="danger"
              stylingMode="contained"
              onClick={() => setShowRejectPopup(true)}
              disabled={actionLoading}
              data-testid="reject-btn"
            />
          )}
          {canDelegate && (
            <Button
              text="มอบหมาย"
              type="default"
              stylingMode="outlined"
              onClick={() => setShowDelegatePopup(true)}
              disabled={actionLoading}
              data-testid="delegate-btn"
            />
          )}
        </div>
      )}

      {/* Approve Popup */}
      <Popup
        visible={showApprovePopup}
        onHiding={() => setShowApprovePopup(false)}
        title="อนุมัติคำขอ"
        width={400}
        height="auto"
        showCloseButton={true}
      >
        <div className="p-4">
          <TextArea
            placeholder="ความคิดเห็น (ไม่บังคับ)"
            value={comments}
            onValueChanged={(e) => setComments(e.value)}
            height={100}
            data-testid="approve-comments"
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button
              text="ยกเลิก"
              type="normal"
              stylingMode="outlined"
              onClick={() => setShowApprovePopup(false)}
            />
            <Button
              text="ยืนยันการอนุมัติ"
              type="success"
              stylingMode="contained"
              onClick={handleApprove}
              disabled={actionLoading}
              data-testid="confirm-approve-btn"
            />
          </div>
        </div>
      </Popup>

      {/* Reject Popup */}
      <Popup
        visible={showRejectPopup}
        onHiding={() => setShowRejectPopup(false)}
        title="ปฏิเสธคำขอ"
        width={400}
        height="auto"
        showCloseButton={true}
      >
        <div className="p-4">
          <TextArea
            placeholder="เหตุผลในการปฏิเสธ (จำเป็น)"
            value={comments}
            onValueChanged={(e) => setComments(e.value)}
            height={100}
            data-testid="reject-comments"
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button
              text="ยกเลิก"
              type="normal"
              stylingMode="outlined"
              onClick={() => setShowRejectPopup(false)}
            />
            <Button
              text="ยืนยันการปฏิเสธ"
              type="danger"
              stylingMode="contained"
              onClick={handleReject}
              disabled={actionLoading || !comments.trim()}
              data-testid="confirm-reject-btn"
            />
          </div>
        </div>
      </Popup>

      {/* Delegate Popup */}
      <Popup
        visible={showDelegatePopup}
        onHiding={() => setShowDelegatePopup(false)}
        title="มอบหมายการอนุมัติ"
        width={400}
        height="auto"
        showCloseButton={true}
      >
        <div className="p-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              มอบหมายให้:
            </label>
            <SelectBox
              dataSource={[]} // TODO: Load employees
              valueExpr="id"
              displayExpr="name"
              value={delegateTo}
              onValueChanged={(e) => setDelegateTo(e.value)}
              placeholder="เลือกพนักงาน"
              searchEnabled={true}
              data-testid="delegate-select"
            />
          </div>
          <TextArea
            placeholder="เหตุผลในการมอบหมาย (ไม่บังคับ)"
            value={comments}
            onValueChanged={(e) => setComments(e.value)}
            height={80}
            data-testid="delegate-comments"
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button
              text="ยกเลิก"
              type="normal"
              stylingMode="outlined"
              onClick={() => setShowDelegatePopup(false)}
            />
            <Button
              text="ยืนยันการมอบหมาย"
              type="default"
              stylingMode="contained"
              onClick={handleDelegate}
              disabled={actionLoading || !delegateTo}
              data-testid="confirm-delegate-btn"
            />
          </div>
        </div>
      </Popup>
    </div>
  );
}

export default ApprovalWorkflow;
