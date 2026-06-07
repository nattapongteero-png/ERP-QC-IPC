'use client';

/**
 * Premises & Facilities Module Layout
 *
 * Wraps all "อาคารและสถานที่" pages with MainLayout for consistent navigation.
 */

import { MainLayout } from '@/components/layout/main-layout';

export default function PremisesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
