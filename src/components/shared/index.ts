/**
 * Shared Components
 *
 * Reusable UI components used across the application.
 * Per Constitution I.Reusable Components, common UI patterns
 * are extracted here for consistency and DRY principle.
 */

export { ConfirmationDialog } from './ConfirmationDialog';
export type { ConfirmationDialogProps } from './ConfirmationDialog';

export { OrgUnitPicker } from './OrgUnitPicker';
export type { OrgUnitPickerProps } from './OrgUnitPicker';

export { EmployeeLookup } from './EmployeeLookup';
export type { EmployeeLookupProps } from './EmployeeLookup';

export { PositionSelect } from './PositionSelect';
export type { PositionSelectProps } from './PositionSelect';

// Responsive UI Components (007-hr-personnel-management)
export { StatCard } from './stat-card';
export type { StatCardProps, TrendIndicator } from './stat-card';

export { StatusStepper } from './StatusStepper';
export type { StatusStepperProps, StepperStep } from './StatusStepper';

export { ResponsivePageHeader } from './responsive-page-header';
export type { ResponsivePageHeaderProps } from './responsive-page-header';

export { Breadcrumbs } from './breadcrumbs';
export type { BreadcrumbsProps, BreadcrumbItem } from './breadcrumbs';

export {
  ResponsiveFormLayout,
  FormSection,
  FormField,
} from './responsive-form-layout';
export type {
  ResponsiveFormLayoutProps,
  FormSectionProps,
  FormFieldProps,
  GapSize,
  ColumnCount,
  ColSpan,
} from './responsive-form-layout';

export { MobileListView } from './mobile-list-view';
export type { MobileListViewProps } from './mobile-list-view';

export { DateRangeFilter } from './date-range-filter';
export type { DateRangeFilterProps } from './date-range-filter';

// GMP Dual-Control — shown when logged-in user is the step's operator
export { AwaitingOtherVerifierBadge } from './awaiting-other-verifier-badge';
export type { AwaitingOtherVerifierBadgeProps } from './awaiting-other-verifier-badge';

// Audit Q3/Q4/Q5 — reusable file attachment panel
export { AttachmentPanel } from './AttachmentPanel';
export type { AttachmentPanelProps } from './AttachmentPanel';
