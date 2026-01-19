# i18n Developer Guide

This guide explains how to work with internationalization (i18n) in the Herbal Medicine ERP application.

## Overview

The application uses [next-intl](https://next-intl.dev/) for internationalization with:
- **Thai (th)** as the default and fallback language
- **English (en)** as a secondary language
- Cookie-based locale persistence
- Module-based namespace organization

## Quick Reference

### Using Translations in Components

```tsx
'use client';

import { useTranslations } from 'next-intl';

export function MyComponent() {
  const t = useTranslations('common');

  return (
    <button>{t('actions.save')}</button>
  );
}
```

### Available Hooks

| Hook | Use Case |
|------|----------|
| `useTranslations(namespace)` | Access translations from a specific namespace |
| `useCommonTranslations()` | Access common namespace with dev warnings |
| `useNavigationTranslations()` | Access navigation namespace |
| `useDashboardTranslations()` | Access dashboard namespace |
| `useModuleTranslations(ns)` | Access module + common namespaces |
| `useCurrentLocale()` | Get current locale ('th' or 'en') |

## File Organization

### Directory Structure

```
src/locales/
├── th/                         # Thai (default/fallback)
│   ├── common.json             # Shared translations
│   ├── navigation.json         # Sidebar, menu, header
│   ├── dashboard.json          # Dashboard module
│   ├── inventory.json          # Inventory module
│   ├── production.json         # Production module
│   ├── accounting.json         # Accounting module
│   └── ...                     # Other modules
└── en/                         # English (mirror structure)
    ├── common.json
    ├── navigation.json
    └── ...
```

### Namespace Convention

| Namespace | Contents | Example Keys |
|-----------|----------|--------------|
| `common` | Shared actions, status, validation, errors | `actions.save`, `status.active` |
| `navigation` | Sidebar, menu, header, breadcrumbs | `modules.inventory`, `header.logout` |
| `dashboard` | Dashboard page translations | `title`, `kpis.totalItems.label` |
| `inventory` | Inventory module translations | `items.title`, `lots.status.available` |
| `production` | Production module translations | `workOrders.status.inProgress` |
| `accounting` | Accounting module translations | `generalLedger.title` |

## Adding New Translations

### Step 1: Add Thai Key First

Thai is the primary locale. Always add keys to Thai files first:

```json
// src/locales/th/inventory.json
{
  "newFeature": {
    "title": "ฟีเจอร์ใหม่",
    "description": "คำอธิบายฟีเจอร์"
  }
}
```

### Step 2: Add English Translation

Mirror the structure in the English file:

```json
// src/locales/en/inventory.json
{
  "newFeature": {
    "title": "New Feature",
    "description": "Feature description"
  }
}
```

### Step 3: Use in Component

```tsx
import { useTranslations } from 'next-intl';

function NewFeature() {
  const t = useTranslations('inventory');

  return (
    <div>
      <h1>{t('newFeature.title')}</h1>
      <p>{t('newFeature.description')}</p>
    </div>
  );
}
```

## Key Naming Convention

Use `{section}.{element}.{descriptor}` pattern with camelCase:

| Pattern | Example | Use Case |
|---------|---------|----------|
| `page.title` | `"Dashboard"` | Page titles |
| `page.description` | `"Overview..."` | Page subtitles |
| `form.{field}.label` | `"Item Name"` | Form labels |
| `form.{field}.placeholder` | `"Enter..."` | Placeholders |
| `form.{field}.error.required` | `"Required"` | Validation errors |
| `table.columns.{name}` | `"Status"` | DataGrid columns |
| `actions.{verb}` | `"Save"` | Action buttons |
| `status.{state}` | `"Active"` | Status labels |
| `toast.{action}.success` | `"Created"` | Toast messages |
| `empty.{state}.title` | `"No data"` | Empty states |

## Interpolation

Pass variables to translations:

```json
// common.json
{
  "pagination": {
    "showing": "Showing {from} to {to} of {total} entries"
  },
  "validation": {
    "minLength": "Must be at least {min} characters"
  }
}
```

```tsx
// Component
t('pagination.showing', { from: 1, to: 10, total: 100 })
// → "Showing 1 to 10 of 100 entries"

t('validation.minLength', { min: 5 })
// → "Must be at least 5 characters"
```

## Thai Fallback Behavior

When an English translation is missing, the system automatically falls back to Thai:

```json
// th/dashboard.json
{ "newKpi": { "label": "ตัวชี้วัดใหม่" } }

// en/dashboard.json
{ /* newKpi is missing */ }
```

```tsx
// When locale is 'en':
t('newKpi.label')  // Returns: "ตัวชี้วัดใหม่" (Thai fallback)
```

In development mode, a console warning is logged:
```
[i18n] Missing "en" translation for "dashboard.newKpi.label", using Thai fallback
```

## Validation

### Running Validation

```bash
# Check for missing translations
bun run i18n:check

# Run as part of build
bun run build  # Includes i18n validation
```

### ESLint Integration

The project includes `eslint-plugin-i18n-json` for:
- Valid JSON syntax
- Key consistency across locales
- No duplicate keys

## Common Patterns

### DataGrid Columns

```tsx
const t = useTranslations('inventory');

const columns = [
  { dataField: 'itemCode', caption: t('items.table.columns.itemCode') },
  { dataField: 'name', caption: t('items.table.columns.name') },
  { dataField: 'status', caption: t('items.table.columns.status') },
];
```

### Form Fields

```tsx
const t = useTranslations('inventory');

<TextBox
  label={t('items.form.name.label')}
  placeholder={t('items.form.name.placeholder')}
/>
```

### Empty States

```tsx
const t = useTranslations('inventory');

{data.length === 0 && (
  <EmptyState
    title={t('items.empty.title')}
    description={t('items.empty.description')}
    action={t('items.empty.action')}
  />
)}
```

### Toast Messages

```tsx
const t = useTranslations('inventory');

toast.success(t('items.toast.create.success'));
toast.error(t('items.toast.create.error'));
```

## Adding a New Module Namespace

### Step 1: Create Translation Files

```bash
touch src/locales/th/newmodule.json
touch src/locales/en/newmodule.json
```

### Step 2: Add to Namespace Config

```typescript
// src/lib/i18n/config.ts
export const namespaces = [
  'common',
  'navigation',
  // ... existing namespaces
  'newmodule',  // Add new namespace
] as const;
```

### Step 3: Load in Request Config (if needed globally)

For module-specific namespaces, load them on demand in the page:

```tsx
// src/app/newmodule/page.tsx
import { getTranslations } from 'next-intl/server';

export default async function NewModulePage() {
  const t = await getTranslations('newmodule');
  // ...
}
```

## Testing Translations

### Unit Test Helper

```tsx
import { renderWithI18n } from '@/tests/helpers/i18n-test-wrapper';

it('renders translated text', () => {
  const { getByText } = renderWithI18n(<MyComponent />);
  expect(getByText('Save')).toBeInTheDocument();
});
```

### Custom Messages in Tests

```tsx
import { renderWithI18n, createMockMessages } from '@/tests/helpers/i18n-test-wrapper';

const customMessages = createMockMessages('inventory', {
  items: { title: 'Test Items' },
});

renderWithI18n(<ItemsPage />, { messages: customMessages });
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Missing translation warning | Add key to all locale files |
| Key shows instead of translation | Check namespace in `useTranslations()` |
| Language doesn't persist | Check cookie settings, ensure js-cookie installed |
| DevExtreme not translating | Components have their own localization |
| Type errors on t() | Restart TypeScript server |

### Debug Mode

Enable verbose logging in development:

```typescript
// The i18n system logs warnings for missing keys in dev mode
// Check browser console for: [i18n] Missing translation...
```

## Related Files

| File | Purpose |
|------|---------|
| `src/lib/i18n/config.ts` | Locale configuration |
| `src/lib/i18n/request.ts` | Server-side message loading |
| `src/lib/i18n/use-translations.ts` | Custom hooks with dev warnings |
| `src/lib/i18n/locale-persistence.ts` | Cookie/localStorage handling |
| `src/components/shared/language-switcher.tsx` | UI selector |
| `tests/helpers/i18n-test-wrapper.tsx` | Test utilities |
| `scripts/validate-i18n.ts` | Validation script |

## Adding a New Language

The system is designed to support adding new languages without code changes (beyond configuration).

### Step 1: Create Translation Files

```bash
# Create directory for new locale (e.g., Chinese)
mkdir -p src/locales/zh

# Copy structure from Thai (primary locale)
cp src/locales/th/common.json src/locales/zh/common.json
cp src/locales/th/navigation.json src/locales/zh/navigation.json
# ... copy other namespaces as needed
```

### Step 2: Update Locale Configuration

```typescript
// src/lib/i18n/config.ts

// Add to locales array
export const locales = ['th', 'en', 'zh'] as const;
export type Locale = (typeof locales)[number];

// Add display name
export const localeNames: Record<Locale, string> = {
  th: 'ไทย',
  en: 'English',
  zh: '中文',  // Add new language
};

// Add flag (optional)
export const localeFlags: Record<Locale, string> = {
  th: '🇹🇭',
  en: '🇬🇧',
  zh: '🇨🇳',  // Add new language flag
};
```

### Step 3: Update Request Configuration

```typescript
// src/lib/i18n/request.ts

// The request config will automatically pick up the new locale
// if it's in the locales array and has translation files

// For fallback support, ensure Thai messages are loaded for new locale
if (locale !== 'th') {
  // Load Thai fallback messages
  // ... existing fallback logic works automatically
}
```

### Step 4: Translate Files

Replace Thai text with the new language translations:

```json
// src/locales/zh/common.json
{
  "actions": {
    "save": "保存",
    "cancel": "取消",
    "delete": "删除"
  }
}
```

### Step 5: Configure Validation (Optional)

For gradual rollout, configure as optional locale:

```typescript
// scripts/validate-i18n.ts or validation config
export const validationConfig = {
  requiredLocales: ['th', 'en'],   // Must have 100% coverage
  optionalLocales: ['zh'],          // Warnings only, not errors
};
```

### Fallback Behavior for New Languages

When adding a new language, you don't need to translate everything immediately:

1. **Missing keys fallback to Thai** - Users see Thai text instead of raw keys
2. **Console warnings in dev mode** - Developers see which keys need translation
3. **Gradual coverage is OK** - Start with critical UI, add more over time

### Testing New Language

```tsx
// Test that new locale works
import { renderWithI18n } from '@/tests/helpers/i18n-test-wrapper';

it('should render Chinese translation', () => {
  const { getByText } = renderWithI18n(<MyComponent />, { locale: 'zh' });
  expect(getByText('保存')).toBeInTheDocument();
});
```

## Best Practices

1. **Add Thai first**: Thai is the primary/fallback locale
2. **Use meaningful keys**: `page.title` not `t1` or `header`
3. **Group by feature**: Keep related translations together
4. **Run validation**: Check translations before committing
5. **Test with both locales**: Switch languages during development
6. **Avoid hardcoded text**: Extract all user-facing strings
7. **Document new namespaces**: Update this guide when adding modules
8. **Start small with new languages**: Begin with common/navigation, expand gradually
