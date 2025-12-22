'use client';

/**
 * Audit Detail Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * View audit details and manage findings.
 */

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { AuditFindingList } from '@/components/internal-audit';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { toast } from 'sonner';
import type { AuditDetails, AuditFinding, AuditFindingCategory } from '@/types/audits';
import { GMP_CHAPTERS } from '@/types/audits';

// ============================================
// API Functions
// ============================================

async function fetchAuditDetails(auditId: number): Promise<AuditDetails> {
  const response = await fetch(`/api/internal-audit/audits/${auditId}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function createFinding(data: {
  auditId: number;
  gmpChapter: number;
  category: AuditFindingCategory;
  description: string;
  evidence?: string;
  requirement?: string;
  capaRequired: boolean;
}): Promise<AuditFinding> {
  const response = await fetch('/api/internal-audit/findings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
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

async function startAudit(auditId: number): Promise<void> {
  const response = await fetch(`/api/internal-audit/audits/${auditId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
}

async function completeAudit(auditId: number): Promise<void> {
  const response = await fetch(`/api/internal-audit/audits/${auditId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
}

// ============================================
// Component
// ============================================

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AuditDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const auditId = parseInt(id);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [showFindingPopup, setShowFindingPopup] = useState(false);
  const [findingForm, setFindingForm] = useState({
    gmpChapter: 1,
    category: 'observation' as AuditFindingCategory,
    description: '',
    evidence: '',
    requirement: '',
    capaRequired: false,
  });

  const { data: audit, isLoading, error } = useQuery({
    queryKey: ['audit-detail', auditId],
    queryFn: () => fetchAuditDetails(auditId),
    enabled: !isNaN(auditId),
  });

  const createFindingMutation = useMutation({
    mutationFn: (data: Parameters<typeof createFinding>[0]) => createFinding(data),
    onSuccess: () => {
      toast.success('Finding recorded');
      queryClient.invalidateQueries({ queryKey: ['audit-detail', auditId] });
      setShowFindingPopup(false);
      resetFindingForm();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to record finding');
    },
  });

  const closeFindingMutation = useMutation({
    mutationFn: closeFinding,
    onSuccess: () => {
      toast.success('Finding closed');
      queryClient.invalidateQueries({ queryKey: ['audit-detail', auditId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to close finding');
    },
  });

  const startMutation = useMutation({
    mutationFn: startAudit,
    onSuccess: () => {
      toast.success('Audit started');
      queryClient.invalidateQueries({ queryKey: ['audit-detail', auditId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to start audit');
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeAudit,
    onSuccess: () => {
      toast.success('Audit completed');
      queryClient.invalidateQueries({ queryKey: ['audit-detail', auditId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to complete audit');
    },
  });

  const resetFindingForm = () => {
    setFindingForm({
      gmpChapter: audit?.gmpChapters[0] || 1,
      category: 'observation',
      description: '',
      evidence: '',
      requirement: '',
      capaRequired: false,
    });
  };

  const handleCreateFinding = () => {
    if (!findingForm.description.trim()) {
      toast.error('Description is required');
      return;
    }
    createFindingMutation.mutate({
      auditId,
      ...findingForm,
    });
  };

  const handleCloseFinding = (findingId: number) => {
    if (confirm('Are you sure you want to close this finding?')) {
      closeFindingMutation.mutate(findingId);
    }
  };

  const handleAssignCapa = (findingId: number) => {
    router.push(`/gmp/capa/new?findingId=${findingId}`);
  };

  const categoryOptions = [
    { id: 'observation', name: 'Observation' },
    { id: 'minor', name: 'Minor' },
    { id: 'major', name: 'Major' },
    { id: 'critical', name: 'Critical' },
  ];

  const chapterOptions = (audit?.gmpChapters || []).map((ch) => ({
    id: ch,
    name: `หมวด ${ch}: ${GMP_CHAPTERS[ch as keyof typeof GMP_CHAPTERS] || ''}`,
  }));

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-red-600">
            {error ? (error as Error).message : 'Audit not found'}
          </p>
          <DxButton
            text="Back to Audits"
            onClick={() => router.push('/gmp/internal-audit/audits')}
            className="mt-4"
          />
        </div>
      </div>
    );
  }

  const canAddFinding = audit.status === 'in_progress';
  const canStart = audit.status === 'scheduled';
  const canComplete = audit.status === 'in_progress';

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title={audit.auditNumber}
        subtitle={audit.scope}
        onBack={() => router.push('/gmp/internal-audit/audits')}
        actions={
          <div className="flex gap-2">
            {canStart && (
              <DxButton
                text="Start Audit"
                icon="runner"
                onClick={() => startMutation.mutate(auditId)}
                type="default"
              />
            )}
            {canComplete && (
              <DxButton
                text="Complete"
                icon="check"
                onClick={() => completeMutation.mutate(auditId)}
                type="success"
              />
            )}
            {canAddFinding && (
              <DxButton
                text="Add Finding"
                icon="plus"
                onClick={() => {
                  resetFindingForm();
                  setShowFindingPopup(true);
                }}
                type="default"
              />
            )}
          </div>
        }
      />

      {/* Audit Details Card */}
      <div className="bg-card border rounded-lg p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <WorkflowStatusBadge status={audit.status} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Type</p>
            <p className="font-medium capitalize">{audit.auditType}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Scheduled Date</p>
            <p className="font-medium">{audit.scheduledDate}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Lead Auditor</p>
            <p className="font-medium">{audit.leadAuditorName || '—'}</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">GMP Chapters</p>
              <p className="font-medium">
                {audit.gmpChapters.map((ch) => `หมวด ${ch}`).join(', ')}
              </p>
            </div>
            {audit.objectives && (
              <div>
                <p className="text-sm text-muted-foreground">Objectives</p>
                <p className="font-medium">{audit.objectives}</p>
              </div>
            )}
          </div>
        </div>

        {(audit.startedAt || audit.completedAt) && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-2 gap-6">
              {audit.startedAt && (
                <div>
                  <p className="text-sm text-muted-foreground">Started</p>
                  <p className="font-medium">{new Date(audit.startedAt).toLocaleDateString()}</p>
                </div>
              )}
              {audit.completedAt && (
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="font-medium">{new Date(audit.completedAt).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Findings Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{audit.findingsCount}</p>
          <p className="text-sm text-muted-foreground">Total</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">
            {audit.findings?.filter((f) => f.category === 'observation').length || 0}
          </p>
          <p className="text-sm text-blue-600">Observations</p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">
            {audit.findings?.filter((f) => f.category === 'minor').length || 0}
          </p>
          <p className="text-sm text-yellow-600">Minor</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-orange-600">
            {audit.findings?.filter((f) => f.category === 'major').length || 0}
          </p>
          <p className="text-sm text-orange-600">Major</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-600">
            {audit.findings?.filter((f) => f.category === 'critical').length || 0}
          </p>
          <p className="text-sm text-red-600">Critical</p>
        </div>
      </div>

      {/* Findings List */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Audit Findings</h2>
        <AuditFindingList
          findings={audit.findings || []}
          onAssignCapa={handleAssignCapa}
          onClose={handleCloseFinding}
          canEdit={audit.status !== 'completed'}
        />
      </div>

      {/* Create Finding Popup */}
      <DxPopup
        visible={showFindingPopup}
        onHiding={() => setShowFindingPopup(false)}
        title="Record Finding"
        width={600}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">GMP Chapter *</label>
              <DxSelectBox
                value={findingForm.gmpChapter}
                onValueChanged={(e) => setFindingForm({ ...findingForm, gmpChapter: e.value })}
                dataSource={chapterOptions}
                valueExpr="id"
                displayExpr="name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category *</label>
              <DxSelectBox
                value={findingForm.category}
                onValueChanged={(e) => setFindingForm({ ...findingForm, category: e.value })}
                dataSource={categoryOptions}
                valueExpr="id"
                displayExpr="name"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description *</label>
            <DxTextArea
              value={findingForm.description}
              onValueChanged={(e) => setFindingForm({ ...findingForm, description: e.value })}
              placeholder="Describe the finding"
              height={80}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Evidence</label>
            <DxTextArea
              value={findingForm.evidence}
              onValueChanged={(e) => setFindingForm({ ...findingForm, evidence: e.value })}
              placeholder="Supporting evidence"
              height={60}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">GMP Requirement Reference</label>
            <DxTextBox
              value={findingForm.requirement}
              onValueChanged={(e) => setFindingForm({ ...findingForm, requirement: e.value })}
              placeholder="e.g., หมวด 3 ข้อ 3.1"
            />
          </div>
          <div>
            <DxCheckBox
              value={findingForm.capaRequired}
              onValueChanged={(e) => setFindingForm({ ...findingForm, capaRequired: e.value })}
              text="CAPA Required"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Major and Critical findings typically require CAPA
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <DxButton
              text="Cancel"
              onClick={() => setShowFindingPopup(false)}
              stylingMode="outlined"
            />
            <DxButton
              text="Record Finding"
              onClick={handleCreateFinding}
              type="default"
              disabled={createFindingMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
