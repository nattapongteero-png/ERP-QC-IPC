'use client';

/**
 * Group Members Layout
 * Wraps the members management page.
 * Feature: BOM Confidentiality Protection (014-unit-cost)
 */

export default function GroupMembersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // MainLayout is already provided by parent layout at /admin/confidential-groups/layout.tsx
  return <>{children}</>;
}
