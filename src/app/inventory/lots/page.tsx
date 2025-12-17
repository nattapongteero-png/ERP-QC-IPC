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

interface Lot {
  id: number;
  lotNumber: string;
  batchNumber: string;
  quantity: number;
  reservedQuantity: number;
  unit: string;
  status: string;
  manufacturingDate: string;
  expiryDate: string;
  itemCode: string;
  itemName: string;
  warehouseName: string;
}

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'quarantine', label: 'Quarantine' },
  { value: 'under_test', label: 'Under Test' },
  { value: 'released', label: 'Released' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'blocked', label: 'Blocked' },
];

export default function LotsPage() {
  const router = useRouter();
  const [lots, setLots] = useState<Lot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  const fetchLots = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/inventory/lots?${params}`);
      const data = await res.json();

      if (data.success) {
        setLots(data.data?.items || []);
        setPagination((prev) => ({ ...prev, total: data.data?.total || 0 }));
      } else {
        console.error('API error:', data.error);
        setLots([]);
      }
    } catch (error) {
      console.error('Failed to fetch lots:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLots();
  }, [pagination.page, statusFilter]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchLots();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH');
  };

  const columns = [
    { key: 'lotNumber', header: 'Lot Number' },
    { key: 'itemCode', header: 'Item Code' },
    { key: 'itemName', header: 'Item Name' },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (lot: Lot) => (
        <span>
          {lot.quantity.toLocaleString()} {lot.unit}
          {lot.reservedQuantity > 0 && (
            <span className="text-xs text-gray-500 ml-1">
              ({lot.reservedQuantity} reserved)
            </span>
          )}
        </span>
      ),
    },
    { key: 'warehouseName', header: 'Warehouse' },
    {
      key: 'expiryDate',
      header: 'Expiry Date',
      render: (lot: Lot) => {
        const expiry = lot.expiryDate ? new Date(lot.expiryDate) : null;
        const isExpiringSoon = expiry && (expiry.getTime() - Date.now()) < 30 * 24 * 60 * 60 * 1000;
        return (
          <span className={isExpiringSoon ? 'text-red-600 font-medium' : ''}>
            {formatDate(lot.expiryDate)}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (lot: Lot) => (
        <Badge variant={getStatusVariant(lot.status)}>
          {lot.status.replace('_', ' ')}
        </Badge>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory Lots</h1>
            <p className="text-gray-600">จัดการ Lot สินค้าคงคลัง</p>
          </div>
          <Button onClick={() => router.push('/inventory/lots/receive')}>
            <Plus className="h-4 w-4 mr-2" />
            Receive Stock
          </Button>
        </div>

        <Card>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Input
                  placeholder="Search by lot number or batch..."
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
            data={lots}
            keyField="id"
            isLoading={isLoading}
            emptyMessage="No lots found"
            onRowClick={(lot) => router.push(`/inventory/lots/${lot.id}`)}
          />

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} lots
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
