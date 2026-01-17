# Accounting Financial Reports Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create implementation plan, then superpowers:subagent-driven-development to execute.

**Goal:** Create four dedicated, robust financial report pages with Thai regulatory compliance, multi-period comparison, drill-down navigation, and executive dashboard features.

**Target Audience:** Accountants, CFO, auditors, Thai Revenue Department compliance

**Report Pages:**
- `/accounting/reports/trial-balance`
- `/accounting/reports/balance-sheet`
- `/accounting/reports/income-statement`
- `/accounting/reports/cash-flow`

---

## Design Decisions

| Feature | Choice |
|---------|--------|
| Detail Level | Thai FDA/GMP Compliance - regulatory-ready |
| Export Formats | PDF, Excel, CSV |
| Comparative Periods | Multi-period (up to 6-12 columns) |
| Drill-Down | Full navigation to GL ledger |
| Visualization | Tables + Charts + KPI Cards |
| Language | Bilingual toggle (Thai/English) |

---

## 1. Architecture & Shared Components

### File Structure

```
/accounting/reports/
├── trial-balance/page.tsx      → Trial Balance Report
├── balance-sheet/page.tsx      → Balance Sheet Report
├── income-statement/page.tsx   → Income Statement Report
├── cash-flow/page.tsx          → Cash Flow Statement
└── _components/                 → Shared report components
    ├── ReportHeader.tsx         → Title, period selector, language toggle
    ├── ReportKPICards.tsx       → Key metrics row
    ├── ReportToolbar.tsx        → Export buttons (PDF/Excel/CSV), print
    ├── ReportPeriodSelector.tsx → Date pickers + period presets
    ├── DrillDownLink.tsx        → Clickable amounts → GL ledger
    └── ReportChartSection.tsx   → Trend charts wrapper
```

### Shared Services

- Existing `accounting-reports.service.ts` handles data generation
- New `report-export.service.ts` for PDF/Excel/CSV generation
- Language context via React Context for bilingual toggle

### Data Flow

1. User selects periods (up to 12 months/quarters)
2. API fetches data for all selected periods in parallel
3. Data normalized into comparison format
4. Render with drill-down links to `/accounting/gl-accounts/[id]`

---

## 2. Trial Balance Report

### Purpose
Complete listing of all GL accounts with opening, period activity, and closing balances. Foundation for all other reports.

### KPI Cards

| Metric | Description |
|--------|-------------|
| Total Debits | Sum of all debit balances |
| Total Credits | Sum of all credit balances |
| Variance | Should be ฿0 (balance check) |
| Account Count | Active accounts with activity |
| Out-of-Balance Warning | Red alert if debits ≠ credits |

### Period Selector

- As-of Date picker
- Quick presets: Today, Month-end, Quarter-end, Year-end
- Multi-period: Compare up to 6 periods side-by-side

### Table Columns

| Account Code | Account Name | Opening Debit | Opening Credit | Period Debit | Period Credit | Closing Debit | Closing Credit |
|--------------|--------------|---------------|----------------|--------------|---------------|---------------|----------------|

- Grouped by account type (Assets → Liabilities → Equity → Revenue → Expenses)
- Sub-totals per group
- Grand totals with balance validation
- Click any amount → navigates to GL ledger filtered by date range

### Charts

- Stacked bar chart: Debit vs Credit by account category
- Trend line: Total balance over selected periods

---

## 3. Balance Sheet Report

### Purpose
Snapshot of financial position - Assets = Liabilities + Equity. Key report for lenders, investors, and regulatory compliance.

### KPI Cards

| Metric | Formula |
|--------|---------|
| Total Assets | Sum of all asset accounts |
| Total Liabilities | Sum of all liability accounts |
| Total Equity | Sum of all equity accounts |
| Current Ratio | Current Assets ÷ Current Liabilities |
| Quick Ratio | (Current Assets - Inventory) ÷ Current Liabilities |
| Debt-to-Equity Ratio | Total Liabilities ÷ Total Equity |

### Period Selector

- As-of Date (balance sheet is point-in-time)
- Compare up to 4 periods (e.g., last 4 quarters or 4 years)
- Quick presets: End of Month, Quarter, Year

### Table Structure (Hierarchical)

```
ASSETS (สินทรัพย์)
├── Current Assets (สินทรัพย์หมุนเวียน)
│   ├── Cash & Equivalents     ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx
│   ├── Accounts Receivable    ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx
│   └── Inventory              ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx
│   └── Sub-total Current      ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx
├── Non-Current Assets (สินทรัพย์ไม่หมุนเวียน)
│   └── ...
└── TOTAL ASSETS               ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx

LIABILITIES & EQUITY (หนี้สินและส่วนของผู้ถือหุ้น)
├── Current Liabilities
├── Non-Current Liabilities
├── Equity
└── TOTAL LIABILITIES & EQUITY ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx

✓ Balance Check: Assets = Liabilities + Equity
```

### Charts

- Donut chart: Asset composition (Cash, AR, Inventory, Fixed Assets)
- Stacked bar: Assets vs Liabilities trend over periods
- Line chart: Key ratios trend (Current, Quick, D/E)

---

## 4. Income Statement Report

### Purpose
Profitability report showing Revenue - Expenses = Net Income over a period. Critical for performance analysis and tax reporting.

### KPI Cards

| Metric | Description |
|--------|-------------|
| Total Revenue | Net sales revenue |
| Gross Profit | Revenue - COGS |
| Operating Income | Gross Profit - Operating Expenses |
| Net Income | Final profit after all expenses and tax |
| Gross Margin % | Gross Profit ÷ Revenue × 100 |
| Operating Margin % | Operating Income ÷ Revenue × 100 |
| Net Margin % | Net Income ÷ Revenue × 100 |
| Revenue Growth % | vs prior period |

### Period Selector

- Period Range: Start Date → End Date
- Quick presets: This Month, Last Month, This Quarter, YTD, Last Year
- Compare up to 6 periods (monthly trend or year-over-year)

### Table Structure

```
                                    Jan 2026   Feb 2026   Mar 2026   % of Revenue
REVENUE (รายได้)
├── Sales Revenue                   ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx   100.0%
├── Less: Sales Returns             (฿xx,xxx)  (฿xx,xxx)  (฿xx,xxx)   -x.x%
└── NET REVENUE                     ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx   100.0%

COST OF GOODS SOLD (ต้นทุนขาย)
├── Raw Materials                   ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx    xx.x%
├── Direct Labor                    ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx    xx.x%
├── Manufacturing Overhead          ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx    xx.x%
└── TOTAL COGS                      ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx    xx.x%

═══ GROSS PROFIT (กำไรขั้นต้น)       ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx    xx.x%

OPERATING EXPENSES (ค่าใช้จ่ายดำเนินงาน)
├── Selling Expenses                ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx    xx.x%
├── Administrative Expenses         ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx    xx.x%
└── TOTAL OPERATING EXPENSES        ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx    xx.x%

═══ OPERATING INCOME                ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx    xx.x%

OTHER INCOME/EXPENSES (รายได้/ค่าใช้จ่ายอื่น)
├── Other Income                    ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx    xx.x%
├── Other Expenses                  (฿xx,xxx)  (฿xx,xxx)  (฿xx,xxx)   -x.x%
├── Income Tax Expense              (฿xx,xxx)  (฿xx,xxx)  (฿xx,xxx)   -x.x%
└── NET INCOME (กำไรสุทธิ)           ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx    xx.x%
```

### Charts

- Area chart: Revenue vs COGS vs Operating Expenses trend
- Line chart: Margin percentages trend (Gross, Operating, Net)
- Waterfall chart: Revenue → Net Income breakdown

---

## 5. Cash Flow Statement Report

### Purpose
Track cash movement - where money came from and where it went. Essential for liquidity management.

### KPI Cards

| Metric | Description |
|--------|-------------|
| Operating Cash Flow | Cash from core business |
| Investing Cash Flow | Cash for/from investments |
| Financing Cash Flow | Cash from/to financing |
| Net Cash Change | Total change in period |
| Ending Cash Balance | Cash at period end |
| Free Cash Flow | Operating - CapEx |
| Cash Conversion Ratio | Operating CF ÷ Net Income |

### Period Selector

- Period Range: Start Date → End Date
- Compare up to 4 periods
- Quick presets: This Month, This Quarter, YTD, Full Year

### Table Structure (Indirect Method)

```
                                        Q1 2026    Q2 2026    Q3 2026
OPERATING ACTIVITIES (กิจกรรมดำเนินงาน)
├── Net Income                          ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx
├── Adjustments:
│   ├── Depreciation & Amortization     ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx
│   ├── (Gain)/Loss on Asset Disposal   ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx
├── Changes in Working Capital:
│   ├── (Increase)/Decrease in AR       (฿xx,xxx)  ฿xxx,xxx   (฿xx,xxx)
│   ├── (Increase)/Decrease in Inventory (฿xx,xxx) (฿xx,xxx)  ฿xxx,xxx
│   ├── Increase/(Decrease) in AP       ฿xxx,xxx   (฿xx,xxx)  ฿xxx,xxx
│   └── Other Working Capital Changes   ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx
└── NET CASH FROM OPERATING             ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx

INVESTING ACTIVITIES (กิจกรรมลงทุน)
├── Purchase of Fixed Assets            (฿xx,xxx)  (฿xx,xxx)  (฿xx,xxx)
├── Sale of Fixed Assets                ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx
└── NET CASH FROM INVESTING             (฿xx,xxx)  (฿xx,xxx)  (฿xx,xxx)

FINANCING ACTIVITIES (กิจกรรมจัดหาเงิน)
├── Proceeds from Loans                 ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx
├── Repayment of Loans                  (฿xx,xxx)  (฿xx,xxx)  (฿xx,xxx)
├── Dividends Paid                      (฿xx,xxx)  (฿xx,xxx)  (฿xx,xxx)
└── NET CASH FROM FINANCING             ฿xxx,xxx   (฿xx,xxx)  (฿xx,xxx)

═══════════════════════════════════════════════════════════════════════
NET CHANGE IN CASH                      ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx
BEGINNING CASH BALANCE                  ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx
ENDING CASH BALANCE                     ฿xxx,xxx   ฿xxx,xxx   ฿xxx,xxx
```

### Charts

- Waterfall chart: Beginning Cash → adjustments → Ending Cash
- Stacked bar: Operating vs Investing vs Financing by period
- Line chart: Cash balance trend over time

---

## 6. Export & Bilingual Support

### Export Toolbar

```
[🇹🇭 TH | EN 🇬🇧]  [📄 PDF]  [📊 Excel]  [📋 CSV]  [🖨️ Print]
```

### PDF Export

- Professional letterhead format
- Company name, tax ID, report title in selected language
- Page numbers, generation timestamp
- Thai or English headers based on toggle
- Formatted numbers with ฿ symbol
- Signature lines for CFO/Accountant approval

### Excel Export

- Full data with formulas preserved
- Separate sheets: Summary, Details, Charts data
- Formatted as proper accounting report
- Freeze panes on headers
- Column grouping for expandable sections

### CSV Export

- Flat file format for data import
- UTF-8 encoding (Thai character support)
- Comma-separated with proper escaping
- Headers match selected language

### Bilingual Toggle

- Single toggle button in header: `[🇹🇭 ไทย | English]`
- Persisted in localStorage per user
- Affects: Report titles, account names, column headers, KPI labels, chart labels, exports
- Numbers, dates, and ฿ symbol remain consistent

### Date Format

- Thai mode: Buddhist Era optional (พ.ศ. 2569) or CE (2026)
- English mode: Standard CE dates
- Both use: DD/MM/YYYY format (Thai standard)

---

## 7. Navigation, Drill-Down & Error Handling

### Drill-Down Flow

```
Trial Balance → Click ฿500,000 on "Cash" row
    ↓
/accounting/gl-accounts/1110?from=2026-01-01&to=2026-03-31
    ↓
GL Ledger showing all cash transactions
    ↓
Click journal entry JE-202601-000123
    ↓
/accounting/journal-entries/123
    ↓
[← Back to Trial Balance] breadcrumb returns to report
```

### Breadcrumb Pattern

```
Accounting > Reports > Trial Balance > GL Account: 1110 Cash
```

### Loading States

- Skeleton loaders for KPI cards and tables
- Progress indicator for multi-period fetches
- "Generating report..." overlay for large date ranges

### Error Handling

| Scenario | Handling |
|----------|----------|
| No data | "No transactions found for selected period" with suggestion |
| Period not closed | Warning banner "Period contains unposted entries" |
| Balance mismatch | Red alert "Trial balance out of balance by ฿X" |
| Network error | Retry button with cached data option |

### Empty States

- New company: "No journal entries yet. Start by posting transactions."
- Future date: "Selected date is in the future. Choose a past date."

### Performance

- Lazy load chart components
- Paginate large account lists (100+ accounts)
- Cache report data for 5 minutes (invalidate on new postings)

---

## Technical Notes

### Existing Infrastructure

- Services: `accounting-reports.service.ts` has Trial Balance, Balance Sheet, Income Statement, Cash Flow generators
- APIs: `/api/accounting/reports/*` endpoints exist
- Schema: GL accounts with Thai/English names, account types with normal balance
- Date utils: `toQueryDate()`, `formatDateFromDb()` for MySQL/SQLite compatibility

### New Components Needed

1. Shared report components in `_components/`
2. Export service for PDF/Excel/CSV
3. Language context provider
4. Enhanced API endpoints for multi-period data
5. Individual page components for each report

### Dependencies

- Recharts for charts (already installed)
- jsPDF + jspdf-autotable for PDF export
- xlsx (SheetJS) for Excel export
- React Context for language state
