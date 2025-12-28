# Feature Specification: Accounting Module Gap Analysis

**Feature Branch**: `011-accounting-spec-gap`
**Created**: 2025-12-28
**Status**: Draft
**Input**: User description: "Analyze gaps between ACCOUNTING-SPEC.md and current implementation to identify missing features for the Manufacturing Accounting System"

---

## Executive Summary

This specification documents the gap analysis between the Manufacturing Accounting System Specification (ACCOUNTING-SPEC.md) and the current implementation. After thorough code review, the analysis reveals that approximately **85-90% of the core features are implemented**, significantly higher than initially assessed.

**Key Finding:** The system already has integrated P2P (PO to Receipt to AP Invoice) and O2C (SO to Delivery to AR Invoice) workflows with automatic accounting entries.

### Remaining Gaps (Priority Order):

1. **Purchase Requisitions (PR)** - Missing upstream document before PO
2. **Bank Reconciliation** - No statement import or matching capability
3. **Credit Notes / Debit Notes** - No schema or service
4. **3-Way Matching** - PO/GRN/Invoice tolerance checking not implemented
5. **Configurable Approval Workflows** - PO has status workflow, but no configurable rules
6. **Manufacturing Variance Analysis** - Cost variances not calculated or reported
7. **e-Tax Export** - Reports exist but no XML/JSON export format

---

## Current Implementation Status (Verified from Code)

### Fully Implemented Modules

| Module | Schema | Service | API | UI | Accounting Integration |
|--------|--------|---------|-----|-----|------------------------|
| **General Ledger** | `gl_accounts`, `gl_account_types` | `accounting.service.ts` | `/api/accounting/gl-accounts/*` | `/accounting/chart-of-accounts` | N/A |
| **Journal Entries** | `journal_entries`, `journal_lines` | `accounting.service.ts` | `/api/accounting/journal-entries/*` | `/accounting/journal-entries/*` | N/A |
| **Fiscal Periods** | `fiscal_years`, `fiscal_periods` | `accounting-period.service.ts` | `/api/accounting/fiscal-periods/*` | `/accounting/period-close` | N/A |
| **AP Invoices** | `ap_invoices`, `ap_invoice_lines` | `accounting.service.ts` | `/api/accounting/ap-invoices/*` | `/accounting/ap/*` | Auto-created from PO receipt |
| **AR Invoices** | `ar_invoices`, `ar_invoice_lines` | `accounting.service.ts` | `/api/accounting/ar-invoices/*` | `/accounting/ar/*` | Auto-created from SO delivery |
| **Payments** | `payments`, `payment_allocations` | `accounting.service.ts` | `/api/accounting/payments` | `/accounting/ap/payments`, `/accounting/ar/receipts` | Auto GL posting |
| **VAT/WHT** | `vat_transactions`, `wht_transactions` | `accounting.service.ts` | `/api/accounting/reports/vat-report`, `/api/accounting/reports/wht-certificates/*` | `/accounting/reports/vat`, `/accounting/reports/wht` | Tracked per invoice |
| **Fixed Assets** | `fixed_assets`, `asset_categories`, `asset_depreciations`, `asset_disposals`, `asset_movements` | `accounting-assets.service.ts` | `/api/accounting/fixed-assets/*` | `/accounting/fixed-assets/*` | Depreciation JE |
| **Equipment** | `accounting_equipment`, `acct_maintenance_schedules`, `acct_maintenance_records` | `accounting-equipment.service.ts` | `/api/accounting/equipment/*` | `/accounting/equipment/*` | N/A |
| **Purchase Orders** | `purchase_orders`, `purchase_order_lines` | `purchasing.service.ts` | Via purchasing routes | `/purchasing/orders/*` | Creates JE + AP Invoice on receipt |
| **Goods Receipt** | Integrated with PO receiving | `receivePurchaseOrder()` | Via purchasing | Via PO detail | Dr Inventory RM, Cr GR/IR Clearing |
| **Sales Orders** | `sales_orders`, `sales_order_lines` | `sales.service.ts` | `/api/sales/orders/*` | `/sales/orders/*` | Creates JE + AR Invoice on delivery |
| **Delivery Notes** | `sales_deliveries` | `fulfillSalesOrderLine()` | `/api/sales/orders/[id]/deliveries` | Via SO fulfillment | Dr COGS, Cr Inventory; Dr AR, Cr Revenue |
| **BOM** | `bom`, `bom_lines`, `bom_rooms`, `bom_equipment`, `bom_sop_steps` | `bom-configuration.service.ts` | Via production | `/production/bom/*` | N/A |
| **Work Orders** | `work_orders`, `work_order_materials` | `production.service.ts` | Via production | `/production/work-orders/*` | Material issue tracked |
| **Inventory** | `warehouses`, `warehouse_locations`, `inventory_lots`, `inventory_transactions` | `inventory.service.ts` | `/api/inventory/*` | `/inventory/*` | Via movements |
| **Vendors** | `vendors`, `approved_vendor_list` | `purchasing.service.ts` | Via purchasing | `/purchasing/vendors/*` | N/A |
| **Customers** | `customers` | `sales.service.ts` | Via sales | `/sales/customers/*` | N/A |

### Purchase Order Workflow (Implemented)

The `purchasing.service.ts` implements full PO lifecycle:

```
draft -> pending_approval -> approved -> sent -> partial_receipt -> received -> closed
         (rejected)
         (cancelled at any stage)
```

**On PO Receipt (`receivePurchaseOrder()`):**
1. Creates inventory lot in quarantine
2. Creates GL Journal Entry: Dr Inventory RM, Cr GR/IR Clearing
3. Creates AP Invoice with lines, VAT calculation, 30-day payment terms

### Sales Order Workflow (Implemented)

The `sales.service.ts` implements full SO lifecycle with ATP (Available-to-Promise):

```
draft -> confirmed -> processing -> shipped
         (cancelled)
```

**On SO Fulfillment (`fulfillSalesOrderLine()`):**
1. Issues material from lot (FEFO allocation)
2. Creates COGS Journal Entry: Dr COGS, Cr Inventory FG
3. Creates Sales Journal Entry: Dr AR, Cr Revenue, Cr VAT Output
4. Creates AR Invoice with tax invoice number

### Work Order Workflow (Implemented)

The `production.service.ts` implements full WO lifecycle:

```
draft -> planned -> released -> in_progress -> completed -> closed
         (cancelled)   (on_hold)
```

Features: BOM explosion, material dispensing, yield calculation, line clearance integration.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Purchase Requisition Workflow (Priority: P1)

A Purchasing Officer needs to create a Purchase Requisition (PR) to request raw materials before creating a Purchase Order. PRs require approval based on amount thresholds before conversion to PO.

**Why this priority**: PRs are the standard upstream document for procurement control. Currently, POs can be created directly without formal requisition approval.

**Independent Test**: Can be fully tested by creating a PR, routing for approval, and converting to PO.

**Acceptance Scenarios**:

1. **Given** a user identifies a material need, **When** they create a Purchase Requisition, **Then** the PR is saved with draft status and can be submitted for approval.

2. **Given** a PR requires approval (amount > threshold), **When** submitted, **Then** the PR routes to the appropriate approver based on configured rules.

3. **Given** an approved PR exists, **When** the Purchasing Officer converts it to a PO, **Then** the PO references the source PR and copies line items.

---

### User Story 2 - Bank Reconciliation (Priority: P1)

An Accountant needs to import bank statements, automatically match transactions against recorded payments/receipts, and create adjustment journals for unmatched items.

**Why this priority**: Bank reconciliation is critical for month-end close. Currently, the system tracks payments but has no bank statement import or matching capability.

**Independent Test**: Can be fully tested by importing a bank statement file and matching it against existing payment records.

**Acceptance Scenarios**:

1. **Given** the Accountant has a bank statement file (CSV/Excel), **When** they upload it, **Then** the system imports statement lines with date, description, reference, and amount.

2. **Given** bank statement lines exist, **When** the Accountant runs auto-matching, **Then** the system matches lines to payments/receipts using amount + date tolerance + reference.

3. **Given** unmatched statement items exist, **When** the Accountant reviews them, **Then** they can create bank charges/interest journals or manually match to existing transactions.

---

### User Story 3 - Credit Notes and Debit Notes (Priority: P2)

An Accountant needs to issue Credit Notes (for returns/adjustments) and Debit Notes that properly reverse or adjust AR/AP balances with VAT handling.

**Why this priority**: Credit/Debit notes are essential for handling returns, price adjustments, and VAT corrections. Currently not implemented.

**Independent Test**: Can be fully tested by creating a credit note that reduces an AR invoice balance and verifies the reversal entries.

**Acceptance Scenarios**:

1. **Given** an AR invoice has been posted, **When** a Credit Note is created referencing that invoice, **Then** the system posts reversal entries (Cr AR, Dr Revenue, Dr VAT Output).

2. **Given** an AP invoice has been posted, **When** a Credit Note from supplier is recorded, **Then** the system reduces AP balance accordingly.

---

### User Story 4 - 3-Way Matching with Tolerances (Priority: P2)

A Finance Controller needs the system to automatically validate that AP invoices match PO quantities/prices and GRN received quantities within configurable tolerances.

**Why this priority**: 3-way matching is a key control for preventing overpayment. Currently, PO receiving creates AP invoices directly without tolerance checking.

**Independent Test**: Can be fully tested by creating an AP invoice with quantity/price variance and verifying tolerance checks.

**Acceptance Scenarios**:

1. **Given** a GRN has been received for a PO, **When** the supplier invoice is entered with quantity within tolerance, **Then** the invoice is matched automatically.

2. **Given** the supplier invoice exceeds quantity tolerance, **When** submitted for posting, **Then** the system blocks posting and requires approval or adjustment.

3. **Given** the supplier invoice has a price variance beyond tolerance, **When** submitted, **Then** the system creates a price variance exception for review.

---

### User Story 5 - Configurable Approval Workflows (Priority: P2)

A Finance Manager needs to configure approval workflows for financial documents (PR, PO, AP Invoices, Payments) with amount thresholds and segregation of duties.

**Why this priority**: While POs have a status workflow, there's no configurable rule-based approval routing. Internal controls require flexible approval configuration.

**Independent Test**: Can be fully tested by configuring an approval rule and verifying that documents route correctly.

**Acceptance Scenarios**:

1. **Given** an Admin configures an approval rule for POs > 100,000 THB requiring Manager approval, **When** a user creates a PO for 150,000 THB, **Then** the PO routes to the designated approver.

2. **Given** segregation rules are enabled, **When** a user creates a document, **Then** they cannot approve their own document.

3. **Given** a document is pending approval, **When** the approver acts, **Then** they can approve, reject (with reason), or return for edit.

---

### User Story 6 - Manufacturing Variance Analysis (Priority: P3)

A Cost Accountant needs to analyze manufacturing variances (material price, usage, labor, overhead) when using standard costing.

**Why this priority**: Standard costing requires variance analysis. Currently, actual costs are tracked but variances are not calculated or reported.

**Independent Test**: Can be fully tested by comparing actual production costs to standard costs and verifying variance calculations.

**Acceptance Scenarios**:

1. **Given** a work order is completed with actual material usage, **When** the variance report is generated, **Then** material usage variance (actual vs BOM standard) is calculated.

2. **Given** material was purchased at a price different from standard, **When** the variance report is generated, **Then** material price variance is calculated and posted.

---

### Edge Cases

- What happens when a PR is cancelled after partial conversion to PO?
- How does the system handle a bank statement line that matches multiple payments?
- What happens when trying to close a period with unreconciled bank transactions?
- How are credit notes handled for partially paid invoices?

---

## Requirements *(mandatory)*

### Functional Requirements - True Gaps (Not Implemented)

#### Purchase Requisitions (FR-PR)

- **FR-PR-001**: System MUST support Purchase Requisition (PR) creation with item details, quantities, required dates, and cost centers
- **FR-PR-002**: System MUST support PR status workflow (Draft -> Submitted -> Approved/Rejected -> Closed)
- **FR-PR-003**: System MUST support conversion of approved PR to PO with line item copy
- **FR-PR-004**: System MUST track PR-to-PO linkage for audit trail

#### Bank Reconciliation (FR-BR)

- **FR-BR-001**: System MUST support bank statement import (CSV/Excel format)
- **FR-BR-002**: System MUST support automatic matching using amount + date tolerance + reference
- **FR-BR-003**: System MUST support manual matching of unmatched items
- **FR-BR-004**: System MUST support creation of bank charge/interest journals from unmatched items
- **FR-BR-005**: System MUST track reconciliation status per statement line

#### Credit/Debit Notes (FR-CN)

- **FR-CN-001**: System MUST support AR Credit Note creation referencing original invoice
- **FR-CN-002**: System MUST support AP Credit Note (supplier credit) creation
- **FR-CN-003**: System MUST support Debit Note creation for additional charges
- **FR-CN-004**: System MUST create proper reversal GL entries with VAT adjustment
- **FR-CN-005**: System MUST update invoice balance when credit/debit note is posted

#### 3-Way Matching (FR-3W)

- **FR-3W-001**: System MUST support configurable quantity tolerance (e.g., +/- 5%)
- **FR-3W-002**: System MUST support configurable price tolerance (e.g., +/- 2%)
- **FR-3W-003**: System MUST automatically validate AP invoice against PO and GRN
- **FR-3W-004**: System MUST block out-of-tolerance invoices pending approval
- **FR-3W-005**: System MUST create variance exception records for review

#### Configurable Approval Workflows (FR-AW)

- **FR-AW-001**: System MUST support approval flow configuration per document type
- **FR-AW-002**: System MUST support approval conditions based on amount thresholds
- **FR-AW-003**: System MUST support multi-level approval routing
- **FR-AW-004**: System MUST enforce segregation of duties (creator cannot approve)
- **FR-AW-005**: System MUST support approval delegation
- **FR-AW-006**: System MUST provide approval notifications

#### Variance Analysis (FR-VA)

- **FR-VA-001**: System MUST calculate Material Price Variance (MPV)
- **FR-VA-002**: System MUST calculate Material Usage Variance (MUV)
- **FR-VA-003**: System MUST calculate Labor Rate/Efficiency Variance
- **FR-VA-004**: System MUST calculate Overhead Variance
- **FR-VA-005**: System MUST post variance entries at work order close

### Functional Requirements - Enhancements to Existing Features

- **FR-ENH-001**: Period Close needs bank reconciliation as validation requirement
- **FR-ENH-002**: VAT reports need e-Tax export capability (JSON/XML format for RD submission)
- **FR-ENH-003**: Payment batch run for AP due items (bulk payment processing)
- **FR-ENH-004**: GR/IR clearing reconciliation report
- **FR-ENH-005**: Recurring journal entries
- **FR-ENH-006**: Check management (check numbers, clearing status)

### Key Entities - Missing from Current Schema

| Entity | Description | Status |
|--------|-------------|--------|
| `PurchaseRequisition` | Purchase request document | Not implemented |
| `PurchaseRequisitionLine` | PR line items | Not implemented |
| `CreditNote` | AR/AP adjustment document | Not implemented |
| `DebitNote` | Additional charge document | Not implemented |
| `BankStatement` | Imported bank statement header | Not implemented |
| `BankStatementLine` | Individual bank transactions | Not implemented |
| `ReconciliationMatch` | Bank reconciliation matches | Not implemented |
| `ApprovalFlow` | Workflow configuration | Not implemented |
| `ApprovalRule` | Conditions for approval routing | Not implemented |
| `ApprovalStep` | Steps in approval chain | Not implemented |
| `MatchingTolerance` | PO/GRN/Invoice tolerance config | Not implemented |
| `MatchingException` | Out-of-tolerance records | Not implemented |

### Key Entities - Already Implemented

| Entity | Tables in Schema | Notes |
|--------|------------------|-------|
| GL Accounts | `gl_accounts`, `gl_account_types` | Complete with hierarchy |
| Journal Entries | `journal_entries`, `journal_lines` | Complete with posting |
| Fiscal Periods | `fiscal_years`, `fiscal_periods` | Complete with close workflow |
| AP Invoices | `ap_invoices`, `ap_invoice_lines` | Auto-created from PO receipt |
| AR Invoices | `ar_invoices`, `ar_invoice_lines` | Auto-created from SO delivery with tax invoice |
| Payments | `payments`, `payment_allocations` | Complete |
| VAT/WHT | `vat_transactions`, `wht_transactions` | Complete with reports |
| Fixed Assets | `fixed_assets`, `asset_categories`, `asset_depreciations`, `asset_disposals`, `asset_movements` | Complete |
| Equipment | `accounting_equipment`, `acct_maintenance_schedules`, `acct_maintenance_records` | Complete |
| Purchase Orders | `purchase_orders`, `purchase_order_lines` | Complete with workflow |
| Sales Orders | `sales_orders`, `sales_order_lines`, `sales_deliveries` | Complete with ATP and delivery |
| BOM | `bom`, `bom_lines`, `bom_rooms`, `bom_equipment`, `bom_sop_steps`, `bom_packaging_qc` | Complete |
| Work Orders | `work_orders`, `work_order_materials` | Complete with execution |
| Inventory | `warehouses`, `warehouse_locations`, `inventory_lots`, `inventory_transactions` | Complete with FEFO |
| Vendors | `vendors`, `approved_vendor_list` | Complete with VMI |
| Customers | `customers` | Complete |

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create and approve Purchase Requisitions before PO creation
- **SC-002**: Bank reconciliation can match 80% of transactions automatically
- **SC-003**: Credit/debit notes properly adjust invoice balances and VAT
- **SC-004**: 3-way matching blocks invoices exceeding configured tolerances
- **SC-005**: Approval workflows route documents based on configurable rules
- **SC-006**: Manufacturing variance reports show actual vs standard cost analysis

---

## Implementation Gap Summary

### High Priority (P1) - Missing Core Features

| Module | Spec Section | Current Status | Gap |
|--------|-------------|----------------|-----|
| Purchase Requisitions | FR-AP-001 | Not implemented | Full implementation needed |
| Bank Reconciliation | FR-CB-004 | Not implemented | Full implementation needed |

### Medium Priority (P2) - Missing Supporting Features

| Module | Spec Section | Current Status | Gap |
|--------|-------------|----------------|-----|
| Credit Notes | FR-AR-001 | Not implemented | Full implementation needed |
| Debit Notes | FR-AR-001 | Not implemented | Full implementation needed |
| 3-Way Matching | FR-AP-002 | Not implemented | Full implementation needed |
| Configurable Approval Workflows | FR-WF-001 | Partial (status workflow exists) | Configuration UI and rules engine needed |
| Payment Batch Run | FR-CB-003 | Not implemented | Full implementation needed |

### Lower Priority (P3) - Enhancements

| Module | Spec Section | Current Status | Gap |
|--------|-------------|----------------|-----|
| Variance Analysis | FR-COST-005 | Not implemented | Calculation and reporting needed |
| e-Tax Export | FR-TAX-003 | Reports exist | Export format needed |
| Recurring Journals | FR-GL-001 | Not implemented | Full implementation needed |
| GR/IR Clearing Report | FR-RPT-001 | Not implemented | Report needed |

### Already Implemented (Complete)

| Module | Spec Section | Status |
|--------|-------------|--------|
| Chart of Accounts (COA) | FR-MD-002 | Complete |
| Journal Entries | FR-GL-001 | Complete |
| Fiscal Periods & Close | FR-GL-004 | Complete |
| Purchase Orders | FR-AP-001 | Complete with workflow and accounting |
| Goods Receipt | FR-AP-001 | Complete (via PO receiving) |
| Sales Orders | FR-AR-001 | Complete with ATP |
| Delivery Notes | FR-AR-001 | Complete (as sales_deliveries) |
| AP Invoices | FR-AP-001 | Complete (auto-created from receipt) |
| AR Invoices | FR-AR-002 | Complete (auto-created from delivery) |
| Tax Invoices | FR-AR-002 | Complete (tax_invoice_number field) |
| Payments | FR-CB-002 | Complete |
| VAT Reports | FR-TAX-001 | Complete |
| WHT Certificates | FR-TAX-002 | Complete |
| Fixed Assets | FR-FA-001 | Complete |
| Depreciation | FR-FA-002 | Complete |
| BOM/Routing | FR-MD-006 | Complete |
| Work Orders | FR-MFG-001 | Complete with execution workflow |
| Material Issue | FR-MFG-002 | Complete (via work order materials) |
| Inventory Management | FR-INV-001-007 | Complete with lots, FEFO, traceability |
| Vendor Management | FR-MD-003 | Complete with AVL and VMI |
| Customer Management | FR-MD-003 | Complete |
| Financial Reports | FR-RPT-001 | Complete (Trial Balance, BS, P&L, Cash Flow, Aging) |

---

## Assumptions

1. The existing accounting integration patterns (auto-creation of JE and invoices) will be extended to new features
2. The ApprovalChain component used in CAPA/Documents can be extended for financial approvals
3. The dual-database pattern (SQLite for testing, MySQL for production) will be maintained
4. The DevExtreme React UI framework will be used for all new interfaces

---

## Dependencies

1. **Existing Approval Component** - ApprovalChain.tsx exists in shared components, can be extended
2. **Existing Posting Engine** - Auto-posting patterns in accounting.service.ts provide foundation
3. **User/Role System** - HR module has roles and permissions that can be leveraged
