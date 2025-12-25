'use client';

/**
 * Recall Detail Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Page for viewing and managing a specific recall.
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RecallDistributionTable,
  RecallNotificationTracker,
  RecallReconciliationForm,
  RecallDataEntryDialog,
} from '@/components/recalls';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxTabs } from '@/components/ui/dx-tabs';
import type { DxTabItem } from '@/components/ui/dx-tabs';
import {
  AlertTriangle,
  Package,
  Users,
  CheckCircle,
  Link2,
  FileText,
} from 'lucide-react';
import type { RecallDetails, RecallClass } from '@/types/recalls';

// ============================================
// API Functions
// ============================================

async function fetchRecallDetails(id: number): Promise<RecallDetails> {
  const response = await fetch(`/api/recalls/${id}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function startRecall(id: number): Promise<void> {
  const response = await fetch(`/api/recalls/${id}/start`, { method: 'POST' });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
}

async function completeRecall(id: number): Promise<void> {
  const response = await fetch(`/api/recalls/${id}/complete`, { method: 'POST' });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
}

async function closeRecall(id: number, assessment?: string): Promise<void> {
  const response = await fetch(`/api/recalls/${id}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ effectivenessAssessment: assessment }),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
}

async function generateReport(id: number): Promise<any> {
  const response = await fetch(`/api/recalls/${id}/report`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

// ============================================
// Component
// ============================================

const classLabels: Record<RecallClass, { label: string; color: string; description: string }> = {
  class_i: {
    label: 'Class I',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    description: 'Serious health hazard or death possible',
  },
  class_ii: {
    label: 'Class II',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    description: 'May cause temporary health problems',
  },
  class_iii: {
    label: 'Class III',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    description: 'Unlikely to cause health problems',
  },
};

export default function RecallDetailPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const recallId = Number(params.id);

  const [activeTab, setActiveTab] = useState(0);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [closureAssessment, setClosureAssessment] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Fetch recall details
  const {
    data: recall,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['recall', recallId],
    queryFn: () => fetchRecallDetails(recallId),
    enabled: !!recallId && !isNaN(recallId),
  });

  // Mutations
  const startMutation = useMutation({
    mutationFn: () => startRecall(recallId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recall', recallId] });
      queryClient.invalidateQueries({ queryKey: ['recalls'] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => completeRecall(recallId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recall', recallId] });
      queryClient.invalidateQueries({ queryKey: ['recalls'] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => closeRecall(recallId, closureAssessment),
    onSuccess: () => {
      setShowCloseDialog(false);
      setClosureAssessment('');
      queryClient.invalidateQueries({ queryKey: ['recall', recallId] });
      queryClient.invalidateQueries({ queryKey: ['recalls'] });
    },
  });

  // Handle report generation
  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const report = await generateReport(recallId);

      // Download as JSON
      const dataStr = JSON.stringify(report, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `recall-report-${recall?.recallNumber || recallId}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error generating report:', error);
      alert('Failed to generate report: ' + errorMessage);
    } finally {
      setIsGeneratingReport(false);
    }
  };

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

  if (error || !recall) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load recall</p>
          <DxButton text="Go Back" onClick={() => router.back()} stylingMode="outlined" />
        </div>
      </div>
    );
  }

  const classInfo = classLabels[recall.recallClass];
  const canStart = recall.status === 'initiated';
  const canComplete = recall.status === 'in_progress';
  const canClose = recall.status === 'completed';
  const isOpen = recall.status !== 'closed';
  const canEdit = recall.status === 'initiated'; // Only allow editing before execution starts

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title={`Recall ${recall.recallNumber}`}
        subtitle={recall.productName || 'Unknown Product'}
        onBack={() => router.push('/gmp/recalls')}
        actions={
          <div className="flex items-center gap-2">
            <DxButton
              text="Generate Report"
              icon="export"
              onClick={handleGenerateReport}
              stylingMode="outlined"
              disabled={isGeneratingReport}
            />
            {canEdit && (
              <DxButton
                text="Edit"
                icon="edit"
                onClick={() => setShowEditDialog(true)}
                stylingMode="outlined"
              />
            )}
            {canStart && (
              <DxButton
                text="Start Execution"
                icon="play"
                onClick={() => startMutation.mutate()}
                type="default"
                disabled={startMutation.isPending}
              />
            )}
            {canComplete && (
              <DxButton
                text="Mark Complete"
                icon="check"
                onClick={() => completeMutation.mutate()}
                type="success"
                disabled={completeMutation.isPending}
              />
            )}
            {canClose && (
              <DxButton
                text="Close Recall"
                icon="lock"
                onClick={() => setShowCloseDialog(true)}
                type="success"
              />
            )}
          </div>
        }
      />

      {/* Class Warning */}
      {recall.recallClass === 'class_i' && isOpen && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">
                Class I Recall - Urgent Action Required
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                This is a Class I recall with potential for serious health consequences.
                Immediate notification and rapid reconciliation is critical.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Recall Info */}
        <div className="lg:col-span-2 bg-card border rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{recall.recallNumber}</h2>
                <p className="text-sm text-muted-foreground">
                  Initiated: {recall.initiatedDate}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${classInfo.color}`}>
                {classInfo.label}
              </span>
              <WorkflowStatusBadge status={recall.status} />
            </div>
          </div>

          {/* Recall Details */}
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Product: {recall.productName || 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Coordinator: {recall.coordinatorName || 'Unassigned'}</span>
            </div>
            {recall.complaintId && recall.complaintNumber && (
              <button
                onClick={() => router.push(`/gmp/complaints/${recall.complaintId}`)}
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <Link2 className="h-4 w-4" />
                <span>Source Complaint: {recall.complaintNumber}</span>
              </button>
            )}
          </div>

          <div className="mt-4 pt-4 border-t">
            <h3 className="text-sm font-semibold mb-2">Reason for Recall</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {recall.reason}
            </p>
          </div>
        </div>

        {/* Effectiveness Metrics */}
        <div className="lg:col-span-2 bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Recall Effectiveness</h3>

          <div className="flex items-center justify-center mb-4">
            <div
              className={`text-5xl font-bold ${
                recall.effectivenessRate >= 90
                  ? 'text-green-600'
                  : recall.effectivenessRate >= 70
                    ? 'text-yellow-600'
                    : 'text-red-600'
              }`}
            >
              {recall.effectivenessRate.toFixed(1)}%
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xl font-bold">{recall.distributedQuantity}</div>
              <div className="text-xs text-muted-foreground">Distributed</div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xl font-bold">{recall.returnedQuantity}</div>
              <div className="text-xs text-muted-foreground">Returned</div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xl font-bold">{recall.reconciledQuantity}</div>
              <div className="text-xs text-muted-foreground">Reconciled</div>
            </div>
          </div>

          {recall.closureDate && (
            <div className="mt-4 pt-4 border-t flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Closed on: {recall.closureDate}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border rounded-lg shadow-sm">
        <DxTabs
          items={[
            { id: 0, text: 'Distribution', icon: 'globe' },
            { id: 1, text: 'Notifications', icon: 'message' },
            { id: 2, text: 'Reconciliation', icon: 'check' },
          ] as DxTabItem[]}
          selectedIndex={activeTab}
          onSelectedIndexChange={setActiveTab}
        />

        <div className="p-6">
          {activeTab === 0 && <RecallDistributionTable recallId={recallId} />}
          {activeTab === 1 && (
            <RecallNotificationTracker recallId={recallId} canEdit={isOpen} />
          )}
          {activeTab === 2 && (
            <RecallReconciliationForm
              recallId={recallId}
              affectedLots={recall.affectedLots}
              canEdit={isOpen}
            />
          )}
        </div>
      </div>

      {/* Close Dialog */}
      <DxPopup
        visible={showCloseDialog}
        onHiding={() => setShowCloseDialog(false)}
        title="Close Recall"
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="font-medium text-green-800 dark:text-green-200">
                Recall is ready for closure
              </p>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              Effectiveness Rate: {recall.effectivenessRate.toFixed(1)}%
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Effectiveness Assessment (Optional)</label>
            <DxTextArea
              value={closureAssessment}
              onValueChange={(value) => setClosureAssessment(value || '')}
              placeholder="Document the effectiveness of this recall..."
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
              text="Close Recall"
              icon="lock"
              onClick={() => closeMutation.mutate()}
              type="success"
              disabled={closeMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>

      {/* Edit Recall Dialog */}
      <RecallDataEntryDialog
        visible={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        onSaved={() => {
          setShowEditDialog(false);
          refetch();
        }}
        recall={recall}
        mode="edit"
      />
    </div>
  );
}
