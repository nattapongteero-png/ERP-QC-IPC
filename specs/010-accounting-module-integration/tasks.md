# Tasks: Accounting Module Integration

**Input**: Design documents from `/specs/010-accounting-module-integration/`
**Prerequisites**: plan.md (required), spec.md (10 user stories), research.md (12 decisions), data-model.md (21 entities), contracts/ (6 API specs)

**Tests**: Included per CLAUDE.md requirements - unit tests for services, E2E tests using React Testing Library + Vitest

**Organization**: Tasks grouped by user story to enable independent implementation and testing

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US10)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, database schema, and core types

- [ ] T001 Create accounting module type definitions in src/types/accounting.ts
- [ ] T002 [P] Create GLAccountType schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T003 [P] Create GLAccountType schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T004 [P] Create GLAccount schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T005 [P] Create GLAccount schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T006 [P] Create FiscalYear schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T007 [P] Create FiscalYear schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T008 [P] Create FiscalPeriod schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T009 [P] Create FiscalPeriod schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T010 [P] Create JournalEntry schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T011 [P] Create JournalEntry schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T012 [P] Create JournalLine schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T013 [P] Create JournalLine schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T014 Create accounting schema barrel export in src/lib/db/schema/accounting.ts
- [ ] T015 Add accounting schema exports to main src/lib/db/schema.ts
- [ ] T016 Create Zod validation schemas in src/lib/validation/accounting.ts
- [ ] T017 Run database migration to create accounting tables

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T018 Create base accounting service with getAccountingTables() helper in src/lib/services/accounting.service.ts
- [ ] T019 Implement generateEntryNumber() for JE-YYYYMM-NNNNNN format in src/lib/services/accounting.service.ts
- [ ] T020 Implement getCurrentFiscalPeriod() and getPeriodByDate() in src/lib/services/accounting.service.ts
- [ ] T021 Implement createJournalEntry() with balance validation in src/lib/services/accounting.service.ts
- [ ] T022 Implement postJournalEntry() with period check in src/lib/services/accounting.service.ts
- [ ] T023 Implement reverseJournalEntry() creating reversing entry in src/lib/services/accounting.service.ts
- [ ] T024 [P] Create accounting permissions constants in src/lib/auth/accounting-permissions.ts
- [ ] T025 [P] Create seed data for GL account types following Thai Accounting Standards in src/lib/db/seeds/gl-account-types.ts
- [ ] T026 [P] Create seed data for default Thai COA template in src/lib/db/seeds/coa-template.ts
- [ ] T027 Create test helpers and seeding functions in tests/helpers/seed-accounting.ts
- [ ] T028 Write unit tests for journal entry core functions in tests/unit/services/accounting-core.test.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Create and Manage Chart of Accounts (Priority: P1) MVP

**Goal**: Finance Manager sets up Chart of Accounts following Thai Accounting Standards (TAS) with 5 main categories

**Independent Test**: Create COA, add accounts, verify structure matches Thai standard categories (Assets, Liabilities, Equity, Revenue, Expenses)

### Service Layer for US1

- [ ] T029 [US1] Implement listGLAccountTypes() in src/lib/services/accounting.service.ts
- [ ] T030 [US1] Implement createGLAccount() with level calculation from parent in src/lib/services/accounting.service.ts
- [ ] T031 [US1] Implement updateGLAccount() in src/lib/services/accounting.service.ts
- [ ] T032 [US1] Implement deactivateGLAccount() with balance check in src/lib/services/accounting.service.ts
- [ ] T033 [US1] Implement deleteGLAccount() with transaction check in src/lib/services/accounting.service.ts
- [ ] T034 [US1] Implement listGLAccounts() with filters in src/lib/services/accounting.service.ts
- [ ] T035 [US1] Implement getGLAccountTree() for hierarchy view in src/lib/services/accounting.service.ts
- [ ] T036 [US1] Implement getGLAccountBalance() as of date in src/lib/services/accounting.service.ts
- [ ] T037 [US1] Implement exportChartOfAccounts() for auditor review in src/lib/services/accounting.service.ts

### API Routes for US1

- [ ] T038 [P] [US1] Create GET/POST route in src/app/api/accounting/gl-accounts/route.ts
- [ ] T039 [P] [US1] Create GET/PUT/DELETE route in src/app/api/accounting/gl-accounts/[id]/route.ts
- [ ] T040 [P] [US1] Create GET route for tree in src/app/api/accounting/gl-accounts/tree/route.ts
- [ ] T041 [P] [US1] Create GET route for balance in src/app/api/accounting/gl-accounts/[id]/balance/route.ts
- [ ] T042 [P] [US1] Create GET route for account types in src/app/api/accounting/gl-account-types/route.ts

### UI Components for US1

- [ ] T043 [P] [US1] Create GLAccountSelector component in src/components/accounting/shared/gl-account-selector.tsx
- [ ] T044 [P] [US1] Create GLAccountTypeSelector component in src/components/accounting/shared/gl-account-type-selector.tsx
- [ ] T045 [US1] Create Chart of Accounts tree page in src/app/(protected)/accounting/chart-of-accounts/page.tsx
- [ ] T046 [US1] Create GL account form dialog in src/components/accounting/gl-account-form-dialog.tsx
- [ ] T047 [US1] Add export COA functionality to chart-of-accounts page

### Tests for US1

- [ ] T048 [P] [US1] Write unit tests for GL account service in tests/unit/services/accounting-gl.test.ts
- [ ] T049 [P] [US1] Write E2E test for Chart of Accounts page in tests/e2e/accounting/chart-of-accounts.test.tsx

**Checkpoint**: User Story 1 complete - COA management is fully functional

---

## Phase 4: User Story 2 - Record Purchase-to-Pay Transactions (Priority: P1)

**Goal**: PO receipt automatically generates AP Invoice with VAT calculation (7%)

**Independent Test**: Create PO, receive goods, verify AP invoice and journal entries are created

### Schema for US2

- [ ] T050 [P] [US2] Create APInvoice schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T051 [P] [US2] Create APInvoice schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T052 [P] [US2] Create APInvoiceLine schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T053 [P] [US2] Create APInvoiceLine schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T054 [P] [US2] Create Payment schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T055 [P] [US2] Create Payment schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T056 [P] [US2] Create PaymentAllocation schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T057 [P] [US2] Create PaymentAllocation schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T058 [P] [US2] Create VATTransaction schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T059 [P] [US2] Create VATTransaction schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T060 [US2] Run database migration for AP/Payment/VAT tables
- [ ] T061 [US2] Add Zod validation for AP invoice in src/lib/validation/accounting.ts

### Service Layer for US2

- [ ] T062 [US2] Implement calculateVAT() helper (7% Thai rate) in src/lib/services/accounting.service.ts
- [ ] T063 [US2] Implement createAPInvoice() manual creation in src/lib/services/accounting.service.ts
- [ ] T064 [US2] Implement createAPInvoiceFromPO() auto-generation in src/lib/services/accounting.service.ts
- [ ] T065 [US2] Implement updateAPInvoice() for draft status in src/lib/services/accounting.service.ts
- [ ] T066 [US2] Implement approveAPInvoice() with journal entry creation in src/lib/services/accounting.service.ts
- [ ] T067 [US2] Implement recordAPPayment() with partial payment support in src/lib/services/accounting.service.ts
- [ ] T068 [US2] Implement createVATTransaction() for input VAT in src/lib/services/accounting.service.ts
- [ ] T069 [US2] Add hook in purchasing.service.ts receivePurchaseOrder() to call createAPInvoiceFromPO()

### API Routes for US2

- [ ] T070 [P] [US2] Create GET/POST route in src/app/api/accounting/ap-invoices/route.ts
- [ ] T071 [P] [US2] Create GET/PUT route in src/app/api/accounting/ap-invoices/[id]/route.ts
- [ ] T072 [P] [US2] Create POST route for approve in src/app/api/accounting/ap-invoices/[id]/approve/route.ts
- [ ] T073 [P] [US2] Create POST route for pay in src/app/api/accounting/ap-invoices/[id]/pay/route.ts
- [ ] T074 [P] [US2] Create GET/POST route for journal entries in src/app/api/accounting/journal-entries/route.ts
- [ ] T075 [P] [US2] Create GET/PUT route for journal entry in src/app/api/accounting/journal-entries/[id]/route.ts
- [ ] T076 [P] [US2] Create POST route for post JE in src/app/api/accounting/journal-entries/[id]/post/route.ts
- [ ] T077 [P] [US2] Create POST route for reverse JE in src/app/api/accounting/journal-entries/[id]/reverse/route.ts

### UI Components for US2

- [ ] T078 [P] [US2] Create JournalEntryViewer component in src/components/accounting/journal-entry-viewer.tsx
- [ ] T079 [US2] Create AP Invoices list page in src/app/(protected)/accounting/ap/page.tsx
- [ ] T080 [US2] Create AP Invoice detail page in src/app/(protected)/accounting/ap/[id]/page.tsx
- [ ] T081 [US2] Create AP Invoice form dialog in src/components/accounting/ap-invoice-form-dialog.tsx
- [ ] T082 [US2] Create AP Payment dialog in src/components/accounting/ap-payment-dialog.tsx
- [ ] T083 [US2] Create Journal Entries list page in src/app/(protected)/accounting/journal-entries/page.tsx
- [ ] T084 [US2] Create Journal Entry detail page in src/app/(protected)/accounting/journal-entries/[id]/page.tsx
- [ ] T085 [US2] Create manual Journal Entry form in src/components/accounting/journal-entry-form.tsx

### Tests for US2

- [ ] T086 [P] [US2] Write unit tests for AP invoice service in tests/unit/services/accounting-ap.test.ts
- [ ] T087 [P] [US2] Write unit tests for journal entry service in tests/unit/services/accounting-je.test.ts
- [ ] T088 [P] [US2] Write E2E test for AP Invoices page in tests/e2e/accounting/ap-invoices.test.tsx

**Checkpoint**: User Story 2 complete - Purchase-to-Pay flow works end-to-end

---

## Phase 5: User Story 3 - Record Order-to-Cash Transactions (Priority: P1)

**Goal**: SO shipment generates AR Invoice with Thai tax invoice number and Output VAT (7%)

**Independent Test**: Create SO, ship goods, verify AR invoice with tax invoice number and journal entries

### Schema for US3

- [ ] T089 [P] [US3] Create ARInvoice schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T090 [P] [US3] Create ARInvoice schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T091 [P] [US3] Create ARInvoiceLine schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T092 [P] [US3] Create ARInvoiceLine schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T093 [US3] Run database migration for AR tables
- [ ] T094 [US3] Add Zod validation for AR invoice in src/lib/validation/accounting.ts

### Service Layer for US3

- [ ] T095 [US3] Implement generateTaxInvoiceNumber() with Thai format in src/lib/services/accounting.service.ts
- [ ] T096 [US3] Implement createARInvoice() manual creation in src/lib/services/accounting.service.ts
- [ ] T097 [US3] Implement createARInvoiceFromSO() auto-generation in src/lib/services/accounting.service.ts
- [ ] T098 [US3] Implement confirmARInvoice() with journal entry in src/lib/services/accounting.service.ts
- [ ] T099 [US3] Implement recordARPayment() with receipt tracking in src/lib/services/accounting.service.ts
- [ ] T100 [US3] Implement createVATTransaction() for output VAT in src/lib/services/accounting.service.ts
- [ ] T101 [US3] Add hook in sales.service.ts shipSalesOrder() to call createARInvoiceFromSO()

### API Routes for US3

- [ ] T102 [P] [US3] Create GET/POST route in src/app/api/accounting/ar-invoices/route.ts
- [ ] T103 [P] [US3] Create GET route in src/app/api/accounting/ar-invoices/[id]/route.ts
- [ ] T104 [P] [US3] Create POST route for confirm in src/app/api/accounting/ar-invoices/[id]/confirm/route.ts
- [ ] T105 [P] [US3] Create POST route for payment in src/app/api/accounting/ar-invoices/[id]/receive-payment/route.ts

### UI Components for US3

- [ ] T106 [US3] Create AR Invoices list page in src/app/(protected)/accounting/ar/page.tsx
- [ ] T107 [US3] Create AR Invoice detail page in src/app/(protected)/accounting/ar/[id]/page.tsx
- [ ] T108 [US3] Create AR Invoice form dialog in src/components/accounting/ar-invoice-form-dialog.tsx
- [ ] T109 [US3] Create AR Payment receipt dialog in src/components/accounting/ar-payment-dialog.tsx

### Tests for US3

- [ ] T110 [P] [US3] Write unit tests for AR invoice service in tests/unit/services/accounting-ar.test.ts
- [ ] T111 [P] [US3] Write E2E test for AR Invoices page in tests/e2e/accounting/ar-invoices.test.tsx

**Checkpoint**: User Story 3 complete - Order-to-Cash flow works end-to-end

---

## Phase 6: User Story 4 - Process Manufacturing Cost Accounting (Priority: P2)

**Goal**: Track and allocate manufacturing costs (materials, labor, overhead) using FIFO

**Independent Test**: Process production order, allocate costs, verify finished goods valued correctly

### Service Layer for US4

- [ ] T112 [US4] Implement recordMaterialCost() for raw material to WIP in src/lib/services/accounting.service.ts
- [ ] T113 [US4] Implement allocateLaborCost() to batch in src/lib/services/accounting.service.ts
- [ ] T114 [US4] Implement allocateOverhead() based on configured basis in src/lib/services/accounting.service.ts
- [ ] T115 [US4] Implement transferToFinishedGoods() from WIP to FG in src/lib/services/accounting.service.ts
- [ ] T116 [US4] Implement getBatchCostBreakdown() for cost analysis in src/lib/services/accounting.service.ts
- [ ] T117 [US4] Add integration hook in inventory.service.ts for material issue costing

### API Routes for US4

- [ ] T118 [P] [US4] Create POST route for cost allocation in src/app/api/accounting/cost-allocation/route.ts
- [ ] T119 [P] [US4] Create GET route for batch costing in src/app/api/accounting/cost-allocation/[batchId]/route.ts

### Tests for US4

- [ ] T120 [P] [US4] Write unit tests for cost allocation in tests/unit/services/accounting-cost.test.ts

**Checkpoint**: User Story 4 complete - Manufacturing cost accounting works

---

## Phase 7: User Story 5 - Generate Financial Statements (Priority: P2)

**Goal**: Generate TFRS-compliant Trial Balance, Income Statement, Balance Sheet, Cash Flow

**Independent Test**: Process transactions, generate statements, verify reports balance and follow Thai format

### Service Layer for US5

- [ ] T121 [US5] Implement generateTrialBalance() as of date in src/lib/services/accounting-reports.service.ts
- [ ] T122 [US5] Implement generateBalanceSheet() with TFRS format in src/lib/services/accounting-reports.service.ts
- [ ] T123 [US5] Implement generateIncomeStatement() for period in src/lib/services/accounting-reports.service.ts
- [ ] T124 [US5] Implement generateCashFlowStatement() indirect method in src/lib/services/accounting-reports.service.ts
- [ ] T125 [US5] Implement generateAgingReport() for AP and AR in src/lib/services/accounting-reports.service.ts

### API Routes for US5

- [ ] T126 [P] [US5] Create GET route for trial balance in src/app/api/accounting/reports/trial-balance/route.ts
- [ ] T127 [P] [US5] Create GET route for balance sheet in src/app/api/accounting/reports/balance-sheet/route.ts
- [ ] T128 [P] [US5] Create GET route for income statement in src/app/api/accounting/reports/income-statement/route.ts
- [ ] T129 [P] [US5] Create GET route for cash flow in src/app/api/accounting/reports/cash-flow/route.ts
- [ ] T130 [P] [US5] Create GET route for aging report in src/app/api/accounting/reports/aging/route.ts

### UI Components for US5

- [ ] T131 [US5] Create Reports dashboard page in src/app/(protected)/accounting/reports/page.tsx
- [ ] T132 [US5] Create Trial Balance report page in src/app/(protected)/accounting/reports/trial-balance/page.tsx
- [ ] T133 [US5] Create Balance Sheet report page in src/app/(protected)/accounting/reports/balance-sheet/page.tsx
- [ ] T134 [US5] Create Income Statement report page in src/app/(protected)/accounting/reports/income-statement/page.tsx
- [ ] T135 [US5] Create Cash Flow report page in src/app/(protected)/accounting/reports/cash-flow/page.tsx
- [ ] T136 [US5] Create shared ReportExportButton in src/components/accounting/shared/report-export-button.tsx

### Tests for US5

- [ ] T137 [P] [US5] Write unit tests for reports in tests/unit/services/accounting-reports.test.ts
- [ ] T138 [P] [US5] Write E2E test for Reports page in tests/e2e/accounting/reports.test.tsx

**Checkpoint**: User Story 5 complete - Financial statements can be generated

---

## Phase 8: User Story 6 - Manage VAT and Withholding Tax (Priority: P2)

**Goal**: Calculate VAT/WHT per Thai Revenue Department, generate Por Por 30 and WHT certificates

**Independent Test**: Process transactions with VAT and WHT, generate tax reports for a period

### Schema for US6

- [ ] T139 [P] [US6] Create WHTTransaction schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T140 [P] [US6] Create WHTTransaction schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T141 [US6] Run database migration for WHT tables
- [ ] T142 [US6] Create WHT rate configuration seed data in src/lib/db/seeds/wht-rates.ts

### Service Layer for US6

- [ ] T143 [US6] Implement calculateWHT() based on payment type in src/lib/services/accounting.service.ts
- [ ] T144 [US6] Implement createWHTTransaction() on AP payment in src/lib/services/accounting.service.ts
- [ ] T145 [US6] Implement generateVATReport() for Por Por 30 in src/lib/services/accounting-reports.service.ts
- [ ] T146 [US6] Implement generateWHTCertificate() PDF in src/lib/services/accounting-reports.service.ts
- [ ] T147 [US6] Implement listWHTCertificates() with filters in src/lib/services/accounting.service.ts

### API Routes for US6

- [ ] T148 [P] [US6] Create GET route for VAT report in src/app/api/accounting/reports/vat-report/route.ts
- [ ] T149 [P] [US6] Create GET route for WHT certificates in src/app/api/accounting/reports/wht-certificates/route.ts
- [ ] T150 [P] [US6] Create GET route for WHT PDF in src/app/api/accounting/reports/wht-certificates/[id]/pdf/route.ts

### UI Components for US6

- [ ] T151 [US6] Create VAT Report page in src/app/(protected)/accounting/reports/vat/page.tsx
- [ ] T152 [US6] Create WHT Certificates page in src/app/(protected)/accounting/reports/wht/page.tsx
- [ ] T153 [US6] Create WHT Certificate PDF viewer in src/components/accounting/wht-certificate-dialog.tsx

### Tests for US6

- [ ] T154 [P] [US6] Write unit tests for VAT/WHT in tests/unit/services/accounting-tax.test.ts
- [ ] T155 [P] [US6] Write E2E test for tax reports in tests/e2e/accounting/tax-reports.test.tsx

**Checkpoint**: User Story 6 complete - Thai tax compliance features work

---

## Phase 9: User Story 7 - Manage Fixed Assets and Depreciation (Priority: P2)

**Goal**: Register, track, depreciate fixed assets per Thai Revenue Code and TAS

**Independent Test**: Register asset, run depreciation, verify asset value and accumulated depreciation

### Schema for US7

- [ ] T156 [P] [US7] Create AssetCategory schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T157 [P] [US7] Create AssetCategory schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T158 [P] [US7] Create FixedAsset schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T159 [P] [US7] Create FixedAsset schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T160 [P] [US7] Create AssetDepreciation schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T161 [P] [US7] Create AssetDepreciation schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T162 [P] [US7] Create AssetDisposal schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T163 [P] [US7] Create AssetDisposal schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T164 [P] [US7] Create AssetMovement schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T165 [P] [US7] Create AssetMovement schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T166 [US7] Run database migration for fixed asset tables
- [ ] T167 [US7] Create asset category seed with Thai Revenue Code rates in src/lib/db/seeds/asset-categories.ts
- [ ] T168 [US7] Add Zod validation for fixed assets in src/lib/validation/accounting.ts

### Service Layer for US7

- [ ] T169 [US7] Implement listAssetCategories() in src/lib/services/accounting-assets.service.ts
- [ ] T170 [US7] Implement createAssetCategory() in src/lib/services/accounting-assets.service.ts
- [ ] T171 [US7] Implement createFixedAsset() with auto code in src/lib/services/accounting-assets.service.ts
- [ ] T172 [US7] Implement capitalizeFromAPInvoice() in src/lib/services/accounting-assets.service.ts
- [ ] T173 [US7] Implement runMonthlyDepreciation() for all assets in src/lib/services/accounting-assets.service.ts
- [ ] T174 [US7] Implement disposeAsset() with gain/loss in src/lib/services/accounting-assets.service.ts
- [ ] T175 [US7] Implement transferAsset() for location moves in src/lib/services/accounting-assets.service.ts
- [ ] T176 [US7] Implement generateAssetRegister() report in src/lib/services/accounting-reports.service.ts

### API Routes for US7

- [ ] T177 [P] [US7] Create GET/POST route for categories in src/app/api/accounting/asset-categories/route.ts
- [ ] T178 [P] [US7] Create GET/POST route for assets in src/app/api/accounting/fixed-assets/route.ts
- [ ] T179 [P] [US7] Create GET/PUT route in src/app/api/accounting/fixed-assets/[id]/route.ts
- [ ] T180 [P] [US7] Create POST route for dispose in src/app/api/accounting/fixed-assets/[id]/dispose/route.ts
- [ ] T181 [P] [US7] Create GET route for depreciation in src/app/api/accounting/fixed-assets/[id]/depreciation/route.ts
- [ ] T182 [P] [US7] Create GET/POST route for movements in src/app/api/accounting/fixed-assets/[id]/movements/route.ts
- [ ] T183 [P] [US7] Create POST route for run depreciation in src/app/api/accounting/fixed-assets/depreciation/route.ts
- [ ] T184 [P] [US7] Create GET route for asset register in src/app/api/accounting/reports/asset-register/route.ts

### UI Components for US7

- [ ] T185 [US7] Create Fixed Assets list page in src/app/(protected)/accounting/fixed-assets/page.tsx
- [ ] T186 [US7] Create Fixed Asset detail page in src/app/(protected)/accounting/fixed-assets/[id]/page.tsx
- [ ] T187 [US7] Create Fixed Asset form dialog in src/components/accounting/fixed-asset-form-dialog.tsx
- [ ] T188 [US7] Create Asset Disposal dialog in src/components/accounting/asset-disposal-dialog.tsx
- [ ] T189 [US7] Create Run Depreciation dialog in src/components/accounting/run-depreciation-dialog.tsx
- [ ] T190 [US7] Create Asset Register report page in src/app/(protected)/accounting/reports/asset-register/page.tsx

### Tests for US7

- [ ] T191 [P] [US7] Write unit tests for fixed assets in tests/unit/services/accounting-assets.test.ts
- [ ] T192 [P] [US7] Write E2E test for Fixed Assets page in tests/e2e/accounting/fixed-assets.test.tsx

**Checkpoint**: User Story 7 complete - Fixed asset management and depreciation work

---

## Phase 10: User Story 8 - Track Equipment and Maintenance Costs (Priority: P2)

**Goal**: Track equipment, maintenance schedules, and costs with MTBF analysis

**Independent Test**: Register equipment, schedule maintenance, record events, generate reports

### Schema for US8

- [ ] T193 [P] [US8] Create Equipment schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T194 [P] [US8] Create Equipment schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T195 [P] [US8] Create MaintenanceSchedule schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T196 [P] [US8] Create MaintenanceSchedule schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T197 [P] [US8] Create MaintenanceRecord schema in src/lib/db/schema/sqliteAccounting.ts
- [ ] T198 [P] [US8] Create MaintenanceRecord schema in src/lib/db/schema/mysqlAccounting.ts
- [ ] T199 [US8] Run database migration for equipment tables
- [ ] T200 [US8] Add Zod validation for equipment in src/lib/validation/accounting.ts

### Service Layer for US8

- [ ] T201 [US8] Implement createEquipment() linking to asset in src/lib/services/accounting-equipment.service.ts
- [ ] T202 [US8] Implement updateMeterReading() for hours in src/lib/services/accounting-equipment.service.ts
- [ ] T203 [US8] Implement createMaintenanceSchedule() in src/lib/services/accounting-equipment.service.ts
- [ ] T204 [US8] Implement recordMaintenanceEvent() with costs in src/lib/services/accounting-equipment.service.ts
- [ ] T205 [US8] Implement getUpcomingMaintenance() for alerts in src/lib/services/accounting-equipment.service.ts
- [ ] T206 [US8] Implement getOverdueMaintenance() in src/lib/services/accounting-equipment.service.ts
- [ ] T207 [US8] Implement calculateMTBF() for analysis in src/lib/services/accounting-equipment.service.ts
- [ ] T208 [US8] Implement generateEquipmentCostReport() in src/lib/services/accounting-reports.service.ts

### API Routes for US8

- [ ] T209 [P] [US8] Create GET/POST route for equipment in src/app/api/accounting/equipment/route.ts
- [ ] T210 [P] [US8] Create GET/PUT route in src/app/api/accounting/equipment/[id]/route.ts
- [ ] T211 [P] [US8] Create POST route for meter in src/app/api/accounting/equipment/[id]/meter-reading/route.ts
- [ ] T212 [P] [US8] Create GET/POST route for maintenance in src/app/api/accounting/equipment/[id]/maintenance/route.ts
- [ ] T213 [P] [US8] Create GET/POST route for schedules in src/app/api/accounting/equipment/[id]/schedules/route.ts
- [ ] T214 [P] [US8] Create GET route for MTBF in src/app/api/accounting/equipment/[id]/mtbf/route.ts
- [ ] T215 [P] [US8] Create GET route for due maintenance in src/app/api/accounting/maintenance/due/route.ts
- [ ] T216 [P] [US8] Create GET route for overdue in src/app/api/accounting/maintenance/overdue/route.ts

### UI Components for US8

- [ ] T217 [US8] Create Equipment list page in src/app/(protected)/accounting/equipment/page.tsx
- [ ] T218 [US8] Create Equipment detail page in src/app/(protected)/accounting/equipment/[id]/page.tsx
- [ ] T219 [US8] Create Equipment form dialog in src/components/accounting/equipment-form-dialog.tsx
- [ ] T220 [US8] Create Maintenance Schedule dialog in src/components/accounting/maintenance-schedule-dialog.tsx
- [ ] T221 [US8] Create Record Maintenance dialog in src/components/accounting/record-maintenance-dialog.tsx
- [ ] T222 [US8] Create Maintenance Dashboard with alerts in src/app/(protected)/accounting/equipment/maintenance/page.tsx
- [ ] T223 [US8] Create MTBF Analysis component in src/components/accounting/mtbf-analysis.tsx

### Tests for US8

- [ ] T224 [P] [US8] Write unit tests for equipment in tests/unit/services/accounting-equipment.test.ts
- [ ] T225 [P] [US8] Write E2E test for Equipment page in tests/e2e/accounting/equipment.test.tsx

**Checkpoint**: User Story 8 complete - Equipment and maintenance tracking work

---

## Phase 11: User Story 9 - Perform Period-End Closing (Priority: P3)

**Goal**: Month-end and year-end closing with validation and audit trail

**Independent Test**: Process transactions, run closing, verify period locked and balances forwarded

### Service Layer for US9

- [ ] T226 [US9] Implement validatePeriodClose() checks in src/lib/services/accounting-period.service.ts
- [ ] T227 [US9] Implement closeFiscalPeriod() with audit log in src/lib/services/accounting-period.service.ts
- [ ] T228 [US9] Implement reopenFiscalPeriod() with auth check in src/lib/services/accounting-period.service.ts
- [ ] T229 [US9] Implement closeYearEnd() net income transfer in src/lib/services/accounting-period.service.ts
- [ ] T230 [US9] Implement createOpeningBalances() for new year in src/lib/services/accounting-period.service.ts

### API Routes for US9

- [ ] T231 [P] [US9] Create GET/POST route for fiscal periods in src/app/api/accounting/fiscal-periods/route.ts
- [ ] T232 [P] [US9] Create GET route for validate in src/app/api/accounting/fiscal-periods/[id]/validate/route.ts
- [ ] T233 [P] [US9] Create POST route for close in src/app/api/accounting/fiscal-periods/[id]/close/route.ts
- [ ] T234 [P] [US9] Create POST route for reopen in src/app/api/accounting/fiscal-periods/[id]/reopen/route.ts
- [ ] T235 [P] [US9] Create POST route for year close in src/app/api/accounting/fiscal-years/[id]/close/route.ts

### UI Components for US9

- [ ] T236 [US9] Create Period Close dashboard in src/app/(protected)/accounting/period-close/page.tsx
- [ ] T237 [US9] Create Period Close validation dialog in src/components/accounting/period-close-dialog.tsx
- [ ] T238 [US9] Create Year-End Close wizard in src/components/accounting/year-end-close-wizard.tsx

### Tests for US9

- [ ] T239 [P] [US9] Write unit tests for period close in tests/unit/services/accounting-period.test.ts
- [ ] T240 [P] [US9] Write E2E test for Period Close page in tests/e2e/accounting/period-close.test.tsx

**Checkpoint**: User Story 9 complete - Period-end closing procedures work

---

## Phase 12: User Story 10 - Integrate with HR for Payroll Accounting (Priority: P3)

**Goal**: Payroll from HR auto-creates journal entries with cost center allocation

**Independent Test**: Process payroll, verify JEs for salary, tax withholdings, social security

### Service Layer for US10

- [ ] T241 [US10] Implement createPayrollJournalEntry() in src/lib/services/accounting.service.ts
- [ ] T242 [US10] Implement allocatePayrollToCostCenters() in src/lib/services/accounting.service.ts
- [ ] T243 [US10] Implement recordStatutoryLiabilities() in src/lib/services/accounting.service.ts
- [ ] T244 [US10] Add hook in hr.service.ts for payroll JE creation

### API Routes for US10

- [ ] T245 [P] [US10] Create POST route for payroll JE in src/app/api/accounting/payroll/route.ts

### Tests for US10

- [ ] T246 [P] [US10] Write unit tests for payroll in tests/unit/services/accounting-payroll.test.ts

**Checkpoint**: User Story 10 complete - HR payroll integration works

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T247 Create accounting settings page in src/app/(protected)/accounting/settings/page.tsx
- [ ] T248 Add accounting menu to sidebar navigation in src/components/layout/sidebar.tsx
- [ ] T249 Create accounting dashboard with metrics in src/app/(protected)/accounting/page.tsx
- [ ] T250 Add Thai/English bilingual support to all accounting pages
- [ ] T251 [P] Performance optimization for large transaction volumes
- [ ] T252 [P] Add audit log viewer for accounting transactions
- [ ] T253 Security review of accounting API endpoints
- [ ] T254 Run full test suite and fix any failures
- [ ] T255 Run quickstart.md validation scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Stories (Phase 3-12)**: All depend on Foundational completion
  - US1, US2, US3 are P1 and should complete first
  - US4-US8 are P2 and can proceed after P1
  - US9-US10 are P3 and can proceed after P2
- **Polish (Phase 13)**: Depends on desired user stories being complete

### User Story Dependencies

| Story | Depends On | Can Parallel With |
|-------|------------|-------------------|
| US1 (COA) | Foundational | US2, US3 |
| US2 (AP) | US1 (GL accounts) | US3 |
| US3 (AR) | US1 (GL accounts) | US2 |
| US4 (Cost) | US1, US2 | US5, US6, US7, US8 |
| US5 (Reports) | US1-US3 | US4, US6, US7, US8 |
| US6 (Tax) | US2, US3 | US4, US5, US7, US8 |
| US7 (Assets) | US1, US2 | US4, US5, US6 |
| US8 (Equipment) | US7 | US4, US5, US6 |
| US9 (Closing) | US1, US5 | US10 |
| US10 (Payroll) | US1 | US9 |

### Within Each User Story

- Schema tasks → Service tasks → API routes → UI → Tests
- All [P] tasks can run in parallel within their category

---

## Parallel Example: User Story 7 (Fixed Assets)

```bash
# Launch all schema tasks together:
Task: "Create AssetCategory schema in src/lib/db/schema/sqliteAccounting.ts"
Task: "Create AssetCategory schema in src/lib/db/schema/mysqlAccounting.ts"
Task: "Create FixedAsset schema in src/lib/db/schema/sqliteAccounting.ts"
Task: "Create FixedAsset schema in src/lib/db/schema/mysqlAccounting.ts"
# ... etc

# Launch all API route tasks together (after services):
Task: "Create GET/POST route for categories in src/app/api/accounting/asset-categories/route.ts"
Task: "Create GET/POST route for assets in src/app/api/accounting/fixed-assets/route.ts"
# ... etc
```

---

## Implementation Strategy

### MVP First (User Story 1-3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1 (COA)
4. Complete Phase 4: User Story 2 (AP)
5. Complete Phase 5: User Story 3 (AR)
6. **STOP and VALIDATE**: Test P1 stories independently
7. Deploy/demo if ready - basic accounting functional

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (COA) → Deploy (Foundation)
3. Add US2 (AP) + US3 (AR) → Deploy (Transaction Processing)
4. Add US5 (Reports) + US6 (Tax) → Deploy (Compliance)
5. Add US7 (Assets) + US8 (Equipment) → Deploy (Asset Management)
6. Add US9 (Closing) + US10 (Payroll) → Deploy (Full Integration)

### Parallel Team Strategy

With 3 developers:
1. Team completes Setup + Foundational together
2. Once Foundational done:
   - Developer A: US1 → US4 → US7
   - Developer B: US2 → US5 → US8
   - Developer C: US3 → US6 → US9-10

---

## Summary

| Phase | User Story | Priority | Task Count |
|-------|------------|----------|------------|
| 1 | Setup | - | 17 |
| 2 | Foundational | - | 11 |
| 3 | US1: Chart of Accounts | P1 | 21 |
| 4 | US2: Purchase-to-Pay | P1 | 39 |
| 5 | US3: Order-to-Cash | P1 | 23 |
| 6 | US4: Manufacturing Cost | P2 | 9 |
| 7 | US5: Financial Statements | P2 | 18 |
| 8 | US6: VAT and WHT | P2 | 17 |
| 9 | US7: Fixed Assets | P2 | 37 |
| 10 | US8: Equipment Maintenance | P2 | 33 |
| 11 | US9: Period-End Closing | P3 | 15 |
| 12 | US10: HR Payroll Integration | P3 | 6 |
| 13 | Polish | - | 9 |
| **Total** | | | **255** |

**MVP Scope (P1 Stories)**: 111 tasks (Setup + Foundational + US1-3)
**Full Scope**: 255 tasks across 10 user stories

**Format Validation**: All 255 tasks follow checklist format (checkbox, ID, [P] if parallel, [Story] for phases 3+, file paths)
