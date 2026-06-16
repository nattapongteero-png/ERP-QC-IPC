'use client';

/**
 * Master Data Module Layout
 *
 * Wraps all Master Data pages with MainLayout for consistent navigation.
 */

import { MainLayout } from '@/components/layout/main-layout';
import { OrganicGridTheme } from '@/components/ui/organic-grid-theme';

export default function MasterDataLayout({
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
