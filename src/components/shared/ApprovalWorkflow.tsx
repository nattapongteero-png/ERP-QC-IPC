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
        <h3 className="text-sm font-medium text-gray-700 mb-3">Approval Workflow</h3>
        <div className="text-sm text-gray-500 mb-3">
          This document has not been submitted for approval yet.
        </div>
        <Button
          text="Submit for Approval"
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
        <h3 className="text-sm font-medium text-gray-700">Approval Workflow</h3>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[approvalRequest.status]}`}
          data-testid="approval-status"
        >
          {approvalRequest.status.toUpperCase()}
        </span>
      </div>

      <div className="text-sm text-gray-600 mb-3">
        Flow: <span className="font-medium">{approvalRequest.flow.name}</span>
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
              <div className="text-sm font-medium">{step.assignedToName || `User #${step.assignedTo}`}</div>
              {step.delegatedFromName && (
                <div className="text-xs text-gray-500">
                  Delegated from: {step.delegatedFromName}
                </div>
              )}
              {step.actionDate && (
                <div className="text-xs text-gray-500">
                  {step.status === 'approved' ? 'Approved' : 'Rejected'}: {new Date(step.actionDate).toLocaleString()}
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
              text="Approve"
              type="success"
              stylingMode="contained"
              onClick={() => setShowApprovePopup(true)}
              disabled={actionLoading}
              data-testid="approve-btn"
            />
          )}
          {canReject && (
            <Button
              text="Reject"
              type="danger"
              stylingMode="contained"
              onClick={() => setShowRejectPopup(true)}
              disabled={actionLoading}
              data-testid="reject-btn"
            />
          )}
          {canDelegate && (
            <Button
              text="Delegate"
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
        title="Approve Request"
        width={400}
        height="auto"
        showCloseButton={true}
      >
        <div className="p-4">
          <TextArea
            placeholder="Comments (optional)"
            value={comments}
            onValueChanged={(e) => setComments(e.value)}
            height={100}
            data-testid="approve-comments"
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button
              text="Cancel"
              type="normal"
              stylingMode="outlined"
              onClick={() => setShowApprovePopup(false)}
            />
            <Button
              text="Confirm Approve"
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
        title="Reject Request"
        width={400}
        height="auto"
        showCloseButton={true}
      >
        <div className="p-4">
          <TextArea
            placeholder="Rejection reason (required)"
            value={comments}
            onValueChanged={(e) => setComments(e.value)}
            height={100}
            data-testid="reject-comments"
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button
              text="Cancel"
              type="normal"
              stylingMode="outlined"
              onClick={() => setShowRejectPopup(false)}
            />
            <Button
              text="Confirm Reject"
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
        title="Delegate Approval"
        width={400}
        height="auto"
        showCloseButton={true}
      >
        <div className="p-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delegate to:
            </label>
            <SelectBox
              dataSource={[]} // TODO: Load employees
              valueExpr="id"
              displayExpr="name"
              value={delegateTo}
              onValueChanged={(e) => setDelegateTo(e.value)}
              placeholder="Select employee"
              searchEnabled={true}
              data-testid="delegate-select"
            />
          </div>
          <TextArea
            placeholder="Reason for delegation (optional)"
            value={comments}
            onValueChanged={(e) => setComments(e.value)}
            height={80}
            data-testid="delegate-comments"
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button
              text="Cancel"
              type="normal"
              stylingMode="outlined"
              onClick={() => setShowDelegatePopup(false)}
            />
            <Button
              text="Confirm Delegate"
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
