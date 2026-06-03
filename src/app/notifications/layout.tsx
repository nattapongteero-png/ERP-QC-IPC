'use client';

/**
 * Notifications Layout
 * Wraps all notification pages with MainLayout for sidebar navigation.
 */
import { MainLayout } from '@/components/layout/main-layout';

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
