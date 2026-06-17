'use client';

/**
 * Findings List Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * View and manage all audit findings.
 */

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { AuditFindingList } from '@/components/internal-audit';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { useToast } from '@/components/ui/toast';
import type { AuditFinding, AuditFindingStatus, AuditFindingCategory } from '@/types/audits';

// ============================================
// API Functions
// ============================================

interface FindingsResponse {
  findings: AuditFinding[];
  total: number;
}

async function fetchFindings(params: {
  status?: AuditFindingStatus;
  category?: AuditFindingCategory;
}): Promise<FindingsResponse> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.category) searchParams.set('category', params.category);

  const response = await fetch(`/api/internal-audit/findings?${searchParams}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function closeFinding(findingId: number): Promise<void> {
  const response = await fetch(`/api/internal-audit/findings/${findingId}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
}

// ============================================
// Inner Component (with useSearchParams)
// ============================================

function FindingsPageContent() {
  const router = useRouter();
  const t = useTranslations('gmp');
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();

  const initialStatus = searchParams.get('status') as AuditFindingStatus | undefined;
  const [statusFilter, setStatusFilter] = useState<AuditFindingStatus | undefined>(initialStatus);
  const [categoryFilter, setCategoryFilter] = useState<AuditFindingCategory | undefined>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['all-findings', statusFilter, categoryFilter],
    queryFn: () => fetchFindings({ status: statusFilter, category: categoryFilter }),
  });

  const closeMutation = useMutation({
    mutationFn: closeFinding,
    onSuccess: () => {
      toast.success('Finding closed');
      queryClient.invalidateQueries({ queryKey: ['all-findings'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to close finding');
    },
  });

  const handleCloseFinding = (findingId: number) => {
    if (confirm('Are you sure you want to close this finding?')) {
      closeMutation.mutate(findingId);
    }
  };

  const handleAssignCapa = (findingId: number, findingNumber?: string) => {
    const params = new URLSearchParams({ auditFindingId: String(findingId) });
    if (findingNumber) params.set('auditFindingNumber', findingNumber);
    router.push(`/gmp/capa/new?${params.toString()}`);
  };

  const handleEditFinding = (finding: AuditFinding) => {
    router.push(`/gmp/internal-audit/audits/${finding.auditId}`);
  };

  const statusOptions = [
    { id: undefined, name: 'All Statuses' },
    { id: 'open', name: 'Open' },
    { id: 'capa_assigned', name: 'CAPA Assigned' },
    { id: 'closed', name: 'Closed' },
  ];

  const categoryOptions = [
    { id: undefined, name: 'All Categories' },
    { id: 'observation', name: 'Observation' },
    { id: 'minor', name: 'Minor' },
    { id: 'major', name: 'Major' },
    { id: 'critical', name: 'Critical' },
  ];

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-red-600">Error loading findings: {(error as Error).message}</p>
          <DxButton
            text="Retry"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['all-findings'] })}
            className="mt-4"
          />
        </div>
      </div>
    );
  }

  // Summary stats
  const findings = data?.findings || [];
  const openCount = findings.filter((f) => f.status === 'open').length;
  const capaCount = findings.filter((f) => f.status === 'capa_assigned').length;
  const closedCount = findings.filter((f) => f.status === 'closed').length;
  const criticalCount = findings.filter((f) => f.category === 'critical' && f.status !== 'closed').length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title={t('internalAudit.findings.title')}
        subtitle={t('internalAudit.findings.description')}
        onBack={() => router.push('/gmp/internal-audit')}
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 border-l-4 border-l-amber-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <p className="text-2xl font-bold text-gray-900">{openCount}</p>
          <p className="text-sm text-gray-500">Open</p>
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <p className="text-2xl font-bold text-gray-900">{capaCount}</p>
          <p className="text-sm text-gray-500">CAPA Assigned</p>
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-emerald-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <p className="text-2xl font-bold text-gray-900">{closedCount}</p>
          <p className="text-sm text-gray-500">Closed</p>
        </div>
        <div
          className={`bg-white border border-gray-200 border-l-4 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)] ${
            criticalCount > 0 ? 'border-l-rose-500' : 'border-l-emerald-500'
          }`}
        >
          <p className="text-2xl font-bold text-gray-900">{criticalCount}</p>
          <p className="text-sm text-gray-500">Critical Open</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex flex-wrap gap-4">
          <div className="w-48">
            <label className="block text-sm font-medium mb-1">Status</label>
            <DxSelectBox
              value={statusFilter}
              onValueChanged={(e) => setStatusFilter(e.value)}
              dataSource={statusOptions}
              valueExpr="id"
              displayExpr="name"
            />
          </div>
          <div className="w-48">
            <label className="block text-sm font-medium mb-1">Category</label>
            <DxSelectBox
              value={categoryFilter}
              onValueChanged={(e) => setCategoryFilter(e.value)}
              dataSource={categoryOptions}
              valueExpr="id"
              displayExpr="name"
            />
          </div>
          <div className="flex items-end">
            <DxButton
              text="Clear Filters"
              onClick={() => {
                setStatusFilter(undefined);
                setCategoryFilter(undefined);
              }}
              stylingMode="text"
            />
          </div>
        </div>
      </div>

      {/* Findings List */}
      <div className="bg-card border rounded-lg p-6">
        <AuditFindingList
          findings={findings}
          onEdit={handleEditFinding}
          onAssignCapa={handleAssignCapa}
          onClose={handleCloseFinding}
          canEdit={true}
          loading={isLoading}
        />
      </div>

      {/* Critical Findings Alert */}
      {criticalCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="font-medium text-red-800 dark:text-red-200">
                Critical Findings Require Immediate Attention
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                {criticalCount} critical finding(s) are open. These should be addressed immediately
                with appropriate CAPA actions.
              </p>
            </div>
            <DxButton
              text="View Critical"
              onClick={() => {
                setStatusFilter('open');
                setCategoryFilter('critical');
              }}
              stylingMode="outlined"
              type="danger"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Page Component with Suspense
// ============================================

export default function FindingsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4" />
            <div className="grid grid-cols-4 gap-4">
              <div className="h-24 bg-muted rounded" />
              <div className="h-24 bg-muted rounded" />
              <div className="h-24 bg-muted rounded" />
              <div className="h-24 bg-muted rounded" />
            </div>
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      }
    >
      <FindingsPageContent />
    </Suspense>
  );
}
