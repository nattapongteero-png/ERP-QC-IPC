# Issue Tracker Module Design

**Date:** 2025-01-16
**Status:** Approved
**Module:** Issue Tracker with AI-Assisted Validation

---

## Overview

An issue tracking module for the Herbal Medicine ERP that supports both software/system issues and operational/business issues. Includes AI-assisted validation to ensure high-quality submissions.

## Key Features

- Create, view, edit, and manage issues
- AI-powered validation gate (prevents low-quality submissions)
- Duplicate detection (AI-suggested + manual merge)
- Comments with rich text and @mentions
- File attachments with preview
- Full audit trail / timeline
- In-app + email notifications
- Admin-configurable validation rules per category

---

## Data Model

### Core Tables

#### `issues`
| Field | Type | Description |
|-------|------|-------------|
| id | int (PK) | Auto-increment |
| issueNumber | varchar(20) | Human-readable ID (e.g., ISS-2024-0001) |
| title | varchar(255) | Brief summary |
| description | text (JSON) | Structured: { summary, impact, environment, expectedBehavior, actualBehavior, stepsToReproduce } |
| categoryId | int (FK) | Link to issue_categories |
| severity | enum | 'critical', 'major', 'minor' |
| priority | enum | 'immediate', 'urgent', 'scheduled', 'backlog' (nullable until triaged) |
| status | enum | 'draft', 'submitted', 'triaged', 'in_progress', 'resolved', 'verified', 'closed' |
| reporterId | int (FK) | User who created |
| assigneeId | int (FK) | Assigned owner (nullable) |
| aiValidationPassed | boolean | Whether AI validated successfully |
| aiValidationSkipped | boolean | True if saved during AI outage |
| duplicateOfId | int (FK) | Parent issue if marked duplicate |
| resolvedAt | datetime | When resolved |
| verifiedAt | datetime | When verified |
| closedAt | datetime | When closed |
| createdAt | datetime | Created timestamp |
| updatedAt | datetime | Updated timestamp |

#### `issue_categories`
| Field | Type | Description |
|-------|------|-------------|
| id | int (PK) | Auto-increment |
| name | varchar(100) | Category name |
| description | text | Category description |
| type | enum | 'software', 'operational' |
| requiredFields | JSON | Array of required field names |
| aiPrompt | text | Custom validation prompt for this category |
| isActive | boolean | Enable/disable category |
| createdAt | datetime | Created timestamp |
| updatedAt | datetime | Updated timestamp |

### Supporting Tables

#### `issue_comments`
| Field | Type | Description |
|-------|------|-------------|
| id | int (PK) | Auto-increment |
| issueId | int (FK) | Parent issue |
| authorId | int (FK) | Comment author |
| content | text | Markdown-formatted text |
| mentionedUserIds | JSON | Array of @mentioned user IDs |
| isEdited | boolean | True if edited after creation |
| createdAt | datetime | Created timestamp |
| updatedAt | datetime | Updated timestamp |

#### `issue_attachments`
| Field | Type | Description |
|-------|------|-------------|
| id | int (PK) | Auto-increment |
| issueId | int (FK) | Parent issue (nullable if on comment) |
| commentId | int (FK) | Parent comment (nullable if on issue) |
| fileName | varchar(255) | Original filename |
| filePath | varchar(500) | Storage path |
| fileSize | int | Size in bytes |
| mimeType | varchar(100) | File type |
| uploadedById | int (FK) | Uploader |
| isDeleted | boolean | Soft delete flag |
| createdAt | datetime | Upload timestamp |

#### `issue_tags`
| Field | Type | Description |
|-------|------|-------------|
| id | int (PK) | Auto-increment |
| name | varchar(50) | Tag name |
| color | varchar(7) | Hex color code |
| createdAt | datetime | Created timestamp |

#### `issue_tag_links`
| Field | Type | Description |
|-------|------|-------------|
| issueId | int (FK) | Issue reference |
| tagId | int (FK) | Tag reference |

#### `issue_audit_events`
| Field | Type | Description |
|-------|------|-------------|
| id | int (PK) | Auto-increment |
| issueId | int (FK) | Related issue |
| eventType | enum | 'created', 'status_changed', 'assigned', 'priority_changed', 'severity_changed', 'commented', 'merged', 'attachment_added', 'attachment_removed', 'edited' |
| actorId | int (FK) | User who performed action |
| oldValue | JSON | Previous state |
| newValue | JSON | New state |
| createdAt | datetime | Event timestamp |

#### `issue_notifications`
| Field | Type | Description |
|-------|------|-------------|
| id | int (PK) | Auto-increment |
| userId | int (FK) | Recipient |
| issueId | int (FK) | Related issue |
| type | enum | 'assigned', 'mentioned', 'status_changed', 'commented', 'merged', 'priority_changed' |
| message | varchar(500) | Notification text |
| isRead | boolean | Read status |
| emailSent | boolean | Email delivery status |
| createdAt | datetime | Timestamp |

---

## Status Workflow

```
Draft → Submitted → Triaged → In Progress → Resolved → Verified → Closed
  ↑                                              ↓
  └──────────────── (reopen) ←──────────────────┘
```

- **Draft**: Issue saved but not yet validated/submitted
- **Submitted**: AI validation passed, awaiting admin triage
- **Triaged**: Admin assigned priority, severity, owner
- **In Progress**: Being worked on
- **Resolved**: Fix applied, awaiting verification
- **Verified**: Confirmed fixed
- **Closed**: Complete

---

## Severity & Priority (GMP-Aligned)

### Severity (set by reporter)
- **Critical**: Patient safety or regulatory impact
- **Major**: Quality impact
- **Minor**: No direct impact

### Priority (set by admin during triage)
- **Immediate**: Drop everything
- **Urgent**: Address within 24-48 hours
- **Scheduled**: Plan for next sprint/cycle
- **Backlog**: Low priority, address when possible

---

## AI Validation System

### Service Integration
- **Provider**: OpenRouter API
- **Model**: google/gemini-3-flash-preview
- **API Key**: Stored in `OPENROUTER_API_KEY` environment variable

### Validation Flow
1. User fills issue form
2. User clicks "Validate & Submit"
3. System builds category-specific validation prompt
4. Calls OpenRouter API
5. On **Pass**: Status → "submitted", proceed to triage
6. On **Fail**: Show inline feedback, user must address gaps
7. On **AI Unavailable**: Allow "Save as Draft" only

### Validation Prompt Structure
```
You are an issue quality validator. Evaluate this issue submission:

Category: {categoryName} ({categoryType})
Required fields for this category: {requiredFields}

Issue Data:
- Title: {title}
- Summary: {description.summary}
- Impact: {description.impact}
- Environment: {description.environment}
- Expected Behavior: {description.expectedBehavior}
- Actual Behavior: {description.actualBehavior}
- Steps to Reproduce: {description.stepsToReproduce}

{customCategoryPrompt}

Respond in JSON:
{
  "pass": boolean,
  "missingItems": ["field1", "field2"],
  "feedback": [
    { "field": "title", "issue": "Too vague", "suggestion": "Include the specific component or area affected" }
  ],
  "followUpQuestions": ["What error message did you see?", "..."]
}
```

### Duplicate Detection Prompt
```
Compare this new issue against existing open issues.
Return potential duplicates with similarity score (0-100).

New Issue: {title, summary}
Existing Issues: [{id, title, summary}, ...]

Respond in JSON:
{
  "potentialDuplicates": [
    { "issueId": 123, "similarity": 85, "reason": "Both describe login timeout" }
  ]
}
```

### Fallback Behavior
- 10-second timeout on API calls
- On timeout/error: Return `{ aiUnavailable: true }`
- UI: "AI validation unavailable - you can save as Draft only"

---

## File Attachments

### Configuration
```typescript
const ATTACHMENT_CONFIG = {
  maxFileSize: 10 * 1024 * 1024,  // 10MB per file
  maxFilesPerIssue: 20,
  maxFilesPerComment: 5,
  allowedTypes: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv'
  ],
};
```

### Storage Structure
```
uploads/
└── issues/
    ├── {issueId}/
    │   └── {attachmentId}-{originalName}.ext
    └── comments/
        └── {commentId}/
            └── {attachmentId}-{originalName}.ext
```

### Preview Support
- Images: Inline preview with lightbox
- PDFs: Embedded viewer
- Documents: Download link with icon

---

## Notifications

### Triggers
| Event | Recipients | In-App | Email |
|-------|-----------|--------|-------|
| Issue assigned | Assignee | Yes | Yes |
| Status changed | Reporter, Assignee | Yes | Yes |
| New comment | Reporter, Assignee, @mentioned | Yes | Yes |
| @mentioned in comment | Mentioned user | Yes | Yes |
| Issue merged (duplicate) | Reporter of closed issue | Yes | Yes |
| Priority changed to Immediate | Assignee | Yes | Yes |

### @Mention Detection
Parse `@username` patterns from markdown content, resolve to user IDs.

---

## Permissions

| Action | Reporter | Assignee | Manager | Admin |
|--------|----------|----------|---------|-------|
| Create issue | Yes | Yes | Yes | Yes |
| Edit own issue (draft) | Yes | Yes | Yes | Yes |
| Edit any issue | - | Yes (assigned) | Yes | Yes |
| Change status | - | Yes | Yes | Yes |
| Set priority | - | - | Yes | Yes |
| Assign owner | - | - | Yes | Yes |
| Merge duplicates | - | - | Yes | Yes |
| Delete issue | - | - | - | Yes |
| Manage categories | - | - | - | Yes |
| Configure validation rules | - | - | - | Yes |

### Permission Keys
```typescript
'issues:create': ['admin', 'manager', 'production', 'qc', 'warehouse', 'purchasing', 'sales', 'finance', 'accountant'],
'issues:triage': ['admin', 'manager'],
'issues:assign': ['admin', 'manager'],
'issues:manage-categories': ['admin'],
'issues:delete': ['admin'],
```

---

## UI Structure

### Pages
```
src/app/issues/
├── layout.tsx                    # MainLayout wrapper
├── page.tsx                      # Dashboard: KPIs, charts, recent issues
├── list/page.tsx                 # Issue list with filters (DataGrid)
├── new/page.tsx                  # Create issue form + AI validation
├── [id]/page.tsx                 # Issue detail + comments + timeline
└── settings/
    ├── page.tsx                  # Admin settings dashboard
    └── categories/page.tsx       # Manage categories & validation rules
```

### Components
```
src/components/issues/
├── IssueForm.tsx                 # Create/edit form
├── AiValidationFeedback.tsx      # AI feedback display
├── DuplicateSuggestions.tsx      # Potential duplicates list
├── IssueDetailHeader.tsx         # Title, status, actions
├── IssueTimeline.tsx             # Audit events + comments
├── CommentEditor.tsx             # Rich text with @mentions
├── AttachmentUploader.tsx        # Drag-drop upload
├── AttachmentPreview.tsx         # Image/PDF preview
├── StatusBadge.tsx               # Status pills
├── SeverityBadge.tsx             # Severity indicators
├── PriorityBadge.tsx             # Priority indicators
└── CategoryValidationConfig.tsx  # Admin validation config
```

### Dashboard KPIs
- Open issues by severity (pie chart)
- Issues by status (funnel chart)
- Created vs resolved trend (line chart)
- Average resolution time by category
- Top categories with most issues

---

## API Endpoints

### Issues Core
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/issues` | List issues (filters, pagination) |
| POST | `/api/issues` | Create issue |
| GET | `/api/issues/[id]` | Get issue detail |
| PUT | `/api/issues/[id]` | Update issue |
| DELETE | `/api/issues/[id]` | Delete issue (admin) |

### AI Validation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/issues/validate` | Validate issue data |
| POST | `/api/issues/duplicates` | Check for duplicates |

### Comments & Attachments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/issues/[id]/comments` | List comments |
| POST | `/api/issues/[id]/comments` | Add comment |
| PUT | `/api/issues/[id]/comments/[commentId]` | Edit comment |
| DELETE | `/api/issues/[id]/comments/[commentId]` | Delete comment |
| POST | `/api/issues/[id]/attachments` | Upload attachment |
| DELETE | `/api/issues/[id]/attachments/[attachmentId]` | Delete attachment |

### Admin & Workflow
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/issues/[id]/assign` | Assign owner |
| POST | `/api/issues/[id]/status` | Change status |
| POST | `/api/issues/[id]/merge` | Merge duplicate |
| GET | `/api/issues/categories` | List categories |
| POST | `/api/issues/categories` | Create category |
| PUT | `/api/issues/categories/[id]` | Update category |
| DELETE | `/api/issues/categories/[id]` | Delete category |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | List user notifications |
| PUT | `/api/notifications/[id]/read` | Mark as read |
| PUT | `/api/notifications/read-all` | Mark all as read |

### Audit
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/issues/[id]/timeline` | Get audit + comments |

---

## Environment Variables

```env
# OpenRouter AI Configuration
OPENROUTER_API_KEY=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
OPENROUTER_MODEL=google/gemini-3-flash-preview
OPENROUTER_TIMEOUT=10000
```

---

## Implementation Notes

1. Follow existing template module patterns
2. Use `getTableRef()`, `executeDbOperation()` from db-helper
3. Use `auditedInsert()`, `auditedUpdate()`, `auditedDelete()` for audit trail
4. Use `getNow()`, `toDbDate()` for date handling
5. DevExtreme DataGrid for issue list
6. DevExtreme Charts for dashboard
7. TanStack Query for data fetching
8. Zod for validation schemas
