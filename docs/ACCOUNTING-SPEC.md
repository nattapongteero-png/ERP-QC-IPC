# Manufacturing Accounting System Specification (Single Plant)
**Version:** 1.0  
**Purpose:** Provide a detailed, build-ready specification for an integrated Accounting + Manufacturing + Inventory system for a **single plant** (one site), compliant with **Thai accounting + Thai tax (VAT/WHT)**.  
**Note:** This document intentionally **excludes deployment / infrastructure specs** (cloud/on-prem, sizing, DevOps, hosting, etc.).

---

## 1) Goals

### 1.1 Business Goals
- Maintain **accurate financial books** (GL, AR, AP, Cash/Bank) with **real-time posting** from operations.
- Support **factory operations**: purchasing, inventory, production orders, WIP tracking, finished goods, and manufacturing costing.
- Ensure **Thai compliance**: VAT, Withholding Tax, tax invoices, tax reports and filing outputs.
- Provide **internal controls**: approvals, segregation of duties, audit trail.
- Provide **closing discipline**: monthly close, period lock, reconciliation, and variance reporting.

### 1.2 System Goals (Product)
- Single integrated system of record for:
  - Procure-to-Pay (P2P)
  - Order-to-Cash (O2C)
  - Plan/Make-to-Produce (M2P)
  - Record-to-Report (R2R)
- Flexible master data and configurable rules for costing, taxes, and accounting postings.
- Strong reporting: operational + finance + tax.

---

## 2) Scope

### 2.1 In Scope
- **Single legal entity** (one company code)
- **Single plant/site** (one physical factory)
- Multiple warehouses within the plant (Raw/WIP/FG/MRO/Quarantine/Consignment optional)
- Multi-department/cost centers (Production, QA, Maintenance, Warehouse, Purchasing, Finance, etc.)
- Modules:
  1. Master Data & Setup
  2. Security & Audit
  3. General Ledger (GL) & Period Close
  4. Accounts Receivable (AR) + Sales Invoicing
  5. Accounts Payable (AP) + Purchasing
  6. Cash & Bank + Reconciliation
  7. Tax (VAT, WHT, e-Tax outputs)
  8. Inventory (Stock, Lot/Serial, QC holds)
  9. Manufacturing (BOM, Routing, Production Orders, WIP)
  10. Costing (Actual/Standard/Hybrid + variance)
  11. Fixed Assets (basic)
  12. Reporting & Exports

### 2.2 Out of Scope (for v1)
- Multi-plant / multi-branch operations
- Multi-company consolidation
- Full HR/Payroll (optional future)
- Advanced MES/SCADA (deep machine control); only data integration hooks
- Full CRM, E-commerce marketplace connectors (optional future)
- Complex transfer pricing, BOI-specific tax special cases (optional future)

---

## 3) Assumptions & Key Rules
- The plant produces goods using either **Discrete** manufacturing (assembly) and/or **Process** manufacturing (mix/blend). System must support both via BOM types.
- Accounting currency: **THB** (support multi-currency transactions optional but recommended).
- Fiscal calendar: configurable; default monthly periods.
- Real-time posting: operational documents generate accounting entries automatically per posting rules.
- Strong control: approved documents only affect inventory and accounting (configurable per document type).

---

## 4) User Roles & Personas

### 4.1 Roles (minimum)
- **System Admin**: configuration, users, permissions
- **Finance Manager**: close, approvals, finance controls
- **Accountant (GL/AP/AR)**: journals, invoices, tax, reports
- **Purchasing Officer**: PR/PO, supplier mgmt
- **Warehouse Officer**: receiving, issuing, transfers, counting
- **Production Planner**: MRP, production orders
- **Production Supervisor**: confirm production, scrap, rework
- **QC Officer**: inspection, quarantine release
- **Approver**: approve PR/PO/payments/credit notes
- **Auditor (read-only)**: view documents + logs

### 4.2 Permission Model
- RBAC: roles + granular permissions per module/action.
- Data scope: within single plant, but restrict by warehouse/cost center if needed.
- Every financial-impact transaction must be traceable to:
  - who created
  - who approved
  - timestamp
  - change history (before/after)

---

## 5) Core Business Processes (End-to-End)

### 5.1 Procure-to-Pay (P2P)
1. Purchase Requisition (PR)
2. Approval (optional mandatory)
3. Purchase Order (PO)
4. Goods Receipt (GRN) into warehouse (with QC hold optional)
5. Supplier Invoice (AP Invoice) referencing GRN
6. Withholding Tax (WHT) calculation if applicable
7. Payment Request + Approval
8. Payment (bank transfer/check)
9. Bank Reconciliation
10. Period Close: AP aging, GR/IR clearing, accruals

### 5.2 Order-to-Cash (O2C)
1. Customer Master / Credit terms
2. Sales Order (optional)
3. Delivery Note / Goods Issue
4. Tax Invoice / Invoice
5. Receipt (cash/bank)
6. AR aging + collection notes
7. Credit Note / Debit Note
8. VAT reporting + e-Tax output

### 5.3 Make/Manufacture-to-Produce (M2P)
1. Demand input (Sales orders / Forecast)
2. MRP suggestion (optional in v1, but recommended)
3. Production Order creation
4. Issue materials (manual issue or backflush)
5. WIP capture (labor, machine, overhead)
6. Receive finished goods into FG warehouse
7. Scrap / rework handling
8. Close production order
9. Post manufacturing variances (if standard costing)

### 5.4 Record-to-Report (R2R)
- Daily journals, auto postings, month-end accruals, depreciation
- Reconciliation (bank, AR, AP, inventory valuation)
- Trial balance, P&L, balance sheet, cash flow
- Period lock + audit export

---

## 6) Functional Requirements (By Module)

> Use requirement IDs to track implementation and testing.

---

# 6A) Master Data & Configuration

## FR-MD-001 Company/Plant Settings
- Single company profile:
  - legal name, tax ID, address, VAT registration
  - default currency (THB)
  - fiscal year start/end, periods
  - numbering series rules per document type
- Single plant profile:
  - plant code, plant address, default warehouses

## FR-MD-002 Chart of Accounts (COA)
- Support hierarchical COA (Level 1–N).
- Support account attributes:
  - type: Asset/Liability/Equity/Revenue/Expense
  - posting allowed: yes/no
  - tax related: VAT/WHT mapping where relevant
- Support COA templates (Thai standard optional).
- Support cost centers / departments.
- Optional: dimensions (Project, Product Line).

## FR-MD-003 Business Partners
### Customers
- customer code, name, tax ID, billing/shipping address
- payment terms, credit limit
- VAT type and default tax invoice settings
### Suppliers
- supplier code, name, tax ID
- payment terms
- WHT default rate & type (service/rent/etc.)

## FR-MD-004 Item Master
- Item types:
  - Raw material (RM)
  - Work-in-process (WIP)
  - Finished goods (FG)
  - Packaging (PK)
  - MRO/Spare parts
  - Service (non-stock)
- Attributes:
  - SKU, name TH/EN, UOM base + conversions
  - VAT type for sales/purchases
  - costing method: FIFO / Moving Average / Standard (configurable global + per item)
  - lot/serial control flag
  - shelf life / expiry tracking (optional)
  - QC required (yes/no)
  - default warehouses and GL accounts mapping (inventory, COGS, variance)

## FR-MD-005 Warehouses & Locations
- Warehouses within plant:
  - RM warehouse
  - WIP warehouse (optional)
  - FG warehouse
  - QC/Quarantine warehouse
  - Scrap warehouse (optional)
- Support bin locations (optional in v1; recommended as design-ready).

## FR-MD-006 BOM & Routing Master
- BOM types:
  - Discrete BOM (components -> finished)
  - Process BOM (inputs -> multiple outputs: main/by-product/co-product)
- Multi-level BOM support.
- Routing:
  - work centers, operation steps
  - standard labor time, machine time
  - setup time, run time
- Validity dates for BOM/routing versions.

## FR-MD-007 Tax Master
- VAT:
  - standard rate, zero rate, exempt
  - domestic, export, import handling flags
- WHT:
  - configurable rates (e.g., 1%, 2%, 3%, 5%, etc.)
  - WHT type/category mapping for reporting
- e-Tax formats output mapping fields.

---

# 6B) Security, Audit & Controls

## FR-SEC-001 Authentication & Sessions
- Support email/username login + password policy.
- Session timeout and forced logout.
- Optional: MFA-ready hooks.

## FR-SEC-002 Authorization (RBAC)
- Permissions:
  - view/create/edit/approve/cancel/print/export
  - per module + per document type
- Segregation rules (configurable):
  - creator cannot approve own document (optional).

## FR-AUD-001 Audit Trail
- Log all:
  - create/update/delete/cancel/post/unpost/approve/reject
  - before/after values for critical fields
- Provide audit log search with filters:
  - date range, user, module, document no., entity id

## FR-CTRL-001 Period Lock
- Period close locks posting:
  - no backdated posting allowed after lock
  - exceptions via Finance Manager override with logging

---

# 6C) General Ledger (GL) & Financial Close

## FR-GL-001 Journal Entries
- Manual journals with:
  - multi-line debit/credit
  - reference fields: document no., partner, cost center, project
  - attachments (PDF/images)
- Validation:
  - debits = credits
  - posting date within open period
- Support recurring journals.

## FR-GL-002 Auto Posting Engine
- Every operational document generates accounting entries using posting rules:
  - sales invoice -> AR, revenue, VAT output
  - purchase invoice -> AP, expense/inventory, VAT input
  - goods receipt -> inventory / GR-IR clearing
  - goods issue -> COGS / inventory
  - production receipt -> FG inventory / WIP
- Posting rules configurable with:
  - account mapping per item group/warehouse/transaction type

## FR-GL-003 Financial Statements
- Trial Balance, General Ledger report, Journal report
- P&L, Balance Sheet
- Cash Flow (direct/indirect optional)

## FR-GL-004 Period Close Checklist
- Close workflow:
  1. Ensure all documents posted
  2. Bank reconciliation complete
  3. Inventory valuation finalized
  4. WIP & production orders closed (as per policy)
  5. Accruals posted
  6. Depreciation run
  7. Lock period
- Provide “Close Status” dashboard.

---

# 6D) Accounts Receivable (AR) & Sales

## FR-AR-001 Sales Documents
- Quotation (optional)
- Sales Order (optional)
- Delivery Note (Goods Issue)
- Invoice / Tax Invoice
- Receipt (cash/bank)
- Credit Note / Debit Note

## FR-AR-002 VAT / Tax Invoice
- Support Thai tax invoice fields:
  - customer tax ID, address
  - tax invoice number series
  - VAT rate and VAT amount
- Support invoice types:
  - full tax invoice
  - receipt/tax invoice combined (if needed)
- Export e-Tax payload-ready data.

## FR-AR-003 Pricing & Discounts
- Price lists per customer or customer group
- Discounts:
  - line discount
  - document discount
- Promotions optional (v2)

## FR-AR-004 AR Aging & Collections
- Aging buckets configurable (0–30, 31–60, etc.)
- Collection notes and follow-up reminders
- Credit limit enforcement:
  - block new invoices / warn only (configurable)

## FR-AR-005 Accounting Postings
- On invoice post:
  - Dr AR
  - Cr Revenue
  - Cr VAT output (if applicable)
- On receipt:
  - Dr Bank/Cash
  - Cr AR
- Credit note reversals.

---

# 6E) Accounts Payable (AP) & Purchasing

## FR-AP-001 Purchasing Documents
- Purchase Requisition (PR)
- Purchase Order (PO)
- Goods Receipt Note (GRN)
- Supplier Invoice (AP Invoice)
- Debit Note / Credit Note
- Payment Request (optional)
- Payment

## FR-AP-002 Three-Way Match (Recommended)
- PO ↔ GRN ↔ AP Invoice
- Tolerances configurable:
  - quantity tolerance
  - price tolerance
- Exceptions require approval.

## FR-AP-003 WHT Handling
- For AP invoices (service/rent/etc.):
  - calculate WHT based on configured rate
  - generate WHT certificate data (หนังสือรับรองหัก ณ ที่จ่าย)
- Support multiple WHT lines/types per invoice if needed.

## FR-AP-004 Accounting Postings
- GRN:
  - Dr Inventory
  - Cr GR/IR clearing (or AP accrual)
- AP invoice:
  - Dr GR/IR clearing (or expense/inventory)
  - Dr VAT input
  - Cr AP
- Payment:
  - Dr AP
  - Cr Bank
  - WHT payable handling:
    - Cr WHT payable (if withheld)
    - later settlement to revenue dept

---

# 6F) Cash & Bank

## FR-CB-001 Bank Accounts & Cash Boxes
- Multiple bank accounts (same company)
- Cash-on-hand management (petty cash)

## FR-CB-002 Payment Methods
- bank transfer
- check
- cash
- QR/payment link reference field (optional)

## FR-CB-003 Payment Run (Batch)
- Select AP due items by:
  - due date range, supplier, amount
- Generate payment proposal -> approval -> execute
- Export bank file (format configurable; exact format can be implemented per bank requirement later)

## FR-CB-004 Bank Reconciliation
- Import bank statement (CSV/Excel)
- Match rules:
  - exact amount + date tolerance + reference
  - manual match
- Unmatched items create bank charges/interest journals.

---

# 6G) Tax Module (Thailand)

## FR-TAX-001 VAT Processing
- VAT input/output tracking at document level
- VAT reports:
  - Purchase VAT report
  - Sales VAT report
  - VAT summary for filing (ภพ.30)
- Support VAT scenarios:
  - standard VAT
  - zero-rated (export)
  - exempt items (no VAT)

## FR-TAX-002 Withholding Tax (WHT)
- WHT certificates:
  - generate printable certificate
  - track issuance date, supplier, tax type, base amount, withheld amount
- WHT reports:
  - summary by type and period
  - prepare data exports for filing (ภงด.3 / ภงด.53)

## FR-TAX-003 e-Tax Invoice / e-Receipt (Data Readiness)
- System must store all required fields for e-Tax export:
  - seller/buyer tax IDs, addresses
  - document number, date/time
  - line items, VAT, totals
  - references (credit note referencing invoice)
- Export format:
  - JSON or XML-mappable payload (exact schema can be implemented to match provider later)

## FR-TAX-004 Tax Period Lock
- Once VAT/WHT reports are finalized and filed, lock tax period optionally.

---

# 6H) Inventory (Warehouse Management)

## FR-INV-001 Stock Movements
- Goods receipt (from purchasing)
- Goods issue (to production / sales / scrap)
- Transfers between warehouses
- Stock adjustments (with reason codes)
- Stock count (cycle count and full count)
- Return to supplier / return from customer (optional v2)

## FR-INV-002 Lot/Serial Tracking
- Configure by item:
  - none
  - lot tracking
  - serial tracking
- Lot attributes:
  - manufacture date, expiry date
  - supplier lot, internal lot
- Traceability:
  - forward trace: lot -> finished goods deliveries
  - backward trace: finished lot -> RM lots consumed

## FR-INV-003 QC / Quarantine Flow
- Receiving into QC hold warehouse
- QC inspection record:
  - pass -> release to RM warehouse
  - fail -> move to scrap / return
- QC status must block consumption until released.

## FR-INV-004 Valuation
- Valuation method (configurable):
  - Moving Average (recommended)
  - FIFO
  - Standard cost
- Inventory valuation report per warehouse and overall.

## FR-INV-005 Reorder & Min/Max
- Set min/max and reorder point per item per warehouse.
- Alerts/dashboard for low stock.

---

# 6I) Manufacturing (Production)

## FR-MFG-001 Production Order Lifecycle
- Create production order:
  - product, quantity, due date
  - BOM version, routing version
  - planned start/end
- Status:
  - Draft -> Released -> In Process -> Completed -> Closed
- Each status change logged.

## FR-MFG-002 Material Issue to Production
- Manual issue:
  - issue RM from warehouse to production order
- Backflush (optional):
  - auto-consume RM upon FG receipt based on BOM standard qty
- Support substitutions:
  - allow alternate items with approval and traceability

## FR-MFG-003 WIP Tracking
- Capture:
  - labor time (manual entry)
  - machine time (manual or imported)
  - overhead application (rate-based)
- WIP inventory accounts:
  - RM issued to WIP
  - WIP cleared to FG at completion

## FR-MFG-004 Finished Goods Receipt
- Receive FG into FG warehouse
- Optional: receive into QC hold then release

## FR-MFG-005 Scrap & Rework
- Scrap recording:
  - scrap qty + reason code
  - scrap cost handling policy:
    - included in unit cost or posted to scrap expense (config)
- Rework:
  - create rework order linked to original order
  - track additional materials/labor

## FR-MFG-006 Process BOM Outputs (Recommended)
- Support multiple outputs:
  - main product
  - by-product/co-product
- Cost allocation methods:
  - by quantity
  - by standard value
  - by net realizable value (NRV) (optional)

## FR-MFG-007 MRP (Optional but recommended)
- Input: demand (sales orders/forecast), inventory on-hand, open POs, open production
- Output:
  - planned production orders
  - planned purchase requisitions
- Provide planner workbench.

---

# 6J) Costing (Manufacturing Accounting)

## FR-COST-001 Cost Components
- Material
- Labor
- Overhead (variable/fixed)
- Subcontract (optional)

## FR-COST-002 Costing Methods
- Support configuration by item group:
  1. Actual costing (recommended for early phase)
  2. Standard costing + variance
  3. Moving average (inventory) with production actual accumulation
- System must allow switching method only with strong controls.

## FR-COST-003 Overhead Allocation
- Overhead rate definition:
  - per labor hour
  - per machine hour
  - per unit
  - per batch
- Support cost center-based overhead rates.

## FR-COST-004 Production Cost Rollup
- Compute planned standard cost from BOM + routing:
  - material standard
  - labor standard
  - overhead standard
- For actual:
  - sum issued material + actual labor + applied overhead

## FR-COST-005 Variance Analysis (if standard costing enabled)
- Material price variance (MPV)
- Material usage variance (MUV)
- Labor rate/efficiency variance
- Overhead spending/volume variance
- Post to variance accounts at order close and report by period.

## FR-COST-006 WIP & Inventory Accounting
- Ensure correct GL postings:
  - RM inventory -> WIP -> FG inventory -> COGS
- Provide reconciliation reports:
  - Inventory subledger vs GL
  - WIP subledger vs GL

---

# 6K) Fixed Assets (Basic)

## FR-FA-001 Asset Register
- Asset master:
  - acquisition date, cost, vendor
  - location/cost center
  - depreciation method: straight-line (min v1)
  - useful life, salvage value

## FR-FA-002 Depreciation Run
- Monthly depreciation posting:
  - Dr Depreciation expense
  - Cr Accumulated depreciation
- Disposal:
  - compute gain/loss, post entries

---

# 6L) Approvals & Workflow

## FR-WF-001 Approval Framework
- Configurable approval flows per document type:
  - PR, PO, AP Invoice, Payment, Credit Note, Stock Adjustment, Production Scrap
- Approval conditions:
  - amount thresholds
  - item category
  - cost center
- Actions:
  - approve / reject with reason
  - return for edit
- Approved-only posting controls:
  - only approved documents can affect stock/GL (configurable)

## FR-WF-002 Notifications
- In-app notification list
- Email notification hooks (optional)
- Reminder for pending approvals

---

# 6M) Reporting & Analytics

## FR-RPT-001 Standard Reports (Minimum Set)

### Finance
- Trial balance
- General ledger detail
- P&L, Balance sheet
- Journal listing
- AR aging, AP aging
- GR/IR clearing report
- Bank reconciliation summary

### Tax
- VAT Purchase report
- VAT Sales report
- VAT filing summary (ภพ.30)
- WHT certificates list
- WHT filing summary (ภงด.3/53)

### Inventory
- Stock on hand by warehouse
- Stock movement (card) by item/lot
- Inventory valuation
- Reorder report
- Stock count variance

### Manufacturing & Costing
- Production order status report
- Material consumption vs BOM
- WIP aging
- Production yield & scrap report
- Cost per order / unit cost report
- Variance report (if standard costing)

## FR-RPT-002 Report Builder (Optional)
- Allow finance users to create custom reports with filters and export.

## FR-RPT-003 Export
- Export to Excel/CSV/PDF
- Role-based control on exports

---

# 6N) Document & Data Management

## FR-DOC-001 Attachments
- Allow attaching files to:
  - invoices, receipts, GRN, PO, journals, production orders
- Store metadata:
  - filename, uploader, timestamp

## FR-DOC-002 Document Numbering
- Number series per document type:
  - configurable prefix, padding, yearly reset option

## FR-DOC-003 Cancellation & Reversal
- Documents cannot be deleted after posting.
- Cancellation creates reversal entries:
  - inventory reversal transactions
  - accounting reversal journals
- Cancellation requires permission + reason.

---

## 7) Data Model (Core Entities)

> This is logical model; implementation can be normalized DB tables.

### 7.1 Master Entities
- `Company`
- `Plant`
- `User`, `Role`, `Permission`
- `ChartAccount`
- `CostCenter`
- `Customer`, `Supplier`
- `Item`, `ItemUom`, `ItemGroup`
- `Warehouse`, `Bin` (optional)
- `TaxCode`, `WhtCode`
- `BomHeader`, `BomLine`
- `RoutingHeader`, `RoutingOperation`
- `WorkCenter`
- `OverheadRate`

### 7.2 Transaction Entities (Operations)
- Purchasing:
  - `PurchaseRequisition` + lines
  - `PurchaseOrder` + lines
  - `GoodsReceipt` + lines (GRN)
  - `ApInvoice` + lines
  - `ApPayment`
- Sales:
  - `SalesOrder` + lines (optional)
  - `Delivery` + lines
  - `ArInvoice` + lines (Tax Invoice)
  - `ArReceipt`
  - `CreditNote` / `DebitNote`
- Inventory:
  - `StockMove` (receipt/issue/transfer/adjust)
  - `StockLot` / `Serial`
  - `StockCount` + lines
  - `QcInspection` + results
- Manufacturing:
  - `ProductionOrder` + lines
  - `MaterialIssue` + lines
  - `ProductionConfirmation` (labor/machine/scrap)
  - `FgReceipt` + lines
- Finance:
  - `JournalEntry` + lines
  - `BankStatement` + lines
  - `ReconciliationMatch`

### 7.3 Accounting Subledger Linkage
- Each operational doc line should store:
  - `gl_posted_flag`
  - `gl_journal_id` link
  - `posted_at`, `posted_by`

---

## 8) Posting Rules (Accounting Integration)

### 8.1 Key Accounts (Configurable)
- Inventory RM
- Inventory WIP
- Inventory FG
- GR/IR clearing
- AR control
- AP control
- VAT input
- VAT output
- WHT payable
- Revenue
- COGS
- Scrap expense
- Variance accounts (if standard costing)

### 8.2 Posting Examples (Minimum)
- **GRN (RM receipt)**  
  - Dr Inventory RM  
  - Cr GR/IR Clearing
- **AP Invoice for materials**  
  - Dr GR/IR Clearing  
  - Dr VAT Input  
  - Cr AP
- **Issue RM to production (manual issue)**  
  - Dr WIP  
  - Cr Inventory RM
- **Receive FG from production**  
  - Dr Inventory FG  
  - Cr WIP
- **Ship goods (delivery issue)**  
  - Dr COGS  
  - Cr Inventory FG
- **AR Invoice**  
  - Dr AR  
  - Cr Revenue  
  - Cr VAT Output
- **Receipt**  
  - Dr Bank  
  - Cr AR
- **WHT on service invoice**  
  - Dr Expense  
  - Dr VAT Input (if applicable)  
  - Cr AP  
  - Cr WHT Payable (withheld)
- **WHT remittance**  
  - Dr WHT Payable  
  - Cr Bank

---

## 9) Validation & Business Rules

### 9.1 General
- No posting into locked period.
- No negative stock unless explicitly enabled per warehouse/item.
- Lot/serial required if item flagged.
- QC hold blocks consumption/shipping.

### 9.2 Purchasing
- AP invoice cannot exceed PO/GRN beyond tolerance without approval.
- WHT cannot be applied to items flagged “no WHT”.

### 9.3 Manufacturing
- Cannot complete production order unless:
  - required confirmations present (configurable)
  - material issue posted or backflush executed
- Scrap requires reason code.
- Substitution requires approval (optional).

### 9.4 Finance
- Journal must balance.
- Multi-currency rounding rules (if enabled).

---

## 10) API Requirements (Internal/External Hooks)

> Keep REST-like. Exact path names can be adapted, but entities should be addressable.

### 10.1 Common
- `GET /health` (functional health, no infra details)
- Auth:
  - `POST /auth/login`
  - `POST /auth/logout`
- Master data:
  - `GET/POST/PUT /items`
  - `GET/POST/PUT /suppliers`
  - `GET/POST/PUT /customers`
  - `GET/POST/PUT /accounts`

### 10.2 Operations
- Purchasing:
  - `POST /pr`
  - `POST /po`
  - `POST /grn`
  - `POST /ap-invoice`
  - `POST /ap-payment`
- Sales:
  - `POST /delivery`
  - `POST /ar-invoice`
  - `POST /ar-receipt`
- Inventory:
  - `POST /stock-move`
  - `POST /stock-count`
  - `POST /qc-inspection`
- Manufacturing:
  - `POST /production-order`
  - `POST /material-issue`
  - `POST /production-confirmation`
  - `POST /fg-receipt`
- Finance:
  - `POST /journal`
  - `POST /bank-statement/import`
  - `POST /bank-reconcile/match`

### 10.3 IoT/Barcode/Machine Data Hooks (Optional v1 but design-ready)
- `POST /integrations/barcode-scan`
- `POST /integrations/production-metrics`
  - payload: work center, timestamp, qty good, qty scrap, downtime mins, operator id

---

## 11) UX / Screens (Minimum)

### 11.1 Navigation
- Dashboard:
  - pending approvals
  - low stock alerts
  - AR/AP due today
  - production orders status

### 11.2 Core Screens
- Master: Items, BOM, Routing, Partners, COA
- Purchasing: PR/PO/GRN/AP invoice/payment
- Sales: Delivery/Invoice/Receipt/Credit note
- Inventory: stock inquiry, lot trace, stock moves, counts, QC
- Manufacturing: production order list, issue, confirm, receive
- Finance: journals, reports, close checklist
- Tax: VAT report, WHT certificates, filing exports
- Audit: logs, document history

---

## 12) Non-Functional Requirements (No Deployment Spec)

### 12.1 Performance
- Typical operations should respond within 2–3 seconds for common actions.
- Reports: allow background generation for heavy reports (optional).

### 12.2 Security
- Password policy, account lockout, audit logs.
- Sensitive data masking for users without permission (tax ID, bank account).

### 12.3 Data Integrity
- Transactional consistency between subledgers and GL.
- Idempotency for import endpoints (avoid duplicate postings).

### 12.4 Availability / Backup
- Not specified here (deployment responsibility), but system must support:
  - export/backup of data
  - restore procedures (functional requirements can be added later)

---

## 13) Testing & Acceptance Criteria

### 13.1 Core Acceptance Tests (Examples)
- P2P happy path:
  - PR -> PO -> GRN -> AP invoice -> payment -> bank reconciliation
  - GL postings correct; VAT input correct; WHT correct
- O2C happy path:
  - delivery -> tax invoice -> receipt
  - VAT output correct; AR aging correct
- Manufacturing:
  - production order -> issue materials -> receive FG
  - inventory changes correct; WIP cleared; FG cost correct
- Closing:
  - lock period prevents posting
  - unlock requires authorization and logs

### 13.2 Reconciliation
- Inventory valuation matches GL inventory account within tolerance.
- GR/IR clearing reconciles to zero (or explained open items).

---

## 14) Implementation Notes (Optional Guidance for AI Coder)
- Prefer event-driven posting internally (document posted -> accounting event).
- Maintain immutable posted documents; reversals instead of deletion.
- Keep a unified `Document` metadata model:
  - document type, number, status, created/approved/posted timestamps
- Use consistent status state machines per module.

---

## 15) Deliverables
- Database schema + migrations
- REST API + validations
- UI screens as listed
- Posting engine + configuration UI
- Report outputs + export
- Test suite for acceptance tests

---

## Appendix A) Suggested Document Types & Statuses

### Purchasing
- PR: Draft -> Submitted -> Approved/Rejected -> Closed
- PO: Draft -> Approved -> Sent -> Partially Received -> Closed
- GRN: Draft -> Posted -> Cancelled
- AP Invoice: Draft -> Approved -> Posted -> Paid -> Cancelled

### Manufacturing
- Production Order: Draft -> Released -> In Process -> Completed -> Closed

### Finance
- Journal: Draft -> Posted -> Reversed

---

## Appendix B) Thai Compliance Checklist (Data Support)
- VAT reports (ภาษีซื้อ/ภาษีขาย)
- VAT filing summary (ภพ.30)
- Withholding tax certificates + summary (ภงด.3/53)
- Tax invoice numbering series and legal fields
- e-Tax export-ready fields (provider integration later)

---
