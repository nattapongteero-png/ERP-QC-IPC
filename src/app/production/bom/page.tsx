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
import { Plus, FileText } from 'lucide-react';

interface BOM {
  id: number;
  code: string;
  name: string;
  productId: number;
  productCode: string;
  productName: string;
  productUnit: string;
  version: string;
  status: string;
  standardBatchSize: number;
  batchUnit: string;
  createdAt: string;
}

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'approved', label: 'Approved' },
  { value: 'obsolete', label: 'Obsolete' },
];

export default function BOMListPage() {
  const router = useRouter();
  const [boms, setBoms] = useState<BOM[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  const fetchBOMs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/bom?${params}`);
      const data = await res.json();

      if (data.success) {
        setBoms(data.data?.items || []);
        setPagination((prev) => ({ ...prev, total: data.data?.total || 0 }));
      } else {
        console.error('API error:', data.error);
        setBoms([]);
      }
    } catch (error) {
      console.error('Failed to fetch BOMs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBOMs();
  }, [pagination.page, statusFilter]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchBOMs();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH');
  };

  const columns = [
    { key: 'code', header: 'BOM Code' },
    { key: 'name', header: 'BOM Name' },
    { key: 'productCode', header: 'Product Code' },
    { key: 'productName', header: 'Product Name' },
    {
      key: 'standardBatchSize',
      header: 'Batch Size',
      render: (bom: BOM) => `${bom.standardBatchSize?.toLocaleString() || '-'} ${bom.batchUnit || ''}`,
    },
    { key: 'version', header: 'Version' },
    {
      key: 'status',
      header: 'Status',
      render: (bom: BOM) => (
        <Badge variant={getStatusVariant(bom.status)} dot>
          {bom.status}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (bom: BOM) => formatDate(bom.createdAt),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Bill of Materials"
          description="Manage product recipes and formulas"
          actions={
            <Button onClick={() => router.push('/production/bom/new')} leftIcon={<Plus className="h-4 w-4" />}>
              Create BOM
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
                  placeholder="Search by BOM code or name..."
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
            ) : boms.length > 0 ? (
              <>
                <Table
                  columns={columns}
                  data={boms}
                  keyField="id"
                  isLoading={isLoading}
                  emptyMessage="No BOMs found"
                  striped
                  hoverable
                  onRowClick={(bom) => router.push(`/production/bom/${bom.id}`)}
                />

                {/* Pagination */}
                {pagination.total > pagination.limit && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-500">
                      Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                      {pagination.total} BOMs
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
                icon={<FileText className="h-8 w-8" />}
                title="No BOMs found"
                description="Get started by creating your first Bill of Materials"
                action={{
                  label: 'Create BOM',
                  onClick: () => router.push('/production/bom/new'),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
