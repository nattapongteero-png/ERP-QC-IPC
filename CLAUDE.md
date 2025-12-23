# herbal-medicine-erp Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-17

## Active Technologies
- TypeScript 5.x with Next.js 15, React 19 + Tailwind CSS v4, Lucide React (icons), React Query (002-ui-redesign)
- N/A (UI-only changes, no data model modifications) (002-ui-redesign)
- TypeScript 5.x with React 19, Next.js 15 (App Router) + shadcn/ui, Radix UI primitives, Tailwind CSS v4, Lucide React (icons), React Query v5 (003-shadcn-migration)
- N/A (UI-only changes, existing MySQL/SQLite backends unchanged) (003-shadcn-migration)
- TypeScript 5.x with React 19, Next.js 15 (App Router) + DevExtreme React 25.1.x, devextreme-themebuilder 25.1.x, Zod 4.2.x (existing) (004-devextreme-migration)
- N/A (no database changes - UI-only migration) (004-devextreme-migration)
- TypeScript 5.x (Next.js 15 frontend) + C# / .NET 8.0 (ASP.NET Core backend) (005-devexpress-reports)
- MySQL (existing ERP database) - new tables for report templates, categories, permissions (005-devexpress-reports)
- TypeScript 5.x with Next.js 15 (App Router) + React 19, Drizzle ORM, DevExtreme React 25.1.x, Zod 4.2.x, TanStack Query 5.x (006-vmi-vendor-integration)
- MySQL (production), SQLite (testing) via Drizzle ORM (006-vmi-vendor-integration)
- TypeScript 5.x with Next.js 15 (App Router), React 19 + Drizzle ORM, DevExtreme React 25.1.x, Zod 4.2.x, TanStack Query 5.x, jsonwebtoken (existing) (007-hr-personnel-management)
- MySQL (production), SQLite (testing) via Drizzle ORM - extends existing dual-schema pattern (007-hr-personnel-management)
- TypeScript 5.x with Next.js 15+ (App Router) + Next.js 16.0.10, React 19.2.1, Drizzle ORM 0.45.1, DevExtreme React 25.1.7, TanStack Query 5.90.12, Zod 4.2.1 (008-vmi-vendor-sync)
- MySQL 8.0 (production), SQLite (testing) via Drizzle ORM dual-schema pattern (008-vmi-vendor-sync)
- TypeScript 5.x with strict mode enabled + Next.js 16.0.10, React 19.2.1, DevExtreme React 25.1.7, Drizzle ORM 0.45.1, TanStack Query 5.90.12, Zod 4.2.1 (009-gmp-compliance-gap-analysis)
- TypeScript 5.x with strict mode enabled + Next.js 16.0.10, React 19.2.1, Drizzle ORM 0.45.1, better-sqlite3 12.5.0 (009-gmp-compliance-gap-analysis)

- TypeScript 5.x (Next.js 15 project) + Next.js 15, React 19, Drizzle ORM, Tailwind CSS (001-reorganize-src-structure)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x (Next.js 15 project): Follow standard conventions

## Recent Changes
- 009-gmp-compliance-gap-analysis: Added TypeScript 5.x with strict mode enabled + Next.js 16.0.10, React 19.2.1, Drizzle ORM 0.45.1, better-sqlite3 12.5.0
- 009-gmp-compliance-gap-analysis: Added TypeScript 5.x with strict mode enabled + Next.js 16.0.10, React 19.2.1, DevExtreme React 25.1.7, Drizzle ORM 0.45.1, TanStack Query 5.90.12, Zod 4.2.1
- 008-vmi-vendor-sync: Added TypeScript 5.x with Next.js 15+ (App Router) + Next.js 16.0.10, React 19.2.1, Drizzle ORM 0.45.1, DevExtreme React 25.1.7, TanStack Query 5.90.12, Zod 4.2.1


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

<!-- MANUAL ADDITIONS END -->
