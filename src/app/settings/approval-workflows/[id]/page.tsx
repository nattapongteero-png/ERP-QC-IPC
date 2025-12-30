'use client';

/**
 * Edit Approval Workflow Page (T028)
 * Reusable page component that uses the shared ApprovalFlowForm
 */

import { use } from 'react';
import { ApprovalFlowForm } from '@/components/settings/ApprovalFlowForm';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditApprovalWorkflowPage({ params }: PageProps) {
  const { id } = use(params);
  const flowId = Number(id);

  return (
    <div className="p-1">
      <ApprovalFlowForm mode="edit" flowId={flowId} />
    </div>
  );
}
