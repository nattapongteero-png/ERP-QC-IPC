/**
 * Component Contracts Index
 * Feature: 007-hr-personnel-management
 * Date: 2025-12-21
 *
 * This file serves as documentation index for all UI component contracts
 * defined for the HR module responsive redesign.
 */

// Re-export all contract types for reference
export type {
  ResponsivePageHeaderProps,
  BreadcrumbItem,
} from './responsive-page-header.contract';

export type {
  StatCardProps,
  TrendIndicator,
} from './stat-card.contract';

export type {
  ResponsiveDataGridProps,
  ResponsiveColumn,
} from './responsive-data-grid.contract';

export type {
  MobileListViewProps,
  SwipeAction,
} from './mobile-list-view.contract';

export type {
  ResponsiveFormLayoutProps,
  FormSectionProps,
  FormFieldProps,
  GapSize,
  ColumnCount,
  ColSpan,
} from './responsive-form-layout.contract';

/**
 * Component Implementation Checklist
 *
 * When implementing each component, ensure:
 *
 * 1. [ ] Props match contract interface exactly
 * 2. [ ] All optional props have sensible defaults
 * 3. [ ] Responsive behavior matches contract specification
 * 4. [ ] CSS classes match contract reference
 * 5. [ ] Loading states implemented
 * 6. [ ] Empty states implemented
 * 7. [ ] Accessibility considered (aria labels, keyboard nav)
 * 8. [ ] Component exported from @/components/shared/index.ts
 */

/**
 * Component File Locations
 *
 * | Component             | Source File                                      |
 * |-----------------------|--------------------------------------------------|
 * | ResponsivePageHeader  | src/components/shared/responsive-page-header.tsx |
 * | StatCard              | src/components/shared/stat-card.tsx              |
 * | ResponsiveDataGrid    | src/components/shared/responsive-data-grid.tsx   |
 * | MobileListView        | src/components/shared/mobile-list-view.tsx       |
 * | ResponsiveFormLayout  | src/components/shared/responsive-form-layout.tsx |
 * | FormSection           | src/components/shared/responsive-form-layout.tsx |
 * | FormField             | src/components/shared/responsive-form-layout.tsx |
 */

/**
 * Pages Using Each Component
 *
 * ResponsivePageHeader:
 *   - All 16 HR pages
 *
 * StatCard:
 *   - /hr (Dashboard)
 *   - /hr/training (Training landing)
 *   - /hr/employees (Employee list stats)
 *
 * ResponsiveDataGrid:
 *   - /hr/employees
 *   - /hr/positions
 *   - /hr/training/courses
 *   - /hr/training/sessions
 *   - /hr/authorizations
 *   - /hr/health-records
 *   - /hr/roles
 *   - /hr/notifications
 *   - /hr/audit
 *
 * MobileListView:
 *   - /hr/employees (mobile only)
 *   - /hr/notifications (mobile only)
 *
 * ResponsiveFormLayout:
 *   - /hr/employees/new
 *   - /hr/employees/[id] (edit form)
 *   - /hr/positions (side panel form)
 *   - /hr/org (org unit form)
 *   - /hr/training/courses (course form)
 *   - /hr/training/sessions (session form)
 *   - /hr/authorizations (authorization form)
 *   - /hr/health-records (health record form)
 */
