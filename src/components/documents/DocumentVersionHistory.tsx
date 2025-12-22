'use client';

/**
 * Document Version History Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * Displays version history for a GMP document with approval status.
 */

import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import { ApprovalChain } from '@/components/shared/ApprovalChain';
import { useQuery } from '@tanstack/react-query';
import { FileText, Calendar, User, CheckCircle, XCircle, Clock, ArrowUp } from 'lucide-react';
import type { DocumentVersion, DocumentVersionStatus } from '@/types/documents';

// ============================================
// Types
// ============================================

interface DocumentVersionHistoryProps {
  documentId: number;
  currentVersionId?: number;
  selectedVersionId?: number;
  onVersionSelect?: (version: DocumentVersion) => void;
}

// ============================================
// API Functions
// ============================================

async function fetchVersionHistory(documentId: number): Promise<DocumentVersion[]> {
  const response = await fetch(`/api/documents/${documentId}/versions`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch version history');
  }
  return result.data;
}

// ============================================
// Helper Components
// ============================================

function VersionStatusIcon({ status }: { status: DocumentVersionStatus }) {
  switch (status) {
    case 'approved':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'rejected':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'pending_approval':
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case 'superseded':
      return <ArrowUp className="w-4 h-4 text-gray-400" />;
    default:
      return <FileText className="w-4 h-4 text-blue-500" />;
  }
}

// ============================================
// Component
// ============================================

export function DocumentVersionHistory({
  documentId,
  currentVersionId,
  selectedVersionId,
  onVersionSelect,
}: DocumentVersionHistoryProps) {
  // Fetch version history
  const {
    data: versions,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['document-versions', documentId],
    queryFn: () => fetchVersionHistory(documentId),
    enabled: !!documentId,
  });

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading version history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        Failed to load version history
      </div>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No versions found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Version History
      </h3>

      <div className="space-y-3">
        {versions.map((version) => {
          const isCurrent = version.id === currentVersionId;
          const isSelected = version.id === selectedVersionId;

          return (
            <div
              key={version.id}
              className={`
                p-4 rounded-lg border transition-colors cursor-pointer
                ${isSelected ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : ''}
                ${isCurrent && !isSelected ? 'border-primary/50 bg-primary/5' : ''}
                ${!isSelected && !isCurrent ? 'border-border hover:border-primary/50' : ''}
              `}
              onClick={() => onVersionSelect?.(version)}
            >
              {/* Version Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <VersionStatusIcon status={version.status} />
                  <span className="font-semibold">
                    Version {version.versionNumber}
                  </span>
                  {isSelected && (
                    <span className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded-full">
                      Viewing
                    </span>
                  )}
                  {isCurrent && !isSelected && (
                    <span className="text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded-full">
                      Current
                    </span>
                  )}
                </div>
                <WorkflowStatusBadge
                  status={version.status as 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'superseded'}
                />
              </div>

              {/* Version Details */}
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>{version.createdByName || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {new Date(version.createdAt).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {/* Change Description */}
              {version.changeDescription && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {version.changeDescription}
                </p>
              )}

              {/* Effective Date */}
              {version.effectiveDate && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Effective: {new Date(version.effectiveDate).toLocaleDateString('th-TH')}
                </div>
              )}

              {/* Approvals */}
              {version.approvals && version.approvals.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <ApprovalChain
                    steps={version.approvals.map((a) => ({
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
