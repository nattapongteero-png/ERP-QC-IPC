'use client';

/**
 * Master Data Module Layout
 *
 * Wraps all Master Data pages with MainLayout for consistent navigation.
 */

import { MainLayout } from '@/components/layout/main-layout';

export default function MasterDataLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
