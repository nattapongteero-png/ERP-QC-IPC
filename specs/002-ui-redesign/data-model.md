# Data Model: UI Redesign Design System

**Branch**: `002-ui-redesign` | **Date**: 2025-12-17

## Overview

This document defines the design token entities and component variants that form the visual language of the UI redesign. No database entities are affected - this is a UI-only feature.

---

## 1. Design Token Entities

### 1.1 Color Tokens

```typescript
interface ColorToken {
  name: string;           // e.g., "primary-500"
  value: string;          // OKLCH value
  contrastRatio: number;  // Against white background
  usage: string[];        // Where this color should be used
}
```

#### Primary Palette (Emerald)

| Name | Value | Contrast | Usage |
|------|-------|----------|-------|
| primary-50 | oklch(0.979 0.021 166.113) | - | Backgrounds (hover) |
| primary-100 | oklch(0.95 0.052 163.051) | - | Backgrounds (selected) |
| primary-200 | oklch(0.905 0.093 164.15) | - | Light accents |
| primary-300 | oklch(0.845 0.143 164.978) | - | Borders |
| primary-400 | oklch(0.765 0.177 163.223) | - | Icons (light bg) |
| primary-500 | oklch(0.696 0.17 162.48) | 3.0:1 | Focus rings, accents |
| primary-600 | oklch(0.596 0.145 163.225) | 4.5:1 | Button backgrounds |
| primary-700 | oklch(0.508 0.118 165.612) | 7.0:1 | Hover states, text |
| primary-800 | oklch(0.432 0.095 166.913) | 9.5:1 | Active states |
| primary-900 | oklch(0.378 0.077 168.94) | 12:1 | Dark text |

#### Semantic Colors

| Name | Value | Contrast | Usage |
|------|-------|----------|-------|
| success-500 | oklch(0.696 0.17 162.48) | 4.5:1 | Success states |
| success-700 | oklch(0.508 0.118 165.612) | 7.0:1 | Success text |
| warning-500 | oklch(0.837 0.148 88.335) | 3.0:1 | Warning backgrounds |
| warning-700 | oklch(0.664 0.167 71.658) | 4.5:1 | Warning text |
| error-500 | oklch(0.627 0.258 29.234) | 4.5:1 | Error states |
| error-700 | oklch(0.505 0.213 27.325) | 7.0:1 | Error text |
| info-500 | oklch(0.682 0.166 254.604) | 4.5:1 | Info states |
| info-700 | oklch(0.515 0.135 265.754) | 7.0:1 | Info text |

#### Neutral Colors

| Name | Value | Contrast | Usage |
|------|-------|----------|-------|
| gray-50 | oklch(0.984 0.003 247.858) | - | Page backgrounds |
| gray-100 | oklch(0.968 0.007 247.896) | - | Card backgrounds |
| gray-200 | oklch(0.933 0.011 256.542) | - | Borders, dividers |
| gray-300 | oklch(0.869 0.014 253.204) | - | Disabled backgrounds |
| gray-400 | oklch(0.709 0.022 256.788) | - | Placeholder text |
| gray-500 | oklch(0.553 0.026 255.508) | 3.5:1 | Secondary text |
| gray-600 | oklch(0.446 0.027 257.281) | 4.5:1 | Labels |
| gray-700 | oklch(0.372 0.024 265.755) | 5.8:1 | Body text |
| gray-800 | oklch(0.27 0.019 286.067) | 9.5:1 | Headings |
| gray-900 | oklch(0.205 0.015 285.938) | 12:1 | Primary text |

### 1.2 Spacing Tokens

```typescript
interface SpacingToken {
  name: string;    // e.g., "spacing-2"
  value: string;   // e.g., "16px"
  usage: string[]; // Where this spacing should be used
}
```

| Name | Value | Usage |
|------|-------|-------|
| spacing-0 | 0px | No spacing |
| spacing-0.5 | 4px | Tight inline spacing |
| spacing-1 | 8px | Icon gaps, tight padding |
| spacing-2 | 16px | Component padding, gaps |
| spacing-3 | 24px | Section padding |
| spacing-4 | 32px | Card padding |
| spacing-5 | 40px | Large gaps |
| spacing-6 | 48px | Section margins |
| spacing-8 | 64px | Page sections |
| spacing-10 | 80px | Hero sections |
| spacing-12 | 96px | Major divisions |

### 1.3 Typography Tokens

```typescript
interface TypographyToken {
  name: string;       // e.g., "text-lg"
  fontSize: string;   // e.g., "1.125rem"
  lineHeight: string; // e.g., "1.75rem"
  fontWeight?: number;// Optional weight
  usage: string[];    // Where this should be used
}
```

| Name | Size | Line Height | Usage |
|------|------|-------------|-------|
| text-xs | 0.75rem (12px) | 1rem | Badges, captions |
| text-sm | 0.875rem (14px) | 1.25rem | Labels, help text |
| text-base | 1rem (16px) | 1.5rem | Body text |
| text-lg | 1.125rem (18px) | 1.75rem | Lead paragraphs |
| text-xl | 1.25rem (20px) | 1.75rem | Card titles |
| text-2xl | 1.5rem (24px) | 2rem | Section headings |
| text-3xl | 1.875rem (30px) | 2.25rem | Page titles |
| text-4xl | 2.25rem (36px) | 2.5rem | Hero headings |

### 1.4 Shadow Tokens

```typescript
interface ShadowToken {
  name: string;   // e.g., "shadow-md"
  value: string;  // CSS box-shadow value
  elevation: number; // Conceptual elevation level
  usage: string[];
}
```

| Name | Value | Elevation | Usage |
|------|-------|-----------|-------|
| shadow-xs | 0 1px 2px 0 rgb(0 0 0 / 0.05) | 1 | Subtle depth |
| shadow-sm | 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1) | 2 | Buttons, inputs |
| shadow-md | 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) | 3 | Cards (resting) |
| shadow-lg | 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1) | 4 | Cards (hover) |
| shadow-xl | 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1) | 5 | Modals, dropdowns |

### 1.5 Border Radius Tokens

```typescript
interface RadiusToken {
  name: string;   // e.g., "radius-lg"
  value: string;  // e.g., "0.5rem"
  usage: string[];
}
```

| Name | Value | Usage |
|------|-------|-------|
| radius-none | 0px | Sharp corners |
| radius-sm | 0.125rem (2px) | Subtle rounding |
| radius-base | 0.25rem (4px) | Badges, tags |
| radius-md | 0.375rem (6px) | Inputs |
| radius-lg | 0.5rem (8px) | Buttons |
| radius-xl | 0.75rem (12px) | Cards |
| radius-2xl | 1rem (16px) | Large cards |
| radius-full | 9999px | Pills, avatars |

---

## 2. Component Variant Entities

### 2.1 Button Variants

```typescript
interface ButtonVariant {
  name: string;
  styles: {
    default: string;
    hover: string;
    focus: string;
    active: string;
    disabled: string;
  };
}
```

| Variant | Default | Hover | Active |
|---------|---------|-------|--------|
| primary | bg-primary-600 text-white | bg-primary-700 shadow-md | bg-primary-800 scale-[0.98] |
| secondary | border-2 border-primary-600 text-primary-700 | bg-primary-50 | bg-primary-100 |
| ghost | bg-transparent text-gray-700 | bg-gray-100 text-gray-900 | bg-gray-200 |
| danger | bg-error-600 text-white | bg-error-700 | bg-error-800 |

### 2.2 Input Variants

```typescript
interface InputVariant {
  name: string;
  styles: {
    default: string;
    focus: string;
    error: string;
    success: string;
    disabled: string;
  };
}
```

| State | Background | Border | Ring |
|-------|------------|--------|------|
| default | white | gray-300 | none |
| focus | white | primary-500 | primary-500/20 |
| error | error-50 | error-500 | error-500/20 |
| success | success-50 | success-500 | success-500/20 |
| disabled | gray-100 | gray-300 | none |

### 2.3 Card Variants

```typescript
interface CardVariant {
  name: string;
  elevation: 'flat' | 'raised' | 'elevated';
  interactive: boolean;
}
```

| Variant | Shadow (rest) | Shadow (hover) | Transform |
|---------|---------------|----------------|-----------|
| flat | none | none | none |
| raised | shadow-sm | shadow-lg | -translateY-0.5 |
| elevated | shadow-md | shadow-xl | -translateY-1 |

### 2.4 Badge Variants

```typescript
interface BadgeVariant {
  name: string;
  background: string;
  text: string;
}
```

| Variant | Background | Text |
|---------|------------|------|
| default | gray-100 | gray-800 |
| primary | primary-100 | primary-800 |
| success | success-100 | success-800 |
| warning | warning-100 | warning-800 |
| danger | error-100 | error-800 |
| info | info-100 | info-800 |

### 2.5 Table Row Variants

```typescript
interface TableRowVariant {
  name: string;
  background: {
    odd: string;
    even: string;
    hover: string;
    selected: string;
  };
}
```

| State | Background |
|-------|------------|
| odd | white |
| even | gray-50 |
| hover | primary-50 |
| selected | primary-100 |

---

## 3. Animation Entities

### 3.1 Transition Presets

```typescript
interface TransitionPreset {
  name: string;
  property: string;
  duration: string;
  easing: string;
}
```

| Name | Property | Duration | Easing |
|------|----------|----------|--------|
| colors | color, background-color, border-color | 150ms | ease-out |
| shadow | box-shadow | 200ms | ease-out |
| transform | transform | 200ms | ease-out |
| all | all | 200ms | ease-out |

### 3.2 Animation Keyframes

```typescript
interface AnimationKeyframe {
  name: string;
  duration: string;
  keyframes: Record<string, CSSProperties>;
}
```

| Name | Duration | Description |
|------|----------|-------------|
| fade-in | 300ms | Opacity 0 → 1 |
| slide-in | 300ms | Opacity 0 → 1, translateY -10px → 0 |
| scale-in | 200ms | Opacity 0 → 1, scale 0.95 → 1 |
| shimmer | 2000ms | TranslateX -100% → 100% (infinite) |
| pulse | 2000ms | Opacity 1 → 0.5 → 1 (infinite) |
| spin | 1000ms | Rotate 0 → 360deg (infinite) |

---

## 4. Layout Templates

### 4.1 Page Layout Structure

```typescript
interface PageLayout {
  name: string;
  sections: {
    header: { height: string; padding: string };
    content: { padding: string; maxWidth?: string };
    sidebar?: { width: string };
  };
}
```

| Layout | Header Height | Content Padding | Sidebar Width |
|--------|---------------|-----------------|---------------|
| dashboard | auto | spacing-6 | 256px |
| list | auto | spacing-6 | 256px |
| detail | auto | spacing-6 | 256px |
| form | auto | spacing-6 | 256px |

### 4.2 Card Layout Patterns

| Pattern | Padding | Gap | Usage |
|---------|---------|-----|-------|
| compact | spacing-3 | spacing-2 | Dashboard KPIs |
| standard | spacing-4 | spacing-3 | Content cards |
| spacious | spacing-6 | spacing-4 | Detail views |

---

## 5. Validation Rules

### 5.1 Color Contrast Validation

```typescript
interface ContrastRule {
  textColor: string;
  backgroundColor: string;
  minimumRatio: number;
  textSize: 'normal' | 'large';
}
```

| Text on Background | Minimum Ratio | Status |
|--------------------|---------------|--------|
| gray-700 on white | 4.5:1 | Required for body text |
| gray-900 on white | 4.5:1 | Required for body text |
| white on primary-600 | 4.5:1 | Required for buttons |
| error-700 on error-50 | 4.5:1 | Required for error text |
| primary-500 on white | 3:1 | Required for focus rings |

### 5.2 Animation Performance Rules

```typescript
interface AnimationRule {
  property: string;
  maxDuration: string;
  mustRespectReducedMotion: boolean;
}
```

| Rule | Max Duration | Reduced Motion |
|------|--------------|----------------|
| Color transitions | 200ms | Optional |
| Transform transitions | 300ms | Required |
| Opacity transitions | 300ms | Required |
| Loading animations | Infinite | Required |

---

## 6. State Transitions

### 6.1 Button State Machine

```
idle → hover → active → idle
idle → focus → active → idle
idle → disabled (terminal)
```

### 6.2 Input State Machine

```
idle → focus → idle
idle → focus → typing → blur → idle
idle → focus → typing → blur → error → focus → typing → blur → idle
idle → disabled (terminal)
```

### 6.3 Card Interaction State Machine

```
resting → hover → resting
resting → focus → resting
resting → hover → click → resting
```

---

## Notes

- All color values use OKLCH for perceptual uniformity
- All spacing follows 8px base unit
- All transitions respect prefers-reduced-motion
- All text meets WCAG 2.1 AA contrast requirements
