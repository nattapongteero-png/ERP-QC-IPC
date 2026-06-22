'use client';

/**
 * GMP Document Detail Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * Professional document viewer with embedded preview and version management.
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DocumentFormDialog, DocumentVersionHistory } from '@/components/documents';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import { ApprovalChain } from '@/components/shared/ApprovalChain';
import { StatusStepper } from '@/components/shared';
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
// Helper Functions
// ============================================

// Maps document status -> i18n key (relative to 'gmp' namespace), resolved via t() at call sites.
const statusLabelKeys: Record<string, string> = {
  draft: 'documents.detail.statusLabels.draft',
  active: 'documents.detail.statusLabels.active',
  obsolete: 'documents.detail.statusLabels.obsolete',
  archived: 'documents.detail.statusLabels.archived',
};

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

// Returns the i18n key (relative to 'gmp' namespace) for a file type label.
function getFileTypeLabelKey(extension: string): string {
  switch (extension) {
    case 'pdf':
      return 'documents.detail.fileType.pdf';
    case 'doc':
      return 'documents.detail.fileType.doc';
    case 'docx':
      return 'documents.detail.fileType.docx';
    case 'xls':
      return 'documents.detail.fileType.xls';
    case 'xlsx':
      return 'documents.detail.fileType.xlsx';
    default:
      return 'documents.detail.fileType.generic';
  }
}

// ============================================
// Document Preview Component
// ============================================

function DocumentPreview({
  versionId,
  filePath,
  fileName,
  versionNumber,
  isFullscreen,
  onToggleFullscreen,
}: {
  versionId: number;
  filePath: string;
  fileName: string;
  versionNumber: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const t = useTranslations('gmp');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const extension = getFileExtension(filePath);
  const basePath = `/api/documents/versions/${versionId}/file`;
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
              <p className="text-xs text-muted-foreground">{t('documents.detail.version', { number: versionNumber })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={downloadUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Download className="h-4 w-4" />
              {t('documents.detail.download')}
            </a>
            <a
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              {t('documents.detail.openInNewTab')}
            </a>
            <button
              onClick={onToggleFullscreen}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              title={isFullscreen ? t('documents.detail.exitFullscreen') : t('documents.detail.fullscreen')}
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
                <p className="mt-2 text-sm text-muted-foreground">{t('documents.detail.loadingPdf')}</p>
              </div>
            </div>
          )}
          {hasError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
              <div className="text-center p-8">
                <FileText className="h-16 w-16 text-red-500 mx-auto" />
                <h3 className="mt-4 text-lg font-semibold">{t('documents.detail.previewUnavailable')}</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                  {t('documents.detail.pdfPreviewUnavailable')}
                </p>
                <a
                  href={downloadUrl}
                  className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                >
                  <Download className="h-5 w-5" />
                  {t('documents.detail.downloadPdf')}
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
            <p className="text-xs text-muted-foreground">{t('documents.detail.version', { number: versionNumber })}</p>
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
            {t('documents.detail.download')}
          </a>
        </div>
      </div>

      {/* File Info Panel */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center p-8">
          {getFileIcon(extension)}
          <h3 className="mt-4 text-lg font-semibold">{fileName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t(getFileTypeLabelKey(extension))}</p>
          <p className="mt-4 text-xs text-muted-foreground max-w-xs">
            {t('documents.detail.fileTypePreviewUnavailable')}
          </p>
          <a
            href={downloadUrl}
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <Download className="h-5 w-5" />
            {t('documents.detail.downloadFile')}
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
  const t = useTranslations('gmp');
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <p className="font-medium text-sm">{t('documents.detail.documentContent')}</p>
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
  const t = useTranslations('gmp');
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-4 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-3">
          <Eye className="h-5 w-5 text-muted-foreground" />
          <p className="font-medium text-sm text-muted-foreground">{t('documents.detail.documentPreview')}</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center p-8">
          <div className="w-20 h-20 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-muted-foreground">{t('documents.detail.noContent')}</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs">
            {t('documents.detail.noContentDescription')}
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
  const t = useTranslations('gmp');
  const params = useParams();
  const searchParams = useSearchParams();
  const documentId = Number(params.id);

  // State
  const [showEditForm, setShowEditForm] = useState(searchParams.get('edit') === '1');
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
    mutationFn: (data: { content?: string; changeDescription?: string; isMajorRevision?: boolean; fileData?: string; fileName?: string; fileSize?: number; mimeType?: string }) =>
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
      alert(error instanceof Error ? error.message : t('documents.detail.updateStatusFailed'));
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

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <RotateCw className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">{t('documents.detail.loadingDocument')}</p>
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
          <p className="mt-2 text-destructive font-medium">{t('documents.detail.loadFailed')}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-muted rounded-md hover:bg-muted/80 transition-colors"
          >
            {t('common.goBack')}
          </button>
        </div>
      </div>
    );
  }

  const canEdit = document.status === 'draft';
  const canCreateVersion = document.status === 'active' || document.status === 'draft';
  const hasDraftVersion = document.currentVersion?.status === 'draft';
  const hasFile = !!(selectedVersion?.filePath || selectedVersion?.fileName || selectedVersion?.hasFileData);
  const fileName = selectedVersion?.fileName || selectedVersion?.filePath?.split('/').pop() || 'document';

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
              title={t('documents.title')}
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
                  {t('documents.detail.change')}
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
                {document.trainingCourseId && (
                  <>
                    <span>•</span>
                    <a
                      href={`/hr/training/courses/${document.trainingCourseId}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {document.trainingCourseName
                        ? t('documents.detail.trainingCourse', { code: document.trainingCourseCode ?? '', name: document.trainingCourseName })
                        : t('documents.detail.trainingCourseId', { id: document.trainingCourseId })}
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {canEdit && (
              <DxButton
                text={t('documents.detail.edit')}
                icon="edit"
                onClick={() => setShowEditForm(true)}
                stylingMode="outlined"
              />
            )}
            {canCreateVersion && (
              <DxButton
                text={t('documents.detail.newVersion')}
                icon="add"
                onClick={() => setShowNewVersionDialog(true)}
                stylingMode="outlined"
              />
            )}
            {hasDraftVersion && (
              <DxButton
                text={t('documents.detail.submitForApproval')}
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
                <span className="font-medium">{t('documents.detail.version', { number: selectedVersion.versionNumber })}</span>
                <WorkflowStatusBadge status={selectedVersion.status} />
                {!isViewingLatest && (
                  <span className="px-2 py-0.5 text-xs bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200 rounded-full">
                    {t('documents.detail.historical')}
                  </span>
                )}
                {isViewingLatest && selectedVersion.id === document.currentVersionId && (
                  <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                    {t('documents.detail.current')}
                  </span>
                )}
              </div>
              <span className="text-muted-foreground">
                {t('documents.detail.by')} {selectedVersion.createdByName || t('documents.detail.unknown')} •{' '}
                {new Date(selectedVersion.createdAt).toLocaleDateString('th-TH', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              {selectedVersion.effectiveDate && (
                <span className="text-green-700 dark:text-green-400 font-medium">
                  {t('documents.detail.effectiveDate')}: {new Date(selectedVersion.effectiveDate).toLocaleDateString('th-TH')}
                </span>
              )}
              {selectedVersion.changeDescription && (
                <span className="text-muted-foreground truncate max-w-md">
                  — {selectedVersion.changeDescription}
                </span>
              )}
            </div>
          </div>
        )}
      </header>

      <div className="mb-6 flex-none px-4 pt-4">
        <StatusStepper
          title={t('documents.detail.workflowTitle')}
          steps={[
            { key: 'draft', label: t('documents.detail.steps.draft') },
            { key: 'approved', label: t('documents.detail.steps.approved') },
            { key: 'active', label: t('documents.detail.steps.active') },
            { key: 'archived', label: t('documents.detail.steps.archived') },
            { key: 'obsolete', label: t('documents.detail.steps.obsolete') },
          ]}
          current={String(document.status).toLowerCase()}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document Preview Panel (Left - 2/3 width) */}
        <main className="flex-1 flex flex-col border-r overflow-hidden">
          {hasFile ? (
            <DocumentPreview
              key={selectedVersion!.id}
              versionId={selectedVersion!.id}
              filePath={selectedVersion?.filePath || selectedVersion?.fileName || 'document'}
              fileName={fileName}
              versionNumber={selectedVersion!.versionNumber}
              isFullscreen={isPreviewFullscreen}
              onToggleFullscreen={() => setIsPreviewFullscreen(!isPreviewFullscreen)}
            />
          ) : selectedVersion?.content ? (
            <TextContentPreview key={selectedVersion.id} content={selectedVersion.content} />
          ) : (
            <NoContentPlaceholder />
          )}
        </main>

        {/* Sidebar (Right - 1/3 width) */}
        <aside className="w-80 xl:w-96 flex-none overflow-y-auto bg-card">
          {/* Document Metadata */}
          <div className="p-4 border-b">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {t('documents.detail.documentDetails')}
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Building className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">{t('documents.detail.metaType')}</p>
                  <p className="font-medium">{document.typeName}</p>
                </div>
              </div>
              {document.departmentName && (
                <div className="flex items-start gap-3">
                  <Building className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">{t('documents.detail.metaDepartment')}</p>
                    <p className="font-medium">{document.departmentName}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">{t('documents.detail.metaCreatedBy')}</p>
                  <p className="font-medium">{document.createdByName || t('documents.detail.unknown')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">{t('documents.detail.metaCreatedAt')}</p>
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
                  <p className="text-muted-foreground">{t('documents.detail.metaRetention')}</p>
                  <p className="font-medium">{t('documents.detail.retentionYears', { years: document.retentionYears })}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Approval Status */}
          {selectedVersion?.approvals && selectedVersion.approvals.length > 0 && (
            <div className="p-4 border-b">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {t('documents.detail.approvalStatus')}
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
          <div className="p-4 border-b">
            <DocumentVersionHistory
              documentId={documentId}
              currentVersionId={document.currentVersionId || undefined}
              selectedVersionId={selectedVersionId || undefined}
              onVersionSelect={handleVersionSelect}
            />
          </div>

          {/* Attachments removed - file upload is handled via Create/Edit document and New Version */}
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
        title={t('documents.detail.newVersionDialog.title')}
        width={600}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('documents.detail.newVersionDialog.changeDescription')}</label>
            <DxTextArea
              value={newVersionDescription}
              onValueChange={(value) => setNewVersionDescription(value || '')}
              placeholder={t('documents.detail.newVersionDialog.changeDescriptionPlaceholder')}
              height={80}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('documents.detail.newVersionDialog.newContent')}</label>
            <DxTextArea
              value={newVersionContent}
              onValueChange={(value) => setNewVersionContent(value || '')}
              placeholder={t('documents.detail.newVersionDialog.newContentPlaceholder')}
              height={150}
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('documents.detail.newVersionDialog.attachFile')}</label>
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
                    {t('documents.detail.newVersionDialog.uploadHint')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t('documents.detail.newVersionDialog.uploadFormats')}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 10 * 1024 * 1024) {
                          alert(t('documents.detail.newVersionDialog.fileSizeError'));
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
              {t('documents.detail.newVersionDialog.majorRevision')}
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <DxButton
              text={t('common.cancel')}
              onClick={() => {
                setShowNewVersionDialog(false);
                setSelectedFile(null);
              }}
              stylingMode="outlined"
              disabled={isUploading || createVersionMutation.isPending}
            />
            <DxButton
              text={isUploading ? t('documents.detail.newVersionDialog.uploading') : t('documents.detail.newVersionDialog.createVersion')}
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
        title={t('documents.detail.submitForApproval')}
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('documents.detail.submitDialog.line1', { version: document.currentVersion?.versionNumber ?? '' })}
          </p>
          <p className="text-sm">
            {t('documents.detail.submitDialog.line2')}
          </p>
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <DxButton
              text={t('common.cancel')}
              onClick={() => setShowSubmitDialog(false)}
              stylingMode="outlined"
            />
            <DxButton
              text={t('documents.detail.submitDialog.send')}
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
        title={t('documents.detail.statusDialog.title')}
        width={400}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('documents.detail.statusDialog.currentStatus')}: <span className="font-medium">{statusLabelKeys[document.status] ? t(statusLabelKeys[document.status]) : document.status}</span>
          </p>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('documents.detail.statusDialog.newStatus')}</label>
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
                    {statusLabelKeys[status] ? t(statusLabelKeys[status]) : status}
                  </button>
                ))}
            </div>
          </div>
          {pendingStatus && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {pendingStatus === 'active' && t('documents.detail.statusDialog.warning.active')}
                {pendingStatus === 'draft' && t('documents.detail.statusDialog.warning.draft')}
                {pendingStatus === 'obsolete' && t('documents.detail.statusDialog.warning.obsolete')}
                {pendingStatus === 'archived' && t('documents.detail.statusDialog.warning.archived')}
              </p>
            </div>
          )}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <DxButton
              text={t('common.cancel')}
              onClick={() => {
                setShowStatusDialog(false);
                setPendingStatus(null);
              }}
              stylingMode="outlined"
              disabled={updateStatusMutation.isPending}
            />
            <DxButton
              text={updateStatusMutation.isPending ? t('documents.detail.statusDialog.updating') : t('documents.detail.statusDialog.updateStatus')}
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
