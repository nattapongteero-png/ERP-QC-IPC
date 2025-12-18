'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const cardVariants = cva(
  'bg-white rounded-xl motion-reduce:transition-none motion-reduce:hover:transform-none',
  {
    variants: {
      elevation: {
        flat: 'shadow-none border border-gray-200',
        raised: 'shadow-sm border border-gray-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 ease-out',
        elevated: 'shadow-md border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 ease-out',
        // shadcn/ui standard variant
        default: 'shadow-sm border border-gray-200',
      },
    },
    defaultVariants: {
      elevation: 'raised',
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  /** Card title (legacy - use CardHeader + CardTitle instead) */
  title?: string;
  /** Card description/subtitle (legacy - use CardHeader + CardDescription instead) */
  description?: string;
  /** Whether card is interactive (clickable) */
  interactive?: boolean;
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      title,
      description,
      elevation,
      interactive = false,
      padding,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          cardVariants({ elevation }),
          interactive && [
            'cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
            'active:scale-[0.99]',
          ],
          className
        )}
        onClick={onClick}
        tabIndex={interactive ? 0 : undefined}
        role={interactive ? 'button' : undefined}
        {...props}
      >
        {(title || description) && (
          <div className={cn('px-6 py-4 border-b border-gray-200', padding && paddingStyles[padding])}>
            {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
            {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
          </div>
        )}
        {padding && !title && !description ? (
          <div className={paddingStyles[padding]}>{children}</div>
        ) : (
          children
        )}
      </div>
    );
  }
);

Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6 pb-0', className)}
    {...props}
  />
));

CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight text-gray-900', className)}
    {...props}
  />
));

CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-gray-500', className)}
    {...props}
  />
));

CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6', className)} {...props} />
));

CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
));

CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardVariants,
};
