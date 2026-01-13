# Tasks: Workflow Test Page

**Input**: Design documents from `/specs/013-workflow-test/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/workflow-test-api.yaml, quickstart.md

**Tests**: Tests are included as requested in CLAUDE.md (`Always do UI test using React Testing Library + Vitest`).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, types, and validation schemas

- [x] T001 Create type definitions for workflow test entities in src/types/workflow-test.ts
- [x] T002 [P] Create Zod validation schemas in src/lib/validation/workflow-test.ts
- [x] T003 [P] Add navigation menu item for Workflow Test in src/components/layout/sidebar.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core service infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create phase definitions constant in src/lib/services/workflow-test/workflow-steps.ts
- [x] T005 Create step definitions with 31 steps across 8 phases in src/lib/services/workflow-test/workflow-steps.ts
- [x] T006 [P] Create test data cleanup service in src/lib/services/workflow-test/test-data-cleanup.ts
- [x] T007 [P] Create workflow test service with SSE streaming in src/lib/services/workflow-test/workflow-test.service.ts
- [x] T008 Create useWorkflowTest hook for SSE connection management in src/hooks/useWorkflowTest.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Visual Workflow Pathway with Real-Time Status (Priority: P1) 🎯 MVP

**Goal**: Display a graphic pathway diagram showing all 31 test steps as connected nodes with real-time visual updates

**Independent Test**: Load page, observe 31 steps in 8 phases, run test, watch nodes animate/change color in real-time

### Tests for User Story 1

- [x] T009 [P] [US1] Create UI test for WorkflowPathway rendering all 8 phases in tests/app/settings/workflow-test/page.test.tsx
- [x] T010 [P] [US1] Create UI test for step status updates (pending/running/passed/failed) in tests/app/settings/workflow-test/page.test.tsx

### Implementation for User Story 1

- [x] T011 [P] [US1] Create WorkflowStepNode component with status colors and icons in src/components/workflow-test/WorkflowStepNode.tsx
- [x] T012 [P] [US1] Create WorkflowPhaseGroup component for phase grouping in src/components/workflow-test/WorkflowPhaseGroup.tsx
- [x] T013 [US1] Create WorkflowPathway container component in src/components/workflow-test/WorkflowPathway.tsx (depends on T011, T012)
- [x] T014 [US1] Create WorkflowLogPanel for real-time log display in src/components/workflow-test/WorkflowLogPanel.tsx
- [x] T015 [US1] Create main page at src/app/settings/workflow-test/page.tsx with pathway and log panel
- [x] T016 [US1] Add step status animations (pulse for running, checkmark for passed, X for failed) in WorkflowStepNode.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Run Basic End-to-End Workflow Test (Priority: P1) 🎯 MVP

**Goal**: Execute automated end-to-end workflow test via API calls with real-time status updates

**Independent Test**: Navigate to /settings/workflow-test, click "Run Basic Test", observe step-by-step execution with pass/fail status

### Tests for User Story 2

- [x] T017 [P] [US2] Create test for SSE endpoint streaming messages in tests/app/settings/workflow-test/page.test.tsx
- [x] T018 [P] [US2] Create test for test cleanup before run in tests/app/settings/workflow-test/page.test.tsx

### Implementation for User Story 2

- [x] T019 [US2] Create SSE run endpoint at src/app/api/workflow-test/run/route.ts
- [x] T020 [P] [US2] Create cleanup API endpoint at src/app/api/workflow-test/cleanup/route.ts
- [x] T021 [US2] Implement Step 1-4 (Phase 1: Master Data Setup) execution in workflow-test.service.ts
- [x] T022 [US2] Implement Step 5-6 (Phase 2: BOM & Production Planning) execution in workflow-test.service.ts
- [x] T023 [US2] Implement Step 7-12 (Phase 3: Purchasing Flow) execution in workflow-test.service.ts
- [x] T024 [US2] Implement Step 13-19 (Phase 4: Production Flow) execution in workflow-test.service.ts
- [x] T025 [US2] Implement Step 20-21 (Phase 5: Finished Goods QC) execution in workflow-test.service.ts
- [x] T026 [US2] Implement Step 22-25 (Phase 6: Sales Flow) execution in workflow-test.service.ts
- [x] T027 [US2] Implement Step 26-29 (Phase 7: Accounting Verification) execution in workflow-test.service.ts
- [x] T028 [US2] Implement Step 30-31 (Phase 8: VMI Integration) execution in workflow-test.service.ts
- [x] T029 [US2] Add Run/Cancel buttons to main page with loading states in src/app/settings/workflow-test/page.tsx
- [x] T030 [US2] Add test summary display showing pass/fail counts and duration in src/app/settings/workflow-test/page.tsx

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - View Detailed Step Results (Priority: P2)

**Goal**: View detailed results for each step including API call details, created entities, and error information

**Independent Test**: Run a test, click on any completed step, view API call details and created entity links

### Tests for User Story 3

- [x] T031 [P] [US3] Create test for step detail dialog showing API info in tests/app/settings/workflow-test/page.test.tsx

### Implementation for User Story 3

- [x] T032 [US3] Create WorkflowStepDetail dialog component in src/components/workflow-test/WorkflowStepDetail.tsx
- [x] T033 [P] [US3] Create status API endpoint at src/app/api/workflow-test/status/[sessionId]/route.ts
- [x] T034 [P] [US3] Create step detail API endpoint at src/app/api/workflow-test/step/[stepId]/route.ts
- [x] T035 [US3] Add step click handler to open detail dialog in WorkflowPathway.tsx
- [x] T036 [US3] Display created entity links with navigation to ERP modules in WorkflowStepDetail.tsx

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work independently

---

## Phase 6: User Story 4 - Configure Test Parameters (Priority: P3)

**Goal**: Allow configuration of test parameters (product names, quantities, vendor names) before running

**Independent Test**: Modify test parameters, run test, verify created data uses configured values

### Tests for User Story 4

- [x] T037 [P] [US4] Create test for configuration form rendering and saving in tests/app/settings/workflow-test/page.test.tsx

### Implementation for User Story 4

- [x] T038 [US4] Create WorkflowTestConfig form component in src/components/workflow-test/WorkflowTestConfig.tsx
- [x] T039 [US4] Add configuration panel toggle to main page in src/app/settings/workflow-test/page.tsx
- [x] T040 [US4] Pass configuration to run endpoint and use in step execution in workflow-test.service.ts

**Checkpoint**: All user stories should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T041 [P] Create history API endpoint at src/app/api/workflow-test/history/route.ts
- [x] T042 [P] Add test history list to page showing recent executions in src/app/settings/workflow-test/page.tsx
- [x] T043 Run type check with `npx tsc --noEmit --skipLibCheck` and fix errors
- [x] T044 Run lint with `npm run lint` and fix warnings
- [x] T045 Run all tests with `npm test` and verify passing
- [x] T046 Manual verification using quickstart.md checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 priority and can proceed in parallel
  - US3 (P2) can start after Foundational, but logically follows US2
  - US4 (P3) can start after Foundational, independent of other stories
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - Uses same page as US1 but different features
- **User Story 3 (P2)**: Can start after Foundational - Needs US2 to create data to view, but component work is independent
- **User Story 4 (P3)**: Can start after Foundational - Enhances US2 but independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Components before page integration
- Services before API routes
- Core implementation before enhancement
- Story complete before moving to next priority

### Parallel Opportunities

- T002, T003 can run in parallel after T001
- T006, T007 can run in parallel within Phase 2
- T009, T010 can run in parallel (tests)
- T011, T012 can run in parallel (components)
- T017, T018 can run in parallel (tests)
- T020 can run in parallel with T019
- T033, T034 can run in parallel (API routes)
- T041, T042 can run in parallel (history feature)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "T009 Create UI test for WorkflowPathway rendering all 8 phases"
Task: "T010 Create UI test for step status updates"

# Launch component creation in parallel:
Task: "T011 Create WorkflowStepNode component"
Task: "T012 Create WorkflowPhaseGroup component"
```

## Parallel Example: User Story 2

```bash
# Launch cleanup endpoint while building run endpoint:
Task: "T019 Create SSE run endpoint"
Task: "T020 Create cleanup API endpoint"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T008)
3. Complete Phase 3: User Story 1 - Visual Pathway (T009-T016)
4. Complete Phase 4: User Story 2 - Run Test (T017-T030)
5. **STOP and VALIDATE**: Test end-to-end workflow
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Visual pathway works → Demo
3. Add User Story 2 → Full test execution works → Deploy (MVP!)
4. Add User Story 3 → Step details viewable → Deploy
5. Add User Story 4 → Configuration works → Deploy
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (visual components)
   - Developer B: User Story 2 (service/API)
3. After MVP:
   - Developer A: User Story 3 (detail dialog)
   - Developer B: User Story 4 (configuration)

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Tasks** | 46 |
| **Setup Phase** | 3 tasks |
| **Foundational Phase** | 5 tasks |
| **User Story 1 (P1)** | 8 tasks (2 tests, 6 implementation) |
| **User Story 2 (P1)** | 14 tasks (2 tests, 12 implementation) |
| **User Story 3 (P2)** | 6 tasks (1 test, 5 implementation) |
| **User Story 4 (P3)** | 4 tasks (1 test, 3 implementation) |
| **Polish Phase** | 6 tasks |
| **Parallel Opportunities** | 16 tasks marked [P] |
| **MVP Scope** | User Stories 1 + 2 (25 tasks) |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- The 31 workflow steps are defined in data-model.md Phase Definitions table
- SSE implementation pattern is in research.md
- Component structure is in research.md and quickstart.md
