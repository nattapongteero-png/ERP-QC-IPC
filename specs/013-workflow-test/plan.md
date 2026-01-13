# Implementation Plan: Workflow Test Page

**Branch**: `013-workflow-test` | **Date**: 2026-01-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-workflow-test/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Create a workflow test page at `/settings/workflow-test` that provides a visual pathway diagram for automated end-to-end testing of ERP processes. The page executes 31 test steps across 8 phases via API calls, displays real-time status updates, and provides detailed step results for debugging. Uses DevExtreme components for UI, Server-Sent Events (SSE) for real-time updates, and the existing API infrastructure for test execution.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 16.0.10
**Primary Dependencies**: React 19, DevExtreme React 25.2.3, TanStack Query 5.x, Lucide React (icons)
**Storage**: MySQL (production), SQLite (testing) via Drizzle ORM
**Testing**: Vitest + React Testing Library (unit), Playwright (E2E)
**Target Platform**: Web browser (Chrome, Firefox, Safari) - Desktop primary, tablet secondary
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Complete 31-step test in <120 seconds, real-time updates within 500ms of status change
**Constraints**: API-only execution (no direct DB manipulation), test data cleanup required between runs
**Scale/Scope**: Single page with ~1000 LOC, calling 31+ existing API endpoints, targeting admin users

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status | Notes |
|-----------|-------------|--------|-------|
| I. Code Quality - Type Safety | TypeScript strict mode | ✅ PASS | Project uses strict TS |
| I. Code Quality - No Hardcoded Values | Config-driven test data | ✅ PASS | Test parameters configurable |
| I. Code Quality - Error Handling | Explicit error handling for async | ✅ PASS | Each step captures errors |
| I. Code Quality - Reusable Components | Extract shared UI patterns | ✅ PASS | Will use shared components |
| II. Testing Standards | Unit tests for primary paths | ✅ PASS | Will test page rendering and step execution |
| III. UX Consistency - DevExtreme | Use DevExtreme components | ✅ PASS | DataGrid, Button, LoadIndicator |
| III. UX Consistency - Loading States | Show loading indicators | ✅ PASS | Visual pathway shows running state |
| III. UX Consistency - Error Feedback | Clear error messages | ✅ PASS | Failed steps show error details |
| IV. Performance - Page Load | <3s initial load | ✅ PASS | Lightweight page, no heavy data |
| IV. Performance - API Response | <500ms simple queries | ✅ PASS | Using existing optimized APIs |
| V. Security - Authentication | API auth required | ✅ PASS | Admin-only page |
| V. Security - Audit Trail | Log test executions | ✅ PASS | Test logs preserved |

**Gate Result**: ✅ PASS - No constitution violations

## Project Structure

### Documentation (this feature)

```text
specs/013-workflow-test/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── settings/
│   │   └── workflow-test/
│   │       └── page.tsx              # Main workflow test page
│   └── api/
│       └── workflow-test/
│           ├── route.ts              # Start test, get status
│           └── cleanup/route.ts      # Cleanup previous test data
├── components/
│   └── workflow-test/
│       ├── WorkflowPathway.tsx       # Visual pathway diagram
│       ├── WorkflowPhaseGroup.tsx    # Phase grouping component
│       ├── WorkflowStepNode.tsx      # Individual step node
│       ├── WorkflowStepDetail.tsx    # Step detail panel
│       ├── WorkflowLogPanel.tsx      # Real-time log display
│       └── WorkflowTestConfig.tsx    # Test configuration form
├── lib/
│   └── services/
│       └── workflow-test/
│           ├── workflow-test.service.ts  # Test execution logic
│           ├── workflow-steps.ts         # Step definitions
│           └── test-data-cleanup.ts      # Cleanup utilities
├── types/
│   └── workflow-test.ts              # Type definitions
└── lib/
    └── validation/
        └── workflow-test.ts          # Zod schemas

tests/
└── app/
    └── settings/
        └── workflow-test/
            └── page.test.tsx         # UI tests
```

**Structure Decision**: Single Next.js web application with App Router. New page at `/settings/workflow-test` following existing patterns in `/settings/vmi`. Service layer handles test orchestration, components handle visualization.

## Complexity Tracking

> **No violations requiring justification**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

---

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion.*

| Principle | Requirement | Status | Design Evidence |
|-----------|-------------|--------|-----------------|
| I. Code Quality - Type Safety | TypeScript strict mode | ✅ PASS | All types defined in `workflow-test.ts` with strict interfaces |
| I. Code Quality - No Hardcoded Values | Config-driven test data | ✅ PASS | `TestConfiguration` interface allows customization, default prefix |
| I. Code Quality - Error Handling | Explicit error handling for async | ✅ PASS | `StepError` captures full API error context |
| I. Code Quality - Reusable Components | Extract shared UI patterns | ✅ PASS | Uses existing `WorkflowStatusBadge`, `ApprovalChain` patterns |
| II. Testing Standards | Unit tests for primary paths | ✅ PASS | Test file structure defined in quickstart.md |
| III. UX Consistency - DevExtreme | Use DevExtreme components | ✅ PASS | DxButton, DevExtreme icons in design |
| III. UX Consistency - Loading States | Show loading indicators | ✅ PASS | `animate-pulse` for running state |
| III. UX Consistency - Error Feedback | Clear error messages | ✅ PASS | `StepError` shows endpoint, status, body |
| IV. Performance - Page Load | <3s initial load | ✅ PASS | No heavy data on initial render |
| IV. Performance - API Response | <500ms simple queries | ✅ PASS | SSE streams, no blocking requests |
| V. Security - Authentication | API auth required | ✅ PASS | `withAuth(['admin:write'])` on all endpoints |
| V. Security - Audit Trail | Log test executions | ✅ PASS | Session tracks createdBy, all API calls logged |

**Post-Design Gate Result**: ✅ PASS - All constitution requirements satisfied by design

---

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Implementation Plan | `specs/013-workflow-test/plan.md` | ✅ Complete |
| Research | `specs/013-workflow-test/research.md` | ✅ Complete |
| Data Model | `specs/013-workflow-test/data-model.md` | ✅ Complete |
| API Contracts | `specs/013-workflow-test/contracts/workflow-test-api.yaml` | ✅ Complete |
| Quickstart Guide | `specs/013-workflow-test/quickstart.md` | ✅ Complete |
| Tasks | `specs/013-workflow-test/tasks.md` | ⏳ Pending (run /speckit.tasks) |
