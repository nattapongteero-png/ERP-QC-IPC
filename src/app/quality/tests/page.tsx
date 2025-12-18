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
  FlaskConical,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';

interface QualityTest {
  id: number;
  lotId: number;
  lotNumber: string;
  specId: number;
  testName: string;
  testMethod: string;
  specification: string;
  minValue: number | null;
  maxValue: number | null;
  testType: string;
  sampleNumber: string;
  testDate: string;
  result: string;
  numericResult: number | null;
  status: string;
  createdAt: string;
}

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'pass', label: 'Passed' },
  { value: 'fail', label: 'Failed' },
  { value: 'retest', label: 'Retest' },
];

const testTypeOptions = [
  { value: '', label: 'All Types' },
  { value: 'incoming', label: 'Incoming QC' },
  { value: 'in_process', label: 'In-Process QC' },
  { value: 'final', label: 'Final QC' },
];

export default function QualityTestsPage() {
  const router = useRouter();
  const [tests, setTests] = useState<QualityTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  const fetchTests = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('testType', typeFilter);

      const res = await fetch(`/api/quality/tests?${params}`);
      const data = await res.json();

      if (data.success) {
        setTests(data.data?.items || []);
        setPagination((prev) => ({ ...prev, total: data.data?.total || 0 }));
      } else {
        console.error('API error:', data.error);
        setTests([]);
      }
    } catch (error) {
      console.error('Failed to fetch quality tests:', error);
      setTests([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, [pagination.page, statusFilter, typeFilter]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchTests();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadgeVariant = (status: string): 'primary' | 'success' | 'danger' | 'warning' | 'default' => {
    switch (status) {
      case 'pass':
        return 'success';
      case 'fail':
        return 'danger';
      case 'retest':
        return 'warning';
      case 'pending':
      default:
        return 'default';
    }
  };

  const getTestTypeBadgeVariant = (type: string): 'primary' | 'secondary' | 'info' | 'default' => {
    switch (type) {
      case 'incoming':
        return 'primary';
      case 'in_process':
        return 'secondary';
      case 'final':
        return 'info';
      default:
        return 'default';
    }
  };

  const getTestTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      incoming: 'Incoming',
      in_process: 'In-Process',
      final: 'Final',
    };
    return labels[type] || type;
  };

  const columns = [
    {
      key: 'lotNumber',
      header: 'Lot / Sample',
      render: (test: QualityTest) => (
        <div>
          <p className="font-medium">{test.lotNumber}</p>
          {test.sampleNumber && (
            <p className="text-sm text-gray-500">Sample: {test.sampleNumber}</p>
          )}
        </div>
      ),
    },
    {
      key: 'testName',
      header: 'Test',
      render: (test: QualityTest) => (
        <div>
          <p className="font-medium">{test.testName}</p>
          {test.testMethod && (
            <p className="text-sm text-gray-500">{test.testMethod}</p>
          )}
        </div>
      ),
    },
    {
      key: 'testType',
      header: 'Type',
      render: (test: QualityTest) => (
        <Badge variant={getTestTypeBadgeVariant(test.testType)}>
          {getTestTypeLabel(test.testType)}
        </Badge>
      ),
    },
    {
      key: 'specification',
      header: 'Specification',
      render: (test: QualityTest) => (
        <div className="text-sm">
          {test.specification ? (
            <p>{test.specification}</p>
          ) : test.minValue !== null || test.maxValue !== null ? (
            <p>
              {test.minValue !== null ? `Min: ${test.minValue}` : ''}
              {test.minValue !== null && test.maxValue !== null ? ' - ' : ''}
              {test.maxValue !== null ? `Max: ${test.maxValue}` : ''}
            </p>
          ) : (
            <p className="text-gray-400">-</p>
          )}
        </div>
      ),
    },
    {
      key: 'result',
      header: 'Result',
      render: (test: QualityTest) => (
        <div>
          {test.numericResult !== null ? (
            <p className="font-medium">{test.numericResult}</p>
          ) : test.result ? (
            <p className="font-medium">{test.result}</p>
          ) : (
            <p className="text-gray-400">-</p>
          )}
        </div>
      ),
    },
    {
      key: 'testDate',
      header: 'Test Date',
      render: (test: QualityTest) => formatDate(test.testDate),
    },
    {
      key: 'status',
      header: 'Status',
      render: (test: QualityTest) => (
        <Badge variant={getStatusBadgeVariant(test.status)} dot>
          {test.status}
        </Badge>
      ),
    },
  ];

  // Calculate summary stats
  const pendingCount = tests.filter((t) => t.status === 'pending').length;
  const passCount = tests.filter((t) => t.status === 'pass').length;
  const failCount = tests.filter((t) => t.status === 'fail').length;
  const retestCount = tests.filter((t) => t.status === 'retest').length;

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Quality Tests"
          description="Manage quality control tests and inspections"
          actions={
            <Button
              onClick={() => router.push('/quality/tests/new')}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New Test
            </Button>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Clock className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-xl font-bold">{pendingCount}</p>
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
                  <p className="text-sm text-gray-500">Passed</p>
                  <p className="text-xl font-bold text-green-600">{passCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Failed</p>
                  <p className="text-xl font-bold text-red-600">{failCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Retest</p>
                  <p className="text-xl font-bold text-yellow-600">{retestCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters Card */}
        <Card elevation="raised">
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  variant="search"
                  placeholder="Search by lot number or test name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onSearch={handleSearch}
                />
              </div>
              <div className="w-full md:w-40">
                <Select
                  options={testTypeOptions}
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                />
              </div>
              <div className="w-full md:w-40">
                <Select
                  options={statusOptions}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table Card */}
        <Card elevation="raised">
          <CardContent>
            {/* Table */}
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : tests.length > 0 ? (
              <>
                <Table
                  columns={columns}
                  data={tests}
                  keyField="id"
                  isLoading={isLoading}
                  emptyMessage="No quality tests found"
                  striped
                  hoverable
                  onRowClick={(test) => router.push(`/quality/tests/${test.id}`)}
                />

                {/* Pagination */}
                {pagination.total > pagination.limit && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-500">
                      Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                      {pagination.total} tests
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
                icon={<FlaskConical className="h-8 w-8" />}
                title="No quality tests found"
                description="Create a new quality test to get started"
                action={{
                  label: 'New Test',
                  onClick: () => router.push('/quality/tests/new'),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
