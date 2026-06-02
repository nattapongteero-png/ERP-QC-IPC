'use client';

/**
 * Material Withdrawal Module Layout
 *
 * Wraps all material-withdrawal pages with MainLayout for consistent
 * navigation, sidebar, and language toggle.
 */

import { MainLayout } from '@/components/layout/main-layout';

export default function MaterialWithdrawalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
