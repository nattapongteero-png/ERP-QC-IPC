# Tasks: VMI Vendor Sync (Correction)

**Input**: Design documents from `/specs/008-vmi-vendor-sync/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included per CLAUDE.md requirement for unit tests on each task.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## User Story Summary

| Story | Priority | Title | Key Deliverable |
|-------|----------|-------|-----------------|
| US1 | P1 | Configure VMI Portal API Credentials | Portal settings in settings module |
| US2 | P1 | Sync Our Inventory to VMI Portal | Outbound inventory sync |
| US3 | P2 | Sync Our Item Catalog to VMI Portal | Outbound item catalog sync |
| US4 | P2 | Sync Our Prices to VMI Portal | Outbound price sync |
| US5 | P1 | Receive Orders from VMI Portal | Inbound orders to sales |
| US6 | P3 | VMI Integration Dashboard | Monitoring dashboard |

---

## Phase 1: Setup

**Purpose**: Extend existing infrastructure for VMI vendor sync

- [ ] T001 Add VMI vendor-side TypeScript types in src/types/vmi.ts (VmiPortalConfig, VmiSyncResult, VmiSalesOrder, VmiOrderLine interfaces)
- [ ] T002 [P] Add new VMI permission scopes in src/lib/auth/index.ts (vmi-settings:read/write, vmi-sync:execute, vmi-orders:read/write)
- [ ] T003 [P] Create Zod validation schemas for VMI portal config in src/lib/validations/vmi-portal.ts

---

## Phase 2: Foundational (Database Schema)

**Purpose**: Create database tables required by ALL user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Add vmi_portal_config table schema in src/lib/db/schema.ts (SQLite + MySQL dual schema per data-model.md)
- [ ] T005 [P] Add vmi_sync_history table schema in src/lib/db/schema.ts (SQLite + MySQL dual schema)
- [ ] T006 [P] Add vmi_sales_orders table schema in src/lib/db/schema.ts (SQLite + MySQL dual schema)
- [ ] T007 [P] Add vmi_sales_order_lines table schema in src/lib/db/schema.ts (SQLite + MySQL dual schema)
- [ ] T008 Extend items table with vmi_sync_enabled and last_vmi_sync_at columns in src/lib/db/schema.ts
- [ ] T009 [P] Extend customers table with vmi_customer_id and vmi_portal_id columns in src/lib/db/schema.ts
- [ ] T010 [P] Extend sales_orders table with vmi_sales_order_id and source columns in src/lib/db/schema.ts
- [ ] T011 Generate and apply database migrations (npm run db:generate && npm run db:push)
- [ ] T012 Verify schema in Drizzle Studio (npm run db:studio)

**Checkpoint**: All VMI tables exist, ready for user story implementation

---

## Phase 3: User Story 1 - Configure VMI Portal API Credentials (Priority: P1) 🎯 MVP

**Goal**: System administrators can configure VMI Portal API credentials in the settings module

**Independent Test**: Add portal credentials via UI/API and verify connection test returns success

### Tests for User Story 1

- [ ] T013 [P] [US1] Unit test for portal config CRUD operations in tests/services/vmi-portal-config.service.test.ts
- [ ] T014 [P] [US1] API test for settings VMI endpoints in tests/api/vmi-settings.test.ts

### Implementation for User Story 1

- [ ] T015 [US1] Create VmiPortalConfigService in src/lib/services/vmi-portal-config.service.ts (CRUD, encryption, connection test)
- [ ] T016 [US1] Implement GET /api/settings/vmi route in src/app/api/settings/vmi/route.ts (list all portal configs)
- [ ] T017 [US1] Implement POST /api/settings/vmi route in src/app/api/settings/vmi/route.ts (create new portal config)
- [ ] T018 [US1] Implement GET /api/settings/vmi/[portalId] route in src/app/api/settings/vmi/[portalId]/route.ts
- [ ] T019 [US1] Implement PUT /api/settings/vmi/[portalId] route in src/app/api/settings/vmi/[portalId]/route.ts
- [ ] T020 [US1] Implement DELETE /api/settings/vmi/[portalId] route in src/app/api/settings/vmi/[portalId]/route.ts
- [ ] T021 [US1] Implement POST /api/settings/vmi/[portalId]/test route in src/app/api/settings/vmi/[portalId]/test/route.ts (connection test)
- [ ] T022 [P] [US1] Create VmiPortalConfigForm component in src/components/vmi/VmiPortalConfigForm.tsx (DevExtreme form)
- [ ] T023 [P] [US1] Create VmiPortalList component in src/components/vmi/VmiPortalList.tsx (DevExtreme DataGrid)
- [ ] T024 [US1] Create VMI settings page in src/app/(dashboard)/settings/vmi/page.tsx
- [ ] T025 [US1] Add audit logging for portal config changes in VmiPortalConfigService
- [ ] T026 [US1] Run tests and verify US1 independently (npm test -- vmi-settings)

**Checkpoint**: Portal configuration fully functional - can add, edit, delete, and test connections

---

## Phase 4: User Story 2 - Sync Our Inventory to VMI Portal (Priority: P1)

**Goal**: Warehouse managers can sync inventory levels to VMI portals

**Independent Test**: Trigger manual inventory sync and verify quantities appear in VMI Portal

### Tests for User Story 2

- [ ] T027 [P] [US2] Unit test for inventory sync in tests/services/vmi-sync.service.test.ts (batch handling, transform logic)
- [ ] T028 [P] [US2] API test for inventory sync endpoint in tests/api/vmi-sync.test.ts

### Implementation for User Story 2

- [ ] T029 [US2] Create VmiSyncService core class in src/lib/services/vmi-sync.service.ts (base sync methods, batch handling, error handling)
- [ ] T030 [US2] Implement syncInventory method in VmiSyncService (fetch items with vmi_sync_enabled, batch to portal API)
- [ ] T031 [US2] Implement POST /api/vmi-sync/inventory route in src/app/api/vmi-sync/inventory/route.ts (manual trigger)
- [ ] T032 [US2] Implement GET /api/vmi-sync/status route in src/app/api/vmi-sync/status/route.ts (sync history listing)
- [ ] T033 [US2] Implement GET /api/vmi-sync/status/[syncId] route in src/app/api/vmi-sync/status/[syncId]/route.ts
- [ ] T034 [US2] Implement POST /api/vmi-sync/scheduled/inventory route in src/app/api/vmi-sync/scheduled/inventory/route.ts (cron trigger)
- [ ] T035 [P] [US2] Create VmiSyncStatusCard component in src/components/vmi/VmiSyncStatusCard.tsx
- [ ] T036 [P] [US2] Create VmiSyncTrigger component in src/components/vmi/VmiSyncTrigger.tsx (manual sync buttons)
- [ ] T037 [US2] Create VMI sync page in src/app/(dashboard)/vmi/sync/page.tsx
- [ ] T038 [US2] Add sync history logging to vmi_sync_history table
- [ ] T039 [US2] Run tests and verify US2 independently (npm test -- vmi-sync)

**Checkpoint**: Inventory sync works - manual trigger syncs to all enabled portals

---

## Phase 5: User Story 3 - Sync Our Item Catalog to VMI Portal (Priority: P2)

**Goal**: Product managers can sync product catalog with TPP/TTMT codes to VMI portals

**Independent Test**: Trigger item catalog sync and verify items with codes appear in VMI Portal

### Tests for User Story 3

- [ ] T040 [P] [US3] Unit test for item catalog sync in tests/services/vmi-sync.service.test.ts (add tests for syncItems method)

### Implementation for User Story 3

- [ ] T041 [US3] Implement syncItems method in VmiSyncService in src/lib/services/vmi-sync.service.ts
- [ ] T042 [US3] Implement POST /api/vmi-sync/items route in src/app/api/vmi-sync/items/route.ts
- [ ] T043 [US3] Implement POST /api/vmi-sync/scheduled/items route in src/app/api/vmi-sync/scheduled/items/route.ts
- [ ] T044 [US3] Add item sync button to VmiSyncTrigger component in src/components/vmi/VmiSyncTrigger.tsx
- [ ] T045 [US3] Validate items have TPP or TTMT code before sync (skip and report missing)
- [ ] T046 [US3] Run tests and verify US3 independently (npm test -- vmi-sync)

**Checkpoint**: Item catalog sync works - items with standard codes sync to portals

---

## Phase 6: User Story 4 - Sync Our Prices to VMI Portal (Priority: P2)

**Goal**: Sales managers can sync product prices to VMI portals

**Independent Test**: Trigger price sync and verify prices appear correctly in VMI Portal

### Tests for User Story 4

- [ ] T047 [P] [US4] Unit test for price sync in tests/services/vmi-sync.service.test.ts (add tests for syncPrices method)

### Implementation for User Story 4

- [ ] T048 [US4] Implement syncPrices method in VmiSyncService in src/lib/services/vmi-sync.service.ts
- [ ] T049 [US4] Implement POST /api/vmi-sync/prices route in src/app/api/vmi-sync/prices/route.ts
- [ ] T050 [US4] Implement POST /api/vmi-sync/scheduled/prices route in src/app/api/vmi-sync/scheduled/prices/route.ts
- [ ] T051 [US4] Add price sync button to VmiSyncTrigger component in src/components/vmi/VmiSyncTrigger.tsx
- [ ] T052 [US4] Run tests and verify US4 independently (npm test -- vmi-sync)

**Checkpoint**: Price sync works - sales prices sync to enabled portals

---

## Phase 7: User Story 5 - Receive Orders from VMI Portal into Sales System (Priority: P1)

**Goal**: Sales representatives receive orders from VMI Portal into sales system for fulfillment

**Independent Test**: Poll orders from VMI Portal and verify they appear as sales orders

### Tests for User Story 5

- [ ] T053 [P] [US5] Unit test for order polling in tests/services/vmi-sales-order.service.test.ts (order mapping, customer lookup)
- [ ] T054 [P] [US5] API test for VMI orders endpoints in tests/api/vmi-sales-orders.test.ts

### Implementation for User Story 5

- [ ] T055 [US5] Create VmiSalesOrderService in src/lib/services/vmi-sales-order.service.ts (poll, map to sales, customer matching)
- [ ] T056 [US5] Implement customer matching/creation logic in VmiSalesOrderService (match by vmi_customer_id, create if not exists)
- [ ] T057 [US5] Implement item matching logic in VmiSalesOrderService (match by tpp_code or ttmt_code)
- [ ] T058 [US5] Implement GET /api/sales/vmi-orders route in src/app/api/sales/vmi-orders/route.ts (list VMI orders)
- [ ] T059 [US5] Implement POST /api/sales/vmi-orders route in src/app/api/sales/vmi-orders/route.ts (poll for new orders)
- [ ] T060 [US5] Implement GET /api/sales/vmi-orders/[orderId] route in src/app/api/sales/vmi-orders/[orderId]/route.ts
- [ ] T061 [US5] Implement PUT /api/sales/vmi-orders/[orderId] route in src/app/api/sales/vmi-orders/[orderId]/route.ts
- [ ] T062 [US5] Implement POST /api/sales/vmi-orders/[orderId]/confirm route in src/app/api/sales/vmi-orders/[orderId]/confirm/route.ts
- [ ] T063 [US5] Implement POST /api/sales/vmi-orders/[orderId]/ship route in src/app/api/sales/vmi-orders/[orderId]/ship/route.ts
- [ ] T064 [US5] Implement POST /api/sales/vmi-orders/[orderId]/lines/[lineId]/match route for manual item matching
- [ ] T065 [US5] Implement POST /api/sales/vmi-orders/poll route in src/app/api/sales/vmi-orders/poll/route.ts (scheduled polling)
- [ ] T066 [P] [US5] Create VmiOrdersGrid component in src/components/vmi/VmiOrdersGrid.tsx (DevExtreme DataGrid)
- [ ] T067 [P] [US5] Create VmiOrderDetail component in src/components/vmi/VmiOrderDetail.tsx (order actions)
- [ ] T068 [US5] Create VMI orders page in src/app/(dashboard)/vmi/orders/page.tsx
- [ ] T069 [US5] Implement order confirmation flow (create sales order, update VMI Portal)
- [ ] T070 [US5] Implement ship order flow (update sales order, update VMI Portal with shipment details)
- [ ] T071 [US5] Run tests and verify US5 independently (npm test -- vmi-sales-order)

**Checkpoint**: Order reception works - orders polled, mapped, confirmed, and shipped

---

## Phase 8: User Story 6 - VMI Integration Dashboard (Priority: P3)

**Goal**: System administrators monitor VMI integration health and sync status

**Independent Test**: View dashboard showing connection status, sync times, and pending orders

### Tests for User Story 6

- [ ] T072 [P] [US6] Component test for dashboard in tests/components/vmi-dashboard.test.tsx

### Implementation for User Story 6

- [ ] T073 [US6] Create VmiDashboardStats component in src/components/vmi/VmiDashboardStats.tsx (connection status, sync summary)
- [ ] T074 [US6] Create VmiTransactionLog component in src/components/vmi/VmiTransactionLog.tsx (recent API calls)
- [ ] T075 [US6] Create VmiAlerts component in src/components/vmi/VmiAlerts.tsx (error notifications)
- [ ] T076 [US6] Create VMI dashboard page in src/app/(dashboard)/vmi/page.tsx
- [ ] T077 [US6] Add GET /api/vmi-sync/dashboard route for aggregated stats in src/app/api/vmi-sync/dashboard/route.ts
- [ ] T078 [US6] Run tests and verify US6 independently (npm test -- vmi-dashboard)

**Checkpoint**: Dashboard shows integration health, sync history, and pending orders

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements affecting multiple user stories

- [ ] T079 [P] Add navigation links to VMI settings and VMI dashboard in main sidebar
- [ ] T080 [P] Add cron job documentation for scheduled sync endpoints in quickstart.md
- [ ] T081 Run full test suite (npm test) and fix any failures
- [ ] T082 Run type check (npm run tsc --noEmit) and fix any errors
- [ ] T083 Run linter (npm run lint) and fix any warnings/errors
- [ ] T084 Verify quickstart.md scenarios work end-to-end
- [ ] T085 Commit all changes with descriptive message

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)           → No dependencies
    ↓
Phase 2 (Foundational)    → Depends on Phase 1 - BLOCKS all user stories
    ↓
┌───┬───┬───┬───┬───┐
│US1│US2│US3│US4│US5│    → All can start after Phase 2
└─┬─┴─┬─┴─┬─┴─┬─┴─┬─┘
  │   │   │   │   │
  │   └───┴───┘   │      → US2/3/4 share VmiSyncService (US2 creates base)
  │       │       │
  └───────┼───────┘
          ↓
        US6              → Dashboard uses data from all previous stories
          ↓
      Phase 9            → Polish after all stories complete
```

### User Story Dependencies

| Story | Depends On | Can Start After |
|-------|------------|-----------------|
| US1 | Foundational (Phase 2) | T012 complete |
| US2 | US1 (needs portal config) | T026 complete |
| US3 | US2 (extends VmiSyncService) | T039 complete |
| US4 | US2 (extends VmiSyncService) | T039 complete |
| US5 | Foundational (Phase 2) | T012 complete |
| US6 | US1, US2, US5 (needs data to display) | T026, T039, T071 complete |

### Within Each User Story

1. Tests MUST be written and FAIL before implementation
2. Service layer before API routes
3. API routes before UI components
4. Core implementation before integration
5. Run tests to verify story independently

### Parallel Opportunities

**Phase 2 (Foundational)**:
```
T004 (vmi_portal_config) → sequential (first table)
T005, T006, T007 → parallel (independent tables)
T008, T009, T010 → parallel (table extensions)
T011, T012 → sequential (migration, verification)
```

**User Story 1 (After Phase 2)**:
```
T013, T014 → parallel (tests)
T022, T023 → parallel (UI components)
```

**User Story 2 (After US1)**:
```
T027, T028 → parallel (tests)
T035, T036 → parallel (UI components)
```

**User Story 5 (After Phase 2, parallel to US2)**:
```
T053, T054 → parallel (tests)
T066, T067 → parallel (UI components)
```

---

## Parallel Example: User Story 1

```bash
# Launch all tests for US1 together:
Task: "[US1] Unit test for portal config CRUD in tests/services/vmi-portal-config.service.test.ts"
Task: "[US1] API test for settings VMI endpoints in tests/api/vmi-settings.test.ts"

# Launch all UI components for US1 together:
Task: "[US1] Create VmiPortalConfigForm component in src/components/vmi/VmiPortalConfigForm.tsx"
Task: "[US1] Create VmiPortalList component in src/components/vmi/VmiPortalList.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Portal Configuration)
4. **STOP and VALIDATE**: Configure a portal, test connection
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Portal configuration works → Deploy/Demo (MVP!)
3. Add US2 → Inventory sync works → Deploy/Demo
4. Add US5 → Order reception works → Deploy/Demo (Core complete!)
5. Add US3 + US4 → Full sync capability → Deploy/Demo
6. Add US6 → Dashboard for monitoring → Deploy/Demo (Feature complete!)

### Suggested Priority Order

Given the P1 stories are most critical:
1. **US1** - Foundation for all VMI communication
2. **US5** - Core business value (receiving orders)
3. **US2** - Core business value (inventory visibility)
4. **US3** - Supporting (item catalog)
5. **US4** - Supporting (pricing)
6. **US6** - Nice-to-have (monitoring)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- All API routes use existing withAuth middleware pattern
- All UI components use DevExtreme per constitution
- Encrypt API keys using existing crypto/encrypt.ts
- Log all operations using existing audit.ts pattern
