/**
 * ResponsiveFormLayout Component Contract
 * Feature: 007-hr-personnel-management
 * Date: 2025-12-21
 *
 * Form layout components that stack fields on mobile and use
 * multi-column grid on larger screens.
 */

/**
 * Gap size options
 */
export type GapSize = 'sm' | 'md' | 'lg';

/**
 * Column count options
 */
export type ColumnCount = 1 | 2 | 3 | 4;

/**
 * Column span options
 */
export type ColSpan = 1 | 2 | 3 | 4 | 'full';

/**
 * Props for ResponsiveFormLayout container
 */
export interface ResponsiveFormLayoutProps {
  /** Form sections and fields as children */
  children: React.ReactNode;

  /**
   * Number of columns on desktop
   * @default 2
   */
  columns?: ColumnCount;

  /**
   * Gap between fields
   * @default 'md'
   */
  gap?: GapSize;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for FormSection component
 */
export interface FormSectionProps {
  /** Section title */
  title?: string;

  /** Section description/help text */
  description?: string;

  /** Fields in this section */
  children: React.ReactNode;

  /**
   * Override column count for this section
   * If not specified, inherits from parent
   */
  columns?: ColumnCount;

  /** Collapsible section */
  collapsible?: boolean;

  /** Initial collapsed state */
  defaultCollapsed?: boolean;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for FormField wrapper component
 */
export interface FormFieldProps {
  /** Field label */
  label: string;

  /** Required field indicator */
  required?: boolean;

  /** Error message */
  error?: string;

  /** Help text below field */
  helpText?: string;

  /**
   * Column span for this field
   * 'full' spans all columns
   * @default 1
   */
  colSpan?: ColSpan;

  /** Field input element */
  children: React.ReactNode;

  /** Additional CSS classes */
  className?: string;

  /** Hide label visually (still accessible) */
  labelHidden?: boolean;
}

/**
 * Component Behavior Contract:
 *
 * 1. RESPONSIVE GRID:
 *    - Mobile (<md): Always 1 column
 *    - Tablet (md): 2 columns (or columns prop if 1)
 *    - Desktop (lg+): columns prop value
 *
 * 2. GAP SIZES:
 *    - sm: gap-3 (12px)
 *    - md: gap-4 (16px)
 *    - lg: gap-6 (24px)
 *
 * 3. FORM SECTION:
 *    - Title: Bold, border-bottom
 *    - Description: Smaller, gray text
 *    - Content: Grid layout for fields
 *    - Spacing: mb-6 between sections
 *
 * 4. FORM FIELD:
 *    - Label above input
 *    - Required indicator (*) in red
 *    - Error message below input in red
 *    - Help text below input in gray
 *
 * 5. COLUMN SPANNING:
 *    - colSpan='full' uses col-span-full
 *    - Other values use col-span-{n}
 *    - Respects responsive behavior
 */

// Example Usage:
/*
import {
  ResponsiveFormLayout,
  FormSection,
  FormField,
} from '@/components/shared/responsive-form-layout';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxDateBox } from '@/components/ui/dx-date-box';

<ResponsiveFormLayout columns={2} gap="md">
  <FormSection title="ข้อมูลพื้นฐาน" description="กรอกข้อมูลส่วนตัวของพนักงาน">
    <FormField label="รหัสพนักงาน" required>
      <DxTextBox
        value={formData.employeeCode}
        onValueChange={(v) => setField('employeeCode', v)}
        placeholder="EMP001"
      />
    </FormField>

    <FormField label="ชื่อ" required error={errors.firstName}>
      <DxTextBox
        value={formData.firstName}
        onValueChange={(v) => setField('firstName', v)}
      />
    </FormField>

    <FormField label="นามสกุล" required error={errors.lastName}>
      <DxTextBox
        value={formData.lastName}
        onValueChange={(v) => setField('lastName', v)}
      />
    </FormField>

    <FormField label="วันที่เริ่มงาน" required>
      <DxDateBox
        value={formData.hireDate}
        onValueChange={(v) => setField('hireDate', v)}
      />
    </FormField>
  </FormSection>

  <FormSection title="ข้อมูลติดต่อ">
    <FormField label="อีเมล" helpText="ใช้สำหรับรับการแจ้งเตือน">
      <DxTextBox
        mode="email"
        value={formData.email}
        onValueChange={(v) => setField('email', v)}
      />
    </FormField>

    <FormField label="เบอร์โทร">
      <DxTextBox
        mode="tel"
        value={formData.phone}
        onValueChange={(v) => setField('phone', v)}
      />
    </FormField>

    <FormField label="ที่อยู่" colSpan="full">
      <DxTextBox
        value={formData.address}
        onValueChange={(v) => setField('address', v)}
      />
    </FormField>
  </FormSection>
</ResponsiveFormLayout>
*/

// CSS Classes Reference:
/*
ResponsiveFormLayout container:
  2 columns: "grid grid-cols-1 md:grid-cols-2 gap-4"
  3 columns: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
  4 columns: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"

FormSection container:
  "bg-white rounded-xl border border-gray-200 p-6 space-y-4 mb-6"

FormSection title:
  "text-lg font-semibold text-gray-900 border-b pb-2"

FormSection description:
  "text-sm text-gray-500 mb-4"

FormField container:
  "space-y-1" + colSpan classes

FormField label:
  "block text-sm font-medium text-gray-700"

Required indicator:
  "text-red-500 ml-1"

Error message:
  "text-sm text-red-600 mt-1"

Help text:
  "text-sm text-gray-500 mt-1"

Column span classes:
  colSpan={1}: "" (default)
  colSpan={2}: "md:col-span-2"
  colSpan={3}: "md:col-span-2 lg:col-span-3"
  colSpan={4}: "md:col-span-2 lg:col-span-4"
  colSpan="full": "col-span-full"
*/
