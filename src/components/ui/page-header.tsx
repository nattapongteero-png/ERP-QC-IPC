'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Page title */
  title: string;
  /** Page description/subtitle */
  description?: string;
  /** Actions to display on the right side */
  actions?: React.ReactNode;
  /** Breadcrumb component */
  breadcrumb?: React.ReactNode;
  /** Back button or navigation element */
  backButton?: React.ReactNode;
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
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

const PageHeaderTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
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
));

PageHeaderTitle.displayName = 'PageHeaderTitle';

const PageHeaderDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => (
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
));

PageHeaderDescription.displayName = 'PageHeaderDescription';

const PageHeaderActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
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
));

PageHeaderActions.displayName = 'PageHeaderActions';

export {
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
};
