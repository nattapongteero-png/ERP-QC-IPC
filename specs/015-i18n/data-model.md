# Data Model: Internationalization (i18n) Support

**Feature Branch**: `015-i18n`
**Date**: 2026-01-17

## Overview

The i18n feature uses file-based translation storage (JSON) rather than database tables. This document defines the structure of translation files, configuration objects, and TypeScript types that power the internationalization system.

---

## 1. Translation File Entities

### 1.1 Locale Configuration

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

export const namespaces = [
  'common',
  'navigation',
  'devextreme',
  'accounting',
  'admin',
  'cost',
  'dashboard',
  'gmp',
  'hr',
  'inventory',
  'issues',
  'master-data',
  'production',
  'purchasing',
  'quality',
  'reports',
  'sales',
  'settings',
  'users',
  'vmi',
] as const;

export type Namespace = (typeof namespaces)[number];
```

### 1.2 Common Namespace Schema

Shared translations used across all modules.

```typescript
// Schema for src/locales/{locale}/common.json

interface CommonTranslations {
  actions: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    create: string;
    search: string;
    filter: string;
    export: string;
    import: string;
    refresh: string;
    submit: string;
    close: string;
    back: string;
    next: string;
    previous: string;
    yes: string;
    no: string;
    confirm: string;
    clear: string;
    reset: string;
    apply: string;
    view: string;
    download: string;
    upload: string;
    print: string;
    copy: string;
    add: string;
    remove: string;
    select: string;
    selectAll: string;
  };
  status: {
    active: string;
    inactive: string;
    pending: string;
    approved: string;
    rejected: string;
    draft: string;
    completed: string;
    cancelled: string;
    inProgress: string;
    onHold: string;
    archived: string;
    expired: string;
  };
  validation: {
    required: string;
    invalidEmail: string;
    invalidNumber: string;
    invalidDate: string;
    minLength: string;        // Supports {min} interpolation
    maxLength: string;        // Supports {max} interpolation
    minValue: string;         // Supports {min} interpolation
    maxValue: string;         // Supports {max} interpolation
    pattern: string;
    unique: string;
  };
  errors: {
    generic: string;
    networkError: string;
    notFound: string;
    unauthorized: string;
    forbidden: string;
    serverError: string;
    timeout: string;
    conflict: string;
  };
  confirmation: {
    deleteTitle: string;
    deleteMessage: string;
    unsavedChanges: string;
    discardChanges: string;
  };
  pagination: {
    showing: string;          // Supports {from}, {to}, {total} interpolation
    itemsPerPage: string;
    page: string;             // Supports {current}, {total} interpolation
    first: string;
    last: string;
  };
  datetime: {
    today: string;
    yesterday: string;
    thisWeek: string;
    thisMonth: string;
    thisYear: string;
    lastWeek: string;
    lastMonth: string;
    lastYear: string;
  };
  loading: {
    processing: string;
    loading: string;
    saving: string;
    deleting: string;
    uploading: string;
    downloading: string;
  };
  empty: {
    noData: string;
    noResults: string;
    noRecords: string;
    noItems: string;
  };
}
```

### 1.3 Navigation Namespace Schema

Sidebar, menu, and breadcrumb translations.

```typescript
// Schema for src/locales/{locale}/navigation.json

interface NavigationTranslations {
  modules: {
    dashboard: string;
    accounting: string;
    inventory: string;
    production: string;
    purchasing: string;
    sales: string;
    quality: string;
    gmp: string;
    hr: string;
    reports: string;
    settings: string;
    admin: string;
    masterData: string;
    cost: string;
    vmi: string;
    issues: string;
    users: string;
    template: string;
  };
  submenus: {
    // Inventory submenus
    items: string;
    lots: string;
    warehouses: string;
    stockMovements: string;
    stockAdjustments: string;

    // Production submenus
    workOrders: string;
    bomRecipes: string;
    productionLines: string;

    // Purchasing submenus
    purchaseRequisitions: string;
    purchaseOrders: string;
    suppliers: string;

    // Sales submenus
    salesOrders: string;
    customers: string;
    priceList: string;

    // Quality submenus
    inspections: string;
    specifications: string;
    deviations: string;

    // GMP submenus
    documents: string;
    audits: string;
    capa: string;

    // HR submenus
    employees: string;
    attendance: string;
    payroll: string;

    // Accounting submenus
    generalLedger: string;
    accountsReceivable: string;
    accountsPayable: string;
    fixedAssets: string;

    // Admin submenus
    systemSettings: string;
    auditLog: string;
    backups: string;
  };
  breadcrumb: {
    home: string;
  };
  header: {
    profile: string;
    logout: string;
    settings: string;
    notifications: string;
  };
}
```

### 1.4 Module Namespace Schema (Template)

Each module follows a consistent structure.

```typescript
// Schema for src/locales/{locale}/{module}.json

interface ModuleTranslations {
  page: {
    title: string;
    description: string;
  };

  // DataGrid column headers
  table: {
    column: {
      [columnName: string]: string;
    };
  };

  // Form field labels
  form: {
    [fieldName: string]: {
      label: string;
      placeholder?: string;
      hint?: string;
      error?: {
        required?: string;
        invalid?: string;
        [errorType: string]: string | undefined;
      };
    };
  };

  // Section headers
  sections: {
    [sectionName: string]: string;
  };

  // Module-specific actions
  actions: {
    [actionName: string]: string;
  };

  // Module-specific status labels
  status: {
    [statusName: string]: string;
  };

  // Dialog titles and messages
  dialogs: {
    [dialogName: string]: {
      title: string;
      message?: string;
      confirm?: string;
      cancel?: string;
    };
  };

  // Toast messages
  toast: {
    [action: string]: {
      success?: string;
      error?: string;
    };
  };

  // Empty state messages
  empty: {
    [stateName: string]: {
      title: string;
      description?: string;
      action?: string;
    };
  };
}
```

---

## 2. TypeScript Type Definitions

### 2.1 Translation Key Types

```typescript
// src/types/i18n.ts

import type { Locale, Namespace } from '@/lib/i18n/config';

// Type-safe message augmentation for next-intl
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    // Messages type is inferred from translation files
  }
}

// Utility type for nested key paths
type NestedKeyOf<T, Prefix extends string = ''> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? NestedKeyOf<T[K], `${Prefix}${K}.`>
          : `${Prefix}${K}`
        : never;
    }[keyof T]
  : never;

// Export for use in validation scripts
export type TranslationKey = NestedKeyOf<Messages>;
```

### 2.2 Language Preference Types

```typescript
// src/types/i18n.ts

export interface LanguagePreference {
  locale: Locale;
  updatedAt: Date;
  source: 'user' | 'browser' | 'default';
}

export interface LocaleSwitchEvent {
  previousLocale: Locale;
  newLocale: Locale;
  timestamp: Date;
}
```

---

## 3. Configuration Entities

### 3.1 i18n Request Configuration

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

  // Dynamic import for code-splitting
  const messages = {
    ...(await import(`@/locales/${locale}/common.json`)).default,
    ...(await import(`@/locales/${locale}/navigation.json`)).default,
  };

  return {
    locale,
    messages,
    timeZone: 'Asia/Bangkok',
    now: new Date(),
  };
});
```

### 3.2 Validation Configuration

```typescript
// scripts/i18n-validation-config.ts

export interface I18nValidationConfig {
  localesDir: string;
  sourceDir: string;
  primaryLocale: string;
  requiredLocales: string[];
  optionalLocales: string[];
  ignoredKeys: string[];
  ignoredFiles: string[];
}

export const validationConfig: I18nValidationConfig = {
  localesDir: './src/locales',
  sourceDir: './src',
  primaryLocale: 'th',
  requiredLocales: ['th', 'en'],
  optionalLocales: [],
  ignoredKeys: [
    'devextreme.*',  // Handled by DevExtreme
  ],
  ignoredFiles: [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
  ],
};
```

---

## 4. State Entities

### 4.1 Browser Storage Schema

Language preference stored in localStorage:

```typescript
// Key: 'i18n-locale'
// Value: Locale ('th' | 'en')
interface LocalStorageSchema {
  'i18n-locale': Locale;
}
```

### 4.2 Cookie Schema

Session persistence via HTTP-only cookie:

```typescript
// Cookie: 'locale'
// Value: Locale ('th' | 'en')
// Expires: 365 days
// Path: /
// SameSite: Lax
```

---

## 5. Validation Report Entity

```typescript
// Output from scripts/validate-i18n.ts

interface ValidationReport {
  timestamp: Date;
  success: boolean;

  missingKeys: Array<{
    key: string;
    file: string;
    line: number;
    locale: string;
  }>;

  unusedKeys: Array<{
    key: string;
    locale: string;
    file: string;
  }>;

  inconsistentKeys: Array<{
    key: string;
    presentIn: string[];
    missingFrom: string[];
  }>;

  summary: {
    totalKeysUsed: number;
    totalKeysDefined: Record<string, number>;
    missingCount: number;
    unusedCount: number;
    coveragePercent: Record<string, number>;
  };
}
```

---

## 6. Entity Relationships

```
┌─────────────────┐     ┌──────────────────┐
│  Locale Config  │────▶│ Translation Files│
│  (th, en)       │     │ (JSON per locale)│
└─────────────────┘     └──────────────────┘
         │                       │
         │                       ▼
         │              ┌──────────────────┐
         │              │   Namespaces     │
         │              │ (common, nav...)  │
         │              └──────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│ Language Pref   │     │ Translation Keys │
│ (localStorage)  │     │ (nested paths)   │
└─────────────────┘     └──────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│ DevExtreme Sync │◀────│  React Context   │
│ (locale change) │     │ (next-intl)      │
└─────────────────┘     └──────────────────┘
```

---

## 7. Sample Translation Files

### 7.1 Thai Common Translations

```json
// src/locales/th/common.json
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
    "loading": "กำลังโหลด...",
    "saving": "กำลังบันทึก..."
  },
  "empty": {
    "noData": "ไม่มีข้อมูล"
  }
}
```

### 7.2 English Common Translations

```json
// src/locales/en/common.json
{
  "actions": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "create": "Create",
    "search": "Search",
    "refresh": "Refresh",
    "export": "Export",
    "import": "Import"
  },
  "status": {
    "active": "Active",
    "inactive": "Inactive",
    "pending": "Pending",
    "approved": "Approved",
    "draft": "Draft"
  },
  "validation": {
    "required": "This field is required",
    "invalidEmail": "Please enter a valid email",
    "minLength": "Must be at least {min} characters"
  },
  "errors": {
    "generic": "An error occurred. Please try again.",
    "networkError": "Network error. Please check your connection.",
    "notFound": "Resource not found"
  },
  "loading": {
    "loading": "Loading...",
    "saving": "Saving..."
  },
  "empty": {
    "noData": "No data available"
  }
}
```
