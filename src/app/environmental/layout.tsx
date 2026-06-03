'use client';

/**
 * Environmental Monitoring Layout
 * Wraps all environmental pages with MainLayout for sidebar navigation.
 */
import { MainLayout } from '@/components/layout/main-layout';

export default function EnvironmentalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
