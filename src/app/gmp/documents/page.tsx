'use client';

/**
 * GMP Documents List Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * Main page for viewing and managing GMP controlled documents.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { DocumentList, DocumentApprovalDialog } from '@/components/documents';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import {
  FileText,
  Clock,
  AlertCircle,
  Bell,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Document, DocumentStatus, DocumentType, PendingApproval } from '@/types/documents';

// ============================================
// API Functions
// ============================================

async function fetchDocumentTypes(): Promise<DocumentType[]> {
  const response = await fetch('/api/documents/types');
  const result = await response.json();
  if (!result.success) return [];
  return result.data;
}

async function fetchDocumentStatistics(): Promise<{
  totalDocuments: number;
  byStatus: Record<DocumentStatus, number>;
  pendingApprovals: number;
  reviewsDueSoon: number;
}> {
  // This would be a real API call in production
  return {
    totalDocuments: 0,
    byStatus: { draft: 0, active: 0, obsolete: 0, archived: 0 },
    pendingApprovals: 0,
    reviewsDueSoon: 0,
  };
}

async function fetchPendingApprovals(): Promise<PendingApproval[]> {
  const response = await fetch('/api/documents/approvals');
  const result = await response.json();
  if (!result.success) return [];
  return result.data;
}

// ============================================
// Component
// ============================================

export default function GmpDocumentsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<number | undefined>(undefined);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);

  // Fetch document types for filter
  const { data: documentTypes } = useQuery({
    queryKey: ['document-types'],
    queryFn: fetchDocumentTypes,
  });

  // Fetch statistics
  const { data: stats } = useQuery({
    queryKey: ['document-statistics'],
    queryFn: fetchDocumentStatistics,
  });

  // Fetch pending approvals
  const { data: pendingApprovals, refetch: refetchApprovals } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: fetchPendingApprovals,
  });

  // Handlers
  const handleDocumentSelect = (document: Document) => {
    router.push(`/gmp/documents/${document.id}`);
  };

  const handleNewDocument = () => {
    router.push('/gmp/documents/new');
  };

  const handleApprovalSelect = (approval: PendingApproval) => {
    setSelectedApproval(approval);
    setApprovalDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title="GMP Document Control"
        subtitle="Manage controlled documents, versions, and approvals (หมวด 5)"
        actions={
          <DxButton
            text="New Document"
            icon="add"
            type="success"
            onClick={handleNewDocument}
          />
        }
      />

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Documents"
          value={stats?.totalDocuments || 0}
          icon={FileText}
          iconColor="text-blue-500"
        />
        <StatCard
          label="Draft"
          value={stats?.byStatus.draft || 0}
          icon={Clock}
          iconColor="text-yellow-500"
        />
        <StatCard
          label="Pending Approvals"
          value={pendingApprovals?.length || 0}
          icon={Bell}
          iconColor={pendingApprovals && pendingApprovals.length > 0 ? 'text-yellow-500' : 'text-gray-500'}
        />
        <StatCard
          label="Reviews Due Soon"
          value={stats?.reviewsDueSoon || 0}
          icon={AlertCircle}
          iconColor={stats?.reviewsDueSoon && stats.reviewsDueSoon > 0 ? 'text-red-500' : 'text-gray-500'}
        />
      </div>

      {/* Pending Approvals Section */}
      {pendingApprovals && pendingApprovals.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-3 flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Documents Awaiting Your Approval ({pendingApprovals.length})
          </h3>
          <div className="space-y-2">
            {pendingApprovals.slice(0, 3).map((approval) => (
              <div
                key={approval.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-md cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => handleApprovalSelect(approval)}
              >
                <div>
                  <p className="font-medium text-sm">{approval.documentTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {approval.documentNumber} - Version {approval.versionNumber}
                  </p>
                </div>
                <span className="text-xs text-yellow-600 dark:text-yellow-400">
                  Review as {approval.approvalRole}
                </span>
              </div>
            ))}
            {pendingApprovals.length > 3 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                +{pendingApprovals.length - 3} more pending approvals
              </p>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Status:</label>
          <DxSelectBox
            items={[
              { value: null, label: 'All Statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'active', label: 'Active' },
              { value: 'obsolete', label: 'Obsolete' },
              { value: 'archived', label: 'Archived' },
            ]}
            value={statusFilter || null}
            valueExpr="value"
            displayExpr="label"
            onValueChange={(value) => setStatusFilter(value as DocumentStatus | undefined)}
            width={150}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Type:</label>
          <DxSelectBox
            items={[
              { value: null, label: 'All Types' },
              ...(documentTypes || []).map((t) => ({
                value: t.id,
                label: t.name,
              })),
            ]}
            value={typeFilter || null}
            valueExpr="value"
            displayExpr="label"
            onValueChange={(value) => setTypeFilter(value || undefined)}
            width={200}
          />
        </div>
      </div>

      {/* Document List */}
      <DocumentList
        status={statusFilter}
        typeId={typeFilter}
        onDocumentSelect={handleDocumentSelect}
        onNewDocument={handleNewDocument}
      />

      {/* Approval Dialog */}
      <DocumentApprovalDialog
        approval={selectedApproval}
        open={approvalDialogOpen}
        onClose={() => {
          setApprovalDialogOpen(false);
          setSelectedApproval(null);
        }}
        onSuccess={() => {
          refetchApprovals();
        }}
      />
    </div>
  );
}
