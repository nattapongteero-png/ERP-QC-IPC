# Theme System Guide

This document describes the design token and theming system used in the Herbal Medicine ERP application.

## Overview

The application uses a layered theming approach:
1. **CSS Variables** - For shadcn/ui compatibility and HSL-based colors
2. **Tailwind Design Tokens** - Via `@theme inline` directive for utility classes
3. **Component Variants** - Using class-variance-authority (CVA) for consistent styling

## CSS Variables (globals.css)

### Base Variables
```css
:root {
  --background: #ffffff;
  --foreground: #171717;
  --spacing-base: 8px;
  --timing-base: 150ms;
}
```

### shadcn/ui Theme Variables
These variables use HSL values for shadcn/ui component compatibility:

| Variable | Value | Description |
|----------|-------|-------------|
| `--primary` | `161 78% 37%` | Emerald-600, main brand color |
| `--primary-foreground` | `0 0% 100%` | White text on primary |
| `--secondary` | `0 0% 96.1%` | Light gray for secondary elements |
| `--muted` | `0 0% 96.1%` | Muted backgrounds |
| `--accent` | `0 0% 96.1%` | Accent color for hover states |
| `--destructive` | `0 84.2% 60.2%` | Red for destructive actions |
| `--ring` | `161 78% 37%` | Focus ring color (emerald) |
| `--radius` | `0.5rem` | Default border radius |

### Chart Colors
For data visualization consistency:
- `--chart-1`: Emerald (primary)
- `--chart-2`: Teal
- `--chart-3`: Amber
- `--chart-4`: Sky
- `--chart-5`: Purple

## Tailwind Design Tokens (@theme inline)

### Primary Color Scale (Emerald)
```css
--color-primary-50 through --color-primary-950
```
All values use OKLCH color space for perceptual uniformity and WCAG AA compliance.

### Semantic Colors
| Token | Usage |
|-------|-------|
| `success-*` | Positive states, confirmations |
| `warning-*` | Caution states, pending items |
| `error-*` | Error states, destructive actions |
| `info-*` | Informational states |

### Shadow System (Elevation)
| Token | Usage |
|-------|-------|
| `--shadow-xs` | Subtle depth |
| `--shadow-sm` | Default card elevation |
| `--shadow-md` | Raised elements |
| `--shadow-lg` | Modal, dropdown elevation |
| `--shadow-xl` | High emphasis |
| `--shadow-2xl` | Maximum elevation |

### Border Radius Scale
From `--radius-none` (0px) to `--radius-full` (9999px), with common values:
- `--radius-md`: 0.375rem (default for inputs)
- `--radius-lg`: 0.5rem (default for cards)
- `--radius-xl`: 0.75rem (large cards)

### Animation Tokens
| Token | Value | Usage |
|-------|-------|-------|
| `--duration-150` | 150ms | Quick interactions |
| `--duration-200` | 200ms | Standard transitions |
| `--duration-300` | 300ms | Larger animations |
| `--ease-out` | cubic-bezier(0, 0, 0.2, 1) | Default easing |

## Component Styling Conventions

### Button Variants
All button colors use the emerald palette for primary actions:
- `default/primary`: `bg-emerald-600` → `hover:bg-emerald-700`
- `outline`: `border-emerald-600` + `text-emerald-700`
- `link`: `text-emerald-600`

### Badge Variants
| Variant | Background | Text |
|---------|------------|------|
| `primary` | `bg-emerald-100` | `text-emerald-800` |
| `success` | `bg-green-100` | `text-green-800` |
| `warning` | `bg-yellow-100` | `text-yellow-800` |
| `danger` | `bg-red-100` | `text-red-800` |
| `info` | `bg-blue-100` | `text-blue-800` |

### Card Elevations
| Elevation | Shadow | Hover |
|-----------|--------|-------|
| `flat` | none | - |
| `raised` | `shadow-sm` | `shadow-lg` |
| `elevated` | `shadow-md` | `shadow-xl` |

## Accessibility

### Focus States
All interactive elements use:
```css
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-ring
focus-visible:ring-offset-2
```

### Reduced Motion
All animations respect `prefers-reduced-motion`:
```css
motion-reduce:transition-none
motion-reduce:animate-none
```

### Color Contrast
Primary colors are WCAG AA compliant:
- Emerald-600 on white: 4.5:1+ contrast ratio
- White text on emerald-600: 4.5:1+ contrast ratio

## Dark Mode

Currently uses system preference via media query:
```css
@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}
```

Full dark mode support can be extended by adding dark variants to all CSS variables.

## Usage Guidelines

1. **Use Tailwind classes** for colors (`emerald-600` not `#059669`)
2. **Use design tokens** for shadows, spacing, and radii
3. **Use CVA variants** for component states
4. **Never hardcode** OKLCH or hex values in components
5. **Always include** `motion-reduce` variants for animations
