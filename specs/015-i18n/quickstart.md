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

| Issue | Solution |
|-------|----------|
| "Missing message" warning | Add key to all locale files |
| Language doesn't persist | Check cookie settings, ensure `js-cookie` installed |
| DevExtreme not translating | Verify `syncDevExtremeLocale()` called on change |
| Type errors on t() | Regenerate types after adding keys |

## Next Steps

1. Migrate high-priority pages (Dashboard, Sidebar)
2. Extract strings from module pages incrementally
3. Run `i18n:check` in CI pipeline
4. Add remaining module namespaces

## Related Documentation

- [next-intl Docs](https://next-intl.dev/)
- [research.md](./research.md) - Library selection rationale
- [data-model.md](./data-model.md) - Translation file schemas
- [contracts/](./contracts/) - TypeScript interfaces
