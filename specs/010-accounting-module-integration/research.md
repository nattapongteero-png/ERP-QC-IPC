# Research: Accounting Module Integration

**Date**: 2025-12-25
**Feature**: 010-accounting-module-integration

## Research Summary

This document consolidates all technical decisions and research findings for the Accounting Module implementation.

---

## 1. Thai Chart of Accounts Structure

### Decision
Use a 4-digit account code structure following Thai Accounting Standards (TAS) conventions:
- 1xxx: Assets
- 2xxx: Liabilities
- 3xxx: Equity
- 4xxx: Revenue
- 5xxx: Cost of Goods Sold
- 6xxx: Operating Expenses
- 7xxx: Other Income
- 8xxx: Other Expenses
- 9xxx: Tax Accounts

### Rationale
- Aligns with Thai Federation of Accounting Professions (TFAC) guidelines
- Matches common Thai accounting software (Express, SAP Thailand, Oracle Thailand)
- 4 digits provide enough granularity (1000 accounts per category) while remaining readable
- First digit identifies account type for balance sheet/income statement classification

### Alternatives Considered
1. **5-digit codes**: More granular but harder to memorize; rejected as overkill for SME
2. **3-digit codes**: Too limiting (100 accounts per category); rejected
3. **Custom numbering**: Non-standard, makes auditor review harder; rejected

### Default Template Accounts
```
1100 - Cash and Bank
1110 - Petty Cash
1120 - Bank - Current Account
1200 - Accounts Receivable
1210 - Trade Receivables
1220 - Other Receivables
1300 - Inventory
1310 - Raw Materials
1320 - Work in Progress
1330 - Finished Goods
1400 - Prepaid Expenses
1500 - Fixed Assets
1510 - Land
1520 - Buildings
1530 - Machinery and Equipment
1540 - Vehicles
1550 - Furniture and Fixtures
1560 - Accumulated Depreciation

2100 - Accounts Payable
2110 - Trade Payables
2120 - Other Payables
2200 - Accrued Expenses
2210 - Accrued Payroll
2220 - Accrued Taxes
2300 - VAT Payable
2310 - Output VAT
2320 - Input VAT
2400 - Withholding Tax Payable
2500 - Loans and Borrowings

3100 - Share Capital
3200 - Retained Earnings
3300 - Current Year Profit/Loss

4100 - Sales Revenue
4110 - Product Sales
4120 - Service Revenue

5100 - Cost of Goods Sold
5110 - Material Cost
5120 - Direct Labor
5130 - Manufacturing Overhead

6100 - Selling Expenses
6200 - Administrative Expenses
6210 - Salaries and Wages
6220 - Depreciation Expense
6230 - Utilities
6240 - Rent

7100 - Other Income
7110 - Interest Income
7120 - Gain on Asset Disposal

8100 - Other Expenses
8110 - Interest Expense
8120 - Loss on Asset Disposal

9100 - Corporate Income Tax
```

---

## 2. Thai VAT Implementation

### Decision
Implement standard Thai VAT at 7% with:
- Automatic Input VAT calculation on purchases (deductible)
- Automatic Output VAT calculation on sales (collectible)
- VAT transaction register for Por Por 30 filing
- Tax invoice number generation with branch code support

### Rationale
- 7% is the current Thai VAT rate (since 2021, extended annually)
- Thai Revenue Department requires separate Input/Output VAT tracking
- Tax invoice numbering is mandatory for VAT-registered businesses

### Tax Invoice Number Format
```
Format: TTTTTT-BBBBB-YYYYMM-NNNNNN
- TTTTTT: Tax ID (company's 10-digit tax ID, first 6 shown)
- BBBBB: Branch code (00000 for HQ)
- YYYYMM: Year and month
- NNNNNN: Sequential number (reset monthly)

Example: 012345-00000-202512-000001
```

### VAT Calculation Rules
1. **Standard rate**: 7% of taxable amount
2. **Zero-rated (0%)**: Exports, international transport
3. **Exempt**: Basic necessities, education, healthcare (not applicable to this herbal medicine company)
4. **Not in scope**: Non-business transactions

### VAT Register Fields (Por Por 30 format)
- Tax invoice number and date
- Seller/Buyer name and tax ID
- Taxable amount (before VAT)
- VAT amount
- Total amount (including VAT)

---

## 3. Thai Withholding Tax Implementation

### Decision
Implement WHT calculation based on payment type with automatic certificate generation (Por Ngor Dor 3/53).

### Rationale
- Thai Revenue Code mandates WHT on various payments
- Failure to withhold results in penalties on the payer
- Certificates must be issued to payees for their tax credits

### WHT Rates by Payment Type
| Payment Type | Rate | Code |
|--------------|------|------|
| Dividends | 10% | 40(4)b |
| Interest | 15% | 40(4)a |
| Rent - Property | 5% | 40(5)a |
| Rent - Other | 5% | 40(5)b |
| Professional Services | 3% | 40(6) |
| Contractor/Subcontractor | 3% | 40(7) |
| Advertising | 2% | 40(8) |
| Transport | 1% | 40(8) |
| Insurance Premium | 1% | 40(8) |
| Other Services | 3% | 40(8) |

### Certificate Types
- **Por Ngor Dor 3**: For individuals (natural persons)
- **Por Ngor Dor 53**: For companies (juristic persons)

### Implementation
- WHT type configuration table with rates
- Automatic calculation on vendor payment
- Certificate generation with proper format
- Monthly WHT report for Por Ngor Dor 3/53 filing

---

## 4. Thai Revenue Code Depreciation

### Decision
Implement depreciation using Thai Revenue Code standard useful lives with straight-line and declining balance methods.

### Rationale
- Thai Revenue Code Section 65 bis(2) specifies maximum depreciation rates
- Non-compliance results in non-deductible expenses for tax purposes
- Most Thai companies use tax-basis depreciation for simplicity

### Useful Lives (Thai Revenue Code)
| Asset Category | Max Rate | Min Years |
|----------------|----------|-----------|
| Buildings (permanent) | 5% | 20 |
| Buildings (temporary) | 10% | 10 |
| Machinery (general) | 20% | 5 |
| Machinery (high-tech) | 40% | 2.5 |
| Vehicles | 20% | 5 |
| Furniture & Fixtures | 20% | 5 |
| Computer Equipment | 33.33% | 3 |
| Software | 33.33% | 3 |
| Intangible Assets | 10% | 10 |

### Depreciation Methods
1. **Straight-line**: (Cost - Salvage) / Useful Life
2. **Declining Balance**: Book Value × Rate (capped at straight-line amount)

### Implementation
- Asset category table with default rates and lives
- Monthly depreciation calculation
- Automatic journal entry generation
- Net book value tracking

---

## 5. FIFO Cost Flow Integration

### Decision
Continue using FIFO (First-In, First-Out) for inventory valuation, extending to manufacturing cost accounting.

### Rationale
- Existing inventory module uses FIFO for lot tracking
- FIFO is accepted by Thai Accounting Standards
- Aligns with manufacturing's material consumption pattern

### Integration Points
- Raw material issue to production: FIFO cost from inventory lots
- WIP valuation: Material cost + labor + overhead
- Finished goods receipt: Transfer from WIP at actual cost

### Cost Flow Example
```
Batch #001:
  Materials consumed (FIFO from lots):
    Lot A: 100 units @ 50 THB = 5,000 THB
    Lot B: 50 units @ 52 THB = 2,600 THB
  Direct Labor:
    10 hours @ 200 THB/hr = 2,000 THB
  Manufacturing Overhead:
    10 hours × 100 THB/hr (rate) = 1,000 THB
  Total Cost: 10,600 THB
  Units Produced: 150
  Unit Cost: 70.67 THB
```

---

## 6. Journal Entry Automation

### Decision
Implement automatic journal entry creation at key transaction points:

| Trigger | Debit | Credit |
|---------|-------|--------|
| PO Receipt | Inventory (1300) | AP (2100) |
| PO Receipt (VAT) | Input VAT (2320) | AP (2100) |
| AP Payment | AP (2100) | Cash/Bank (1100) |
| AP Payment (WHT) | AP (2100) | WHT Payable (2400) + Cash |
| SO Shipment | AR (1200) | Revenue (4100) |
| SO Shipment (VAT) | AR (1200) | Output VAT (2310) |
| SO Shipment (COGS) | COGS (5100) | Inventory (1300) |
| AR Receipt | Cash/Bank (1100) | AR (1200) |
| Material Issue | WIP (1320) | Raw Materials (1310) |
| FG Receipt | Finished Goods (1330) | WIP (1320) |
| Depreciation | Depreciation Exp (6220) | Accum Depr (1560) |
| Payroll | Payroll Expense (6210) | Payroll Payable (2210) |

### Rationale
- Automation ensures GL stays synchronized with operational modules
- Reduces manual data entry and errors
- Provides real-time financial visibility

### Implementation
- Service function `createAutoJournalEntry()` called from transaction points
- Source document reference stored for audit trail
- Journal entries created in draft status for review option (configurable)

---

## 7. Financial Statement Generation

### Decision
Generate TFRS-compliant financial statements using account type classification and GL balance aggregation.

### Rationale
- TFRS for SMEs is mandatory for Thai companies
- Standard format expected by banks, auditors, government agencies
- Comparative reporting required for year-over-year analysis

### Balance Sheet Format (TFRS)
```
ASSETS
  Current Assets
    Cash and Cash Equivalents
    Trade and Other Receivables
    Inventories
    Other Current Assets
  Non-Current Assets
    Property, Plant and Equipment (Net)
    Intangible Assets
    Other Non-Current Assets
  TOTAL ASSETS

LIABILITIES
  Current Liabilities
    Trade and Other Payables
    Current Portion of Long-term Debt
    Other Current Liabilities
  Non-Current Liabilities
    Long-term Borrowings
    Other Non-Current Liabilities
  TOTAL LIABILITIES

EQUITY
  Share Capital
  Retained Earnings
  TOTAL EQUITY

TOTAL LIABILITIES AND EQUITY
```

### Income Statement Format (TFRS)
```
Revenue from Sales
Less: Cost of Goods Sold
GROSS PROFIT

Less: Selling and Distribution Expenses
Less: Administrative Expenses
OPERATING PROFIT

Add: Other Income
Less: Other Expenses
Less: Finance Costs
PROFIT BEFORE TAX

Less: Income Tax Expense
NET PROFIT FOR THE PERIOD
```

### Cash Flow Statement (Indirect Method)
```
OPERATING ACTIVITIES
  Net Profit Before Tax
  Adjustments:
    Depreciation and Amortization
    Interest Expense
    (Gain)/Loss on Asset Disposal
  Changes in Working Capital:
    (Increase)/Decrease in Receivables
    (Increase)/Decrease in Inventories
    Increase/(Decrease) in Payables
  Cash from Operations
  Less: Income Tax Paid
  Net Cash from Operating Activities

INVESTING ACTIVITIES
  Purchase of Fixed Assets
  Proceeds from Sale of Assets
  Net Cash from Investing Activities

FINANCING ACTIVITIES
  Proceeds from Borrowings
  Repayment of Borrowings
  Dividends Paid
  Net Cash from Financing Activities

NET CHANGE IN CASH
Add: Cash at Beginning of Period
CASH AT END OF PERIOD
```

---

## 8. Module Integration Strategy

### Decision
Hook into existing module events rather than polling or batch processing.

### Rationale
- Real-time GL updates
- Minimal changes to existing code
- Clear separation of concerns

### Integration Points

#### Purchasing Module
**File**: `src/lib/services/purchasing.service.ts`
**Function**: `receivePurchaseOrder()`
**Hook Point**: After successful receipt, call `createAPInvoiceFromPO()`

```typescript
// After inventory receipt is complete
const apInvoice = await accountingService.createAPInvoiceFromPO(poId, userId);
// AP invoice is created in draft status
```

#### Sales Module
**File**: `src/lib/services/sales.service.ts`
**Function**: `shipSalesOrder()` (to be added)
**Hook Point**: After successful shipment, call `createARInvoiceFromSO()`

```typescript
// After shipment is recorded
const arInvoice = await accountingService.createARInvoiceFromSO(soId, userId);
// AR invoice is created with auto-generated tax invoice number
```

#### Inventory Module
**File**: `src/lib/services/inventory.service.ts`
**Function**: `issueMaterial()` (for production)
**Hook Point**: After material issue, record cost to WIP

```typescript
// After material issued to production
await accountingService.recordMaterialCost(batchId, lotCosts);
```

#### HR Module
**File**: `src/lib/services/hr.service.ts`
**Function**: `completePayrollRun()` (to be added when payroll implemented)
**Hook Point**: After payroll approved, create JE

```typescript
// After payroll run approved
await accountingService.createPayrollJournalEntry(payrollRunId, userId);
```

---

## 9. Period Management

### Decision
Implement monthly periods with optional quarterly aggregation and flexible fiscal year support.

### Rationale
- VAT and WHT filed monthly in Thailand
- Quarterly reports useful for management
- Some Thai entities use Oct-Sep fiscal year (government contracts)

### Period States
1. **Open**: Transactions can be posted
2. **Soft Closed**: Warning on posting, but allowed with authorization
3. **Closed**: No posting allowed
4. **Year-End Closed**: Net income transferred to retained earnings

### Year-End Process
1. Run closing validation (no unposted JEs, balanced accounts)
2. Calculate net income (Revenue - Expenses)
3. Create closing journal entry:
   - Debit all revenue accounts (close to zero)
   - Credit all expense accounts (close to zero)
   - Credit/Debit Retained Earnings for net income/loss
4. Mark year as closed
5. Create opening balances for new year (asset, liability, equity accounts)

---

## 10. Equipment Maintenance Integration

### Decision
Extend fixed assets with equipment-specific fields and separate maintenance tracking.

### Rationale
- Manufacturing equipment needs operational tracking beyond financial depreciation
- Maintenance costs feed into overhead allocation
- MTBF analysis requires detailed history

### Equipment Fields (extends Fixed Asset)
- Serial number
- Manufacturer and model
- Warranty start/end dates
- Operating hours (meter reading)
- Assigned operator
- Location (production line/area)

### Maintenance Schedule Types
1. **Calendar-based**: Every N days/weeks/months
2. **Hours-based**: Every N operating hours
3. **Usage-based**: Every N units produced

### Maintenance Record Fields
- Equipment reference
- Maintenance type (preventive, corrective, emergency)
- Description of work performed
- Parts used (links to inventory items)
- Labor hours and cost
- External service cost
- Downtime hours
- Next scheduled maintenance

### Cost Treatment
- **Minor repairs** (< threshold): Expense immediately to maintenance expense account
- **Major repairs** (>= threshold): Capitalize and depreciate over remaining life
- **Improvements**: Capitalize and extend useful life

---

## 11. Security and Permissions

### Decision
Create new `accounting` role with granular permissions.

### Rationale
- Separation of duties (Thai regulatory expectation)
- Different access levels for accountants, managers, auditors

### Permission Matrix
| Permission | Accountant | Accounting Manager | CFO | Auditor |
|------------|------------|-------------------|-----|---------|
| View COA | Yes | Yes | Yes | Yes |
| Edit COA | No | Yes | Yes | No |
| Create JE | Yes | Yes | Yes | No |
| Post JE | No | Yes | Yes | No |
| Reverse JE | No | Yes | Yes | No |
| View Invoices | Yes | Yes | Yes | Yes |
| Approve AP | No | Yes | Yes | No |
| Approve AR | No | Yes | Yes | No |
| Record Payment | Yes | Yes | Yes | No |
| Close Period | No | Yes | Yes | No |
| Reopen Period | No | No | Yes | No |
| View Reports | Yes | Yes | Yes | Yes |
| Manage Assets | Yes | Yes | Yes | No |
| Run Depreciation | No | Yes | Yes | No |
| Dispose Assets | No | Yes | Yes | No |

---

## 12. Database Schema Decisions

### Decision
Add 18 new tables following existing dual-schema (SQLite/MySQL) pattern.

### Tables to Create

1. **gl_accounts** - Chart of accounts
2. **gl_account_types** - Account classification
3. **journal_entries** - Journal entry headers
4. **journal_lines** - Journal entry lines
5. **ap_invoices** - Accounts payable invoices
6. **ap_invoice_lines** - AP invoice line items
7. **ar_invoices** - Accounts receivable invoices
8. **ar_invoice_lines** - AR invoice line items
9. **payments** - Payment records (AP and AR)
10. **payment_allocations** - Payment to invoice allocation
11. **fiscal_periods** - Accounting periods
12. **fiscal_years** - Fiscal year definitions
13. **vat_transactions** - VAT register
14. **wht_transactions** - WHT records
15. **fixed_assets** - Fixed asset register
16. **asset_categories** - Asset classification
17. **asset_depreciation** - Depreciation records
18. **asset_disposals** - Disposal records
19. **equipment** - Equipment master (extends fixed assets)
20. **maintenance_schedules** - Maintenance plans
21. **maintenance_records** - Maintenance events

### Indexes
- `gl_accounts(code)` - UNIQUE
- `journal_entries(entry_number)` - UNIQUE
- `journal_entries(entry_date, status)` - For period queries
- `ap_invoices(invoice_number)` - UNIQUE
- `ar_invoices(tax_invoice_number)` - UNIQUE
- `vat_transactions(tax_invoice_number, tax_period)`
- `fixed_assets(asset_code)` - UNIQUE
- `equipment(serial_number)` - INDEX

---

## Research Complete

All technical decisions have been documented. No unresolved NEEDS CLARIFICATION items remain.

**Next Phase**: data-model.md (entity definitions)
