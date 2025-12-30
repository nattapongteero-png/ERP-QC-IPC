# Quickstart: Accounting Module Gap Analysis

**Branch**: `011-accounting-spec-gap` | **Date**: 2025-12-28

This guide provides quick-start instructions for implementing the new accounting features.

---

## Prerequisites

1. **Development environment** running:
   ```bash
   cd /home/manoi/docker/herbal-medicine-erp
   npm run dev  # Port 33021
   ```

2. **Database seeded** with base accounting data:
   - GL accounts exist (Chart of Accounts)
   - Fiscal periods configured
   - Vendors and Customers exist
   - Items with standard costs (for variance analysis)

3. **Understanding of existing patterns**:
   - Review `src/lib/services/accounting.service.ts` for service patterns
   - Review `src/app/template/` for UI patterns
   - Review `src/lib/db/schema.ts` for dual-schema pattern

---

## Implementation Order (Recommended)

### Phase 1: Foundation (Week 1-2)

1. **Configurable Approval Workflows** - Required by PR and other features
2. **Purchase Requisitions** - Depends on approval workflows

### Phase 2: Core Accounting (Week 3-4)

3. **Credit/Debit Notes** - Independent, extends existing AR/AP
4. **3-Way Matching** - Extends existing PO/AP integration

### Phase 3: Operations (Week 5-6)

5. **Bank Reconciliation** - Independent, extends existing payments
6. **Manufacturing Variance Analysis** - Extends existing work orders

---

## Quick Implementation Guide

### 1. Approval Workflows

**Schema additions** (add to `schema.ts`):

```typescript
// SQLite tables
export const sqliteApprovalFlows = sqliteTable('approval_flows', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  documentType: text('document_type').notNull(),
  priority: integer('priority').default(100),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdBy: integer('created_by').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const sqliteApprovalSteps = sqliteTable('approval_steps', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  flowId: integer('flow_id').references(() => sqliteApprovalFlows.id),
  stepOrder: integer('step_order').notNull(),
  stepName: text('step_name').notNull(),
  approverType: text('approver_type').notNull(), // user, role, department_head
  approverId: integer('approver_id'),
  canDelegate: integer('can_delegate', { mode: 'boolean' }).default(false),
  timeoutDays: integer('timeout_days').default(3),
});
```

**Service pattern**:

```typescript
// src/lib/services/approval-workflow.service.ts
import { getTableRef, executeDbOperation } from '../db/db-helper';
import { auditedInsert, auditedUpdate } from '../db/audit-wrapper';

function getTables() {
  return {
    flows: getTableRef('approvalFlows'),
    rules: getTableRef('approvalRules'),
    steps: getTableRef('approvalSteps'),
    requests: getTableRef('approvalRequests'),
  };
}

export async function submitForApproval(
  documentType: string,
  documentId: number,
  userId: number
) {
  // 1. Find matching flow based on rules
  // 2. Create approval request
  // 3. Create first step assignment
  // 4. Send notification
}
```

### 2. Purchase Requisitions

**Schema additions**:

```typescript
export const sqlitePurchaseRequisitions = sqliteTable('purchase_requisitions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  prNumber: text('pr_number').notNull().unique(),
  requesterId: integer('requester_id').notNull(),
  departmentId: integer('department_id'),
  requiredDate: text('required_date').notNull(),
  priority: text('priority').default('normal'),
  status: text('status').default('draft'),
  totalAmount: real('total_amount').default(0),
  justification: text('justification'),
  createdBy: integer('created_by').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});
```

**Service pattern**:

```typescript
// src/lib/services/purchase-requisition.service.ts
export async function createPR(data: PRCreate, userId: number) {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const prNumber = await generatePRNumber();

    const result = await auditedInsert({
      table: 'purchaseRequisitions',
      data: {
        prNumber,
        requesterId: userId,
        ...data,
        createdBy: userId,
      },
      userId,
    });

    return { id: getInsertId(result), prNumber };
  });
}

export async function convertToP O(prId: number, lineIds: number[], vendorId: number, userId: number) {
  // 1. Validate PR is approved
  // 2. Validate lines are open
  // 3. Create PO header
  // 4. Copy lines to PO
  // 5. Update PR line status to 'converted'
  // 6. Update PR status if all lines converted
}
```

### 3. Credit/Debit Notes

**GL Entry pattern** (AR Credit Note):

```typescript
export async function postCreditNote(noteId: number, userId: number) {
  // Get credit note with lines
  const note = await getCreditNoteById(noteId);

  // Create journal entry
  const journalLines = [
    // Dr Revenue (reduce)
    { accountId: revenueAccountId, debit: note.subtotal, credit: 0 },
    // Dr VAT Output (reduce)
    { accountId: vatOutputAccountId, debit: note.vatAmount, credit: 0 },
    // Cr AR (reduce receivable)
    { accountId: arAccountId, debit: 0, credit: note.totalAmount },
  ];

  const jeId = await createJournalEntry({
    date: note.noteDate,
    description: `Credit Note ${note.noteNumber}`,
    sourceType: 'AR_CREDIT_NOTE',
    sourceId: noteId,
    lines: journalLines,
  }, userId);

  // Update invoice balance
  await updateInvoiceBalance(note.referenceInvoiceId, -note.totalAmount);

  // Create VAT transaction (negative)
  await createVATTransaction({
    type: 'output',
    amount: -note.vatAmount,
    documentType: 'credit_note',
    documentId: noteId,
  });
}
```

### 4. 3-Way Matching

**Matching algorithm**:

```typescript
export async function runMatching(apInvoiceId: number) {
  const invoice = await getAPInvoiceWithLines(apInvoiceId);
  const tolerance = await getDefaultTolerance();
  const results: MatchingResult[] = [];

  for (const line of invoice.lines) {
    const poLine = await getPOLine(line.poLineId);
    const grnQty = await getReceivedQuantity(line.poLineId);

    const qtyVariance = ((line.quantity - grnQty) / grnQty) * 100;
    const priceVariance = ((line.unitPrice - poLine.unitPrice) / poLine.unitPrice) * 100;

    let status = 'matched';
    const exceptions: MatchingException[] = [];

    if (Math.abs(qtyVariance) > tolerance.quantityTolerancePct) {
      status = 'quantity_exception';
      exceptions.push({ type: 'over_quantity', variance: qtyVariance });
    }

    if (Math.abs(priceVariance) > tolerance.priceTolerancePct) {
      status = 'price_exception';
      exceptions.push({ type: 'over_price', variance: priceVariance });
    }

    results.push({ lineId: line.id, status, exceptions });
  }

  return results;
}
```

### 5. Bank Reconciliation

**CSV Import pattern**:

```typescript
export async function importBankStatement(
  file: File,
  bankAccountId: number,
  statementDate: string,
  userId: number
) {
  const lines = await parseCSV(file);

  const statementId = await createBankStatement({
    bankAccountId,
    statementDate,
    openingBalance: lines[0].runningBalance - lines[0].amount,
    closingBalance: lines[lines.length - 1].runningBalance,
  }, userId);

  for (let i = 0; i < lines.length; i++) {
    await createStatementLine({
      statementId,
      lineNumber: i + 1,
      transactionDate: lines[i].date,
      reference: lines[i].reference,
      description: lines[i].description,
      debitAmount: lines[i].debit || null,
      creditAmount: lines[i].credit || null,
      status: 'imported',
    });
  }

  return { statementId, linesImported: lines.length };
}
```

**Auto-matching pattern**:

```typescript
export async function autoMatch(statementId: number, options: MatchOptions) {
  const lines = await getUnmatchedLines(statementId);
  const payments = await getUnreconciledPayments(statementId);

  for (const line of lines) {
    const amount = line.debitAmount || line.creditAmount;
    const isDebit = !!line.debitAmount;

    // Try exact match
    const exactMatch = payments.find(p =>
      p.amount === amount &&
      Math.abs(daysDiff(p.date, line.transactionDate)) <= options.dateTolerance
    );

    if (exactMatch) {
      await matchLineToPayment(line.id, exactMatch.id, 'exact', 100);
      continue;
    }

    // Try reference match
    const refMatch = payments.find(p =>
      p.reference === line.reference &&
      Math.abs(p.amount - amount) / amount <= options.amountTolerance
    );

    if (refMatch) {
      const confidence = 95 - Math.abs(p.amount - amount) / amount * 100;
      await matchLineToPayment(line.id, refMatch.id, 'reference', confidence);
    }
  }
}
```

### 6. Manufacturing Variance Analysis

**Variance calculation**:

```typescript
export async function calculateWorkOrderVariances(workOrderId: number) {
  const wo = await getWorkOrderWithDetails(workOrderId);
  const standardCost = await getStandardCost(wo.itemId);
  const variances: VarianceRecord[] = [];

  // Material Price Variance (MPV)
  // Calculated at receipt time - actual price vs standard price
  const materialReceipts = await getMaterialReceipts(workOrderId);
  for (const receipt of materialReceipts) {
    const mpv = (receipt.actualPrice - receipt.standardPrice) * receipt.quantity;
    if (mpv !== 0) {
      variances.push({
        workOrderId,
        itemId: receipt.itemId,
        varianceType: 'mpv',
        standardValue: receipt.standardPrice,
        actualValue: receipt.actualPrice,
        varianceAmount: mpv,
        quantity: receipt.quantity,
        isFavorable: mpv < 0,
      });
    }
  }

  // Material Usage Variance (MUV)
  // Actual qty used vs BOM standard qty
  const bomMaterials = await getBOMStandardQuantities(wo.bomId, wo.quantityProduced);
  const actualUsage = await getActualMaterialUsage(workOrderId);

  for (const bom of bomMaterials) {
    const actual = actualUsage.find(a => a.itemId === bom.itemId);
    const muv = (actual.quantity - bom.standardQty) * bom.standardPrice;
    if (muv !== 0) {
      variances.push({
        workOrderId,
        itemId: bom.itemId,
        varianceType: 'muv',
        standardValue: bom.standardQty,
        actualValue: actual.quantity,
        varianceAmount: muv,
        isFavorable: muv < 0,
      });
    }
  }

  return variances;
}
```

---

## UI Component Patterns

### DataGrid with Actions

```tsx
// Example: PR List Page
<DataGrid
  dataSource={requisitions}
  keyExpr="id"
  showBorders
  columnAutoWidth
>
  <Column dataField="prNumber" caption="PR Number" />
  <Column dataField="requiredDate" caption="Required Date" dataType="date" />
  <Column dataField="status" caption="Status" cellRender={StatusBadge} />
  <Column dataField="totalAmount" caption="Total" format="currency" />
  <Column type="buttons">
    <Button name="edit" />
    <Button name="view" onClick={handleView} />
    <Button name="submit" visible={canSubmit} onClick={handleSubmit} />
  </Column>
</DataGrid>
```

### Form with Validation

```tsx
// Example: PR Create Form
const validationRules = {
  requiredDate: [{ type: 'required' }],
  justification: [{ type: 'required' }, { type: 'stringLength', min: 10 }],
};

<Form formData={formData} onFieldDataChanged={handleChange}>
  <GroupItem caption="Request Details">
    <SimpleItem dataField="requiredDate" editorType="dxDateBox" />
    <SimpleItem dataField="priority" editorType="dxSelectBox"
      editorOptions={{ items: ['normal', 'urgent', 'critical'] }} />
    <SimpleItem dataField="justification" editorType="dxTextArea" />
  </GroupItem>
  <GroupItem caption="Line Items">
    <PRLineGrid prId={prId} onLinesChange={handleLinesChange} />
  </GroupItem>
</Form>
```

---

## Testing Patterns

### Unit Test

```typescript
// tests/unit/lib/services/purchase-requisition.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createPR, submitPR, approvePR } from '@/lib/services/purchase-requisition.service';
import { syncSchema } from '@/lib/db/schema-sync';

describe('Purchase Requisition Service', () => {
  beforeEach(async () => {
    await syncSchema();
  });

  it('creates PR with auto-generated number', async () => {
    const result = await createPR({
      requiredDate: '2025-01-15',
      priority: 'normal',
      justification: 'Production requirement',
      lines: [
        { itemId: 1, description: 'Raw Material A', quantity: 100, unit: 'kg', estimatedPrice: 50 }
      ]
    }, 1);

    expect(result.id).toBeGreaterThan(0);
    expect(result.prNumber).toMatch(/^PR-\d{4}-\d{5}$/);
  });

  it('blocks approval by same user who created', async () => {
    const pr = await createPR({ ... }, 1);
    await submitPR(pr.id, 1);

    await expect(approvePR(pr.id, 1)).rejects.toThrow('Cannot approve own document');
  });
});
```

### UI Test

```typescript
// tests/app/purchasing/requisitions/page.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PRListPage from '@/app/purchasing/requisitions/page';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: [
      { id: 1, prNumber: 'PR-2025-00001', status: 'draft', totalAmount: 5000 }
    ],
    isLoading: false,
  })),
}));

describe('PR List Page', () => {
  it('renders PR list with data', async () => {
    render(<PRListPage />);

    expect(screen.getByText('Purchase Requisitions')).toBeInTheDocument();
    expect(screen.getByText('PR-2025-00001')).toBeInTheDocument();
  });
});
```

---

## Sidebar Navigation

Add to `src/components/layout/sidebar.tsx`:

```typescript
// Under Purchasing section
{ label: 'Requisitions', href: '/purchasing/requisitions', icon: FileText },

// Under Accounting section
{ label: 'Bank Reconciliation', href: '/accounting/bank-reconciliation', icon: Building },
{ label: 'Credit Notes', href: '/accounting/credit-notes', icon: FileText },
{ label: 'Debit Notes', href: '/accounting/debit-notes', icon: FileText },
{ label: 'Variance Reports', href: '/accounting/variance-reports', icon: BarChart },

// Under Settings section
{ label: 'Approval Workflows', href: '/settings/approval-workflows', icon: GitBranch },
{ label: 'Matching Tolerances', href: '/settings/matching-tolerances', icon: Settings },
```

---

## Common Gotchas

1. **Date handling**: Always use `getNow()`, `toDbDate()`, `toQueryDate()` from `date-utils.ts`
2. **Dual schema**: Define both SQLite and MySQL tables, export from `schema.ts`
3. **Audit logging**: Use `auditedInsert`, `auditedUpdate`, `auditedDelete` for all changes
4. **Error handling**: API routes must return proper error responses with status codes
5. **Authorization**: Check user permissions in API routes, not just UI
