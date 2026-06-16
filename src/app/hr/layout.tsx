'use client';

// HR Module Layout
// Feature: 007-hr-personnel-management
// Wraps all HR pages with MainLayout for consistent navigation

import { MainLayout } from '@/components/layout/main-layout';
import { OrganicGridTheme } from '@/components/ui/organic-grid-theme';

export default function HRLayout({
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
