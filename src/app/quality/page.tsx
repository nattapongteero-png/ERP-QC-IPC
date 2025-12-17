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
import { Plus, Search, ClipboardCheck, AlertTriangle } from 'lucide-react';

interface QualityTest {
  id: number;
  testNumber: string;
  lotNumber: string;
  itemCode: string;
  itemName: string;
  testType: string;
  status: string;
  result: string | null;
  testedBy: string | null;
  testedAt: string | null;
}

const testStatuses = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
];

const testTypes = [
  { value: '', label: 'All Types' },
  { value: 'incoming', label: 'Incoming QC' },
  { value: 'in_process', label: 'In-Process QC' },
  { value: 'finished', label: 'Finished Product QC' },
  { value: 'stability', label: 'Stability Test' },
];

export default function QualityPage() {
  const router = useRouter();
  const [tests, setTests] = useState<QualityTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const fetchTests = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);

      const res = await fetch(`/api/quality/tests?${params}`);
      const data = await res.json();

      if (data.success) {
        setTests(data.data?.items || []);
      } else {
        setTests([]);
      }
    } catch (error) {
      console.error('Failed to fetch tests:', error);
      setTests([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, [statusFilter, typeFilter]);

  const handleSearch = () => {
    fetchTests();
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'passed':
        return 'success';
      case 'failed':
        return 'danger';
      case 'in_progress':
        return 'warning';
      default:
        return 'info';
    }
  };

  const columns = [
    { key: 'testNumber', header: 'Test Number' },
    { key: 'lotNumber', header: 'Lot Number' },
    { key: 'itemCode', header: 'Item Code' },
    { key: 'itemName', header: 'Item Name' },
    {
      key: 'testType',
      header: 'Test Type',
      render: (test: QualityTest) => (
        <Badge variant="info">{test.testType.replace('_', ' ')}</Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (test: QualityTest) => (
        <Badge variant={getStatusVariant(test.status)}>
          {test.status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'result',
      header: 'Result',
      render: (test: QualityTest) => test.result || '-',
    },
  ];

  // Summary stats
  const pendingCount = tests.filter((t) => t.status === 'pending').length;
  const inProgressCount = tests.filter((t) => t.status === 'in_progress').length;
  const passedCount = tests.filter((t) => t.status === 'passed').length;
  const failedCount = tests.filter((t) => t.status === 'failed').length;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quality Control</h1>
            <p className="text-gray-600">จัดการการตรวจสอบคุณภาพ</p>
          </div>
          <Button onClick={() => router.push('/quality/tests/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Test
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-blue-50">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-blue-600">Pending</p>
                <p className="text-2xl font-bold text-blue-700">{pendingCount}</p>
              </div>
            </div>
          </Card>
          <Card className="bg-yellow-50">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-yellow-600">In Progress</p>
                <p className="text-2xl font-bold text-yellow-700">{inProgressCount}</p>
              </div>
            </div>
          </Card>
          <Card className="bg-green-50">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-green-600">Passed</p>
                <p className="text-2xl font-bold text-green-700">{passedCount}</p>
              </div>
            </div>
          </Card>
          <Card className="bg-red-50">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-red-600">Failed</p>
                <p className="text-2xl font-bold text-red-700">{failedCount}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                variant="search"
                placeholder="Search by test number or lot..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onSearch={handleSearch}
              />
            </div>
            <div className="w-full md:w-40">
              <Select
                options={testTypes}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              />
            </div>
            <div className="w-full md:w-40">
              <Select
                options={testStatuses}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <Table
            columns={columns}
            data={tests}
            keyField="id"
            isLoading={isLoading}
            emptyMessage="No quality tests found"
            onRowClick={(test) => router.push(`/quality/tests/${test.id}`)}
          />
        </Card>
      </div>
    </MainLayout>
  );
}
