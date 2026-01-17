# Implementation Plan: Internationalization (i18n) Support

**Branch**: `015-i18n` | **Date**: 2026-01-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-i18n/spec.md`

## Summary

Implement full internationalization (i18n) support for the Herbal Medicine ERP with Thai as the default/fallback language and English as a secondary option. The solution uses **next-intl** for client-side language switching without page reloads, organized translation files by module namespace, and build-time validation to ensure complete translation coverage across ~1,000+ strings in 229 pages.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 16.0.10 + React 19.2.1
**Primary Dependencies**: next-intl (i18n), DevExtreme React 25.2.3 (UI components), js-cookie (persistence)
**Storage**: Browser localStorage for preference, optional user profile sync
**Testing**: Vitest + React Testing Library (existing setup)
**Target Platform**: Web application (desktop, tablet, iPad landscape priority)
**Project Type**: Web (Next.js App Router)
**Performance Goals**: Language switch under 500ms, initial load within 10% of baseline
**Constraints**: No URL locale prefixes, client-side switching only, Thai fallback required
**Scale/Scope**: 229 pages, 226 components, ~1,000+ translation strings, 18 modules

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Code Quality Standards** | | |
| Type Safety | ✅ PASS | TypeScript with next-intl type augmentation for type-safe keys |
| Linting Compliance | ✅ PASS | ESLint i18n plugin for JSON validation |
| Single Responsibility | ✅ PASS | Translation logic isolated in i18n module, provider pattern |
| No Hardcoded Values | ✅ PASS | All UI strings externalized to translation files |
| Error Verification | ✅ PASS | Build-time validation catches missing translations |
| Frequent Commits | ✅ PASS | Incremental migration allows regular commits |
| Reusable Components | ✅ PASS | LanguageSwitcher as shared component in `src/components/shared/` |
| **II. Testing Standards** | | |
| Test Coverage | ✅ PASS | Unit tests for translation hook, integration tests for language switching |
| Unit Test Isolation | ✅ PASS | Mock translation provider for tests |
| **III. User Experience Consistency** | | |
| Responsive Design | ✅ PASS | Language selector adapts to viewport size |
| Loading States | ✅ PASS | No loading required (translations bundled) |
| Error Feedback | ✅ PASS | Thai fallback for missing keys, console warnings in dev |
| DevExtreme Components | ✅ PASS | DevExtreme SelectBox for language selector |
| **IV. Performance Requirements** | | |
| Page Load | ✅ PASS | Translations bundled, no runtime fetch |
| Bundle Size | ✅ PASS | next-intl ~14KB gzipped, translations ~50KB estimated |
| **V. Security and GMP Compliance** | | |
| Audit Trail | N/A | Language preference not auditable |
| Data Integrity | ✅ PASS | Read-only translation files |

**Gate Status**: ✅ PASS - No violations requiring justification

## Project Structure

### Documentation (this feature)

```text
specs/015-i18n/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── locales/                          # Translation files
│   ├── th/                           # Thai (default/fallback)
│   │   ├── common.json               # Shared: buttons, errors, status, loading
│   │   ├── navigation.json           # Sidebar, menu, breadcrumbs
│   │   ├── devextreme.json           # DevExtreme component overrides
│   │   ├── accounting.json           # Module-specific translations
│   │   ├── admin.json
│   │   ├── cost.json
│   │   ├── dashboard.json
│   │   ├── gmp.json
│   │   ├── hr.json
│   │   ├── inventory.json
│   │   ├── issues.json
│   │   ├── master-data.json
│   │   ├── production.json
│   │   ├── purchasing.json
│   │   ├── quality.json
│   │   ├── reports.json
│   │   ├── sales.json
│   │   ├── settings.json
│   │   ├── users.json
│   │   └── vmi.json
│   └── en/                           # English (mirror structure)
│       ├── common.json
│       ├── navigation.json
│       └── ...
│
├── lib/
│   └── i18n/
│       ├── index.ts                  # Export i18n utilities
│       ├── config.ts                 # Locale config, namespaces
│       ├── request.ts                # getRequestConfig for next-intl
│       ├── use-translations.ts       # Custom hook wrappers
│       └── devextreme-sync.ts        # Sync locale to DevExtreme
│
├── components/
│   ├── shared/
│   │   └── language-switcher.tsx     # Reusable language selector
│   └── providers/
│       ├── i18n-provider.tsx         # next-intl provider wrapper
│       └── devextreme-provider.tsx   # (existing, updated for i18n)
│
├── types/
│   └── i18n.ts                       # TypeScript augmentation for type-safe keys
│
└── app/
    └── layout.tsx                    # (updated to wrap with I18nProvider)

scripts/
└── validate-i18n.ts                  # Build-time translation validation

tests/
├── lib/i18n/                         # Unit tests for i18n utilities
└── components/shared/                # Tests for LanguageSwitcher
```

**Structure Decision**: Module-based namespace structure with translations organized by feature domain. This enables:
- Team ownership of module-specific translations
- Reduced merge conflicts
- Lazy loading potential for future optimization
- Clear file boundaries (~50-150 keys per file)

## Constitution Check (Post-Design Re-evaluation)

*Re-evaluated after Phase 1 design completion.*

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| **I. Code Quality Standards** | | |
| Type Safety | ✅ PASS | Contracts defined in `contracts/i18n-provider-contract.ts` |
| Linting Compliance | ✅ PASS | JSON schema in `contracts/translation-schema.json` |
| Reusable Components | ✅ PASS | LanguageSwitcher defined with clear interface |
| **II. Testing Standards** | | |
| Test Coverage | ✅ PASS | Test contracts defined with mock helpers |
| **III. User Experience** | | |
| DevExtreme Components | ✅ PASS | SelectBox used in LanguageSwitcher design |
| **IV. Performance** | | |
| Bundle Size | ✅ PASS | Namespace lazy loading designed for optimization |

**Post-Design Gate Status**: ✅ PASS - Design aligns with constitution principles

## Complexity Tracking

> No violations requiring justification - all gates pass.

## Generated Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Research | `research.md` | Library selection, file organization, validation strategy |
| Data Model | `data-model.md` | Translation schemas, TypeScript types, configuration |
| Contracts | `contracts/translation-schema.json` | JSON Schema for translation validation |
| Contracts | `contracts/i18n-provider-contract.ts` | TypeScript interfaces for implementation |
| Quickstart | `quickstart.md` | Developer setup guide |

## Next Steps

Run `/speckit.tasks` to generate the implementation task list based on this plan.
