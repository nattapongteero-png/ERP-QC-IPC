'use client';

/**
 * Breadcrumbs Component
 *
 * Standalone breadcrumb navigation, extracted so pages that don't use
 * ResponsivePageHeader (raw <h1> headers) can render a consistent breadcrumb.
 * ResponsivePageHeader reuses this component internally (DRY).
 */

import Link from 'next/link';

export interface BreadcrumbItem {
  /** Display text */
  label: string;
  /** Navigation URL (optional - last item typically has no href) */
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  /** Additional CSS classes */
  className?: string;
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;

  return (
    <nav
      className={`text-sm text-gray-500 mb-2 hidden md:block ${className}`}
      aria-label="Breadcrumb"
    >
      {items.map((crumb, index) => (
        <span key={index}>
          {index > 0 && <span className="mx-2">/</span>}
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="hover:text-emerald-600 transition-colors"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="text-gray-700">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export default Breadcrumbs;
