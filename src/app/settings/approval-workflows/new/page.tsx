/**
 * New Approval Workflow Page (T027)
 */

'use client';

import MainLayout from '@/components/layout/MainLayout';
import { ApprovalFlowForm } from '@/components/settings/ApprovalFlowForm';

export default function NewApprovalWorkflowPage() {
  return (
    <MainLayout>
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">
            New Approval Workflow
          </h1>
          <p className="text-gray-600">
            Create a new approval workflow with rules and steps
          </p>
        </div>

        <ApprovalFlowForm mode="create" />
      </div>
    </MainLayout>
  );
}
