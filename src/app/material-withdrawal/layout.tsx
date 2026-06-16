'use client';

/**
 * Material Withdrawal Module Layout
 *
 * Wraps all material-withdrawal pages with MainLayout for consistent
 * navigation, sidebar, and language toggle.
 */

import { MainLayout } from '@/components/layout/main-layout';
import { OrganicGridTheme } from '@/components/ui/organic-grid-theme';

export default function MaterialWithdrawalLayout({
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
