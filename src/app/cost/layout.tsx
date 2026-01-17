/**
 * Cost Module Layout
 * Feature: 014-unit-cost
 */

import { MainLayout } from '@/components/layout/main-layout';

export default function CostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
