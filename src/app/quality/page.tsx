'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ClipboardCheck, AlertTriangle, Inbox } from 'lucide-react';
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

  const getStatusVariant = (status: string): 'primary' | 'danger' | 'secondary' | 'default' => {
    switch (status) {
      case 'passed':
        return 'primary';
      case 'failed':
        return 'danger';
      case 'in_progress':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const columns: DxDataGridColumn[] = [
    { dataField: 'testNumber', caption: 'Test Number', width: 150 },
    { dataField: 'lotNumber', caption: 'Lot Number', width: 150 },
    { dataField: 'itemCode', caption: 'Item Code', width: 120 },
    { dataField: 'itemName', caption: 'Item Name' },
    {
      dataField: 'testType',
      caption: 'Test Type',
      width: 150,
      cellRender: (cellInfo) => (
        <Badge variant="default">{cellInfo.data.testType.replace('_', ' ')}</Badge>
      ),
    },
    {
      dataField: 'status',
      caption: 'Status',
      width: 120,
      cellRender: (cellInfo) => (
        <Badge variant={getStatusVariant(cellInfo.data.status)}>
          {cellInfo.data.status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      dataField: 'result',
      caption: 'Result',
      width: 100,
      cellRender: (cellInfo) => <span>{cellInfo.data.result || '-'}</span>,
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
            <DxButton
              text="New Test"
              icon="plus"
              type="default"
              onClick={() => router.push('/quality/tests/new')}
            />
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
                <DxTextBox
                  mode="search"
                  placeholder="Search by test number or lot..."
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  onEnterKey={handleSearch}
                />
              </div>
              <div className="w-full md:w-40">
                <DxSelectBox
                  items={testTypes}
                  value={typeFilter}
                  onValueChange={setTypeFilter}
                  valueExpr="value"
                  displayExpr="label"
                />
              </div>
              <div className="w-full md:w-40">
                <DxSelectBox
                  items={testStatuses}
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  valueExpr="value"
                  displayExpr="label"
                />
              </div>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <DxLoadIndicator />
              </div>
            ) : tests.length > 0 ? (
              <DxDataGrid
                dataSource={tests}
                keyExpr="id"
                columns={columns}
                showBorders
                height={500}
                noDataText="No quality tests found"
                onRowClick={(e) => router.push(`/quality/tests/${e.data.id}`)}
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
