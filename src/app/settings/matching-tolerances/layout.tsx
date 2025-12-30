'use client';

/**
 * Matching Tolerances Layout
 * Settings Module - Wraps all matching tolerance pages with MainLayout for consistent navigation.
 */

import { MainLayout } from '@/components/layout/main-layout';

export default function MatchingTolerancesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
