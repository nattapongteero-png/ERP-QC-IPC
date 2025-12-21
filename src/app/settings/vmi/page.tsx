'use client';

/**
 * VMI Portal Settings Page
 *
 * Settings page for managing VMI Portal connections.
 * This system IS the vendor - configures connections TO external VMI portals.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { MainLayout } from '@/components/layout/main-layout';
import { PageHeader } from '@/components/ui/page-header';
import { VmiPortalList } from '@/components/settings/vmi';
import { DxButton } from '@/components/ui/dx-button';
import Link from 'next/link';

export default function VmiSettingsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="VMI Portal Settings"
          description="Manage connections to external VMI (Vendor Managed Inventory) portals. This system acts as the vendor/supplier, syncing inventory and receiving orders from hospital customers."
          breadcrumb={[
            { label: 'Settings', href: '/settings' },
            { label: 'VMI Portals' },
          ]}
          actions={
            <Link href="/settings">
              <DxButton
                text="Back to Settings"
                icon="arrowleft"
                type="normal"
              />
            </Link>
          }
        />

        <VmiPortalList />

        {/* Help Section */}
        <div className="p-6 bg-blue-50 rounded-lg border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">About VMI Integration</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>
              <strong>What is VMI?</strong> Vendor Managed Inventory allows you to manage inventory
              levels at your customer&apos;s locations. When hospitals need supplies, orders are automatically
              generated based on consumption and inventory thresholds.
            </p>
            <p>
              <strong>How it works:</strong>
            </p>
            <ul className="list-disc ml-5 space-y-1">
              <li><strong>Inventory Sync:</strong> Push your current stock levels to the portal</li>
              <li><strong>Items Sync:</strong> Update the product catalog on the portal</li>
              <li><strong>Prices Sync:</strong> Keep pricing information current</li>
              <li><strong>Order Polling:</strong> Receive new orders from the portal automatically</li>
            </ul>
            <p className="mt-4">
              <strong>Getting Started:</strong> Click &quot;Add Portal&quot; to configure a new VMI portal connection.
              You&apos;ll need the portal URL, your vendor ID, and an API key from the hospital&apos;s VMI system.
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
