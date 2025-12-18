# Research Document: shadcn/ui Migration

**Feature Branch**: `003-shadcn-migration`
**Date**: 2025-12-18

## 1. shadcn/ui + Tailwind CSS v4 Compatibility

### Decision
**Proceed with shadcn/ui + Tailwind CSS v4 + Next.js 15** - Full compatibility confirmed.

### Rationale
1. **Official Support**: shadcn/ui officially supports Tailwind CSS v4 as of early 2025
2. **Non-Breaking Upgrade**: The v4 compatibility is a non-breaking change
3. **Modern Stack**: Aligns with project's tech choices (React 19, Next.js 15)
4. **Performance**: Tailwind v4's CSS-first approach is more efficient
5. **Future-Proof**: Eliminates technical debt and enables easier maintenance

### Alternatives Considered

| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| Stay with Tailwind CSS v3 | Wider browser support | Missing modern CSS features, not aligned with Next.js 15 | ❌ Rejected |
| Material-UI / Chakra UI | Different design philosophy | Larger bundle, different API, less Tailwind integration | ❌ Rejected |
| Hybrid v3/v4 approach | Gradual migration | Style inconsistencies, maintenance burden | ❌ Rejected |

### Installation Steps

#### Option A: Using shadcn/ui Canary CLI (Recommended)
```bash
npx shadcn@canary init
```

#### Option B: Manual Setup
1. Dependencies already present: `tailwindcss@4`, `@tailwindcss/postcss@4`
2. PostCSS config: Already uses `@tailwindcss/postcss`
3. CSS imports: Already using `@import "tailwindcss"`
4. Install components: `npx shadcn@canary add button card input select badge table skeleton`

### Breaking Changes from Tailwind v3 to v4

| Category | v3 | v4 (Current) |
|----------|----|----|
| Import | `@tailwind base; @tailwind components;` | `@import "tailwindcss";` |
| PostCSS | `tailwindcss` | `@tailwindcss/postcss` |
| Shadows | `shadow-sm` | `shadow-xs` |
| Ring Width | `ring ring-blue-500` | `ring-3 ring-blue-500` |
| Outline | `outline-none` | `outline-hidden` |
| CSS Variables | `bg-[--brand-color]` | `bg-(--brand-color)` |

### Browser Support Requirements
- Safari 16.4+
- Chrome 111+
- Firefox 128+

---

## 2. Theme Customization for Emerald/Teal Brand Colors

### Decision
**Enhance existing emerald implementation** - The project already uses emerald effectively via OKLch color format.

### Rationale
1. **Already Implemented**: Current codebase uses emerald palette throughout
2. **Modern Color Format**: OKLch provides perceptually uniform colors
3. **WCAG Compliant**: Current palette maintains AA contrast ratios
4. **Tailwind v4 Native**: Uses `@theme inline` block (no separate config needed)

### Current Implementation Analysis

The project already defines a complete emerald palette in `src/app/globals.css`:

```css
@theme inline {
  /* PRIMARY EMERALD (Current Implementation) */
  --color-primary-50: oklch(0.979 0.021 166.113);
  --color-primary-500: oklch(0.696 0.17 162.48);   /* Primary action */
  --color-primary-600: oklch(0.596 0.145 163.225); /* Button hover */
  --color-primary-700: oklch(0.508 0.118 165.612); /* Button active */
  /* ... full 11-shade palette defined */
}
```

### Component Usage (Current)

| Component | Current Usage |
|-----------|---------------|
| Button | `bg-emerald-600`, `hover:bg-emerald-700`, `focus:ring-emerald-500` |
| Input | `focus:border-emerald-500`, `focus:ring-emerald-500/10` |
| Select | `focus:border-emerald-500`, `focus:ring-emerald-500/10` |
| Badge | `bg-emerald-100 text-emerald-800` (primary variant) |
| Card | `focus:ring-emerald-500` (interactive states) |
| Sidebar | `bg-emerald-500/20`, gradient: `from-emerald-400 to-teal-500` |

### shadcn/ui Theme Integration Approach

**Strategy**: Map existing emerald palette to shadcn/ui's expected CSS variables

```css
@theme inline {
  /* Map to shadcn/ui expected variables */
  --primary: oklch(0.596 0.145 163.225);           /* emerald-600 */
  --primary-foreground: oklch(1 0 0);              /* white */
  --secondary: oklch(0.66 0.185 180);              /* teal-500 */
  --secondary-foreground: oklch(1 0 0);            /* white */
  --accent: oklch(0.765 0.177 163.223);            /* emerald-400 */
  --accent-foreground: oklch(0.262 0.051 172.552); /* emerald-950 */
  --destructive: oklch(0.627 0.258 29.234);        /* red-500 */
  --destructive-foreground: oklch(1 0 0);          /* white */

  /* Existing semantic colors work well */
  --color-success-*: /* maps to primary (emerald) */
  --color-warning-*: /* amber palette */
  --color-error-*:   /* red palette */
  --color-info-*:    /* blue palette */
}
```

### Recommendations

1. **Keep Current Emerald Theme**: Well-implemented, follows best practices
2. **Add shadcn/ui Variables**: Map existing colors to shadcn/ui's expected names
3. **Maintain OKLch Format**: Better color consistency than HSL
4. **Test Accessibility**: Verify WCAG contrast ratios after migration

---

## 3. Component Migration Strategy

### Decision
**Incremental migration with backwards compatibility** - Replace components one at a time while maintaining existing API signatures.

### Rationale
1. **Lower Risk**: Each component can be tested independently
2. **No Breaking Changes**: Existing pages continue to work during migration
3. **Rollback Capability**: Easy to revert individual component changes
4. **Team Productivity**: No need to update all pages simultaneously

### Migration Approach

#### Phase 1: Foundation (Low Risk)
1. Install shadcn/ui CLI and configure for existing project
2. Add shadcn/ui's required CSS variables alongside existing theme
3. Verify no visual regressions

#### Phase 2: Core Components (Medium Risk)
Migrate in this order (least dependencies first):

| Order | Component | Existing | shadcn/ui Replacement | Notes |
|-------|-----------|----------|----------------------|-------|
| 1 | Skeleton | `skeleton.tsx` | `npx shadcn add skeleton` | Direct replacement |
| 2 | Badge | `badge.tsx` | `npx shadcn add badge` | Add emerald variant |
| 3 | Button | `button.tsx` | `npx shadcn add button` | Preserve loading prop |
| 4 | Input | `input.tsx` | `npx shadcn add input` | Preserve form integration |
| 5 | Card | `card.tsx` | `npx shadcn add card` | Keep sub-components |
| 6 | Select | `select.tsx` | `npx shadcn add select` | Radix-based replacement |
| 7 | Table | `table.tsx` | `npx shadcn add table` | Update page usages |

#### Phase 3: Custom Components (Keep & Enhance)
These components have custom business logic - keep them but refactor internals:

| Component | Action | Notes |
|-----------|--------|-------|
| `kpi-card.tsx` | Refactor | Use shadcn Card internally |
| `stat-card.tsx` | Refactor | Use shadcn Card internally |
| `empty-state.tsx` | Enhance | Use shadcn styling patterns |
| `page-header.tsx` | Enhance | Use shadcn typography tokens |
| `form-field.tsx` | Replace | Use shadcn Form + FormField |

#### Phase 4: Additional Components
Add new shadcn/ui components for enhanced functionality:

| Component | Purpose | Priority |
|-----------|---------|----------|
| Dialog | Confirmation modals | High |
| DropdownMenu | Action menus | High |
| Tooltip | Help text | Medium |
| Sheet | Mobile sidebar | Medium |
| Toast | Notifications | Medium |
| Command | Search/command palette | Low |

### API Compatibility Strategy

**Preserve existing props where possible:**

```tsx
// Current Button API
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

// shadcn Button + wrapper to maintain API
interface ButtonProps {
  variant?: 'default' | 'secondary' | 'ghost' | 'destructive' | 'outline' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;  // Custom prop (add spinner icon)
  leftIcon?: ReactNode;  // Custom prop (use asChild or slots)
  rightIcon?: ReactNode; // Custom prop (use asChild or slots)
}

// Migration: Map 'primary' → 'default', 'danger' → 'destructive'
```

---

## 4. Risk Assessment

### Low Risk
- Skeleton, Badge replacement (isolated components)
- CSS variable additions (additive change)
- New component installations

### Medium Risk
- Button, Input, Card migration (widely used)
- Form handling changes
- Layout component updates

### High Risk
- Select component (Radix-based, different API)
- Table component (complex structure)
- Page-level updates (many files to change)

### Mitigation Strategies
1. **Feature flag**: Optionally toggle between old/new components during testing
2. **Visual regression tests**: Capture screenshots before/after migration
3. **Staged rollout**: Migrate one component type at a time
4. **Commit frequently**: One commit per component migration

---

## 5. Performance Considerations

### Bundle Size Impact
- shadcn/ui: ~0 KB (source code, not npm package)
- Radix UI primitives: ~15-30 KB gzipped (tree-shakeable)
- Total expected increase: < 50 KB gzipped

### Monitoring
```bash
# Check bundle size after each component migration
npm run build
npx @next/bundle-analyzer
```

### Optimization Strategies
1. **Tree-shaking**: Only import used components
2. **Dynamic imports**: Lazy-load Dialog, Sheet, Command
3. **CSS optimization**: Remove unused custom CSS after migration

---

## Summary

| Research Area | Decision | Confidence |
|---------------|----------|------------|
| Tailwind v4 + shadcn/ui | ✅ Proceed | High |
| Emerald/Teal theme | ✅ Enhance existing | High |
| Migration strategy | ✅ Incremental | High |
| Risk level | Medium | Medium |
| Performance impact | Low (< 50KB) | High |

**Ready for Phase 1: Foundation Setup**
