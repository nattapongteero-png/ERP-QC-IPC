'use client';

/**
 * GMP Module Layout
 * Feature: 009-gmp-compliance-gap-analysis
 *
 * Wraps all GMP pages with MainLayout for consistent navigation.
 */

import { MainLayout } from '@/components/layout/main-layout';

export default function GMPLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
