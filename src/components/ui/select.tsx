'use client';

import { SelectHTMLAttributes, forwardRef, ReactNode } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Label text */
  label?: string;
  /** Helper/description text */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Options array */
  options?: SelectOption[];
  /** Children (alternative to options) */
  children?: ReactNode;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Full width */
  fullWidth?: boolean;
}

const sizeStyles = {
  sm: {
    select: 'px-2.5 py-1.5 text-sm pr-8',
    icon: 'right-2',
    iconSize: 'h-4 w-4',
  },
  md: {
    select: 'px-3.5 py-2.5 text-base pr-10',
    icon: 'right-3',
    iconSize: 'h-5 w-5',
  },
  lg: {
    select: 'px-4 py-3 text-lg pr-12',
    icon: 'right-3.5',
    iconSize: 'h-6 w-6',
  },
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      id,
      options,
      children,
      size = 'md',
      fullWidth = true,
      disabled,
      ...props
    },
    ref
  ) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const sizeStyle = sizeStyles[size];

    return (
      <div className={cn('w-full', !fullWidth && 'w-auto')}>
        {label && (
          <label
            htmlFor={selectId}
            className={cn(
              'block font-medium text-gray-700 mb-1.5',
              size === 'sm' ? 'text-xs' : 'text-sm'
            )}
          >
            {label}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={cn(
              'block w-full rounded-xl border-2 appearance-none',
              'bg-white border-gray-200',
              'transition-all duration-200 ease-out',
              'motion-reduce:transition-none',
              'hover:border-gray-300',
              'focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10',
              'disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60',
              error && 'border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-red-500/10',
              sizeStyle.select,
              className
            )}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined
            }
            {...props}
          >
            {options
              ? options.map((option) => (
                  <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))
              : children}
          </select>

          {/* Chevron Icon */}
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 pointer-events-none',
              sizeStyle.icon,
              error ? 'text-red-400' : 'text-gray-400'
            )}
          >
            <ChevronDown className={sizeStyle.iconSize} />
          </div>
        </div>

        {/* Helper Text or Error Message */}
        {(error || helperText) && (
          <p
            id={error ? `${selectId}-error` : `${selectId}-helper`}
            className={cn(
              'mt-1.5 flex items-center gap-1',
              size === 'sm' ? 'text-xs' : 'text-sm',
              error ? 'text-red-600' : 'text-gray-500'
            )}
          >
            {error && <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />}
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
