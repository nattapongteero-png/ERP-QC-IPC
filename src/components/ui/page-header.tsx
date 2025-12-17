'use client';

import { HTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** Page title */
  title: string;
  /** Page description/subtitle */
  description?: string;
  /** Actions to display on the right side */
  actions?: ReactNode;
  /** Breadcrumb component */
  breadcrumb?: ReactNode;
  /** Back button or navigation element */
  backButton?: ReactNode;
}

export const PageHeader = forwardRef<HTMLDivElement, PageHeaderProps>(
  (
    {
      className,
      title,
      description,
      actions,
      breadcrumb,
      backButton,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'mb-6 md:mb-8',
          'animate-slide-in motion-reduce:animate-none',
          className
        )}
        {...props}
      >
        {/* Breadcrumb */}
        {breadcrumb && <div className="mb-2">{breadcrumb}</div>}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Title Section */}
          <div className="flex items-start gap-3">
            {backButton && (
              <div className="mt-0.5">{backButton}</div>
            )}
            <div className="min-w-0 flex-1">
              <h1
                className={cn(
                  'text-2xl md:text-3xl font-bold',
                  'text-gray-900',
                  'tracking-tight'
                )}
              >
                {title}
              </h1>
              {description && (
                <p
                  className={cn(
                    'mt-1 text-sm md:text-base',
                    'text-gray-500',
                    'max-w-2xl'
                  )}
                >
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Actions Section */}
          {actions && (
            <div
              className={cn(
                'flex items-center gap-3',
                'flex-shrink-0'
              )}
            >
              {actions}
            </div>
          )}
        </div>
      </div>
    );
  }
);

PageHeader.displayName = 'PageHeader';

// Sub-components for more complex page headers

interface PageHeaderTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

export const PageHeaderTitle = forwardRef<HTMLHeadingElement, PageHeaderTitleProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <h1
        ref={ref}
        className={cn(
          'text-2xl md:text-3xl font-bold',
          'text-gray-900',
          'tracking-tight',
          className
        )}
        {...props}
      >
        {children}
      </h1>
    );
  }
);

PageHeaderTitle.displayName = 'PageHeaderTitle';

interface PageHeaderDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

export const PageHeaderDescription = forwardRef<HTMLParagraphElement, PageHeaderDescriptionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn(
          'mt-1 text-sm md:text-base',
          'text-gray-500',
          'max-w-2xl',
          className
        )}
        {...props}
      >
        {children}
      </p>
    );
  }
);

PageHeaderDescription.displayName = 'PageHeaderDescription';

interface PageHeaderActionsProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const PageHeaderActions = forwardRef<HTMLDivElement, PageHeaderActionsProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-3',
          'flex-shrink-0',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

PageHeaderActions.displayName = 'PageHeaderActions';
