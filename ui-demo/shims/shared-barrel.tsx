/**
 * Demo stand-in for the `@/components/shared` barrel.
 *
 * The real barrel re-exports four DevExtreme-backed components (the confirm
 * dialog, the org-unit picker, the employee lookup and the position select).
 * Nothing the demo renders uses them, but a barrel import pulls them into the
 * bundle anyway — and DevExtreme's bundle prints "Redistribution prohibited",
 * which a public static site would be doing.
 *
 * So the demo re-exports the same names from the same modules, minus those
 * four. The components the screens actually use are the real ones.
 */
export { StatCard } from '@/components/shared/stat-card';
export type { StatCardProps, TrendIndicator } from '@/components/shared/stat-card';

export { StatusStepper } from '@/components/shared/StatusStepper';
export type { StatusStepperProps, StepperStep } from '@/components/shared/StatusStepper';

export { ResponsivePageHeader } from '@/components/shared/responsive-page-header';
export type { ResponsivePageHeaderProps } from '@/components/shared/responsive-page-header';

export { Breadcrumbs } from '@/components/shared/breadcrumbs';
export type { BreadcrumbsProps, BreadcrumbItem } from '@/components/shared/breadcrumbs';

export { MobileListView } from '@/components/shared/mobile-list-view';
export type { MobileListViewProps } from '@/components/shared/mobile-list-view';

export { DateRangeFilter } from '@/components/shared/date-range-filter';
export type { DateRangeFilterProps } from '@/components/shared/date-range-filter';

export { AwaitingOtherVerifierBadge } from '@/components/shared/awaiting-other-verifier-badge';
export type { AwaitingOtherVerifierBadgeProps } from '@/components/shared/awaiting-other-verifier-badge';

export {
  ResponsiveFormLayout,
  FormSection,
  FormField,
} from '@/components/shared/responsive-form-layout';
export type {
  ResponsiveFormLayoutProps,
  FormSectionProps,
  FormFieldProps,
  GapSize,
  ColumnCount,
  ColSpan,
} from '@/components/shared/responsive-form-layout';
