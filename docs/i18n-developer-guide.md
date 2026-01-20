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

This section explains how to extend the i18n system with additional languages (e.g., Chinese, Japanese).

### Step 1: Create Locale Directory and Files

```bash
# Create directory for new locale (e.g., Chinese)
mkdir -p src/locales/zh

# Copy Thai files as templates
cp src/locales/th/common.json src/locales/zh/
cp src/locales/th/navigation.json src/locales/zh/
# ... copy other namespace files as needed
```

### Step 2: Register the Locale

Update `src/lib/i18n/config.ts`:

```typescript
// Add to locales array
export const locales = ['th', 'en', 'zh'] as const;

// Add display name
export const localeNames: Record<Locale, string> = {
  th: 'ไทย',
  en: 'English',
  zh: '中文',
};
```

### Step 3: Configure as Optional (Recommended for Gradual Rollout)

Update `scripts/validate-i18n.ts` to mark the new locale as optional:

```typescript
const CONFIG = {
  // ... existing config
  requiredLocales: ['th', 'en'] as const,
  optionalLocales: ['zh'] as const,  // Add new locale here
};
```

This allows partial translation coverage during rollout:
- **Required locales** (th, en): Missing translations cause validation to FAIL
- **Optional locales** (zh): Missing translations show as WARNINGS only

### Step 4: Update Message Loading

Update `src/lib/i18n/request.ts` to load the new locale's messages:

```typescript
export default getRequestConfig(async () => {
  // ... existing locale detection ...

  // Load fallback (Thai) messages first
  const fallbackMessages = await loadMessages('th');

  // Load current locale messages
  const localeMessages = locale !== 'th'
    ? await loadMessages(locale)
    : {};

  // Merge: fallback first, then current locale (current takes precedence)
  const messages = deepMerge(fallbackMessages, localeMessages);

  return { locale, messages, timeZone: 'Asia/Bangkok' };
});
```

### Step 5: Translate Files

Translate the copied JSON files in `src/locales/zh/`:

```json
// src/locales/zh/common.json
{
  "actions": {
    "save": "保存",
    "cancel": "取消",
    // ... translate all keys
  }
}
```

**Important:** Only translate keys that you've verified. Missing keys will automatically fall back to Thai text.

### Step 6: Verify

```bash
# Run validation (optional locale will show warnings, not errors)
bun run i18n:check

# Test in browser
# 1. Start dev server: bun dev
# 2. Use language selector to switch to new language
# 3. Verify translations appear, missing keys show Thai fallback
```

### Promotion from Optional to Required

Once the new locale has 100% translation coverage:

1. Move from `optionalLocales` to `requiredLocales` in `validate-i18n.ts`
2. Run `bun run i18n:check` to verify no missing translations
3. Commit the change

### Language Selector

The language selector automatically includes all registered locales from `config.ts`. No additional changes needed - the new language will appear in the dropdown.

## Best Practices

1. **Add Thai first**: Thai is the primary/fallback locale
2. **Use meaningful keys**: `page.title` not `t1` or `header`
3. **Group by feature**: Keep related translations together
4. **Run validation**: Check translations before committing
5. **Test with both locales**: Switch languages during development
6. **Avoid hardcoded text**: Extract all user-facing strings
7. **Document new namespaces**: Update this guide when adding modules
