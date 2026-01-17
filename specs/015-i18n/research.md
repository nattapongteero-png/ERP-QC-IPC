# Research: Internationalization (i18n) Support

**Feature Branch**: `015-i18n`
**Date**: 2026-01-17

## Executive Summary

This document consolidates research findings for implementing i18n in the Herbal Medicine ERP application. Key decisions include using **next-intl** as the i18n library, **module-based namespace** organization for translations, and **build-time validation** with ESLint plugins and custom scripts.

---

## 1. i18n Library Selection

### Decision: **next-intl**

### Rationale

next-intl is the best fit for this Next.js 16 App Router project because:

1. **First-class App Router support** - Built specifically for Next.js Server/Client Components
2. **No URL prefix mode** - Supports `localePrefix: 'never'` with cookie-based locale storage
3. **Type-safe keys** - TypeScript augmentation provides autocomplete and compile-time validation
4. **ICU Message Format** - Powerful pluralization and interpolation
5. **Smaller bundle** - ~14KB gzipped vs ~22KB for react-i18next
6. **Build-time validation** - Works with @lingual/i18n-check

### Alternatives Considered

| Library | Pros | Cons | Verdict |
|---------|------|------|---------|
| **react-i18next** | Mature ecosystem, 3.9M downloads | Larger bundle (~22KB), more complex setup for App Router | ❌ Over-engineered for our needs |
| **next-i18n-router** | Lightweight (~5KB) | Only routing, no translation functionality | ❌ Incomplete solution |
| **typesafe-i18n** | Strongest type safety | Limited Next.js App Router support | ❌ Integration concerns |
| **LinguiJS** | Small bundle (~10KB) | Requires Babel macros | ❌ Build complexity |

### Integration with DevExtreme

DevExtreme has its own localization system (`loadMessages()`, `locale()`) which will continue to handle component UI strings. next-intl handles application-specific translations. Both systems coexist by syncing the locale value when switching languages.

---

## 2. Translation File Organization

### Decision: **Module-Based Namespaces**

### Rationale

With 229 pages across 18 modules, a single translation file per locale would contain ~1,000+ keys and become unmaintainable. Module-based namespaces provide:

- Team ownership of module-specific translations
- Reduced Git merge conflicts
- Manageable file sizes (~50-150 keys per file)
- Clear boundaries matching application structure

### File Structure

```
src/locales/
├── th/                     # Thai (default/fallback)
│   ├── common.json         # ~80 keys: buttons, errors, status, loading
│   ├── navigation.json     # ~40 keys: sidebar, menu, breadcrumbs
│   ├── devextreme.json     # ~50 keys: component overrides
│   ├── accounting.json     # ~60 keys: module-specific
│   ├── inventory.json      # ~80 keys: module-specific
│   └── ... (18 modules)
└── en/                     # English (mirror structure)
    └── ...
```

### Key Naming Convention

Pattern: `{section}.{element}.{descriptor}` using camelCase

| Pattern | Example | Use Case |
|---------|---------|----------|
| `page.title` | "Executive Dashboard" | Page titles |
| `page.description` | "Financial insights..." | Page subtitles |
| `form.{field}.label` | "Invoice Number" | Form field labels |
| `form.{field}.placeholder` | "Enter invoice..." | Placeholders |
| `form.{field}.error.required` | "Required" | Validation errors |
| `table.column.{name}` | "Amount" | DataGrid columns |
| `actions.{verb}` | "Save", "Cancel" | Action buttons |
| `status.{state}` | "Pending" | Status labels |
| `dialog.{name}.title` | "Confirm Delete" | Dialog titles |
| `toast.{action}.success` | "Created" | Toast messages |

### Common Namespace Structure

```json
{
  "actions": {
    "save": "บันทึก",
    "cancel": "ยกเลิก",
    "delete": "ลบ",
    "edit": "แก้ไข",
    "create": "สร้าง",
    "search": "ค้นหา",
    "refresh": "รีเฟรช",
    "export": "ส่งออก",
    "import": "นำเข้า"
  },
  "status": {
    "active": "ใช้งาน",
    "inactive": "ไม่ใช้งาน",
    "pending": "รอดำเนินการ",
    "approved": "อนุมัติแล้ว",
    "draft": "แบบร่าง"
  },
  "validation": {
    "required": "กรุณากรอกข้อมูล",
    "invalidEmail": "รูปแบบอีเมลไม่ถูกต้อง",
    "minLength": "ต้องมีอย่างน้อย {min} ตัวอักษร"
  },
  "errors": {
    "generic": "เกิดข้อผิดพลาด กรุณาลองใหม่",
    "networkError": "เครือข่ายขัดข้อง",
    "notFound": "ไม่พบข้อมูล"
  },
  "loading": {
    "processing": "กำลังดำเนินการ...",
    "loading": "กำลังโหลด..."
  },
  "empty": {
    "noData": "ไม่มีข้อมูล"
  }
}
```

---

## 3. Build-Time Validation Strategy

### Decision: **Multi-Layer Validation**

### Rationale

A single validation tool is insufficient. Combining multiple approaches provides comprehensive coverage:

1. **ESLint plugins** - Validate JSON structure and key consistency
2. **TypeScript augmentation** - Compile-time key validation
3. **Custom validation script** - Detect missing/unused keys with file locations
4. **CI integration** - Fail build on missing required translations

### Implementation Layers

#### Layer 1: ESLint Plugins

```bash
bun add -D eslint-plugin-i18n-json
```

Validates:
- `i18n-json/valid-json` - Valid JSON syntax
- `i18n-json/identical-keys` - All locales have same keys
- `i18n-json/sorted-keys` - Alphabetical order (optional)

#### Layer 2: TypeScript Augmentation

```typescript
// src/types/i18n.ts
import th from '@/locales/th/common.json';

declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof th;
  }
}
```

Provides IDE autocomplete and compile-time validation.

#### Layer 3: Custom Validation Script

```typescript
// scripts/validate-i18n.ts
// Extracts t('key') calls from codebase
// Compares against translation files
// Reports missing keys with file:line locations
// Exits with error code for CI
```

Key features:
- Regex-based extraction of translation keys from source
- Comparison against all required locales
- Report format: `src/app/accounting/page.tsx:42 - Missing key "kpi.title" in locale "en"`
- Configurable required vs optional locales

#### Layer 4: CI Integration

```yaml
# GitHub Actions
- name: Validate i18n
  run: |
    bun run lint:i18n
    bun run i18n:check
    bunx tsc --noEmit
```

### Optional Language Handling

For gradual rollout of additional languages:

```typescript
// i18n.config.ts
export const i18nConfig = {
  primaryLocale: 'th',
  requiredLocales: ['th', 'en'],  // Must have 100% coverage
  optionalLocales: ['zh'],         // Warnings only
};
```

---

## 4. DevExtreme Integration

### Decision: **Parallel Localization Systems**

### Rationale

DevExtreme maintains its own localization through `loadMessages()` API. Rather than replacing it, we sync the locale value and let each system handle its own domain:

- **DevExtreme**: DataGrid, DateBox, Form, Scheduler component strings
- **next-intl**: Application titles, labels, buttons, business logic text

### Implementation

```typescript
// src/lib/i18n/devextreme-sync.ts
import { locale as setDxLocale, loadMessages } from 'devextreme/localization';

export function syncDevExtremeLocale(locale: 'th' | 'en') {
  setDxLocale(locale);

  // Load custom overrides if needed
  if (locale === 'en') {
    // DevExtreme already defaults to English
    return;
  }

  // Thai messages already loaded in DevExtremeProvider
}
```

### Current DevExtreme Setup

The existing `src/localization/th.json` (203 entries) and `DevExtremeProvider` remain unchanged. The i18n system calls `syncDevExtremeLocale()` when language changes.

---

## 5. Incremental Migration Strategy

### Decision: **Phased Rollout by Module Priority**

### Rationale

Migrating ~1,000+ strings at once is risky. Phased approach allows:
- Early value delivery
- Regular commits per CLAUDE.md guidelines
- Testing at each phase
- Build validation enforcement grows incrementally

### Migration Phases

| Phase | Scope | Estimated Keys | Duration |
|-------|-------|----------------|----------|
| **1. Infrastructure** | i18n setup, providers, hooks | 0 | 1 day |
| **2. Common/Shared** | Buttons, errors, validation, status | ~100 | 1 day |
| **3. Navigation** | Sidebar, menu, breadcrumbs | ~40 | 0.5 day |
| **4. Dashboard** | High-visibility entry point | ~50 | 0.5 day |
| **5. High-Traffic Modules** | Accounting, Inventory, Production | ~200 | 2 days |
| **6. Remaining Modules** | All other modules | ~600 | 4 days |
| **7. Validation & Polish** | Full validation, cleanup | 0 | 1 day |

**Total Estimate**: ~10 days

### Migration Process per Module

1. Create translation files with extracted strings
2. Update pages/components to use `t()` hook
3. Add `data-testid` for E2E testing
4. Write unit tests verifying translations load
5. Run validation, fix any gaps
6. Commit with descriptive message

---

## 6. Performance Considerations

### Bundle Size Analysis

| Component | Size (gzipped) |
|-----------|----------------|
| next-intl | ~14 KB |
| All translation files | ~50 KB estimated |
| js-cookie | ~1 KB |
| **Total overhead** | **~65 KB** |

Acceptable within the 500KB bundle budget per Constitution.

### Language Switch Performance

- No network request (translations bundled)
- React context update triggers re-render
- Target: <500ms per spec requirement
- DevExtreme locale sync is synchronous

### Optimization Opportunities (Future)

- Namespace lazy loading with `useMessages()` granularity
- Translation file code-splitting by module
- Server-side locale detection for faster initial render

---

## 7. Testing Strategy

### Unit Tests

```typescript
// tests/lib/i18n/use-translations.test.ts
import { renderHook } from '@testing-library/react';
import { useModuleTranslations } from '@/lib/i18n';

describe('useModuleTranslations', () => {
  it('returns translated text for valid key', () => {
    const { result } = renderHook(() => useModuleTranslations('common'));
    expect(result.current.t('actions.save')).toBe('บันทึก');
  });

  it('falls back to Thai for missing English key', () => {
    // Set locale to 'en', remove key from en/common.json
    expect(result.current.t('actions.save')).toBe('บันทึก');
  });
});
```

### Integration Tests

```typescript
// tests/components/shared/language-switcher.test.tsx
describe('LanguageSwitcher', () => {
  it('switches language without page reload', async () => {
    render(<TestApp><LanguageSwitcher /></TestApp>);

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByText('English'));

    expect(screen.getByTestId('page-title')).toHaveTextContent('Dashboard');
  });
});
```

### E2E Considerations

Per CLAUDE.md, add `data-testid` attributes to translated elements:
```tsx
<h1 data-testid="page-title">{t('page.title')}</h1>
```

---

## Sources

- [next-intl Documentation](https://next-intl.dev/)
- [next-intl TypeScript Augmentation](https://next-intl.dev/docs/workflows/typescript)
- [next-intl Without i18n Routing](https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing)
- [eslint-plugin-i18n-json](https://github.com/godaddy/eslint-plugin-i18n-json)
- [i18n-check by Lingual](https://lingual.dev/i18n-check/)
- [DevExtreme React Localization](https://js.devexpress.com/React/Documentation/Guide/Common/Localization/)
- [i18n Key Naming Best Practices](https://www.locize.com/blog/guide-to-i18n-key-naming/)
- [Scaling i18n in Large Codebases](https://medium.com/picus-security-engineering/scaling-localization-our-i18n-strategy-599788d9d68b)
