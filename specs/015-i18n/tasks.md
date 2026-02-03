# Tasks: Internationalization (i18n) Support

**Input**: Design documents from `/specs/015-i18n/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Unit tests included per CLAUDE.md requirement for UI testing with React Testing Library + Vitest.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**TDD Compliance**: Per Constitution v1.4.0, all phases follow TDD workflow: Test First (Red) → Implement (Green) → Verify (Refactor).

**Last Updated**: 2026-02-03 (Updated for TDD constitution compliance)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- **[TDD-R]**: TDD Red phase - write failing test first
- **[TDD-G]**: TDD Green phase - implement to make test pass
- **[TDD-V]**: TDD Verify phase - run all checks
- Include exact file paths in descriptions
- **Commit after EACH task** - not just at checkpoints (per Constitution I.8)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and create project structure for i18n

- [x] T001 Install next-intl and js-cookie dependencies via `bun add next-intl js-cookie`
- [x] T002 Install dev dependencies via `bun add -D @types/js-cookie eslint-plugin-i18n-json`
- [x] T003 [P] Create locale directory structure `src/locales/th/` and `src/locales/en/`
- [x] T004 [P] Create i18n library directory `src/lib/i18n/`
- [x] T005 [P] Create TypeScript type augmentation file `src/types/i18n.ts`

---

## Phase 2: Foundational (Core i18n Infrastructure)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Core Configuration

- [x] T006 Create locale configuration in `src/lib/i18n/config.ts` with locales, defaultLocale, fallbackLocale, localeNames, and namespaces
- [x] T007 Create request configuration for next-intl in `src/lib/i18n/request.ts` with cookie-based locale detection
- [x] T008 Create custom translation hook wrappers in `src/lib/i18n/use-translations.ts`
- [x] T009 Create DevExtreme locale sync utility in `src/lib/i18n/devextreme-sync.ts`
- [x] T010 Create i18n module index exporting all utilities in `src/lib/i18n/index.ts`

### Base Translation Files

- [x] T011 [P] Create Thai common translations in `src/locales/th/common.json` with actions, status, validation, errors, loading, empty sections
- [x] T012 [P] Create English common translations in `src/locales/en/common.json` mirroring Thai structure
- [x] T013 [P] Create Thai navigation translations in `src/locales/th/navigation.json` with modules, submenus, breadcrumb, header
- [x] T014 [P] Create English navigation translations in `src/locales/en/navigation.json` mirroring Thai structure

### Next.js Integration

- [x] T015 Update `next.config.ts` to use next-intl plugin with request configuration path
- [x] T016 Create i18n provider wrapper in `src/components/providers/i18n-provider.tsx`
- [x] T017 Update root layout `src/app/layout.tsx` to wrap with NextIntlClientProvider

### DevExtreme Integration

- [x] T018 Update DevExtremeProvider in `src/components/providers/devextreme-provider.tsx` to sync locale with i18n system
- [x] T019 [P] Create English DevExtreme message overrides in `src/locales/en/devextreme.json`

### Unit Test Infrastructure

- [x] T020 Create i18n test wrapper utility in `tests/helpers/i18n-test-wrapper.tsx` for mocking translations in tests
- [x] T021 Create unit test for i18n config in `tests/lib/i18n/config.test.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin ✅

---

## Phase 3: User Story 1 - Switch Language Without Page Reload (Priority: P1) 🎯 MVP

**Goal**: Users can switch between Thai and English via a UI selector and see all text update instantly without page reload

**Independent Test**: Navigate to any page, change language via selector, verify all visible text updates within 500ms without page reload

### Tests for User Story 1

- [x] T022 [P] [US1] Create unit test for LanguageSwitcher component in `tests/components/shared/language-switcher.test.tsx`
- [x] T023 [P] [US1] Create integration test for language switching in `tests/integration/i18n-switch.test.tsx`

### Implementation for User Story 1

- [x] T024 [US1] Create LanguageSwitcher component using DevExtreme SelectBox in `src/components/shared/language-switcher.tsx`
- [x] T025 [US1] Add LanguageSwitcher to MainLayout header in `src/components/layout/main-layout.tsx`
- [x] T026 [US1] Update Sidebar component to add LanguageSwitcher in `src/components/layout/sidebar.tsx`
- [x] T027 [US1] Create Thai dashboard translations in `src/locales/th/dashboard.json`
- [x] T028 [P] [US1] Create English dashboard translations in `src/locales/en/dashboard.json`
- [x] T029 [US1] Update Dashboard page to use translations in `src/app/dashboard/page.tsx`
- [x] T030 [US1] Verify language switch preserves scroll position and form data (manual testing + document)

**Checkpoint**: User Story 1 complete - Language switching works on Dashboard with translations ✅

---

## Phase 4: User Story 2 - Complete Translation Coverage Validation (Priority: P1)

**Goal**: Build-time validation detects missing translation keys and fails the build with clear error reporting

**Independent Test**: Remove a translation key, run validation command, verify build fails with file location and missing locale

### Tests for User Story 2

- [x] T031 [P] [US2] Create unit test for validation script in `tests/scripts/validate-i18n.test.ts`

### Implementation for User Story 2

- [x] T032 [US2] Create i18n validation script in `scripts/validate-i18n.ts` that extracts t() calls and compares against translation files
- [x] T033 [US2] Add ESLint configuration for i18n-json plugin in `eslint.config.mjs` to validate JSON structure and key consistency
- [x] T034 [US2] Add `i18n:check` script to `package.json` for running validation
- [x] T035 [US2] Add validation to build script in `package.json` to fail build on missing translations
- [x] T036 [US2] Test validation by temporarily removing a key and verifying error output

**Checkpoint**: User Story 2 complete - Missing translations detected at build time ✅

---

## Phase 5: User Story 3 - Persistent Language Preference (Priority: P2)

**Goal**: User's language preference persists across browser sessions via localStorage/cookie

**Independent Test**: Select a language, close browser, reopen application, verify language preference is restored

### Tests for User Story 3

- [x] T037 [P] [US3] Create unit test for locale persistence in `tests/lib/i18n/locale-persistence.test.ts`

### Implementation for User Story 3

- [x] T038 [US3] Create locale persistence service in `src/lib/i18n/locale-persistence.ts` using js-cookie and localStorage
- [x] T039 [US3] Update LanguageSwitcher to persist preference on change in `src/components/shared/language-switcher.tsx`
- [x] T040 [US3] Update request.ts to read preference from cookie on initial load in `src/lib/i18n/request.ts`
- [x] T041 [US3] Verify preference persists across page navigation and browser restart

**Checkpoint**: User Story 3 complete - Language preference persists across sessions ✅

---

## Phase 6: User Story 4 - Thai Fallback for Missing Translations (Priority: P2)

**Goal**: When English translation is missing, system falls back to Thai text instead of showing raw key

**Independent Test**: Remove an English translation key, select English, verify Thai text appears instead of key name

### Tests for User Story 4

- [x] T042 [P] [US4] Create unit test for fallback behavior in `tests/lib/i18n/fallback.test.tsx`

### Implementation for User Story 4

- [x] T043 [US4] Configure next-intl fallback in `src/lib/i18n/request.ts` to use Thai messages when English key missing
- [x] T044 [US4] Add development-mode console warning for missing translations in `src/lib/i18n/use-translations.ts`
- [x] T045 [US4] Test fallback by temporarily removing English key and verifying Thai appears

**Checkpoint**: User Story 4 complete - Thai fallback works for missing English translations ✅

---

## Phase 7: User Story 5 - Developer-Friendly Translation Workflow (Priority: P3)

**Goal**: Developers have clear documentation and tooling for adding new translations

**Independent Test**: Follow documentation to add a new translation key, verify it appears correctly in both languages

### Implementation for User Story 5

- [x] T046 [P] [US5] Create module translation files for high-traffic modules:
  - `src/locales/th/inventory.json` and `src/locales/en/inventory.json`
  - `src/locales/th/production.json` and `src/locales/en/production.json`
  - `src/locales/th/accounting.json` and `src/locales/en/accounting.json`
- [x] T047 [US5] Create developer guide for i18n in `docs/i18n-developer-guide.md` covering key naming, file organization, validation
- [x] T048 [US5] Update quickstart.md with common tasks and troubleshooting

**Checkpoint**: User Story 5 complete - Developers have clear workflow for translations ✅

---

## Phase 8: User Story 6 - Extend to Additional Languages (Priority: P3)

**Goal**: System supports adding new languages by adding translation files and registering locale

**Independent Test**: Add stub files for a third language (e.g., Chinese), verify it appears in selector and fallback works

### Tests for User Story 6

- [x] T049 [P] [US6] Create integration test for adding new language in `tests/integration/i18n-extensibility.test.tsx`

### Implementation for User Story 6

- [x] T050 [US6] Document process for adding new languages in `docs/i18n-developer-guide.md`
- [x] T051 [US6] Add configuration option for required vs optional locales in validation script `scripts/validate-i18n.ts`
- [x] T052 [US6] Test extensibility by adding stub Chinese locale files and verifying registration

**Checkpoint**: User Story 6 complete - New languages can be added without code changes ✅

---

## Phase 9: Fix Missing Translation Keys (BLOCKER)

**Purpose**: Fix 56 missing translation keys that cause build to fail

**⚠️ CRITICAL**: Build currently fails - must fix before any deployment

**TDD Approach**: Write test verifying keys exist → Add keys → Verify test passes

### TDD Red Phase - Write Failing Tests

- [ ] T053 [TDD-R] Create test in `tests/lib/i18n/missing-keys.test.ts` that verifies all required translation keys exist in both Thai and English JSON files. Test MUST fail initially (confirming 56 keys are missing).

### TDD Green Phase - Add Missing Keys

- [ ] T054 [TDD-G] Add missing keys to `src/locales/th/accounting.json` and `src/locales/en/accounting.json`:
  - `chartOfAccounts.actions.label`
  - `chartOfAccounts.actions.add`

- [ ] T055 [TDD-G] Add missing keys to `src/locales/th/dashboard.json` and `src/locales/en/dashboard.json`:
  - `error`, `retry`, `lastUpdated`
  - `sections.rawMaterials`, `sections.qualityProduction`
  - `tables.expiryAlerts.title`, `tables.expiryAlerts.lotNumber`, `tables.expiryAlerts.item`
  - `tables.expiryAlerts.daysLeft`, `tables.expiryAlerts.expired`, `tables.expiryAlerts.daysRemaining`
  - `tables.lowStock.title`, `tables.lowStock.code`, `tables.lowStock.item`
  - `tables.lowStock.onHand`, `tables.lowStock.minStock`

- [ ] T056 [TDD-G] Add missing keys to `src/locales/th/purchasing.json` and `src/locales/en/purchasing.json`:
  - `orders.grid.columns.poNumber`, `orders.grid.columns.vendor`, `orders.grid.columns.expectedDate`
  - `orders.actions.createPO`
  - `orders.stats.pending`, `orders.stats.awaiting`

- [ ] T057 [TDD-G] Add missing keys to `src/locales/th/sales.json` and `src/locales/en/sales.json`:
  - `orders.detail.error.lotStatus.title`

### TDD Verify Phase

- [ ] T058 [TDD-V] Run `bunx tsc --noEmit && bun run lint && bun run test:run && bun run i18n:check` - all checks MUST pass

**Checkpoint**: Phase 9 complete - Build passes, no missing translation keys ⬜

---

## Phase 10: Module Translation Migration (Detailed)

**Purpose**: Migrate ALL remaining pages to use i18n translations

**Status**: 21/229 pages migrated (9.2% complete)

**TDD Pattern per Module**:
1. **[TDD-R]** Write/update tests for module pages (test MUST fail - pages don't use i18n yet)
2. **[TDD-G]** Migrate pages to use translations (tests should pass)
3. **[TDD-V]** Verify: `bunx tsc --noEmit && bun run lint && bun run test:run && bun run i18n:check`
4. **Commit** after each task (per Constitution I.8)

---

### Phase 10A: GMP Module (36 pages, 0 migrated)

**Translation file**: `src/locales/th/gmp.json`, `src/locales/en/gmp.json`

#### TDD Red Phase - Write Tests First

- [ ] T059 [TDD-R] Create i18n tests for GMP module in `tests/app/gmp/i18n.test.tsx` covering all 36 pages. Tests verify pages use `useTranslations('gmp')` and render translated content. Tests MUST fail initially.

#### TDD Green Phase - Migrate Pages

##### Stability Sub-module (6 pages)

- [ ] T060 [P] [TDD-G] Migrate `src/app/gmp/stability/page.tsx` to use i18n
- [ ] T061 [P] [TDD-G] Migrate `src/app/gmp/stability/studies/page.tsx` to use i18n
- [ ] T062 [P] [TDD-G] Migrate `src/app/gmp/stability/studies/[id]/page.tsx` to use i18n
- [ ] T063 [P] [TDD-G] Migrate `src/app/gmp/stability/trends/page.tsx` to use i18n
- [ ] T064 [P] [TDD-G] Migrate `src/app/gmp/stability/protocols/page.tsx` to use i18n
- [ ] T065 [P] [TDD-G] Migrate `src/app/gmp/stability/protocols/new/page.tsx` to use i18n

##### CAPA Sub-module (3 pages)

- [ ] T066 [P] [TDD-G] Migrate `src/app/gmp/capa/page.tsx` to use i18n
- [ ] T067 [P] [TDD-G] Migrate `src/app/gmp/capa/new/page.tsx` to use i18n
- [ ] T068 [P] [TDD-G] Migrate `src/app/gmp/capa/[id]/page.tsx` to use i18n

##### Complaints Sub-module (4 pages)

- [ ] T069 [P] [TDD-G] Migrate `src/app/gmp/complaints/page.tsx` to use i18n
- [ ] T070 [P] [TDD-G] Migrate `src/app/gmp/complaints/new/page.tsx` to use i18n
- [ ] T071 [P] [TDD-G] Migrate `src/app/gmp/complaints/[id]/page.tsx` to use i18n
- [ ] T072 [P] [TDD-G] Migrate `src/app/gmp/complaints/trends/page.tsx` to use i18n

##### Documents Sub-module (3 pages)

- [ ] T073 [P] [TDD-G] Migrate `src/app/gmp/documents/page.tsx` to use i18n
- [ ] T074 [P] [TDD-G] Migrate `src/app/gmp/documents/new/page.tsx` to use i18n
- [ ] T075 [P] [TDD-G] Migrate `src/app/gmp/documents/[id]/page.tsx` to use i18n

##### Internal Audit Sub-module (5 pages)

- [ ] T076 [P] [TDD-G] Migrate `src/app/gmp/internal-audit/page.tsx` to use i18n
- [ ] T077 [P] [TDD-G] Migrate `src/app/gmp/internal-audit/audits/page.tsx` to use i18n
- [ ] T078 [P] [TDD-G] Migrate `src/app/gmp/internal-audit/audits/[id]/page.tsx` to use i18n
- [ ] T079 [P] [TDD-G] Migrate `src/app/gmp/internal-audit/findings/page.tsx` to use i18n
- [ ] T080 [P] [TDD-G] Migrate `src/app/gmp/internal-audit/plans/page.tsx` to use i18n

##### Recalls Sub-module (3 pages)

- [ ] T081 [P] [TDD-G] Migrate `src/app/gmp/recalls/page.tsx` to use i18n
- [ ] T082 [P] [TDD-G] Migrate `src/app/gmp/recalls/new/page.tsx` to use i18n
- [ ] T083 [P] [TDD-G] Migrate `src/app/gmp/recalls/[id]/page.tsx` to use i18n

##### Sanitation Sub-module (5 pages)

- [ ] T084 [P] [TDD-G] Migrate `src/app/gmp/sanitation/page.tsx` to use i18n
- [ ] T085 [P] [TDD-G] Migrate `src/app/gmp/sanitation/logs/page.tsx` to use i18n
- [ ] T086 [P] [TDD-G] Migrate `src/app/gmp/sanitation/pest-control/page.tsx` to use i18n
- [ ] T087 [P] [TDD-G] Migrate `src/app/gmp/sanitation/schedules/page.tsx` to use i18n
- [ ] T088 [P] [TDD-G] Migrate `src/app/gmp/sanitation/trends/page.tsx` to use i18n

##### Changes Sub-module (3 pages)

- [ ] T089 [P] [TDD-G] Migrate `src/app/gmp/changes/page.tsx` to use i18n
- [ ] T090 [P] [TDD-G] Migrate `src/app/gmp/changes/new/page.tsx` to use i18n
- [ ] T091 [P] [TDD-G] Migrate `src/app/gmp/changes/[id]/page.tsx` to use i18n

##### Contracts Sub-module (1 page)

- [ ] T092 [P] [TDD-G] Migrate `src/app/gmp/contracts/page.tsx` to use i18n

##### PQR Sub-module (3 pages)

- [ ] T093 [P] [TDD-G] Migrate `src/app/gmp/pqr/page.tsx` to use i18n
- [ ] T094 [P] [TDD-G] Migrate `src/app/gmp/pqr/generate/page.tsx` to use i18n
- [ ] T095 [P] [TDD-G] Migrate `src/app/gmp/pqr/[id]/page.tsx` to use i18n

#### TDD Verify Phase

- [ ] T096 [TDD-V] GMP Module verification: `bunx tsc --noEmit && bun run lint && bun run test:run && bun run i18n:check`

**Checkpoint**: GMP module complete (36 pages) ⬜

---

### Phase 10B: Quality Module (10 pages, 0 migrated)

**Translation file**: `src/locales/th/quality.json`, `src/locales/en/quality.json`

#### TDD Red Phase

- [ ] T097 [TDD-R] Create i18n tests for Quality module in `tests/app/quality/i18n.test.tsx` covering all 10 pages. Tests MUST fail initially.

#### TDD Green Phase

- [ ] T098 [P] [TDD-G] Migrate `src/app/quality/page.tsx` to use i18n

##### Deviations Sub-module (3 pages)

- [ ] T099 [P] [TDD-G] Migrate `src/app/quality/deviations/page.tsx` to use i18n
- [ ] T100 [P] [TDD-G] Migrate `src/app/quality/deviations/new/page.tsx` to use i18n
- [ ] T101 [P] [TDD-G] Migrate `src/app/quality/deviations/[id]/page.tsx` to use i18n

##### Tests Sub-module (3 pages)

- [ ] T102 [P] [TDD-G] Migrate `src/app/quality/tests/page.tsx` to use i18n
- [ ] T103 [P] [TDD-G] Migrate `src/app/quality/tests/new/page.tsx` to use i18n
- [ ] T104 [P] [TDD-G] Migrate `src/app/quality/tests/[id]/page.tsx` to use i18n

##### Specs Sub-module (3 pages)

- [ ] T105 [P] [TDD-G] Migrate `src/app/quality/specs/page.tsx` to use i18n
- [ ] T106 [P] [TDD-G] Migrate `src/app/quality/specs/new/page.tsx` to use i18n
- [ ] T107 [P] [TDD-G] Migrate `src/app/quality/specs/[id]/page.tsx` to use i18n

#### TDD Verify Phase

- [ ] T108 [TDD-V] Quality Module verification: `bunx tsc --noEmit && bun run lint && bun run test:run && bun run i18n:check`

**Checkpoint**: Quality module complete (10 pages) ⬜

---

### Phase 10C: HR Module (28 pages, 0 migrated)

**Translation file**: `src/locales/th/hr.json`, `src/locales/en/hr.json`

#### TDD Red Phase

- [ ] T109 [TDD-R] Create i18n tests for HR module in `tests/app/hr/i18n.test.tsx` covering all 28 pages. Tests MUST fail initially.

#### TDD Green Phase

- [ ] T110 [P] [TDD-G] Migrate `src/app/hr/page.tsx` to use i18n
- [ ] T111 [P] [TDD-G] Migrate `src/app/hr/audit/page.tsx` to use i18n
- [ ] T112 [P] [TDD-G] Migrate `src/app/hr/notifications/page.tsx` to use i18n
- [ ] T113 [P] [TDD-G] Migrate `src/app/hr/org-chart/page.tsx` to use i18n
- [ ] T114 [P] [TDD-G] Migrate `src/app/hr/org/page.tsx` to use i18n

##### Authorizations Sub-module (3 pages)

- [ ] T115 [P] [TDD-G] Migrate `src/app/hr/authorizations/page.tsx` to use i18n
- [ ] T116 [P] [TDD-G] Migrate `src/app/hr/authorizations/new/page.tsx` to use i18n
- [ ] T117 [P] [TDD-G] Migrate `src/app/hr/authorizations/[id]/page.tsx` to use i18n

##### Employees Sub-module (4 pages)

- [ ] T118 [P] [TDD-G] Migrate `src/app/hr/employees/page.tsx` to use i18n
- [ ] T119 [P] [TDD-G] Migrate `src/app/hr/employees/new/page.tsx` to use i18n
- [ ] T120 [P] [TDD-G] Migrate `src/app/hr/employees/[id]/page.tsx` to use i18n
- [ ] T121 [P] [TDD-G] Migrate `src/app/hr/employees/[id]/edit/page.tsx` to use i18n

##### Health Records Sub-module (3 pages)

- [ ] T122 [P] [TDD-G] Migrate `src/app/hr/health-records/page.tsx` to use i18n
- [ ] T123 [P] [TDD-G] Migrate `src/app/hr/health-records/new/page.tsx` to use i18n
- [ ] T124 [P] [TDD-G] Migrate `src/app/hr/health-records/[id]/page.tsx` to use i18n

##### Positions Sub-module (3 pages)

- [ ] T125 [P] [TDD-G] Migrate `src/app/hr/positions/page.tsx` to use i18n
- [ ] T126 [P] [TDD-G] Migrate `src/app/hr/positions/new/page.tsx` to use i18n
- [ ] T127 [P] [TDD-G] Migrate `src/app/hr/positions/[id]/page.tsx` to use i18n

##### Roles Sub-module (3 pages)

- [ ] T128 [P] [TDD-G] Migrate `src/app/hr/roles/page.tsx` to use i18n
- [ ] T129 [P] [TDD-G] Migrate `src/app/hr/roles/new/page.tsx` to use i18n
- [ ] T130 [P] [TDD-G] Migrate `src/app/hr/roles/[id]/page.tsx` to use i18n

##### Training Sub-module (7 pages)

- [ ] T131 [P] [TDD-G] Migrate `src/app/hr/training/page.tsx` to use i18n
- [ ] T132 [P] [TDD-G] Migrate `src/app/hr/training/matrix/page.tsx` to use i18n
- [ ] T133 [P] [TDD-G] Migrate `src/app/hr/training/sessions/page.tsx` to use i18n
- [ ] T134 [P] [TDD-G] Migrate `src/app/hr/training/sessions/new/page.tsx` to use i18n
- [ ] T135 [P] [TDD-G] Migrate `src/app/hr/training/courses/page.tsx` to use i18n
- [ ] T136 [P] [TDD-G] Migrate `src/app/hr/training/courses/new/page.tsx` to use i18n
- [ ] T137 [P] [TDD-G] Migrate `src/app/hr/training/courses/[id]/page.tsx` to use i18n

#### TDD Verify Phase

- [ ] T138 [TDD-V] HR Module verification: `bunx tsc --noEmit && bun run lint && bun run test:run && bun run i18n:check`

**Checkpoint**: HR module complete (28 pages) ⬜

---

### Phase 10D: Accounting Module (42 pages, 2 migrated)

**Translation file**: `src/locales/th/accounting.json`, `src/locales/en/accounting.json`

#### TDD Red Phase

- [ ] T139 [TDD-R] Create i18n tests for Accounting module in `tests/app/accounting/i18n.test.tsx` covering all 40 remaining pages. Tests MUST fail initially.

#### TDD Green Phase

##### AP Sub-module (4 pages)

- [ ] T140 [P] [TDD-G] Migrate `src/app/accounting/ap/page.tsx` to use i18n
- [ ] T141 [P] [TDD-G] Migrate `src/app/accounting/ap/aging/page.tsx` to use i18n
- [ ] T142 [P] [TDD-G] Migrate `src/app/accounting/ap/invoices/page.tsx` to use i18n
- [ ] T143 [P] [TDD-G] Migrate `src/app/accounting/ap/payments/page.tsx` to use i18n

##### AR Sub-module (4 pages)

- [ ] T144 [P] [TDD-G] Migrate `src/app/accounting/ar/page.tsx` to use i18n
- [ ] T145 [P] [TDD-G] Migrate `src/app/accounting/ar/aging/page.tsx` to use i18n
- [ ] T146 [P] [TDD-G] Migrate `src/app/accounting/ar/invoices/page.tsx` to use i18n
- [ ] T147 [P] [TDD-G] Migrate `src/app/accounting/ar/receipts/page.tsx` to use i18n

##### Equipment Sub-module (3 pages)

- [ ] T148 [P] [TDD-G] Migrate `src/app/accounting/equipment/page.tsx` to use i18n
- [ ] T149 [P] [TDD-G] Migrate `src/app/accounting/equipment/new/page.tsx` to use i18n
- [ ] T150 [P] [TDD-G] Migrate `src/app/accounting/equipment/[id]/page.tsx` to use i18n

##### Fixed Assets Sub-module (3 pages)

- [ ] T151 [P] [TDD-G] Migrate `src/app/accounting/fixed-assets/page.tsx` to use i18n
- [ ] T152 [P] [TDD-G] Migrate `src/app/accounting/fixed-assets/new/page.tsx` to use i18n
- [ ] T153 [P] [TDD-G] Migrate `src/app/accounting/fixed-assets/[id]/page.tsx` to use i18n

##### Journal Entries Sub-module (2 pages)

- [ ] T154 [P] [TDD-G] Migrate `src/app/accounting/journal-entries/new/page.tsx` to use i18n
- [ ] T155 [P] [TDD-G] Migrate `src/app/accounting/journal-entries/[id]/page.tsx` to use i18n

##### Reports Sub-module (7 pages)

- [ ] T156 [P] [TDD-G] Migrate `src/app/accounting/reports/page.tsx` to use i18n
- [ ] T157 [P] [TDD-G] Migrate `src/app/accounting/reports/balance-sheet/page.tsx` to use i18n
- [ ] T158 [P] [TDD-G] Migrate `src/app/accounting/reports/cash-flow/page.tsx` to use i18n
- [ ] T159 [P] [TDD-G] Migrate `src/app/accounting/reports/income-statement/page.tsx` to use i18n
- [ ] T160 [P] [TDD-G] Migrate `src/app/accounting/reports/trial-balance/page.tsx` to use i18n
- [ ] T161 [P] [TDD-G] Migrate `src/app/accounting/reports/vat/page.tsx` to use i18n
- [ ] T162 [P] [TDD-G] Migrate `src/app/accounting/reports/wht/page.tsx` to use i18n

##### Bank Reconciliation Sub-module (4 pages)

- [ ] T163 [P] [TDD-G] Migrate `src/app/accounting/bank-reconciliation/page.tsx` to use i18n
- [ ] T164 [P] [TDD-G] Migrate `src/app/accounting/bank-reconciliation/reconcile/[id]/page.tsx` to use i18n
- [ ] T165 [P] [TDD-G] Migrate `src/app/accounting/bank-reconciliation/statements/new/page.tsx` to use i18n
- [ ] T166 [P] [TDD-G] Migrate `src/app/accounting/bank-reconciliation/statements/[id]/page.tsx` to use i18n

##### Credit/Debit Notes Sub-module (9 pages)

- [ ] T167 [P] [TDD-G] Migrate `src/app/accounting/credit-debit-notes/page.tsx` to use i18n
- [ ] T168 [P] [TDD-G] Migrate `src/app/accounting/credit-debit-notes/new/page.tsx` to use i18n
- [ ] T169 [P] [TDD-G] Migrate `src/app/accounting/credit-debit-notes/[id]/page.tsx` to use i18n
- [ ] T170 [P] [TDD-G] Migrate `src/app/accounting/credit-notes/page.tsx` to use i18n
- [ ] T171 [P] [TDD-G] Migrate `src/app/accounting/credit-notes/new/page.tsx` to use i18n
- [ ] T172 [P] [TDD-G] Migrate `src/app/accounting/credit-notes/[id]/page.tsx` to use i18n
- [ ] T173 [P] [TDD-G] Migrate `src/app/accounting/debit-notes/page.tsx` to use i18n
- [ ] T174 [P] [TDD-G] Migrate `src/app/accounting/debit-notes/new/page.tsx` to use i18n
- [ ] T175 [P] [TDD-G] Migrate `src/app/accounting/debit-notes/[id]/page.tsx` to use i18n

##### Other Accounting Pages (5 pages)

- [ ] T176 [P] [TDD-G] Migrate `src/app/accounting/approvals/page.tsx` to use i18n
- [ ] T177 [P] [TDD-G] Migrate `src/app/accounting/matching/page.tsx` to use i18n
- [ ] T178 [P] [TDD-G] Migrate `src/app/accounting/period-close/page.tsx` to use i18n
- [ ] T179 [P] [TDD-G] Migrate `src/app/accounting/standard-costs/page.tsx` to use i18n
- [ ] T180 [P] [TDD-G] Migrate `src/app/accounting/variance-reports/page.tsx` to use i18n

#### TDD Verify Phase

- [ ] T181 [TDD-V] Accounting Module verification: `bunx tsc --noEmit && bun run lint && bun run test:run && bun run i18n:check`

**Checkpoint**: Accounting module complete (42 pages) ⬜

---

### Phase 10E: Production Module (17 pages, 2 migrated)

**Translation file**: `src/locales/th/production.json`, `src/locales/en/production.json`

#### TDD Red Phase

- [ ] T182 [TDD-R] Create i18n tests for Production module in `tests/app/production/i18n.test.tsx` covering all 15 remaining pages. Tests MUST fail initially.

#### TDD Green Phase

- [ ] T183 [P] [TDD-G] Migrate `src/app/production/page.tsx` to use i18n
- [ ] T184 [P] [TDD-G] Migrate `src/app/production/label-verification/page.tsx` to use i18n
- [ ] T185 [P] [TDD-G] Migrate `src/app/production/line-clearance/page.tsx` to use i18n

##### Batch Records Sub-module (2 pages)

- [ ] T186 [P] [TDD-G] Migrate `src/app/production/batch-records/page.tsx` to use i18n
- [ ] T187 [P] [TDD-G] Migrate `src/app/production/batch-records/[id]/page.tsx` to use i18n

##### BOM Sub-module (3 pages)

- [ ] T188 [P] [TDD-G] Migrate `src/app/production/bom/[id]/page.tsx` to use i18n
- [ ] T189 [P] [TDD-G] Migrate `src/app/production/bom/[id]/configuration/page.tsx` to use i18n
- [ ] T190 [P] [TDD-G] Migrate `src/app/production/bom/new/page.tsx` to use i18n

##### Work Orders Sub-module (9 pages)

- [ ] T191 [P] [TDD-G] Migrate `src/app/production/work-orders/new/page.tsx` to use i18n
- [ ] T192 [P] [TDD-G] Migrate `src/app/production/work-orders/[id]/page.tsx` to use i18n
- [ ] T193 [P] [TDD-G] Migrate `src/app/production/work-orders/[id]/cleaning/page.tsx` to use i18n
- [ ] T194 [P] [TDD-G] Migrate `src/app/production/work-orders/[id]/environmental-monitoring/page.tsx` to use i18n
- [ ] T195 [P] [TDD-G] Migrate `src/app/production/work-orders/[id]/execution/page.tsx` to use i18n
- [ ] T196 [P] [TDD-G] Migrate `src/app/production/work-orders/[id]/finished-inspection/page.tsx` to use i18n
- [ ] T197 [P] [TDD-G] Migrate `src/app/production/work-orders/[id]/material-weighing/page.tsx` to use i18n
- [ ] T198 [P] [TDD-G] Migrate `src/app/production/work-orders/[id]/packaging-qc/page.tsx` to use i18n
- [ ] T199 [P] [TDD-G] Migrate `src/app/production/work-orders/[id]/sop-execution/page.tsx` to use i18n

#### TDD Verify Phase

- [ ] T200 [TDD-V] Production Module verification: `bunx tsc --noEmit && bun run lint && bun run test:run && bun run i18n:check`

**Checkpoint**: Production module complete (17 pages) ⬜

---

### Phase 10F: Inventory Module (6 pages, 3 migrated)

**Translation file**: `src/locales/th/inventory.json`, `src/locales/en/inventory.json`

#### TDD Red Phase

- [ ] T201 [TDD-R] Create i18n tests for Inventory module in `tests/app/inventory/i18n.test.tsx` covering all 3 remaining pages. Tests MUST fail initially.

#### TDD Green Phase

- [ ] T202 [P] [TDD-G] Migrate `src/app/inventory/page.tsx` to use i18n
- [ ] T203 [P] [TDD-G] Migrate `src/app/inventory/expiry-alerts/page.tsx` to use i18n
- [ ] T204 [P] [TDD-G] Migrate `src/app/inventory/items/[id]/page.tsx` to use i18n
- [ ] T205 [P] [TDD-G] Migrate `src/app/inventory/lots/[id]/page.tsx` to use i18n
- [ ] T206 [P] [TDD-G] Migrate `src/app/inventory/transactions/page.tsx` to use i18n
- [ ] T207 [P] [TDD-G] Migrate `src/app/inventory/warehouses/[id]/page.tsx` to use i18n

#### TDD Verify Phase

- [ ] T208 [TDD-V] Inventory Module verification: `bunx tsc --noEmit && bun run lint && bun run test:run && bun run i18n:check`

**Checkpoint**: Inventory module complete (6 pages) ⬜

---

### Phase 10G: Purchasing Module (7 pages, 3 migrated)

**Translation file**: `src/locales/th/purchasing.json`, `src/locales/en/purchasing.json`

#### TDD Red Phase

- [ ] T209 [TDD-R] Create i18n tests for Purchasing module in `tests/app/purchasing/i18n.test.tsx` covering all 4 remaining pages. Tests MUST fail initially.

#### TDD Green Phase

- [ ] T210 [P] [TDD-G] Migrate `src/app/purchasing/page.tsx` to use i18n
- [ ] T211 [P] [TDD-G] Migrate `src/app/purchasing/orders/new/page.tsx` to use i18n
- [ ] T212 [P] [TDD-G] Migrate `src/app/purchasing/orders/[id]/page.tsx` to use i18n
- [ ] T213 [P] [TDD-G] Migrate `src/app/purchasing/vendors/new/page.tsx` to use i18n
- [ ] T214 [P] [TDD-G] Migrate `src/app/purchasing/vendors/[id]/page.tsx` to use i18n
- [ ] T215 [P] [TDD-G] Migrate `src/app/purchasing/requisitions/new/page.tsx` to use i18n
- [ ] T216 [P] [TDD-G] Migrate `src/app/purchasing/requisitions/[id]/page.tsx` to use i18n

#### TDD Verify Phase

- [ ] T217 [TDD-V] Purchasing Module verification: `bunx tsc --noEmit && bun run lint && bun run test:run && bun run i18n:check`

**Checkpoint**: Purchasing module complete (7 pages) ⬜

---

### Phase 10H: Sales Module (3 pages, 2 migrated)

**Translation file**: `src/locales/th/sales.json`, `src/locales/en/sales.json`

#### TDD Red Phase

- [ ] T218 [TDD-R] Create i18n tests for Sales module in `tests/app/sales/i18n.test.tsx` covering 1 remaining page. Tests MUST fail initially.

#### TDD Green Phase

- [ ] T219 [P] [TDD-G] Migrate `src/app/sales/page.tsx` to use i18n
- [ ] T220 [P] [TDD-G] Migrate `src/app/sales/vmi-orders/page.tsx` to use i18n
- [ ] T221 [P] [TDD-G] Migrate `src/app/sales/vmi-orders/portals/[id]/webhooks/page.tsx` to use i18n

#### TDD Verify Phase

- [ ] T222 [TDD-V] Sales Module verification: `bunx tsc --noEmit && bun run lint && bun run test:run && bun run i18n:check`

**Checkpoint**: Sales module complete (3 pages) ⬜

---

### Phase 10I: Cost Module (8 pages, 0 migrated)

**Translation file**: `src/locales/th/cost.json`, `src/locales/en/cost.json`

#### TDD Red Phase

- [ ] T223 [TDD-R] Create i18n tests for Cost module in `tests/app/cost/i18n.test.tsx` covering all 8 pages. Tests MUST fail initially.

#### TDD Green Phase

- [ ] T224 [P] [TDD-G] Migrate `src/app/cost/page.tsx` to use i18n

##### Landed Costs Sub-module (3 pages)

- [ ] T225 [P] [TDD-G] Migrate `src/app/cost/landed-costs/page.tsx` to use i18n
- [ ] T226 [P] [TDD-G] Migrate `src/app/cost/landed-costs/new/page.tsx` to use i18n
- [ ] T227 [P] [TDD-G] Migrate `src/app/cost/landed-costs/[id]/page.tsx` to use i18n

##### Work Centers Sub-module (3 pages)

- [ ] T228 [P] [TDD-G] Migrate `src/app/cost/work-centers/page.tsx` to use i18n
- [ ] T229 [P] [TDD-G] Migrate `src/app/cost/work-centers/new/page.tsx` to use i18n
- [ ] T230 [P] [TDD-G] Migrate `src/app/cost/work-centers/[id]/page.tsx` to use i18n

##### Reports Sub-module (1 page)

- [ ] T231 [P] [TDD-G] Migrate `src/app/cost/reports/cost-summary/page.tsx` to use i18n

#### TDD Verify Phase

- [ ] T232 [TDD-V] Cost Module verification: `bunx tsc --noEmit && bun run lint && bun run test:run && bun run i18n:check`

**Checkpoint**: Cost module complete (8 pages) ⬜

---

### Phase 10J: VMI Module (2 pages, 0 migrated)

**Translation file**: `src/locales/th/vmi.json`, `src/locales/en/vmi.json`

#### TDD Red Phase

- [ ] T233 [TDD-R] Create i18n tests for VMI module in `tests/app/vmi/i18n.test.tsx` covering all 2 pages. Tests MUST fail initially.

#### TDD Green Phase

- [ ] T234 [P] [TDD-G] Migrate `src/app/vmi/page.tsx` to use i18n
- [ ] T235 [P] [TDD-G] Migrate `src/app/vmi/sync/page.tsx` to use i18n

#### TDD Verify Phase

- [ ] T236 [TDD-V] VMI Module verification: `bunx tsc --noEmit && bun run lint && bun run test:run && bun run i18n:check`

**Checkpoint**: VMI module complete (2 pages) ⬜

---

### Phase 10K: Reports Module (4 pages, 0 migrated)

**Translation file**: `src/locales/th/reports.json`, `src/locales/en/reports.json`

#### TDD Red Phase

- [ ] T237 [TDD-R] Create i18n tests for Reports module in `tests/app/reports/i18n.test.tsx` covering all 4 pages. Tests MUST fail initially.

#### TDD Green Phase

- [ ] T238 [P] [TDD-G] Migrate `src/app/reports/page.tsx` to use i18n
- [ ] T239 [P] [TDD-G] Migrate `src/app/reports/new/page.tsx` to use i18n
- [ ] T240 [P] [TDD-G] Migrate `src/app/reports/design/[code]/page.tsx` to use i18n
- [ ] T241 [P] [TDD-G] Migrate `src/app/reports/view/[code]/page.tsx` to use i18n

#### TDD Verify Phase

- [ ] T242 [TDD-V] Reports Module verification: `bunx tsc --noEmit && bun run lint && bun run test:run && bun run i18n:check`

**Checkpoint**: Reports module complete (4 pages) ⬜

---

### Phase 10L: Settings Module (12 pages, 0 migrated)

**Translation file**: `src/locales/th/settings.json`, `src/locales/en/settings.json`

#### TDD Red Phase

- [ ] T243 [TDD-R] Create i18n tests for Settings module in `tests/app/settings/i18n.test.tsx` covering all 12 pages. Tests MUST fail initially.

#### TDD Green Phase

- [ ] T244 [P] [TDD-G] Migrate `src/app/settings/page.tsx` to use i18n
- [ ] T245 [P] [TDD-G] Migrate `src/app/settings/confidentiality/page.tsx` to use i18n
- [ ] T246 [P] [TDD-G] Migrate `src/app/settings/workflow-test/page.tsx` to use i18n

##### VMI Settings Sub-module (2 pages)

- [ ] T247 [P] [TDD-G] Migrate `src/app/settings/vmi/page.tsx` to use i18n
- [ ] T248 [P] [TDD-G] Migrate `src/app/settings/vmi/[id]/page.tsx` to use i18n

##### Approval Workflows Sub-module (4 pages)

- [ ] T249 [P] [TDD-G] Migrate `src/app/settings/approval-workflows/page.tsx` to use i18n
- [ ] T250 [P] [TDD-G] Migrate `src/app/settings/approval-workflows/new/page.tsx` to use i18n
- [ ] T251 [P] [TDD-G] Migrate `src/app/settings/approval-workflows/[id]/page.tsx` to use i18n
- [ ] T252 [P] [TDD-G] Migrate `src/app/settings/approval-workflows/[id]/history/page.tsx` to use i18n

##### Matching Tolerances Sub-module (3 pages)

- [ ] T253 [P] [TDD-G] Migrate `src/app/settings/matching-tolerances/page.tsx` to use i18n
- [ ] T254 [P] [TDD-G] Migrate `src/app/settings/matching-tolerances/new/page.tsx` to use i18n
- [ ] T255 [P] [TDD-G] Migrate `src/app/settings/matching-tolerances/[id]/page.tsx` to use i18n

#### TDD Verify Phase

- [ ] T256 [TDD-V] Settings Module verification: `bunx tsc --noEmit && bun run lint && bun run test:run && bun run i18n:check`

**Checkpoint**: Settings module complete (12 pages) ⬜

---

### Phase 10M: Master Data Module (16 pages, 0 migrated)

**Translation file**: Create `src/locales/th/master-data.json`, `src/locales/en/master-data.json`

#### TDD Red Phase

- [ ] T257 [TDD-R] Create translation files `src/locales/th/master-data.json` and `src/locales/en/master-data.json`
- [ ] T258 [TDD-R] Create i18n tests for Master Data module in `tests/app/master-data/i18n.test.tsx` covering all 16 pages. Tests MUST fail initially.

#### TDD Green Phase

- [ ] T259 [P] [TDD-G] Migrate `src/app/master-data/page.tsx` to use i18n

##### Environmental Conditions Sub-module (3 pages)

- [ ] T260 [P] [TDD-G] Migrate `src/app/master-data/environmental-conditions/page.tsx` to use i18n
- [ ] T261 [P] [TDD-G] Migrate `src/app/master-data/environmental-conditions/new/page.tsx` to use i18n
- [ ] T262 [P] [TDD-G] Migrate `src/app/master-data/environmental-conditions/[id]/page.tsx` to use i18n

##### Packaging QC Criteria Sub-module (3 pages)

- [ ] T263 [P] [TDD-G] Migrate `src/app/master-data/packaging-qc-criteria/page.tsx` to use i18n
- [ ] T264 [P] [TDD-G] Migrate `src/app/master-data/packaging-qc-criteria/new/page.tsx` to use i18n
- [ ] T265 [P] [TDD-G] Migrate `src/app/master-data/packaging-qc-criteria/[id]/page.tsx` to use i18n

##### Production Equipment Sub-module (3 pages)

- [ ] T266 [P] [TDD-G] Migrate `src/app/master-data/production-equipment/page.tsx` to use i18n
- [ ] T267 [P] [TDD-G] Migrate `src/app/master-data/production-equipment/new/page.tsx` to use i18n
- [ ] T268 [P] [TDD-G] Migrate `src/app/master-data/production-equipment/[id]/page.tsx` to use i18n

##### Production Rooms Sub-module (3 pages)

- [ ] T269 [P] [TDD-G] Migrate `src/app/master-data/production-rooms/page.tsx` to use i18n
- [ ] T270 [P] [TDD-G] Migrate `src/app/master-data/production-rooms/new/page.tsx` to use i18n
- [ ] T271 [P] [TDD-G] Migrate `src/app/master-data/production-rooms/[id]/page.tsx` to use i18n

##### SOP Templates Sub-module (3 pages)

- [ ] T272 [P] [TDD-G] Migrate `src/app/master-data/sop-templates/page.tsx` to use i18n
- [ ] T273 [P] [TDD-G] Migrate `src/app/master-data/sop-templates/new/page.tsx` to use i18n
- [ ] T274 [P] [TDD-G] Migrate `src/app/master-data/sop-templates/[id]/page.tsx` to use i18n

#### TDD Verify Phase

- [ ] T275 [TDD-V] Master Data Module verification: `bunx tsc --noEmit && bun run lint && bun run test:run && bun run i18n:check`

**Checkpoint**: Master Data module complete (16 pages) ⬜

---

### Phase 10N: Admin Module (2 pages, 0 migrated)

**Translation file**: Create `src/locales/th/admin.json`, `src/locales/en/admin.json`

#### TDD Red Phase

- [ ] T276 [TDD-R] Create translation files `src/locales/th/admin.json` and `src/locales/en/admin.json`
- [ ] T277 [TDD-R] Create i18n tests for Admin module in `tests/app/admin/i18n.test.tsx` covering all 2 pages. Tests MUST fail initially.

#### TDD Green Phase

- [ ] T278 [P] [TDD-G] Migrate `src/app/admin/confidential-groups/page.tsx` to use i18n
- [ ] T279 [P] [TDD-G] Migrate `src/app/admin/confidential-groups/[id]/members/page.tsx` to use i18n

#### TDD Verify Phase

- [ ] T280 [TDD-V] Admin Module verification: `bunx tsc --noEmit && bun run lint && bun run test:run && bun run i18n:check`

**Checkpoint**: Admin module complete (2 pages) ⬜

---

### Phase 10O: Dashboard Module (1 page remaining)

**Translation file**: `src/locales/th/dashboard.json`, `src/locales/en/dashboard.json`

#### TDD Red Phase

- [ ] T281 [TDD-R] Create i18n tests for Dashboard audit page in `tests/app/dashboard/audit-i18n.test.tsx`. Tests MUST fail initially. (Depends on T055 for keys)

#### TDD Green Phase

- [ ] T282 [P] [TDD-G] Migrate `src/app/dashboard/audit/page.tsx` to use i18n

#### TDD Verify Phase

- [ ] T283 [TDD-V] Dashboard Module verification: `bunx tsc --noEmit && bun run lint && bun run test:run && bun run i18n:check`

**Checkpoint**: Dashboard module complete ⬜

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup after all modules migrated

- [ ] T284 [TDD-V] Run full i18n validation: `bun run i18n:check` - fix any remaining missing keys
- [ ] T285 Performance testing: verify language switch under 500ms
- [ ] T286 Bundle size analysis: verify i18n overhead within 10% baseline
- [ ] T287 [TDD-V] Final quality gates: `bunx tsc --noEmit && bun run lint && bun run test:run`
- [ ] T288 Update documentation with final page count and coverage metrics

**Checkpoint**: Phase 11 complete - All polish tasks verified ⬜

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - ✅ COMPLETE
- **Foundational (Phase 2)**: ✅ COMPLETE
- **User Stories (Phase 3-8)**: ✅ COMPLETE
- **Fix Missing Keys (Phase 9)**: BLOCKS build - must complete first
- **Module Migration (Phase 10)**: Each module follows TDD: Test → Implement → Verify
- **Polish (Phase 11)**: Depends on all Phase 10 modules being complete

### TDD Execution Pattern (per Module)

```
1. [TDD-R] Write failing test for module (observe RED)
2. [TDD-G] Migrate pages in parallel (make tests GREEN)
3. [TDD-V] Verify all checks pass (REFACTOR if needed)
4. Commit after EACH task
```

### Recommended Execution Order

1. **Phase 9 (T053-T058)**: Fix missing keys to unblock build
2. **Phase 10A-10N (sequential per module, parallel within module)**:
   - Start with test task [TDD-R]
   - Run implementation tasks [TDD-G] in parallel
   - Complete verification task [TDD-V]
3. **Phase 11 (T284-T288)**: Final validation

---

## Task Summary

| Phase | Tasks | Status | TDD-R | TDD-G | TDD-V |
|-------|-------|--------|-------|-------|-------|
| Setup (1) | 5 | ✅ Complete | - | - | - |
| Foundational (2) | 16 | ✅ Complete | 1 | 14 | 1 |
| US1 - Language Switching (3) | 9 | ✅ Complete | 2 | 7 | - |
| US2 - Validation (4) | 5 | ✅ Complete | 1 | 4 | - |
| US3 - Persistence (5) | 5 | ✅ Complete | 1 | 4 | - |
| US4 - Fallback (6) | 4 | ✅ Complete | 1 | 3 | - |
| US5 - Developer Workflow (7) | 3 | ✅ Complete | - | 3 | - |
| US6 - Extensibility (8) | 4 | ✅ Complete | 1 | 3 | - |
| Fix Missing Keys (9) | 6 | ⬜ Pending | 1 | 4 | 1 |
| GMP Module (10A) | 38 | ⬜ Pending | 1 | 36 | 1 |
| Quality Module (10B) | 12 | ⬜ Pending | 1 | 10 | 1 |
| HR Module (10C) | 30 | ⬜ Pending | 1 | 28 | 1 |
| Accounting Module (10D) | 43 | ⬜ Pending | 1 | 41 | 1 |
| Production Module (10E) | 19 | ⬜ Pending | 1 | 17 | 1 |
| Inventory Module (10F) | 8 | ⬜ Pending | 1 | 6 | 1 |
| Purchasing Module (10G) | 9 | ⬜ Pending | 1 | 7 | 1 |
| Sales Module (10H) | 5 | ⬜ Pending | 1 | 3 | 1 |
| Cost Module (10I) | 10 | ⬜ Pending | 1 | 8 | 1 |
| VMI Module (10J) | 4 | ⬜ Pending | 1 | 2 | 1 |
| Reports Module (10K) | 6 | ⬜ Pending | 1 | 4 | 1 |
| Settings Module (10L) | 14 | ⬜ Pending | 1 | 12 | 1 |
| Master Data Module (10M) | 19 | ⬜ Pending | 2 | 16 | 1 |
| Admin Module (10N) | 5 | ⬜ Pending | 2 | 2 | 1 |
| Dashboard Remaining (10O) | 3 | ⬜ Pending | 1 | 1 | 1 |
| Polish (11) | 5 | ⬜ Pending | - | 3 | 2 |
| **Total** | **288** | **52 done, 236 pending** | **20** | **214** | **17** |

### Coverage Progress

| Metric | Current | Target |
|--------|---------|--------|
| Pages using i18n | 21/229 | 229/229 |
| Coverage % | 9.2% | 100% |
| Missing keys | 56 | 0 |
| Build status | ❌ Failing | ✅ Passing |

---

## Constitution Compliance Notes

This tasks.md now complies with Constitution v1.4.0:

1. **TDD Workflow (II.1)**: Each module follows Red-Green-Refactor with [TDD-R], [TDD-G], [TDD-V] labels
2. **Error Verification (I.7)**: Each module has a [TDD-V] verification task running `bunx tsc --noEmit && bun run lint && bun run test:run`
3. **Frequent Commits (I.8)**: Header notes "Commit after EACH task"
4. **Quality Gates**: All verification uses `bun`/`bunx` tooling per constitution table
5. **Test-First**: Test tasks precede implementation tasks in each phase

---

## Notes

- [P] tasks = different files, no dependencies - can run in parallel
- [TDD-R] = Write test first, observe failure (Red phase)
- [TDD-G] = Implement to make test pass (Green phase)
- [TDD-V] = Verify all checks pass (Refactor/Verify phase)
- Each module can be migrated independently
- All pages within a module can be migrated in parallel AFTER test is written
- **Commit after EACH task** - not just at checkpoints
- Run verification after each module to catch issues early
