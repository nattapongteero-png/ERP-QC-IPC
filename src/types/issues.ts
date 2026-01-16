// Issue Tracker Types

// Enums
export type IssueSeverity = 'critical' | 'major' | 'minor';
export type IssuePriority = 'immediate' | 'urgent' | 'scheduled' | 'backlog';
export type IssueStatus = 'draft' | 'submitted' | 'triaged' | 'in_progress' | 'resolved' | 'verified' | 'closed';
export type IssueCategoryType = 'software' | 'operational';
export type IssueAuditEventType =
  | 'created' | 'edited' | 'status_changed' | 'assigned'
  | 'priority_changed' | 'severity_changed' | 'commented'
  | 'merged' | 'attachment_added' | 'attachment_removed';
export type IssueNotificationType =
  | 'assigned' | 'mentioned' | 'status_changed'
  | 'commented' | 'merged' | 'priority_changed';

// Structured description for issues
export interface IssueDescription {
  summary: string;
  impact?: string;
  environment?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  stepsToReproduce?: string;
}

// Core entities
export interface Issue {
  id: number;
  issueNumber: string;
  title: string;
  description: IssueDescription;
  categoryId: number | null;
  severity: IssueSeverity;
  priority: IssuePriority | null;
  status: IssueStatus;
  reporterId: number;
  assigneeId: number | null;
  aiValidationPassed: boolean;
  aiValidationSkipped: boolean;
  duplicateOfId: number | null;
  resolvedAt: string | null;
  verifiedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  category?: IssueCategory;
  reporter?: { id: number; name: string; email: string };
  assignee?: { id: number; name: string; email: string };
  duplicateOf?: Issue;
  tags?: IssueTag[];
  attachmentCount?: number;
  commentCount?: number;
}

export interface IssueCategory {
  id: number;
  name: string;
  description: string | null;
  type: IssueCategoryType;
  requiredFields: string[];
  aiPrompt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Computed
  issueCount?: number;
}

export interface IssueComment {
  id: number;
  issueId: number;
  authorId: number;
  content: string;
  mentionedUserIds: number[];
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations
  author?: { id: number; name: string; email: string };
  attachments?: IssueAttachment[];
  attachmentCount?: number;
}

export interface IssueAttachment {
  id: number;
  issueId: number | null;
  commentId: number | null;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedById: number;
  isDeleted: boolean;
  createdAt: string;
  // Relations
  uploadedBy?: { id: number; name: string };
}

export interface IssueTag {
  id: number;
  name: string;
  color: string;
  createdAt: string;
}

export interface IssueAuditEvent {
  id: number;
  issueId: number;
  eventType: IssueAuditEventType;
  actorId: number;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  createdAt: string;
  // Relations
  actor?: { id: number; name: string };
}

export interface IssueNotification {
  id: number;
  userId: number;
  issueId: number;
  type: IssueNotificationType;
  message: string;
  isRead: boolean;
  emailSent: boolean;
  createdAt: string;
  // Relations
  issue?: { id: number; issueNumber: string; title: string };
}

// Create/Update types
export interface IssueCreate {
  title: string;
  description: IssueDescription;
  categoryId: number;
  severity: IssueSeverity;
  tagIds?: number[];
}

export interface IssueUpdate {
  title?: string;
  description?: IssueDescription;
  categoryId?: number;
  severity?: IssueSeverity;
  priority?: IssuePriority;
  status?: IssueStatus;
  assigneeId?: number | null;
  tagIds?: number[];
}

export interface IssueCategoryCreate {
  name: string;
  description?: string;
  type: IssueCategoryType;
  requiredFields?: string[];
  aiPrompt?: string;
}

export interface IssueCategoryUpdate {
  name?: string;
  description?: string;
  type?: IssueCategoryType;
  requiredFields?: string[];
  aiPrompt?: string;
  isActive?: boolean;
}

export interface IssueCommentCreate {
  content: string;
}

export interface IssueCommentUpdate {
  content: string;
}

export interface IssueTagCreate {
  name: string;
  color: string;
}

// Filter types
export interface IssueListFilters {
  status?: IssueStatus;
  severity?: IssueSeverity;
  priority?: IssuePriority;
  categoryId?: number;
  assigneeId?: number;
  reporterId?: number;
  tagIds?: number[];
  search?: string;
  page?: number;
  limit?: number;
}

// AI Validation types
export interface AIValidationResult {
  pass: boolean;
  missingItems: string[];
  feedback: Array<{
    field: string;
    issue: string;
    suggestion: string;
  }>;
  followUpQuestions: string[];
  aiUnavailable?: boolean;
}

export interface AIDuplicateResult {
  potentialDuplicates: Array<{
    issueId: number;
    issueNumber: string;
    title: string;
    similarity: number;
    reason: string;
  }>;
  aiUnavailable?: boolean;
}

// Dashboard metrics
export interface IssueDashboardMetrics {
  totalIssues: number;
  openIssues: number;
  resolvedIssues: number;
  closedIssues: number;
  issuesBySeverity: Array<{ severity: string; count: number }>;
  issuesByStatus: Array<{ status: string; count: number }>;
  issuesByCategory: Array<{ categoryId: number; categoryName: string; count: number }>;
  issuesByPriority: Array<{ priority: string; count: number }>;
  recentIssues: Issue[];
  monthlyTrend: Array<{ month: string; created: number; resolved: number }>;
  avgResolutionTime: number; // in hours
  issuesCreatedThisWeek: number;
  issuesResolvedThisWeek: number;
}
