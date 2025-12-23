'use client';

/**
 * GMP Document Detail Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * Page for viewing and managing a specific GMP document.
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DocumentFormDialog, DocumentVersionHistory } from '@/components/documents';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import { ApprovalChain } from '@/components/shared/ApprovalChain';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextArea } from '@/components/ui/dx-text-area';
import {
  FileText,
  Clock,
  User,
  Building,
  Calendar,
  Upload,
  Download,
  X,
} from 'lucide-react';
import type {
  DocumentDetails,
  DocumentVersion,
  DocumentStatus,
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

async function updateDocumentStatus(
  documentId: number,
  status: DocumentStatus
): Promise<void> {
  const response = await fetch(`/api/documents/${documentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to update status');
  }
}

// ============================================
// Component
// ============================================

export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = Number(params.id);

  // State
  const [showEditForm, setShowEditForm] = useState(false);
  const [showNewVersionDialog, setShowNewVersionDialog] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [newVersionContent, setNewVersionContent] = useState('');
  const [newVersionDescription, setNewVersionDescription] = useState('');
  const [isMajorRevision, setIsMajorRevision] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<DocumentStatus | null>(null);

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
    mutationFn: (data: { content?: string; changeDescription?: string; isMajorRevision?: boolean; filePath?: string }) =>
      createVersion(documentId, data),
    onSuccess: () => {
      setShowNewVersionDialog(false);
      setNewVersionContent('');
      setNewVersionDescription('');
      setIsMajorRevision(false);
      setSelectedFile(null);
      refetch();
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: (status: DocumentStatus) => updateDocumentStatus(documentId, status),
    onSuccess: () => {
      setShowStatusDialog(false);
      setPendingStatus(null);
      refetch();
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : 'Failed to update status');
    },
  });

  // Set default selected version to latest when document loads
  useEffect(() => {
    if (document?.versions && document.versions.length > 0 && selectedVersionId === null) {
      // Default to the latest version (first in sorted list, or currentVersion)
      const latestVersion = document.versions[0];
      setSelectedVersionId(latestVersion.id);
    }
  }, [document?.versions, selectedVersionId]);

  // Get the selected version data
  const selectedVersion = useMemo(() => {
    if (!document?.versions || selectedVersionId === null) {
      return document?.currentVersion || null;
    }
    return document.versions.find(v => v.id === selectedVersionId) || document.currentVersion || null;
  }, [document?.versions, document?.currentVersion, selectedVersionId]);

  // Check if viewing the current/latest version
  const isViewingLatest = selectedVersion?.id === document?.currentVersionId ||
    (document?.versions && document.versions.length > 0 && selectedVersion?.id === document.versions[0].id);

  // Handle version select from history
  const handleVersionSelect = (version: DocumentVersion) => {
    setSelectedVersionId(version.id);
  };

  // Handle new version creation
  const handleCreateVersion = async () => {
    let filePath: string | undefined;

    // Upload file if selected
    if (selectedFile) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('documentId', String(documentId));

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to upload file');
        }
        filePath = result.data.filePath;
      } catch (error) {
        console.error('File upload failed:', error);
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    createVersionMutation.mutate({
      content: newVersionContent || undefined,
      changeDescription: newVersionDescription || undefined,
      isMajorRevision,
      filePath,
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
              <div className="flex items-center gap-2">
                <WorkflowStatusBadge status={document.status} />
                <button
                  onClick={() => setShowStatusDialog(true)}
                  className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                  title="Change Status"
                >
                  Change
                </button>
              </div>
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
              {selectedVersion && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>
                    Viewing: Version {selectedVersion.versionNumber} ({selectedVersion.status})
                    {!isViewingLatest && ' - Historical'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Version Preview Header */}
          {selectedVersion && (
            <div className={`bg-card border rounded-lg shadow-sm p-4 ${!isViewingLatest ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${!isViewingLatest ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-primary/10'}`}>
                    <FileText className={`h-5 w-5 ${!isViewingLatest ? 'text-amber-600' : 'text-primary'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      Version {selectedVersion.versionNumber}
                      {!isViewingLatest && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full">
                          Historical Version
                        </span>
                      )}
                      {isViewingLatest && selectedVersion.id === document.currentVersionId && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded-full">
                          Current
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Created by {selectedVersion.createdByName || 'Unknown'} on{' '}
                      {new Date(selectedVersion.createdAt).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <WorkflowStatusBadge status={selectedVersion.status} />
              </div>
              {selectedVersion.changeDescription && (
                <p className="mt-3 text-sm text-muted-foreground border-t pt-3">
                  <span className="font-medium">Change Notes:</span> {selectedVersion.changeDescription}
                </p>
              )}
            </div>
          )}

          {/* Selected Version Content */}
          {selectedVersion?.content && (
            <div className="bg-card border rounded-lg shadow-sm p-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Document Content
              </h3>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <pre className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-lg">
                  {selectedVersion.content}
                </pre>
              </div>
            </div>
          )}

          {/* Attached File with Inline Preview */}
          {selectedVersion?.filePath && (
            <div className="bg-card border rounded-lg shadow-sm p-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Attached File
              </h3>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg mb-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">
                      {selectedVersion.filePath.split('/').pop()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Version {selectedVersion.versionNumber}
                    </p>
                  </div>
                </div>
                <a
                  href={`/api/documents/download/${selectedVersion.filePath.replace('data/', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </div>

              {/* Inline PDF Preview */}
              {selectedVersion.filePath.toLowerCase().endsWith('.pdf') && (
                <div className="border rounded-lg overflow-hidden">
                  <iframe
                    src={`/api/documents/download/${selectedVersion.filePath.replace('data/', '')}?inline=1`}
                    className="w-full h-[600px] bg-gray-100"
                    title={`Preview: ${selectedVersion.filePath.split('/').pop()}`}
                  />
                </div>
              )}

              {/* Non-PDF file notice */}
              {!selectedVersion.filePath.toLowerCase().endsWith('.pdf') && (
                <div className="p-4 bg-muted/30 border border-dashed rounded-lg text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Preview not available for this file type.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Please download the file to view its contents.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Selected Version Approvals */}
          {selectedVersion?.approvals &&
            selectedVersion.approvals.length > 0 && (
              <div className="bg-card border rounded-lg shadow-sm p-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                  Approval Status
                </h3>
                <ApprovalChain
                  steps={selectedVersion.approvals.map((a) => ({
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
              selectedVersionId={selectedVersionId || undefined}
              onVersionSelect={handleVersionSelect}
            />
          </div>
        </div>
      </div>

      {/* Edit Document Dialog */}
      <DocumentFormDialog
        open={showEditForm}
        onOpenChange={setShowEditForm}
        document={document}
        onSave={() => {
          refetch();
        }}
      />

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

          {/* File Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Attach File (Optional)</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              {selectedFile ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm">{selectedFile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="p-1 hover:bg-muted rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 cursor-pointer">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Click to upload or drag and drop
                  </span>
                  <span className="text-xs text-muted-foreground">
                    PDF, DOC, DOCX, XLS, XLSX (max 10MB)
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 10 * 1024 * 1024) {
                          alert('File size must be less than 10MB');
                          return;
                        }
                        setSelectedFile(file);
                      }
                    }}
                  />
                </label>
              )}
            </div>
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
              onClick={() => {
                setShowNewVersionDialog(false);
                setSelectedFile(null);
              }}
              stylingMode="outlined"
              disabled={isUploading || createVersionMutation.isPending}
            />
            <DxButton
              text={isUploading ? 'Uploading...' : 'Create Version'}
              icon={isUploading ? undefined : 'add'}
              onClick={handleCreateVersion}
              type="success"
              disabled={isUploading || createVersionMutation.isPending}
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
            approval based on the document type&apos;s approval chain.
          </p>
          <p className="text-sm">
            Required approvers will be notified and the version status will change
            to &quot;Pending Approval&quot;.
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

      {/* Change Status Dialog */}
      <DxPopup
        visible={showStatusDialog}
        onHiding={() => {
          setShowStatusDialog(false);
          setPendingStatus(null);
        }}
        title="Change Document Status"
        width={400}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Current status: <span className="font-medium">{document.status}</span>
          </p>
          <div className="space-y-2">
            <label className="text-sm font-medium">New Status</label>
            <div className="grid grid-cols-2 gap-2">
              {(['draft', 'active', 'obsolete', 'archived'] as DocumentStatus[])
                .filter((s) => s !== document.status)
                .map((status) => (
                  <button
                    key={status}
                    onClick={() => setPendingStatus(status)}
                    className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                      pendingStatus === status
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 hover:border-primary/50'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
            </div>
          </div>
          {pendingStatus && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {pendingStatus === 'active' && 'This will mark the document as active and make the current version effective.'}
                {pendingStatus === 'draft' && 'This will revert the document to draft status.'}
                {pendingStatus === 'obsolete' && 'This will mark the document as obsolete and supersede all versions.'}
                {pendingStatus === 'archived' && 'This will archive the document for historical reference only.'}
              </p>
            </div>
          )}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <DxButton
              text="Cancel"
              onClick={() => {
                setShowStatusDialog(false);
                setPendingStatus(null);
              }}
              stylingMode="outlined"
              disabled={updateStatusMutation.isPending}
            />
            <DxButton
              text={updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
              onClick={() => {
                if (pendingStatus) {
                  updateStatusMutation.mutate(pendingStatus);
                }
              }}
              type="success"
              disabled={!pendingStatus || updateStatusMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
