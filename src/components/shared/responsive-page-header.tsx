'use client';

/**
 * ResponsivePageHeader Component
 * Feature: 007-hr-personnel-management
 *
 * A responsive page header that adapts layout based on viewport.
 * Used consistently across all HR pages for professional appearance.
 */

import Link from 'next/link';
import { DxButton } from '@/components/ui/dx-button';
import type { LucideIcon } from 'lucide-react';

export interface BreadcrumbItem {
  /** Display text */
  label: string;
  /** Navigation URL (optional - last item typically has no href) */
  href?: string;
}

export interface ResponsivePageHeaderProps {
  /** Main title text (Thai) */
  title: string;
  /** Subtitle or English translation */
  subtitle?: string;
  /** Icon component from lucide-react */
  icon?: LucideIcon;
  /** Icon background color class (e.g., "bg-emerald-100") */
  iconBgColor?: string;
  /** Icon color class (e.g., "text-emerald-600") */
  iconColor?: string;
  /** Actions to display on the right side (buttons, etc.) */
  actions?: React.ReactNode;
  /** Back button handler - if provided, shows back button */
  onBack?: () => void;
  /** Breadcrumb navigation items */
  breadcrumbs?: BreadcrumbItem[];
  /** Additional CSS classes for container */
  className?: string;
}

export function ResponsivePageHeader({
  title,
  subtitle,
  icon: Icon,
  iconBgColor = 'bg-emerald-100',
  iconColor = 'text-emerald-600',
  actions,
  onBack,
  breadcrumbs,
  className = '',
}: ResponsivePageHeaderProps) {
  return (
    <div className={className}>
      {/* Breadcrumbs - hidden on mobile */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="text-sm text-gray-500 mb-2 hidden md:block">
          {breadcrumbs.map((crumb, index) => (
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
      )}

      {/* Header row - responsive layout */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Title section */}
        <div className="flex items-center gap-4">
          {onBack && (
            <DxButton
              icon="back"
              type="default"
              stylingMode="text"
              onClick={onBack}
            />
          )}
          {Icon && (
            <div className={`p-3 rounded-lg ${iconBgColor}`}>
              <Icon className={`h-7 w-7 ${iconColor}`} />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {subtitle && (
              <p className="text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Actions section - wraps on mobile */}
        {actions && (
          <div className="flex flex-wrap gap-2 lg:gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default ResponsivePageHeader;
