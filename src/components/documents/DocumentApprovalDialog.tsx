'use client';

/**
 * Document Approval Dialog Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * Modal dialog for approving or rejecting document versions.
 */

import { useState } from 'react';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import type { PendingApproval } from '@/types/documents';

// ============================================
// Types
// ============================================

interface DocumentApprovalDialogProps {
  approval: PendingApproval | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ApprovalDecision {
  decision: 'approved' | 'rejected';
  comments?: string;
}

// ============================================
// API Functions
// ============================================

async function submitApprovalDecision(
  approvalId: number,
  data: ApprovalDecision
): Promise<{ versionStatus: string }> {
  const response = await fetch(`/api/documents/approvals/${approvalId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to submit decision');
  }
  return result.data;
}

// ============================================
// Component
// ============================================

export function DocumentApprovalDialog({
  approval,
  open,
  onClose,
  onSuccess,
}: DocumentApprovalDialogProps) {
  const queryClient = useQueryClient();
  const [comments, setComments] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Approval mutation
  const approveMutation = useMutation({
    mutationFn: (data: ApprovalDecision) =>
      submitApprovalDecision(approval!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      onSuccess?.();
      handleClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // Handle close
  const handleClose = () => {
    setComments('');
    setShowRejectForm(false);
    setError(null);
    onClose();
  };

  // Handle approve
  const handleApprove = () => {
    approveMutation.mutate({
      decision: 'approved',
      comments: comments || undefined,
    });
  };

  // Handle reject
  const handleReject = () => {
    if (!showRejectForm) {
      setShowRejectForm(true);
      return;
    }

    if (!comments.trim()) {
      setError('Comments are required when rejecting a document');
      return;
    }

    approveMutation.mutate({
      decision: 'rejected',
      comments: comments.trim(),
    });
  };

  const isSubmitting = approveMutation.isPending;

  if (!approval) return null;

  return (
    <DxPopup
      visible={open}
      onHiding={handleClose}
      title="Document Approval"
      width={500}
      height="auto"
      showCloseButton
    >
      <div className="p-4 space-y-4">
        {/* Document Info */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold">{approval.documentTitle}</p>
              <p className="text-sm text-muted-foreground font-mono">
                {approval.documentNumber}
              </p>
            </div>
            <span className="text-sm px-2 py-1 bg-primary/10 text-primary rounded-md">
              Version {approval.versionNumber}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Your Role: {formatRole(approval.approvalRole)}</span>
            <span>Submitted by: {approval.submittedBy}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Submitted: {new Date(approval.submittedAt).toLocaleString('th-TH')}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Reject Form */}
        {showRejectForm ? (
          <div className="space-y-3">
            <label className="text-sm font-medium">
              Rejection Comments <span className="text-destructive">*</span>
            </label>
            <DxTextArea
              value={comments}
              onValueChange={(value) => setComments(value || '')}
              placeholder="Please provide specific reasons for rejection..."
              height={100}
            />
            <p className="text-xs text-muted-foreground">
              Comments are required when rejecting a document. Please be specific
              about what needs to be changed.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="text-sm font-medium">Comments (Optional)</label>
            <DxTextArea
              value={comments}
              onValueChange={(value) => setComments(value || '')}
              placeholder="Add any comments about your approval..."
              height={80}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <DxButton
            text="Cancel"
            onClick={handleClose}
            stylingMode="outlined"
            disabled={isSubmitting}
          />
          {!showRejectForm && (
            <DxButton
              text="Reject"
              icon="close"
              onClick={handleReject}
              type="danger"
              disabled={isSubmitting}
            />
          )}
          {showRejectForm ? (
            <DxButton
              text="Confirm Rejection"
              icon="close"
              onClick={handleReject}
              type="danger"
              disabled={isSubmitting || !comments.trim()}
            />
          ) : (
            <DxButton
              text="Approve"
              icon="check"
              onClick={handleApprove}
              type="success"
              disabled={isSubmitting}
            />
          )}
        </div>
      </div>
    </DxPopup>
  );
}

// Helper function to format role for display
function formatRole(role: string): string {
  const roleNames: Record<string, string> = {
    author: 'Author',
    reviewer: 'Reviewer',
    approver: 'Approver',
    qa_reviewer: 'QA Reviewer',
    qa_manager: 'QA Manager',
    qa_approver: 'QA Approver',
    supervisor: 'Supervisor',
    management: 'Management',
  };
  return roleNames[role] || role;
}
