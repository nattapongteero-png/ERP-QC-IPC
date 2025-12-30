# Tasks: VMI Webhook Integration

**Input**: Design documents from `/specs/012-vmi-webhook/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/webhook-api.yaml, quickstart.md

**Tests**: Tests ARE included per CLAUDE.md requirement ("Always do unit test each task to confirm task completed")

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single Next.js project: `src/` at repository root
- Tests: `tests/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and database schema

- [ ] T001 Add webhook types to existing types file in src/types/vmi.ts
- [ ] T002 [P] Add database schema for vmi_webhooks table in src/lib/db/schema.ts (MySQL + SQLite)
- [ ] T003 [P] Add database schema for vmi_webhook_deliveries table in src/lib/db/schema.ts (MySQL + SQLite)
- [ ] T004 Add webhook_enabled column to vmi_portal_config table in src/lib/db/schema.ts
- [ ] T005 Run database migration with `pnpm db:push` to sync schema

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core services that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Create Zod validation schemas for webhook payloads in src/lib/validation/vmi-webhook.ts
- [ ] T007 [P] Create signature validation utility in src/lib/services/vmi-webhook-crypto.ts
- [ ] T008 [P] Create unit test for signature validation in tests/unit/services/vmi-webhook-crypto.test.ts
- [ ] T009 Create webhook service foundation (CRUD operations) in src/lib/services/vmi-webhook.service.ts
- [ ] T010 Create unit test for webhook service in tests/unit/services/vmi-webhook.service.test.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Receive Real-Time Order Notifications (Priority: P1) 🎯 MVP

**Goal**: System receives webhook notifications when hospitals submit orders, creating order records within seconds

**Independent Test**: Register a webhook, simulate order.created event via curl, verify order record is created with correct status

### Tests for User Story 1

- [ ] T011 [P] [US1] Create integration test for webhook receiver endpoint in tests/integration/api/sales/vmi-orders/webhooks.test.ts
- [ ] T012 [P] [US1] Create unit test for order.created event processing in tests/unit/services/vmi-webhook-event.test.ts

### Implementation for User Story 1

- [ ] T013 [US1] Create webhook receiver endpoint POST /api/sales/vmi-orders/webhooks/[portalId]/route.ts
- [ ] T014 [US1] Implement order.created event handler in src/lib/services/vmi-webhook-events.ts
- [ ] T015 [US1] Implement async processing with Next.js after() in webhook receiver endpoint
- [ ] T016 [US1] Add delivery logging to vmi_webhook_deliveries table in vmi-webhook.service.ts
- [ ] T017 [US1] Add idempotency check (skip duplicate delivery IDs) in webhook receiver
- [ ] T018 [US1] Verify webhook endpoint returns 200 within 200ms via integration test

**Checkpoint**: User Story 1 complete - order.created webhooks are received and processed

---

## Phase 4: User Story 2 - Register and Manage Webhooks (Priority: P1)

**Goal**: Administrators can configure webhooks for VMI portals through the UI

**Independent Test**: Navigate to VMI portal config, add webhook with events, verify secret is displayed once and webhook is stored

### Tests for User Story 2

- [ ] T019 [P] [US2] Create UI test for webhook config form in tests/app/sales/vmi-orders/webhooks.test.tsx
- [ ] T020 [P] [US2] Create API test for webhook management endpoints in tests/integration/api/sales/vmi-orders/portals/webhooks.test.ts

### Implementation for User Story 2

- [ ] T021 [P] [US2] Create webhook list API GET /api/sales/vmi-orders/portals/[portalId]/webhooks/route.ts
- [ ] T022 [P] [US2] Create webhook create API POST /api/sales/vmi-orders/portals/[portalId]/webhooks/route.ts
- [ ] T023 [US2] Create webhook update API PATCH /api/sales/vmi-orders/portals/[portalId]/webhooks/[webhookId]/route.ts
- [ ] T024 [US2] Create webhook delete API DELETE /api/sales/vmi-orders/portals/[portalId]/webhooks/[webhookId]/route.ts
- [ ] T025 [P] [US2] Create WebhookConfigForm component in src/components/vmi/WebhookConfigForm.tsx
- [ ] T026 [P] [US2] Create WebhookHealthBadge component in src/components/vmi/WebhookHealthBadge.tsx
- [ ] T027 [US2] Create webhook management page at src/app/sales/vmi-orders/portals/[id]/webhooks/page.tsx
- [ ] T028 [US2] Implement secret encryption/decryption using existing pattern in vmi-webhook.service.ts
- [ ] T029 [US2] Add regenerate secret functionality (PATCH with regenerateSecret: true)
- [ ] T030 [US2] Enforce maximum 5 webhooks per portal limit in create endpoint

**Checkpoint**: User Story 2 complete - webhooks can be created, updated, and deleted via UI

---

## Phase 5: User Story 3 - Receive Order Cancellation Notifications (Priority: P2)

**Goal**: System receives cancellation notifications and updates order status

**Independent Test**: Create order via order.created, simulate order.cancelled event, verify order status changed to "cancelled"

### Tests for User Story 3

- [ ] T031 [P] [US3] Create unit test for order.cancelled event processing in tests/unit/services/vmi-webhook-event-cancel.test.ts

### Implementation for User Story 3

- [ ] T032 [US3] Implement order.cancelled event handler in src/lib/services/vmi-webhook-events.ts
- [ ] T033 [US3] Add shipped order cancellation handling (flag for manual review) in event handler
- [ ] T034 [US3] Update webhook receiver to route cancellation events to handler

**Checkpoint**: User Story 3 complete - order cancellations are processed, shipped orders flagged for review

---

## Phase 6: User Story 4 - Receive Receipt Notifications (Priority: P2)

**Goal**: System receives goods receipt notifications and updates order line quantities

**Independent Test**: Create shipped order, simulate receipt.created event, verify quantities updated on order lines

### Tests for User Story 4

- [ ] T035 [P] [US4] Create unit test for receipt.created event processing in tests/unit/services/vmi-webhook-event-receipt.test.ts
- [ ] T036 [P] [US4] Create unit test for receipt.completed event processing in tests/unit/services/vmi-webhook-event-receipt.test.ts

### Implementation for User Story 4

- [ ] T037 [US4] Implement receipt.created event handler in src/lib/services/vmi-webhook-events.ts
- [ ] T038 [US4] Implement receipt.completed event handler in src/lib/services/vmi-webhook-events.ts
- [ ] T039 [US4] Handle unknown order ID (log error, queue for investigation) in receipt handlers
- [ ] T040 [US4] Update webhook receiver to route receipt events to handlers

**Checkpoint**: User Story 4 complete - receipt events update order line quantities and status

---

## Phase 7: User Story 5 - Monitor Webhook Health and Delivery History (Priority: P3)

**Goal**: Administrators can view webhook delivery history and health status for troubleshooting

**Independent Test**: Navigate to webhook, view delivery history with status filters, see health badge update

### Tests for User Story 5

- [ ] T041 [P] [US5] Create UI test for delivery history grid in tests/app/sales/vmi-orders/deliveries.test.tsx
- [ ] T042 [P] [US5] Create API test for delivery history endpoint in tests/integration/api/sales/vmi-orders/portals/webhooks/deliveries.test.ts

### Implementation for User Story 5

- [ ] T043 [US5] Create delivery history API GET /api/sales/vmi-orders/portals/[portalId]/webhooks/[webhookId]/deliveries/route.ts
- [ ] T044 [US5] Add status, eventType, date range filters to delivery history API
- [ ] T045 [P] [US5] Create WebhookDeliveryGrid component with DevExtreme DataGrid in src/components/vmi/WebhookDeliveryGrid.tsx
- [ ] T046 [US5] Create delivery history page at src/app/sales/vmi-orders/portals/[id]/webhooks/[webhookId]/deliveries/page.tsx
- [ ] T047 [US5] Implement consecutive failure tracking and auto-disable after 10 failures
- [ ] T048 [US5] Add re-enable functionality for auto-disabled webhooks (PATCH with reenableWebhook: true)

**Checkpoint**: User Story 5 complete - delivery history visible with filters, health status reflects failures

---

## Phase 8: User Story 6 - Fallback to Polling (Priority: P3)

**Goal**: Polling continues as safety net, duplicate orders are detected and skipped

**Independent Test**: Disable webhooks, wait for poll interval, verify orders retrieved via polling; enable webhooks, verify duplicate detection works

### Tests for User Story 6

- [ ] T049 [P] [US6] Create unit test for duplicate order detection in tests/unit/services/vmi-order-dedup.test.ts

### Implementation for User Story 6

- [ ] T050 [US6] Add duplicate detection using vmi_order_id in existing polling service in src/lib/services/vmi-portal.service.ts
- [ ] T051 [US6] Log when order received via both webhook and polling for monitoring
- [ ] T052 [US6] Verify polling continues regardless of webhook status (no code changes if already working)

**Checkpoint**: User Story 6 complete - polling and webhooks coexist, duplicates prevented

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T053 [P] Add Thai/English error messages for webhook errors in UI components
- [ ] T054 [P] Add loading states for webhook registration and management actions
- [ ] T055 Add navigation link to webhooks from VMI portal detail page in src/app/sales/vmi-orders/portals/[id]/page.tsx
- [ ] T056 Run all tests to verify no regressions with `pnpm test`
- [ ] T057 Run linting to verify code quality with `pnpm lint`
- [ ] T058 Validate quickstart.md curl example works against implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User Story 1 (P1) and User Story 2 (P1) can proceed in parallel after foundation
  - User Story 3-6 can start after foundation (lower priority)
- **Polish (Final Phase)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - Core webhook receiving
- **User Story 2 (P1)**: Can start after Foundational - Webhook management UI (parallel with US1)
- **User Story 3 (P2)**: Depends on US1 receiver being complete
- **User Story 4 (P2)**: Depends on US1 receiver being complete
- **User Story 5 (P3)**: Depends on US2 management UI being complete
- **User Story 6 (P3)**: Can start after Foundational - Modifies existing polling

### Within Each User Story

- Tests SHOULD be written and FAIL before implementation
- Validation/crypto utilities before service layer
- Service layer before API endpoints
- API endpoints before UI components
- Story complete before moving to next priority

### Parallel Opportunities

- T002, T003 (schema tables) can run in parallel
- T007, T008 (crypto + test) can run in parallel
- T011, T012 (US1 tests) can run in parallel
- T019, T020 (US2 tests) can run in parallel
- T021, T022, T025, T026 (US2 implementation) can run in parallel
- T035, T036 (US4 tests) can run in parallel
- T041, T042 (US5 tests) can run in parallel
- T053, T054 (polish) can run in parallel

---

## Parallel Example: User Story 2

```bash
# Launch all parallelizable tasks for User Story 2 together:
Task: "Create webhook list API GET /api/sales/vmi-orders/portals/[portalId]/webhooks/route.ts"
Task: "Create webhook create API POST /api/sales/vmi-orders/portals/[portalId]/webhooks/route.ts"
Task: "Create WebhookConfigForm component in src/components/vmi/WebhookConfigForm.tsx"
Task: "Create WebhookHealthBadge component in src/components/vmi/WebhookHealthBadge.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (schema + types)
2. Complete Phase 2: Foundational (crypto + base service)
3. Complete Phase 3: User Story 1 (receive order.created webhooks)
4. Complete Phase 4: User Story 2 (manage webhooks via UI)
5. **STOP and VALIDATE**: Test order notifications end-to-end
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 + 2 → Test → Deploy (MVP with order notifications)
3. Add User Story 3 + 4 → Test → Deploy (cancellation + receipt events)
4. Add User Story 5 + 6 → Test → Deploy (monitoring + fallback)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (webhook receiver)
   - Developer B: User Story 2 (webhook management UI)
3. After US1/US2 complete:
   - Developer A: User Story 3 + 4 (additional event handlers)
   - Developer B: User Story 5 + 6 (monitoring + fallback)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task per CLAUDE.md requirement
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
