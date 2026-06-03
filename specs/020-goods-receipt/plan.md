# Implementation Plan: Goods Receipt & Incoming Inspection

**Branch**: `020-goods-receipt` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-goods-receipt/spec.md`

## Summary

Build a unified Goods Receipt (GRN) and Incoming Inspection workflow that consolidates raw-material receipts (from POs) and finished-goods receipts (from Production WOs) into a single, GMP-compliant document with auto-numbered GRN, category-specific checklists, auto-created QC samples, Triple Independence (Receiver ≠ Checklist Inspector ≠ QA Approver), electronic signatures, and a strict quarantine-gate before any received lot becomes available for use. The workflow re-uses the existing `inventory_lots`, `qc_samples`, `electronic_signatures`, and `audit_trail` tables and follows the same architectural patterns established in Feature 019 (Packaging Issuance & Return). Four new tables capture GRN-specific data; no schema migrations affect existing inventory or QC flows.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20 LTS (via Bun runtime for tooling)
**Primary Dependencies**: Next.js 16.0.10, React 19.2.1, Drizzle ORM, TanStack Query 5.x, Zod 4.x, DevExtreme React 25.2.3, next-intl 4.x, Vitest 3.x + React Testing Library
**Storage**: MySQL 8.x (production) + SQLite (testing) via Drizzle dual-schema pattern; both schemas live in `src/lib/db/schema-goods-receipt.ts` and are re-exported through `src/lib/db/schema.ts`
**Testing**: Vitest + React Testing Library + supertest (API), in-memory SQLite for service tests; integration tests against MySQL via existing docker-compose UAT stack
**Target Platform**: Web (Next.js SSR, Edge-incompatible — uses Node runtime for Drizzle MySQL driver). Primary viewport: desktop 1920×1080, secondary iPad landscape.
**Project Type**: Single Next.js application (App Router)
**Performance Goals**: GRN list page renders in <800ms p95 with 500 GRNs; GRN detail page (with checklist, signature, QC link) <1s p95; QA Release action (transaction over 4 tables) <500ms p95
**Constraints**: All API routes Node runtime, no Edge. MySQL/SQLite date handling via `date-utils.ts`. No N+1 queries — all GRN list views must join in a single statement.
**Scale/Scope**: Estimated 50–200 GRNs/month at steady state, peak 30 lines/GRN, 5,000 GRN history target before pagination becomes critical. 4 new UI pages, 12–16 new API endpoints, 4 new tables, ~30–40 implementation tasks across 8 phases.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Check | Status |
|---|---|---|---|
| 1 | **I. Type Safety** | All new code TypeScript strict mode, no `any` except library boundaries | ✅ PASS |
| 2 | **I. Linting Compliance** | All new files will pass ESLint with zero errors (CI gate) | ✅ PASS |
| 3 | **I. Single Responsibility** | One service per concern: `goods-receipt.service.ts`, `goods-receipt-checklist.service.ts`, `goods-receipt-qc.service.ts`. Each function <50 lines or explicitly justified. | ✅ PASS |
| 4 | **I. No Hardcoded Values** | Tolerances configurable via DB (`receipt_tolerances` table), checklist templates configurable, GRN number sequence from DB | ✅ PASS |
| 5 | **I. Error Handling** | Custom error class `GoodsReceiptError` with 12 typed codes (mirrors `PackagingError` from F019). All API routes return structured `{error, code, details}` | ✅ PASS |
| 6 | **I. Error Verification** | `bunx tsc --noEmit --skipLibCheck` + `bun run lint` after each task per CLAUDE.md mandate | ✅ PASS |
| 7 | **I. Frequent Commits** | Phase-by-phase commits (Phase 1 schema, Phase 2 service, Phase 3 API, Phase 4 UI, etc.) | ✅ PASS |
| 8 | **I. Reusable Components** | Re-use `ElectronicSignatureDialog`, `AuditLogViewerDialog`, `MainLayout`, existing DevExtreme grids. New shared `ChecklistEditor` placed in `src/components/goods-receipt/` (1 page consumer initially → graduate to `shared/` when 2nd consumer appears) | ✅ PASS |
| 9 | **II. TDD Mandatory** | Phase 2 service tasks each begin with a failing Vitest; Phase 3 API routes each begin with a failing supertest; Phase 4 pages each begin with a failing RTL render test | ✅ PASS |
| 10 | **II. Test Coverage** | Each service function: 1 success path + 1 error path minimum. State machine + Triple Independence covered by exhaustive truth-table tests. | ✅ PASS |
| 11 | **II. Unit Test Isolation** | Service tests use in-memory SQLite via existing `setupTestDb()` helper; no network/external calls | ✅ PASS |
| 12 | **III. Responsive Design** | All pages tested at 1920, 1024, and 375px. iPad landscape primary. | ✅ PASS |
| 13 | **III. DevExtreme Components** | `DataGrid` for list pages, `Form` for entry, `SelectBox` for source-document picker, `Popup` for checklist + signature, `LoadIndicator` for async states. No shadcn/Material/native equivalents. | ✅ PASS |
| 14 | **III. Form Validation** | Zod schemas in `src/lib/validation/goods-receipt.ts`; client-side blur validation via TanStack Form or react-hook-form (project standard) | ✅ PASS |
| 15 | **IV. Performance** | GRN list query uses a single LEFT JOIN over `goods_receipts ← goods_receipt_lines ← inventory_lots`. Pagination at 50 rows. No N+1. | ✅ PASS |
| 16 | **V. Authentication** | All new API routes call `getSession()`; reject unauthenticated requests with 401 | ✅ PASS |
| 17 | **V. Authorization** | Three new permissions enforced in API layer + service layer (defense in depth). Admin bypass DISABLED for Triple Independence per spec FR-025. | ✅ PASS |
| 18 | **V. Audit Trail** | Every state transition writes to `audit_trail` via `auditedInsert`/`auditedUpdate`. Electronic signatures recorded for receiver checklist + QA release. | ✅ PASS |
| 19 | **V. Data Integrity** | Released lots immutable post-release; modifications require deviation. GRN-line state machine prevents invalid transitions. | ✅ PASS |
| 20 | **V. Input Validation** | All API inputs through Zod parse, all DB writes through Drizzle parameterized queries (no raw SQL with concatenation) | ✅ PASS |

**Gate result: 20/20 PASS — no violations to track in Complexity section.**

## Project Structure

### Documentation (this feature)

```text
specs/020-goods-receipt/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI YAML)
│   ├── goods-receipts.yaml
│   ├── goods-receipt-lines.yaml
│   ├── goods-receipt-checklists.yaml
│   └── incoming-inspection.yaml
├── checklists/
│   └── requirements.md  # Spec quality checklist (done)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── types/
│   └── goods-receipt.ts                     # NEW — TS interfaces + error codes
├── lib/
│   ├── validation/
│   │   └── goods-receipt.ts                 # NEW — Zod schemas
│   ├── db/
│   │   ├── schema-goods-receipt.ts          # NEW — 4 tables × SQLite+MySQL
│   │   └── schema.ts                        # MOD — re-export new tables
│   └── services/
│       ├── goods-receipt.service.ts         # NEW — GRN CRUD, numbering, state machine
│       ├── goods-receipt-checklist.service.ts # NEW — checklist signing, template fetch
│       └── goods-receipt-qa.service.ts      # NEW — QA release transaction (atomic)
├── app/
│   ├── inventory/
│   │   └── goods-receipt/
│   │       ├── page.tsx                     # NEW — dashboard + list
│   │       ├── new/
│   │       │   └── page.tsx                 # NEW — create GRN (pick PO/WO)
│   │       └── [id]/
│   │           └── page.tsx                 # NEW — detail + checklist + QA action
│   ├── quality/
│   │   └── incoming-inspection/
│   │       └── page.tsx                     # NEW — QC perspective dashboard
│   ├── master-data/
│   │   └── receipt-checklist-templates/
│   │       └── page.tsx                     # NEW — admin checklist template CRUD
│   └── api/
│       ├── inventory/
│       │   └── goods-receipts/
│       │       ├── route.ts                 # NEW — GET list, POST create
│       │       └── [id]/
│       │           ├── route.ts             # NEW — GET, PATCH (cancel)
│       │           ├── lines/
│       │           │   └── [lineId]/
│       │           │       ├── route.ts     # NEW — PATCH actuals
│       │           │       ├── checklist/
│       │           │       │   └── route.ts # NEW — POST sign checklist
│       │           │       └── qa/
│       │           │           └── route.ts # NEW — POST release / POST reject
│       │           └── cancel/
│       │               └── route.ts         # NEW — POST cancel GRN
│       └── master-data/
│           └── receipt-checklist-templates/
│               ├── route.ts                 # NEW — list/create
│               └── [id]/
│                   └── route.ts             # NEW — update/disable
└── components/
    └── goods-receipt/                       # NEW domain folder
        ├── grn-dashboard-tiles.tsx
        ├── grn-line-row.tsx
        ├── checklist-editor.tsx
        └── grn-source-picker.tsx            # SelectBox over PO or WO

tests/
├── lib/services/
│   ├── goods-receipt.service.test.ts        # NEW
│   ├── goods-receipt-checklist.service.test.ts # NEW
│   └── goods-receipt-qa.service.test.ts     # NEW
├── api/
│   └── goods-receipts/                      # NEW — supertest integration
└── app/
    └── inventory/goods-receipt/             # NEW — RTL render tests
```

**Structure Decision**: Single Next.js application (App Router). This is an additive feature to an existing monolithic ERP; no new project/package is justified. Follows the exact layout established by Features 018 (Material Withdrawal) and 019 (Packaging Issuance), keeping mental model consistency.

## Complexity Tracking

No constitution violations. No exceptions required.

## Phase 0 — Research

See [research.md](./research.md) for the decision log.

Headline decisions:

- **R1 GRN Numbering** — Use a per-year counter in a small `goods_receipt_sequences` row updated within the create-GRN transaction (avoid race condition). Format `GRN-YYYY-NNNNN`.
- **R2 State machine location** — Encode allowed transitions in TypeScript constant `GRN_TRANSITIONS`; runtime guard in service + API layers (defense in depth, mirrors F019).
- **R3 Triple Independence** — Direct user-ID equality check in the QA release service before any DB write. Admin role does NOT bypass.
- **R4 Atomic Release Transaction** — Single Drizzle transaction touching 4 tables: `goods_receipt_lines` (status), `inventory_lots` (status), `audit_trail` (event), `electronic_signatures` (sig record). All-or-nothing.
- **R5 Auto-QC Sample** — Inside the checklist-sign transaction, call existing `createQcSample()` service with `sourceGrnLineId` field added to qc_samples (additive column).
- **R6 Checklist template versioning** — Soft-version via `templateVersion` integer on `goods_receipt_checklists`; copies the template's items at sign time so future template edits don't mutate history.
- **R7 Tolerance reuse** — New `receipt_tolerances` table mirroring `packaging_tolerances` pattern (per-category, percent, isActive).
- **R8 Source document type discrimination** — Discriminated union with `sourceType: 'po' | 'wo'` + nullable foreign keys (`poId` or `woId`); validation enforces exactly one is set.
- **R9 Dashboard query** — Single LEFT JOIN with derived counts; refresh on TanStack Query invalidation triggers, not polling.
- **R10 i18n** — Add namespace `goodsReceipt` to `src/locales/{th,en}/`. Thai primary per F015 pattern.
- **R11 Permission keys** — Three new keys: `inventory:goods_receipt:receive`, `inventory:goods_receipt:checklist`, `quality:incoming:approve`. Inserted into `hr_app_permissions` via seed migration.
- **R12 Default tests** — Auto-QC sample picks the item's default `qc_test_panel` by `items.defaultTestPanelId`. If null, sample is still created and flagged.

## Phase 1 — Design & Contracts

Generated:
- [data-model.md](./data-model.md) — 4 new tables (`goods_receipts`, `goods_receipt_lines`, `goods_receipt_checklists`, `receipt_checklist_templates`) plus 1 sequence helper (`goods_receipt_sequences`) and 1 config table (`receipt_tolerances`); 1 additive column on `qc_samples` (`source_grn_line_id`) and 1 on `inventory_lots` (`source_grn_line_id`)
- [contracts/](./contracts/) — OpenAPI 3.1 specs for 4 endpoint groups (16 endpoints total)
- [quickstart.md](./quickstart.md) — Manual end-to-end walkthrough for P1 stories
- Agent context refreshed (CLAUDE.md updated)

### Post-design Constitution re-check

| # | Risk | Mitigation | Status |
|---|---|---|---|
| 1 | Adding columns to `qc_samples` and `inventory_lots` could break existing queries | Columns are nullable, additive, indexed by feature usage only — no existing code reads them | ✅ PASS |
| 2 | GRN list page could trigger N+1 by fetching lines per row | Use single JOIN query that aggregates line count + status counts per GRN | ✅ PASS |
| 3 | Auto-QC sample creation inside checklist-sign transaction could fail and roll back the whole sign | Wrapped in a try/catch within the transaction; if QC sample fails, line stays in `checklist_done` and the QC manager is notified. Sign itself does not roll back. | ✅ PASS |
| 4 | Triple Independence check could be bypassed by client patching the user ID | Check happens in the service layer after server-side `getSession()` — client cannot influence | ✅ PASS |

**Post-design gate result: 4/4 PASS — proceed to Phase 2 (/speckit.tasks).**
