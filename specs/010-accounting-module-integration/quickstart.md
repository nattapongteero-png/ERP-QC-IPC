# Quickstart Guide: Accounting Module Integration

**Feature**: 010-accounting-module-integration
**Date**: 2025-12-25

## Overview

This guide provides the essential information for developers implementing the Accounting Module. For complete details, refer to:
- [spec.md](./spec.md) - Feature requirements
- [plan.md](./plan.md) - Implementation plan
- [data-model.md](./data-model.md) - Entity definitions
- [contracts/](./contracts/) - API specifications

---

## Quick Setup

### 1. Database Schema

Add the accounting tables to `src/lib/db/schema.ts` following the dual-schema pattern:

```typescript
// Example: GL Account table
export const sqliteGLAccounts = sqliteTable('gl_accounts', {
  id: integer('id').primaryKey(),
  code: text('code').notNull().unique(),
  nameTh: text('name_th').notNull(),
  nameEn: text('name_en').notNull(),
  accountTypeId: integer('account_type_id').notNull(),
  parentId: integer('parent_id'),
  level: integer('level').notNull().default(1),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  isPostable: integer('is_postable', { mode: 'boolean' }).default(true),
  isBankAccount: integer('is_bank_account', { mode: 'boolean' }).default(false),
  bankName: text('bank_name'),
  bankAccountNumber: text('bank_account_number'),
  description: text('description'),
  createdBy: integer('created_by'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlGLAccounts = mysqlTable('gl_accounts', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  nameTh: varchar('name_th', { length: 200 }).notNull(),
  nameEn: varchar('name_en', { length: 200 }).notNull(),
  accountTypeId: int('account_type_id').notNull(),
  parentId: int('parent_id'),
  level: int('level').notNull().default(1),
  isActive: boolean('is_active').default(true),
  isPostable: boolean('is_postable').default(true),
  isBankAccount: boolean('is_bank_account').default(false),
  bankName: varchar('bank_name', { length: 100 }),
  bankAccountNumber: varchar('bank_account_number', { length: 50 }),
  description: text('description'),
  createdBy: int('created_by'),
  createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
});
```

### 2. Service Layer

Create `src/lib/services/accounting.service.ts`:

```typescript
import { db, isSqlite } from '../db';
import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { getNow, toDbDate } from '../db/date-utils';
import { createAuditLog } from '../audit';

// Table references
const getAccountingTables = () => {
  if (isSqlite()) {
    return {
      glAccounts: sqliteGLAccounts,
      journalEntries: sqliteJournalEntries,
      journalLines: sqliteJournalLines,
      apInvoices: sqliteAPInvoices,
      arInvoices: sqliteARInvoices,
      // ... other tables
    };
  }
  return {
    glAccounts: mysqlGLAccounts,
    journalEntries: mysqlJournalEntries,
    journalLines: mysqlJournalLines,
    apInvoices: mysqlAPInvoices,
    arInvoices: mysqlARInvoices,
    // ... other tables
  };
};

// ==================== GL ACCOUNTS ====================

export async function createGLAccount(data: GLAccountCreate, userId: number) {
  const { glAccounts } = getAccountingTables();
  const database = db();

  // Determine level from parent
  let level = 1;
  if (data.parentId) {
    const [parent] = await database
      .select({ level: glAccounts.level })
      .from(glAccounts)
      .where(eq(glAccounts.id, data.parentId));
    if (parent) level = parent.level + 1;
  }

  const [result] = await database
    .insert(glAccounts)
    .values({
      ...data,
      level,
      createdBy: userId,
      createdAt: getNow(),
      updatedAt: getNow(),
    })
    .returning({ id: glAccounts.id });

  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'gl_accounts',
    recordId: result.id,
    newValue: data,
  });

  return result.id;
}

// ==================== JOURNAL ENTRIES ====================

export async function createJournalEntry(
  data: JournalEntryCreate,
  userId: number
): Promise<number> {
  const { journalEntries, journalLines, fiscalPeriods } = getAccountingTables();
  const database = db();

  // Validate debits = credits
  const totalDebit = data.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredit = data.lines.reduce((sum, l) => sum + (l.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error('Journal entry is not balanced: debits must equal credits');
  }

  // Get fiscal period
  const [period] = await database
    .select()
    .from(fiscalPeriods)
    .where(
      and(
        lte(fiscalPeriods.startDate, toDbDate(data.entryDate)),
        gte(fiscalPeriods.endDate, toDbDate(data.entryDate))
      )
    );

  if (!period) {
    throw new Error('No open fiscal period for entry date');
  }
  if (period.status === 'closed') {
    throw new Error('Cannot post to closed period');
  }

  // Generate entry number
  const entryNumber = await generateEntryNumber(data.entryDate);

  // Create entry
  const [entry] = await database
    .insert(journalEntries)
    .values({
      entryNumber,
      entryDate: toDbDate(data.entryDate),
      fiscalPeriodId: period.id,
      description: data.description,
      sourceType: data.sourceType || 'MANUAL',
      sourceId: data.sourceId,
      status: 'draft',
      totalDebit,
      totalCredit,
      createdBy: userId,
      createdAt: getNow(),
      updatedAt: getNow(),
    })
    .returning({ id: journalEntries.id });

  // Create lines
  for (let i = 0; i < data.lines.length; i++) {
    const line = data.lines[i];
    await database.insert(journalLines).values({
      journalEntryId: entry.id,
      lineNumber: i + 1,
      glAccountId: line.glAccountId,
      debit: line.debit || 0,
      credit: line.credit || 0,
      description: line.description,
      costCenterId: line.costCenterId,
      createdAt: getNow(),
    });
  }

  return entry.id;
}

export async function postJournalEntry(entryId: number, userId: number) {
  const { journalEntries } = getAccountingTables();
  const database = db();

  const [entry] = await database
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.id, entryId));

  if (!entry) throw new Error('Journal entry not found');
  if (entry.status !== 'draft') throw new Error('Only draft entries can be posted');

  await database
    .update(journalEntries)
    .set({
      status: 'posted',
      postedBy: userId,
      postedAt: getNow(),
      updatedAt: getNow(),
    })
    .where(eq(journalEntries.id, entryId));

  await createAuditLog({
    userId,
    action: 'POST',
    tableName: 'journal_entries',
    recordId: entryId,
    oldValue: { status: 'draft' },
    newValue: { status: 'posted' },
  });
}

// ==================== AP/AR INTEGRATION ====================

/**
 * Called from purchasing.service.ts when PO is received
 */
export async function createAPInvoiceFromPO(
  poId: number,
  userId: number
): Promise<number> {
  const { apInvoices, apInvoiceLines } = getAccountingTables();
  const database = db();

  // Get PO details with lines
  const po = await getPurchaseOrderWithLines(poId);
  if (!po) throw new Error('Purchase order not found');

  // Calculate totals
  const subtotal = po.lines.reduce((sum, l) => sum + l.amount, 0);
  const vatAmount = subtotal * 0.07; // Thai VAT rate
  const totalAmount = subtotal + vatAmount;

  // Generate invoice number
  const invoiceNumber = `AP-${po.poNumber}`;

  // Create AP invoice
  const [invoice] = await database
    .insert(apInvoices)
    .values({
      invoiceNumber,
      vendorId: po.vendorId,
      purchaseOrderId: poId,
      invoiceDate: getNow(),
      dueDate: calculateDueDate(po.paymentTerms),
      receivedDate: getNow(),
      subtotal,
      vatAmount,
      totalAmount,
      status: 'draft',
      createdBy: userId,
      createdAt: getNow(),
      updatedAt: getNow(),
    })
    .returning({ id: apInvoices.id });

  // Create lines
  for (const poLine of po.lines) {
    await database.insert(apInvoiceLines).values({
      apInvoiceId: invoice.id,
      lineNumber: poLine.lineNumber,
      description: poLine.itemName,
      itemId: poLine.itemId,
      glAccountId: getInventoryAccount(), // 1300 Inventory
      quantity: poLine.receivedQuantity,
      unitPrice: poLine.unitPrice,
      amount: poLine.amount,
      vatAmount: poLine.amount * 0.07,
      createdAt: getNow(),
    });
  }

  // Create VAT transaction
  await createVATTransaction({
    transactionType: 'input',
    taxInvoiceNumber: invoiceNumber,
    taxInvoiceDate: getNow(),
    vendorId: po.vendorId,
    taxableAmount: subtotal,
    vatRate: 7,
    vatAmount,
    apInvoiceId: invoice.id,
  });

  return invoice.id;
}

/**
 * Called from sales.service.ts when SO is shipped
 */
export async function createARInvoiceFromSO(
  soId: number,
  userId: number
): Promise<number> {
  // Similar pattern to AP...
  // Generate tax invoice number in Thai format
  const taxInvoiceNumber = await generateTaxInvoiceNumber();

  // ... create invoice, lines, VAT transaction
  return invoiceId;
}

// ==================== DEPRECIATION ====================

export async function runMonthlyDepreciation(
  fiscalPeriodId: number,
  userId: number
): Promise<{ assetsDepreciated: number; totalDepreciation: number; journalEntryId: number }> {
  const { fixedAssets, assetDepreciation, assetCategories } = getAccountingTables();
  const database = db();

  // Get active assets
  const assets = await database
    .select()
    .from(fixedAssets)
    .where(eq(fixedAssets.status, 'active'));

  const depreciationLines: JournalLineCreate[] = [];
  let totalDepreciation = 0;

  for (const asset of assets) {
    if (asset.netBookValue <= asset.salvageValue) continue;

    // Calculate monthly depreciation
    let monthlyDepr: number;
    if (asset.depreciationMethod === 'straight_line') {
      monthlyDepr = (asset.acquisitionCost - asset.salvageValue) / asset.usefulLifeMonths;
    } else {
      // Declining balance
      const rate = (1 / asset.usefulLifeMonths) * 2; // Double declining
      monthlyDepr = Math.min(
        asset.netBookValue * rate,
        asset.netBookValue - asset.salvageValue
      );
    }

    // Record depreciation
    const newAccumulated = asset.accumulatedDepreciation + monthlyDepr;
    const newNBV = asset.acquisitionCost - newAccumulated;

    await database.insert(assetDepreciation).values({
      fixedAssetId: asset.id,
      fiscalPeriodId,
      depreciationDate: getNow(),
      openingBookValue: asset.netBookValue,
      depreciationAmount: monthlyDepr,
      accumulatedDepreciation: newAccumulated,
      closingBookValue: newNBV,
      createdAt: getNow(),
    });

    // Update asset
    await database
      .update(fixedAssets)
      .set({
        accumulatedDepreciation: newAccumulated,
        netBookValue: newNBV,
        status: newNBV <= asset.salvageValue ? 'fully_depreciated' : 'active',
        updatedAt: getNow(),
      })
      .where(eq(fixedAssets.id, asset.id));

    // Collect JE lines by category
    const [category] = await database
      .select()
      .from(assetCategories)
      .where(eq(assetCategories.id, asset.categoryId));

    depreciationLines.push(
      { glAccountId: category.depreciationExpenseGLAccountId, debit: monthlyDepr, credit: 0 },
      { glAccountId: category.accumulatedDepreciationGLAccountId, debit: 0, credit: monthlyDepr }
    );

    totalDepreciation += monthlyDepr;
  }

  // Create consolidated JE
  const journalEntryId = await createJournalEntry({
    entryDate: getNow(),
    description: `Monthly Depreciation - Period ${fiscalPeriodId}`,
    sourceType: 'DEPRECIATION',
    lines: consolidateLines(depreciationLines),
  }, userId);

  await postJournalEntry(journalEntryId, userId);

  return {
    assetsDepreciated: assets.length,
    totalDepreciation,
    journalEntryId,
  };
}

// Helper functions
async function generateEntryNumber(date: string): Promise<string> {
  // Format: JE-YYYYMM-NNNNNN
  const month = date.substring(0, 7).replace('-', '');
  const count = await getEntryCountForMonth(month);
  return `JE-${month}-${String(count + 1).padStart(6, '0')}`;
}

async function generateTaxInvoiceNumber(): Promise<string> {
  // Format: TTTTTT-BBBBB-YYYYMM-NNNNNN
  const taxId = getCompanyTaxId().substring(0, 6);
  const branch = '00000'; // HQ
  const month = new Date().toISOString().substring(0, 7).replace('-', '');
  const count = await getInvoiceCountForMonth(month);
  return `${taxId}-${branch}-${month}-${String(count + 1).padStart(6, '0')}`;
}
```

### 3. API Routes

Create routes following the existing pattern in `src/app/api/accounting/`:

```typescript
// src/app/api/accounting/gl-accounts/route.ts
import { NextRequest } from 'next/server';
import { withAuth, successResponse, errorResponse, getPaginationParams, createPaginatedResponse } from '@/lib/api-utils';
import { listGLAccounts, createGLAccount } from '@/lib/services/accounting.service';
import { glAccountCreateSchema } from '@/lib/validation/accounting';

export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    const { searchParams } = new URL(request.url);
    const pagination = getPaginationParams(searchParams);

    const filters = {
      accountTypeId: searchParams.get('accountTypeId') ? parseInt(searchParams.get('accountTypeId')!) : undefined,
      isActive: searchParams.get('isActive') !== 'false',
      search: searchParams.get('search') || undefined,
    };

    const { items, total } = await listGLAccounts(filters, pagination);
    return successResponse(createPaginatedResponse(items, total, pagination));
  }, ['accounting:read']);
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    const body = await request.json();
    const parseResult = glAccountCreateSchema.safeParse(body);

    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return errorResponse('Validation failed', 400, { errors });
    }

    const id = await createGLAccount(parseResult.data, session.userId);
    const account = await getGLAccountById(id);
    return successResponse(account, 'Account created');
  }, ['accounting:write']);
}
```

### 4. Validation Schemas

Create `src/lib/validation/accounting.ts`:

```typescript
import { z } from 'zod';

// GL Account schemas
export const glAccountCreateSchema = z.object({
  code: z.string().min(1).max(20),
  nameTh: z.string().min(1).max(200),
  nameEn: z.string().min(1).max(200),
  accountTypeId: z.number().int().positive(),
  parentId: z.number().int().positive().optional(),
  description: z.string().optional(),
  isBankAccount: z.boolean().default(false),
  bankName: z.string().max(100).optional(),
  bankAccountNumber: z.string().max(50).optional(),
});

// Journal Entry schemas
export const journalLineSchema = z.object({
  glAccountId: z.number().int().positive(),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  description: z.string().optional(),
  costCenterId: z.number().int().positive().optional(),
}).refine(
  data => (data.debit > 0 && data.credit === 0) || (data.credit > 0 && data.debit === 0),
  { message: 'Line must have either debit or credit, not both' }
);

export const journalEntryCreateSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().optional(),
  lines: z.array(journalLineSchema).min(2),
}).refine(
  data => {
    const totalDebit = data.lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = data.lines.reduce((sum, l) => sum + l.credit, 0);
    return Math.abs(totalDebit - totalCredit) < 0.01;
  },
  { message: 'Journal entry must be balanced (debits = credits)' }
);

// AP Invoice schemas
export const apInvoiceCreateSchema = z.object({
  invoiceNumber: z.string().min(1).max(50),
  vendorId: z.number().int().positive(),
  purchaseOrderId: z.number().int().positive().optional(),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().optional(),
  currency: z.string().length(3).default('THB'),
  lines: z.array(z.object({
    description: z.string().min(1),
    itemId: z.number().int().positive().optional(),
    glAccountId: z.number().int().positive(),
    quantity: z.number().positive().default(1),
    unitPrice: z.number().min(0),
    amount: z.number().min(0),
    vatAmount: z.number().min(0).default(0),
    isCapitalizable: z.boolean().default(false),
  })).min(1),
});
```

### 5. UI Components

Create DevExtreme-based components in `src/components/accounting/`:

```typescript
// src/components/accounting/gl-account-selector.tsx
'use client';

import { SelectBox } from 'devextreme-react/select-box';
import { useQuery } from '@tanstack/react-query';

interface GLAccountSelectorProps {
  value?: number;
  onChange: (accountId: number) => void;
  accountTypeFilter?: string; // 'asset', 'liability', etc.
  disabled?: boolean;
}

export function GLAccountSelector({ value, onChange, accountTypeFilter, disabled }: GLAccountSelectorProps) {
  const { data: accounts, isLoading } = useQuery({
    queryKey: ['gl-accounts', accountTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (accountTypeFilter) params.set('accountType', accountTypeFilter);
      params.set('isActive', 'true');
      params.set('limit', '1000');
      const res = await fetch(`/api/accounting/gl-accounts?${params}`);
      const json = await res.json();
      return json.data.items;
    },
  });

  return (
    <SelectBox
      dataSource={accounts}
      displayExpr={(item) => item ? `${item.code} - ${item.nameEn}` : ''}
      valueExpr="id"
      value={value}
      onValueChanged={(e) => onChange(e.value)}
      searchEnabled
      searchExpr={['code', 'nameEn', 'nameTh']}
      disabled={disabled || isLoading}
      placeholder="Select Account..."
    />
  );
}
```

---

## Testing Approach

### Unit Tests (Service Layer)

```typescript
// tests/services/accounting.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createJournalEntry, postJournalEntry } from '@/lib/services/accounting.service';
import { seedTestAccounts, seedTestPeriod } from '../helpers/seed-accounting';

describe('Journal Entries', () => {
  beforeEach(async () => {
    await seedTestAccounts();
    await seedTestPeriod();
  });

  it('creates balanced journal entry', async () => {
    const entryId = await createJournalEntry({
      entryDate: '2025-12-25',
      description: 'Test entry',
      lines: [
        { glAccountId: 1100, debit: 1000, credit: 0 }, // Cash
        { glAccountId: 4100, debit: 0, credit: 1000 }, // Revenue
      ],
    }, 1);

    expect(entryId).toBeGreaterThan(0);
  });

  it('rejects unbalanced entry', async () => {
    await expect(createJournalEntry({
      entryDate: '2025-12-25',
      lines: [
        { glAccountId: 1100, debit: 1000, credit: 0 },
        { glAccountId: 4100, debit: 0, credit: 500 }, // Unbalanced!
      ],
    }, 1)).rejects.toThrow('not balanced');
  });

  it('posts entry and updates status', async () => {
    const entryId = await createJournalEntry({
      entryDate: '2025-12-25',
      lines: [
        { glAccountId: 1100, debit: 1000, credit: 0 },
        { glAccountId: 4100, debit: 0, credit: 1000 },
      ],
    }, 1);

    await postJournalEntry(entryId, 1);

    const entry = await getJournalEntryById(entryId);
    expect(entry.status).toBe('posted');
    expect(entry.postedBy).toBe(1);
  });
});
```

### Integration Tests (API)

```typescript
// tests/api/accounting/journal-entries.test.ts
import { describe, it, expect } from 'vitest';
import { createMockRequest, withTestAuth } from '../helpers/api-test-utils';

describe('POST /api/accounting/journal-entries', () => {
  it('creates entry with valid data', async () => {
    const request = createMockRequest({
      method: 'POST',
      body: {
        entryDate: '2025-12-25',
        description: 'Test',
        lines: [
          { glAccountId: 1, debit: 100, credit: 0 },
          { glAccountId: 2, debit: 0, credit: 100 },
        ],
      },
    });

    const response = await withTestAuth(request, POST);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.entryNumber).toMatch(/^JE-/);
  });

  it('rejects request without auth', async () => {
    const request = createMockRequest({ method: 'POST', body: {} });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
```

---

## Key Integration Points

### 1. PO Receipt → AP Invoice

In `src/lib/services/purchasing.service.ts`, add hook after `receivePurchaseOrder()`:

```typescript
export async function receivePurchaseOrder(...) {
  // ... existing receipt logic ...

  // Create AP Invoice
  const apInvoiceId = await accountingService.createAPInvoiceFromPO(poId, userId);

  return { lotIds, apInvoiceId };
}
```

### 2. SO Shipment → AR Invoice

In `src/lib/services/sales.service.ts`, add hook after shipment:

```typescript
export async function shipSalesOrder(soId: number, userId: number) {
  // ... shipment logic ...

  // Create AR Invoice
  const arInvoiceId = await accountingService.createARInvoiceFromSO(soId, userId);

  return { arInvoiceId };
}
```

### 3. Sidebar Navigation

Add to `src/components/layout/sidebar.tsx`:

```typescript
{
  name: 'Accounting',
  href: '/accounting',
  icon: Calculator, // from lucide-react
  roles: ['admin', 'manager', 'accounting', 'finance'],
  children: [
    { name: 'Dashboard', href: '/accounting', icon: LayoutDashboard },
    { name: 'Chart of Accounts', href: '/accounting/chart-of-accounts', icon: List },
    { name: 'Journal Entries', href: '/accounting/journal-entries', icon: FileText },
    { name: 'AP Invoices', href: '/accounting/ap-invoices', icon: Receipt },
    { name: 'AR Invoices', href: '/accounting/ar-invoices', icon: FileCheck },
    { name: 'Fixed Assets', href: '/accounting/fixed-assets', icon: Building2 },
    { name: 'Equipment', href: '/accounting/equipment', icon: Wrench },
    { name: 'Reports', href: '/accounting/reports', icon: BarChart3 },
    { name: 'Period Close', href: '/accounting/period-close', icon: Lock },
    { name: 'Settings', href: '/accounting/settings', icon: Settings },
  ],
},
```

---

## Thai Tax Implementation

### VAT Calculation

```typescript
const VAT_RATE = 0.07; // 7%

function calculateVAT(subtotal: number): { vatAmount: number; total: number } {
  const vatAmount = Math.round(subtotal * VAT_RATE * 100) / 100;
  return { vatAmount, total: subtotal + vatAmount };
}
```

### WHT Rates

```typescript
const WHT_RATES: Record<string, number> = {
  '40(4)a': 0.15, // Interest
  '40(4)b': 0.10, // Dividends
  '40(5)':  0.05, // Rent
  '40(6)':  0.03, // Professional services
  '40(7)':  0.03, // Contractors
  '40(8)':  0.03, // Other services (default)
};

function calculateWHT(amount: number, whtType: string): number {
  const rate = WHT_RATES[whtType] || 0.03;
  return Math.round(amount * rate * 100) / 100;
}
```

---

## Development Commands

```bash
# Run type check
pnpm tsc --noEmit

# Run linting
pnpm lint

# Run tests
pnpm test:run

# Run specific test file
pnpm test:run tests/services/accounting.service.test.ts

# Run dev server
pnpm dev
```

---

## Next Steps

1. **Phase 1**: Implement database schema (21 tables)
2. **Phase 2**: Create service layer functions
3. **Phase 3**: Build API routes
4. **Phase 4**: Create UI pages and components
5. **Phase 5**: Add integration hooks to purchasing/sales
6. **Phase 6**: Implement reports
7. **Phase 7**: Testing and refinement

Refer to [tasks.md](./tasks.md) (created by `/speckit.tasks`) for detailed task breakdown.
