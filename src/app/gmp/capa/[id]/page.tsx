'use client';

/**
 * CAPA Detail Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * Page for viewing and managing a specific CAPA.
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CapaForm, CapaActionList, CapaEffectivenessForm } from '@/components/capa';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextArea } from '@/components/ui/dx-text-area';
import {
  FileCheck,
  Edit,
  CheckCircle,
  User,
  Calendar,
  AlertTriangle,
  Target,
  FileText,
} from 'lucide-react';
import type { CapaDetails, CapaPriority } from '@/types/capa';

// ============================================
// API Functions
// ============================================

async function fetchCapaDetails(id: number): Promise<CapaDetails> {
  const response = await fetch(`/api/capa/${id}`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch CAPA');
  }
  return result.data;
}

async function closeCapa(id: number, closureNotes?: string): Promise<void> {
  const response = await fetch(`/api/capa/${id}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ closureNotes }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to close CAPA');
  }
}

// ============================================
// Component
// ============================================

export default function CapaDetailPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const capaId = Number(params.id);

  // State
  const [showEditForm, setShowEditForm] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closureNotes, setClosureNotes] = useState('');

  // Fetch CAPA details
  const {
    data: capa,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['capa', capaId],
    queryFn: () => fetchCapaDetails(capaId),
    enabled: !!capaId && !isNaN(capaId),
  });

  // Close CAPA mutation
  const closeMutation = useMutation({
    mutationFn: () => closeCapa(capaId, closureNotes),
    onSuccess: () => {
      setShowCloseDialog(false);
      setClosureNotes('');
      queryClient.invalidateQueries({ queryKey: ['capa', capaId] });
      queryClient.invalidateQueries({ queryKey: ['capa-dashboard'] });
    },
  });

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
  if (error || !capa) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load CAPA</p>
          <DxButton
            text="Go Back"
            onClick={() => router.back()}
            stylingMode="outlined"
          />
        </div>
      </div>
    );
  }

  // Priority badge
  const getPriorityBadge = (priority: CapaPriority) => {
    const colors: Record<CapaPriority, string> = {
      low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[priority]}`}>
        {priority.toUpperCase()}
      </span>
    );
  };

  // Check if CAPA can be closed
  const canClose = capa.status !== 'closed' && capa.status !== 'cancelled';
  const allActionsComplete = capa.actions.every((a) => a.status === 'completed');
  const hasEffectiveCheck = capa.effectivenessChecks.some((e) => e.result === 'effective');
  const canCloseNow = canClose && allActionsComplete && hasEffectiveCheck;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title={capa.title}
        subtitle={capa.capaNumber}
        onBack={() => router.push('/gmp/capa')}
        actions={
          <div className="flex items-center gap-2">
            {capa.status !== 'closed' && capa.status !== 'cancelled' && (
              <DxButton
                text="Edit"
                icon="edit"
                onClick={() => setShowEditForm(true)}
                stylingMode="outlined"
              />
            )}
            {canClose && (
              <DxButton
                text="Close CAPA"
                icon="check"
                onClick={() => setShowCloseDialog(true)}
                type="success"
                disabled={!canCloseNow}
              />
            )}
          </div>
        }
      />

      {/* Cannot close warning */}
      {canClose && !canCloseNow && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">CAPA cannot be closed yet</p>
              <ul className="mt-1 text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside">
                {!allActionsComplete && <li>All actions must be completed</li>}
                {!hasEffectiveCheck && <li>At least one effectiveness check must show &quot;Effective&quot;</li>}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - CAPA Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* CAPA Info Card */}
          <div className="bg-card border rounded-lg shadow-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{capa.title}</h2>
                  <p className="text-sm text-muted-foreground font-mono">
                    {capa.capaNumber}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getPriorityBadge(capa.priority)}
                <WorkflowStatusBadge status={capa.status} />
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Target className="h-4 w-4" />
                <span>Type: <span className="capitalize">{capa.type}</span></span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>Source: <span className="capitalize">{capa.sourceType.replace('_', ' ')}</span></span>
              </div>
              {capa.ownerName && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Owner: {capa.ownerName}</span>
                </div>
              )}
              {capa.dueDate && (
                <div className={`flex items-center gap-2 ${capa.isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                  <Calendar className="h-4 w-4" />
                  <span>Due: {capa.dueDate}</span>
                  {capa.isOverdue && <AlertTriangle className="h-4 w-4" />}
                </div>
              )}
              {capa.closedDate && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>Closed: {capa.closedDate}</span>
                </div>
              )}
            </div>

            {/* Root Cause Analysis */}
            {(capa.rootCauseCategory || capa.rootCauseAnalysis) && (
              <div className="mt-4 pt-4 border-t">
                <h3 className="text-sm font-semibold mb-2">Root Cause Analysis</h3>
                {capa.rootCauseCategory && (
                  <p className="text-sm mb-2">
                    <span className="font-medium">Category (5M+E): </span>
                    {capa.rootCauseCategory}
                  </p>
                )}
                {capa.rootCauseAnalysis && (
                  <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                    {capa.rootCauseAnalysis}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions Section */}
          <div className="bg-card border rounded-lg shadow-sm p-6">
            <CapaActionList
              capaId={capaId}
              actions={capa.actions}
              canEdit={capa.status !== 'closed' && capa.status !== 'cancelled'}
              onActionAdded={() => refetch()}
              onActionUpdated={() => refetch()}
            />
          </div>
        </div>

        {/* Right Column - Effectiveness */}
        <div className="lg:col-span-1">
          <div className="bg-card border rounded-lg shadow-sm p-6 sticky top-6">
            <CapaEffectivenessForm
              capaId={capaId}
              effectivenessChecks={capa.effectivenessChecks}
              canEdit={capa.status !== 'closed' && capa.status !== 'cancelled'}
              onCheckRecorded={() => refetch()}
            />
          </div>
        </div>
      </div>

      {/* Edit CAPA Dialog */}
      <DxPopup
        visible={showEditForm}
        onHiding={() => setShowEditForm(false)}
        title="Edit CAPA"
        width={600}
        height="auto"
        showCloseButton
      >
        <CapaForm
          capa={capa}
          onSave={() => {
            setShowEditForm(false);
            refetch();
          }}
          onCancel={() => setShowEditForm(false)}
        />
      </DxPopup>

      {/* Close CAPA Dialog */}
      <DxPopup
        visible={showCloseDialog}
        onHiding={() => setShowCloseDialog(false)}
        title="Close CAPA"
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="font-medium text-green-800 dark:text-green-200">
                All requirements met - CAPA can be closed
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Closure Notes (Optional)</label>
            <DxTextArea
              value={closureNotes}
              onValueChange={(value) => setClosureNotes(value || '')}
              placeholder="Add any final notes about this CAPA..."
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
              text="Close CAPA"
              icon="check"
              onClick={() => closeMutation.mutate()}
              type="success"
              disabled={closeMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
