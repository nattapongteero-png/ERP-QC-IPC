'use client';

/**
 * Template Module Layout
 * ERP Module Prototype
 *
 * Wraps all template pages with MainLayout for consistent navigation.
 */

import { MainLayout } from '@/components/layout/main-layout';

export default function TemplateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
