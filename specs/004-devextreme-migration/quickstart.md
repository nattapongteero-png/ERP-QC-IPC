# DevExtreme Migration Quick Start Guide

**Feature Branch**: `004-devextreme-migration`
**Date**: 2025-12-19

## Prerequisites

- Node.js 18+
- pnpm 8+
- DevExtreme license key (provided)

## Installation

```bash
# Install DevExtreme dependencies
npm install devextreme@25.1 devextreme-react@25.1 --save-exact
npm install devextreme-themebuilder@25.1 --save-dev --save-exact

# Verify installation
npm ls devextreme devextreme-react
```

## Theme Setup

### 1. Create Theme Configuration

Create `devextreme-theme/emerald-metadata.json`:

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

### 2. Build Theme

```bash
npx devextreme build-theme \
  --input-file=devextreme-theme/emerald-metadata.json \
  --output-file=public/css/dx.material.emerald.css
```

### 3. Update globals.css

Add at the end of `src/app/globals.css`:

```css
/* DevExtreme theme - import AFTER Tailwind */
@import "../../public/css/dx.material.emerald.css";

/* DevExtreme focus state override for accessibility */
.dx-state-focused {
  outline: 2px solid oklch(0.596 0.145 163.225) !important;
  outline-offset: 2px !important;
}
```

## DevExtreme Provider Setup

### 1. Create Provider

Create `src/components/providers/devextreme-provider.tsx`:

```typescript
"use client";

import { useEffect } from 'react';
import { locale, loadMessages } from "devextreme/localization";

// Thai translations (create this file separately)
import thMessages from '@/localization/th.json';

export function DevExtremeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Load Thai messages
    loadMessages(thMessages);

    // Set locale to Thai
    locale('th');
  }, []);

  return <>{children}</>;
}
```

### 2. Update Root Layout

Update `src/app/layout.tsx`:

```typescript
import { DevExtremeProvider } from '@/components/providers/devextreme-provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <DevExtremeProvider>
          {/* existing providers */}
          {children}
        </DevExtremeProvider>
      </body>
    </html>
  );
}
```

## License Configuration

Create `src/lib/devextreme-license.ts`:

```typescript
import { licenseKey } from 'devextreme/viz/core/utils';

// Set license key on app initialization
export function configureLicense() {
  licenseKey('YOUR_LICENSE_KEY_HERE');
}
```

Call `configureLicense()` in your root layout or DevExtreme provider.

## Zod Validation Adapter

Create `src/lib/validation/zod-devextreme-adapter.ts`:

```typescript
import { z } from 'zod';
import type { ValidationCallbackData } from 'devextreme/ui/validation_rules';

/**
 * Creates a DevExtreme validation callback from a Zod schema
 */
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

/**
 * Creates a required field validator
 */
export function zodRequiredCallback(message: string = 'This field is required') {
  return zodValidationCallback(z.string().min(1), { customMessage: message });
}

/**
 * Creates an email validator
 */
export function zodEmailCallback(message: string = 'Invalid email address') {
  return zodValidationCallback(z.string().email(), { customMessage: message });
}
```

## Component Migration Pattern

### Basic Component Wrapper

```typescript
"use client";

import DataGrid, { Column, Paging, Sorting, FilterRow } from 'devextreme-react/data-grid';
import type { DataGridProps } from 'devextreme-react/data-grid';

interface DxDataGridProps extends Partial<DataGridProps> {
  data: any[];
  columns: Array<{
    field: string;
    header: string;
    width?: number;
  }>;
}

export function DxDataGrid({ data, columns, ...props }: DxDataGridProps) {
  return (
    <DataGrid
      dataSource={data}
      showBorders={true}
      columnAutoWidth={true}
      allowColumnResizing={true}
      {...props}
    >
      <Paging defaultPageSize={20} />
      <Sorting mode="multiple" />
      <FilterRow visible={true} />

      {columns.map((col) => (
        <Column
          key={col.field}
          dataField={col.field}
          caption={col.header}
          width={col.width}
        />
      ))}
    </DataGrid>
  );
}
```

### Form with Zod Validation

```typescript
"use client";

import { Form, SimpleItem } from 'devextreme-react/form';
import { Validator, CustomRule } from 'devextreme-react/validator';
import { zodValidationCallback } from '@/lib/validation/zod-devextreme-adapter';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
});

export function MyForm() {
  return (
    <Form>
      <SimpleItem dataField="name" editorType="dxTextBox">
        <Validator>
          <CustomRule
            validationCallback={zodValidationCallback(schema.shape.name)}
          />
        </Validator>
      </SimpleItem>

      <SimpleItem dataField="email" editorType="dxTextBox">
        <Validator>
          <CustomRule
            validationCallback={zodValidationCallback(schema.shape.email)}
          />
        </Validator>
      </SimpleItem>
    </Form>
  );
}
```

## Import Patterns (Bundle Optimization)

```typescript
// WRONG - imports entire DevExtreme bundle (~3MB)
import { DataGrid, Button, TextBox } from 'devextreme-react';

// CORRECT - imports only what you need
import DataGrid from 'devextreme-react/data-grid';
import Button from 'devextreme-react/button';
import TextBox from 'devextreme-react/text-box';
```

## Lazy Loading Heavy Components

```typescript
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const DataGrid = dynamic(
  () => import('devextreme-react/data-grid'),
  {
    loading: () => <Skeleton className="h-96 w-full" />,
    ssr: false
  }
);
```

## Thai Locale File Structure

Create `src/localization/th.json`:

```json
{
  "th": {
    "Yes": "ใช่",
    "No": "ไม่",
    "Cancel": "ยกเลิก",
    "Done": "เสร็จสิ้น",
    "Loading": "กำลังโหลด...",
    "Select": "เลือก",
    "Search": "ค้นหา",
    "dxDataGrid-noDataText": "ไม่มีข้อมูล",
    "dxDataGrid-editingDeleteRow": "ลบ",
    "dxDataGrid-editingUndeleteRow": "กู้คืน",
    "dxDataGrid-editingConfirmDeleteMessage": "คุณแน่ใจหรือว่าต้องการลบรายการนี้?",
    "dxPager-page": "หน้า",
    "dxPager-pagesCountText": "จาก",
    "dxPager-itemsPerPage": "รายการต่อหน้า",
    "validation-required": "จำเป็น",
    "validation-email": "อีเมลไม่ถูกต้อง"
  }
}
```

## Verification Commands

```bash
# Type check
pnpm tsc --noEmit

# Lint
pnpm lint

# Run tests
pnpm test:run

# Build
pnpm build

# Bundle analysis (optional)
ANALYZE=true pnpm build
```

## Common Issues & Solutions

### Issue: Tailwind styles overridden by DevExtreme

**Solution**: Ensure DevExtreme CSS is imported AFTER Tailwind, use `!important` when needed:
```typescript
<DataGrid className="!bg-white !rounded-lg" />
```

### Issue: SSR errors with DevExtreme

**Solution**: Use `'use client'` directive on all DevExtreme components:
```typescript
"use client";
import DataGrid from 'devextreme-react/data-grid';
```

### Issue: Theme not applying

**Solution**: Verify theme CSS is built and imported:
```bash
# Rebuild theme
npm run build:theme

# Check file exists
ls -la public/css/dx.material.emerald.css
```

### Issue: Thai dates not formatting correctly

**Solution**: Ensure locale is set before components render:
```typescript
import { locale } from 'devextreme/localization';
locale('th'); // Must be called before any DevExtreme component
```
