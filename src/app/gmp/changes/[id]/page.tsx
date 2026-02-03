'use client';

/**
 * Change Request Detail Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 *
 * Detail view for a change request with:
 * - Display all change request fields
 * - Show approval status for each role (QA, Production, Regulatory, Management)
 * - Action buttons based on status:
 *   - Draft: "Submit for Review" button
 *   - Pending Review: "Approve" / "Reject" buttons for approvers
 *   - Approved: "Mark as Implemented" button
 *   - Implemented: "Close Change" button
 */

import { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import { ResponsivePageHeader } from '@/components/shared';
import {
  FileEdit,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  AlertTriangle,
  FileCheck,
  PlayCircle,
  Archive,
} from 'lucide-react';
import type {
  ChangeRequestDetails,
  ChangeApproval,
  ApprovalRole,
  ChangePriority,
  ChangeStatus,
} from '@/types/change-control';

// ============================================
// API Functions
// ============================================

async function fetchChangeDetails(id: number): Promise<ChangeRequestDetails> {
  const response = await fetch(`/api/changes/${id}`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch change request');
  }
  return result.data;
}

async function submitForReview(id: number): Promise<void> {
  const response = await fetch(`/api/changes/${id}/submit`, {
    method: 'POST',
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to submit for review');
  }
}

async function approveChange(
  id: number,
  role: ApprovalRole,
  approved: boolean,
  comments?: string
): Promise<void> {
  const response = await fetch(`/api/changes/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, approved, comments }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to approve change');
  }
}

async function implementChange(id: number, notes?: string): Promise<void> {
  const response = await fetch(`/api/changes/${id}/implement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ implementationNotes: notes }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to implement change');
  }
}

async function closeChange(id: number, notes?: string): Promise<void> {
  const response = await fetch(`/api/changes/${id}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ closureNotes: notes }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to close change');
  }
}

// ============================================
// Helper Functions
// ============================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getPriorityBadge(priority: ChangePriority) {
  const colors: Record<ChangePriority, string> = {
    low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    urgent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${colors[priority]}`}>
      {priority}
    </span>
  );
}

function getRoleLabel(role: ApprovalRole): string {
  const labels: Record<ApprovalRole, string> = {
    qa: 'Quality Assurance',
    production: 'Production',
    regulatory: 'Regulatory Affairs',
    management: 'Management',
  };
  return labels[role];
}

// ============================================
// Sub-Components
// ============================================

interface ApprovalCardProps {
  approval: ChangeApproval;
  onApprove?: () => void;
  onReject?: () => void;
  canApprove: boolean;
}

function ApprovalCard({ approval, onApprove, onReject, canApprove }: ApprovalCardProps) {
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">{getRoleLabel(approval.role)}</h4>
          {approval.approverName && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {approval.approverName}
            </p>
          )}
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[approval.status]}`}>
          {approval.status.toUpperCase()}
        </span>
      </div>

      {approval.comments && (
        <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded text-sm text-gray-700 dark:text-gray-300">
          {approval.comments}
        </div>
      )}

      {approval.signedAt && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Signed: {formatDate(approval.signedAt)}
        </p>
      )}

      {canApprove && approval.status === 'pending' && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <DxButton
            text="Approve"
            icon="check"
            type="success"
            onClick={onApprove}
            stylingMode="contained"
          />
          <DxButton
            text="Reject"
            icon="close"
            type="danger"
            onClick={onReject}
            stylingMode="outlined"
          />
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function ChangeDetailPage() {
  const router = useRouter();
  const t = useTranslations('gmp');
  const params = useParams();
  const queryClient = useQueryClient();
  const changeId = Number(params.id);

  // State
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalRole, setApprovalRole] = useState<ApprovalRole | null>(null);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalComments, setApprovalComments] = useState('');
  const [showImplementDialog, setShowImplementDialog] = useState(false);
  const [implementNotes, setImplementNotes] = useState('');
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');

  // Fetch change details
  const {
    data: change,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['change', changeId],
    queryFn: () => fetchChangeDetails(changeId),
    enabled: !!changeId && !isNaN(changeId),
  });

  // Submit for review mutation
  const submitMutation = useMutation({
    mutationFn: () => submitForReview(changeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change', changeId] });
      queryClient.invalidateQueries({ queryKey: ['changes-all'] });
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: ({ role, approved, comments }: { role: ApprovalRole; approved: boolean; comments?: string }) =>
      approveChange(changeId, role, approved, comments),
    onSuccess: () => {
      setShowApprovalDialog(false);
      setApprovalComments('');
      setApprovalRole(null);
      queryClient.invalidateQueries({ queryKey: ['change', changeId] });
      queryClient.invalidateQueries({ queryKey: ['changes-all'] });
    },
  });

  // Implement mutation
  const implementMutation = useMutation({
    mutationFn: (notes?: string) => implementChange(changeId, notes),
    onSuccess: () => {
      setShowImplementDialog(false);
      setImplementNotes('');
      queryClient.invalidateQueries({ queryKey: ['change', changeId] });
      queryClient.invalidateQueries({ queryKey: ['changes-all'] });
    },
  });

  // Close mutation
  const closeMutation = useMutation({
    mutationFn: (notes?: string) => closeChange(changeId, notes),
    onSuccess: () => {
      setShowCloseDialog(false);
      setCloseNotes('');
      queryClient.invalidateQueries({ queryKey: ['change', changeId] });
      queryClient.invalidateQueries({ queryKey: ['changes-all'] });
    },
  });

  // Handlers
  const handleSubmitForReview = useCallback(() => {
    if (!change) return;

    // Validate required fields
    if (!change.justification) {
      alert('Justification is required before submitting for review');
      return;
    }
    if (!change.impactAssessment) {
      alert('Impact assessment is required before submitting for review');
      return;
    }
    if (!change.riskAssessment) {
      alert('Risk assessment is required before submitting for review');
      return;
    }

    submitMutation.mutate();
  }, [change, submitMutation]);

  const handleApprovalAction = useCallback((role: ApprovalRole, action: 'approve' | 'reject') => {
    setApprovalRole(role);
    setApprovalAction(action);
    setShowApprovalDialog(true);
  }, []);

  const handleSubmitApproval = useCallback(() => {
    if (!approvalRole) return;
    approveMutation.mutate({
      role: approvalRole,
      approved: approvalAction === 'approve',
      comments: approvalComments || undefined,
    });
  }, [approvalRole, approvalAction, approvalComments, approveMutation]);

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !change) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load change request</p>
          <DxButton
            text="Go Back"
            onClick={() => router.back()}
            stylingMode="outlined"
          />
        </div>
      </div>
    );
  }

  // Determine available actions based on status
  const canSubmitForReview = change.status === 'draft';
  const canApprove = change.status === 'pending_review';
  const canImplement = change.status === 'approved';
  const canClose = change.status === 'implemented';

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title={`${t('changes.title')} - ${change.title}`}
        subtitle={change.changeNumber}
        onBack={() => router.push('/gmp/changes')}
        actions={
          <div className="flex items-center gap-2">
            {canSubmitForReview && (
              <DxButton
                text="Submit for Review"
                icon="check"
                onClick={handleSubmitForReview}
                type="success"
                disabled={submitMutation.isPending}
              />
            )}
            {canImplement && (
              <DxButton
                text="Mark as Implemented"
                icon="check"
                onClick={() => setShowImplementDialog(true)}
                type="success"
              />
            )}
            {canClose && (
              <DxButton
                text="Close Change"
                icon="check"
                onClick={() => setShowCloseDialog(true)}
                type="success"
              />
            )}
          </div>
        }
      />

      {/* Validation Warning */}
      {canSubmitForReview && (!change.justification || !change.impactAssessment || !change.riskAssessment) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">Cannot submit for review yet</p>
              <ul className="mt-1 text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside">
                {!change.justification && <li>Justification is required</li>}
                {!change.impactAssessment && <li>Impact assessment is required</li>}
                {!change.riskAssessment && <li>Risk assessment is required</li>}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Change Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Change Info Card */}
          <div className="bg-card border rounded-lg shadow-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileEdit className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{change.title}</h2>
                  <p className="text-sm text-muted-foreground font-mono">
                    {change.changeNumber}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getPriorityBadge(change.priority)}
                <WorkflowStatusBadge status={change.status} />
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileEdit className="h-4 w-4" />
                <span>Type: <span className="capitalize">{change.changeType}</span></span>
              </div>
              {change.ownerName && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Owner: {change.ownerName}</span>
                </div>
              )}
              {change.requesterName && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Requester: {change.requesterName}</span>
                </div>
              )}
              {change.targetDate && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Target: {formatDate(change.targetDate)}</span>
                </div>
              )}
              {change.implementedDate && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>Implemented: {formatDate(change.implementedDate)}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {change.description && (
              <div className="pt-4 border-t">
                <h3 className="text-sm font-semibold mb-2">Description</h3>
                <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                  {change.description}
                </div>
              </div>
            )}

            {/* Assessments */}
            <div className="pt-4 border-t space-y-4">
              {change.justification && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Justification</h3>
                  <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                    {change.justification}
                  </div>
                </div>
              )}
              {change.impactAssessment && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Impact Assessment</h3>
                  <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                    {change.impactAssessment}
                  </div>
                </div>
              )}
              {change.riskAssessment && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Risk Assessment</h3>
                  <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                    {change.riskAssessment}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Approvals */}
        <div className="lg:col-span-1">
          <div className="bg-card border rounded-lg shadow-sm p-6 sticky top-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Approval Workflow
            </h3>

            {change.approvals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Approvals will be created when submitted for review</p>
              </div>
            ) : (
              <div className="space-y-3">
                {change.approvals.map((approval) => (
                  <ApprovalCard
                    key={approval.id}
                    approval={approval}
                    canApprove={canApprove}
                    onApprove={() => handleApprovalAction(approval.role, 'approve')}
                    onReject={() => handleApprovalAction(approval.role, 'reject')}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approval Dialog */}
      <DxPopup
        visible={showApprovalDialog}
        onHiding={() => setShowApprovalDialog(false)}
        title={`${approvalAction === 'approve' ? 'Approve' : 'Reject'} Change Request`}
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Comments {approvalAction === 'reject' && <span className="text-red-600">*</span>}
            </label>
            <DxTextArea
              value={approvalComments}
              onValueChange={(value) => setApprovalComments(value || '')}
              placeholder={approvalAction === 'reject' ? 'Please explain why you are rejecting...' : 'Optional comments...'}
              height={100}
            />
          </div>

          {approveMutation.error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {approveMutation.error.message}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <DxButton
              text="Cancel"
              onClick={() => setShowApprovalDialog(false)}
              stylingMode="outlined"
            />
            <DxButton
              text={approvalAction === 'approve' ? 'Approve' : 'Reject'}
              icon={approvalAction === 'approve' ? 'check' : 'close'}
              onClick={handleSubmitApproval}
              type={approvalAction === 'approve' ? 'success' : 'danger'}
              disabled={approveMutation.isPending || (approvalAction === 'reject' && !approvalComments.trim())}
            />
          </div>
        </div>
      </DxPopup>

      {/* Implement Dialog */}
      <DxPopup
        visible={showImplementDialog}
        onHiding={() => setShowImplementDialog(false)}
        title="Mark Change as Implemented"
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Implementation Notes (Optional)</label>
            <DxTextArea
              value={implementNotes}
              onValueChange={(value) => setImplementNotes(value || '')}
              placeholder="Add notes about the implementation..."
              height={100}
            />
          </div>

          {implementMutation.error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {implementMutation.error.message}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <DxButton
              text="Cancel"
              onClick={() => setShowImplementDialog(false)}
              stylingMode="outlined"
            />
            <DxButton
              text="Mark as Implemented"
              icon="check"
              onClick={() => implementMutation.mutate(implementNotes || undefined)}
              type="success"
              disabled={implementMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>

      {/* Close Dialog */}
      <DxPopup
        visible={showCloseDialog}
        onHiding={() => setShowCloseDialog(false)}
        title="Close Change Request"
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="font-medium text-green-800 dark:text-green-200">
                Change has been implemented and verified
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Closure Notes (Optional)</label>
            <DxTextArea
              value={closeNotes}
              onValueChange={(value) => setCloseNotes(value || '')}
              placeholder="Add any final notes..."
              height={100}
            />
          </div>

          {closeMutation.error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {closeMutation.error.message}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <DxButton
              text="Cancel"
              onClick={() => setShowCloseDialog(false)}
              stylingMode="outlined"
            />
            <DxButton
              text="Close Change"
              icon="check"
              onClick={() => closeMutation.mutate(closeNotes || undefined)}
              type="success"
              disabled={closeMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
