'use client';

/**
 * GMP Document Detail Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * Modern redesigned page for viewing and managing a specific GMP document.
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DocumentFormDialog, DocumentVersionHistory, DocumentViewer } from '@/components/documents';
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
  Maximize2,
  Minimize2,
  History,
  Edit3,
  Plus,
  Send,
  Eye,
  ExternalLink,
  Info,
  CheckCircle2,
  AlertCircle,
  FileIcon,
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
  data: {
    content?: string;
    changeDescription?: string;
    isMajorRevision?: boolean;
    fileData?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  }
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
// Status Color Mapping
// ============================================

const statusConfig: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  draft: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', icon: <Edit3 className="h-3.5 w-3.5" /> },
  active: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  obsolete: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: <AlertCircle className="h-3.5 w-3.5" /> },
  archived: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', icon: <FileIcon className="h-3.5 w-3.5" /> },
};

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
  const [showVersionPanel, setShowVersionPanel] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    mutationFn: (data: {
      content?: string;
      changeDescription?: string;
      isMajorRevision?: boolean;
      fileData?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
    }) => createVersion(documentId, data),
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
    let fileData: string | undefined;
    let fileName: string | undefined;
    let fileSize: number | undefined;
    let mimeType: string | undefined;

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
        // Get file data for database storage
        fileData = result.data.fileData;
        fileName = result.data.fileName;
        fileSize = result.data.fileSize;
        mimeType = result.data.mimeType;
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
      fileData,
      fileName,
      fileSize,
      mimeType,
    });
  };

  // Get file download URL (from database BLOB)
  const getFileDownloadUrl = (versionId: number, inline = false) => {
    return `/api/documents/versions/${versionId}/download${inline ? '?inline=1' : ''}`;
  };

  // Check if version has file (either in DB or legacy filesystem)
  const hasFile = (version: DocumentVersion | null) => {
    return version?.hasFileData || version?.filePath;
  };

  // Get display filename
  const getDisplayFileName = (version: DocumentVersion | null) => {
    if (version?.fileName) return version.fileName;
    if (version?.filePath) return version.filePath.split('/').pop() || 'document';
    return 'document';
  };

  // Get file extension
  const getFileExtension = (version: DocumentVersion | null) => {
    const fileName = getDisplayFileName(version);
    return fileName.split('.').pop()?.toUpperCase() || '';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto py-8 px-4">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-white/50 dark:bg-slate-800/50 rounded-xl w-1/3" />
            <div className="h-[600px] bg-white/50 dark:bg-slate-800/50 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Failed to Load Document</h2>
          <p className="text-muted-foreground mb-6">The document could not be found or an error occurred.</p>
          <button
            onClick={() => router.push('/gmp/documents')}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all"
          >
            Back to Documents
          </button>
        </div>
      </div>
    );
  }

  const canEdit = document.status === 'draft';
  const canCreateVersion = document.status === 'active' || document.status === 'draft';
  const hasDraftVersion = document.currentVersion?.status === 'draft';
  const config = statusConfig[document.status] || statusConfig.draft;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-700">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Left: Back & Title */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/gmp/documents')}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex h-10 w-10 items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold text-lg leading-tight truncate max-w-[300px] lg:max-w-[500px]">
                    {document.title}
                  </h1>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-mono">{document.documentNumber}</span>
                    <span className="hidden sm:inline">•</span>
                    <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
                      {config.icon}
                      {document.status.charAt(0).toUpperCase() + document.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowVersionPanel(!showVersionPanel)}
                className={`p-2.5 rounded-lg transition-all ${showVersionPanel ? 'bg-primary text-primary-foreground' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                title="Toggle Version History"
              >
                <History className="h-4 w-4" />
              </button>
              {canEdit && (
                <button
                  onClick={() => setShowEditForm(true)}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </button>
              )}
              {canCreateVersion && (
                <button
                  onClick={() => setShowNewVersionDialog(true)}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  <Plus className="h-4 w-4" />
                  New Version
                </button>
              )}
              {hasDraftVersion && (
                <button
                  onClick={() => setShowSubmitDialog(true)}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                >
                  <Send className="h-4 w-4" />
                  Submit
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="container mx-auto px-4 py-6">
        <div className={`flex gap-6 ${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-slate-900 p-4' : ''}`}>
          {/* Main Content */}
          <div className={`flex-1 space-y-6 ${showVersionPanel && !isFullscreen ? 'lg:pr-80' : ''}`}>
            {/* Document Info Cards */}
            {!isFullscreen && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Building className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Document Type</p>
                      <p className="font-medium text-sm">{document.typeName}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <User className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Created By</p>
                      <p className="font-medium text-sm">{document.createdByName}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                      <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Created Date</p>
                      <p className="font-medium text-sm">
                        {new Date(document.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                      <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Retention</p>
                      <p className="font-medium text-sm">{document.retentionYears} years</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Version Info Banner */}
            {selectedVersion && !isFullscreen && (
              <div className={`rounded-xl p-4 border ${!isViewingLatest ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${!isViewingLatest ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                      <Eye className={`h-5 w-5 ${!isViewingLatest ? 'text-amber-600' : 'text-blue-600'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Version {selectedVersion.versionNumber}</span>
                        {isViewingLatest && selectedVersion.id === document.currentVersionId && (
                          <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-full">
                            Current
                          </span>
                        )}
                        {!isViewingLatest && (
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-full">
                            Historical
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selectedVersion.createdByName || 'Unknown'} • {new Date(selectedVersion.createdAt).toLocaleDateString('th-TH')}
                      </p>
                    </div>
                  </div>
                  <WorkflowStatusBadge status={selectedVersion.status} />
                </div>
                {selectedVersion.changeDescription && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-sm">
                      <span className="font-medium">Changes:</span> {selectedVersion.changeDescription}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* PDF Viewer / Document Content */}
            <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden ${isFullscreen ? 'h-full flex flex-col' : ''}`}>
              {/* Viewer Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="font-medium">
                    {hasFile(selectedVersion) ? getDisplayFileName(selectedVersion) : 'Document Content'}
                  </span>
                  {hasFile(selectedVersion) && (
                    <span className="text-xs text-muted-foreground px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">
                      {getFileExtension(selectedVersion)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasFile(selectedVersion) && selectedVersion && (
                    <>
                      <a
                        href={getFileDownloadUrl(selectedVersion.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </a>
                      {getDisplayFileName(selectedVersion).toLowerCase().endsWith('.pdf') && (
                        <a
                          href={getFileDownloadUrl(selectedVersion.id, true)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          title="Open in new tab"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                  >
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Content Area */}
              <div className={`${isFullscreen ? 'flex-1' : ''}`}>
                {/* Document Viewer for all supported file types */}
                {hasFile(selectedVersion) && selectedVersion && (
                  <DocumentViewer
                    fileUrl={getFileDownloadUrl(selectedVersion.id)}
                    fileName={getDisplayFileName(selectedVersion)}
                    className={isFullscreen ? 'h-full' : 'h-[calc(100vh-320px)] min-h-[600px]'}
                  />
                )}

                {/* Text Content */}
                {!hasFile(selectedVersion) && selectedVersion?.content && (
                  <div className="p-6">
                    <pre className="whitespace-pre-wrap text-sm font-mono bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                      {selectedVersion.content}
                    </pre>
                  </div>
                )}

                {/* No Content */}
                {!hasFile(selectedVersion) && !selectedVersion?.content && (
                  <div className="flex flex-col items-center justify-center py-20 px-8">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mb-6">
                      <Info className="h-10 w-10 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Content Available</h3>
                    <p className="text-muted-foreground text-center max-w-md">
                      This version does not have any content or attached files.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Approval Chain */}
            {selectedVersion?.approvals && selectedVersion.approvals.length > 0 && !isFullscreen && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
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

          {/* Version History Sidebar */}
          {showVersionPanel && !isFullscreen && (
            <div className="hidden lg:block fixed right-4 top-24 w-72 max-h-[calc(100vh-120px)] overflow-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Version History
                  </h3>
                  <button
                    onClick={() => setShowVersionPanel(false)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <DocumentVersionHistory
                  documentId={documentId}
                  currentVersionId={document.currentVersionId || undefined}
                  selectedVersionId={selectedVersionId || undefined}
                  onVersionSelect={handleVersionSelect}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Actions FAB */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 sm:hidden z-40">
        {canCreateVersion && (
          <button
            onClick={() => setShowNewVersionDialog(true)}
            className="w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/30 flex items-center justify-center"
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
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
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 hover:border-primary/50 transition-colors">
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
                    className={`p-3 border rounded-xl text-sm font-medium transition-all ${
                      pendingStatus === status
                        ? 'border-primary bg-primary/10 text-primary shadow-lg shadow-primary/10'
                        : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
            </div>
          </div>
          {pendingStatus && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
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
