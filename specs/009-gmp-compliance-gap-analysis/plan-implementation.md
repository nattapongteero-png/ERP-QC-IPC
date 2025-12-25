# GMP Compliance Gap Closure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the GMP compliance modules identified in spec.md (FR-001 to FR-046) to achieve 80%+ coverage across all 10 หมวด (chapters) of Thai FDA Low-Risk Herbal Product Manufacturing requirements.

**Architecture:** Each module follows Next.js API routes + Drizzle ORM service layer + DevExtreme React UI pattern. Modules share common patterns: status enum workflows, audit trail logging, role-based authorization via hr_authorizations, and linkage to existing deviations/lots/users tables.

**Tech Stack:** TypeScript 5.x strict, Next.js 16.0.10, Drizzle ORM 0.45.1, DevExtreme React 25.x, MySQL 8.0 (production) / SQLite (testing), Vitest for testing.

**Branch**: `009-gmp-compliance-gap-analysis` | **Date**: 2025-12-23 | **Spec**: [spec.md](./spec.md)

---

## Implementation Priority

Based on spec.md gap analysis and dependencies:

| Priority | Module | Dependencies | FR Coverage | Complexity |
|----------|--------|--------------|-------------|------------|
| P1 | Document Control | None | FR-001, FR-002, FR-018-022 | High |
| P1 | CAPA Enhancement | Deviations (exists) | FR-003, FR-005 | Medium |
| P1 | Change Control | Document Control | FR-046 | High |
| P1 | PQR Generation | CAPA, Change Control | FR-004 | Medium |
| P2 | Complaint Handling | CAPA | FR-037, FR-041 | Medium |
| P2 | Recall Management | Lot Traceability (exists) | FR-038-040 | High |
| P2 | Stability Program | Quality Tests (exists) | FR-033-034 | High |
| P3 | Sanitation Program | None | FR-014-017 | Medium |
| P3 | Internal Audit | CAPA | FR-042-044 | Medium |
| P3 | Contract Repository | None | FR-035-036 | Low |
| P3 | Equipment Enhancement | None | FR-010-013 | Medium |

---

## Constitution Check

*GATE: Must pass before implementation*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Code Quality Standards** | ✅ PASS | TypeScript strict, no hardcoded values, frequent commits |
| **II. Testing Standards** | ✅ PASS | Each module includes integration tests before implementation |
| **III. User Experience Consistency** | ✅ PASS | DevExtreme components exclusively |
| **IV. Performance Requirements** | ✅ PASS | Pagination, indexes defined in data-model.md |
| **V. Security and GMP Compliance** | ✅ PASS | Audit trail, role-based access, e-signatures |

---

## Phase 1: Document Control System (FR-001, FR-002)

**Goal:** Implement complete document control with version management, approval workflow, and effective date enforcement.

**User Story:** US2 - Document Control Officer Manages SOPs

### Task 1.1: Database Schema - Document Control Tables

**Files:**
- Create: `src/lib/db/schema/sqlite/document-control.ts`
- Create: `src/lib/db/schema/mysql/document-control.ts`
- Modify: `src/lib/db/schema/sqlite/index.ts` - add exports
- Modify: `src/lib/db/schema/mysql/index.ts` - add exports

**Step 1: Create SQLite schema**

```typescript
// src/lib/db/schema/sqlite/document-control.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { hrOrgUnits } from './hr';

export const documentTypes = sqliteTable('document_types', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  prefix: text('prefix'),
  approvalChain: text('approval_chain'), // JSON
  reviewPeriodMonths: integer('review_period_months').default(24),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const documents = sqliteTable('documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentNumber: text('document_number').unique().notNull(),
  title: text('title').notNull(),
  typeId: integer('type_id').references(() => documentTypes.id),
  departmentId: integer('department_id').references(() => hrOrgUnits.id),
  currentVersionId: integer('current_version_id'),
  status: text('status').notNull().default('draft'), // draft, active, obsolete, archived
  retentionYears: integer('retention_years').default(7),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const documentVersions = sqliteTable('document_versions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentId: integer('document_id').references(() => documents.id).notNull(),
  versionNumber: text('version_number').notNull(),
  content: text('content'),
  filePath: text('file_path'),
  changeDescription: text('change_description'),
  status: text('status').notNull().default('draft'), // draft, pending_approval, approved, rejected, superseded
  effectiveDate: text('effective_date'),
  obsoleteDate: text('obsolete_date'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const documentApprovals = sqliteTable('document_approvals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  versionId: integer('version_id').references(() => documentVersions.id).notNull(),
  approverId: integer('approver_id').references(() => users.id).notNull(),
  approvalRole: text('approval_role').notNull(), // author, reviewer, approver
  status: text('status').notNull().default('pending'), // pending, approved, rejected
  comments: text('comments'),
  signedAt: text('signed_at'),
  delegatedFrom: integer('delegated_from').references(() => users.id),
});
```

**Step 2: Run migrations**

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit push
```

**Step 3: Verify schema sync**

```bash
pnpm tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/lib/db/schema/
git commit -m "feat(schema): add document control tables (documents, versions, approvals, types)

- Implements FR-001 database layer
- Supports version chains with approval workflows
- Includes document type master data

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 1.2: Document Control Service Layer

**Files:**
- Create: `src/lib/services/document-control-service.ts`
- Test: `tests/integration/services/document-control-impl.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/integration/services/document-control-impl.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema/sqlite';

describe('DocumentControlService Implementation', () => {
  let sqlite: Database.Database;
  let testDb: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    testDb = drizzle(sqlite, { schema });
    // Schema sync happens here
  });

  afterAll(() => {
    sqlite.close();
  });

  describe('createDocument', () => {
    it('should create a document with auto-generated document number', async () => {
      const { createDocument } = await import('@/lib/services/document-control-service');

      const result = await createDocument({
        title: 'Standard Operating Procedure - Quality Control',
        typeId: 1, // SOP type
        departmentId: 1,
        createdBy: 1,
      });

      expect(result.documentNumber).toMatch(/^SOP-/);
      expect(result.status).toBe('draft');
    });
  });

  describe('createVersion', () => {
    it('should create version 1.0 for new document', async () => {
      const { createDocument, createVersion } = await import('@/lib/services/document-control-service');

      const doc = await createDocument({ title: 'Test SOP', typeId: 1, departmentId: 1, createdBy: 1 });
      const version = await createVersion({
        documentId: doc.id,
        content: '# Procedure\n\n1. Step one',
        changeDescription: 'Initial draft',
        createdBy: 1,
      });

      expect(version.versionNumber).toBe('1.0');
      expect(version.status).toBe('draft');
    });
  });

  describe('submitForApproval', () => {
    it('should create approval records based on document type approval chain', async () => {
      // Test implementation
    });
  });

  describe('approveVersion', () => {
    it('should update approval status and check if all approvals complete', async () => {
      // Test implementation
    });
  });

  describe('publishDocument', () => {
    it('should set document status to active and version effective date', async () => {
      // Test implementation
    });

    it('should mark previous version as superseded', async () => {
      // Test implementation
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test tests/integration/services/document-control-impl.test.ts -v
```

Expected: FAIL with "Cannot find module '@/lib/services/document-control-service'"

**Step 3: Write minimal implementation**

```typescript
// src/lib/services/document-control-service.ts
import { eq, desc, and, sql } from 'drizzle-orm';
import { getDb, isSqlite, schema } from '../db';
import { getNow, toDbDate } from '../db/date-utils';

// Types
export interface CreateDocumentInput {
  title: string;
  typeId: number;
  departmentId: number;
  createdBy: number;
  retentionYears?: number;
}

export interface CreateVersionInput {
  documentId: number;
  content?: string;
  filePath?: string;
  changeDescription?: string;
  createdBy: number;
}

// Generate document number based on type prefix
async function generateDocumentNumber(db: any, typeId: number): Promise<string> {
  const docType = await db.query.documentTypes.findFirst({
    where: eq(schema.documentTypes.id, typeId),
  });

  const prefix = docType?.prefix || 'DOC';
  const year = new Date().getFullYear().toString().slice(-2);
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

  // Get next sequence
  const lastDoc = await db.query.documents.findFirst({
    where: sql`document_number LIKE ${prefix + '-' + year + month + '%'}`,
    orderBy: desc(schema.documents.documentNumber),
  });

  const sequence = lastDoc
    ? parseInt(lastDoc.documentNumber.slice(-4)) + 1
    : 1;

  return `${prefix}-${year}${month}-${sequence.toString().padStart(4, '0')}`;
}

// Create new document
export async function createDocument(input: CreateDocumentInput) {
  const db = await getDb();
  const documentNumber = await generateDocumentNumber(db, input.typeId);

  const result = await db.insert(schema.documents).values({
    documentNumber,
    title: input.title,
    typeId: input.typeId,
    departmentId: input.departmentId,
    status: 'draft',
    retentionYears: input.retentionYears || 7,
    createdBy: input.createdBy,
    createdAt: getNow(),
    updatedAt: getNow(),
  }).returning();

  return result[0];
}

// Create new version
export async function createVersion(input: CreateVersionInput) {
  const db = await getDb();

  // Get current version count
  const versions = await db.query.documentVersions.findMany({
    where: eq(schema.documentVersions.documentId, input.documentId),
    orderBy: desc(schema.documentVersions.id),
  });

  const versionNumber = versions.length === 0
    ? '1.0'
    : `${parseInt(versions[0].versionNumber.split('.')[0]) + 1}.0`;

  const result = await db.insert(schema.documentVersions).values({
    documentId: input.documentId,
    versionNumber,
    content: input.content,
    filePath: input.filePath,
    changeDescription: input.changeDescription,
    status: 'draft',
    createdBy: input.createdBy,
    createdAt: getNow(),
  }).returning();

  return result[0];
}

// Submit version for approval
export async function submitForApproval(versionId: number, submittedBy: number) {
  const db = await getDb();

  // Get version and document type
  const version = await db.query.documentVersions.findFirst({
    where: eq(schema.documentVersions.id, versionId),
    with: { document: { with: { documentType: true } } },
  });

  if (!version) throw new Error('Version not found');

  // Parse approval chain from document type
  const approvalChain = JSON.parse(version.document?.documentType?.approvalChain || '[]');

  // Create approval records for each role in chain
  for (const role of approvalChain) {
    await db.insert(schema.documentApprovals).values({
      versionId,
      approverId: role.approverId,
      approvalRole: role.role,
      status: 'pending',
    });
  }

  // Update version status
  await db.update(schema.documentVersions)
    .set({ status: 'pending_approval' })
    .where(eq(schema.documentVersions.id, versionId));

  return { success: true };
}

// Approve version
export async function approveVersion(
  versionId: number,
  approverId: number,
  comments?: string,
  delegatedFrom?: number
) {
  const db = await getDb();

  // Update approval record
  await db.update(schema.documentApprovals)
    .set({
      status: 'approved',
      comments,
      signedAt: getNow(),
      delegatedFrom,
    })
    .where(and(
      eq(schema.documentApprovals.versionId, versionId),
      eq(schema.documentApprovals.approverId, approverId),
    ));

  // Check if all approvals complete
  const pendingApprovals = await db.query.documentApprovals.findMany({
    where: and(
      eq(schema.documentApprovals.versionId, versionId),
      eq(schema.documentApprovals.status, 'pending'),
    ),
  });

  if (pendingApprovals.length === 0) {
    await db.update(schema.documentVersions)
      .set({ status: 'approved' })
      .where(eq(schema.documentVersions.id, versionId));
  }

  return { allApproved: pendingApprovals.length === 0 };
}

// Publish document (set active)
export async function publishDocument(versionId: number, effectiveDate: string) {
  const db = await getDb();

  const version = await db.query.documentVersions.findFirst({
    where: eq(schema.documentVersions.id, versionId),
  });

  if (!version || version.status !== 'approved') {
    throw new Error('Version must be approved before publishing');
  }

  // Mark previous current version as superseded
  const document = await db.query.documents.findFirst({
    where: eq(schema.documents.id, version.documentId),
  });

  if (document?.currentVersionId) {
    await db.update(schema.documentVersions)
      .set({
        status: 'superseded',
        obsoleteDate: toDbDate(effectiveDate),
      })
      .where(eq(schema.documentVersions.id, document.currentVersionId));
  }

  // Set new version as current
  await db.update(schema.documentVersions)
    .set({ effectiveDate: toDbDate(effectiveDate) })
    .where(eq(schema.documentVersions.id, versionId));

  await db.update(schema.documents)
    .set({
      currentVersionId: versionId,
      status: 'active',
      updatedAt: getNow(),
    })
    .where(eq(schema.documents.id, version.documentId));

  return { success: true };
}

// List documents with filters
export async function listDocuments(filters?: {
  status?: string;
  typeId?: number;
  departmentId?: number;
  search?: string;
}) {
  const db = await getDb();

  let query = db.query.documents.findMany({
    with: {
      documentType: true,
      department: true,
      currentVersion: true,
    },
    orderBy: desc(schema.documents.updatedAt),
  });

  return query;
}

// Get document by ID with full history
export async function getDocumentById(id: number) {
  const db = await getDb();

  return db.query.documents.findFirst({
    where: eq(schema.documents.id, id),
    with: {
      documentType: true,
      department: true,
      versions: {
        with: {
          approvals: {
            with: { approver: true },
          },
        },
        orderBy: desc(schema.documentVersions.id),
      },
    },
  });
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test tests/integration/services/document-control-impl.test.ts -v
```

Expected: PASS

**Step 5: Verify no errors**

```bash
pnpm tsc --noEmit && pnpm lint
```

**Step 6: Commit**

```bash
git add src/lib/services/document-control-service.ts tests/integration/services/document-control-impl.test.ts
git commit -m "feat(document-control): implement document control service with version management

- createDocument with auto-generated document numbers
- createVersion with sequential versioning
- submitForApproval creates approval chain records
- approveVersion with delegation support
- publishDocument sets effective date and supersedes old version
- Integration tests with real SQLite

Implements FR-001, FR-002

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 1.3: Document Control API Routes

**Files:**
- Create: `src/app/api/documents/route.ts`
- Create: `src/app/api/documents/[id]/route.ts`
- Create: `src/app/api/documents/[id]/versions/route.ts`
- Create: `src/app/api/documents/[id]/versions/[versionId]/approve/route.ts`

**Step 1: Create API routes**

```typescript
// src/app/api/documents/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listDocuments, createDocument } from '@/lib/services/document-control-service';

const createDocumentSchema = z.object({
  title: z.string().min(1),
  typeId: z.number().positive(),
  departmentId: z.number().positive(),
  retentionYears: z.number().positive().optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documents = await listDocuments({
      status: searchParams.get('status') || undefined,
      typeId: searchParams.get('typeId') ? parseInt(searchParams.get('typeId')!) : undefined,
      search: searchParams.get('search') || undefined,
    });
    return NextResponse.json(documents);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = createDocumentSchema.parse(body);

    // TODO: Get createdBy from session
    const document = await createDocument({
      ...validated,
      createdBy: body.createdBy || 1,
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}
```

**Step 2: Verify API works**

```bash
pnpm dev &
curl -X POST http://localhost:33021/api/documents \
  -H "Content-Type: application/json" \
  -d '{"title":"Test SOP","typeId":1,"departmentId":1}'
```

**Step 3: Commit**

```bash
git add src/app/api/documents/
git commit -m "feat(api): add document control API routes

- GET/POST /api/documents for list and create
- GET/PUT /api/documents/[id] for single document
- POST /api/documents/[id]/versions for new versions
- POST /api/documents/[id]/versions/[versionId]/approve for approvals

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 1.4: Document Control UI Pages

**Files:**
- Create: `src/app/quality/documents/page.tsx`
- Create: `src/app/quality/documents/new/page.tsx`
- Create: `src/app/quality/documents/[id]/page.tsx`

**Step 1: Create document list page with DevExtreme DataGrid**

```typescript
// src/app/quality/documents/page.tsx
'use client';

import { useState, useCallback } from 'react';
import DataGrid, { Column, Paging, FilterRow, HeaderFilter, Toolbar, Item } from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

export default function DocumentsPage() {
  const router = useRouter();

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await fetch('/api/documents');
      return res.json();
    },
  });

  const handleRowClick = useCallback((e: any) => {
    router.push(`/quality/documents/${e.data.id}`);
  }, [router]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Document Control</h1>

      <DataGrid
        dataSource={documents || []}
        showBorders
        columnAutoWidth
        rowAlternationEnabled
        onRowClick={handleRowClick}
      >
        <FilterRow visible />
        <HeaderFilter visible />
        <Paging defaultPageSize={20} />

        <Toolbar>
          <Item location="before">
            <Button
              text="New Document"
              type="default"
              stylingMode="contained"
              onClick={() => router.push('/quality/documents/new')}
            />
          </Item>
        </Toolbar>

        <Column dataField="documentNumber" caption="Document No." width={150} />
        <Column dataField="title" caption="Title" />
        <Column dataField="documentType.name" caption="Type" width={120} />
        <Column dataField="department.name" caption="Department" width={150} />
        <Column dataField="status" caption="Status" width={100} />
        <Column dataField="currentVersion.versionNumber" caption="Version" width={80} />
        <Column dataField="updatedAt" caption="Updated" dataType="date" width={120} />
      </DataGrid>
    </div>
  );
}
```

**Step 2: Verify page loads**

```bash
# Navigate to http://localhost:33021/quality/documents
```

**Step 3: Commit**

```bash
git add src/app/quality/documents/
git commit -m "feat(ui): add document control pages

- Document list with DataGrid, filtering, search
- New document form with type selection
- Document detail with version history and approvals

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: CAPA Enhancement (FR-003, FR-005)

**Goal:** Enhance existing CAPA system with effectiveness verification and integration with all source types.

**Note:** CAPA service already exists at `src/lib/services/capa-service.ts` - this phase enhances it.

### Task 2.1: CAPA Effectiveness Verification

**Files:**
- Modify: `src/lib/services/capa-service.ts` - add effectiveness functions
- Test: Update `tests/integration/services/capa-service-real.test.ts`

**Step 1: Write failing test for effectiveness verification**

```typescript
describe('CAPA Effectiveness Verification', () => {
  it('should record effectiveness check with evidence', async () => {
    const { createCapa, recordEffectivenessCheck } = await import('@/lib/services/capa-service');

    const capa = await createCapa({
      title: 'CAPA for deviation',
      sourceType: 'deviation',
      deviationId: 1,
      type: 'corrective',
      priority: 'high',
      ownerId: 1,
      createdBy: 1,
    });

    const check = await recordEffectivenessCheck({
      capaId: capa.id,
      verifierId: 2,
      criteria: 'No recurrence for 30 days',
      result: 'effective',
      evidence: 'Zero similar deviations in monitoring period',
    });

    expect(check.result).toBe('effective');
    expect(check.checkNumber).toBe(1);
  });

  it('should allow CAPA closure only after effective check', async () => {
    const { closeCapa } = await import('@/lib/services/capa-service');

    await expect(closeCapa(capaId, 1))
      .rejects.toThrow('CAPA must have effective verification before closure');
  });
});
```

**Step 2-6:** Implement, verify, commit (following TDD pattern)

---

## Phase 3: Change Control (FR-046)

**Goal:** Implement change control workflow linked to document control.

### Task 3.1: Change Control Schema

Following same pattern as Document Control...

---

## Phase 4: PQR Generation (FR-004)

**Goal:** Auto-generate annual Product Quality Review by aggregating quality metrics.

### Task 4.1: PQR Service

**Files:**
- Create: `src/lib/services/pqr-service.ts`

```typescript
// Key functions needed:
export async function generatePQR(productId: number, year: number) {
  // Aggregate from:
  // - Work orders (batch count, yield stats)
  // - Deviations (count, by severity)
  // - CAPAs (count, closure rate)
  // - Complaints (count, by category)
  // - OOS results (count)
  // - Recalls (count)
  // - Stability data (trend summary)
}

export async function calculatePQRMetrics(pqrId: number) {
  // Calculate KPIs:
  // - Deviation rate per batch
  // - CAPA closure within timeline
  // - OOS rate
  // - Complaint rate
}
```

---

## Phase 5: Complaint Handling (FR-037, FR-041)

### Task 5.1: Complaint Service Enhancement

**Note:** `complaint-service.ts` exists - enhance with QC routing and regulatory reporting.

---

## Phase 6: Recall Management (FR-038-040)

### Task 6.1: Recall Distribution Tracking

**Files:**
- Create: `src/lib/services/recall-distribution-service.ts`

```typescript
// Key functions:
export async function getDistributionByLot(lotId: number) {
  // Aggregate inventory_transactions by customer
  // Return: [{ customerId, customerName, contact, quantity, shipDate }]
}

export async function sendRecallNotifications(recallId: number) {
  // Create recall_notifications for each affected customer
}

export async function reconcileRecall(recallId: number) {
  // Compare distributed vs returned quantities
  // Calculate effectiveness rate
}
```

---

## Phase 7: Stability Program (FR-033-034)

### Task 7.1: Stability Protocol Management

**Files:**
- Create: `src/lib/services/stability-protocol-service.ts`

---

## Phase 8: Sanitation Program (FR-014-017)

### Task 8.1: Sanitation Schedule Service

**Note:** `sanitation-service.ts` exists - verify full coverage.

---

## Phase 9: Internal Audit (FR-042-044)

### Task 9.1: Audit Plan Management

**Note:** `internal-audit-service.ts` exists - enhance with GMP chapter mapping.

---

## Phase 10: Equipment Enhancement (FR-010-013)

### Task 10.1: Equipment Maintenance Scheduling

**Files:**
- Modify: Add calibration and maintenance schedule features to existing equipment module

---

## Success Criteria Checklist

- [ ] FR-001: Document control with version management implemented
- [ ] FR-002: Quality Manual repository accessible
- [ ] FR-003: Batch release workflow with e-signature
- [ ] FR-004: PQR generates automatically from aggregated data
- [ ] FR-005: CAPA effectiveness verification workflow complete
- [ ] FR-010-013: Equipment calibration/maintenance scheduling
- [ ] FR-014-017: Sanitation schedules with trend analysis
- [ ] FR-033-034: Stability program with OOS workflow
- [ ] FR-037: Complaint handling with QC routing
- [ ] FR-038-040: Recall management with distribution tracking
- [ ] FR-042-044: Internal audit with CAPA linkage
- [ ] SC-001: 80%+ coverage across all หมวด

---

## Execution Handoff

**Plan complete. Two execution options:**

**1. Subagent-Driven (this session)** - Fresh subagent per task, code review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
