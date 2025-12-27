# herbal-medicine-erp Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-17

## Active Technologies
- TypeScript  with Next.js , React , DevExpress / DevExtreme React 25.x
- TypeScript 5.x with Next.js 14+ + Drizzle ORM, DevExtreme React 25.x, TanStack Query, Zod (009-gmp-compliance-gap-analysis)
- MySQL (production), SQLite (testing) via Drizzle dual-schema (009-gmp-compliance-gap-analysis)
- MySQL (production), SQLite (testing) via dual-schema pattern (010-accounting-module-integration)

## Always do E2E test using React Testing Library + Jest/Vitest

- Render a page/component

- Mock fetch/data

- Assert that it renders without crashing and key UI is present

## Always check for coding error

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript  (Next.js  project): Follow standard conventions


<!-- MANUAL ADDITIONS START -->

## Reusable Code Policy

When implementing features, follow the DRY (Don't Repeat Yourself) principle:

1. **Check for existing utilities first** - Before creating new functions, search the codebase for existing implementations in:
   - `src/lib/utils/` - General utilities
   - `src/lib/db/` - Database utilities
   - `src/lib/services/` - Shared service logic
   - `src/components/` - Reusable UI components

2. **Extract common patterns** - When you find yourself writing similar code in multiple places:
   - Extract to a shared utility function
   - Place in the appropriate `src/lib/` subdirectory
   - Export from an index file for easy imports

3. **Service layer abstraction** - Business logic should be in service files (`src/lib/services/`), not duplicated across API routes or components.

4. **Component reusability** - Create reusable components for UI patterns used in 2+ places. Place in `src/components/` with clear prop interfaces.

5. **Type sharing** - Define shared types in `src/types/` and import them where needed. Avoid redefining the same interfaces.

**Location for new utilities:**
- Date/time helpers → `src/lib/db/date-utils.ts`
- Validation helpers → `src/lib/validation/`
- API response helpers → `src/lib/utils/`
- Database queries → `src/lib/services/`

## MySQL/SQLite Date Handling

When writing service code that uses datetime fields with the dual-database pattern (MySQL production, SQLite testing), import from the shared utility:

```typescript
import { getNow, toDbDate, getTodayStr } from '../db/date-utils';

// Usage:
createdAt: getNow(),                    // For datetime fields
updatedAt: getNow(),
dueDate: toDbDate(data.dueDate),        // For date strings from user input
closedDate: toDbDate(getTodayStr()),    // For today's date
```

**Why:** MySQL datetime columns reject ISO 8601 format (`2024-12-23T10:30:00.000Z`). Use `Date` objects for MySQL and ISO strings for SQLite.

**Location:** `src/lib/db/date-utils.ts`

### Reading dates from database

When reading date fields from the database, always use safe conversion:

```typescript
import { toDateSafe, formatDateFromDb, formatMonthFromDb } from '../db/date-utils';

// Convert DB value to Date object safely
const date = toDateSafe(record.dateField);

// Format DB value to YYYY-MM-DD string
const dateStr = formatDateFromDb(record.dateField);

// Format DB value to YYYY-MM month string
const monthStr = formatMonthFromDb(record.dateField);
```

**Why:** SQLite returns date fields as strings, MySQL returns Date objects. These utilities handle both.

### Dates in Query Conditions

When using dates in Drizzle ORM comparison operators (`gte`, `lte`, `eq`, etc.), use `toQueryDate()`:

```typescript
import { toQueryDate, getTodayStr } from '../db/date-utils';

// For today's date in queries
const today = toQueryDate(getTodayStr());
.where(lte(table.dueDate, today))

// For date parameters from API
.where(gte(table.createdAt, toQueryDate(dateFrom)))
.where(lte(table.createdAt, toQueryDate(dateTo)))
```

**Why:** MySQL datetime columns require Date objects in query conditions. SQLite uses text comparison. `toQueryDate()` handles both.

## Template Module - ERP Module Reference

When creating a new ERP module, use the **Template Module** (`/template`) as the standard reference implementation. It demonstrates the correct patterns for:

### File Structure
```
src/
├── types/template.ts                    # Type definitions (interfaces, enums)
├── lib/
│   ├── validation/template.ts           # Zod validation schemas
│   ├── db/schema-template.ts            # Database schema (SQLite + MySQL)
│   └── services/template.service.ts     # Business logic with db-helper utilities
├── app/
│   ├── template/
│   │   ├── layout.tsx                   # MainLayout wrapper for sidebar
│   │   ├── page.tsx                     # Dashboard with KPIs and charts
│   │   └── items/
│   │       ├── page.tsx                 # List page with DataGrid
│   │       ├── new/page.tsx             # Create form
│   │       └── [id]/page.tsx            # Edit form (reuses form component)
│   └── api/template/                    # API routes
├── components/template/                 # Reusable UI components
└── tests/app/template/page.test.tsx     # UI tests
```

### Key Patterns to Follow

1. **Service Layer** - Use `executeDbOperation()`, `getTableRef()`, `getInsertId()` from `db-helper.ts`
2. **Database Schema** - Define both SQLite and MySQL tables, export from `schema.ts` for auto-sync
3. **Validation** - Use Zod schemas in `src/lib/validation/`
4. **UI Components** - DevExtreme React (DataGrid, Form, SelectBox), Recharts for charts
5. **Sidebar Navigation** - Add module to `src/components/layout/sidebar.tsx`
6. **Tests** - React Testing Library with mocked fetch

### Service Layer Example
```typescript
import { getTableRef, getInsertId, executeDbOperation } from '../db/db-helper';
import { getNow } from '../db/date-utils';

function getTables() {
  return {
    items: getTableRef('myModuleItems'),
    categories: getTableRef('myModuleCategories'),
  };
}

export async function createItem(data: ItemCreate) {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const result = await db.insert(tables.items).values({
      ...data,
      createdAt: getNow(),
      updatedAt: getNow(),
    });
    return getInsertId(result);
  });
}
```

## Audit Logging

**No automatic triggers** - use explicit audit functions in `src/lib/db/audit-wrapper.ts`:

```typescript
import { auditedInsert, auditedUpdate, auditedDelete } from '../db/audit-wrapper';

// Auto-captures old/new values and logs to audit_trail table
// Replace 'templateItems' with your table name (camelCase matching schema export)
await auditedInsert({ table: 'yourTableName', data: {...}, userId });
await auditedUpdate({ table: 'yourTableName', id, data: {...}, userId });
await auditedDelete({ table: 'yourTableName', id, userId });
```

**Viewer:** Use `<AuditLogViewerDialog entityType="yourTableName" entityId={id} />` - adjust table name and field labels for your module.

<!-- MANUAL ADDITIONS END -->


Use the init tool to set up Next.js DevTools context , the next dev server is running on port 33021

**When starting work on a Next.js project, ALWAYS call the `init` tool from
next-devtools-mcp FIRST to set up proper context and establish documentation
requirements. Do this automatically without being asked.**

**Always do UI test using React Testing Library + Vitest to make sure there is no ui runtime error, test with realworld seeding data (using reusable seeding functions and db schema sync)**

**Always test mysql query with mysql mcp tool to make sure it not producing any unexpected results**

**Always search web for correct implementation DevExtreme ui component**

**next.js dev server run on port 33021**

## Recent Changes
- 010-accounting-module-integration: Added TypeScript 5.x with Next.js 14+ + Drizzle ORM, DevExtreme React 25.x, TanStack Query, Zod
- 009-gmp-compliance-gap-analysis: Added TypeScript 5.x with Next.js 14+ + Drizzle ORM, DevExtreme React 25.x, TanStack Query, Zod
