'use client';

/**
 * Issues Module Layout
 * Feature: Issue Tracker
 *
 * Wraps all issue tracker pages with MainLayout for consistent navigation.
 */

import { MainLayout } from '@/components/layout/main-layout';

export default function IssuesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
