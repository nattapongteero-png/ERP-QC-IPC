'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';
import { Button } from './button';

const emptyStateVariants = cva(
  'flex flex-col items-center justify-center text-center',
  {
    variants: {
      size: {
        sm: 'py-6 px-4 gap-2',
        md: 'py-10 px-6 gap-3',
        lg: 'py-16 px-8 gap-4',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const iconSizeStyles = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
};

const titleSizeStyles = {
  sm: 'text-base font-medium',
  md: 'text-lg font-semibold',
  lg: 'text-xl font-semibold',
};

const descriptionSizeStyles = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-base',
};

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive';
}

export interface EmptyStateProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof emptyStateVariants> {
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Icon component */
  icon?: React.ReactNode;
  /** Primary action button */
  action?: EmptyStateAction;
  /** Secondary action button */
  secondaryAction?: Omit<EmptyStateAction, 'variant'>;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      className,
      title,
      description,
      icon,
      action,
      secondaryAction,
      size = 'md',
      ...props
    },
    ref
  ) => {
    const effectiveSize = size || 'md';
    const iconSize = iconSizeStyles[effectiveSize];
    const titleSize = titleSizeStyles[effectiveSize];
    const descriptionSize = descriptionSizeStyles[effectiveSize];

    return (
      <div
        ref={ref}
        className={cn(emptyStateVariants({ size }), className)}
        {...props}
      >
        {icon && (
          <div
            className={cn(
              'flex items-center justify-center rounded-full bg-gray-100 p-3 text-gray-400',
              iconSize
            )}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
        <div className={cn('space-y-1', size === 'lg' ? 'gap-4' : size === 'md' ? 'gap-3' : 'gap-2')}>
          <h3 className={cn('text-gray-900', titleSize)}>{title}</h3>
          {description && (
            <p className={cn('text-gray-500 max-w-sm mx-auto', descriptionSize)}>
              {description}
            </p>
          )}
        </div>
        {(action || secondaryAction) && (
          <div className="flex items-center gap-3 mt-4">
            {action && (
              <Button
                variant={action.variant || 'default'}
                onClick={action.onClick}
                size={effectiveSize === 'lg' ? 'default' : 'sm'}
              >
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button
                variant="ghost"
                onClick={secondaryAction.onClick}
                size={effectiveSize === 'lg' ? 'default' : 'sm'}
              >
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';

export { EmptyState, emptyStateVariants };
