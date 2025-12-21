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
- 008-vmi-vendor-sync: Added TypeScript 5.x with Next.js 15+ (App Router) + Next.js 16.0.10, React 19.2.1, Drizzle ORM 0.45.1, DevExtreme React 25.1.7, TanStack Query 5.90.12, Zod 4.2.1
- 007-hr-personnel-management: Added TypeScript 5.x with Next.js 15 (App Router), React 19 + Drizzle ORM, DevExtreme React 25.1.x, Zod 4.2.x, TanStack Query 5.x, jsonwebtoken (existing)
- 006-vmi-vendor-integration: Added TypeScript 5.x with Next.js 15 (App Router) + React 19, Drizzle ORM, DevExtreme React 25.1.x, Zod 4.2.x, TanStack Query 5.x


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
