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
import { FileText, ClipboardList } from 'lucide-react';

interface BatchRecord {
  id: number;
  workOrderId: number;
  woNumber: string;
  batchNumber: string;
  productCode: string;
  productName: string;
  operationName: string;
  sequence: number;
  stepName: string;
  status: string;
  startTime: string;
  endTime: string;
  performerName: string;
  verifierName: string;
  createdAt: string;
}

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'deviation', label: 'Deviation' },
];

export default function BatchRecordsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<BatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/production/batch-records?${params}`);
      const data = await res.json();

      if (data.success) {
        setRecords(data.data?.items || []);
        setPagination((prev) => ({ ...prev, total: data.data?.total || 0 }));
      } else {
        console.error('API error:', data.error);
        setRecords([]);
      }
    } catch (error) {
      console.error('Failed to fetch batch records:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [pagination.page, statusFilter]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchRecords();
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('th-TH', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  const getStatusBadgeVariant = (status: string): 'primary' | 'secondary' | 'warning' | 'danger' | 'default' => {
    switch (status) {
      case 'completed':
        return 'primary';
      case 'in_progress':
        return 'secondary';
      case 'deviation':
        return 'danger';
      case 'pending':
      default:
        return 'default';
    }
  };

  const columns = [
    {
      key: 'woNumber',
      header: 'Work Order',
      render: (record: BatchRecord) => (
        <div>
          <p className="font-medium">{record.woNumber}</p>
          <p className="text-sm text-gray-500">{record.batchNumber}</p>
        </div>
      ),
    },
    {
      key: 'product',
      header: 'Product',
      render: (record: BatchRecord) => (
        <div>
          <p className="font-medium">{record.productCode}</p>
          <p className="text-sm text-gray-500">{record.productName}</p>
        </div>
      ),
    },
    {
      key: 'step',
      header: 'Step',
      render: (record: BatchRecord) => (
        <div>
          <p className="font-medium">#{record.sequence} - {record.stepName}</p>
          <p className="text-sm text-gray-500">{record.operationName}</p>
        </div>
      ),
    },
    {
      key: 'timing',
      header: 'Timing',
      render: (record: BatchRecord) => (
        <div className="text-sm">
          <p>Start: {formatDateTime(record.startTime)}</p>
          <p>End: {formatDateTime(record.endTime)}</p>
        </div>
      ),
    },
    {
      key: 'performer',
      header: 'Performed By',
      render: (record: BatchRecord) => record.performerName || '-',
    },
    {
      key: 'verifier',
      header: 'Verified By',
      render: (record: BatchRecord) => record.verifierName || '-',
    },
    {
      key: 'status',
      header: 'Status',
      render: (record: BatchRecord) => (
        <Badge variant={getStatusBadgeVariant(record.status)} dot>
          {record.status.replace('_', ' ')}
        </Badge>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Batch Records (eBMR)"
          description="Electronic Batch Manufacturing Records"
        />

        <Card elevation="raised">
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <Input
                  variant="search"
                  placeholder="Search by WO number, batch, or step..."
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
                  <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : records.length > 0 ? (
              <>
                <Table
                  columns={columns}
                  data={records}
                  keyField="id"
                  isLoading={isLoading}
                  emptyMessage="No batch records found"
                  striped
                  hoverable
                  onRowClick={(record) => router.push(`/production/batch-records/${record.id}`)}
                />

                {/* Pagination */}
                {pagination.total > pagination.limit && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-500">
                      Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                      {pagination.total} records
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
                icon={<ClipboardList className="h-8 w-8" />}
                title="No batch records found"
                description="Batch records are created when work orders are processed"
              />
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <FileText className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Records</p>
                  <p className="text-xl font-bold">{pagination.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <ClipboardList className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-xl font-bold">
                    {records.filter((r) => r.status === 'pending').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">In Progress</p>
                  <p className="text-xl font-bold">
                    {records.filter((r) => r.status === 'in_progress').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <ClipboardList className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="text-xl font-bold">
                    {records.filter((r) => r.status === 'completed').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
