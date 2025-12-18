# Component API Contracts: shadcn/ui Migration

**Feature Branch**: `003-shadcn-migration`
**Date**: 2025-12-18

This document defines the component API contracts after migration to shadcn/ui.

---

## Core Components

### Button

**Location**: `src/components/ui/button.tsx`

```typescript
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean  // Custom: Shows loading spinner
}
```

**Usage Examples**:
```tsx
// Primary action
<Button>Save Changes</Button>

// With loading state
<Button loading>Saving...</Button>

// Destructive action
<Button variant="destructive">Delete</Button>

// With icon
<Button><Plus className="h-4 w-4" /> Add Item</Button>

// Icon-only button
<Button variant="ghost" size="icon"><Settings className="h-4 w-4" /></Button>
```

---

### Card

**Location**: `src/components/ui/card.tsx`

```typescript
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}
interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}
interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}
interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}
interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}
interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}
```

**Usage Examples**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Work Orders</CardTitle>
    <CardDescription>Recent production orders</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content here */}
  </CardContent>
  <CardFooter>
    <Button>View All</Button>
  </CardFooter>
</Card>
```

---

### Input

**Location**: `src/components/ui/input.tsx`

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
```

**Usage Examples**:
```tsx
<Input type="text" placeholder="Enter name..." />
<Input type="email" disabled />
<Input type="password" className="w-full" />
```

---

### Select

**Location**: `src/components/ui/select.tsx`

```typescript
// Radix-based Select with composition pattern
interface SelectProps {
  children: React.ReactNode
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
}

interface SelectTriggerProps extends React.HTMLAttributes<HTMLButtonElement> {
  className?: string
}

interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  position?: "item-aligned" | "popper"
}

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  disabled?: boolean
}
```

**Usage Examples**:
```tsx
<Select value={status} onValueChange={setStatus}>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Select status" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="pending">Pending</SelectItem>
    <SelectItem value="active">Active</SelectItem>
    <SelectItem value="completed">Completed</SelectItem>
  </SelectContent>
</Select>
```

---

### Badge

**Location**: `src/components/ui/badge.tsx`

```typescript
import { cva, type VariantProps } from "class-variance-authority"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        // Custom variants for this project
        success: "border-transparent bg-emerald-100 text-emerald-800",
        warning: "border-transparent bg-amber-100 text-amber-800",
        info: "border-transparent bg-blue-100 text-blue-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean  // Custom: Shows status dot before text
}
```

**Usage Examples**:
```tsx
<Badge>Active</Badge>
<Badge variant="success" dot>Approved</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="destructive">Rejected</Badge>
```

---

### Table

**Location**: `src/components/ui/table.tsx`

```typescript
interface TableProps extends React.HTMLAttributes<HTMLTableElement> {}
interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
interface TableFooterProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {}
interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {}
interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {}
interface TableCaptionProps extends React.HTMLAttributes<HTMLTableCaptionElement> {}
```

**Usage Examples**:
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead className="w-[100px]">Order #</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="text-right">Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {orders.map((order) => (
      <TableRow key={order.id}>
        <TableCell className="font-medium">{order.number}</TableCell>
        <TableCell><Badge variant="success">{order.status}</Badge></TableCell>
        <TableCell className="text-right">{order.amount}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

---

### Skeleton

**Location**: `src/components/ui/skeleton.tsx`

```typescript
interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}
```

**Usage Examples**:
```tsx
// Text skeleton
<Skeleton className="h-4 w-[250px]" />

// Avatar skeleton
<Skeleton className="h-12 w-12 rounded-full" />

// Card skeleton
<Skeleton className="h-[125px] w-[250px] rounded-xl" />
```

---

## Additional Components

### Dialog

**Location**: `src/components/ui/dialog.tsx`

```typescript
interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}
```

**Usage Examples**:
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger asChild>
    <Button variant="destructive">Delete</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Deletion</DialogTitle>
      <DialogDescription>
        This action cannot be undone.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
      <Button variant="destructive" onClick={handleDelete}>Delete</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### DropdownMenu

**Location**: `src/components/ui/dropdown-menu.tsx`

```typescript
// Radix-based DropdownMenu
```

**Usage Examples**:
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
    <DropdownMenuItem onClick={handleDuplicate}>Duplicate</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={handleDelete} className="text-destructive">
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

### Tooltip

**Location**: `src/components/ui/tooltip.tsx`

```typescript
interface TooltipProps {
  children: React.ReactNode
  delayDuration?: number
}
```

**Usage Examples**:
```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon">
        <HelpCircle className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Click to view help</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## Custom Components (Enhanced)

### KPICard

**Location**: `src/components/ui/kpi-card.tsx`

```typescript
interface KPICardProps {
  label: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  iconBgColor?: string
  iconColor?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  className?: string
  style?: React.CSSProperties
}
```

**Implementation**: Uses shadcn Card internally

---

### StatCard

**Location**: `src/components/ui/stat-card.tsx`

```typescript
interface StatCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'info'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  style?: React.CSSProperties
}
```

**Implementation**: Uses shadcn Card internally

---

### EmptyState

**Location**: `src/components/ui/empty-state.tsx`

```typescript
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}
```

---

### PageHeader

**Location**: `src/components/ui/page-header.tsx`

```typescript
interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  breadcrumbs?: { label: string; href?: string }[]
  className?: string
}
```

---

## Theme Configuration

### CSS Variables (globals.css)

```css
@theme inline {
  /* Primary - Emerald */
  --primary: oklch(0.596 0.145 163.225);
  --primary-foreground: oklch(1 0 0);

  /* Secondary - Teal */
  --secondary: oklch(0.97 0.014 254.604);
  --secondary-foreground: oklch(0.205 0.015 254.604);

  /* Destructive - Red */
  --destructive: oklch(0.627 0.258 29.234);
  --destructive-foreground: oklch(1 0 0);

  /* Accent */
  --accent: oklch(0.97 0.014 254.604);
  --accent-foreground: oklch(0.205 0.015 254.604);

  /* Muted */
  --muted: oklch(0.97 0.014 254.604);
  --muted-foreground: oklch(0.556 0.016 254.604);

  /* Card */
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0.015 254.604);

  /* Border/Ring */
  --border: oklch(0.922 0.013 254.604);
  --input: oklch(0.922 0.013 254.604);
  --ring: oklch(0.596 0.145 163.225);

  /* Radius */
  --radius: 0.5rem;
}
```
