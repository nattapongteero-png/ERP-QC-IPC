'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Plus,
  FileCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface QualitySpec {
  id: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  testName: string;
  testMethod: string;
  specification: string;
  minValue: number | null;
  maxValue: number | null;
  unit: string;
  isCritical: boolean;
  isActive: boolean;
  createdAt: string;
}

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

const criticalOptions = [
  { value: '', label: 'All Types' },
  { value: 'true', label: 'Critical Only' },
  { value: 'false', label: 'Non-Critical' },
];

export default function QualitySpecsPage() {
  const router = useRouter();
  const [specs, setSpecs] = useState<QualitySpec[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [criticalFilter, setCriticalFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  const fetchSpecs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('isActive', statusFilter);

      const res = await fetch(`/api/quality/specs?${params}`);
      const data = await res.json();

      if (data.success) {
        let items = data.data?.items || [];
        // Client-side filter for critical (could be added to API later)
        if (criticalFilter) {
          items = items.filter((s: QualitySpec) =>
            criticalFilter === 'true' ? s.isCritical : !s.isCritical
          );
        }
        setSpecs(items);
        setPagination((prev) => ({ ...prev, total: data.data?.total || 0 }));
      } else {
        console.error('API error:', data.error);
        setSpecs([]);
      }
    } catch (error) {
      console.error('Failed to fetch quality specs:', error);
      setSpecs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecs();
  }, [pagination.page, statusFilter, criticalFilter]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchSpecs();
  };

  const formatRange = (spec: QualitySpec) => {
    if (spec.minValue !== null && spec.maxValue !== null) {
      return `${spec.minValue} - ${spec.maxValue} ${spec.unit || ''}`;
    } else if (spec.minValue !== null) {
      return `≥ ${spec.minValue} ${spec.unit || ''}`;
    } else if (spec.maxValue !== null) {
      return `≤ ${spec.maxValue} ${spec.unit || ''}`;
    }
    return spec.specification || '-';
  };

  const columns = [
    {
      key: 'item',
      header: 'Item',
      render: (spec: QualitySpec) => (
        <div>
          <p className="font-medium">{spec.itemCode}</p>
          <p className="text-sm text-gray-500">{spec.itemName}</p>
        </div>
      ),
    },
    {
      key: 'testName',
      header: 'Test Name',
      render: (spec: QualitySpec) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{spec.testName}</span>
          {spec.isCritical && (
            <Badge variant="danger" size="sm">
              Critical
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'testMethod',
      header: 'Method',
      render: (spec: QualitySpec) => spec.testMethod || '-',
    },
    {
      key: 'specification',
      header: 'Specification',
      render: (spec: QualitySpec) => formatRange(spec),
    },
    {
      key: 'status',
      header: 'Status',
      render: (spec: QualitySpec) => (
        <Badge variant={spec.isActive ? 'success' : 'default'} dot>
          {spec.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  // Calculate summary stats
  const totalCount = specs.length;
  const activeCount = specs.filter((s) => s.isActive).length;
  const criticalCount = specs.filter((s) => s.isCritical).length;
  const inactiveCount = specs.filter((s) => !s.isActive).length;

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Quality Specifications"
          description="Manage test specifications and acceptance criteria"
          actions={
            <Button
              onClick={() => router.push('/quality/specs/new')}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New Specification
            </Button>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileCheck className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Specs</p>
                  <p className="text-xl font-bold">{pagination.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Active</p>
                  <p className="text-xl font-bold text-green-600">{activeCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Critical</p>
                  <p className="text-xl font-bold text-red-600">{criticalCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <XCircle className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Inactive</p>
                  <p className="text-xl font-bold text-gray-600">{inactiveCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card elevation="raised">
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <Input
                  variant="search"
                  placeholder="Search by item code or test name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onSearch={handleSearch}
                />
              </div>
              <div className="w-full md:w-40">
                <Select
                  options={statusOptions}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                />
              </div>
              <div className="w-full md:w-40">
                <Select
                  options={criticalOptions}
                  value={criticalFilter}
                  onChange={(e) => setCriticalFilter(e.target.value)}
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
            ) : specs.length > 0 ? (
              <>
                <Table
                  columns={columns}
                  data={specs}
                  keyField="id"
                  isLoading={isLoading}
                  emptyMessage="No quality specifications found"
                  striped
                  hoverable
                  onRowClick={(spec) => router.push(`/quality/specs/${spec.id}`)}
                />

                {/* Pagination */}
                {pagination.total > pagination.limit && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-500">
                      Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                      {pagination.total} specifications
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
                icon={<FileCheck className="h-8 w-8" />}
                title="No quality specifications found"
                description="Create a new specification to define test criteria"
                action={{
                  label: 'New Specification',
                  onClick: () => router.push('/quality/specs/new'),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
