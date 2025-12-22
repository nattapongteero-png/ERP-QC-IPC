'use client';

/**
 * Document List Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * Displays GMP documents in a DataGrid with filtering, search, and actions.
 */

import { DxDataGrid, type DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import { useQuery } from '@tanstack/react-query';
import { FileText, Eye } from 'lucide-react';
import type { DataGridTypes } from 'devextreme-react/data-grid';
import type { Document, DocumentStatus, DocumentType } from '@/types/documents';

// ============================================
// Types
// ============================================

interface DocumentListProps {
  onDocumentSelect?: (document: Document) => void;
  onNewDocument?: () => void;
  status?: DocumentStatus;
  typeId?: number;
  departmentId?: number;
}

// ============================================
// API Functions
// ============================================

async function fetchDocuments(params: {
  page?: number;
  limit?: number;
  status?: DocumentStatus;
  typeId?: number;
  departmentId?: number;
  search?: string;
}): Promise<{ documents: Document[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.status) searchParams.set('status', params.status);
  if (params.typeId) searchParams.set('typeId', String(params.typeId));
  if (params.departmentId) searchParams.set('departmentId', String(params.departmentId));
  if (params.search) searchParams.set('search', params.search);

  const response = await fetch(`/api/documents?${searchParams}`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch documents');
  }
  return result.data;
}

async function fetchDocumentTypes(): Promise<DocumentType[]> {
  const response = await fetch('/api/documents/types');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch document types');
  }
  return result.data;
}

// ============================================
// Component
// ============================================

export function DocumentList({
  onDocumentSelect,
  onNewDocument,
  status,
  typeId,
  departmentId,
}: DocumentListProps) {
  // Fetch documents
  const {
    data: documentsData,
    isLoading: isLoadingDocuments,
    refetch: refetchDocuments,
  } = useQuery({
    queryKey: ['documents', { status, typeId, departmentId }],
    queryFn: () => fetchDocuments({ status, typeId, departmentId, limit: 100 }),
  });

  // Fetch document types for filter
  const { data: documentTypes } = useQuery({
    queryKey: ['document-types'],
    queryFn: fetchDocumentTypes,
  });

  // Column definitions
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'documentNumber',
      caption: 'Document No.',
      width: 140,
      cellRender: (data: { row?: { data?: Document } }) => {
        const doc = data.row?.data;
        if (!doc) return null;
        return (
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="font-mono text-sm">{doc.documentNumber}</span>
          </div>
        );
      },
    },
    {
      dataField: 'title',
      caption: 'Title',
      minWidth: 250,
    },
    {
      dataField: 'typeName',
      caption: 'Type',
      width: 180,
    },
    {
      dataField: 'departmentName',
      caption: 'Department',
      width: 150,
    },
    {
      dataField: 'currentVersionNumber',
      caption: 'Version',
      width: 80,
      alignment: 'center',
    },
    {
      dataField: 'status',
      caption: 'Status',
      width: 120,
      cellRender: (data: { value?: DocumentStatus }) => {
        if (!data.value) return null;
        return <WorkflowStatusBadge status={data.value} />;
      },
    },
    {
      dataField: 'createdByName',
      caption: 'Created By',
      width: 130,
    },
    {
      dataField: 'updatedAt',
      caption: 'Last Updated',
      width: 160,
      dataType: 'datetime',
      format: 'dd/MM/yyyy HH:mm',
      sortOrder: 'desc',
    },
    {
      caption: 'Actions',
      width: 100,
      cellRender: (data: { row?: { data?: Document } }) => {
        const doc = data.row?.data;
        if (!doc) return null;
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDocumentSelect?.(doc);
              }}
              className="p-1.5 hover:bg-muted rounded-md transition-colors"
              title="View document"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  // Handle row click
  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data) {
      onDocumentSelect?.(e.data as Document);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">GMP Documents</h2>
        <div className="flex items-center gap-2">
          <DxButton
            text="Refresh"
            icon="refresh"
            onClick={() => refetchDocuments()}
            stylingMode="outlined"
          />
          {onNewDocument && (
            <DxButton
              text="New Document"
              icon="add"
              onClick={onNewDocument}
              type="success"
            />
          )}
        </div>
      </div>

      {/* DataGrid */}
      <DxDataGrid
        dataSource={documentsData?.documents || []}
        columns={columns}
        keyExpr="id"
        loading={isLoadingDocuments}
        height={600}
        paging
        pageSize={20}
        sorting
        columnChooser
        noDataText="No documents found"
        onRowClick={handleRowClick}
      />
    </div>
  );
}
