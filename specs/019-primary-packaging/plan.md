# Implementation Plan: Primary Packaging Material Issuance & Return

**Branch**: `019-primary-packaging` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/019-primary-packaging/spec.md`

## Summary

Build an issuance + return workflow for Primary Packaging Material (capsules, bottles, caps, labels) separate from raw material handling. The workflow enforces Container Label tracking, Dual Control on issuance, Triple Independence on return approval (Operator ≠ Verifier ≠ QA), and atomic stock side-effects (inventory transaction + new lot creation with parent chain + deviation when out-of-tolerance).

**Technical approach:** Extend the existing `wo_packaging_materials` table with verification + status workflow columns. Create 3 new tables (`wo_packaging_returns`, `wo_packaging_return_approvals`, `packaging_tolerances`). Split existing `wo-execution.service.ts` packaging functions into a dedicated `packaging-issuance.service.ts` and add a new `packaging-return.service.ts` that mirrors `material-return.service.ts` patterns (transactional approve, child lot via `parentLotId`, auto-deviation on out-of-tolerance). Build operator + verifier + QA UIs with DevExtreme. Reuse `ElectronicSignatureDialog` from feature 018.

## Technical Context

**Language/Version**: TypeScript 5.x with strict mode
**Primary Dependencies**: Next.js 16.0.10, React 19.2.1, DevExtreme React 25.2.3, Drizzle ORM, TanStack Query 5.x, Zod 4.x, next-intl
**Storage**: MySQL (production, port 53306) and SQLite (testing) via Drizzle dual-schema pattern in `src/lib/db/schema.ts`
**Testing**: Vitest + React Testing Library. TDD mandatory per Constitution v1.4.0
**Target Platform**: Web app — Desktop 1920px + iPad landscape 1024px (packaging operators use tablets in cleanrooms)
**Project Type**: Web application (single Next.js project)
**Performance Goals**:
- Operator issue submit ≤ 60s end-to-end (SC-001)
- Verifier sign ≤ 30s (SC-002)
- Operator return submit ≤ 90s (SC-006)
- QA approve ≤ 60s (SC-007)
- Reconciliation render ≤ 5s per WO (SC-009)
- Excel/PDF export ≤ 10s per WO (SC-010)
**Constraints**:
- Dual-DB compatibility (MySQL datetime + SQLite text dates) — use `src/lib/db/date-utils.ts`
- Thai-first UI per spec 015-i18n
- All approve operations atomic in single Drizzle transaction (FR-028)
- Container Label duplicate check: 24h window for same WO — warning, not block (FR-005)
- Triple Independence enforced at service layer + API layer (defense in depth)
**Scale/Scope**:
- 5 factories (โพนพิสัย, อาจาโร, เรณูนคร, เจ้าพระยาอภัยภูเบศร, พระอาจารย์ฝั้น)
- ~50-200 WOs active per factory
- ~3-10 packaging issuances per WO
- ~3-10 packaging returns per WO
- ~6 new components, ~15 endpoints, ~12 service functions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|---|---|---|
| **I. Code Quality — TypeScript strict** | ✅ Pass | All new code in TS strict; no `any` |
| **I. Code Quality — Lint clean** | ✅ Pass | Run `bun run lint` after each task |
| **I. Code Quality — Error verification** | ✅ Pass | `bunx tsc --noEmit --skipLibCheck` after each task |
| **I. Code Quality — Reusable components** | ✅ Pass | Reuses `ElectronicSignatureDialog`; extracts `ContainerLabelInput` to `src/components/shared/` (used in issuance + return) |
| **II. Testing — TDD mandatory** | ✅ Pass | Test-first for all service functions, API handlers, UI components |
| **II. Testing — Unit test isolation** | ✅ Pass | SQLite in-memory + mock fetch — same pattern as feature 018 |
| **II. Testing — Integration tests for API** | ✅ Pass | Each endpoint gets contract + integration test |
| **III. UX — Responsive Desktop + iPad** | ✅ Pass | DevExtreme components throughout; tablet-optimized layout |
| **III. UX — Loading states + error feedback** | ✅ Pass | TanStack Query loading/error; toast via DevExtreme |
| **III. UX — DevExtreme primary** | ✅ Pass | Form, SelectBox, NumberBox, TextBox, FileUploader, Popup, DataGrid, Chart |
| **IV. Security — JWT + role check** | ✅ Pass | 4 new permissions enforced at API + service layer |
| **IV. Security — Audit trail** | ✅ Pass | All mutations via `auditedInsert/Update` |
| **IV. Security — Data integrity (no edit after finalize)** | ✅ Pass | FR-039: Issuance + Return + Approval immutable post-finalize |
| **IV. Security — Input validation** | ✅ Pass | Zod at API boundary; DevExtreme validators client-side |

**Result:** ✅ No constitutional violations. No Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/019-primary-packaging/
├── plan.md              # This file
├── spec.md              # Feature specification (complete)
├── research.md          # Phase 0 — technical research findings
├── data-model.md        # Phase 1 — entities + relationships
├── quickstart.md        # Phase 1 — local dev / e2e walkthrough
├── contracts/           # Phase 1 — OpenAPI per endpoint group
│   ├── issuances.yaml
│   ├── returns.yaml
│   ├── reconciliation.yaml
│   └── tolerances.yaml
├── checklists/
│   └── requirements.md  # Quality checklist (complete)
└── tasks.md             # Phase 2 — generated by /speckit.tasks
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── db/
│   │   ├── schema.ts                                   # EXTEND — re-export new tables + extend wo_packaging_materials columns
│   │   └── schema-packaging.ts                         # NEW — 3 new tables (dual SQLite/MySQL)
│   ├── services/
│   │   ├── packaging-issuance.service.ts               # NEW — issue + verify (Dual Control)
│   │   ├── packaging-return.service.ts                 # NEW — return + QA approve (Triple Independence + atomic tx)
│   │   ├── packaging-reconciliation.service.ts         # NEW — per-WO reconciliation aggregations
│   │   └── wo-execution.service.ts                     # UNCHANGED — existing packaging fns stay (parallel flow)
│   ├── validation/
│   │   └── packaging.ts                                # NEW — Zod schemas
│   └── types/
│       └── packaging.ts                                # NEW — TS types + error codes
├── app/
│   ├── api/
│   │   ├── production/work-orders/[id]/
│   │   │   ├── packaging-issuances/route.ts           # POST (create) + GET (list)
│   │   │   ├── packaging-issuances/[issuanceId]/
│   │   │   │   ├── route.ts                            # GET detail
│   │   │   │   ├── verify/route.ts                     # POST verify (e-sig)
│   │   │   │   └── cancel/route.ts                     # POST cancel
│   │   │   ├── packaging-returns/route.ts             # POST (create) + GET (list)
│   │   │   ├── packaging-returns/[returnId]/
│   │   │   │   ├── route.ts                            # GET detail
│   │   │   │   ├── verify/route.ts                     # POST verify (e-sig)
│   │   │   │   ├── approve/route.ts                    # POST QA approve (e-sig + atomic tx)
│   │   │   │   └── reject/route.ts                     # POST QA reject
│   │   │   └── packaging-reconciliation/route.ts      # GET reconciliation JSON
│   │   └── master-data/
│   │       └── packaging-tolerances/                   # GET, POST, PUT — admin CRUD
│   └── production/
│       └── work-orders/[id]/
│           └── packaging-materials/
│               ├── page.tsx                            # NEW — main page (operator: issue + history)
│               ├── return/page.tsx                     # NEW — return form for issuances
│               ├── verify/page.tsx                     # NEW — verifier queue (Dual Control)
│               └── approve/page.tsx                    # NEW — QA queue (Triple Independence)
├── components/
│   ├── shared/
│   │   └── container-label-input.tsx                   # NEW — input + 24h duplicate-check + warning
│   └── production/
│       ├── packaging-issuance-form.tsx                 # NEW — operator form
│       ├── packaging-issuance-table.tsx                # NEW — DataGrid of WO issuances
│       ├── packaging-return-dialog.tsx                 # NEW — return form (mirrors material-return-dialog)
│       ├── packaging-return-approval-card.tsx          # NEW — QA approval card
│       └── packaging-reconciliation-card.tsx           # NEW — reconciliation summary in WO detail
└── tests/
    ├── lib/services/
    │   ├── packaging-issuance.service.test.ts
    │   ├── packaging-return.service.test.ts
    │   └── packaging-reconciliation.service.test.ts
    ├── api/packaging/
    │   ├── issuances.test.ts
    │   ├── returns.test.ts
    │   ├── approve.test.ts
    │   └── reconciliation.test.ts
    └── components/production/
        ├── packaging-issuance-form.test.tsx
        ├── packaging-return-dialog.test.tsx
        └── packaging-reconciliation-card.test.tsx
```

**Structure Decision**: Single Next.js project. The existing `wo-execution.service.ts` packaging functions remain (already used by other code paths in batch records). The new feature lives in dedicated service files to keep the 2000-line execution service stable. Schema extensions consolidate in `schema-packaging.ts` (new file) and re-export from central `schema.ts` — same pattern proven in feature 018.

## Phase 0: Research

See [research.md](./research.md) — investigates:

1. **Existing `wo_packaging_materials` reuse boundary** — keep or extend?
2. **Triple Independence enforcement pattern** — service layer guards + API layer redundancy
3. **Atomic QA approval transaction** — Drizzle tx wrapping stock + lot + transaction + deviation + signature
4. **Child lot via `parentLotId`** — reuse `material-return.service.ts` pattern for traceability chain
5. **Tolerance lookup hierarchy** — category-based, simpler than feature 018 (no factory dimension)
6. **Container Label 24h duplicate check** — index strategy + query
7. **Packaging category derivation** — from `items.category` field, mapped to tolerance category
8. **DevExtreme components for tablet** — touch-friendly variants
9. **i18n namespace `packaging`**
10. **Dual-DB constraints** — datetime + decimal handling (PCs as INTEGER vs DECIMAL)

## Phase 1: Design & Contracts

Generated artifacts:

- **[data-model.md](./data-model.md)** — 3 new tables + 1 extension, ER diagram, state machines
- **[contracts/](./contracts/)** — OpenAPI specs for 15 endpoints grouped by issuances / returns / reconciliation / tolerances
- **[quickstart.md](./quickstart.md)** — local setup, e2e happy path (issue → verify → return → verify → QA approve → reconcile), edge case scenarios

## Complexity Tracking

> No constitutional violations identified — section intentionally empty.
