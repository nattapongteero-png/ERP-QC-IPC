'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import { Badge, getStatusVariant } from '@/components/ui/badge';
import { Plus, Search } from 'lucide-react';

interface WorkOrder {
  id: number;
  woNumber: string;
  batchNumber: string;
  plannedQuantity: number;
  actualQuantity: number;
  unit: string;
  status: string;
  priority: number;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  yieldPercentage: number;
  productCode: string;
  productName: string;
}

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'planned', label: 'Planned' },
  { value: 'released', label: 'Released' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function WorkOrdersPage() {
  const router = useRouter();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  const fetchWorkOrders = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/production/work-orders?${params}`);
      const data = await res.json();

      if (data.success) {
        setWorkOrders(data.data?.items || []);
        setPagination((prev) => ({ ...prev, total: data.data?.total || 0 }));
      } else {
        console.error('API error:', data.error);
        setWorkOrders([]);
      }
    } catch (error) {
      console.error('Failed to fetch work orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, [pagination.page, statusFilter]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchWorkOrders();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH');
  };

  const getPriorityBadge = (priority: number) => {
    if (priority <= 3) return <Badge variant="danger">High</Badge>;
    if (priority <= 6) return <Badge variant="warning">Medium</Badge>;
    return <Badge variant="default">Low</Badge>;
  };

  const columns = [
    { key: 'woNumber', header: 'WO Number' },
    { key: 'batchNumber', header: 'Batch Number' },
    { key: 'productCode', header: 'Product Code' },
    { key: 'productName', header: 'Product Name' },
    {
      key: 'plannedQuantity',
      header: 'Planned Qty',
      render: (wo: WorkOrder) => `${wo.plannedQuantity.toLocaleString()} ${wo.unit}`,
    },
    {
      key: 'actualQuantity',
      header: 'Actual Qty',
      render: (wo: WorkOrder) =>
        wo.actualQuantity ? `${wo.actualQuantity.toLocaleString()} ${wo.unit}` : '-',
    },
    {
      key: 'plannedStartDate',
      header: 'Planned Start',
      render: (wo: WorkOrder) => formatDate(wo.plannedStartDate),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (wo: WorkOrder) => getPriorityBadge(wo.priority),
    },
    {
      key: 'status',
      header: 'Status',
      render: (wo: WorkOrder) => (
        <Badge variant={getStatusVariant(wo.status)}>
          {wo.status.replace('_', ' ')}
        </Badge>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
            <p className="text-gray-600">จัดการใบสั่งผลิต</p>
          </div>
          <Button onClick={() => router.push('/production/work-orders/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Create Work Order
          </Button>
        </div>

        <Card>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Input
                  placeholder="Search by WO number or batch..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                >
                  <Search className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select
                options={statusOptions}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <Table
            columns={columns}
            data={workOrders}
            keyField="id"
            isLoading={isLoading}
            emptyMessage="No work orders found"
            onRowClick={(wo) => router.push(`/production/work-orders/${wo.id}`)}
          />

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} work orders
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page === 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page * pagination.limit >= pagination.total}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
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
