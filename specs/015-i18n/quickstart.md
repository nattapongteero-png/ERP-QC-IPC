# Quickstart: Internationalization (i18n)

**Feature Branch**: `015-i18n`
**Estimated Setup Time**: 15 minutes

## Prerequisites

- Node.js 18+ / Bun 1.x
- Existing Herbal Medicine ERP codebase on branch `015-i18n`

## Quick Setup

### 1. Install Dependencies

```bash
bun add next-intl js-cookie
bun add -D @types/js-cookie eslint-plugin-i18n-json
```

### 2. Create Locale Configuration

```typescript
// src/lib/i18n/config.ts
export const locales = ['th', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'th';
export const fallbackLocale: Locale = 'th';

export const localeNames: Record<Locale, string> = {
  th: 'ไทย',
  en: 'English',
};
```

### 3. Create Translation Files

```bash
mkdir -p src/locales/th src/locales/en
```

**Thai (src/locales/th/common.json):**
```json
{
  "actions": {
    "save": "บันทึก",
    "cancel": "ยกเลิก"
  }
}
```

**English (src/locales/en/common.json):**
```json
{
  "actions": {
    "save": "Save",
    "cancel": "Cancel"
  }
}
```

### 4. Configure next-intl

```typescript
// src/lib/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, locales, type Locale } from './config';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('locale')?.value;

  const locale = (locales.includes(localeCookie as Locale)
    ? localeCookie
    : defaultLocale) as Locale;

  return {
    locale,
    messages: (await import(`@/locales/${locale}/common.json`)).default,
    timeZone: 'Asia/Bangkok',
  };
});
```

### 5. Update next.config.ts

```typescript
// next.config.ts
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const nextConfig = {
  // ... existing config
};

export default withNextIntl(nextConfig);
```

### 6. Wrap App with Provider

```typescript
// src/app/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';

export default async function RootLayout({ children }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

### 7. Use Translations in Components

```tsx
// Client Component
'use client';
import { useTranslations } from 'next-intl';

export function SaveButton() {
  const t = useTranslations('actions');

  return <button>{t('save')}</button>;
}
```

### 8. Add Language Switcher

```tsx
// src/components/shared/language-switcher.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import Cookies from 'js-cookie';
import { SelectBox } from 'devextreme-react/select-box';
import { locales, localeNames, type Locale } from '@/lib/i18n/config';

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();

  const handleChange = (e: { value: Locale }) => {
    Cookies.set('locale', e.value, { expires: 365 });
    router.refresh();
  };

  return (
    <SelectBox
      dataSource={locales.map(l => ({ value: l, label: localeNames[l] }))}
      valueExpr="value"
      displayExpr="label"
      value={locale}
      onValueChanged={handleChange}
      width={120}
      data-testid="language-switcher"
    />
  );
}
```

## Verification

### Test Language Switching

1. Start dev server: `bun dev`
2. Open http://localhost:33021
3. Click language selector
4. Verify all text updates without page reload

### Run Validation

```bash
# Check for TypeScript errors
bunx tsc --noEmit --skipLibCheck

# Run i18n validation (after setup)
bun run i18n:check
```

## Common Tasks

### Add New Translation Key

1. Add to Thai file first (primary locale):
   ```json
   // src/locales/th/common.json
   { "actions": { "newAction": "การดำเนินการใหม่" } }
   ```

2. Add to English file:
   ```json
   // src/locales/en/common.json
   { "actions": { "newAction": "New Action" } }
   ```

3. Use in component:
   ```tsx
   const t = useTranslations('actions');
   <button>{t('newAction')}</button>
   ```

### Add New Module Namespace

1. Create files:
   ```bash
   touch src/locales/th/mymodule.json
   touch src/locales/en/mymodule.json
   ```

2. Add to config:
   ```typescript
   // src/lib/i18n/config.ts
   export const namespaces = [..., 'mymodule'] as const;
   ```

3. Load in request.ts (or lazy load in page)

### Interpolate Variables

```json
{ "greeting": "สวัสดี, {name}!" }
```

```tsx
t('greeting', { name: 'John' }) // "สวัสดี, John!"
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "Missing message" warning | Key doesn't exist in locale file | Add key to all locale files |
| Language doesn't persist | Cookie not being set | Check js-cookie is installed, check browser dev tools |
| DevExtreme not translating | DevExtreme has own localization | Components use DevExtreme's loadMessages() |
| Type errors on t() | TypeScript cache | Restart TS server or run `bunx tsc --noEmit` |
| Thai fallback not working | Messages not merged properly | Check request.ts deepMerge logic |
| Key shows instead of translation | Wrong namespace | Verify namespace in useTranslations() |
| Console spam about missing keys | Dev warning for fallback | Add missing English translations |
| Page doesn't update on switch | Router not refreshing | Ensure router.refresh() called |

### Debug Checklist

1. **Translation not appearing?**
   - Check key exists in JSON file
   - Check namespace matches in useTranslations()
   - Check JSON syntax is valid
   - Restart dev server

2. **Language switch not working?**
   - Open browser dev tools > Application > Cookies
   - Look for `locale` cookie
   - Check LanguageSwitcher is using Cookies.set()
   - Verify router.refresh() is called

3. **Thai fallback not working?**
   - Verify Thai translation exists for the key
   - Check request.ts loads both locale messages
   - Check deepMerge merges Thai first, then current locale

4. **Getting console warnings?**
   - In development, warnings log when using Thai fallback
   - Add missing English translations to silence warnings
   - Warnings only appear in development mode

## Common Tasks

### Check Translation Coverage

```bash
# Run validation script
bun run i18n:check

# Expected output for success:
# ✓ All translation keys present in all locales
```

### Add Translations to Existing Module

1. Find the module's translation file (e.g., `src/locales/th/inventory.json`)
2. Add new keys to Thai file first:
   ```json
   {
     "existingSection": { ... },
     "newSection": {
       "title": "หัวข้อใหม่",
       "description": "คำอธิบาย"
     }
   }
   ```
3. Mirror structure in English file
4. Use in component: `t('newSection.title')`

### Use Interpolation (Variables)

```json
// Translation file
{
  "welcome": "Welcome, {name}!",
  "itemCount": "You have {count} items",
  "dateRange": "From {start} to {end}"
}
```

```tsx
// Component
t('welcome', { name: 'John' })  // "Welcome, John!"
t('itemCount', { count: 5 })    // "You have 5 items"
t('dateRange', { start: 'Jan 1', end: 'Jan 31' })
```

### Create Module-Specific Hook

```tsx
// For a new module, create a custom hook
import { useTranslations, useLocale } from 'next-intl';

export function useMyModuleTranslations() {
  const t = useTranslations('mymodule');
  const common = useTranslations('common');
  const locale = useLocale();

  return { t, common, locale };
}
```

## Next Steps

1. **For New Features**: Always add Thai translations first, then English
2. **For Existing Pages**: Gradually extract hardcoded strings to translation files
3. **For Testing**: Use `renderWithI18n()` helper from test utilities
4. **For CI/CD**: Add `bun run i18n:check` to build pipeline

## Related Documentation

- [i18n Developer Guide](/docs/i18n-developer-guide.md) - Comprehensive development guide
- [next-intl Docs](https://next-intl.dev/) - Official library documentation
- [research.md](./research.md) - Library selection rationale
- [data-model.md](./data-model.md) - Translation file schemas
- [contracts/](./contracts/) - TypeScript interfaces
