# Implementation Plan: Material Withdrawal Approval for Machine Setup Loss

**Branch**: `018-material-withdrawal-approval` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/018-material-withdrawal-approval/spec.md`

## Summary

Build a workflow that lets Production Operators request additional raw material withdrawal beyond planned BOM quantity (for machine setup losses, trial runs, parameter adjustments). Production Supervisor must approve before stock is deducted. On approval the system creates inventory transactions, deviation records, updates material consumption, and unblocks affected production phases (Selective Block — FR-035..FR-040).

**Technical approach:** Reuse generic `approval-workflow.service.ts` by registering new doc-type `material_withdrawal_request`. Add a domain service (`material-withdrawal.service.ts`) that mirrors `material-return.service.ts`. Extend `production-gate.service.ts` with a selective-block hook that consults pending withdrawal requests + BOM phase→material mapping. Add `material-withdrawal-request-dialog.tsx` (operator form) and `material-withdrawal-approval-page.tsx` (supervisor queue). All DB writes go through `audit-wrapper.ts`. Schema additions follow the dual-table SQLite/MySQL pattern in `schema.ts`.

## Technical Context

**Language/Version**: TypeScript 5.x with strict mode (project standard)
**Primary Dependencies**: Next.js 16.0.10, React 19.2.1, DevExtreme React 25.2.3, Drizzle ORM, TanStack Query 5.x, Zod 4.x, next-intl
**Storage**: MySQL (production, port 53306 local) and SQLite (testing) via Drizzle dual-schema pattern in [src/lib/db/schema.ts](../../src/lib/db/schema.ts)
**Testing**: Vitest + React Testing Library. TDD mandatory per Constitution v1.4.0 (II)
**Target Platform**: Web application (Next.js App Router) — primary target Desktop 1920px + iPad landscape 1024px (operators use tablets in production rooms)
**Project Type**: Web application (single Next.js project with `src/app`, `src/lib`, `src/components`)
**Performance Goals**:
- Operator form submit (FR-001..FR-009) end-to-end ≤ 90s (SC-001)
- Supervisor approve/reject ≤ 60s (SC-002)
- Pending → decided within 4 working hours for 95% (SC-008)
- Report export PDF/Excel ≤ 10s for 1 month / 1 factory (SC-010)
**Constraints**:
- Dual-DB compatibility (MySQL datetime + SQLite text dates) — use `src/lib/db/date-utils.ts`
- Thai-first UI (default locale `th`) per spec 015-i18n
- E-signature pattern reuse — see existing Line Clearance implementation
- Selective phase blocking must not introduce N+1 query when listing many WOs
- All inventory mutation, deviation creation, audit logging must occur in a single DB transaction with the approval (atomicity / SC-003)
**Scale/Scope**:
- 5 factories (โพนพิสัย, อาจาโร, เรณูนคร, เจ้าพระยาอภัยภูเบศร, พระอาจารย์ฝั้น)
- ~50–200 WOs active per factory at any time
- ~5–30 withdrawal requests per factory per day (estimated)
- ~10 reusable React components, ~12 API endpoints, ~6 service functions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|---|---|---|
| **I. Code Quality — TypeScript strict** | ✅ Pass | All new code in TS strict; no `any` |
| **I. Code Quality — Lint clean** | ✅ Pass | Run `bun run lint` after each task |
| **I. Code Quality — Error verification** | ✅ Pass | `bunx tsc --noEmit --skipLibCheck` after each task per CLAUDE.md |
| **I. Code Quality — Reusable components** | ✅ Pass | New shared components (e.g. `MaterialPickerFromBOM`, `ESignaturePromptDialog`) placed under `src/components/shared/` or `src/components/production/`. We reuse existing E-sig and ApprovalQueueTable patterns |
| **II. Testing — TDD mandatory** | ✅ Pass | Test-first for service functions, API handlers, UI components |
| **II. Testing — Unit test isolation** | ✅ Pass | SQLite in-memory for service tests; mocks for fetch in component tests |
| **II. Testing — Integration tests for API** | ✅ Pass | Each endpoint gets integration test (request → response → DB state) |
| **III. UX — Responsive Desktop + iPad** | ✅ Pass | DevExtreme components used throughout (Form, DataGrid, Popup) |
| **III. UX — Loading states + error feedback** | ✅ Pass | TanStack Query handles loading/error; toast for user-facing errors |
| **III. UX — DevExtreme primary** | ✅ Pass | No shadcn/ui or HTML form controls — Form, SelectBox, NumberBox, FileUploader, Popup, DataGrid |
| **IV. Security — JWT + role check** | ✅ Pass | New permissions `production:withdrawal:request` + `:approve` enforced at API layer + UI gating |
| **IV. Security — Audit trail** | ✅ Pass | All mutations via `auditedInsert/Update/Delete` from `audit-wrapper.ts` |
| **IV. Security — Data integrity (no edit after approval)** | ✅ Pass | Approved/rejected requests are immutable (FR-028). Changes require deviation per Constitution IV |
| **IV. Security — Input validation** | ✅ Pass | Zod schemas at API boundary; DevExtreme client-side validators |

**Result:** ✅ No constitutional violations. No Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/018-material-withdrawal-approval/
├── plan.md              # This file
├── spec.md              # Feature specification (complete)
├── research.md          # Phase 0 — technical research findings
├── data-model.md        # Phase 1 — entities + relationships
├── quickstart.md        # Phase 1 — local dev / e2e walkthrough
├── contracts/           # Phase 1 — OpenAPI per endpoint
│   ├── requests.yaml
│   ├── approvals.yaml
│   ├── reports.yaml
│   └── rules.yaml
├── checklists/
│   └── requirements.md  # Quality checklist (complete)
└── tasks.md             # Phase 2 — generated by /speckit.tasks
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── db/
│   │   └── schema.ts              # EXTEND — add sqlite+mysql tables for withdrawal requests (5 new tables)
│   ├── services/
│   │   ├── material-withdrawal.service.ts        # NEW — primary service (mirror material-return.service.ts pattern)
│   │   ├── production-gate.service.ts            # EXTEND — add isPhaseBlockedByPendingWithdrawal() hook
│   │   ├── approval-workflow.service.ts          # EXTEND — register doc type 'material_withdrawal_request'
│   │   └── withdrawal-reporting.service.ts       # NEW — aggregations for monthly/quarterly reports
│   ├── validation/
│   │   └── material-withdrawal.ts                # NEW — Zod schemas
│   └── types/
│       └── material-withdrawal.ts                # NEW — TS types
├── app/
│   ├── api/
│   │   ├── material-withdrawal/
│   │   │   ├── requests/
│   │   │   │   ├── route.ts                       # POST (create), GET (list with filters)
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts                   # GET (detail), DELETE (only if pending+own)
│   │   │   │       ├── approve/route.ts           # POST approve (e-signature required)
│   │   │   │       └── reject/route.ts            # POST reject
│   │   │   ├── pending/route.ts                   # GET — supervisor queue
│   │   │   ├── attachments/route.ts               # POST upload
│   │   │   ├── reports/route.ts                   # GET monthly/quarterly + export
│   │   │   └── rules/route.ts                     # GET, PUT — soft/hard cap config
│   │   └── production/work-orders/[id]/
│   │       └── blocked-phases/route.ts            # GET — phases blocked due to pending withdrawal (selective)
│   ├── production/
│   │   └── work-orders/[id]/
│   │       └── components/                        # extend existing WO detail page
│   └── material-withdrawal/
│       ├── layout.tsx                             # MainLayout wrapper
│       ├── page.tsx                               # all requests (filterable list)
│       ├── pending/page.tsx                       # supervisor pending queue
│       ├── reports/page.tsx                       # tracking + analytics
│       └── rules/page.tsx                         # admin: configure caps
├── components/
│   └── production/
│       ├── material-withdrawal-request-dialog.tsx  # NEW — operator form (Popup w/ Form)
│       ├── material-withdrawal-detail-dialog.tsx   # NEW — read-only detail view
│       ├── material-withdrawal-approval-card.tsx   # NEW — supervisor card with approve/reject
│       ├── withdrawal-history-list.tsx             # NEW — embedded inside WO detail
│       └── phase-block-banner.tsx                  # NEW — UI banner shown in WO phase when blocked
└── tests/
    ├── lib/services/
    │   ├── material-withdrawal.service.test.ts
    │   └── production-gate.service.test.ts        # extend existing
    ├── api/material-withdrawal/
    │   ├── requests.test.ts
    │   ├── approve.test.ts
    │   └── reject.test.ts
    └── components/production/
        └── material-withdrawal-request-dialog.test.tsx
```

**Structure Decision**: Single Next.js project (already established). Schema extension consolidates in central `schema.ts` (matches existing `materialReturns` pattern at schema.ts:6799). Domain split: service / API / UI / tests parallel directories. Sidebar entry registered in `src/components/layout/sidebar.tsx` per Template Module reference.

## Phase 0: Research

See [research.md](./research.md) — investigates:

1. **Existing approval-workflow extension contract** — how to register new doc type without breaking existing 7 doc types
2. **Existing material-return.service patterns** — variance calc, deviation auto-creation, transaction boundaries
3. **Production-gate phase blocking model** — current gate hooks and where to insert selective-block check
4. **E-signature pattern from Line Clearance** — password verification + hash storage
5. **BOM phase→material mapping** — query/derivation for FR-040
6. **DevExtreme components selection** — Form, FileUploader, Popup, DataGrid configuration
7. **i18n message file structure** — th/material-withdrawal.json + en/material-withdrawal.json
8. **Dual-DB constraints** — datetime handling, default values, ON DELETE behavior

## Phase 1: Design & Contracts

Generated artifacts:

- **[data-model.md](./data-model.md)** — 5 new entities, 2 extensions, ER diagram, state machine
- **[contracts/](./contracts/)** — OpenAPI specs for 12 endpoints (requests CRUD, approvals, attachments, reports, rules, blocked-phases)
- **[quickstart.md](./quickstart.md)** — local setup, e2e happy path, edge case scenarios

## Complexity Tracking

> No constitutional violations identified — section intentionally empty.
