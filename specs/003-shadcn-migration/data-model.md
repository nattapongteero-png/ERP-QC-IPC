# Component Mapping: shadcn/ui Migration

**Feature Branch**: `003-shadcn-migration`
**Date**: 2025-12-18

> Note: This is a UI-only migration. There are no data model changes. This document maps existing components to their shadcn/ui equivalents.

## Component Inventory

### Direct Replacements

Components that will be replaced with shadcn/ui equivalents:

| Current Component | File | shadcn Component | Install Command |
|-------------------|------|------------------|-----------------|
| Button | `src/components/ui/button.tsx` | Button | `npx shadcn add button` |
| Card (+ sub-components) | `src/components/ui/card.tsx` | Card | `npx shadcn add card` |
| Input | `src/components/ui/input.tsx` | Input | `npx shadcn add input` |
| Select | `src/components/ui/select.tsx` | Select | `npx shadcn add select` |
| Badge | `src/components/ui/badge.tsx` | Badge | `npx shadcn add badge` |
| Table | `src/components/ui/table.tsx` | Table | `npx shadcn add table` |
| Skeleton | `src/components/ui/skeleton.tsx` | Skeleton | `npx shadcn add skeleton` |

### Custom Components (Keep & Enhance)

Components with custom business logic that will be refactored to use shadcn internals:

| Component | File | Action | Notes |
|-----------|------|--------|-------|
| KPICard | `src/components/ui/kpi-card.tsx` | Refactor | Use shadcn Card as base |
| StatCard | `src/components/ui/stat-card.tsx` | Refactor | Use shadcn Card as base |
| EmptyState | `src/components/ui/empty-state.tsx` | Enhance | Apply shadcn styling patterns |
| PageHeader | `src/components/ui/page-header.tsx` | Enhance | Use shadcn typography tokens |
| FormField | `src/components/ui/form-field.tsx` | Replace | Use shadcn Form + FormField |

### Layout Components (Update)

| Component | File | Action |
|-----------|------|--------|
| Sidebar | `src/components/layout/sidebar.tsx` | Update styling to match shadcn patterns |
| MainLayout | `src/components/layout/main-layout.tsx` | Update styling to match shadcn patterns |

### New Components (Add)

| Component | Install Command | Purpose |
|-----------|-----------------|---------|
| Dialog | `npx shadcn add dialog` | Confirmation modals |
| DropdownMenu | `npx shadcn add dropdown-menu` | Action menus |
| Tooltip | `npx shadcn add tooltip` | Help text hints |
| Sheet | `npx shadcn add sheet` | Mobile sidebar drawer |
| Separator | `npx shadcn add separator` | Visual dividers |

---

## Component API Mapping

### Button

**Current API:**
```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  isLoading?: boolean; // deprecated
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}
```

**shadcn API:**
```typescript
interface ButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}
```

**Migration Mapping:**
| Current | shadcn | Notes |
|---------|--------|-------|
| `variant="primary"` | `variant="default"` | Primary emerald styling |
| `variant="secondary"` | `variant="outline"` | Outlined style |
| `variant="ghost"` | `variant="ghost"` | Direct match |
| `variant="danger"` | `variant="destructive"` | Red destructive style |
| `size="sm"` | `size="sm"` | Direct match |
| `size="md"` | `size="default"` | Default size |
| `size="lg"` | `size="lg"` | Direct match |
| `loading` | Custom prop | Add loading spinner via icon |
| `fullWidth` | `className="w-full"` | Use className |
| `leftIcon` | Children composition | `<Icon /> Text` |
| `rightIcon` | Children composition | `Text <Icon />` |

### Card

**Current API:**
```typescript
interface CardProps {
  title?: string;
  description?: string;
  elevation?: 'flat' | 'raised' | 'elevated';
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}
```

**shadcn API:**
```typescript
// Composable sub-components
<Card>
  <CardHeader>
    <CardTitle />
    <CardDescription />
  </CardHeader>
  <CardContent />
  <CardFooter />
</Card>
```

**Migration:**
- Replace `title` prop with `<CardTitle>` child
- Replace `description` prop with `<CardDescription>` child
- Replace `elevation` with className variants
- Replace `interactive` with hover/focus styles
- Replace `padding` with className utilities

### Badge

**Current API:**
```typescript
interface BadgeProps {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  dot?: boolean;
  pill?: boolean;
}
```

**shadcn API:**
```typescript
interface BadgeProps {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}
```

**Migration Mapping:**
| Current | shadcn | Notes |
|---------|--------|-------|
| `variant="default"` | `variant="secondary"` | Gray badge |
| `variant="primary"` | `variant="default"` | Emerald badge |
| `variant="success"` | Custom class | Green badge |
| `variant="warning"` | Custom class | Amber badge |
| `variant="danger"` | `variant="destructive"` | Red badge |
| `variant="info"` | Custom class | Blue badge |
| `dot` | Custom prop | Keep functionality |
| `pill` | `className="rounded-full"` | Use className |

### Select

**Current API:**
```typescript
interface SelectProps {
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
}
```

**shadcn API (Radix-based):**
```typescript
<Select>
  <SelectTrigger>
    <SelectValue placeholder="" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="">Label</SelectItem>
  </SelectContent>
</Select>
```

**Migration:**
- Radix-based Select has different structure
- Create wrapper component to maintain current API
- Or update all usages to new composition pattern

### Table

**Current API:**
```typescript
// Simple table with className-based styling
<Table>
  <thead>
    <tr><th>Header</th></tr>
  </thead>
  <tbody>
    <tr><td>Cell</td></tr>
  </tbody>
</Table>
```

**shadcn API:**
```typescript
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Header</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Cell</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

**Migration:**
- Similar structure, rename elements
- Add shadcn styling patterns
- Update all table usages in pages

---

## Theme Token Mapping

### Colors

| Current Variable | shadcn Variable | Value |
|------------------|-----------------|-------|
| `--color-primary-500` | `--primary` | `oklch(0.696 0.17 162.48)` |
| `--color-primary-600` | `--primary` (hover) | `oklch(0.596 0.145 163.225)` |
| `--color-primary-50` | `--primary-foreground` | Light text on primary |
| `--color-secondary-*` | `--secondary` | Teal accent colors |
| `--color-error-500` | `--destructive` | Red error color |
| `--color-warning-500` | `--warning` | Amber warning color |

### Border Radius

| Current | shadcn | Value |
|---------|--------|-------|
| `--radius-lg` | `--radius` | `0.5rem` |
| `--radius-md` | `--radius-md` | `0.375rem` |
| `--radius-sm` | `--radius-sm` | `0.25rem` |

### Shadows

| Current | shadcn | Value |
|---------|--------|-------|
| `--shadow-sm` | `--shadow-sm` | Standard shadow |
| `--shadow-md` | `--shadow-md` | Medium shadow |
| `--shadow-lg` | `--shadow-lg` | Large shadow |

---

## Page Usage Analysis

### Pages to Update

| Page | Components Used | Complexity |
|------|-----------------|------------|
| Dashboard | Card, KPICard, StatCard, Badge | Medium |
| Inventory Items | Table, Button, Badge, Input | High |
| Inventory Lots | Table, Button, Badge | Medium |
| Inventory Warehouses | Table, Button, Card | Medium |
| Inventory Transactions | Table, Button, Badge | Medium |
| Inventory Expiry Alerts | Table, Badge | Low |
| Production Work Orders | Table, Button, Badge, Card | High |
| Quality Tests | Table, Button, Badge | Medium |
| Quality Deviations | Table, Button, Badge | Medium |
| Purchasing Orders | Table, Button, Badge | Medium |
| Sales Orders | Table, Button, Badge | Medium |
| Reports | Card, Select | Low |
| Users | Table, Button, Badge | Medium |
| Settings | Input, Select, Button | Medium |
| Login | Input, Button, Card | Medium |

### Estimated Updates

- **Total pages**: 26
- **Total component usages**: ~150+
- **High complexity pages**: 2
- **Medium complexity pages**: 11
- **Low complexity pages**: 3
