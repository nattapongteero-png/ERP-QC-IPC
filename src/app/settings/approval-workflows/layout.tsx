'use client';

/**
 * Approval Workflows Layout
 * Wraps all approval workflow pages with MainLayout for consistent navigation.
 */

import { MainLayout } from '@/components/layout/main-layout';

export default function ApprovalWorkflowsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
