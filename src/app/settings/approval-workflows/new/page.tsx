'use client';

/**
 * New Approval Workflow Page (T027)
 * Reusable page component that uses the shared ApprovalFlowForm
 */

import { ApprovalFlowForm } from '@/components/settings/ApprovalFlowForm';

export default function NewApprovalWorkflowPage() {
  return (
    <div className="p-1">
      <ApprovalFlowForm mode="create" />
    </div>
  );
}
