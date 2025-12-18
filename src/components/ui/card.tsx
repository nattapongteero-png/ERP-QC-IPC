'use client';

import { HTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Card title */
  title?: string;
  /** Card description/subtitle */
  description?: string;
  /** Elevation variant */
  elevation?: 'flat' | 'raised' | 'elevated';
  /** Whether card is interactive (clickable) */
  interactive?: boolean;
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const elevationStyles = {
  flat: 'shadow-none border border-gray-200',
  raised: cn(
    'shadow-sm border border-gray-200',
    'hover:shadow-lg hover:-translate-y-0.5',
    'transition-all duration-200 ease-out'
  ),
  elevated: cn(
    'shadow-md border border-gray-100',
    'hover:shadow-xl hover:-translate-y-1',
    'transition-all duration-200 ease-out'
  ),
};

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      title,
      description,
      elevation = 'raised',
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
          // Base styles
          'bg-white rounded-xl',
          // Elevation
          elevationStyles[elevation],
          // Interactive states
          interactive && [
            'cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
            'active:scale-[0.99]',
          ],
          // Reduced motion support
          'motion-reduce:transition-none motion-reduce:hover:transform-none',
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

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('px-6 py-4 border-b border-gray-200', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={cn('text-lg font-semibold text-gray-900', className)}
        {...props}
      >
        {children}
      </h3>
    );
  }
);

CardTitle.displayName = 'CardTitle';

interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn('mt-1 text-sm text-gray-500', className)}
        {...props}
      >
        {children}
      </p>
    );
  }
);

CardDescription.displayName = 'CardDescription';

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('p-6', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardContent.displayName = 'CardContent';

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('px-6 py-4 border-t border-gray-200', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';
