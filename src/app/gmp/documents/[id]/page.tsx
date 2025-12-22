'use client';

/**
 * GMP Document Detail Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * Professional document viewer with embedded preview and version management.
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DocumentFormDialog, DocumentVersionHistory } from '@/components/documents';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import { ApprovalChain } from '@/components/shared/ApprovalChain';
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
  ChevronLeft,
  Eye,
  FileSpreadsheet,
  File,
  ExternalLink,
  Maximize2,
  Minimize2,
  RotateCw,
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
// Helper Functions
// ============================================

function getFileExtension(filePath: string): string {
  return filePath.split('.').pop()?.toLowerCase() || '';
}

function getFileIcon(extension: string) {
  switch (extension) {
    case 'pdf':
      return <FileText className="h-16 w-16 text-red-500" />;
    case 'doc':
    case 'docx':
      return <FileText className="h-16 w-16 text-blue-500" />;
    case 'xls':
    case 'xlsx':
      return <FileSpreadsheet className="h-16 w-16 text-green-500" />;
    default:
      return <File className="h-16 w-16 text-gray-500" />;
  }
}

function getFileTypeLabel(extension: string): string {
  switch (extension) {
    case 'pdf':
      return 'PDF Document';
    case 'doc':
      return 'Word Document (.doc)';
    case 'docx':
      return 'Word Document (.docx)';
    case 'xls':
      return 'Excel Spreadsheet (.xls)';
    case 'xlsx':
      return 'Excel Spreadsheet (.xlsx)';
    default:
      return 'Document';
  }
}

// ============================================
// Document Preview Component
// ============================================

function DocumentPreview({
  filePath,
  fileName,
  versionNumber,
  isFullscreen,
  onToggleFullscreen,
}: {
  filePath: string;
  fileName: string;
  versionNumber: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const extension = getFileExtension(filePath);
  const basePath = `/api/documents/download/${filePath.replace('data/', '')}`;
  const downloadUrl = basePath;
  const viewUrl = `${basePath}?inline=true`;
  const isPdf = extension === 'pdf';

  if (isPdf) {
    return (
      <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'h-full'}`}>
        {/* Preview Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-red-500" />
            <div>
              <p className="font-medium text-sm">{fileName}</p>
              <p className="text-xs text-muted-foreground">Version {versionNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={downloadUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
            <a
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Open in New Tab
            </a>
            <button
              onClick={onToggleFullscreen}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 bg-gray-100 dark:bg-gray-900 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
              <div className="text-center">
                <RotateCw className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="mt-2 text-sm text-muted-foreground">Loading PDF...</p>
              </div>
            </div>
          )}
          {hasError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
              <div className="text-center p-8">
                <FileText className="h-16 w-16 text-red-500 mx-auto" />
                <h3 className="mt-4 text-lg font-semibold">Unable to Preview</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                  The PDF could not be displayed in the browser. Please download to view.
                </p>
                <a
                  href={downloadUrl}
                  className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                >
                  <Download className="h-5 w-5" />
                  Download PDF
                </a>
              </div>
            </div>
          ) : (
            <object
              data={viewUrl}
              type="application/pdf"
              className="w-full h-full"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
            >
              <embed
                src={viewUrl}
                type="application/pdf"
                className="w-full h-full"
              />
            </object>
          )}
        </div>
      </div>
    );
  }

  // Non-PDF file preview placeholder
  return (
    <div className="flex flex-col h-full">
      {/* Preview Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-3">
          {getFileIcon(extension)}
          <div>
            <p className="font-medium text-sm">{fileName}</p>
            <p className="text-xs text-muted-foreground">Version {versionNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Download className="h-4 w-4" />
            Download
          </a>
        </div>
      </div>

      {/* File Info Panel */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center p-8">
          {getFileIcon(extension)}
          <h3 className="mt-4 text-lg font-semibold">{fileName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{getFileTypeLabel(extension)}</p>
          <p className="mt-4 text-xs text-muted-foreground max-w-xs">
            Preview not available for this file type. Download the file to view its contents.
          </p>
          <a
            href={downloadUrl}
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <Download className="h-5 w-5" />
            Download File
          </a>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Text Content Preview Component
// ============================================

function TextContentPreview({ content }: { content: string }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <p className="font-medium text-sm">Document Content</p>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6 bg-white dark:bg-gray-950">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/30 p-6 rounded-lg border">
            {content}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ============================================
// No Content Placeholder
// ============================================

function NoContentPlaceholder() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-4 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-3">
          <Eye className="h-5 w-5 text-muted-foreground" />
          <p className="font-medium text-sm text-muted-foreground">Document Preview</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center p-8">
          <div className="w-20 h-20 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-muted-foreground">No Content</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs">
            This version has no attached file or text content.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Component
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
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);

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

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <RotateCw className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !document) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <FileText className="h-12 w-12 text-destructive mx-auto" />
          <p className="mt-2 text-destructive font-medium">Failed to load document</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-muted rounded-md hover:bg-muted/80 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const canEdit = document.status === 'draft';
  const canCreateVersion = document.status === 'active' || document.status === 'draft';
  const hasDraftVersion = document.currentVersion?.status === 'draft';
  const fileName = selectedVersion?.filePath?.split('/').pop() || 'document';

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Header Bar */}
      <header className="flex-none border-b bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Back button and document info */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/gmp/documents')}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              title="Back to Documents"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="border-l pl-4">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold truncate max-w-md">{document.title}</h1>
                <WorkflowStatusBadge status={document.status} />
                <button
                  onClick={() => setShowStatusDialog(true)}
                  className="text-xs px-2 py-0.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                >
                  Change
                </button>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="font-mono">{document.documentNumber}</span>
                <span>•</span>
                <span>{document.typeName}</span>
                {document.departmentName && (
                  <>
                    <span>•</span>
                    <span>{document.departmentName}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
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
                stylingMode="outlined"
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
        </div>

        {/* Version Info Bar */}
        {selectedVersion && (
          <div className={`flex items-center justify-between px-4 py-2 text-sm ${
            !isViewingLatest
              ? 'bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800'
              : 'bg-muted/30 border-t'
          }`}>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="font-medium">Version {selectedVersion.versionNumber}</span>
                <WorkflowStatusBadge status={selectedVersion.status} />
                {!isViewingLatest && (
                  <span className="px-2 py-0.5 text-xs bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200 rounded-full">
                    Historical
                  </span>
                )}
                {isViewingLatest && selectedVersion.id === document.currentVersionId && (
                  <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                    Current
                  </span>
                )}
              </div>
              <span className="text-muted-foreground">
                by {selectedVersion.createdByName || 'Unknown'} •{' '}
                {new Date(selectedVersion.createdAt).toLocaleDateString('th-TH', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              {selectedVersion.changeDescription && (
                <span className="text-muted-foreground truncate max-w-md">
                  — {selectedVersion.changeDescription}
                </span>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document Preview Panel (Left - 2/3 width) */}
        <main className="flex-1 flex flex-col border-r overflow-hidden">
          {selectedVersion?.filePath ? (
            <DocumentPreview
              filePath={selectedVersion.filePath}
              fileName={fileName}
              versionNumber={selectedVersion.versionNumber}
              isFullscreen={isPreviewFullscreen}
              onToggleFullscreen={() => setIsPreviewFullscreen(!isPreviewFullscreen)}
            />
          ) : selectedVersion?.content ? (
            <TextContentPreview content={selectedVersion.content} />
          ) : (
            <NoContentPlaceholder />
          )}
        </main>

        {/* Sidebar (Right - 1/3 width) */}
        <aside className="w-80 xl:w-96 flex-none overflow-y-auto bg-card">
          {/* Document Metadata */}
          <div className="p-4 border-b">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Document Details
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Building className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium">{document.typeName}</p>
                </div>
              </div>
              {document.departmentName && (
                <div className="flex items-start gap-3">
                  <Building className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Department</p>
                    <p className="font-medium">{document.departmentName}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Created By</p>
                  <p className="font-medium">{document.createdByName || 'Unknown'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {new Date(document.createdAt).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Retention Period</p>
                  <p className="font-medium">{document.retentionYears} years</p>
                </div>
              </div>
            </div>
          </div>

          {/* Approval Status */}
          {selectedVersion?.approvals && selectedVersion.approvals.length > 0 && (
            <div className="p-4 border-b">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Approval Status
              </h2>
              <ApprovalChain
                steps={selectedVersion.approvals.map((a) => ({
                  id: a.id,
                  role: a.approvalRole,
                  approverName: a.approverName || undefined,
                  status: a.status as 'pending' | 'approved' | 'rejected',
                  signedAt: a.signedAt || undefined,
                  comments: a.comments || undefined,
                }))}
                compact
              />
            </div>
          )}

          {/* Version History */}
          <div className="p-4">
            <DocumentVersionHistory
              documentId={documentId}
              currentVersionId={document.currentVersionId || undefined}
              selectedVersionId={selectedVersionId || undefined}
              onVersionSelect={handleVersionSelect}
            />
          </div>
        </aside>
      </div>

      {/* ============================================ */}
      {/* Dialogs */}
      {/* ============================================ */}

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
