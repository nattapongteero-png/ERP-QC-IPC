# Tasks: Accounting Module Gap Analysis

**Input**: Design documents from `/specs/011-accounting-spec-gap/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and database schema setup for all new entities

- [X] T001 Add Purchase Requisition tables to database schema in src/lib/db/schema.ts (purchase_requisitions, purchase_requisition_lines)
- [X] T002 [P] Add Bank Reconciliation tables to database schema in src/lib/db/schema.ts (bank_statements, bank_statement_lines, reconciliation_matches)
- [X] T003 [P] Add Credit/Debit Note tables to database schema in src/lib/db/schema.ts (credit_debit_notes, credit_debit_note_lines)
- [X] T004 [P] Add 3-Way Matching tables to database schema in src/lib/db/schema.ts (matching_tolerances, matching_results, matching_exceptions)
- [X] T005 [P] Add Approval Workflow tables to database schema in src/lib/db/schema.ts (approval_flows, approval_rules, approval_steps, approval_requests, approval_request_steps, approval_delegations)
- [X] T006 [P] Add Variance Analysis tables to database schema in src/lib/db/schema.ts (standard_costs, variance_records)
- [X] T007 Verify schema sync works for all new tables by running test suite

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: Approval Workflows (User Story 5) is foundational because PR, PO, AP Invoice, and other documents require approval routing. This phase implements the approval workflow engine.

### Approval Workflow Engine (Foundation for US1, US3, US4)

- [X] T008 Create approval-workflow type definitions in src/types/approval-workflow.ts
- [X] T009 [P] Create approval-workflow Zod validation schemas in src/lib/validation/approval-workflow.ts
- [X] T010 Implement approval-workflow.service.ts in src/lib/services/approval-workflow.service.ts (CRUD for flows, rules, steps)
- [X] T011 Implement approval request submission logic in src/lib/services/approval-workflow.service.ts (submitForApproval, evaluateRules, createRequest)
- [X] T012 Implement approval actions in src/lib/services/approval-workflow.service.ts (approve, reject, delegate)
- [X] T013 [P] Create API route GET/POST /api/settings/approval-flows in src/app/api/settings/approval-flows/route.ts
- [X] T014 [P] Create API route GET/PUT/DELETE /api/settings/approval-flows/[id] in src/app/api/settings/approval-flows/[id]/route.ts
- [X] T015 [P] Create API route POST /api/settings/approval-flows/[id]/rules in src/app/api/settings/approval-flows/[id]/rules/route.ts
- [X] T016 [P] Create API route POST /api/settings/approval-flows/[id]/steps in src/app/api/settings/approval-flows/[id]/steps/route.ts
- [X] T017 [P] Create API route POST /api/approval/submit in src/app/api/approval/submit/route.ts
- [X] T018 [P] Create API route GET /api/approval/requests in src/app/api/approval/requests/route.ts
- [X] T019 [P] Create API route GET /api/approval/requests/[id] in src/app/api/approval/requests/[id]/route.ts
- [X] T020 [P] Create API route POST /api/approval/requests/[id]/approve in src/app/api/approval/requests/[id]/approve/route.ts
- [X] T021 [P] Create API route POST /api/approval/requests/[id]/reject in src/app/api/approval/requests/[id]/reject/route.ts
- [X] T022 [P] Create API route POST /api/approval/requests/[id]/delegate in src/app/api/approval/requests/[id]/delegate/route.ts
- [X] T023 [P] Create API route GET/POST /api/approval/delegations in src/app/api/approval/delegations/route.ts
- [X] T024 [P] Create API route GET /api/approval/dashboard in src/app/api/approval/dashboard/route.ts
- [X] T025 Create shared ApprovalWorkflow UI component in src/components/shared/ApprovalWorkflow.tsx
- [X] T026 Create ApprovalFlowForm component in src/components/settings/ApprovalFlowForm.tsx
- [X] T027 Create Approval Flows list page in src/app/settings/approval-workflows/page.tsx
- [X] T028 Create Approval Flow detail/edit page in src/app/settings/approval-workflows/[id]/page.tsx
- [X] T029 Add Approval Workflows to sidebar navigation in src/components/layout/sidebar.tsx
- [X] T030 Create unit test for approval-workflow.service.ts in tests/unit/lib/services/approval-workflow.service.test.ts

**Checkpoint**: Approval workflow engine ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Purchase Requisition Workflow (Priority: P1)

**Goal**: Enable Purchasing Officers to create Purchase Requisitions (PR) with approval routing before creating Purchase Orders

**Independent Test**: Create a PR, route for approval, approve/reject, and convert approved PR to PO

### Implementation for User Story 1

- [X] T031 [P] [US1] Create purchase-requisition type definitions in src/types/purchase-requisition.ts
- [X] T032 [P] [US1] Create purchase-requisition Zod validation schemas in src/lib/validation/purchase-requisition.ts
- [X] T033 [US1] Implement purchase-requisition.service.ts in src/lib/services/purchase-requisition.service.ts (CRUD, PR number generation)
- [X] T034 [US1] Implement PR status workflow in src/lib/services/purchase-requisition.service.ts (draft, submitted, pending_approval, approved, rejected)
- [X] T035 [US1] Implement PR submit for approval in src/lib/services/purchase-requisition.service.ts (integrate with approval workflow)
- [X] T036 [US1] Implement PR to PO conversion in src/lib/services/purchase-requisition.service.ts (convertToPO function)
- [X] T037 [P] [US1] Create API route GET/POST /api/purchasing/requisitions in src/app/api/purchasing/requisitions/route.ts
- [X] T038 [P] [US1] Create API route GET/PUT /api/purchasing/requisitions/[id] in src/app/api/purchasing/requisitions/[id]/route.ts
- [X] T039 [P] [US1] Create API route POST /api/purchasing/requisitions/[id]/submit in src/app/api/purchasing/requisitions/[id]/submit/route.ts
- [X] T040 [P] [US1] Create API route POST /api/purchasing/requisitions/[id]/approve in src/app/api/purchasing/requisitions/[id]/approve/route.ts
- [X] T041 [P] [US1] Create API route POST /api/purchasing/requisitions/[id]/reject in src/app/api/purchasing/requisitions/[id]/reject/route.ts
- [X] T042 [P] [US1] Create API route POST /api/purchasing/requisitions/[id]/convert in src/app/api/purchasing/requisitions/[id]/convert/route.ts
- [X] T043 [P] [US1] Create API route GET/POST /api/purchasing/requisitions/[id]/lines in src/app/api/purchasing/requisitions/[id]/lines/route.ts
- [X] T044 [US1] Create PRForm component in src/components/purchasing/PRForm.tsx
- [X] T045 [US1] Create PRLineGrid component in src/components/purchasing/PRLineGrid.tsx
- [X] T046 [US1] Create PR list page in src/app/purchasing/requisitions/page.tsx
- [X] T047 [US1] Create PR create page in src/app/purchasing/requisitions/new/page.tsx
- [X] T048 [US1] Create PR detail/edit page in src/app/purchasing/requisitions/[id]/page.tsx
- [X] T049 [US1] Add Requisitions to sidebar navigation in src/components/layout/sidebar.tsx
- [X] T050 [US1] Create unit test for purchase-requisition.service.ts in tests/unit/lib/services/purchase-requisition.service.test.ts
- [X] T051 [US1] Create UI test for PR list page in tests/app/purchasing/requisitions/page.test.tsx

**Checkpoint**: User Story 1 complete - PRs can be created, approved, and converted to POs

---

## Phase 4: User Story 2 - Bank Reconciliation (Priority: P1)

**Goal**: Enable Accountants to import bank statements, auto-match transactions, and reconcile with recorded payments

**Independent Test**: Import a bank statement CSV, run auto-matching, manually match remaining items, create bank charge journals

### Implementation for User Story 2

- [X] T052 [P] [US2] Create bank-reconciliation type definitions in src/types/bank-reconciliation.ts
- [X] T053 [P] [US2] Create bank-reconciliation Zod validation schemas in src/lib/validation/bank-reconciliation.ts
- [X] T054 [US2] Implement bank-reconciliation.service.ts in src/lib/services/bank-reconciliation.service.ts (CRUD for statements)
- [X] T055 [US2] Implement CSV import logic in src/lib/services/bank-reconciliation.service.ts (importBankStatement)
- [X] T056 [US2] Implement auto-matching algorithm in src/lib/services/bank-reconciliation.service.ts (autoMatch with date/amount tolerance)
- [X] T057 [US2] Implement manual matching in src/lib/services/bank-reconciliation.service.ts (matchLineToPayment)
- [X] T058 [US2] Implement bank charge journal creation in src/lib/services/bank-reconciliation.service.ts (createBankChargeJournal)
- [X] T059 [US2] Implement reconciliation completion in src/lib/services/bank-reconciliation.service.ts (markReconciled)
- [X] T060 [P] [US2] Create API route GET /api/accounting/bank-statements in src/app/api/accounting/bank-statements/route.ts
- [X] T061 [P] [US2] Create API route POST /api/accounting/bank-statements/import in src/app/api/accounting/bank-statements/import/route.ts
- [X] T062 [P] [US2] Create API route GET /api/accounting/bank-statements/[id] in src/app/api/accounting/bank-statements/[id]/route.ts
- [X] T063 [P] [US2] Create API route POST /api/accounting/bank-statements/[id]/auto-match in src/app/api/accounting/bank-statements/[id]/auto-match/route.ts
- [X] T064 [P] [US2] Create API route GET /api/accounting/bank-statements/[id]/lines in src/app/api/accounting/bank-statements/[id]/lines/route.ts
- [X] T065 [P] [US2] Create API route POST /api/accounting/bank-statements/[id]/lines/[lineId]/match in src/app/api/accounting/bank-statements/[id]/lines/[lineId]/match/route.ts
- [X] T066 [P] [US2] Create API route POST /api/accounting/bank-statements/[id]/lines/[lineId]/create-journal in src/app/api/accounting/bank-statements/[id]/lines/[lineId]/create-journal/route.ts
- [X] T067 [P] [US2] Create API route POST /api/accounting/bank-statements/[id]/reconcile in src/app/api/accounting/bank-statements/[id]/reconcile/route.ts
- [X] T068 [P] [US2] Create API route GET /api/accounting/bank-statements/[id]/unmatched-payments in src/app/api/accounting/bank-statements/[id]/unmatched-payments/route.ts
- [X] T069 [US2] Create BankStatementImport component in src/components/accounting/BankStatementImport.tsx
- [X] T070 [US2] Create ReconciliationGrid component in src/components/accounting/ReconciliationGrid.tsx
- [X] T071 [US2] Create Bank Statement list page in src/app/accounting/bank-reconciliation/page.tsx
- [X] T072 [US2] Create Bank Statement import page in src/app/accounting/bank-reconciliation/import/page.tsx
- [X] T073 [US2] Create Bank Statement reconciliation detail page in src/app/accounting/bank-reconciliation/[id]/page.tsx
- [X] T074 [US2] Add Bank Reconciliation to sidebar navigation in src/components/layout/sidebar.tsx
- [X] T075 [US2] Create unit test for bank-reconciliation.service.ts in tests/unit/lib/services/bank-reconciliation.service.test.ts
- [X] T076 [US2] Create UI test for bank reconciliation page in tests/app/accounting/bank-reconciliation/page.test.tsx

**Checkpoint**: User Story 2 complete - Bank statements can be imported, matched, and reconciled

---

## Phase 5: User Story 3 - Credit Notes and Debit Notes (Priority: P2)

**Goal**: Enable Accountants to issue Credit Notes (for returns/adjustments) and Debit Notes that properly adjust AR/AP balances with VAT handling

**Independent Test**: Create a credit note referencing an AR invoice, post it, verify reversal entries and invoice balance reduction

### Implementation for User Story 3

- [X] T077 [P] [US3] Create credit-debit-notes type definitions in src/types/credit-debit-notes.ts
- [X] T078 [P] [US3] Create credit-debit-notes Zod validation schemas in src/lib/validation/credit-debit-notes.ts
- [X] T079 [US3] Implement credit-debit-notes.service.ts in src/lib/services/credit-debit-notes.service.ts (CRUD, note number generation)
- [X] T080 [US3] Implement CN/DN posting logic in src/lib/services/credit-debit-notes.service.ts (create reversal JE, VAT transaction)
- [X] T081 [US3] Implement invoice balance update in src/lib/services/credit-debit-notes.service.ts (reduce balance_due on invoice)
- [X] T082 [US3] Implement available-for-credit check in src/lib/services/credit-debit-notes.service.ts (getInvoiceAvailableForCredit)
- [X] T083 [P] [US3] Create API route GET/POST /api/accounting/credit-notes in src/app/api/accounting/credit-notes/route.ts
- [X] T084 [P] [US3] Create API route GET/PUT /api/accounting/credit-notes/[id] in src/app/api/accounting/credit-notes/[id]/route.ts
- [X] T085 [P] [US3] Create API route POST /api/accounting/credit-notes/[id]/submit in src/app/api/accounting/credit-notes/[id]/submit/route.ts
- [X] T086 [P] [US3] Create API route POST /api/accounting/credit-notes/[id]/approve in src/app/api/accounting/credit-notes/[id]/approve/route.ts
- [X] T087 [P] [US3] Create API route POST /api/accounting/credit-notes/[id]/post in src/app/api/accounting/credit-notes/[id]/post/route.ts
- [X] T088 [P] [US3] Create API route POST /api/accounting/credit-notes/[id]/cancel in src/app/api/accounting/credit-notes/[id]/cancel/route.ts
- [X] T089 [P] [US3] Create API route GET/POST /api/accounting/debit-notes in src/app/api/accounting/debit-notes/route.ts
- [X] T090 [P] [US3] Create API route GET /api/accounting/debit-notes/[id] in src/app/api/accounting/debit-notes/[id]/route.ts
- [X] T091 [P] [US3] Create API route POST /api/accounting/debit-notes/[id]/post in src/app/api/accounting/debit-notes/[id]/post/route.ts
- [X] T092 [P] [US3] Create API route GET /api/accounting/invoices/[id]/available-for-credit in src/app/api/accounting/invoices/[id]/available-for-credit/route.ts
- [X] T093 [US3] Create CreditNoteForm component in src/components/accounting/CreditNoteForm.tsx
- [X] T094 [US3] Create Credit Notes list page in src/app/accounting/credit-notes/page.tsx
- [X] T095 [US3] Create Credit Note create page in src/app/accounting/credit-notes/new/page.tsx
- [X] T096 [US3] Create Debit Notes list page in src/app/accounting/debit-notes/page.tsx
- [X] T097 [US3] Create Debit Note create page in src/app/accounting/debit-notes/new/page.tsx
- [X] T098 [US3] Add Credit Notes and Debit Notes to sidebar navigation in src/components/layout/sidebar.tsx
- [X] T099 [US3] Create unit test for credit-debit-notes.service.ts in tests/unit/lib/services/credit-debit-notes.service.test.ts
- [X] T100 [US3] Create UI test for credit notes page in tests/app/accounting/credit-notes/page.test.tsx

**Checkpoint**: User Story 3 complete - CN/DN can be created, approved, posted with proper GL entries

---

## Phase 6: User Story 4 - 3-Way Matching with Tolerances (Priority: P2)

**Goal**: Enable Finance Controllers to validate AP invoices against PO quantities/prices and GRN received quantities within configurable tolerances

**Independent Test**: Configure tolerance profile, create AP invoice with variance, verify matching exceptions and approval workflow

### Implementation for User Story 4

- [X] T101 [P] [US4] Create matching type definitions in src/types/matching.ts
- [X] T102 [P] [US4] Create matching Zod validation schemas in src/lib/validation/matching.ts
- [X] T103 [US4] Implement matching.service.ts in src/lib/services/matching.service.ts (CRUD for tolerances)
- [X] T104 [US4] Implement 3-way matching algorithm in src/lib/services/matching.service.ts (runMatching comparing PO/GRN/Invoice)
- [X] T105 [US4] Implement exception creation in src/lib/services/matching.service.ts (createMatchingException)
- [X] T106 [US4] Implement exception approval/rejection in src/lib/services/matching.service.ts (approveException, rejectException)
- [X] T107 [US4] Implement GR/IR clearing report in src/lib/services/matching.service.ts (getGRIRClearingReport)
- [X] T108 [P] [US4] Create API route GET/POST /api/settings/matching-tolerances in src/app/api/settings/matching-tolerances/route.ts
- [X] T109 [P] [US4] Create API route GET/PUT/DELETE /api/settings/matching-tolerances/[id] in src/app/api/settings/matching-tolerances/[id]/route.ts
- [X] T110 [P] [US4] Create API route GET /api/accounting/matching in src/app/api/accounting/matching/route.ts
- [X] T111 [P] [US4] Create API route POST /api/accounting/matching/invoice/[id] in src/app/api/accounting/matching/invoice/[id]/route.ts
- [X] T112 [P] [US4] Create API route GET /api/accounting/matching/results/[id] in src/app/api/accounting/matching/results/[id]/route.ts
- [X] T113 [P] [US4] Create API route GET /api/accounting/matching/exceptions in src/app/api/accounting/matching/exceptions/route.ts
- [X] T114 [P] [US4] Create API route POST /api/accounting/matching/exceptions/[id]/approve in src/app/api/accounting/matching/exceptions/[id]/approve/route.ts
- [X] T115 [P] [US4] Create API route POST /api/accounting/matching/exceptions/[id]/reject in src/app/api/accounting/matching/exceptions/[id]/reject/route.ts
- [X] T116 [P] [US4] Create API route GET /api/accounting/reports/gr-ir-clearing in src/app/api/accounting/reports/gr-ir-clearing/route.ts
- [X] T117 [US4] Create Matching Tolerances config page in src/app/settings/matching-tolerances/page.tsx
- [X] T118 [US4] Create Matching Exceptions list page in src/app/accounting/matching/page.tsx
- [X] T119 [US4] Add Matching Tolerances to sidebar navigation in src/components/layout/sidebar.tsx
- [X] T120 [US4] Integrate matching validation into AP Invoice posting in src/lib/services/accounting.service.ts
- [X] T121 [US4] Create unit test for matching.service.ts in tests/unit/lib/services/matching.service.test.ts
- [X] T122 [US4] Create UI test for matching tolerances page in tests/app/settings/matching-tolerances/page.test.tsx

**Checkpoint**: User Story 4 complete - AP invoices are validated against PO/GRN with tolerance checking

---

## Phase 7: User Story 5 - Configurable Approval Workflows (Priority: P2)

**Goal**: Enable Finance Managers to configure approval workflows for financial documents with amount thresholds and segregation of duties

**Note**: The approval workflow engine was implemented in Phase 2 (Foundational). This phase adds the configuration UI and additional features.

### Implementation for User Story 5

- [X] T123 [US5] Enhance approval workflow UI with rule builder in src/components/settings/ApprovalRuleBuilder.tsx
- [X] T124 [US5] Create approval workflow testing/preview feature in src/lib/services/approval-workflow.service.ts (testWorkflow)
- [X] T125 [US5] Add approval workflow audit log view in src/app/settings/approval-workflows/[id]/history/page.tsx
- [X] T126 [US5] Create Approval Dashboard page in src/app/accounting/approvals/page.tsx
- [X] T127 [US5] Add Approvals to sidebar navigation in src/components/layout/sidebar.tsx
- [X] T128 [US5] Create E2E test for approval workflow in tests/e2e/accounting/approval-workflow.spec.ts

**Checkpoint**: User Story 5 complete - Approval workflows are fully configurable with rule-based routing

---

## Phase 8: User Story 6 - Manufacturing Variance Analysis (Priority: P3)

**Goal**: Enable Cost Accountants to analyze manufacturing variances (material price, usage, labor, overhead) when using standard costing

**Independent Test**: Set standard costs for an item, complete a work order, calculate variances, verify variance journal entries

### Implementation for User Story 6

- [X] T129 [P] [US6] Create variance type definitions in src/types/variance.ts
- [X] T130 [P] [US6] Create variance Zod validation schemas in src/lib/validation/variance.ts
- [X] T131 [US6] Implement variance-analysis.service.ts in src/lib/services/variance-analysis.service.ts (CRUD for standard costs)
- [X] T132 [US6] Implement variance calculation in src/lib/services/variance-analysis.service.ts (calculateWorkOrderVariances for MPV, MUV, LRV, LEV)
- [X] T133 [US6] Implement standard cost roll-up from BOM in src/lib/services/variance-analysis.service.ts (rollupStandardCosts)
- [X] T134 [US6] Implement variance posting in src/lib/services/variance-analysis.service.ts (postVariances creating JE)
- [X] T135 [US6] Integrate variance calculation into work order completion in src/lib/services/production.service.ts
- [X] T136 [P] [US6] Create API route GET/POST /api/accounting/standard-costs in src/app/api/accounting/standard-costs/route.ts
- [X] T137 [P] [US6] Create API route GET /api/accounting/standard-costs/[id] in src/app/api/accounting/standard-costs/[id]/route.ts
- [X] T138 [P] [US6] Create API route GET /api/accounting/standard-costs/item/[itemId] in src/app/api/accounting/standard-costs/item/[itemId]/route.ts
- [X] T139 [P] [US6] Create API route POST /api/accounting/standard-costs/rollup in src/app/api/accounting/standard-costs/rollup/route.ts
- [X] T140 [P] [US6] Create API route GET /api/accounting/variances in src/app/api/accounting/variances/route.ts
- [X] T141 [P] [US6] Create API route GET /api/accounting/variances/work-order/[id] in src/app/api/accounting/variances/work-order/[id]/route.ts
- [X] T142 [P] [US6] Create API route POST /api/accounting/variances/calculate in src/app/api/accounting/variances/calculate/route.ts
- [X] T143 [P] [US6] Create API route POST /api/accounting/variances/post in src/app/api/accounting/variances/post/route.ts
- [X] T144 [P] [US6] Create API route GET /api/accounting/reports/variance-summary in src/app/api/accounting/reports/variance-summary/route.ts
- [X] T145 [P] [US6] Create API route GET /api/accounting/reports/material-variance in src/app/api/accounting/reports/material-variance/route.ts
- [X] T146 [P] [US6] Create API route GET /api/accounting/reports/labor-variance in src/app/api/accounting/reports/labor-variance/route.ts
- [X] T147 [US6] Create VarianceChart component in src/components/accounting/VarianceChart.tsx
- [X] T148 [US6] Create Standard Costs management page in src/app/accounting/standard-costs/page.tsx
- [X] T149 [US6] Create Variance Reports dashboard in src/app/accounting/variance-reports/page.tsx
- [X] T150 [US6] Add Variance Reports to sidebar navigation in src/components/layout/sidebar.tsx
- [X] T151 [US6] Create unit test for variance-analysis.service.ts in tests/unit/lib/services/variance-analysis.service.test.ts
- [X] T152 [US6] Create UI test for variance reports page in tests/app/accounting/variance-reports/page.test.tsx

**Checkpoint**: User Story 6 complete - Variances are calculated at WO completion and can be reported

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T153 [P] Add data-testid attributes to all new UI components for E2E testing
- [X] T154 [P] Create E2E test for Purchase Requisitions in tests/e2e/accounting/purchase-requisitions.test.tsx
- [X] T155 [P] Create E2E test for Bank Reconciliation in tests/e2e/accounting/bank-reconciliation.test.tsx
- [X] T156 [P] Create E2E test for Credit Notes in tests/e2e/accounting/credit-notes.test.tsx
- [X] T157 [P] Create E2E test for Variance Reports in tests/e2e/accounting/variance-reports.test.tsx
- [X] T158 Code cleanup and ensure all new code follows existing patterns
- [X] T159 Run full test suite and fix any failures
- [X] T160 Validate all new features against quickstart.md scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories (implements approval workflow engine)
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - US1 (PR) and US2 (Bank Recon) can proceed in parallel
  - US3 (CN/DN), US4 (Matching), US5 (Approval Config) can proceed in parallel
  - US6 (Variance) can proceed independently
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

| Story | Priority | Can Start After | Independent Test |
|-------|----------|-----------------|------------------|
| US1 - Purchase Requisitions | P1 | Phase 2 | Yes - PR lifecycle is self-contained |
| US2 - Bank Reconciliation | P1 | Phase 2 | Yes - Statement import/matching is self-contained |
| US3 - Credit/Debit Notes | P2 | Phase 2 | Yes - CN/DN with existing invoices |
| US4 - 3-Way Matching | P2 | Phase 2 | Yes - Tolerance config and matching is self-contained |
| US5 - Approval Workflows | P2 | Phase 2 | Yes - Workflow configuration UI |
| US6 - Variance Analysis | P3 | Phase 2 | Yes - Standard costs and variance calculation |

### Within Each User Story

- Types/Validation schemas before services
- Services before API routes
- API routes before UI components
- UI components before pages
- Core implementation before unit tests
- Unit tests before E2E tests

### Parallel Opportunities

**Phase 1 - All setup tasks marked [P] can run in parallel:**
- T002, T003, T004, T005, T006 (schema additions)

**Phase 2 - After T008-T012 (service layer), API routes can be parallel:**
- T013, T014, T015, T016 (workflow config routes)
- T017, T018, T019, T020, T021, T022, T023, T024 (approval request routes)

**Phase 3-8 - User stories can be worked in parallel by different developers:**
- Developer A: User Story 1 (Purchase Requisitions)
- Developer B: User Story 2 (Bank Reconciliation)
- Developer C: User Story 3 (Credit/Debit Notes)

---

## Parallel Example: User Story 1

```bash
# Launch all type/validation tasks together:
Task: "Create purchase-requisition type definitions in src/types/purchase-requisition.ts"
Task: "Create purchase-requisition Zod validation schemas in src/lib/validation/purchase-requisition.ts"

# After service is complete, launch all API routes together:
Task: "Create API route GET/POST /api/purchasing/requisitions"
Task: "Create API route GET/PUT /api/purchasing/requisitions/[id]"
Task: "Create API route POST /api/purchasing/requisitions/[id]/submit"
# ... etc
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Setup (schema additions)
2. Complete Phase 2: Foundational (approval workflow engine)
3. Complete Phase 3: User Story 1 (Purchase Requisitions)
4. Complete Phase 4: User Story 2 (Bank Reconciliation)
5. **STOP and VALIDATE**: Test US1 + US2 independently
6. Deploy/demo if ready - this covers the P1 priorities

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 (P1) → Test independently → Deploy
3. Add User Story 2 (P1) → Test independently → Deploy
4. Add User Story 3 (P2) → Test independently → Deploy
5. Add User Story 4 (P2) → Test independently → Deploy
6. Add User Story 5 (P2) → Test independently → Deploy
7. Add User Story 6 (P3) → Test independently → Deploy
8. Polish phase → Final testing → Complete

---

## Summary

| Phase | Tasks | Parallel Tasks | Description |
|-------|-------|----------------|-------------|
| Phase 1 | T001-T007 | 5 | Setup - Database schema |
| Phase 2 | T008-T030 | 12 | Foundational - Approval workflow engine |
| Phase 3 | T031-T051 | 11 | US1 - Purchase Requisitions (P1) |
| Phase 4 | T052-T076 | 12 | US2 - Bank Reconciliation (P1) |
| Phase 5 | T077-T100 | 11 | US3 - Credit/Debit Notes (P2) |
| Phase 6 | T101-T122 | 11 | US4 - 3-Way Matching (P2) |
| Phase 7 | T123-T128 | 0 | US5 - Approval Workflows UI (P2) |
| Phase 8 | T129-T152 | 13 | US6 - Variance Analysis (P3) |
| Phase 9 | T153-T160 | 5 | Polish & Cross-Cutting |

**Total Tasks**: 160
**MVP (US1 + US2)**: 76 tasks (Phases 1-4)
**Suggested MVP Scope**: Complete Phases 1-4 for P1 features (Purchase Requisitions, Bank Reconciliation)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Approval Workflow is in Foundational because it's required by PR, CN/DN, and other documents
