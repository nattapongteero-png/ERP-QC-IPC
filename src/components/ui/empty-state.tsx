'use client';

import { HTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from './button';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Icon component */
  icon?: ReactNode;
  /** Primary action button */
  action?: EmptyStateAction;
  /** Secondary action button */
  secondaryAction?: Omit<EmptyStateAction, 'variant'>;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: {
    container: 'py-6 px-4',
    icon: 'h-8 w-8',
    title: 'text-base font-medium',
    description: 'text-sm',
    gap: 'gap-2',
  },
  md: {
    container: 'py-10 px-6',
    icon: 'h-12 w-12',
    title: 'text-lg font-semibold',
    description: 'text-base',
    gap: 'gap-3',
  },
  lg: {
    container: 'py-16 px-8',
    icon: 'h-16 w-16',
    title: 'text-xl font-semibold',
    description: 'text-base',
    gap: 'gap-4',
  },
};

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
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
    const styles = sizeStyles[size];

    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center text-center',
          styles.container,
          styles.gap,
          className
        )}
        {...props}
      >
        {icon && (
          <div
            className={cn(
              'flex items-center justify-center rounded-full bg-gray-100 p-3 text-gray-400',
              styles.icon
            )}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
        <div className={cn('space-y-1', styles.gap)}>
          <h3 className={cn('text-gray-900', styles.title)}>{title}</h3>
          {description && (
            <p className={cn('text-gray-500 max-w-sm mx-auto', styles.description)}>
              {description}
            </p>
          )}
        </div>
        {(action || secondaryAction) && (
          <div className="flex items-center gap-3 mt-4">
            {action && (
              <Button
                variant={action.variant || 'primary'}
                onClick={action.onClick}
                size={size === 'lg' ? 'md' : 'sm'}
              >
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button
                variant="ghost"
                onClick={secondaryAction.onClick}
                size={size === 'lg' ? 'md' : 'sm'}
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
