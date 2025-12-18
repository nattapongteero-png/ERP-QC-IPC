# Component API Contracts

**Branch**: `002-ui-redesign` | **Date**: 2025-12-17

This document defines the TypeScript interfaces for all UI components being enhanced in this feature.

---

## 1. Button Component

### Interface

```typescript
interface ButtonProps {
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Loading state - shows spinner and disables interaction */
  loading?: boolean;

  /** Disabled state */
  disabled?: boolean;

  /** Full width button */
  fullWidth?: boolean;

  /** Left icon component */
  leftIcon?: React.ReactNode;

  /** Right icon component */
  rightIcon?: React.ReactNode;

  /** Button type */
  type?: 'button' | 'submit' | 'reset';

  /** Click handler */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;

  /** Children content */
  children: React.ReactNode;

  /** Additional CSS classes */
  className?: string;
}
```

### Variant Styles

| Variant | Background | Text | Border | Hover | Active |
|---------|------------|------|--------|-------|--------|
| primary | primary-600 | white | none | primary-700 + shadow-md | primary-800 + scale-98 |
| secondary | white | primary-700 | primary-600 | primary-50 + border-primary-700 | primary-100 |
| ghost | transparent | gray-700 | none | gray-100 | gray-200 |
| danger | error-600 | white | none | error-700 | error-800 |

### Size Styles

| Size | Padding | Text Size | Height |
|------|---------|-----------|--------|
| sm | px-3 py-1.5 | text-sm | 32px |
| md | px-4 py-2 | text-base | 40px |
| lg | px-6 py-3 | text-lg | 48px |

---

## 2. Card Component

### Interface

```typescript
interface CardProps {
  /** Card title */
  title?: string;

  /** Card description/subtitle */
  description?: string;

  /** Elevation variant */
  elevation?: 'flat' | 'raised' | 'elevated';

  /** Whether card is interactive (clickable) */
  interactive?: boolean;

  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';

  /** Click handler (when interactive) */
  onClick?: () => void;

  /** Link href (when interactive) */
  href?: string;

  /** Children content */
  children: React.ReactNode;

  /** Additional CSS classes */
  className?: string;
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}
```

### Elevation Styles

| Elevation | Shadow (rest) | Shadow (hover) | Transform (hover) |
|-----------|---------------|----------------|-------------------|
| flat | none | none | none |
| raised | shadow-sm | shadow-lg | -translateY-0.5 |
| elevated | shadow-md | shadow-xl | -translateY-1 |

### Padding Styles

| Padding | Value |
|---------|-------|
| none | 0 |
| sm | p-3 (12px) |
| md | p-4 (16px) |
| lg | p-6 (24px) |

---

## 3. Badge Component

### Interface

```typescript
interface BadgeProps {
  /** Visual variant */
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';

  /** Size variant */
  size?: 'sm' | 'md';

  /** Children content */
  children: React.ReactNode;

  /** Additional CSS classes */
  className?: string;
}

/** Helper function to map status strings to badge variants */
function getStatusVariant(status: string): BadgeProps['variant'];
```

### Variant Styles

| Variant | Background | Text |
|---------|------------|------|
| default | gray-100 | gray-800 |
| primary | primary-100 | primary-800 |
| secondary | secondary-100 | secondary-800 |
| success | green-100 | green-800 |
| warning | yellow-100 | yellow-800 |
| danger | red-100 | red-800 |
| info | blue-100 | blue-800 |

### Size Styles

| Size | Padding | Text Size |
|------|---------|-----------|
| sm | px-2 py-0.5 | text-xs |
| md | px-2.5 py-1 | text-sm |

---

## 4. Input Component

### Interface

```typescript
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Label text */
  label?: string;

  /** Helper/description text */
  helperText?: string;

  /** Error message */
  error?: string;

  /** Success state */
  success?: boolean;

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Visual variant */
  variant?: 'default' | 'filled';

  /** Left icon */
  leftIcon?: React.ReactNode;

  /** Right icon */
  rightIcon?: React.ReactNode;

  /** Full width */
  fullWidth?: boolean;

  /** Additional CSS classes */
  className?: string;
}

interface SearchInputProps extends Omit<InputProps, 'leftIcon'> {
  /** Search handler on enter or button click */
  onSearch?: (value: string) => void;
}
```

### State Styles

| State | Background | Border | Ring |
|-------|------------|--------|------|
| default | white | gray-300 | none |
| focus | white | primary-500 | ring-2 ring-primary-500/20 |
| error | error-50 | error-500 | ring-2 ring-error-500/20 |
| success | success-50 | success-500 | ring-2 ring-success-500/20 |
| disabled | gray-100 | gray-300 | none |

### Size Styles

| Size | Padding | Text Size | Height |
|------|---------|-----------|--------|
| sm | px-2.5 py-1.5 | text-sm | 32px |
| md | px-3 py-2 | text-base | 40px |
| lg | px-4 py-3 | text-lg | 48px |

---

## 5. Select Component

### Interface

```typescript
interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  /** Label text */
  label?: string;

  /** Placeholder text */
  placeholder?: string;

  /** Options array */
  options: SelectOption[];

  /** Selected value */
  value?: string;

  /** Default value */
  defaultValue?: string;

  /** Change handler */
  onChange?: (value: string) => void;

  /** Error message */
  error?: string;

  /** Disabled state */
  disabled?: boolean;

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Full width */
  fullWidth?: boolean;

  /** Additional CSS classes */
  className?: string;
}
```

### State Styles

Same as Input component states.

---

## 6. Table Component

### Interface

```typescript
interface Column<T> {
  /** Unique column key */
  key: string;

  /** Column header text */
  header: string;

  /** Cell render function */
  render?: (row: T, index: number) => React.ReactNode;

  /** Sortable column */
  sortable?: boolean;

  /** Column alignment */
  align?: 'left' | 'center' | 'right';

  /** Column width */
  width?: string;

  /** Additional header class */
  headerClassName?: string;

  /** Additional cell class */
  cellClassName?: string;
}

interface TableProps<T> {
  /** Column definitions */
  columns: Column<T>[];

  /** Data array */
  data: T[];

  /** Loading state */
  loading?: boolean;

  /** Empty state message */
  emptyMessage?: string;

  /** Row key extractor */
  rowKey: keyof T | ((row: T) => string);

  /** Row click handler */
  onRowClick?: (row: T, index: number) => void;

  /** Current sort column */
  sortColumn?: string;

  /** Sort direction */
  sortDirection?: 'asc' | 'desc';

  /** Sort change handler */
  onSortChange?: (column: string, direction: 'asc' | 'desc') => void;

  /** Striped rows */
  striped?: boolean;

  /** Hoverable rows */
  hoverable?: boolean;

  /** Additional CSS classes */
  className?: string;
}
```

### Row Styles

| State | Background |
|-------|------------|
| odd | white |
| even (striped) | gray-50 |
| hover | primary-50 |
| selected | primary-100 |

### Header Styles

| Property | Value |
|----------|-------|
| Background | gray-50 |
| Text | gray-700, text-xs, uppercase, font-semibold |
| Padding | px-6 py-3 |

---

## 7. Skeleton Component (NEW)

### Interface

```typescript
interface SkeletonProps {
  /** Skeleton variant */
  variant?: 'text' | 'circular' | 'rectangular';

  /** Width (number for px, string for any CSS value) */
  width?: number | string;

  /** Height (number for px, string for any CSS value) */
  height?: number | string;

  /** Animation style */
  animation?: 'pulse' | 'shimmer' | 'none';

  /** Additional CSS classes */
  className?: string;
}

/** Card skeleton preset */
interface CardSkeletonProps {
  /** Number of text lines */
  lines?: number;

  /** Show avatar */
  avatar?: boolean;

  /** Show button placeholder */
  button?: boolean;
}

/** Table row skeleton preset */
interface TableRowSkeletonProps {
  /** Number of columns */
  columns: number;
}
```

### Variant Styles

| Variant | Default Dimensions | Border Radius |
|---------|-------------------|---------------|
| text | w-full h-4 | radius-md |
| circular | w-10 h-10 | radius-full |
| rectangular | w-full h-20 | radius-lg |

### Animation Styles

| Animation | Keyframes |
|-----------|-----------|
| pulse | opacity 1 → 0.5 → 1, 2s |
| shimmer | translateX -100% → 100%, 2s |
| none | static |

---

## 8. EmptyState Component (NEW)

### Interface

```typescript
interface EmptyStateProps {
  /** Title text */
  title: string;

  /** Description text */
  description?: string;

  /** Icon component */
  icon?: React.ReactNode;

  /** Primary action button */
  action?: {
    label: string;
    onClick: () => void;
    variant?: ButtonProps['variant'];
  };

  /** Secondary action button */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Additional CSS classes */
  className?: string;
}
```

### Size Styles

| Size | Icon Size | Title Size | Description Size |
|------|-----------|------------|------------------|
| sm | w-8 h-8 | text-base | text-sm |
| md | w-12 h-12 | text-lg | text-base |
| lg | w-16 h-16 | text-xl | text-base |

---

## Usage Examples

### Button

```tsx
<Button variant="primary" size="md" loading={isSubmitting}>
  Save Changes
</Button>

<Button variant="secondary" leftIcon={<PlusIcon />}>
  Add Item
</Button>
```

### Card

```tsx
<Card elevation="raised" interactive onClick={handleClick}>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
  <CardFooter>
    <Button variant="ghost">Action</Button>
  </CardFooter>
</Card>
```

### Input

```tsx
<Input
  label="Email"
  type="email"
  placeholder="you@example.com"
  error={errors.email}
  leftIcon={<MailIcon />}
/>

<SearchInput
  placeholder="Search items..."
  onSearch={handleSearch}
/>
```

### Table

```tsx
<Table
  columns={[
    { key: 'name', header: 'Name', sortable: true },
    { key: 'status', header: 'Status', render: (row) => <Badge>{row.status}</Badge> },
    { key: 'price', header: 'Price', align: 'right' },
  ]}
  data={items}
  loading={isLoading}
  striped
  hoverable
  onRowClick={handleRowClick}
  onSortChange={handleSort}
  emptyMessage="No items found"
/>
```

### Skeleton

```tsx
{isLoading ? (
  <CardSkeleton lines={3} avatar button />
) : (
  <Card>...</Card>
)}
```

### EmptyState

```tsx
<EmptyState
  icon={<InboxIcon />}
  title="No items yet"
  description="Get started by adding your first item"
  action={{
    label: "Add Item",
    onClick: handleAddItem,
    variant: "primary"
  }}
/>
```
