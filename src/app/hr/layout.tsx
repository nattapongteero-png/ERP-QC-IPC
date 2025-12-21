'use client';

// HR Module Layout
// Feature: 007-hr-personnel-management
// Wraps all HR pages with MainLayout for consistent navigation

import { MainLayout } from '@/components/layout/main-layout';

export default function HRLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
