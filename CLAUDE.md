# herbal-medicine-erp Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-17

## Active Technologies
- TypeScript 5.x with Next.js 15, React 19 + Tailwind CSS v4, Lucide React (icons), React Query (002-ui-redesign)
- N/A (UI-only changes, no data model modifications) (002-ui-redesign)
- TypeScript 5.x with React 19, Next.js 15 (App Router) + shadcn/ui, Radix UI primitives, Tailwind CSS v4, Lucide React (icons), React Query v5 (003-shadcn-migration)
- N/A (UI-only changes, existing MySQL/SQLite backends unchanged) (003-shadcn-migration)
- TypeScript 5.x with React 19, Next.js 15 (App Router) + DevExtreme React 25.1.x, devextreme-themebuilder 25.1.x, Zod 4.2.x (existing) (004-devextreme-migration)
- N/A (no database changes - UI-only migration) (004-devextreme-migration)

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
- 004-devextreme-migration: Added TypeScript 5.x with React 19, Next.js 15 (App Router) + DevExtreme React 25.1.x, devextreme-themebuilder 25.1.x, Zod 4.2.x (existing)
- 003-shadcn-migration: Added TypeScript 5.x with React 19, Next.js 15 (App Router) + shadcn/ui, Radix UI primitives, Tailwind CSS v4, Lucide React (icons), React Query v5
- 002-ui-redesign: Added TypeScript 5.x with Next.js 15, React 19 + Tailwind CSS v4, Lucide React (icons), React Query


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
