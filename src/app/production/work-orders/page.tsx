'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import { Badge, getStatusVariant } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, Inbox } from 'lucide-react';

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
    if (priority <= 3) return <Badge variant="danger" dot>High</Badge>;
    if (priority <= 6) return <Badge variant="warning" dot>Medium</Badge>;
    return <Badge variant="default" dot>Low</Badge>;
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
        <Badge variant={getStatusVariant(wo.status)} dot>
          {wo.status.replace('_', ' ')}
        </Badge>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Work Orders"
          description="จัดการใบสั่งผลิต"
          actions={
            <Button onClick={() => router.push('/production/work-orders/new')} leftIcon={<Plus className="h-4 w-4" />}>
              Create Work Order
            </Button>
          }
        />

        <Card elevation="raised">
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <Input
                  variant="search"
                  placeholder="Search by WO number or batch..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onSearch={handleSearch}
                />
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
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : workOrders.length > 0 ? (
              <>
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
              </>
            ) : (
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="No work orders found"
                description="Get started by creating your first work order"
                action={{
                  label: 'Create Work Order',
                  onClick: () => router.push('/production/work-orders/new'),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
