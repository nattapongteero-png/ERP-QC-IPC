# Tasks: Unit Cost Calculation System

**Input**: Design documents from `/specs/014-unit-cost/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Unit tests for critical cost calculation logic (Constitution requirement: "Unit tests for cost calculations")

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Following existing Next.js App Router structure per plan.md:
- **Types**: `src/types/`
- **Validation**: `src/lib/validation/`
- **Database Schema**: `src/lib/db/`
- **Services**: `src/lib/services/`
- **API Routes**: `src/app/api/`
- **Pages**: `src/app/`
- **Components**: `src/components/`
- **Tests**: `tests/`

---

## Phase 1: Setup (Shared Infrastructure) ✓ COMPLETE

**Purpose**: Create foundational types, validation, and database schema

- [x] T001 [P] Create unit cost TypeScript interfaces in `src/types/unit-cost.ts`
- [x] T002 [P] Create unit cost Zod validation schemas in `src/lib/validation/unit-cost.ts`
- [x] T003 [P] Add work_centers table (SQLite + MySQL) to `src/lib/db/schema.ts`
- [x] T004 [P] Add item_cost_layers table (SQLite + MySQL) to `src/lib/db/schema.ts`
- [x] T005 [P] Add landed_cost_headers table (SQLite + MySQL) to `src/lib/db/schema.ts`
- [x] T006 [P] Add landed_cost_lines table (SQLite + MySQL) to `src/lib/db/schema.ts`
- [x] T007 [P] Add landed_cost_allocations table (SQLite + MySQL) to `src/lib/db/schema.ts`
- [x] T008 [P] Add overhead_rates table (SQLite + MySQL) to `src/lib/db/schema.ts`
- [x] T009 [P] Add work_order_operations table (SQLite + MySQL) to `src/lib/db/schema.ts`
- [x] T010 [P] Add work_order_costs table (SQLite + MySQL) to `src/lib/db/schema.ts`
- [x] T011 [P] Add cost_gl_mapping table (SQLite + MySQL) to `src/lib/db/schema.ts`
- [x] T012 Add cost fields to items table (currentWAC, lastPurchaseCost, etc.) in `src/lib/db/schema.ts`
- [x] T013 Add cost fields to work_order_materials table (unitCost, totalCost) in `src/lib/db/schema.ts`
- [x] T014 Add cost fields to sales_order_lines table (unitCost, marginAmount, marginPercent) in `src/lib/db/schema.ts`
- [x] T015 Verify schema sync works and run type check with `pnpm tsc --noEmit`
- [x] T016 Commit Phase 1 setup changes

**Checkpoint**: Schema and types ready - foundational phase can begin

---

## Phase 2: Foundational (Blocking Prerequisites) ✓ COMPLETE

**Purpose**: Core cost calculation service that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T017 Create `src/lib/services/unit-cost.service.ts` with core function stubs
- [x] T018 Implement `recalculateWAC()` function - core WAC calculation logic in `src/lib/services/unit-cost.service.ts`
- [x] T019 Implement `createCostLayer()` function - audit trail creation in `src/lib/services/unit-cost.service.ts`
- [x] T020 Implement `getItemCostViews()` function - retrieve all cost views in `src/lib/services/unit-cost.service.ts`
- [x] T021 Implement `getCostLayerHistory()` function - cost layer list in `src/lib/services/unit-cost.service.ts`
- [x] T022 Create unit test file `tests/unit/lib/services/unit-cost.service.test.ts`
- [x] T023 Write unit tests for WAC calculation (positive qty, zero inventory, negative prevention) in `tests/unit/lib/services/unit-cost.service.test.ts`
- [x] T024 Run tests and verify they pass with `pnpm test`
- [x] T025 Commit Phase 2 foundational changes

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Inventory Cost Tracking on Purchase Receipt (Priority: P1) MVP ✓ COMPLETE

**Goal**: Automatically calculate and track WAC when receiving purchase orders with audit trail

**Independent Test**: Receive a PO and verify item's WAC is correctly calculated, cost layer created

### Implementation for User Story 1

- [x] T026 [US1] Modify `receiveMaterial()` in `src/lib/services/inventory.service.ts` to call `recalculateWAC()` on receipt
- [x] T027 [US1] Update item's lastPurchaseCost, lastPurchaseDate, lastPurchasePoId on receipt in `src/lib/services/inventory.service.ts`
- [x] T028 [US1] Create API route GET `src/app/api/cost/items/[id]/cost-views/route.ts`
- [x] T029 [US1] Create API route GET `src/app/api/cost/items/[id]/cost-layers/route.ts`
- [x] T030 [P] [US1] Create CostViewsPanel component in `src/components/cost/CostViewsPanel.tsx`
- [x] T031 [P] [US1] Create CostLayerHistory component in `src/components/cost/CostLayerHistory.tsx`
- [x] T032 [US1] Add cost display to item detail page (integrate CostViewsPanel and CostLayerHistory)
- [x] T033 [US1] Write integration test for cost layer API in `tests/integration/api/cost/cost-layers.test.ts`
- [x] T034 [US1] Test manually: receive PO, verify WAC updates, cost layer created
- [x] T035 [US1] Run all tests and type check with `pnpm test && pnpm tsc --noEmit`
- [x] T036 [US1] Commit User Story 1 changes

**Checkpoint**: US1 complete - WAC tracking on receipt works independently

---

## Phase 4: User Story 2 - Landed Cost Allocation (Priority: P2) ✓ COMPLETE

**Goal**: Allocate freight, duty, insurance costs to received items and update WAC

**Independent Test**: Create landed cost against PO, allocate, post, verify item WAC updated

### Implementation for User Story 2

- [x] T037 [US2] Implement landed cost service functions in `src/lib/services/unit-cost.service.ts`:
  - `createLandedCost()` - create header with lines
  - `getLandedCost()` - get with lines and allocations
  - `listLandedCosts()` - list with filters
  - `updateLandedCost()` - update draft document
  - `deleteLandedCost()` - delete draft document
- [x] T038 [US2] Implement `allocateLandedCost()` function (4 allocation bases) in `src/lib/services/unit-cost.service.ts`
- [x] T039 [US2] Implement `postLandedCost()` function (update WAC, create cost layers) in `src/lib/services/unit-cost.service.ts`
- [x] T040 [US2] Write unit tests for landed cost allocation (value, quantity, weight, volume) in `tests/unit/lib/services/unit-cost.service.test.ts`
- [x] T041 [P] [US2] Create API route GET/POST `src/app/api/cost/landed-costs/route.ts`
- [x] T042 [P] [US2] Create API route GET/PUT/DELETE `src/app/api/cost/landed-costs/[id]/route.ts`
- [x] T043 [P] [US2] Create API route POST `src/app/api/cost/landed-costs/[id]/allocate/route.ts`
- [x] T044 [P] [US2] Create API route POST `src/app/api/cost/landed-costs/[id]/post/route.ts`
- [x] T045 [P] [US2] Create LandedCostForm component in `src/components/cost/LandedCostForm.tsx`
- [x] T046 [P] [US2] Create LandedCostAllocationGrid component in `src/components/cost/LandedCostAllocationGrid.tsx` (combined into LandedCostForm)
- [x] T047 [US2] Create cost module layout in `src/app/cost/layout.tsx`
- [x] T048 [US2] Create landed costs list page in `src/app/cost/landed-costs/page.tsx`
- [x] T049 [US2] Create new landed cost page in `src/app/cost/landed-costs/new/page.tsx`
- [x] T050 [US2] Create edit landed cost page in `src/app/cost/landed-costs/[id]/page.tsx`
- [x] T051 [US2] Add Landed Costs menu to sidebar in `src/components/layout/sidebar.tsx`
- [x] T052 [US2] Write integration test for landed cost API in `tests/integration/api/cost/landed-costs.test.ts`
- [x] T053 [US2] Test manually: create landed cost, allocate, post, verify WAC updates
- [x] T054 [US2] Run all tests and type check
- [x] T055 [US2] Commit User Story 2 changes

**Checkpoint**: US2 complete - Landed cost allocation works independently

---

## Phase 5: User Story 3 - Production Cost Aggregation (Priority: P3) ✓ COMPLETE

**Goal**: Calculate work order costs (material + labor + overhead) and update FG WAC

**Independent Test**: Complete work order with materials and labor, verify unit cost calculated, FG WAC updated

**Dependency Note**: US6 (Work Center Configuration) provides the rates, but default rates can be used for testing

### Implementation for User Story 3

- [x] T056 [US3] Implement production cost functions in `src/lib/services/unit-cost.service.ts`:
  - `calculateWorkOrderCost()` - aggregate material, labor, overhead
  - `getWorkOrderOperations()` - get operations with time tracking
  - `updateWorkOrderOperations()` - update actual hours
  - `getWorkOrderCostSummary()` - cost breakdown view
- [x] T057 [US3] Modify `issueMaterialToWorkOrder()` in `src/lib/services/production.service.ts` to capture unitCost
- [x] T058 [US3] Modify `completeWorkOrder()` in `src/lib/services/production.service.ts` to:
  - Calculate total production cost
  - Update work_order_costs table
  - Update finished goods WAC
  - Update item's lastProductionCost, lastProductionDate
- [x] T059 [US3] Write unit tests for production cost calculation in `tests/unit/lib/services/unit-cost.service.test.ts`
- [x] T060 [P] [US3] Create API route GET `src/app/api/production/work-orders/[id]/costs/route.ts`
- [x] T061 [P] [US3] Create API route GET/PUT `src/app/api/production/work-orders/[id]/operations/route.ts`
- [x] T062 [P] [US3] Create WorkOrderCostSummary component in `src/components/production/work-order-cost-summary.tsx`
- [x] T063 [US3] Add WorkOrderCostSummary to work order detail page
- [x] T064 [US3] Test manually: create WO, issue materials, record hours, complete, verify costs
- [x] T065 [US3] Run all tests and type check
- [x] T066 [US3] Commit User Story 3 changes

**Checkpoint**: US3 complete - Production costing works independently

---

## Phase 6: User Story 4 - Multiple Cost View Access (Priority: P4) ✓ COMPLETE

**Goal**: Display 5 cost perspectives (WAC, standard, last purchase, production, full cost) with suggested pricing

**Independent Test**: View item cost views showing all 5 costs with SG&A calculation and suggested price

### Implementation for User Story 4

- [x] T067 [US4] Implement `calculateFullCost()` function (WAC + SG&A) in `src/lib/services/unit-cost.service.ts`
- [x] T068 [US4] Implement `calculateSuggestedPrice()` function (full cost / (1 - margin%)) in `src/lib/services/unit-cost.service.ts`
- [x] T069 [US4] Create `getItemCostViewsWithPrice()` function with suggested price in `src/lib/services/unit-cost.service.ts`
- [x] T070 [US4] Enhance CostViewsPanel to show all 5 cost types with dates in `src/components/cost/CostViewsPanel.tsx`
- [x] T071 [US4] Add suggested price calculation with configurable target margin to CostViewsPanel
- [x] T072 [US4] Update cost views API to accept margin parameter in `src/app/api/cost/items/[id]/cost-views/route.ts`
- [x] T073 [US4] Add 12 UI tests for CostViewsPanel in `tests/app/cost/CostViewsPanel.test.tsx`
- [x] T074 [US4] Commit User Story 4 changes

**Checkpoint**: US4 complete - Multiple cost views work independently

---

## Phase 7: User Story 5 - COGS Calculation on Sales (Priority: P5) ✓ COMPLETE

**Goal**: Automatically calculate COGS and margin when shipping sales orders

**Independent Test**: Ship sales order line, verify unitCost, totalCost, marginAmount, marginPercent populated

### Implementation for User Story 5

- [x] T075 [US5] Implement `calculateCOGS()` function in `src/lib/services/unit-cost.service.ts`
- [x] T076 [US5] Modify `fulfillSalesOrderLine()` in `src/lib/services/sales.service.ts` to:
  - Get current WAC for each line item via calculateCOGS()
  - Calculate and store unitCost, totalCost via updateSOLineWithCOGS()
  - Calculate and store marginAmount, marginPercent
- [x] T077 [US5] Write 7 unit tests for COGS calculation in `tests/unit/services/unit-cost.service.test.ts`
- [x] T078 [US5] Margin fields already exist on SO lines from Phase 1 schema
- [x] T079 [US5] COGS is automatically calculated during shipment
- [x] T080 [US5] Commit User Story 5 changes

**Checkpoint**: US5 complete - COGS calculation works independently

---

## Phase 8: User Story 6 - Work Center and Rate Configuration (Priority: P6)

**Goal**: Configure work centers with labor and overhead rates for production costing

**Independent Test**: Create work center with rates, create WO with operations, verify rates used for cost calculation

### Implementation for User Story 6

- [ ] T081 [US6] Implement work center CRUD functions in `src/lib/services/unit-cost.service.ts`:
  - `createWorkCenter()`
  - `getWorkCenter()`
  - `listWorkCenters()`
  - `updateWorkCenter()`
  - `deleteWorkCenter()`
- [ ] T082 [US6] Implement overhead rate functions in `src/lib/services/unit-cost.service.ts`:
  - `createOverheadRate()`
  - `listOverheadRates()`
  - `updateOverheadRate()`
  - `getEffectiveOverheadRate()` - get rate for date
- [ ] T083 [P] [US6] Create API route GET/POST `src/app/api/cost/work-centers/route.ts`
- [ ] T084 [P] [US6] Create API route GET/PUT/DELETE `src/app/api/cost/work-centers/[id]/route.ts`
- [ ] T085 [P] [US6] Create API route GET/POST `src/app/api/cost/overhead-rates/route.ts`
- [ ] T086 [P] [US6] Create WorkCenterForm component in `src/components/cost/WorkCenterForm.tsx`
- [ ] T087 [US6] Create work centers list page in `src/app/cost/work-centers/page.tsx`
- [ ] T088 [US6] Create new work center page in `src/app/cost/work-centers/new/page.tsx`
- [ ] T089 [US6] Create edit work center page in `src/app/cost/work-centers/[id]/page.tsx`
- [ ] T090 [US6] Add Work Centers menu to sidebar in `src/components/layout/sidebar.tsx`
- [ ] T091 [US6] Write integration test for work center API in `tests/integration/api/cost/work-centers.test.ts`
- [ ] T092 [US6] Test manually: create work center, verify rates used in production
- [ ] T093 [US6] Commit User Story 6 changes

**Checkpoint**: US6 complete - Work center configuration works independently

---

## Phase 9: User Story 7 - Cost Reports and Dashboard (Priority: P7)

**Goal**: Provide cost dashboard with KPIs and reports for management decision-making

**Independent Test**: View dashboard with KPIs, run reports with filters, verify data accuracy

### Implementation for User Story 7

- [ ] T094 [US7] Implement dashboard KPI functions in `src/lib/services/unit-cost.service.ts`:
  - `getCostDashboardKPIs()` - inventory value, WIP, margins, variances
  - `getTopCostIncreases()` - items with cost increases
  - `getTopMarginErosion()` - SKUs with margin decline
  - `getCostTrend()` - monthly trend data
- [ ] T095 [US7] Implement report functions in `src/lib/services/unit-cost.service.ts`:
  - `getCostSummaryReport()` - item cost views with filters
  - `getProductionCostReport()` - WO cost breakdown
  - `getMarginAnalysisReport()` - sales margin by product/customer
  - `getLandedCostReport()` - procurement analysis
- [ ] T096 [P] [US7] Create API route GET `src/app/api/cost/dashboard/kpis/route.ts`
- [ ] T097 [P] [US7] Create API route GET `src/app/api/reports/cost-summary/route.ts`
- [ ] T098 [P] [US7] Create API route GET `src/app/api/reports/production-cost/route.ts`
- [ ] T099 [P] [US7] Create API route GET `src/app/api/reports/margin-analysis/route.ts`
- [ ] T100 [P] [US7] Create CostDashboard component in `src/components/cost/CostDashboard.tsx`
- [ ] T101 [P] [US7] Create ProductionCostReport component in `src/components/cost/ProductionCostReport.tsx`
- [ ] T102 [P] [US7] Create MarginAnalysisChart component in `src/components/cost/MarginAnalysisChart.tsx`
- [ ] T103 [US7] Create cost dashboard page in `src/app/cost/page.tsx`
- [ ] T104 [US7] Create cost summary report page in `src/app/cost/reports/cost-summary/page.tsx`
- [ ] T105 [US7] Create production cost report page in `src/app/cost/reports/production-cost/page.tsx`
- [ ] T106 [US7] Create margin analysis report page in `src/app/cost/reports/margin-analysis/page.tsx`
- [ ] T107 [US7] Add Reports submenu to sidebar in `src/components/layout/sidebar.tsx`
- [ ] T108 [US7] Test manually: verify all KPIs and reports with sample data
- [ ] T109 [US7] Commit User Story 7 changes

**Checkpoint**: US7 complete - Dashboard and reports work independently

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories

- [ ] T110 [P] Add cost_gl_mapping CRUD for GL integration (optional enhancement)
- [ ] T111 [P] Add number sequence generation for landed cost document numbers
- [ ] T112 [P] Add export functionality to cost reports (Excel/PDF)
- [ ] T113 Run full test suite with `pnpm test`
- [ ] T114 Run type check with `pnpm tsc --noEmit`
- [ ] T115 Run lint check with `pnpm lint`
- [ ] T116 Run quickstart.md validation scenarios
- [ ] T117 Update sidebar navigation order and grouping
- [ ] T118 Final commit and prepare for merge

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-9)**: All depend on Foundational phase completion
- **Polish (Phase 10)**: Depends on all user stories being complete

### User Story Dependencies

| User Story | Can Start After | Dependencies |
|------------|-----------------|--------------|
| US1 (WAC on Receipt) | Phase 2 | None - core MVP |
| US2 (Landed Costs) | Phase 2 | Uses WAC from US1 but independently testable |
| US3 (Production Costs) | Phase 2 | Uses work centers (US6) but can use defaults |
| US4 (Cost Views) | Phase 2 | Displays data from US1/US2/US3 but independently testable |
| US5 (COGS) | Phase 2 | Uses WAC from US1 but independently testable |
| US6 (Work Centers) | Phase 2 | None - configuration module |
| US7 (Reports) | Phase 2 | Aggregates data from all stories but independently testable |

### Within Each User Story

1. Service functions first (core logic)
2. Unit tests to verify logic
3. API routes (expose service functions)
4. UI components in parallel [P]
5. Pages (integrate components)
6. Integration testing
7. Commit

### Parallel Opportunities

**Phase 1** (all can run in parallel):
```
T001, T002, T003, T004, T005, T006, T007, T008, T009, T010, T011
```

**Phase 2** (sequential - core service build):
```
T017 → T018 → T019 → T020 → T021 → T022 → T023 → T024 → T025
```

**User Story phases** - within each story:
- Components marked [P] can run in parallel
- API routes marked [P] can run in parallel
- Different stories can run in parallel by different developers

---

## Parallel Example: User Story 2

```bash
# Launch all API routes together:
Task: "Create API route GET/POST src/app/api/cost/landed-costs/route.ts"
Task: "Create API route GET/PUT/DELETE src/app/api/cost/landed-costs/[id]/route.ts"
Task: "Create API route POST src/app/api/cost/landed-costs/[id]/allocate/route.ts"
Task: "Create API route POST src/app/api/cost/landed-costs/[id]/post/route.ts"

# Launch all UI components together:
Task: "Create LandedCostForm component in src/components/cost/LandedCostForm.tsx"
Task: "Create LandedCostAllocationGrid component in src/components/cost/LandedCostAllocationGrid.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (schema, types, validation)
2. Complete Phase 2: Foundational (core WAC service with tests)
3. Complete Phase 3: User Story 1 (WAC on receipt)
4. **STOP and VALIDATE**: Test WAC calculation independently
5. Deploy/demo if ready - inventory has accurate costing!

### Incremental Delivery

| Delivery | Stories | Value Delivered |
|----------|---------|-----------------|
| MVP | US1 | WAC tracking on receipt, cost audit trail |
| D2 | US1 + US2 | + Landed cost allocation |
| D3 | US1 + US2 + US6 | + Work center configuration |
| D4 | US1-US3 + US6 | + Production costing |
| D5 | US1-US5 + US6 | + COGS and margins |
| D6 | US1-US6 | + Full cost views |
| D7 | US1-US7 | + Dashboard and reports |

### Parallel Team Strategy

With 2-3 developers after Foundational phase:
- Developer A: US1 (MVP) → US4 (Cost Views)
- Developer B: US2 (Landed Costs) → US5 (COGS)
- Developer C: US6 (Work Centers) → US3 (Production) → US7 (Reports)

---

## Task Summary

| Phase | Tasks | Parallel Opportunities |
|-------|-------|------------------------|
| Phase 1: Setup | 16 | 11 parallel |
| Phase 2: Foundational | 9 | Sequential |
| Phase 3: US1 (P1) MVP | 11 | 2 parallel |
| Phase 4: US2 (P2) | 19 | 6 parallel |
| Phase 5: US3 (P3) | 11 | 3 parallel |
| Phase 6: US4 (P4) | 8 | None |
| Phase 7: US5 (P5) | 6 | None |
| Phase 8: US6 (P6) | 13 | 4 parallel |
| Phase 9: US7 (P7) | 16 | 7 parallel |
| Phase 10: Polish | 9 | 3 parallel |
| **TOTAL** | **118** | **36 parallel** |

---

## Notes

- [P] tasks = different files, no dependencies, can run simultaneously
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each phase or logical group
- Constitution requires unit tests for cost calculations (included in Foundational phase)
- All costs use 4 decimal precision per spec
- Follow existing patterns in template.service.ts for service structure
