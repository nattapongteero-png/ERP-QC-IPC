'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search } from 'lucide-react';

interface PurchaseOrder {
  id: number;
  poNumber: string;
  vendorName: string;
  orderDate: string;
  expectedDate: string;
  status: string;
  totalAmount: number;
  currency: string;
}

const poStatuses = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'sent', label: 'Sent to Vendor' },
  { value: 'partial', label: 'Partially Received' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function PurchasingPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/purchasing/orders?${params}`);
      const data = await res.json();

      if (data.success) {
        setOrders(data.data?.items || []);
        setPagination((prev) => ({ ...prev, total: data.data?.total || 0 }));
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [pagination.page, statusFilter]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchOrders();
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'approved':
      case 'received':
        return 'success';
      case 'cancelled':
        return 'danger';
      case 'pending_approval':
        return 'warning';
      case 'partial':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH');
  };

  const formatCurrency = (amount: number, currency: string = 'THB') => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const columns = [
    { key: 'poNumber', header: 'PO Number' },
    { key: 'vendorName', header: 'Vendor' },
    {
      key: 'orderDate',
      header: 'Order Date',
      render: (order: PurchaseOrder) => formatDate(order.orderDate),
    },
    {
      key: 'expectedDate',
      header: 'Expected Date',
      render: (order: PurchaseOrder) => formatDate(order.expectedDate),
    },
    {
      key: 'totalAmount',
      header: 'Total Amount',
      render: (order: PurchaseOrder) =>
        formatCurrency(order.totalAmount, order.currency),
    },
    {
      key: 'status',
      header: 'Status',
      render: (order: PurchaseOrder) => (
        <Badge variant={getStatusVariant(order.status)}>
          {order.status.replace('_', ' ')}
        </Badge>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
            <p className="text-gray-600">จัดการใบสั่งซื้อ</p>
          </div>
          <Button onClick={() => router.push('/purchasing/orders/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New PO
          </Button>
        </div>

        <Card>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                variant="search"
                placeholder="Search by PO number or vendor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onSearch={handleSearch}
              />
            </div>
            <div className="w-full md:w-48">
              <Select
                options={poStatuses}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <Table
            columns={columns}
            data={orders}
            keyField="id"
            isLoading={isLoading}
            emptyMessage="No purchase orders found"
            onRowClick={(order) => router.push(`/purchasing/orders/${order.id}`)}
          />

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} orders
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page === 1}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page * pagination.limit >= pagination.total}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
