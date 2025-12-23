// Core UI Components - shadcn/ui compatible
export { Button, buttonVariants } from './button';
export type { ButtonProps } from './button';

export { Badge, badgeVariants, getStatusVariant } from './badge';
export type { BadgeProps } from './badge';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardVariants,
} from './card';
export type { CardProps } from './card';

export { Input, SearchInput, inputVariants } from './input';
export type { InputProps } from './input';

export { Select, selectVariants } from './select';
export type { SelectProps } from './select';

export {
  Table,
  TableRoot,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableSkeleton,
  TableRowSkeleton,
} from './table';

export { Skeleton, CardSkeleton, skeletonVariants } from './skeleton';
export type { SkeletonProps } from './skeleton';

export { Separator } from './separator';

// Dialog
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './dialog';

// Dropdown Menu
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from './dropdown-menu';

// Tooltip
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from './tooltip';

// Custom Components - Application-specific
export { KPICard, KPICardSkeleton, trendVariants } from './kpi-card';
export type { KPICardProps } from './kpi-card';

export { StatCard, StatCardSkeleton, statCardVariants } from './stat-card';
export type { StatCardProps } from './stat-card';

export { EmptyState, emptyStateVariants } from './empty-state';
export type { EmptyStateProps } from './empty-state';

export {
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
} from './page-header';
export type { PageHeaderProps } from './page-header';

// DevExtreme Components
export { DxButton, DxPrimaryButton, DxSecondaryButton, DxDangerButton, DxTextButton } from './dx-button';
export type { DxButtonProps, DxButtonType, DxButtonStylingMode } from './dx-button';

export { DxTextBox } from './dx-text-box';
export type { DxTextBoxProps, DxTextBoxMode } from './dx-text-box';

export { DxSelectBox } from './dx-select-box';
export type { DxSelectBoxProps, DxSelectBoxOption } from './dx-select-box';

export { DxDateBox } from './dx-date-box';
export type { DxDateBoxProps, DxDateBoxType } from './dx-date-box';

export { DxDataGrid } from './dx-data-grid';
export type { DxDataGridProps, DxDataGridColumn } from './dx-data-grid';

export { DxPopup, DxConfirmDialog } from './dx-popup';
export type { DxPopupProps, DxConfirmDialogProps } from './dx-popup';

export { DxForm, DxFormItem, DxFormGroup, DxFormEmpty, DxFormButton, DxFormLabel, validateFormGroup, resetFormValidation } from './dx-form';
export type { DxFormProps } from './dx-form';

export { DxLoadIndicator, DxLoadPanel, DxSkeleton } from './dx-load-indicator';
export type { DxLoadIndicatorProps, DxLoadPanelProps, DxSkeletonProps } from './dx-load-indicator';

// Search Dialogs
export { TppSearchDialog } from './tpp-search-dialog';
export type { TppItem } from './tpp-search-dialog';

export { TtmtSearchDialog } from './ttmt-search-dialog';
export type { TtmtItem } from './ttmt-search-dialog';

// Document Attachment
export { DocumentAttachment } from './document-attachment';
export type { DocumentAttachmentProps, Attachment } from './document-attachment';
