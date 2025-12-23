'use client';

/**
 * Complaint Detail Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Page for viewing and managing a specific complaint.
 * Uses the reusable ComplaintDataEntryDialog for editing.
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ComplaintDataEntryDialog, ComplaintInvestigationForm } from '@/components/complaints';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextArea } from '@/components/ui/dx-text-area';
import {
  MessageSquareWarning,
  CheckCircle,
  User,
  AlertTriangle,
  Package,
  Phone,
  FileText,
  Link2,
  Calendar,
  Clock,
} from 'lucide-react';
import type { ComplaintDetails, ComplaintSeverity } from '@/types/complaints';

// ============================================
// API Functions
// ============================================

async function fetchComplaintDetails(id: number): Promise<ComplaintDetails> {
  const response = await fetch(`/api/complaints/${id}`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch complaint');
  }
  return result.data;
}

async function closeComplaint(id: number, closureNotes?: string): Promise<void> {
  const response = await fetch(`/api/complaints/${id}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ closureNotes }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to close complaint');
  }
}

// ============================================
// Component
// ============================================

export default function ComplaintDetailPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const complaintId = Number(params.id);

  // State
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closureNotes, setClosureNotes] = useState('');

  // Fetch complaint details
  const {
    data: complaint,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['complaint', complaintId],
    queryFn: () => fetchComplaintDetails(complaintId),
    enabled: !!complaintId && !isNaN(complaintId),
  });

  // Close complaint mutation
  const closeMutation = useMutation({
    mutationFn: () => closeComplaint(complaintId, closureNotes),
    onSuccess: () => {
      setShowCloseDialog(false);
      setClosureNotes('');
      queryClient.invalidateQueries({ queryKey: ['complaint', complaintId] });
      queryClient.invalidateQueries({ queryKey: ['complaints-dashboard'] });
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
  if (error || !complaint) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load complaint</p>
          <DxButton
            text="Go Back"
            onClick={() => router.back()}
            stylingMode="outlined"
          />
        </div>
      </div>
    );
  }

  // Severity badge
  const getSeverityBadge = (severity: ComplaintSeverity) => {
    const colors: Record<ComplaintSeverity, string> = {
      minor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      major: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors[severity]}`}>
        {severity.toUpperCase()}
      </span>
    );
  };

  // Check if complaint can be closed
  const canClose = complaint.status === 'resolved';
  const isOpen = complaint.status !== 'closed';

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title={`Complaint ${complaint.complaintNumber}`}
        subtitle={complaint.productName || 'Unknown Product'}
        icon={MessageSquareWarning}
        iconBgColor="bg-orange-100"
        iconColor="text-orange-600"
        onBack={() => router.push('/gmp/complaints')}
        breadcrumbs={[
          { label: 'GMP', href: '/gmp' },
          { label: 'Complaints', href: '/gmp/complaints' },
          { label: complaint.complaintNumber },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {isOpen && (
              <DxButton
                text="Edit"
                icon="edit"
                onClick={() => setShowEditDialog(true)}
                stylingMode="outlined"
              />
            )}
            {canClose && (
              <DxButton
                text="Close Complaint"
                icon="check"
                onClick={() => setShowCloseDialog(true)}
                type="success"
              />
            )}
          </div>
        }
      />

      {/* Regulatory Warning */}
      {complaint.regulatoryReportRequired && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
            <div>
              <p className="font-medium text-orange-800 dark:text-orange-200">
                Regulatory Report Required
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                This complaint requires reporting to regulatory authorities.
                {complaint.regulatoryReportDate && (
                  <> Reported on: {complaint.regulatoryReportDate}</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Complaint Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Complaint Info Card */}
          <div className="bg-card border rounded-lg shadow-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <MessageSquareWarning className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{complaint.complaintNumber}</h2>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Received: {complaint.receivedDate}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getSeverityBadge(complaint.severity)}
                <WorkflowStatusBadge status={complaint.status} />
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>
                  Source: <span className="capitalize text-foreground">{complaint.source}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  Category: <span className="capitalize text-foreground">{complaint.category}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" />
                <span>Product: {complaint.productName || 'Unknown'}</span>
              </div>
              {complaint.lotNumber && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span>Lot: {complaint.lotNumber}</span>
                </div>
              )}
              {complaint.customerName && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Customer: {complaint.customerName}</span>
                </div>
              )}
              {complaint.customerContact && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>Contact: {complaint.customerContact}</span>
                </div>
              )}
              {complaint.closedDate && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>Closed: {complaint.closedDate}</span>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="mt-4 pt-4 border-t">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Description
              </h3>
              <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                {complaint.description}
              </div>
            </div>

            {/* Linked CAPA */}
            {complaint.capaId && complaint.capa && (
              <div className="mt-4 pt-4 border-t">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  Linked CAPA
                </h3>
                <button
                  onClick={() => router.push(`/gmp/capa/${complaint.capaId}`)}
                  className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors w-full"
                >
                  <Link2 className="h-4 w-4 text-blue-600" />
                  <span className="font-mono font-medium">
                    {(complaint.capa as { capaNumber: string }).capaNumber}
                  </span>
                  <span className="text-muted-foreground">-</span>
                  <span className="truncate">{(complaint.capa as { title: string }).title}</span>
                </button>
              </div>
            )}

            {/* Timeline / Audit Info */}
            <div className="mt-4 pt-4 border-t">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Timeline
              </h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Created</span>
                  <span>{complaint.createdAt}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last Updated</span>
                  <span>{complaint.updatedAt}</span>
                </div>
                {complaint.closedDate && (
                  <div className="flex items-center justify-between text-green-600">
                    <span>Closed</span>
                    <span>{complaint.closedDate}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Investigation */}
        <div className="lg:col-span-1">
          <div className="bg-card border rounded-lg shadow-sm p-6 sticky top-6">
            <ComplaintInvestigationForm
              complaint={complaint}
              onInvestigationStarted={() => refetch()}
              onInvestigationRecorded={() => refetch()}
            />
          </div>
        </div>
      </div>

      {/* Edit Complaint Dialog - Using reusable component */}
      <ComplaintDataEntryDialog
        visible={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        onSaved={() => {
          setShowEditDialog(false);
          refetch();
        }}
        complaint={complaint}
        mode="edit"
      />

      {/* Close Complaint Dialog */}
      <DxPopup
        visible={showCloseDialog}
        onHiding={() => setShowCloseDialog(false)}
        title="Close Complaint"
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="font-medium text-green-800 dark:text-green-200">
                Investigation complete - Complaint can be closed
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Closure Notes (Optional)</label>
            <DxTextArea
              value={closureNotes}
              onValueChange={(value) => setClosureNotes(value || '')}
              placeholder="Add any final notes about this complaint..."
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
              text="Close Complaint"
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
