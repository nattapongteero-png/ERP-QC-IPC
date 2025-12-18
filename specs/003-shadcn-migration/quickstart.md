# Quickstart Guide: shadcn/ui Migration

**Feature Branch**: `003-shadcn-migration`
**Date**: 2025-12-18

## Prerequisites

- Node.js 18+
- pnpm (package manager used in this project)
- Git

## Environment Setup

```bash
# Clone and checkout feature branch
git checkout 003-shadcn-migration

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Migration Steps

### Step 1: Initialize shadcn/ui

```bash
# Run shadcn/ui init with canary (for Tailwind v4 support)
npx shadcn@canary init

# Answer the prompts:
# - TypeScript: Yes
# - Style: Default
# - Base color: Neutral (we'll customize to Emerald)
# - CSS variables: Yes
# - Tailwind config: No (using CSS-based config)
# - Components alias: @/components
# - Utils alias: @/lib/utils
```

### Step 2: Configure Theme

Update `src/app/globals.css` to add shadcn/ui CSS variables alongside existing theme:

```css
@theme inline {
  /* Add shadcn/ui expected variables */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0.015 254.604);

  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0.015 254.604);

  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0.015 254.604);

  --primary: oklch(0.596 0.145 163.225);  /* emerald-600 */
  --primary-foreground: oklch(1 0 0);

  --secondary: oklch(0.97 0.014 254.604);
  --secondary-foreground: oklch(0.205 0.015 254.604);

  --muted: oklch(0.97 0.014 254.604);
  --muted-foreground: oklch(0.556 0.016 254.604);

  --accent: oklch(0.97 0.014 254.604);
  --accent-foreground: oklch(0.205 0.015 254.604);

  --destructive: oklch(0.627 0.258 29.234);
  --destructive-foreground: oklch(1 0 0);

  --border: oklch(0.922 0.013 254.604);
  --input: oklch(0.922 0.013 254.604);
  --ring: oklch(0.596 0.145 163.225);

  --radius: 0.5rem;
}
```

### Step 3: Install Core Components

```bash
# Install all required shadcn/ui components
npx shadcn@canary add button
npx shadcn@canary add card
npx shadcn@canary add input
npx shadcn@canary add select
npx shadcn@canary add badge
npx shadcn@canary add table
npx shadcn@canary add skeleton
npx shadcn@canary add dialog
npx shadcn@canary add dropdown-menu
npx shadcn@canary add tooltip
npx shadcn@canary add separator
```

### Step 4: Verify Installation

```bash
# Type check
pnpm tsc --noEmit

# Lint
pnpm lint

# Run tests
pnpm test:run

# Build
pnpm build
```

### Step 5: Start Development Server

```bash
pnpm dev
```

Visit http://localhost:3000 to verify the application loads correctly.

---

## Component Migration Order

### Phase 1: Low Risk (Start Here)
1. **Skeleton** - Isolated, simple replacement
2. **Badge** - Add custom variants for success/warning/info

### Phase 2: Medium Risk
3. **Button** - Add loading prop wrapper
4. **Input** - Simple replacement
5. **Card** - Update import paths in pages

### Phase 3: Higher Risk
6. **Select** - Radix-based, different API
7. **Table** - Many pages to update

### Phase 4: Custom Components
8. **KPICard** - Refactor to use shadcn Card
9. **StatCard** - Refactor to use shadcn Card
10. **EmptyState** - Apply shadcn styling
11. **PageHeader** - Apply shadcn typography
12. **FormField** - Replace with shadcn Form

---

## Common Migration Patterns

### Button Migration

**Before:**
```tsx
import { Button } from '@/components/ui/button';

<Button variant="primary" loading>Save</Button>
<Button variant="danger">Delete</Button>
```

**After:**
```tsx
import { Button } from '@/components/ui/button';

<Button loading>Save</Button>
<Button variant="destructive">Delete</Button>
```

### Card Migration

**Before:**
```tsx
import { Card } from '@/components/ui/card';

<Card title="Orders" description="Recent orders">
  {content}
</Card>
```

**After:**
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Orders</CardTitle>
    <CardDescription>Recent orders</CardDescription>
  </CardHeader>
  <CardContent>
    {content}
  </CardContent>
</Card>
```

### Badge Migration

**Before:**
```tsx
import { Badge, getStatusVariant } from '@/components/ui/badge';

<Badge variant={getStatusVariant(status)} dot>
  {status}
</Badge>
```

**After:**
```tsx
import { Badge } from '@/components/ui/badge';

<Badge variant={getStatusVariant(status)} dot>
  {status}
</Badge>
// Note: Keep getStatusVariant helper, add 'success', 'warning', 'info' variants to shadcn Badge
```

### Select Migration

**Before:**
```tsx
import { Select } from '@/components/ui/select';

<Select
  options={[
    { value: 'pending', label: 'Pending' },
    { value: 'active', label: 'Active' },
  ]}
  value={status}
  onChange={setStatus}
/>
```

**After:**
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

<Select value={status} onValueChange={setStatus}>
  <SelectTrigger>
    <SelectValue placeholder="Select status" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="pending">Pending</SelectItem>
    <SelectItem value="active">Active</SelectItem>
  </SelectContent>
</Select>
```

### Table Migration

**Before:**
```tsx
import { Table } from '@/components/ui/table';

<Table>
  <thead>
    <tr><th>Name</th></tr>
  </thead>
  <tbody>
    <tr><td>Item</td></tr>
  </tbody>
</Table>
```

**After:**
```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Item</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

---

## Verification Checklist

After each component migration:

- [ ] Run `pnpm tsc --noEmit` - No TypeScript errors
- [ ] Run `pnpm lint` - No ESLint errors
- [ ] Run `pnpm test:run` - All tests pass
- [ ] Run `pnpm build` - Build succeeds
- [ ] Visual check - Component renders correctly
- [ ] Responsive check - Works on mobile/tablet/desktop
- [ ] Accessibility check - Keyboard navigation works
- [ ] Commit changes

---

## Troubleshooting

### TypeScript Errors

If you see type errors after installing a component:
```bash
# Reinstall the component
npx shadcn@canary add button --overwrite

# Or check for conflicting types
pnpm tsc --noEmit
```

### Styling Issues

If colors look wrong:
1. Check that CSS variables are defined in `globals.css`
2. Verify `@theme inline` block is correctly formatted
3. Check browser dev tools for CSS variable values

### Import Errors

If imports fail:
```tsx
// Make sure path alias is correct
import { Button } from '@/components/ui/button';

// Check tsconfig.json has correct paths
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## Resources

- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Tailwind CSS v4 Docs](https://tailwindcss.com/docs)
- [Radix UI Primitives](https://www.radix-ui.com/primitives)
- [Project Constitution](.specify/memory/constitution.md)
