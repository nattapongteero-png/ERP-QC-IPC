/**
 * ResponsivePageHeader Component Contract
 * Feature: 007-hr-personnel-management
 * Date: 2025-12-21
 *
 * A responsive page header component that adapts layout based on viewport.
 * Used consistently across all HR pages for professional appearance.
 */

import type { LucideIcon } from 'lucide-react';

/**
 * Breadcrumb navigation item
 */
export interface BreadcrumbItem {
  /** Display text */
  label: string;
  /** Navigation URL (optional - last item typically has no href) */
  href?: string;
}

/**
 * Props for ResponsivePageHeader component
 */
export interface ResponsivePageHeaderProps {
  // === Required Props ===

  /** Main title text (Thai) */
  title: string;

  // === Optional Props ===

  /** Subtitle or English translation */
  subtitle?: string;

  /** Icon component from lucide-react */
  icon?: LucideIcon;

  /** Icon background color class (e.g., "bg-emerald-100") */
  iconBgColor?: string;

  /** Icon color class (e.g., "text-emerald-600") */
  iconColor?: string;

  /** Actions to display on the right side (buttons, etc.) */
  actions?: React.ReactNode;

  /** Back button handler - if provided, shows back button */
  onBack?: () => void;

  /** Breadcrumb navigation items */
  breadcrumbs?: BreadcrumbItem[];

  /** Additional CSS classes for container */
  className?: string;
}

/**
 * Component Behavior Contract:
 *
 * 1. LAYOUT RESPONSIVENESS:
 *    - Desktop (lg+): Single row with title left, actions right
 *    - Tablet (md): Same as desktop, actions may wrap
 *    - Mobile (<md): Stacked layout - title row, then actions row
 *
 * 2. BACK BUTTON:
 *    - Only renders if onBack is provided
 *    - Uses DevExtreme Button with icon="back" and stylingMode="text"
 *    - Positioned to the left of the icon
 *
 * 3. ICON DISPLAY:
 *    - Renders inside a rounded container with iconBgColor
 *    - Icon uses iconColor class
 *    - Default sizes: container p-3, icon h-7 w-7
 *
 * 4. BREADCRUMBS:
 *    - Rendered above the main header row
 *    - Uses separator "/" between items
 *    - Last item is not clickable
 *    - Hidden on mobile (sm and below) to save space
 *
 * 5. ACTIONS SLOT:
 *    - Accepts any React nodes (typically DxButton components)
 *    - Uses flex-wrap to handle overflow
 *    - Gap between items: gap-2 on mobile, gap-3 on desktop
 */

// Example Usage:
/*
import { Users } from 'lucide-react';
import { ResponsivePageHeader } from '@/components/shared/responsive-page-header';
import { DxButton } from '@/components/ui/dx-button';

<ResponsivePageHeader
  title="พนักงาน"
  subtitle="Employees"
  icon={Users}
  iconBgColor="bg-emerald-100"
  iconColor="text-emerald-600"
  breadcrumbs={[
    { label: 'HR', href: '/hr' },
    { label: 'พนักงาน' }
  ]}
  actions={
    <>
      <DxButton text="เพิ่มพนักงาน" icon="add" type="success" />
      <DxButton text="นำเข้า" icon="import" stylingMode="outlined" />
    </>
  }
/>
*/

// CSS Classes Reference:
/*
Container:
  "flex flex-col lg:flex-row lg:items-center justify-between gap-4"

Title Section:
  "flex items-center gap-4"

Icon Container:
  "p-3 rounded-lg" + iconBgColor

Icon Element:
  "h-7 w-7" + iconColor

Title Text:
  "text-2xl font-bold text-gray-900"

Subtitle Text:
  "text-gray-500 mt-1"

Actions Section:
  "flex flex-wrap gap-2 lg:gap-3"

Breadcrumbs:
  "text-sm text-gray-500 mb-2 hidden md:block"
*/
