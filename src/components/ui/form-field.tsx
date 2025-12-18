'use client';

import { HTMLAttributes, forwardRef, ReactNode, cloneElement, isValidElement } from 'react';
import { AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface FormFieldProps extends HTMLAttributes<HTMLDivElement> {
  /** Label text */
  label?: string;
  /** Label description/subtitle */
  labelDescription?: string;
  /** Helper/description text shown below the input */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Success message */
  success?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Tooltip content */
  tooltip?: string;
  /** ID for the input (used for label htmlFor) */
  htmlFor?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Children (the input element) */
  children: ReactNode;
}

const sizeStyles = {
  sm: {
    label: 'text-xs',
    description: 'text-xs',
    helper: 'text-xs',
  },
  md: {
    label: 'text-sm',
    description: 'text-xs',
    helper: 'text-sm',
  },
  lg: {
    label: 'text-base',
    description: 'text-sm',
    helper: 'text-sm',
  },
};

export const FormField = forwardRef<HTMLDivElement, FormFieldProps>(
  (
    {
      className,
      label,
      labelDescription,
      helperText,
      error,
      success,
      required,
      tooltip,
      htmlFor,
      size = 'md',
      children,
      ...props
    },
    ref
  ) => {
    const sizeStyle = sizeStyles[size];
    const hasMessage = error || success || helperText;

    // Clone child and pass error/success state if it's a valid element
    const childWithProps = isValidElement(children)
      ? cloneElement(children, {
          error: error || undefined,
          success: success && !error ? true : undefined,
          'aria-invalid': !!error,
          'aria-describedby': hasMessage
            ? `${htmlFor || 'field'}-message`
            : undefined,
        } as Record<string, unknown>)
      : children;

    return (
      <div ref={ref} className={cn('w-full space-y-1.5', className)} {...props}>
        {/* Label Row */}
        {label && (
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <label
                htmlFor={htmlFor}
                className={cn(
                  'block font-medium text-gray-700',
                  sizeStyle.label
                )}
              >
                {label}
                {required && (
                  <span className="text-red-500 ml-0.5" aria-hidden="true">
                    *
                  </span>
                )}
              </label>
              {labelDescription && (
                <p className={cn('text-gray-500 mt-0.5', sizeStyle.description)}>
                  {labelDescription}
                </p>
              )}
            </div>
            {tooltip && (
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 -m-1"
                title={tooltip}
                aria-label={`More info: ${tooltip}`}
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Input */}
        <div className="w-full">{childWithProps}</div>

        {/* Message (Error, Success, or Helper) */}
        {hasMessage && (
          <div
            id={`${htmlFor || 'field'}-message`}
            className={cn(
              'flex items-start gap-1.5',
              sizeStyle.helper,
              error && 'text-red-600',
              success && !error && 'text-emerald-600',
              !error && !success && 'text-gray-500'
            )}
            role={error ? 'alert' : undefined}
          >
            {error && (
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            )}
            {success && !error && (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
            )}
            <span>{error || success || helperText}</span>
          </div>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';

// Horizontal FormField layout variant
interface FormFieldRowProps extends FormFieldProps {
  /** Label width */
  labelWidth?: string;
}

export const FormFieldRow = forwardRef<HTMLDivElement, FormFieldRowProps>(
  (
    {
      className,
      label,
      labelDescription,
      helperText,
      error,
      success,
      required,
      tooltip,
      htmlFor,
      size = 'md',
      labelWidth = 'w-1/3',
      children,
      ...props
    },
    ref
  ) => {
    const sizeStyle = sizeStyles[size];
    const hasMessage = error || success || helperText;

    // Clone child and pass error/success state if it's a valid element
    const childWithProps = isValidElement(children)
      ? cloneElement(children, {
          error: error || undefined,
          success: success && !error ? true : undefined,
          'aria-invalid': !!error,
          'aria-describedby': hasMessage
            ? `${htmlFor || 'field'}-message`
            : undefined,
        } as Record<string, unknown>)
      : children;

    return (
      <div
        ref={ref}
        className={cn('flex flex-col md:flex-row md:items-start gap-3', className)}
        {...props}
      >
        {/* Label Column */}
        {label && (
          <div className={cn('flex-shrink-0', labelWidth)}>
            <div className="flex items-start gap-1">
              <label
                htmlFor={htmlFor}
                className={cn(
                  'block font-medium text-gray-700 pt-2',
                  sizeStyle.label
                )}
              >
                {label}
                {required && (
                  <span className="text-red-500 ml-0.5" aria-hidden="true">
                    *
                  </span>
                )}
              </label>
              {tooltip && (
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 -m-1 mt-1"
                  title={tooltip}
                  aria-label={`More info: ${tooltip}`}
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              )}
            </div>
            {labelDescription && (
              <p className={cn('text-gray-500 mt-0.5', sizeStyle.description)}>
                {labelDescription}
              </p>
            )}
          </div>
        )}

        {/* Input Column */}
        <div className="flex-1 space-y-1.5">
          {childWithProps}

          {/* Message */}
          {hasMessage && (
            <div
              id={`${htmlFor || 'field'}-message`}
              className={cn(
                'flex items-start gap-1.5',
                sizeStyle.helper,
                error && 'text-red-600',
                success && !error && 'text-emerald-600',
                !error && !success && 'text-gray-500'
              )}
              role={error ? 'alert' : undefined}
            >
              {error && (
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              )}
              {success && !error && (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
              )}
              <span>{error || success || helperText}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
);

FormFieldRow.displayName = 'FormFieldRow';
