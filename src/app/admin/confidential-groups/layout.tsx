'use client';

/**
 * Confidential Access Groups Layout
 * Wraps all confidential access group pages with MainLayout for consistent navigation.
 * Feature: BOM Confidentiality Protection (014-unit-cost)
 */

import { MainLayout } from '@/components/layout/main-layout';

export default function ConfidentialGroupsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
