'use client';

/**
 * Goods Receipt Layout
 * Wraps GRN pages with MainLayout for sidebar navigation.
 */
import { MainLayout } from '@/components/layout/main-layout';

export default function GoodsReceiptLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
