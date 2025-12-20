# Tasks: VMI Portal Vendor Integration

**Input**: Design documents from `/specs/006-vmi-vendor-integration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Unit tests included as per CLAUDE.md requirement ("Always do unit test each task to confirm task completed")

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Add VMI environment variables to .env.example (VMI_PORTAL_BASE_URL, VMI_ENCRYPTION_KEY, CRON_SECRET)
- [x] T002 [P] Create VMI types definition in src/types/vmi.ts
- [x] T003 [P] Create encryption utility in src/lib/crypto/encrypt.ts with AES-256-GCM

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Extend items table schema with tpp_code and ttmt_code fields in src/lib/db/schema.ts
- [x] T005 [P] Create vmi_vendor_config table schema in src/lib/db/schema.ts
- [x] T006 [P] Create vmi_price_offers table schema in src/lib/db/schema.ts
- [x] T007 [P] Create vmi_orders table schema in src/lib/db/schema.ts
- [x] T008 [P] Create vmi_order_lines table schema in src/lib/db/schema.ts
- [x] T009 Extend vmi_transactions table with request_payload, response_payload, http_status, duration_ms in src/lib/db/schema.ts
- [ ] T010 Run database migration to apply schema changes (pnpm db:generate && pnpm db:migrate)
- [x] T011 Create VmiPortalError class in src/lib/services/vmi-portal.service.ts
- [x] T012 Implement VmiPortalService base class with request method in src/lib/services/vmi-portal.service.ts
- [x] T013 [P] Create unit test for encryption utility in tests/unit/crypto/encrypt.test.ts
- [x] T014 Verify type check passes (pnpm tsc --noEmit)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Configure VMI Portal API Credentials (Priority: P1)

**Goal**: Enable system administrators to configure and validate VMI Portal API credentials per vendor

**Independent Test**: Configure API credentials for a vendor and verify connection status via test API call

### Tests for User Story 1

- [ ] T015 [P] [US1] Create unit test for VmiPortalService.testConnection in tests/unit/services/vmi-portal.service.test.ts
- [ ] T016 [P] [US1] Create integration test for VMI config API in tests/integration/api/vmi/config.test.ts

### Implementation for User Story 1

- [ ] T017 [US1] Implement VmiPortalService.testConnection method in src/lib/services/vmi-portal.service.ts
- [ ] T018 [P] [US1] Create GET /api/vendors/[id]/vmi-config/route.ts to retrieve vendor VMI configuration
- [ ] T019 [P] [US1] Create PUT /api/vendors/[id]/vmi-config/route.ts to update vendor VMI configuration
- [ ] T020 [US1] Create POST /api/vendors/[id]/vmi-config/test/route.ts to test VMI Portal connection
- [ ] T021 [US1] Create VmiCredentialsForm component in src/components/vmi/VmiCredentialsForm.tsx
- [ ] T022 [US1] Add VMI configuration section to vendor detail page in src/app/purchasing/vendors/[id]/page.tsx
- [ ] T023 [US1] Implement transaction logging for config test operations

**Checkpoint**: User Story 1 complete - administrators can configure and test VMI credentials

---

## Phase 4: User Story 5 - Receive and Manage Orders from Hospitals (Priority: P1)

**Goal**: Enable purchasing managers to receive and manage orders from hospitals via VMI Portal

**Independent Test**: Poll for orders from VMI Portal and verify they appear as pending orders locally

### Tests for User Story 5

- [ ] T024 [P] [US5] Create unit test for VmiPortalService order methods in tests/unit/services/vmi-portal.service.test.ts (append)
- [ ] T025 [P] [US5] Create integration test for VMI orders API in tests/integration/api/vmi/orders.test.ts

### Implementation for User Story 5

- [ ] T026 [US5] Implement VmiPortalService.getOrders method in src/lib/services/vmi-portal.service.ts
- [ ] T027 [US5] Implement VmiPortalService.getOrderDetail method in src/lib/services/vmi-portal.service.ts
- [ ] T028 [US5] Implement VmiPortalService.confirmOrder method in src/lib/services/vmi-portal.service.ts
- [ ] T029 [US5] Implement VmiPortalService.shipOrder method in src/lib/services/vmi-portal.service.ts
- [ ] T030 [US5] Implement VmiPortalService.getReceiptStatus method in src/lib/services/vmi-portal.service.ts
- [ ] T031 [US5] Create GET /api/purchasing/vmi/orders/route.ts for listing VMI orders
- [ ] T032 [US5] Create POST /api/purchasing/vmi/orders/route.ts for polling new orders
- [ ] T033 [US5] Create GET /api/purchasing/vmi/orders/[id]/route.ts for order detail
- [ ] T034 [US5] Create PATCH /api/purchasing/vmi/orders/[id]/route.ts for confirm/ship actions
- [ ] T035 [US5] Create GET /api/purchasing/vmi/orders/[id]/receipt-status/route.ts
- [ ] T036 [US5] Implement local PO creation on order confirm (link vmi_order to purchase_order)
- [ ] T037 [P] [US5] Create VmiOrdersGrid component in src/components/vmi/VmiOrdersGrid.tsx
- [ ] T038 [P] [US5] Create VmiOrderDetail component in src/components/vmi/VmiOrderDetail.tsx
- [ ] T039 [US5] Create VMI orders page in src/app/purchasing/vmi/orders/page.tsx
- [ ] T040 [US5] Create cron endpoint POST /api/purchasing/vmi/cron/poll-orders/route.ts

**Checkpoint**: User Story 5 complete - orders can be received, confirmed, and shipped

---

## Phase 5: User Story 2 - Sync Item Master to VMI Portal (Priority: P2)

**Goal**: Enable purchasing managers to sync item master data to VMI Portal

**Independent Test**: Select items and trigger sync, verify items appear in VMI Portal via API

### Tests for User Story 2

- [ ] T041 [P] [US2] Create unit test for VmiPortalService.syncItems in tests/unit/services/vmi-portal.service.test.ts (append)
- [ ] T042 [P] [US2] Create integration test for VMI sync items API in tests/integration/api/vmi/sync.test.ts

### Implementation for User Story 2

- [ ] T043 [US2] Implement VmiPortalService.syncItems method in src/lib/services/vmi-portal.service.ts
- [ ] T044 [US2] Create GET /api/purchasing/vmi/sync/items/route.ts for pending items list
- [ ] T045 [US2] Create POST /api/purchasing/vmi/sync/items/route.ts for syncing items
- [ ] T046 [US2] Add TPP/TTMT code fields to item edit form
- [ ] T047 [US2] Create VmiSyncStatus component in src/components/vmi/VmiSyncStatus.tsx
- [ ] T048 [US2] Add sync status indicator to item list for VMI vendors

**Checkpoint**: User Story 2 complete - items can be synced to VMI Portal

---

## Phase 6: User Story 3 - Sync Price Offers to VMI Portal (Priority: P2)

**Goal**: Enable purchasing managers to sync pricing information to VMI Portal

**Independent Test**: Create price offers and sync, verify prices are returned when queried

### Tests for User Story 3

- [ ] T049 [P] [US3] Create unit test for VmiPortalService.syncPrices in tests/unit/services/vmi-portal.service.test.ts (append)
- [ ] T050 [P] [US3] Create integration test for VMI sync prices API in tests/integration/api/vmi/sync.test.ts (append)

### Implementation for User Story 3

- [ ] T051 [US3] Implement VmiPortalService.syncPrices method in src/lib/services/vmi-portal.service.ts
- [ ] T052 [US3] Create GET /api/purchasing/vmi/sync/prices/route.ts for price offers list
- [ ] T053 [US3] Create POST /api/purchasing/vmi/sync/prices/route.ts for syncing prices
- [ ] T054 [US3] Create price offer management UI in VMI sync page
- [ ] T055 [US3] Implement price offer CRUD operations

**Checkpoint**: User Story 3 complete - price offers can be synced to VMI Portal

---

## Phase 7: User Story 4 - Sync Inventory Availability to VMI Portal (Priority: P2)

**Goal**: Enable warehouse managers to share inventory levels with VMI Portal

**Independent Test**: Sync inventory quantities and verify via VMI Portal API

### Tests for User Story 4

- [ ] T056 [P] [US4] Create unit test for VmiPortalService.syncInventory in tests/unit/services/vmi-portal.service.test.ts (append)
- [ ] T057 [P] [US4] Create integration test for VMI sync inventory API in tests/integration/api/vmi/sync.test.ts (append)

### Implementation for User Story 4

- [ ] T058 [US4] Implement VmiPortalService.syncInventory method in src/lib/services/vmi-portal.service.ts
- [ ] T059 [US4] Create POST /api/purchasing/vmi/sync/inventory/route.ts for syncing inventory
- [ ] T060 [US4] Create cron endpoint POST /api/purchasing/vmi/cron/sync-inventory/route.ts
- [ ] T061 [US4] Add inventory sync section to VMI sync page
- [ ] T062 [US4] Create GET /api/purchasing/vmi/sync/status/route.ts for overall sync status

**Checkpoint**: User Story 4 complete - inventory can be synced automatically

---

## Phase 8: User Story 6 - VMI Dashboard and Monitoring (Priority: P3)

**Goal**: Provide operational visibility into VMI integration health and transaction history

**Independent Test**: View dashboard showing sync status, recent transactions, and error alerts

### Tests for User Story 6

- [ ] T063 [P] [US6] Create integration test for VMI dashboard API in tests/integration/api/vmi/dashboard.test.ts
- [ ] T064 [P] [US6] Create integration test for VMI transactions API in tests/integration/api/vmi/transactions.test.ts

### Implementation for User Story 6

- [ ] T065 [US6] Create GET /api/purchasing/vmi/dashboard/route.ts for dashboard stats
- [ ] T066 [US6] Create GET /api/purchasing/vmi/transactions/route.ts for transaction log
- [ ] T067 [US6] Create VmiDashboard component in src/components/vmi/VmiDashboard.tsx
- [ ] T068 [US6] Create VmiTransactionLog component in src/components/vmi/VmiTransactionLog.tsx
- [ ] T069 [US6] Create VMI dashboard page in src/app/purchasing/vmi/page.tsx
- [ ] T070 [US6] Create VMI sync management page in src/app/purchasing/vmi/sync/page.tsx
- [ ] T071 [US6] Add VMI menu items to purchasing navigation

**Checkpoint**: User Story 6 complete - full monitoring and dashboard available

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T072 [P] Implement error notification system for VMI failures
- [ ] T073 [P] Add transaction log cleanup scheduled task (90-day retention)
- [ ] T074 [P] Add loading states and skeleton loaders to VMI components
- [ ] T075 Run full test suite (pnpm test:run)
- [ ] T076 Run lint check (pnpm lint)
- [ ] T077 Run type check (pnpm tsc --noEmit)
- [ ] T078 Build verification (pnpm build)
- [ ] T079 Validate against quickstart.md scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - US1 and US5 are P1 priority - implement first
  - US2, US3, US4 are P2 priority - implement after P1
  - US6 is P3 priority - implement last
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

| Story | Priority | Depends On | Can Start After |
|-------|----------|------------|-----------------|
| US1 (Credentials) | P1 | Foundational | Phase 2 complete |
| US5 (Orders) | P1 | US1 (needs credentials) | T023 complete |
| US2 (Items Sync) | P2 | US1 (needs credentials) | T023 complete |
| US3 (Prices Sync) | P2 | US2 (items must exist) | T048 complete |
| US4 (Inventory Sync) | P2 | US2 (items must exist) | T048 complete |
| US6 (Dashboard) | P3 | All sync stories | T062 complete |

### Within Each User Story

- Tests written first, verify they compile
- Service methods before API routes
- API routes before UI components
- UI components before page integration
- Commit after each task or logical group

### Parallel Opportunities

**Phase 1 (Setup)**:
```bash
# Launch in parallel:
Task: "T002 Create VMI types definition in src/types/vmi.ts"
Task: "T003 Create encryption utility in src/lib/crypto/encrypt.ts"
```

**Phase 2 (Foundational)**:
```bash
# After T004, launch in parallel:
Task: "T005 Create vmi_vendor_config table schema"
Task: "T006 Create vmi_price_offers table schema"
Task: "T007 Create vmi_orders table schema"
Task: "T008 Create vmi_order_lines table schema"
```

**Phase 3 (US1 - Credentials)**:
```bash
# Tests in parallel:
Task: "T015 Unit test for VmiPortalService.testConnection"
Task: "T016 Integration test for VMI config API"

# API routes in parallel:
Task: "T018 GET /api/vendors/[id]/vmi-config/route.ts"
Task: "T019 PUT /api/vendors/[id]/vmi-config/route.ts"
```

**Phase 4 (US5 - Orders)**:
```bash
# Tests in parallel:
Task: "T024 Unit test for order methods"
Task: "T025 Integration test for orders API"

# Components in parallel:
Task: "T037 VmiOrdersGrid component"
Task: "T038 VmiOrderDetail component"
```

---

## Implementation Strategy

### MVP First (P1 Stories Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Credentials)
4. Complete Phase 4: User Story 5 (Orders)
5. **STOP and VALIDATE**: Test P1 stories independently
6. Deploy/demo if ready - vendors can configure credentials and receive orders

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Credentials) → Test → Deploy (Can connect to VMI Portal)
3. Add US5 (Orders) → Test → Deploy (Can receive and manage orders)
4. Add US2 (Items Sync) → Test → Deploy (Can sync product catalog)
5. Add US3 (Prices Sync) → Test → Deploy (Can sync pricing)
6. Add US4 (Inventory Sync) → Test → Deploy (Full sync capability)
7. Add US6 (Dashboard) → Test → Deploy (Full monitoring)

### Quality Gates (Per Phase)

After each user story phase:
- [ ] Unit tests pass: `pnpm test:run tests/unit/`
- [ ] Integration tests pass: `pnpm test:run tests/integration/`
- [ ] Type check: `pnpm tsc --noEmit`
- [ ] Lint: `pnpm lint`
- [ ] Manual verification of story acceptance criteria

---

## Task Summary

| Phase | Tasks | Parallel Tasks |
|-------|-------|----------------|
| Phase 1: Setup | 3 | 2 |
| Phase 2: Foundational | 11 | 5 |
| Phase 3: US1 Credentials | 9 | 4 |
| Phase 4: US5 Orders | 17 | 4 |
| Phase 5: US2 Items | 8 | 2 |
| Phase 6: US3 Prices | 7 | 2 |
| Phase 7: US4 Inventory | 7 | 2 |
| Phase 8: US6 Dashboard | 9 | 2 |
| Phase 9: Polish | 8 | 3 |
| **Total** | **79** | **26** |

### Per Story Breakdown

| Story | Description | Tasks | Priority |
|-------|-------------|-------|----------|
| US1 | Configure VMI Credentials | 9 | P1 |
| US2 | Sync Items | 8 | P2 |
| US3 | Sync Prices | 7 | P2 |
| US4 | Sync Inventory | 7 | P2 |
| US5 | Manage Orders | 17 | P1 |
| US6 | Dashboard & Monitoring | 9 | P3 |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- TPP/TTMT codes: Items need EITHER one (not both) based on product type
