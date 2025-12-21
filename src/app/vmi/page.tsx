'use client';

/**
 * VMI Dashboard Page
 *
 * Main landing page for VMI (Vendor Managed Inventory) features.
 * Shows sync status, order statistics, and quick actions.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { MainLayout } from '@/components/layout/main-layout';
import { PageHeader } from '@/components/ui/page-header';
import { VmiDashboard } from '@/components/vmi/VmiDashboard';

export default function VmiPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="VMI Integration"
          description="Manage your Vendor Managed Inventory integration with hospital VMI Portals."
          breadcrumb={[
            { label: 'VMI' },
          ]}
        />

        <VmiDashboard />
      </div>
    </MainLayout>
  );
}
