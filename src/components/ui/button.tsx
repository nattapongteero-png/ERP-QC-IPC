'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-emerald-600 text-white shadow hover:bg-emerald-700 active:bg-emerald-800 active:scale-[0.98]',
        destructive:
          'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 active:scale-[0.98]',
        outline:
          'border-2 border-emerald-600 bg-white text-emerald-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-700 active:bg-emerald-100 active:scale-[0.98]',
        secondary:
          'bg-gray-100 text-gray-900 shadow-sm hover:bg-gray-200 active:bg-gray-300 active:scale-[0.98]',
        ghost:
          'text-gray-700 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200 active:scale-[0.98]',
        link: 'text-emerald-600 underline-offset-4 hover:underline',
        // Legacy variants for backwards compatibility
        primary:
          'bg-emerald-600 text-white shadow hover:bg-emerald-700 active:bg-emerald-800 active:scale-[0.98]',
        danger:
          'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 active:scale-[0.98]',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-lg px-8 text-base',
        icon: 'h-10 w-10',
        // Legacy size for backwards compatibility
        md: 'h-10 px-4 py-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
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

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
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
    const Comp = asChild ? Slot : 'button';
    const isLoadingState = loading ?? isLoading;

    // If using asChild, don't modify children structure
    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }), fullWidth && 'w-full')}
          ref={ref}
          disabled={disabled || isLoadingState}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }), fullWidth && 'w-full')}
        ref={ref}
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
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
