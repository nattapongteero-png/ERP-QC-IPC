/**
 * Edit Approval Workflow Page (T028)
 */

'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { ApprovalFlowForm } from '@/components/settings/ApprovalFlowForm';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import type { ApprovalFlowWithDetails } from '@/types/approval-workflow';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditApprovalWorkflowPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [flow, setFlow] = useState<ApprovalFlowWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFlow = async () => {
      try {
        const response = await fetch(`/api/settings/approval-flows/${id}`);
        const result = await response.json();
        if (result.success) {
          setFlow(result.data);
        } else {
          setError(result.error || 'Failed to load workflow');
        }
      } catch (err) {
        setError('Failed to load workflow');
      } finally {
        setLoading(false);
      }
    };

    fetchFlow();
  }, [id]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <LoadIndicator />
        </div>
      </MainLayout>
    );
  }

  if (error || !flow) {
    return (
      <MainLayout>
        <div className="p-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error || 'Workflow not found'}
          </div>
          <button
            className="mt-4 text-blue-600 hover:underline"
            onClick={() => router.push('/settings/approval-workflows')}
          >
            ← Back to Workflows
          </button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">
            Edit Approval Workflow
          </h1>
          <p className="text-gray-600">
            Modify workflow settings, rules, and approval steps
          </p>
        </div>

        <ApprovalFlowForm
          mode="edit"
          flowId={parseInt(id, 10)}
          initialData={flow}
        />
      </div>
    </MainLayout>
  );
}
