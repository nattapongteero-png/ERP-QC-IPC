# Research: DevExtreme UI Migration

**Feature Branch**: `004-devextreme-migration`
**Date**: 2025-12-19
**Spec**: [spec.md](./spec.md)

## Research Questions Addressed

1. DevExtreme compatibility with React 19 and Next.js 15
2. DevExtreme theming and emerald color customization
3. Thai language/locale support
4. Zod validation integration
5. Bundle size optimization

---

## 1. DevExtreme + React 19 + Next.js 15 Compatibility

### Decision
**DevExtreme v25.1.x is compatible with React 19 and Next.js 15, but with important limitations.**

### Key Findings

**React 19 Support:**
- DevExtreme v25.1.x officially supports React 19 (`"^16.2.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"`)
- Tested and confirmed working as of v24.2 release
- **Security Note**: Must use React 19.0.3+ and Next.js 15.0.7+ for critical RSC vulnerability patches (CVE-2025-55182, CVE-2025-55184, CVE-2025-67779)

**Next.js 15 App Router Limitations:**
- DevExtreme components are **client-side only** - require `'use client'` directive
- Cannot be used as React Server Components
- DataSource instances must be created on client only
- Components render empty divs if JavaScript is disabled

### Rationale
DevExtreme provides enterprise-grade components that work with React 19, and the client-side limitation is acceptable for an ERP system where JavaScript is required for functionality.

### Alternatives Considered
| Alternative | Rejected Because |
|-------------|------------------|
| Continue with current Radix UI + Tailwind | Lacks enterprise data grid, export, and advanced filtering features needed for ERP |
| ag-Grid | More expensive licensing, less comprehensive component library |
| MUI DataGrid | Premium features require separate licensing, not as feature-rich as DevExtreme |

---

## 2. DevExtreme Theming (Emerald Color)

### Decision
**Use DevExtreme ThemeBuilder CLI to generate custom emerald theme from Material base theme.**

### Implementation

**Theme Metadata** (`devextreme-theme/emerald-metadata.json`):
```json
{
  "items": [
    { "key": "$base-accent", "value": "#059669" },
    { "key": "$base-text-color", "value": "rgba(23, 23, 23, 0.87)" },
    { "key": "$base-bg", "value": "#ffffff" },
    { "key": "$base-border-color", "value": "#e5e5e5" },
    { "key": "$button-success-bg", "value": "#059669" },
    { "key": "$link-color", "value": "#059669" }
  ],
  "baseTheme": "material.blue.light",
  "outputColorScheme": "emerald",
  "version": "25.1.7",
  "assetsBasePath": "../node_modules/devextreme/dist/css/"
}
```

**Build Script**:
```bash
npx devextreme build-theme --input-file=devextreme-theme/emerald-metadata.json --output-file=public/css/dx.material.emerald.css
```

**Tailwind Integration:**
- Import DevExtreme CSS **after** Tailwind in `globals.css`
- Use `!important` prefix on Tailwind utilities when needed to override DevExtreme
- Optionally remove `dx-theme-material-typography` class from body if conflicts occur

### Rationale
ThemeBuilder CLI is the official, supported method for theme customization. It provides full control over colors while maintaining compatibility with DevExtreme version upgrades.

### Alternatives Considered
| Alternative | Rejected Because |
|-------------|------------------|
| Predefined themes | No emerald color scheme available |
| SCSS variables | Internal structure undocumented, may break on updates |
| CSS variables | Not fully supported by DevExtreme yet (feature requested) |

---

## 3. Thai Language Support

### Decision
**Use Intl API for date formatting + create custom Thai message dictionary.**

### Implementation

**Thai Locale Setup:**
```typescript
// src/localization/devextreme-provider.tsx
"use client";

import { useEffect } from 'react';
import { locale, loadMessages } from "devextreme/localization";
import thMessages from '@/localization/th.json';

export function DevExtremeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    loadMessages(thMessages);
    locale('th');
  }, []);

  return <>{children}</>;
}
```

**Key Facts:**
- DevExtreme does NOT have built-in Thai locale dictionary
- Only 4 official locales: English, German, Russian, Japanese
- Intl API automatically provides Thai month/date formatting when locale is set to `'th'`
- UI messages (button labels, validation, etc.) require custom dictionary

**Required Artifact:**
- Create `/src/localization/th.json` by translating strings from DevExtreme's default dictionary
- Approximately 100-200 strings to translate

### Rationale
The Intl API approach requires minimal setup for date formatting (which is the core requirement from FR-003). Custom dictionary is needed only for UI labels.

### Alternatives Considered
| Alternative | Rejected Because |
|-------------|------------------|
| Globalize + CLDR data | Larger bundle size, more complex setup, Intl is simpler |
| Community Thai dictionary | None available, must create custom |

---

## 4. Zod Validation Integration

### Decision
**Create custom Zod-DevExtreme adapter using CustomRule validation callbacks.**

### Implementation

**Zod Adapter** (`src/lib/validation/zod-devextreme-adapter.ts`):
```typescript
import { z } from 'zod';
import type { ValidationCallbackData } from 'devextreme/ui/validation_rules';

export function zodValidationCallback<T extends z.ZodTypeAny>(
  zodSchema: T,
  options?: { customMessage?: string }
) {
  return (e: ValidationCallbackData): boolean => {
    const result = zodSchema.safeParse(e.value);

    if (!result.success) {
      e.rule.message = result.error.errors[0]?.message || options?.customMessage || 'Invalid value';
      return false;
    }

    return true;
  };
}
```

**Usage Example:**
```typescript
<TextBox>
  <Validator>
    <CustomRule
      validationCallback={zodValidationCallback(
        z.string().email(),
        { customMessage: 'Please enter a valid email address' }
      )}
    />
  </Validator>
</TextBox>
```

### Rationale
No official Zod integration exists for DevExtreme. Custom adapter pattern is lightweight and allows reuse of existing Zod schemas from the codebase.

### Alternatives Considered
| Alternative | Rejected Because |
|-------------|------------------|
| Abandon Zod, use DevExtreme rules only | Would require rewriting all existing validation schemas |
| Use React Hook Form as intermediate | Adds unnecessary complexity, DevExtreme has its own form management |

---

## 5. Bundle Size Optimization

### Decision
**Use module-specific imports and lazy loading for DevExtreme components.**

### Key Metrics

**DevExtreme Bundle Size:**
- Full bundle (import from main): ~3MB
- Chart components alone: ~637KB
- Optimal tree-shaking can reduce significantly

**Optimization Strategies:**
1. Import from specific modules:
   ```typescript
   // BAD - imports ALL widgets
   import { DataGrid } from 'devextreme-react';

   // GOOD - imports only DataGrid
   import DataGrid from 'devextreme-react/data-grid';
   ```

2. Use dynamic imports for heavy components:
   ```typescript
   const DataGrid = dynamic(() => import('devextreme-react/data-grid'), {
     loading: () => <Skeleton />,
     ssr: false
   });
   ```

3. Analyze bundle with webpack-bundle-analyzer

### Constitution Compliance
- **NFR-002** requires bundle size increase to be documented
- **IV. Performance Requirements** specifies frontend bundle < 500KB gzipped
- DevExtreme will significantly exceed this limit - requires justification

### Justification
The bundle size increase is justified by:
1. Enterprise features (data grid, export, filtering) not available in current stack
2. Reduction in custom code for complex UI patterns
3. Components are lazy-loaded, not loaded on initial page
4. Critical ERP workflows (inventory, sales) require these features

---

## Installation Requirements

### Dependencies to Add
```bash
npm install devextreme@25.1 devextreme-react@25.1 --save-exact
npm install devextreme-themebuilder@25.1 --save-dev --save-exact
```

### Package.json Scripts
```json
{
  "scripts": {
    "build:theme": "devextreme build-theme --input-file=devextreme-theme/emerald-metadata.json --output-file=public/css/dx.material.emerald.css",
    "prebuild": "npm run build:theme"
  }
}
```

### Configuration Files Required
1. `devextreme-theme/emerald-metadata.json` - Theme configuration
2. `src/localization/th.json` - Thai translations
3. `src/lib/validation/zod-devextreme-adapter.ts` - Validation adapter

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bundle size exceeds 500KB limit | HIGH | Lazy loading, code splitting, document justification |
| React 19 security vulnerabilities | CRITICAL | Use React 19.0.3+ and Next.js 15.0.7+ |
| Thai translation incomplete | MEDIUM | Start with critical UI strings, add progressively |
| Tailwind CSS conflicts | MEDIUM | Import order, scoped selectors, !important overrides |
| Zod integration complexity | LOW | Documented adapter pattern, similar to existing validation |

---

## Sources

- [DevExtreme React Documentation](https://js.devexpress.com/React/Documentation/)
- [DevExtreme Supported Versions](https://js.devexpress.com/React/Documentation/Guide/React_Components/Supported_Versions/)
- [DevExtreme Next.js Integration](https://js.devexpress.com/React/Documentation/Guide/Common/Integration_Guides/Create_a_DevExtreme_application_with_Next.js/)
- [DevExtreme ThemeBuilder](https://devexpress.github.io/ThemeBuilder/)
- [DevExtreme Localization](https://js.devexpress.com/React/Documentation/Guide/Common/Localization/)
- [React Security Update December 2025](https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components)
