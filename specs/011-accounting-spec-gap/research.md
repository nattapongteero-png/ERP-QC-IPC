# Research: Accounting Module Gap Analysis

**Branch**: `011-accounting-spec-gap` | **Date**: 2025-12-28

This document consolidates research findings for implementing the remaining accounting module features.

---

## 1. Purchase Requisitions (PR)

### Decision: Standard PR Workflow with Amount-Based Approval

**Rationale**: PRs are the standard upstream document for procurement control in manufacturing ERP systems. They provide audit trail of material needs before committing to purchases.

**Alternatives Considered**:
- Direct PO creation (current state) - Rejected: No approval control for large purchases
- Blanket orders - Not suitable: Different use case for repeat purchases

### Standard PR Status Workflow

```
draft -> submitted -> pending_approval -> approved -> converted -> closed
                   -> rejected -> draft (revision)
         cancelled (at any stage except closed)
```

### PR Header Fields (Required)

| Field | Type | Description |
|-------|------|-------------|
| pr_number | string | Auto-generated (PR-YYYY-NNNNN) |
| requester_id | FK | Employee who created the request |
| department_id | FK | Cost center/department |
| required_date | date | When materials are needed |
| priority | enum | normal, urgent, critical |
| justification | text | Business reason for request |
| status | enum | Workflow status |
| total_amount | decimal | Sum of line totals (for approval routing) |
| created_at, updated_at | datetime | Timestamps |

### PR Line Fields (Required)

| Field | Type | Description |
|-------|------|-------------|
| item_id | FK | Requested item (or null for text-only) |
| description | string | Item description (can override) |
| quantity | decimal | Requested quantity |
| unit | string | Unit of measure |
| estimated_price | decimal | Unit price estimate |
| line_total | decimal | Quantity x price |
| preferred_vendor_id | FK | Suggested vendor (optional) |
| notes | text | Additional requirements |

### PR to PO Conversion

- **Full conversion**: All lines of approved PR become one PO
- **Partial conversion**: Selected lines become PO, remaining lines stay open
- **Split conversion**: Lines go to different POs (different vendors)
- **Linkage**: PO lines reference source PR line ID for traceability

---

## 2. Bank Reconciliation

### Decision: CSV Import with Rule-Based Matching

**Rationale**: Thai banks commonly provide CSV exports. OFX/MT940 support can be added later as enhancement.

**Alternatives Considered**:
- OFX parser - Deferred: More complex, less common in Thai banking
- Direct bank API - Deferred: Requires bank integration agreements

### Statement Import Formats

**Primary Format (CSV)**:
```
Date,Reference,Description,Debit,Credit,Balance
2024-12-01,CHQ001,Payment ABC Co.,50000.00,,450000.00
2024-12-02,TRF002,Transfer XYZ Ltd.,,25000.00,475000.00
```

**CSV Column Mapping** (configurable per bank):
- Transaction date
- Reference number
- Description/Narrative
- Debit amount (outgoing)
- Credit amount (incoming)
- Running balance

### Matching Algorithm

**Auto-Match Rules** (in priority order):
1. **Exact match**: Amount + Reference + Date (within 0 days)
2. **Reference match**: Same reference, amount within tolerance (2%)
3. **Amount match**: Same amount, date within tolerance (3 days)
4. **Partial match**: Multiple payments sum to statement amount

**Tolerance Configuration**:
| Parameter | Default | Range |
|-----------|---------|-------|
| Date tolerance | 3 days | 0-7 days |
| Amount tolerance | 0% | 0-5% |
| Match confidence threshold | 90% | 70-100% |

### Statement Line Statuses

```
imported -> auto_matched (confidence > threshold)
         -> suggested (confidence < threshold)
         -> unmatched (no match found)
         -> manually_matched (user selected)
         -> journal_created (bank charge/interest)
         -> reconciled (confirmed by user)
```

### Unmatched Items Handling

- **Bank charges**: Create expense journal (Dr Bank Charges, Cr Bank)
- **Interest income**: Create income journal (Dr Bank, Cr Interest Income)
- **Errors**: Mark for investigation, create memo

---

## 3. Credit Notes and Debit Notes

### Decision: CN/DN as Adjustment Documents with VAT Reversal

**Rationale**: Thai Revenue Code requires credit notes for adjusting VAT on returns and price corrections.

**Thai Legal Requirements** (Revenue Code Section 86):
- Credit note must reference original tax invoice
- Must be issued within 15 days of return/adjustment event
- Must show VAT adjustment clearly

### Credit Note Types

| Type | Use Case | GL Effect |
|------|----------|-----------|
| **AR Credit Note** | Customer returns, price reduction | Dr Revenue, Dr VAT Output, Cr AR |
| **AP Credit Note** | Vendor credit for defects, price reduction | Dr AP, Cr Inventory/Expense, Cr VAT Input |

### Debit Note Types

| Type | Use Case | GL Effect |
|------|----------|-----------|
| **AR Debit Note** | Additional charges to customer | Dr AR, Cr Revenue, Cr VAT Output |
| **AP Debit Note** | Additional vendor charges | Dr Inventory/Expense, Dr VAT Input, Cr AP |

### CN/DN Fields

| Field | Type | Description |
|-------|------|-------------|
| note_number | string | Auto-generated (CN/DN-YYYY-NNNNN) |
| note_type | enum | ar_credit, ap_credit, ar_debit, ap_debit |
| reference_invoice_id | FK | Original invoice |
| customer_id / vendor_id | FK | Party |
| reason_code | enum | return, price_adjustment, quantity_adjustment, defect, other |
| reason_description | text | Detailed reason |
| subtotal | decimal | Pre-VAT amount |
| vat_amount | decimal | VAT adjustment (7%) |
| total_amount | decimal | Total adjustment |
| status | enum | draft, approved, posted, cancelled |
| journal_entry_id | FK | Posted GL entry |

### Invoice Balance Update

When CN is posted:
1. Create reversal journal entry
2. Reduce invoice `balance_due` by CN amount
3. Update invoice status if fully credited (balance = 0)
4. Link CN to any open payment allocations

---

## 4. 3-Way Matching

### Decision: Configurable Tolerances with Exception Workflow

**Rationale**: Manufacturing requires tolerance for quantity variances (natural weight variations) and price variances (currency fluctuation, fuel surcharges).

### Tolerance Configuration

| Parameter | Typical Default | Description |
|-----------|----------------|-------------|
| Quantity tolerance % | 5% | Accept +/- 5% of PO quantity |
| Quantity tolerance absolute | 10 units | Or 10 units, whichever is greater |
| Price tolerance % | 2% | Accept +/- 2% of PO price |
| Price tolerance absolute | 100 THB | Or 100 THB per line |
| Invoice total tolerance % | 1% | Total invoice variance |

### Matching Levels

1. **2-Way Match**: PO vs Invoice (quantity, price)
2. **3-Way Match**: PO vs GRN vs Invoice (add received quantity)
3. **4-Way Match**: Add quality inspection (for GMP compliance)

### Matching Status Flow

```
pending_match -> matched (within tolerance)
              -> quantity_exception (over quantity tolerance)
              -> price_exception (over price tolerance)
              -> approved_with_variance (exception approved)
              -> blocked (exception rejected)
```

### Exception Handling

| Exception Type | Required Action |
|----------------|-----------------|
| Over quantity (> tolerance) | Reject excess, request credit note |
| Under quantity (> tolerance) | Accept partial, flag for follow-up |
| Over price (> tolerance) | Manager approval required |
| Under price | Auto-accept (favorable variance) |

### GR/IR Clearing

- **GR/IR Account**: Liability account holding unmatched amounts
- **On Receipt**: Dr Inventory, Cr GR/IR Clearing
- **On Invoice**: Dr GR/IR Clearing, Cr AP
- **Balance**: Should be zero when fully matched

---

## 5. Configurable Approval Workflows

### Decision: Rule-Based Workflow Engine with Condition Evaluation

**Rationale**: Financial controls require flexible approval routing based on amount, document type, and organizational hierarchy.

### Workflow Data Model

**ApprovalFlow** (workflow definition):
| Field | Type | Description |
|-------|------|-------------|
| id | int | Primary key |
| name | string | Workflow name |
| document_type | enum | pr, po, ap_invoice, payment, credit_note |
| is_active | boolean | Enable/disable workflow |
| priority | int | Order of evaluation (lower = first) |

**ApprovalRule** (conditions for triggering flow):
| Field | Type | Description |
|-------|------|-------------|
| flow_id | FK | Parent workflow |
| field_name | string | Field to evaluate (e.g., "total_amount") |
| operator | enum | gt, gte, lt, lte, eq, between, in |
| value | string | Comparison value (or JSON for complex) |
| and_or | enum | AND/OR with next rule |

**ApprovalStep** (approval stages):
| Field | Type | Description |
|-------|------|-------------|
| flow_id | FK | Parent workflow |
| step_order | int | Sequence (1, 2, 3...) |
| approver_type | enum | user, role, department_head, requester_manager |
| approver_id | FK | Specific user/role if applicable |
| can_delegate | boolean | Allow delegation |
| timeout_days | int | Auto-escalate after N days |

### Segregation of Duties

**Built-in Rules**:
- Creator cannot approve own document
- Same user cannot perform consecutive approval steps
- Exception override requires higher authority

### Notification Mechanism

- **Email** (primary): Send notification on pending approval
- **In-app notification**: Badge count on dashboard
- **Escalation**: Notify manager if approval times out

---

## 6. Manufacturing Variance Analysis

### Decision: Standard Cost Variances at Work Order Close

**Rationale**: Standard costing with variance analysis is the norm for manufacturing cost control. Variances are calculated when work orders are completed.

### Variance Types

| Variance | Formula | GL Entry |
|----------|---------|----------|
| **Material Price Variance (MPV)** | (Actual Price - Standard Price) x Actual Qty | Dr/Cr MPV, Cr/Dr Inventory |
| **Material Usage Variance (MUV)** | (Actual Qty - Standard Qty) x Standard Price | Dr/Cr MUV, Cr/Dr Inventory |
| **Labor Rate Variance** | (Actual Rate - Standard Rate) x Actual Hours | Dr/Cr LRV, Cr/Dr Labor Expense |
| **Labor Efficiency Variance** | (Actual Hours - Standard Hours) x Standard Rate | Dr/Cr LEV, Cr/Dr Labor Expense |
| **Variable Overhead Variance** | Actual VOH - (Standard Rate x Actual Activity) | Dr/Cr VOH Variance |
| **Fixed Overhead Volume Variance** | Budgeted FOH - (Standard Rate x Standard Qty) | Dr/Cr FOH Volume Variance |

### When to Calculate

| Event | Variances Calculated |
|-------|---------------------|
| **Material Receipt** | MPV (price variance at receipt) |
| **Work Order Material Issue** | MUV (usage variance) |
| **Work Order Completion** | All variances posted |
| **Period End** | Overhead variances closed |

### Standard Cost Maintenance

- **BOM standard cost**: Sum of component standard costs
- **Standard labor hours**: From routing
- **Standard overhead rate**: From budget / expected activity
- **Cost roll-up**: Monthly or on BOM change

### Variance Reports

1. **Variance Summary**: By work order, product, period
2. **Material Variance Detail**: By item, BOM line
3. **Labor Variance Detail**: By operation, work center
4. **Overhead Analysis**: By cost center, category

---

## Implementation Notes

### Existing Patterns to Leverage

1. **Service Layer**: Follow `accounting.service.ts` pattern with `getTables()` helper
2. **Dual Schema**: Define both SQLite and MySQL tables in `schema.ts`
3. **Audit Trail**: Use `auditedInsert`, `auditedUpdate`, `auditedDelete`
4. **Date Handling**: Use `getNow()`, `toDbDate()`, `toQueryDate()`
5. **API Routes**: Next.js App Router with JSON responses
6. **UI Components**: DevExtreme DataGrid, Form, SelectBox

### Dependencies on Existing Modules

| New Feature | Depends On |
|-------------|------------|
| Purchase Requisitions | vendors, items, employees, departments |
| Bank Reconciliation | gl_accounts (bank accounts), payments |
| Credit/Debit Notes | ar_invoices, ap_invoices, vat_transactions |
| 3-Way Matching | purchase_orders, inventory_lots (GRN), ap_invoices |
| Approval Workflows | users, roles, all financial documents |
| Variance Analysis | work_orders, bom, items (with standard_cost) |

### Integration Points

1. **PR -> PO**: Convert approved PR lines to PO via service function
2. **Bank Recon -> Payments**: Match statement lines to payment records
3. **CN -> Invoice**: Update invoice balance_due when CN posted
4. **Matching -> AP Invoice**: Block posting if tolerance exceeded
5. **Approval -> Document Status**: Update document status on approval/rejection
6. **WO Close -> Variance JE**: Auto-post variance entries on completion
