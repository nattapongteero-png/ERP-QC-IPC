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
import { Plus, ClipboardCheck, AlertTriangle, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

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
        <Badge variant={getStatusVariant(test.status)} dot>
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

  const summaryCards = [
    { label: 'Pending', count: pendingCount, icon: ClipboardCheck, color: 'blue' },
    { label: 'In Progress', count: inProgressCount, icon: ClipboardCheck, color: 'yellow' },
    { label: 'Passed', count: passedCount, icon: ClipboardCheck, color: 'green' },
    { label: 'Failed', count: failedCount, icon: AlertTriangle, color: 'red' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Quality Control"
          description="จัดการการตรวจสอบคุณภาพ"
          actions={
            <Button onClick={() => router.push('/quality/tests/new')} leftIcon={<Plus className="h-4 w-4" />}>
              New Test
            </Button>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {summaryCards.map((card, index) => (
            <Card
              key={card.label}
              elevation="raised"
              padding="md"
              className={cn(
                `bg-${card.color}-50`,
                'motion-safe:animate-fade-in motion-reduce:animate-none'
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-3">
                <card.icon className={cn('h-8 w-8', `text-${card.color}-500`)} />
                <div>
                  <p className={cn('text-sm', `text-${card.color}-600`)}>{card.label}</p>
                  <p className={cn('text-2xl font-bold', `text-${card.color}-700`)}>{card.count}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card elevation="raised">
          <CardContent>
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
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : tests.length > 0 ? (
              <Table
                columns={columns}
                data={tests}
                keyField="id"
                isLoading={isLoading}
                emptyMessage="No quality tests found"
                onRowClick={(test) => router.push(`/quality/tests/${test.id}`)}
              />
            ) : (
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="No quality tests found"
                description="Get started by creating your first quality test"
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
