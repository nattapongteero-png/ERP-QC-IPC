# Quickstart Guide: GMP Compliance Gap Analysis

**Feature**: 009-gmp-compliance-gap-analysis
**Date**: 2025-12-22

## Overview

This guide provides implementation patterns for the GMP Compliance modules. Each module follows the established patterns in the existing codebase.

## Prerequisites

Before implementing any module:

1. Review existing patterns in:
   - `src/lib/db/schema.ts` - Dual schema pattern (SQLite/MySQL)
   - `src/app/api/quality/deviations/` - API route patterns
   - `src/app/hr/employees/page.tsx` - DevExtreme DataGrid patterns
   - `src/components/shared/` - Reusable component patterns

2. Ensure development environment:
   ```bash
   pnpm install
   DB_TYPE=sqlite pnpm db:push  # Apply schema changes
   pnpm dev                      # Start dev server
   ```

## Implementation Order

Implement in this sequence to respect dependencies:

```
P1.1 Document Control → P1.2 CAPA → P1.3 Change Control → P1.4 PQR
     ↓
P2.1 Complaints → P2.2 Recalls
     ↓
P2.3 Stability Program
     ↓
P3.1 Sanitation → P3.2 Pest Control
     ↓
P3.3 Internal Audit → P3.4 Contracts
     ↓
P1.0 Compliance Dashboard (aggregates all)
```

---

## Pattern: Adding New Tables (Schema)

### Step 1: Add SQLite Schema

```typescript
// src/lib/db/schema.ts

// 1. Add table definition
export const documents = sqliteTable('documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentNumber: text('document_number').notNull().unique(),
  title: text('title').notNull(),
  typeId: integer('type_id').references(() => documentTypes.id),
  status: text('status').notNull().default('draft'),
  // ... other fields
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// 2. Add relations
export const documentsRelations = relations(documents, ({ one, many }) => ({
  type: one(documentTypes, {
    fields: [documents.typeId],
    references: [documentTypes.id],
  }),
  versions: many(documentVersions),
}));

// 3. Export type
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
```

### Step 2: Add MySQL Schema

```typescript
// src/lib/db/schema-mysql.ts

export const mysqlDocuments = mysqlTable('documents', {
  id: int('id').primaryKey().autoincrement(),
  documentNumber: varchar('document_number', { length: 50 }).notNull().unique(),
  title: varchar('title', { length: 255 }).notNull(),
  typeId: int('type_id').references(() => mysqlDocumentTypes.id),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  // ... same fields, MySQL types
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
```

### Step 3: Push Schema

```bash
DB_TYPE=sqlite pnpm db:push
DB_TYPE=mysql pnpm db:push
```

---

## Pattern: API Route Implementation

### Basic CRUD Route

```typescript
// src/app/api/documents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { z } from 'zod';
import { eq, like, and, desc } from 'drizzle-orm';

// Validation schemas
const createDocumentSchema = z.object({
  title: z.string().min(1).max(255),
  typeId: z.number().int().positive(),
  departmentId: z.number().int().positive().optional(),
  content: z.string().optional(),
});

const querySchema = z.object({
  status: z.enum(['draft', 'active', 'obsolete', 'archived']).optional(),
  typeId: z.coerce.number().optional(),
  search: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});

// GET /api/documents
export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const query = querySchema.parse(params);

    const conditions = [];
    if (query.status) {
      conditions.push(eq(documents.status, query.status));
    }
    if (query.typeId) {
      conditions.push(eq(documents.typeId, query.typeId));
    }
    if (query.search) {
      conditions.push(like(documents.title, `%${query.search}%`));
    }

    const offset = (query.page - 1) * query.limit;

    const [items, countResult] = await Promise.all([
      db.query.documents.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          type: true,
          currentVersion: true,
        },
        orderBy: [desc(documents.updatedAt)],
        limit: query.limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)` })
        .from(documents)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    return NextResponse.json({
      documents: items,
      total: countResult[0]?.count ?? 0,
      page: query.page,
      limit: query.limit,
    });
  } catch (error) {
    console.error('GET /api/documents error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

// POST /api/documents
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createDocumentSchema.parse(body);

    // Generate document number
    const prefix = 'DOC'; // Get from document type
    const count = await db.select({ count: sql<number>`count(*)` })
      .from(documents);
    const docNumber = `${prefix}-${String(count[0].count + 1).padStart(4, '0')}`;

    const [newDoc] = await db.insert(documents)
      .values({
        documentNumber: docNumber,
        title: data.title,
        typeId: data.typeId,
        status: 'draft',
        createdBy: 1, // TODO: Get from auth
      })
      .returning();

    // Log to audit trail
    await db.insert(auditLog).values({
      tableName: 'documents',
      recordId: newDoc.id,
      action: 'create',
      newValues: JSON.stringify(newDoc),
      userId: 1, // TODO: Get from auth
    });

    return NextResponse.json(newDoc, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('POST /api/documents error:', error);
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    );
  }
}
```

---

## Pattern: DevExtreme DataGrid Page

```tsx
// src/app/documents/page.tsx
'use client';

import { useState } from 'react';
import DataGrid, {
  Column,
  Paging,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Toolbar,
  Item,
  Selection,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface Document {
  id: number;
  documentNumber: string;
  title: string;
  typeName: string;
  status: string;
  currentVersionNumber: string;
  updatedAt: string;
}

async function fetchDocuments(params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`/api/documents?${query}`);
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
}

export default function DocumentsPage() {
  const [filters, setFilters] = useState({ page: '1', limit: '20' });

  const { data, isLoading, error } = useQuery({
    queryKey: ['documents', filters],
    queryFn: () => fetchDocuments(filters),
  });

  const statusCellRender = (cellData: { value: string }) => {
    const statusColors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      obsolete: 'bg-yellow-100 text-yellow-800',
      archived: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[cellData.value] || ''}`}>
        {cellData.value}
      </span>
    );
  };

  if (error) return <div>Error loading documents</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Document Control</h1>
        <Link href="/documents/new">
          <Button text="New Document" type="default" stylingMode="contained" />
        </Link>
      </div>

      <DataGrid
        dataSource={data?.documents || []}
        showBorders
        columnAutoWidth
        rowAlternationEnabled
        loading={isLoading}
      >
        <FilterRow visible />
        <HeaderFilter visible />
        <SearchPanel visible placeholder="Search documents..." />
        <Selection mode="single" />
        <Paging defaultPageSize={20} />

        <Toolbar>
          <Item name="searchPanel" />
          <Item location="after">
            <Button
              text="Refresh"
              onClick={() => setFilters({ ...filters })}
            />
          </Item>
        </Toolbar>

        <Column
          dataField="documentNumber"
          caption="Document #"
          width={120}
          cellRender={(cellData) => (
            <Link href={`/documents/${cellData.data.id}`} className="text-blue-600 hover:underline">
              {cellData.value}
            </Link>
          )}
        />
        <Column dataField="title" caption="Title" />
        <Column dataField="typeName" caption="Type" width={100} />
        <Column
          dataField="status"
          caption="Status"
          width={100}
          cellRender={statusCellRender}
        />
        <Column dataField="currentVersionNumber" caption="Version" width={80} />
        <Column
          dataField="updatedAt"
          caption="Last Updated"
          dataType="datetime"
          width={150}
        />
      </DataGrid>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mt-6">
        <SummaryCard title="Total Documents" value={data?.total || 0} />
        <SummaryCard title="Active" value={data?.documents?.filter((d: Document) => d.status === 'active').length || 0} />
        <SummaryCard title="Pending Approval" value={0} />
        <SummaryCard title="Review Due" value={0} />
      </div>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
```

---

## Pattern: Workflow Status Transitions

```typescript
// src/lib/services/capa-service.ts

const CAPA_STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ['investigation', 'cancelled'],
  investigation: ['action_pending', 'cancelled'],
  action_pending: ['verification', 'investigation'],
  verification: ['closed', 'action_pending'],
  closed: [],
  cancelled: [],
};

export function canTransitionCapaStatus(from: string, to: string): boolean {
  return CAPA_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function updateCapaStatus(
  capaId: number,
  newStatus: string,
  userId: number
) {
  const capa = await db.query.capa.findFirst({
    where: eq(capa.id, capaId),
  });

  if (!capa) {
    throw new Error('CAPA not found');
  }

  if (!canTransitionCapaStatus(capa.status, newStatus)) {
    throw new Error(`Cannot transition from ${capa.status} to ${newStatus}`);
  }

  // Additional validation for specific transitions
  if (newStatus === 'closed') {
    // Check all actions complete
    const openActions = await db.query.capaActions.findMany({
      where: and(
        eq(capaActions.capaId, capaId),
        ne(capaActions.status, 'completed')
      ),
    });
    if (openActions.length > 0) {
      throw new Error('Cannot close CAPA with open actions');
    }

    // Check effectiveness verified
    const effective = await db.query.capaEffectiveness.findFirst({
      where: and(
        eq(capaEffectiveness.capaId, capaId),
        eq(capaEffectiveness.result, 'effective')
      ),
    });
    if (!effective) {
      throw new Error('Cannot close CAPA without effectiveness verification');
    }
  }

  const oldStatus = capa.status;
  const [updated] = await db
    .update(capa)
    .set({
      status: newStatus,
      updatedAt: sql`CURRENT_TIMESTAMP`,
      ...(newStatus === 'closed' ? { closedDate: sql`CURRENT_DATE` } : {}),
    })
    .where(eq(capa.id, capaId))
    .returning();

  // Audit trail
  await db.insert(auditLog).values({
    tableName: 'capa',
    recordId: capaId,
    action: 'update',
    oldValues: JSON.stringify({ status: oldStatus }),
    newValues: JSON.stringify({ status: newStatus }),
    userId,
  });

  return updated;
}
```

---

## Pattern: Reusable Components

### Workflow Status Badge

```tsx
// src/components/shared/WorkflowStatusBadge.tsx
interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
}

const STATUS_CONFIGS: Record<string, Record<string, StatusConfig>> = {
  capa: {
    open: { label: 'Open', color: 'text-blue-800', bgColor: 'bg-blue-100' },
    investigation: { label: 'Investigation', color: 'text-yellow-800', bgColor: 'bg-yellow-100' },
    action_pending: { label: 'Action Pending', color: 'text-orange-800', bgColor: 'bg-orange-100' },
    verification: { label: 'Verification', color: 'text-purple-800', bgColor: 'bg-purple-100' },
    closed: { label: 'Closed', color: 'text-green-800', bgColor: 'bg-green-100' },
    cancelled: { label: 'Cancelled', color: 'text-gray-800', bgColor: 'bg-gray-100' },
  },
  document: {
    draft: { label: 'Draft', color: 'text-gray-800', bgColor: 'bg-gray-100' },
    pending_approval: { label: 'Pending Approval', color: 'text-yellow-800', bgColor: 'bg-yellow-100' },
    approved: { label: 'Approved', color: 'text-green-800', bgColor: 'bg-green-100' },
    active: { label: 'Active', color: 'text-blue-800', bgColor: 'bg-blue-100' },
    obsolete: { label: 'Obsolete', color: 'text-red-800', bgColor: 'bg-red-100' },
  },
};

interface Props {
  type: 'capa' | 'document' | 'complaint' | 'recall' | 'audit';
  status: string;
}

export function WorkflowStatusBadge({ type, status }: Props) {
  const config = STATUS_CONFIGS[type]?.[status] || {
    label: status,
    color: 'text-gray-800',
    bgColor: 'bg-gray-100',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${config.color} ${config.bgColor}`}>
      {config.label}
    </span>
  );
}
```

---

## Testing Pattern

### Unit Test for Service

```typescript
// tests/unit/services/capa-service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { capa, capaActions } from '@/lib/db/schema';
import { canTransitionCapaStatus, updateCapaStatus } from '@/lib/services/capa-service';

describe('CAPA Service', () => {
  beforeEach(async () => {
    // Clear test data
    await db.delete(capaActions);
    await db.delete(capa);
  });

  describe('canTransitionCapaStatus', () => {
    it('allows valid transitions', () => {
      expect(canTransitionCapaStatus('open', 'investigation')).toBe(true);
      expect(canTransitionCapaStatus('investigation', 'action_pending')).toBe(true);
    });

    it('rejects invalid transitions', () => {
      expect(canTransitionCapaStatus('open', 'closed')).toBe(false);
      expect(canTransitionCapaStatus('closed', 'open')).toBe(false);
    });
  });

  describe('updateCapaStatus', () => {
    it('prevents closing with open actions', async () => {
      // Create CAPA with open action
      const [testCapa] = await db.insert(capa).values({
        capaNumber: 'CAPA-TEST-001',
        title: 'Test CAPA',
        sourceType: 'deviation',
        type: 'corrective',
        priority: 'medium',
        status: 'verification',
        ownerId: 1,
        dueDate: '2025-01-01',
      }).returning();

      await db.insert(capaActions).values({
        capaId: testCapa.id,
        actionNumber: 1,
        description: 'Test action',
        actionType: 'corrective',
        assigneeId: 1,
        dueDate: '2025-01-01',
        status: 'pending', // Not completed
      });

      await expect(updateCapaStatus(testCapa.id, 'closed', 1))
        .rejects.toThrow('Cannot close CAPA with open actions');
    });
  });
});
```

---

## Common Gotchas

1. **Dual Schema**: Always update both `schema.ts` (SQLite) and `schema-mysql.ts` (MySQL)

2. **Audit Trail**: Every data modification must log to `auditLog` table

3. **DevExtreme License**: Already included in package.json - no additional setup

4. **Type Safety**: Use Zod for request validation, Drizzle inferred types for DB

5. **Date Handling**: Use ISO strings (`YYYY-MM-DD`) for dates, let DB handle timestamps

6. **Status Enums**: Define in both schema and TypeScript types for consistency

7. **Foreign Keys**: Use `.references()` in schema for integrity, but handle errors gracefully

---

## Next Steps

After implementing each module:

1. Run `pnpm tsc --noEmit` - Check TypeScript errors
2. Run `pnpm lint` - Check ESLint errors
3. Run `pnpm test` - Run unit tests
4. Commit changes - `git add . && git commit -m "feat(module): description"`
5. Update this quickstart with any new patterns discovered

---

## Part 2: Integration Testing with Real SQLite (2025-12-23)

### Overview

All service modules MUST have comprehensive integration tests using real SQLite database. The existing CAPA service tests (`tests/integration/services/capa-service-real.test.ts`) serve as the reference implementation.

### Test File Structure

```
tests/
├── helpers/                    # Shared test utilities
│   ├── test-db.ts              # Database setup helper
│   ├── schema-sync.ts          # Drizzle schema → SQLite DDL
│   └── seed-data.ts            # Common test data seeding
├── unit/                       # Mocked unit tests (existing)
│   └── services/
└── integration/
    ├── services/               # Real SQLite integration tests
    │   ├── capa-service-real.test.ts           # ✅ Reference implementation
    │   ├── complaint-service-real.test.ts      # To implement
    │   ├── document-service-real.test.ts       # To implement
    │   └── ...
    └── api/                    # API integration tests
```

### Standard Integration Test Template

```typescript
/**
 * [ModuleName] Service Real Integration Tests
 * Feature: 009-gmp-compliance-gap-analysis
 *
 * Tests call actual service functions with real SQLite database
 * to verify complete module functionality with real-world scenarios.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableName, getTableColumns } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '@/lib/db/schema';

// Test database instance
let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

// Mock database module BEFORE service imports
vi.mock('@/lib/db', async () => {
  return {
    isSqlite: () => true,
    getDb: async () => testDb,
    getSqliteDb: () => testDb,
    markSchemaSynced: () => {},
    schema,
  };
});

// Mock audit to avoid side effects
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

// Import service AFTER mocking
import {
  listRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
} from '@/lib/services/[module]-service';

// Schema sync helper
function generateCreateTableSql(table: SQLiteTable): string {
  const tableName = getTableName(table);
  const columns = getTableColumns(table);
  const columnDefs: string[] = [];

  for (const [key, column] of Object.entries(columns)) {
    const col = column as any;
    let def = `"${col.name}" `;

    switch (col.dataType) {
      case 'string': def += 'TEXT'; break;
      case 'number': def += 'INTEGER'; break;
      case 'boolean': def += 'INTEGER'; break;
      default: def += 'TEXT';
    }

    if (col.primary) {
      def += ' PRIMARY KEY';
      if (col.autoIncrement) def += ' AUTOINCREMENT';
    }
    if (col.notNull && !col.primary) def += ' NOT NULL';
    if (col.hasDefault && col.default !== undefined) {
      const defaultVal = typeof col.default === 'string' ? `'${col.default}'` : col.default;
      def += ` DEFAULT ${defaultVal}`;
    }
    if (col.isUnique && !col.primary) def += ' UNIQUE';

    columnDefs.push(def);
  }

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columnDefs.join(',\n  ')}\n)`;
}

function syncSchemaFromDrizzle() {
  const tablesToCreate = [
    schema.sqliteUsers,
    // Add module-specific tables here
    schema.sqlite[ModuleName],
    schema.sqlite[ModuleName]Actions,
  ];

  for (const table of tablesToCreate) {
    try {
      sqlite.exec(generateCreateTableSql(table));
    } catch (err) {
      console.log(`Table creation note: ${err}`);
    }
  }
}

describe('[ModuleName] Service Real Integration Tests', () => {
  beforeAll(async () => {
    sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    testDb = drizzle(sqlite, { schema });
    syncSchemaFromDrizzle();
    seedTestData();
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(() => {
    cleanModuleTables();
    seedTestData();
  });

  function cleanModuleTables() {
    // Clean in FK dependency order (children first)
    sqlite.exec('DELETE FROM [module]_actions');
    sqlite.exec('DELETE FROM [module]');
    sqlite.exec('DELETE FROM users');
  }

  function seedTestData() {
    sqlite.exec(`
      INSERT OR IGNORE INTO users (id, name, email, password, role, is_active)
      VALUES
        (1, 'QA Manager', 'qa@test.com', 'hash123', 'qa_manager', 1),
        (2, 'Production Supervisor', 'prod@test.com', 'hash123', 'supervisor', 1),
        (3, 'QC Analyst', 'qc@test.com', 'hash123', 'analyst', 1)
    `);

    // Add module-specific seed data
  }

  // ============================================
  // Real-World Scenario Tests
  // ============================================

  describe('Scenario 1: Complete Workflow', () => {
    it('should handle full lifecycle from creation to closure', async () => {
      // Step 1: Create record
      const record = await createRecord({
        title: 'Test Record',
        // ... required fields
      }, 1);

      expect(record.id).toBeDefined();
      expect(record.status).toBe('open');

      // Step 2: Perform workflow operations
      // ...

      // Step 3: Complete/Close
      // ...
    });
  });

  // ============================================
  // Service Function Tests
  // ============================================

  describe('listRecords()', () => {
    beforeEach(async () => {
      // Create test data
      await createRecord({ title: 'Record 1', /* ... */ }, 1);
      await createRecord({ title: 'Record 2', /* ... */ }, 1);
    });

    it('should list all records with pagination', async () => {
      const result = await listRecords({ page: 1, limit: 10 });
      expect(result.records.length).toBeGreaterThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(2);
    });

    it('should filter by status', async () => {
      const result = await listRecords({ status: 'open' });
      expect(result.records.every(r => r.status === 'open')).toBe(true);
    });
  });

  describe('createRecord()', () => {
    it('should create record with valid data', async () => {
      const record = await createRecord({
        title: 'New Record',
        // ... required fields
      }, 1);

      expect(record.id).toBeDefined();
      expect(record.title).toBe('New Record');
    });

    it('should reject invalid input', async () => {
      await expect(createRecord({
        // Missing required fields
      }, 1)).rejects.toThrow();
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should handle empty lists', async () => {
      const result = await listRecords({});
      expect(result.records).toBeDefined();
    });

    it('should return null for non-existent record', async () => {
      const record = await getRecordById(99999);
      expect(record).toBeNull();
    });
  });
});
```

### Real-World Scenario Examples by Module

#### Complaints Module
```typescript
describe('Scenario 1: Customer Complaint Lifecycle', () => {
  it('should complete complaint from receipt to closure', async () => {
    // 1. Receive complaint
    const complaint = await createComplaint({
      source: 'customer',
      customerName: 'Test Customer',
      productId: 1,
      category: 'quality',
      severity: 'major',
      description: 'Product discoloration observed',
    }, 1);

    // 2. Assign for investigation
    await assignInvestigator(complaint.id, 2, 1);

    // 3. Record investigation findings
    await recordInvestigation(complaint.id, {
      batchRecordReview: 'BMR reviewed - no deviations found',
      retainSampleTest: 'Retention sample tested - meets specs',
      rootCause: 'Storage condition at customer site',
      conclusion: 'Complaint not quality-related',
    }, 2);

    // 4. Close complaint
    const closed = await closeComplaint(complaint.id, 'Closed - customer education provided', 1);
    expect(closed.status).toBe('closed');
  });
});
```

#### Documents Module
```typescript
describe('Scenario 1: Document Approval Workflow', () => {
  it('should complete document from draft to active', async () => {
    // 1. Create draft document
    const doc = await createDocument({
      title: 'SOP for CAPA Process',
      typeId: 1, // SOP type
      departmentId: 1,
    }, 1);

    // 2. Create first version
    const version = await createVersion(doc.id, {
      versionNumber: '1.0',
      content: 'Document content...',
      changeDescription: 'Initial version',
    }, 1);

    // 3. Submit for approval
    await submitForApproval(version.id, 1);

    // 4. Approve by reviewer
    await approveVersion(version.id, 2, 'Reviewed and approved');

    // 5. Approve by approver
    await approveVersion(version.id, 3, 'Final approval');

    // 6. Publish document
    const published = await publishDocument(doc.id, 1);
    expect(published.status).toBe('active');
  });
});
```

#### Internal Audit Module
```typescript
describe('Scenario 1: Complete Audit Cycle', () => {
  it('should complete audit from schedule to closure', async () => {
    // 1. Create audit
    const audit = await createAudit({
      auditType: 'internal',
      scope: 'QMS processes',
      gmpChapters: [1, 5, 10],
      scheduledDate: '2025-02-15',
      leadAuditorId: 1,
    }, 1);

    // 2. Conduct audit
    await startAudit(audit.id, 1);

    // 3. Record finding
    const finding = await recordFinding(audit.id, {
      category: 'minor',
      gmpChapter: 5,
      description: 'Document not updated within review period',
      evidence: 'SOP-QC-003 last reviewed 2023-01-15',
      areaOwner: 2,
      capaRequired: true,
    }, 1);

    // 4. Create CAPA from finding
    await createCapaFromFinding(finding.id, {
      title: 'CAPA for document review gap',
      priority: 'medium',
      ownerId: 2,
      dueDate: '2025-03-15',
    }, 1);

    // 5. Complete audit
    const completed = await completeAudit(audit.id, 'Audit completed with 1 minor finding', 1);
    expect(completed.status).toBe('completed');
  });
});
```

### Running Integration Tests

```bash
# Run all tests
pnpm test

# Run only integration tests
pnpm test tests/integration/

# Run specific service integration test
pnpm test tests/integration/services/capa-service-real.test.ts

# Run with coverage
pnpm test:coverage

# Watch mode for development
pnpm test --watch tests/integration/services/
```

### Test Coverage Targets

| Module | Minimum Scenarios | Minimum Functions | Target Coverage |
|--------|-------------------|-------------------|-----------------|
| CAPA | 5 | 15 | 85% |
| Complaints | 3 | 10 | 80% |
| Documents | 3 | 12 | 80% |
| Internal Audit | 3 | 10 | 80% |
| Recalls | 3 | 10 | 80% |
| Sanitation | 2 | 8 | 75% |
| Stability | 3 | 10 | 80% |
| Inventory | 3 | 12 | 80% |
| Production | 3 | 10 | 80% |
| Quality | 3 | 10 | 80% |

### Verification Checklist

Before marking integration tests complete for a module:

- [ ] Tests use real SQLite database (not mocks)
- [ ] Schema sync creates all required tables from Drizzle schema
- [ ] Each test cleans and seeds data in beforeEach
- [ ] At least 3 real-world scenario tests
- [ ] All exported service functions tested
- [ ] Edge cases covered (empty lists, not found, validation errors)
- [ ] Tests pass with `pnpm test:run`
- [ ] No console errors or warnings
