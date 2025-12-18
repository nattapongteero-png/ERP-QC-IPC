# Quickstart Guide: UI Redesign Implementation

**Branch**: `002-ui-redesign` | **Date**: 2025-12-17

This guide provides step-by-step instructions for implementing the UI redesign feature.

---

## Prerequisites

- Node.js 18+ installed
- pnpm package manager
- Access to the repository

## Setup

```bash
# Clone and checkout branch
git checkout 002-ui-redesign

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Development Workflow

### 1. Design Token Updates

First, update the global styles with design tokens.

**File**: `src/app/globals.css`

```css
@import "tailwindcss";

/* CSS Variables */
:root {
  --spacing-base: 8px;
  --timing-base: 150ms;
}

/* Design Tokens */
@theme {
  /* Spacing Scale (8px base) */
  --spacing-0: 0px;
  --spacing-1: 8px;
  --spacing-2: 16px;
  --spacing-3: 24px;
  --spacing-4: 32px;
  --spacing-6: 48px;
  --spacing-8: 64px;

  /* Primary Colors (Emerald) */
  --color-primary-50: oklch(0.979 0.021 166.113);
  --color-primary-100: oklch(0.95 0.052 163.051);
  --color-primary-500: oklch(0.696 0.17 162.48);
  --color-primary-600: oklch(0.596 0.145 163.225);
  --color-primary-700: oklch(0.508 0.118 165.612);
  --color-primary-800: oklch(0.432 0.095 166.913);

  /* Shadows */
  --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);

  /* Border Radius */
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-2xl: 1rem;

  /* Animations */
  --animate-fade-in: fade-in 0.3s ease-out;

  @keyframes fade-in {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
}
```

### 2. Component Enhancement Pattern

When enhancing a component, follow this pattern:

```tsx
// src/components/ui/button.tsx
import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const buttonVariants = {
  primary: `
    bg-primary-600 text-white
    hover:bg-primary-700 hover:shadow-md
    active:bg-primary-800 active:scale-[0.98]
  `,
  secondary: `
    bg-white text-primary-700 border-2 border-primary-600
    hover:bg-primary-50 hover:border-primary-700
    active:bg-primary-100
  `,
  ghost: `
    bg-transparent text-gray-700
    hover:bg-gray-100 hover:text-gray-900
    active:bg-gray-200
  `,
  danger: `
    bg-error-600 text-white
    hover:bg-error-700
    active:bg-error-800
  `,
};

const buttonSizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center font-medium rounded-lg',
          // Focus styles (WCAG compliant)
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
          // Transition styles
          'transition-all duration-150 ease-in-out',
          // Reduced motion
          'motion-reduce:transition-none motion-reduce:hover:transform-none',
          // Disabled styles
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // Variant and size
          buttonVariants[variant],
          buttonSizes[size],
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="motion-safe:animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
```

### 3. Create Utility Function

**File**: `src/lib/utils/cn.ts`

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Note: You may need to install `clsx` and `tailwind-merge`:

```bash
pnpm add clsx tailwind-merge
```

### 4. Testing Components

Run the test suite after each component enhancement:

```bash
# Run all tests
pnpm test:run

# Run specific component tests
pnpm test:run src/components/ui/button.test.tsx

# Run with coverage
pnpm test:coverage
```

### 5. Visual Testing

After enhancing components, visually verify:

1. **Start dev server**: `pnpm dev`
2. **Check all states**: Default, hover, focus, active, disabled, loading
3. **Test accessibility**: Tab through elements, check focus indicators
4. **Test responsive**: Check at 375px, 768px, 1024px, 1920px
5. **Test reduced motion**: Enable in system preferences

### 6. Linting and Type Checking

Before committing, always run:

```bash
# Type check
pnpm tsc --noEmit

# Lint
pnpm lint
```

---

## Component Enhancement Checklist

### For Each Component:

- [ ] Add all variant styles (primary, secondary, ghost, danger)
- [ ] Add all size styles (sm, md, lg)
- [ ] Add hover states with transitions
- [ ] Add focus-visible ring for keyboard navigation
- [ ] Add active/pressed states
- [ ] Add disabled states
- [ ] Add loading state (if applicable)
- [ ] Add reduced motion support
- [ ] Update TypeScript interface
- [ ] Write/update unit tests
- [ ] Visual test all states
- [ ] Check WCAG contrast compliance

### Global Checklist:

- [ ] Update globals.css with design tokens
- [ ] Create cn utility function
- [ ] Enhance Button component
- [ ] Enhance Card component
- [ ] Enhance Badge component
- [ ] Enhance Input component
- [ ] Enhance Select component
- [ ] Enhance Table component
- [ ] Create Skeleton component
- [ ] Create EmptyState component
- [ ] Enhance Sidebar navigation
- [ ] Update Dashboard page
- [ ] Update all module pages
- [ ] Run full test suite
- [ ] Run lint and type check

---

## Troubleshooting

### Tailwind Classes Not Applying

1. Check if class is in the safelist or used dynamically
2. Verify `@import "tailwindcss"` is at top of globals.css
3. Run `pnpm dev` to rebuild CSS

### Focus Ring Not Visible

1. Use `focus-visible:` instead of `focus:`
2. Ensure ring color has sufficient contrast (3:1 minimum)
3. Add `focus:outline-none` before focus-visible styles

### Animations Not Respecting Reduced Motion

1. Use `motion-safe:` prefix for animations
2. Use `motion-reduce:` prefix to disable

### TypeScript Errors

1. Check interface definitions in contracts/component-api.md
2. Ensure all props are properly typed
3. Run `pnpm tsc --noEmit` to identify issues

---

## Resources

- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Lucide Icons](https://lucide.dev/icons/)

---

## Commit Convention

When committing changes:

```bash
git add .
git commit -m "$(cat <<'EOF'
feat(ui): enhance Button component with variants and states

- Add primary, secondary, ghost, danger variants
- Add sm, md, lg size variants
- Add loading state with spinner
- Add WCAG compliant focus indicators
- Add reduced motion support

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

Follow the Constitution requirement to commit after each logical unit of work.
