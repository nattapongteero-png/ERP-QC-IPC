'use client';

/**
 * VMI Orders Management Page
 *
 * Lists VMI orders from hospitals via VMI Portal with actions:
 * - Poll for new orders
 * - View order details
 * - Confirm orders
 * - Ship orders
 * - Check receipt status
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Package,
  Clock,
  CheckCircle,
  Truck,
  PackageCheck,
} from 'lucide-react';
import { VmiOrdersGrid, type VmiOrder, type OrderFilters } from '@/components/purchasing/vmi/VmiOrdersGrid';
import { VmiOrderDetail, type VmiOrderDetail as VmiOrderDetailType } from '@/components/purchasing/vmi/VmiOrderDetail';
import type { VmiOrderStatus } from '@/types/vmi';

// ============================================================================
// Types
// ============================================================================

interface Vendor {
  id: number;
  name: string;
}

interface VmiStats {
  total: number;
  submitted: number;
  confirmed: number;
  shipped: number;
  received: number;
}

// ============================================================================
// Stats Card Component
// ============================================================================

interface StatsCardProps {
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  label: string;
  value: number;
  onClick?: () => void;
  active?: boolean;
}

function StatsCard({ icon: Icon, iconColor, bgColor, label, value, onClick, active }: StatsCardProps) {
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-xl border text-left transition-all ${
        active
          ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-200'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function VmiOrdersPage() {
  const router = useRouter();

  // State
  const [orders, setOrders] = React.useState<VmiOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = React.useState<number | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = React.useState<VmiOrderDetailType | null>(null);
  const [vendors, setVendors] = React.useState<Vendor[]>([]);
  const [stats, setStats] = React.useState<VmiStats>({
    total: 0,
    submitted: 0,
    confirmed: 0,
    shipped: 0,
    received: 0,
  });
  const [filters, setFilters] = React.useState<OrderFilters>({});

  // Loading states
  const [isLoading, setIsLoading] = React.useState(true);
  const [isPollLoading, setIsPollLoading] = React.useState(false);
  const [isConfirming, setIsConfirming] = React.useState(false);
  const [isShipping, setIsShipping] = React.useState(false);
  const [isCheckingReceipt, setIsCheckingReceipt] = React.useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchOrders = React.useCallback(async (currentFilters: OrderFilters = filters) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (currentFilters.vendorId) params.set('vendorId', currentFilters.vendorId.toString());
      if (currentFilters.status) params.set('status', currentFilters.status);
      if (currentFilters.dateFrom) params.set('dateFrom', currentFilters.dateFrom);
      if (currentFilters.dateTo) params.set('dateTo', currentFilters.dateTo);

      const response = await fetch(`/api/purchasing/vmi/orders?${params}`);
      const data = await response.json();

      if (data.success) {
        setOrders(data.data?.items || []);
        calculateStats(data.data?.items || []);
      } else {
        console.error('Failed to fetch orders:', data.error);
        setOrders([]);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const fetchVendors = React.useCallback(async () => {
    try {
      const response = await fetch('/api/vendors?status=active&vmiEnabled=true&limit=100');
      const data = await response.json();

      if (data.success) {
        setVendors(
          (data.data?.items || []).map((v: { id: number; name: string }) => ({
            id: v.id,
            name: v.name,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  }, []);

  const fetchOrderDetail = React.useCallback(async (orderId: number) => {
    setIsLoadingDetail(true);
    try {
      const response = await fetch(`/api/purchasing/vmi/orders/${orderId}`);
      const data = await response.json();

      if (data.success) {
        setSelectedOrderDetail(data.data);
      } else {
        console.error('Failed to fetch order detail:', data.error);
        setSelectedOrderDetail(null);
      }
    } catch (error) {
      console.error('Error fetching order detail:', error);
      setSelectedOrderDetail(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const calculateStats = (orderList: VmiOrder[]) => {
    const newStats: VmiStats = {
      total: orderList.length,
      submitted: 0,
      confirmed: 0,
      shipped: 0,
      received: 0,
    };

    for (const order of orderList) {
      if (order.status === 'submitted') newStats.submitted++;
      if (order.status === 'confirmed') newStats.confirmed++;
      if (order.status === 'shipped') newStats.shipped++;
      if (order.status === 'received') newStats.received++;
    }

    setStats(newStats);
  };

  // ============================================================================
  // Actions
  // ============================================================================

  const handlePollOrders = React.useCallback(async (vendorId?: number) => {
    setIsPollLoading(true);
    try {
      const response = await fetch('/api/purchasing/vmi/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId }),
      });
      const data = await response.json();

      if (data.success) {
        await fetchOrders();
      } else {
        console.error('Failed to poll orders:', data.error);
      }
    } catch (error) {
      console.error('Error polling orders:', error);
    } finally {
      setIsPollLoading(false);
    }
  }, [fetchOrders]);

  const handleConfirm = React.useCallback(async () => {
    if (!selectedOrderId) return;

    setIsConfirming(true);
    try {
      const response = await fetch(`/api/purchasing/vmi/orders/${selectedOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm' }),
      });
      const data = await response.json();

      if (data.success) {
        await fetchOrderDetail(selectedOrderId);
        await fetchOrders();
      } else {
        console.error('Failed to confirm order:', data.error);
      }
    } catch (error) {
      console.error('Error confirming order:', error);
    } finally {
      setIsConfirming(false);
    }
  }, [selectedOrderId, fetchOrderDetail, fetchOrders]);

  const handleShip = React.useCallback(async (expectedDeliveryDate: string) => {
    if (!selectedOrderId) return;

    setIsShipping(true);
    try {
      const response = await fetch(`/api/purchasing/vmi/orders/${selectedOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ship', expectedDeliveryDate }),
      });
      const data = await response.json();

      if (data.success) {
        await fetchOrderDetail(selectedOrderId);
        await fetchOrders();
      } else {
        console.error('Failed to ship order:', data.error);
      }
    } catch (error) {
      console.error('Error shipping order:', error);
    } finally {
      setIsShipping(false);
    }
  }, [selectedOrderId, fetchOrderDetail, fetchOrders]);

  const handleCheckReceipt = React.useCallback(async () => {
    if (!selectedOrderId) return;

    setIsCheckingReceipt(true);
    try {
      const response = await fetch(`/api/purchasing/vmi/orders/${selectedOrderId}/receipt-status`);
      const data = await response.json();

      if (data.success) {
        await fetchOrderDetail(selectedOrderId);
        await fetchOrders();
      } else {
        console.error('Failed to check receipt:', data.error);
      }
    } catch (error) {
      console.error('Error checking receipt:', error);
    } finally {
      setIsCheckingReceipt(false);
    }
  }, [selectedOrderId, fetchOrderDetail, fetchOrders]);

  const handleRowClick = React.useCallback((order: VmiOrder) => {
    setSelectedOrderId(order.id);
    fetchOrderDetail(order.id);
  }, [fetchOrderDetail]);

  const handleBack = React.useCallback(() => {
    setSelectedOrderId(null);
    setSelectedOrderDetail(null);
  }, []);

  const handleViewLocalPo = React.useCallback((poId: number) => {
    router.push(`/purchasing/orders/${poId}`);
  }, [router]);

  const handleFilterChange = React.useCallback((newFilters: OrderFilters) => {
    setFilters(newFilters);
    fetchOrders(newFilters);
  }, [fetchOrders]);

  const handleStatsClick = React.useCallback((status?: VmiOrderStatus) => {
    const newFilters = { ...filters, status };
    setFilters(newFilters);
    fetchOrders(newFilters);
  }, [filters, fetchOrders]);

  // ============================================================================
  // Effects
  // ============================================================================

  React.useEffect(() => {
    fetchOrders();
    fetchVendors();
  }, [fetchOrders, fetchVendors]);

  // ============================================================================
  // Render Detail View
  // ============================================================================

  if (selectedOrderId) {
    if (isLoadingDetail || !selectedOrderDetail) {
      return (
        <MainLayout>
          <div className="flex items-center justify-center h-[calc(100vh-200px)]">
            <div className="text-center">
              <DxLoadIndicator visible height={48} width={48} />
              <p className="text-gray-500 mt-4">Loading order details...</p>
            </div>
          </div>
        </MainLayout>
      );
    }

    return (
      <MainLayout>
        <VmiOrderDetail
          order={selectedOrderDetail}
          onConfirm={handleConfirm}
          onShip={handleShip}
          onCheckReceipt={handleCheckReceipt}
          onBack={handleBack}
          onViewLocalPo={handleViewLocalPo}
          isConfirming={isConfirming}
          isShipping={isShipping}
          isCheckingReceipt={isCheckingReceipt}
        />
      </MainLayout>
    );
  }

  // ============================================================================
  // Render List View
  // ============================================================================

  return (
    <MainLayout>
      <div className="flex flex-col h-full gap-4">
        {/* Header */}
        <PageHeader
          title="VMI Orders"
          description="Manage orders received from hospitals via VMI Portal"
          actions={
            <DxButton
              text={isPollLoading ? 'Polling...' : 'Poll All Vendors'}
              icon="refresh"
              type="default"
              onClick={() => handlePollOrders()}
              disabled={isPollLoading}
            />
          }
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatsCard
            icon={Package}
            iconColor="text-gray-600"
            bgColor="bg-gray-100"
            label="Total Orders"
            value={stats.total}
            onClick={() => handleStatsClick(undefined)}
            active={!filters.status}
          />
          <StatsCard
            icon={Clock}
            iconColor="text-amber-600"
            bgColor="bg-amber-100"
            label="Submitted"
            value={stats.submitted}
            onClick={() => handleStatsClick('submitted')}
            active={filters.status === 'submitted'}
          />
          <StatsCard
            icon={CheckCircle}
            iconColor="text-blue-600"
            bgColor="bg-blue-100"
            label="Confirmed"
            value={stats.confirmed}
            onClick={() => handleStatsClick('confirmed')}
            active={filters.status === 'confirmed'}
          />
          <StatsCard
            icon={Truck}
            iconColor="text-purple-600"
            bgColor="bg-purple-100"
            label="Shipped"
            value={stats.shipped}
            onClick={() => handleStatsClick('shipped')}
            active={filters.status === 'shipped'}
          />
          <StatsCard
            icon={PackageCheck}
            iconColor="text-emerald-600"
            bgColor="bg-emerald-100"
            label="Received"
            value={stats.received}
            onClick={() => handleStatsClick('received')}
            active={filters.status === 'received'}
          />
        </div>

        {/* Orders Grid */}
        <Card elevation="raised" className="flex-1 min-h-0">
          <CardContent className="h-full py-4">
            {orders.length > 0 || isLoading ? (
              <VmiOrdersGrid
                orders={orders}
                isLoading={isLoading}
                onRowClick={handleRowClick}
                onRefresh={() => fetchOrders()}
                onPollOrders={handlePollOrders}
                isPollLoading={isPollLoading}
                vendors={vendors}
                onFilterChange={handleFilterChange}
              />
            ) : (
              <EmptyState
                icon={<Package className="h-12 w-12" />}
                title="No VMI Orders"
                description="Click 'Poll All Vendors' to fetch new orders from VMI Portal"
                action={{
                  label: 'Poll Orders',
                  onClick: () => handlePollOrders(),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
