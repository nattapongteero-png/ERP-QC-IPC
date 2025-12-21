'use client';

/**
 * ResponsiveFormLayout Components
 * Feature: 007-hr-personnel-management
 *
 * Form layout components that stack fields on mobile and use
 * multi-column grid on larger screens.
 */

import React from 'react';

export type GapSize = 'sm' | 'md' | 'lg';
export type ColumnCount = 1 | 2 | 3 | 4;
export type ColSpan = 1 | 2 | 3 | 4 | 'full';

const gapClasses: Record<GapSize, string> = {
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
};

const columnClasses: Record<ColumnCount, string> = {
  1: 'grid grid-cols-1',
  2: 'grid grid-cols-1 md:grid-cols-2',
  3: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

export interface ResponsiveFormLayoutProps {
  /** Form sections and fields as children */
  children: React.ReactNode;
  /** Number of columns on desktop (default: 2) */
  columns?: ColumnCount;
  /** Gap between fields (default: 'md') */
  gap?: GapSize;
  /** Additional CSS classes */
  className?: string;
}

export function ResponsiveFormLayout({
  children,
  columns = 2,
  gap = 'md',
  className = '',
}: ResponsiveFormLayoutProps) {
  return (
    <div className={`${columnClasses[columns]} ${gapClasses[gap]} ${className}`}>
      {children}
    </div>
  );
}

export interface FormSectionProps {
  /** Section title */
  title?: string;
  /** Section description/help text */
  description?: string;
  /** Fields in this section */
  children: React.ReactNode;
  /** Override column count for this section */
  columns?: ColumnCount;
  /** Additional CSS classes */
  className?: string;
}

export function FormSection({
  title,
  description,
  children,
  columns = 2,
  className = '',
}: FormSectionProps) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-6 space-y-4 ${className}`}>
      {title && (
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
          {title}
        </h2>
      )}
      {description && (
        <p className="text-sm text-gray-500">{description}</p>
      )}
      <div className={`${columnClasses[columns]} gap-4`}>
        {children}
      </div>
    </div>
  );
}

export interface FormFieldProps {
  /** Field label */
  label: string;
  /** Required field indicator */
  required?: boolean;
  /** Error message */
  error?: string;
  /** Help text below field */
  helpText?: string;
  /** Column span for this field */
  colSpan?: ColSpan;
  /** Field input element */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Hide label visually (still accessible) */
  labelHidden?: boolean;
}

const colSpanClasses: Record<ColSpan, string> = {
  1: '',
  2: 'md:col-span-2',
  3: 'md:col-span-2 lg:col-span-3',
  4: 'md:col-span-2 lg:col-span-4',
  full: 'col-span-full',
};

export function FormField({
  label,
  required = false,
  error,
  helpText,
  colSpan = 1,
  children,
  className = '',
  labelHidden = false,
}: FormFieldProps) {
  return (
    <div className={`space-y-1 ${colSpanClasses[colSpan]} ${className}`}>
      <label
        className={`block text-sm font-medium text-gray-700 ${labelHidden ? 'sr-only' : ''}`}
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {helpText && !error && (
        <p className="text-sm text-gray-500">{helpText}</p>
      )}
    </div>
  );
}

export default ResponsiveFormLayout;
