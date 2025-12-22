'use client';

/**
 * VMI Orders Page
 *
 * Page for managing orders received from VMI Portals.
 * Displays order list and allows viewing, confirming, and shipping orders.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { useState } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/main-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { VmiOrdersGrid, VmiOrderDetail } from '@/components/vmi';
import { DxButton } from '@/components/ui/dx-button';
import { ArrowLeft } from 'lucide-react';

// ============================================
// Types
// ============================================

interface SelectedOrder {
  id: number;
}

// ============================================
// Component
// ============================================

export default function VmiOrdersPage() {
  const [selectedOrder, setSelectedOrder] = useState<SelectedOrder | null>(null);

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="VMI Orders"
          description="Manage orders received from VMI Portals. Match items, confirm orders, and track shipments."
          breadcrumb={
            <nav className="flex text-sm text-gray-500">
              <Link href="/sales" className="hover:text-gray-700">Sales</Link>
              <span className="mx-2">/</span>
              <span className="text-gray-900">VMI Orders</span>
            </nav>
          }
          actions={
            selectedOrder && (
              <DxButton
                icon="arrowleft"
                text="Back to List"
                type="normal"
                onClick={() => setSelectedOrder(null)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
              </DxButton>
            )
          }
        />

        {selectedOrder ? (
          <VmiOrderDetail
            orderId={selectedOrder.id}
            onClose={() => setSelectedOrder(null)}
            onConfirm={() => {
              // Stay on detail view after confirm
            }}
            onShip={() => {
              // Stay on detail view after ship
            }}
          />
        ) : (
          <Card elevation="raised">
            <CardContent className="p-6">
              <VmiOrdersGrid
                onOrderSelect={(order) => setSelectedOrder({ id: order.id })}
                onOrderConfirm={(orderId) => setSelectedOrder({ id: orderId })}
                onOrderShip={(orderId) => setSelectedOrder({ id: orderId })}
              />
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        {!selectedOrder && (
          <div className="p-6 bg-blue-50 rounded-lg border border-blue-100">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">VMI Order Workflow</h3>
            <div className="space-y-2 text-sm text-blue-800">
              <p>
                <strong>1. Poll for Orders:</strong> Click &quot;Poll for Orders&quot; to fetch new orders from
                VMI Portals. Orders are automatically matched to your items using TPP/TTMT codes.
              </p>
              <p>
                <strong>2. Match Items:</strong> For unmatched items, click &quot;Match&quot; to manually select
                the corresponding item from your catalog.
              </p>
              <p>
                <strong>3. Confirm Order:</strong> Once all items are matched, confirm the order to
                create an internal sales order and notify the portal.
              </p>
              <p>
                <strong>4. Ship Order:</strong> After preparing the shipment, mark the order as shipped
                with tracking information to notify the hospital.
              </p>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
