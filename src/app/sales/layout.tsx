'use client';

/**
 * Sales Module Layout
 *
 * Applies the shared "Organic Biophilic" theme to every sales page via the
 * reusable OrganicGridTheme stylesheet. Sales pages wrap their own MainLayout,
 * so this layout does NOT add another (see [[no-duplicate-mainlayout]]).
 */

import { OrganicGridTheme } from '@/components/ui/organic-grid-theme';

export default function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="organic-grid">
      <OrganicGridTheme />
      {children}
    </div>
  );
}
