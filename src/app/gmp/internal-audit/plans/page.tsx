'use client';

/**
 * Audit Plans Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * Manage annual internal audit plans.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { AuditPlanList } from '@/components/internal-audit';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextBox } from '@/components/ui/dx-textbox';
import { DxNumberBox } from '@/components/ui/dx-numberbox';
import { DxTextArea } from '@/components/ui/dx-textarea';
import { toast } from 'sonner';
import type { AuditPlan } from '@/types/audits';

// ============================================
// API Functions
// ============================================

interface PlansResponse {
  plans: AuditPlan[];
  total: number;
}

async function fetchPlans(): Promise<PlansResponse> {
  const response = await fetch('/api/internal-audit/plans');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function createPlan(data: {
  planYear: number;
  name: string;
  description?: string;
}): Promise<AuditPlan> {
  const response = await fetch('/api/internal-audit/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function approvePlan(planId: number): Promise<void> {
  const response = await fetch(`/api/internal-audit/plans/${planId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
}

// ============================================
// Component
// ============================================

export default function AuditPlansPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [formData, setFormData] = useState({
    planYear: currentYear,
    name: `Annual Audit Plan ${currentYear}`,
    description: '',
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-plans'],
    queryFn: fetchPlans,
  });

  const createMutation = useMutation({
    mutationFn: createPlan,
    onSuccess: () => {
      toast.success('Audit plan created successfully');
      queryClient.invalidateQueries({ queryKey: ['audit-plans'] });
      setShowCreatePopup(false);
      setFormData({
        planYear: currentYear,
        name: `Annual Audit Plan ${currentYear}`,
        description: '',
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create audit plan');
    },
  });

  const approveMutation = useMutation({
    mutationFn: approvePlan,
    onSuccess: () => {
      toast.success('Audit plan approved');
      queryClient.invalidateQueries({ queryKey: ['audit-plans'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to approve audit plan');
    },
  });

  const handleCreate = () => {
    if (!formData.name.trim()) {
      toast.error('Plan name is required');
      return;
    }
    createMutation.mutate(formData);
  };

  const handleView = (plan: AuditPlan) => {
    router.push(`/gmp/internal-audit/audits?planId=${plan.id}`);
  };

  const handleApprove = (planId: number) => {
    if (confirm('Are you sure you want to approve this audit plan?')) {
      approveMutation.mutate(planId);
    }
  };

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-red-600">Error loading audit plans: {(error as Error).message}</p>
          <DxButton
            text="Retry"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['audit-plans'] })}
            className="mt-4"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title="Audit Plans"
        subtitle="Manage annual internal audit plans"
        onBack={() => router.push('/gmp/internal-audit')}
        actions={
          <DxButton
            text="Create Plan"
            icon="plus"
            onClick={() => setShowCreatePopup(true)}
            type="default"
          />
        }
      />

      {/* Plans List */}
      <div className="bg-card border rounded-lg p-6">
        <AuditPlanList
          plans={data?.plans || []}
          onView={handleView}
          onApprove={handleApprove}
          canApprove={true}
          loading={isLoading}
        />
      </div>

      {/* Create Plan Popup */}
      <DxPopup
        visible={showCreatePopup}
        onHiding={() => setShowCreatePopup(false)}
        title="Create Audit Plan"
        width={500}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Plan Year</label>
            <DxNumberBox
              value={formData.planYear}
              onValueChanged={(e) => setFormData({ ...formData, planYear: e.value })}
              min={currentYear - 1}
              max={currentYear + 5}
              showSpinButtons
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Plan Name *</label>
            <DxTextBox
              value={formData.name}
              onValueChanged={(e) => setFormData({ ...formData, name: e.value })}
              placeholder="Enter plan name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <DxTextArea
              value={formData.description}
              onValueChanged={(e) => setFormData({ ...formData, description: e.value })}
              placeholder="Enter plan description"
              height={100}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <DxButton
              text="Cancel"
              onClick={() => setShowCreatePopup(false)}
              stylingMode="outlined"
            />
            <DxButton
              text="Create"
              onClick={handleCreate}
              type="default"
              disabled={createMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
