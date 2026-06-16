'use client';

/**
 * GMP Module Layout
 * Feature: 009-gmp-compliance-gap-analysis
 *
 * Wraps all GMP pages with MainLayout for consistent navigation.
 */

import { MainLayout } from '@/components/layout/main-layout';
import { OrganicGridTheme } from '@/components/ui/organic-grid-theme';

export default function GMPLayout({
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
