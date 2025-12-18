'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Loading state - shows spinner and disables interaction */
  loading?: boolean;
  /** @deprecated Use loading instead */
  isLoading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Left icon component */
  leftIcon?: React.ReactNode;
  /** Right icon component */
  rightIcon?: React.ReactNode;
}

const buttonVariants = {
  primary: cn(
    'bg-emerald-600 text-white',
    'hover:bg-emerald-700 hover:shadow-md',
    'active:bg-emerald-800 active:scale-[0.98]',
    'focus-visible:ring-emerald-500'
  ),
  secondary: cn(
    'bg-white text-emerald-700 border-2 border-emerald-600',
    'hover:bg-emerald-50 hover:border-emerald-700',
    'active:bg-emerald-100 active:scale-[0.98]',
    'focus-visible:ring-emerald-500'
  ),
  ghost: cn(
    'bg-transparent text-gray-700',
    'hover:bg-gray-100 hover:text-gray-900',
    'active:bg-gray-200 active:scale-[0.98]',
    'focus-visible:ring-gray-400'
  ),
  danger: cn(
    'bg-red-600 text-white',
    'hover:bg-red-700 hover:shadow-md',
    'active:bg-red-800 active:scale-[0.98]',
    'focus-visible:ring-red-500'
  ),
};

const buttonSizes = {
  sm: 'px-3 py-1.5 text-sm h-8',
  md: 'px-4 py-2 text-sm h-10',
  lg: 'px-6 py-3 text-base h-12',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading,
      isLoading,
      fullWidth,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isLoadingState = loading ?? isLoading;

    return (
      <button
        ref={ref}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center gap-2',
          'font-medium rounded-lg',
          'transition-all duration-150 ease-out',
          // Focus styles (WCAG compliant)
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          // Disabled styles
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-opacity-100',
          // Reduced motion support
          'motion-reduce:transition-none motion-reduce:active:transform-none',
          // Variant and size
          buttonVariants[variant],
          buttonSizes[size],
          // Full width
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || isLoadingState}
        {...props}
      >
        {isLoadingState && (
          <svg
            className="motion-safe:animate-spin h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!isLoadingState && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {!isLoadingState && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
