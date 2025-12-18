'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const inputVariants = cva(
  'block w-full rounded-xl border-2 transition-all duration-200 ease-out motion-reduce:transition-none disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 placeholder:text-gray-400',
  {
    variants: {
      variant: {
        default: 'bg-white border-gray-200 hover:border-gray-300 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10',
        search: 'bg-gray-50 border-gray-200 hover:bg-white hover:border-gray-300 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10',
        filled: 'bg-gray-100 border-transparent hover:bg-gray-50 hover:border-gray-200 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10',
      },
      inputSize: {
        sm: 'px-2.5 py-1.5 text-sm',
        md: 'px-3.5 py-2.5 text-base',
        lg: 'px-4 py-3 text-lg',
        // shadcn/ui standard size
        default: 'h-10 px-3 py-2 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      inputSize: 'md',
    },
  }
);

const sizeStyles = {
  sm: {
    iconLeft: 'left-2.5',
    iconRight: 'right-2.5',
    iconSize: 'h-4 w-4',
    paddingLeft: 'pl-8',
    paddingRight: 'pr-8',
    label: 'text-xs',
  },
  md: {
    iconLeft: 'left-3',
    iconRight: 'right-3',
    iconSize: 'h-5 w-5',
    paddingLeft: 'pl-10',
    paddingRight: 'pr-10',
    label: 'text-sm',
  },
  lg: {
    iconLeft: 'left-3.5',
    iconRight: 'right-3.5',
    iconSize: 'h-6 w-6',
    paddingLeft: 'pl-12',
    paddingRight: 'pr-12',
    label: 'text-sm',
  },
  default: {
    iconLeft: 'left-3',
    iconRight: 'right-3',
    iconSize: 'h-4 w-4',
    paddingLeft: 'pl-9',
    paddingRight: 'pr-9',
    label: 'text-sm',
  },
};

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  /** Label text */
  label?: string;
  /** Helper/description text */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Success state */
  success?: boolean;
  /** Size variant (use inputSize to avoid conflict with HTML size) */
  size?: 'sm' | 'md' | 'lg' | 'default';
  /** Left icon */
  leftIcon?: React.ReactNode;
  /** Right icon */
  rightIcon?: React.ReactNode;
  /** Search handler on enter */
  onSearch?: () => void;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      success,
      id,
      size = 'md',
      inputSize,
      variant = 'default',
      leftIcon,
      rightIcon,
      onSearch,
      disabled,
      type,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const effectiveSize = inputSize || size;
    const sizeStyle = sizeStyles[effectiveSize];

    // Determine if we show an icon on the right (error/success indicator)
    const showStatusIcon = error || success;
    const hasLeftIcon = leftIcon || variant === 'search';
    const hasRightIcon = rightIcon || showStatusIcon;

    const stateStyles = cn(
      error && 'border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-red-500/10',
      success && !error && 'border-emerald-400 bg-emerald-50/50 focus:border-emerald-500 focus:ring-emerald-500/10'
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && onSearch) {
        onSearch();
      }
      props.onKeyDown?.(e);
    };

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'block font-medium text-gray-700 mb-1.5',
              sizeStyle.label
            )}
          >
            {label}
          </label>
        )}

        <div className="relative">
          {/* Left Icon or Search Icon */}
          {hasLeftIcon && (
            <div
              className={cn(
                'absolute top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none',
                sizeStyle.iconLeft,
                error && 'text-red-400',
                success && !error && 'text-emerald-500'
              )}
            >
              {leftIcon || <Search className={sizeStyle.iconSize} />}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={type}
            disabled={disabled}
            className={cn(
              inputVariants({ variant, inputSize: effectiveSize }),
              stateStyles,
              hasLeftIcon && sizeStyle.paddingLeft,
              hasRightIcon && sizeStyle.paddingRight,
              className
            )}
            onKeyDown={handleKeyDown}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            {...props}
          />

          {/* Right Icon - priority: custom rightIcon > status icon */}
          {hasRightIcon && (
            <div
              className={cn(
                'absolute top-1/2 -translate-y-1/2',
                sizeStyle.iconRight,
                rightIcon && 'text-gray-400',
                !rightIcon && error && 'text-red-500',
                !rightIcon && success && !error && 'text-emerald-500'
              )}
            >
              {rightIcon || (
                <>
                  {error && <AlertCircle className={sizeStyle.iconSize} />}
                  {success && !error && <CheckCircle2 className={sizeStyle.iconSize} />}
                </>
              )}
            </div>
          )}
        </div>

        {/* Helper Text or Error Message */}
        {(error || helperText) && (
          <p
            id={error ? `${inputId}-error` : `${inputId}-helper`}
            className={cn(
              'mt-1.5 flex items-center gap-1',
              sizeStyle.label,
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

Input.displayName = 'Input';

// SearchInput component for convenience
interface SearchInputProps extends Omit<InputProps, 'variant' | 'leftIcon'> {
  onSearch?: () => void;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onSearch, ...props }, ref) => {
    return <Input ref={ref} variant="search" onSearch={onSearch} {...props} />;
  }
);

SearchInput.displayName = 'SearchInput';

export { Input, SearchInput, inputVariants };
