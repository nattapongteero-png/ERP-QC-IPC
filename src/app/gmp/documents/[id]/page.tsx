'use client';

/**
 * GMP Document Detail Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * Page for viewing and managing a specific GMP document.
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DocumentForm, DocumentVersionHistory, DocumentApprovalDialog } from '@/components/documents';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import { ApprovalChain } from '@/components/shared/ApprovalChain';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextArea } from '@/components/ui/dx-text-area';
import {
  FileText,
  Edit,
  Plus,
  Send,
  Archive,
  Clock,
  User,
  Building,
  Calendar,
} from 'lucide-react';
import type {
  DocumentDetails,
  DocumentVersion,
  PendingApproval,
} from '@/types/documents';

// ============================================
// API Functions
// ============================================

async function fetchDocument(id: number): Promise<DocumentDetails> {
  const response = await fetch(`/api/documents/${id}`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch document');
  }
  return result.data;
}

async function createVersion(
  documentId: number,
  data: { content?: string; changeDescription?: string; isMajorRevision?: boolean }
): Promise<DocumentVersion> {
  const response = await fetch(`/api/documents/${documentId}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to create version');
  }
  return result.data;
}

async function submitForApproval(
  documentId: number,
  versionId: number,
  approvers: number[]
): Promise<void> {
  const response = await fetch(`/api/documents/${documentId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ versionId, approvers }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to submit for approval');
  }
}

// ============================================
// Component
// ============================================

export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const documentId = Number(params.id);

  // State
  const [showEditForm, setShowEditForm] = useState(false);
  const [showNewVersionDialog, setShowNewVersionDialog] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [newVersionContent, setNewVersionContent] = useState('');
  const [newVersionDescription, setNewVersionDescription] = useState('');
  const [isMajorRevision, setIsMajorRevision] = useState(false);

  // Fetch document
  const {
    data: document,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => fetchDocument(documentId),
    enabled: !!documentId && !isNaN(documentId),
  });

  // Create version mutation
  const createVersionMutation = useMutation({
    mutationFn: (data: { content?: string; changeDescription?: string; isMajorRevision?: boolean }) =>
      createVersion(documentId, data),
    onSuccess: () => {
      setShowNewVersionDialog(false);
      setNewVersionContent('');
      setNewVersionDescription('');
      setIsMajorRevision(false);
      refetch();
    },
  });

  // Handle version select from history
  const handleVersionSelect = (version: DocumentVersion) => {
    console.log('Selected version:', version);
    // Could show version content in a modal
  };

  // Handle new version creation
  const handleCreateVersion = () => {
    createVersionMutation.mutate({
      content: newVersionContent || undefined,
      changeDescription: newVersionDescription || undefined,
      isMajorRevision,
    });
  };

  // Loading and error states
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

  if (error || !document) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load document</p>
          <DxButton
            text="Go Back"
            onClick={() => router.back()}
            stylingMode="outlined"
          />
        </div>
      </div>
    );
  }

  const canEdit = document.status === 'draft';
  const canCreateVersion = document.status === 'active' || document.status === 'draft';
  const hasDraftVersion = document.currentVersion?.status === 'draft';

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title={document.title}
        subtitle={document.documentNumber}
        onBack={() => router.push('/gmp/documents')}
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <DxButton
                text="Edit"
                icon="edit"
                onClick={() => setShowEditForm(true)}
                stylingMode="outlined"
              />
            )}
            {canCreateVersion && (
              <DxButton
                text="New Version"
                icon="add"
                onClick={() => setShowNewVersionDialog(true)}
                type="default"
              />
            )}
            {hasDraftVersion && (
              <DxButton
                text="Submit for Approval"
                icon="upload"
                onClick={() => setShowSubmitDialog(true)}
                type="success"
              />
            )}
          </div>
        }
      />

      {/* Document Info and Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Document Details Card */}
          <div className="bg-card border rounded-lg shadow-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{document.title}</h2>
                  <p className="text-sm text-muted-foreground font-mono">
                    {document.documentNumber}
                  </p>
                </div>
              </div>
              <WorkflowStatusBadge status={document.status} />
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building className="h-4 w-4" />
                <span>Type: {document.typeName}</span>
              </div>
              {document.departmentName && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building className="h-4 w-4" />
                  <span>Department: {document.departmentName}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Created by: {document.createdByName}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  Created: {new Date(document.createdAt).toLocaleDateString('th-TH')}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Retention: {document.retentionYears} years</span>
              </div>
              {document.currentVersion && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>
                    Current Version: {document.currentVersion.versionNumber} (
                    {document.currentVersion.status})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Current Version Content */}
          {document.currentVersion?.content && (
            <div className="bg-card border rounded-lg shadow-sm p-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Document Content
              </h3>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <pre className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-lg">
                  {document.currentVersion.content}
                </pre>
              </div>
            </div>
          )}

          {/* Current Version Approvals */}
          {document.currentVersion?.approvals &&
            document.currentVersion.approvals.length > 0 && (
              <div className="bg-card border rounded-lg shadow-sm p-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                  Approval Status
                </h3>
                <ApprovalChain
                  steps={document.currentVersion.approvals.map((a) => ({
                    id: a.id,
                    role: a.approvalRole,
                    approverName: a.approverName || undefined,
                    status: a.status as 'pending' | 'approved' | 'rejected',
                    signedAt: a.signedAt || undefined,
                    comments: a.comments || undefined,
                  }))}
                />
              </div>
            )}
        </div>

        {/* Sidebar - Version History */}
        <div className="lg:col-span-1">
          <div className="bg-card border rounded-lg shadow-sm p-6 sticky top-6">
            <DocumentVersionHistory
              documentId={documentId}
              currentVersionId={document.currentVersionId || undefined}
              onVersionSelect={handleVersionSelect}
            />
          </div>
        </div>
      </div>

      {/* Edit Document Dialog */}
      <DxPopup
        visible={showEditForm}
        onHiding={() => setShowEditForm(false)}
        title="Edit Document"
        width={600}
        height="auto"
        showCloseButton
      >
        <DocumentForm
          document={document}
          onSave={() => {
            setShowEditForm(false);
            refetch();
          }}
          onCancel={() => setShowEditForm(false)}
        />
      </DxPopup>

      {/* New Version Dialog */}
      <DxPopup
        visible={showNewVersionDialog}
        onHiding={() => setShowNewVersionDialog(false)}
        title="Create New Version"
        width={600}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Change Description</label>
            <DxTextArea
              value={newVersionDescription}
              onValueChange={(value) => setNewVersionDescription(value || '')}
              placeholder="Describe what changed in this version..."
              height={80}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">New Content (Optional)</label>
            <DxTextArea
              value={newVersionContent}
              onValueChange={(value) => setNewVersionContent(value || '')}
              placeholder="Enter new document content..."
              height={150}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="majorRevision"
              checked={isMajorRevision}
              onChange={(e) => setIsMajorRevision(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="majorRevision" className="text-sm">
              Major revision (increment major version number)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <DxButton
              text="Cancel"
              onClick={() => setShowNewVersionDialog(false)}
              stylingMode="outlined"
            />
            <DxButton
              text="Create Version"
              icon="add"
              onClick={handleCreateVersion}
              type="success"
              disabled={createVersionMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>

      {/* Submit for Approval Dialog */}
      <DxPopup
        visible={showSubmitDialog}
        onHiding={() => setShowSubmitDialog(false)}
        title="Submit for Approval"
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            This will submit version {document.currentVersion?.versionNumber} for
            approval based on the document type's approval chain.
          </p>
          <p className="text-sm">
            Required approvers will be notified and the version status will change
            to "Pending Approval".
          </p>
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <DxButton
              text="Cancel"
              onClick={() => setShowSubmitDialog(false)}
              stylingMode="outlined"
            />
            <DxButton
              text="Submit"
              icon="upload"
              onClick={() => {
                // Would call submitForApproval API
                setShowSubmitDialog(false);
                refetch();
              }}
              type="success"
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
