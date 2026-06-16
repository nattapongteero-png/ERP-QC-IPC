'use client';

/**
 * Accounting Module Layout
 * Feature: 010-accounting-module-integration
 *
 * Wraps all accounting pages with MainLayout for consistent navigation.
 */

import { MainLayout } from '@/components/layout/main-layout';
import { OrganicGridTheme } from '@/components/ui/organic-grid-theme';

export default function AccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MainLayout>
      <div className="organic-grid">
        <OrganicGridTheme />
        {children}
      </div>
    </MainLayout>
  );
}
