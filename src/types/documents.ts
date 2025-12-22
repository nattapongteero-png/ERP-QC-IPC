// Document Control Module - TypeScript Types
// Feature: 009-gmp-compliance-gap-analysis (หมวด 5)

// ============================================
// Enums
// ============================================

export type DocumentStatus = 'draft' | 'active' | 'obsolete' | 'archived';

export type DocumentVersionStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'superseded';

export type DocumentApprovalStatus = 'pending' | 'approved' | 'rejected';

export type DocumentApprovalRole = 'author' | 'reviewer' | 'approver';

// ============================================
// Document Types (Master Data)
// ============================================

export interface DocumentType {
  id: number;
  code: string;
  name: string;
  prefix: string | null;
  approvalChain: string | null; // JSON array of required approver roles
  reviewPeriodMonths: number | null;
}

export interface DocumentTypeCreate {
  code: string;
  name: string;
  prefix?: string;
  approvalChain?: string;
  reviewPeriodMonths?: number;
}

// ============================================
// Documents
// ============================================

export interface Document {
  id: number;
  documentNumber: string;
  title: string;
  typeId: number;
  typeName?: string;
  departmentId: number | null;
  departmentName?: string;
  currentVersionId: number | null;
  currentVersionNumber?: string;
  status: DocumentStatus;
  retentionYears: number;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentCreate {
  title: string;
  typeId: number;
  departmentId?: number | null;
  content?: string;
  retentionYears?: number;
}

export interface DocumentUpdate {
  title?: string;
  departmentId?: number | null;
  status?: DocumentStatus;
}

export interface DocumentWithVersion extends Document {
  currentVersion: DocumentVersion | null;
  approvals: DocumentApproval[];
}

export interface DocumentDetails extends Document {
  typeCode?: string;
  currentVersion: DocumentVersion | null;
  versions: DocumentVersion[];
}

// ============================================
// Document Versions
// ============================================

export interface DocumentVersion {
  id: number;
  documentId: number;
  versionNumber: string;
  content: string | null;
  filePath: string | null;
  changeDescription: string | null;
  status: DocumentVersionStatus;
  effectiveDate: string | null;
  obsoleteDate: string | null;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
  approvals?: DocumentApproval[];
}

export interface DocumentVersionCreate {
  documentId: number;
  content?: string;
  filePath?: string;
  changeDescription?: string;
  isMajorRevision?: boolean;
}

export interface DocumentVersionUpdate {
  content?: string;
  filePath?: string;
  changeDescription?: string;
  status?: DocumentVersionStatus;
  effectiveDate?: string;
}

// ============================================
// Document Approvals
// ============================================

export interface DocumentApproval {
  id: number;
  versionId: number;
  approverId: number;
  approverName?: string;
  approvalRole: DocumentApprovalRole;
  status: DocumentApprovalStatus;
  comments: string | null;
  signedAt: string | null;
  delegatedFrom: number | null;
  delegatedFromName?: string;
}

export interface DocumentApprovalCreate {
  versionId: number;
  approvers: number[]; // User IDs of required approvers
}

export interface DocumentApprovalDecision {
  decision: 'approved' | 'rejected';
  comments?: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface DocumentListParams {
  status?: DocumentStatus;
  typeId?: number;
  departmentId?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
  page?: number;
  limit?: number;
}

export interface PendingApproval {
  id: number;
  documentId: number;
  documentNumber: string;
  documentTitle: string;
  versionNumber: string;
  approvalRole: DocumentApprovalRole;
  submittedAt: string;
  submittedBy: string;
}
