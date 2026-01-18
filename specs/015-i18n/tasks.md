# Tasks: Internationalization (i18n) Support

**Input**: Design documents from `/specs/015-i18n/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Unit tests included per CLAUDE.md requirement for UI testing with React Testing Library + Vitest.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

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

- [ ] T042 [P] [US4] Create unit test for fallback behavior in `tests/lib/i18n/fallback.test.ts`

### Implementation for User Story 4

- [ ] T043 [US4] Configure next-intl fallback in `src/lib/i18n/request.ts` to use Thai messages when English key missing
- [ ] T044 [US4] Add development-mode console warning for missing translations in `src/lib/i18n/use-translations.ts`
- [ ] T045 [US4] Test fallback by temporarily removing English key and verifying Thai appears

**Checkpoint**: User Story 4 complete - Thai fallback works for missing English translations

---

## Phase 7: User Story 5 - Developer-Friendly Translation Workflow (Priority: P3)

**Goal**: Developers have clear documentation and tooling for adding new translations

**Independent Test**: Follow documentation to add a new translation key, verify it appears correctly in both languages

### Implementation for User Story 5

- [ ] T046 [P] [US5] Create module translation files for high-traffic modules:
  - `src/locales/th/inventory.json` and `src/locales/en/inventory.json`
  - `src/locales/th/production.json` and `src/locales/en/production.json`
  - `src/locales/th/accounting.json` and `src/locales/en/accounting.json`
- [ ] T047 [US5] Create developer guide for i18n in `docs/i18n-developer-guide.md` covering key naming, file organization, validation
- [ ] T048 [US5] Update quickstart.md with common tasks and troubleshooting

**Checkpoint**: User Story 5 complete - Developers have clear workflow for translations

---

## Phase 8: User Story 6 - Extend to Additional Languages (Priority: P3)

**Goal**: System supports adding new languages by adding translation files and registering locale

**Independent Test**: Add stub files for a third language (e.g., Chinese), verify it appears in selector and fallback works

### Tests for User Story 6

- [ ] T049 [P] [US6] Create integration test for adding new language in `tests/integration/i18n-extensibility.test.ts`

### Implementation for User Story 6

- [ ] T050 [US6] Document process for adding new languages in `docs/i18n-developer-guide.md`
- [ ] T051 [US6] Add configuration option for required vs optional locales in validation script `scripts/validate-i18n.ts`
- [ ] T052 [US6] Test extensibility by adding stub Chinese locale files and verifying registration

**Checkpoint**: User Story 6 complete - New languages can be added without code changes

---

## Phase 9: Module Translation Migration (Incremental)

**Purpose**: Migrate remaining modules to use i18n (can be done incrementally after MVP)

### High-Priority Modules

- [ ] T053 [P] Create translations and update Inventory module pages in `src/app/inventory/`
- [ ] T054 [P] Create translations and update Production module pages in `src/app/production/`
- [ ] T055 [P] Create translations and update Purchasing module pages in `src/app/purchasing/`
- [ ] T056 [P] Create translations and update Sales module pages in `src/app/sales/`

### Medium-Priority Modules

- [ ] T057 [P] Create translations and update Quality module pages in `src/app/quality/`
- [ ] T058 [P] Create translations and update GMP module pages in `src/app/gmp/`
- [ ] T059 [P] Create translations and update Accounting module pages in `src/app/accounting/`
- [ ] T060 [P] Create translations and update HR module pages in `src/app/hr/`

### Lower-Priority Modules

- [ ] T061 [P] Create translations and update Cost module pages in `src/app/cost/`
- [ ] T062 [P] Create translations and update VMI module pages in `src/app/vmi/`
- [ ] T063 [P] Create translations and update Reports module pages in `src/app/reports/`
- [ ] T064 [P] Create translations and update Admin/Settings module pages

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T065 Run full i18n validation and fix any remaining missing keys
- [ ] T066 Performance testing: verify language switch under 500ms
- [ ] T067 Bundle size analysis: verify i18n overhead within 10% baseline
- [ ] T068 [P] Update CLAUDE.md with i18n technology stack
- [ ] T069 Run quickstart.md validation to ensure setup guide works
- [ ] T070 Final type checking with `bunx tsc --noEmit --skipLibCheck`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
- **Module Migration (Phase 9)**: Can proceed in parallel after US1 complete
- **Polish (Phase 10)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Independent of US1
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Uses LanguageSwitcher from US1
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Independent
- **User Story 5 (P3)**: Can start after US1 and US2 - Builds on infrastructure
- **User Story 6 (P3)**: Can start after US4 - Builds on fallback mechanism

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Configuration before components
- Components before page integration
- Core implementation before integration testing
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational translation file tasks (T011-T014) can run in parallel
- Once Foundational phase completes, US1 and US2 can start in parallel (both P1)
- Module migration tasks (T053-T064) can all run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: Foundational Phase

```bash
# Launch all base translation files together:
Task: "Create Thai common translations in src/locales/th/common.json"
Task: "Create English common translations in src/locales/en/common.json"
Task: "Create Thai navigation translations in src/locales/th/navigation.json"
Task: "Create English navigation translations in src/locales/en/navigation.json"
```

## Parallel Example: Module Migration

```bash
# Launch all module migrations together:
Task: "Create translations and update Inventory module pages"
Task: "Create translations and update Production module pages"
Task: "Create translations and update Purchasing module pages"
Task: "Create translations and update Sales module pages"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (5 tasks)
2. Complete Phase 2: Foundational (16 tasks)
3. Complete Phase 3: User Story 1 - Language Switching (9 tasks)
4. Complete Phase 4: User Story 2 - Validation (5 tasks)
5. **STOP and VALIDATE**: Test language switching on Dashboard + validation works
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy (Language switching MVP!)
3. Add User Story 2 → Test independently → Deploy (Validation enabled)
4. Add User Story 3 → Test independently → Deploy (Persistence)
5. Add User Story 4 → Test independently → Deploy (Fallback)
6. Add User Stories 5-6 → Developer experience complete
7. Migrate modules incrementally (Phase 9)

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Language Switching)
   - Developer B: User Story 2 (Validation)
3. After US1 complete:
   - Developer A: User Story 3 (Persistence)
   - Developer B: User Story 4 (Fallback)
4. Module migration can be distributed across team

---

## Task Summary

| Phase | Tasks | Parallel Opportunities |
|-------|-------|------------------------|
| Setup | 5 | 3 parallel |
| Foundational | 16 | 5 parallel |
| US1 - Language Switching | 9 | 3 parallel |
| US2 - Validation | 5 | 1 parallel |
| US3 - Persistence | 5 | 1 parallel |
| US4 - Fallback | 4 | 1 parallel |
| US5 - Developer Workflow | 3 | 1 parallel |
| US6 - Extensibility | 4 | 1 parallel |
| Module Migration | 12 | 12 parallel |
| Polish | 6 | 1 parallel |
| **Total** | **70** | **29 parallel** |

### MVP Scope (Recommended)

**Phase 1-4**: 35 tasks → Language switching + validation working on Dashboard/Sidebar

### Full Feature Scope

**Phase 1-10**: 70 tasks → Complete i18n across all modules

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group per CLAUDE.md
- Stop at any checkpoint to validate story independently
- Module migration (Phase 9) can be done incrementally over time
