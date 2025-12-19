'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import {
  FlaskConical,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import type { DataGridTypes } from 'devextreme-react/data-grid';

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
  { value: '', label: 'ทุกสถานะ' },
  { value: 'pending', label: 'รอทดสอบ' },
  { value: 'pass', label: 'ผ่าน' },
  { value: 'fail', label: 'ไม่ผ่าน' },
  { value: 'retest', label: 'ทดสอบซ้ำ' },
];

const testTypeOptions = [
  { value: '', label: 'ทุกประเภท' },
  { value: 'incoming', label: 'QC รับเข้า' },
  { value: 'in_process', label: 'QC ระหว่างผลิต' },
  { value: 'final', label: 'QC สุดท้าย' },
];

const getStatusLabel = (status: string): string => {
  const found = statusOptions.find(s => s.value === status);
  return found ? found.label : status;
};

const getTestTypeLabel = (type: string): string => {
  const found = testTypeOptions.find(t => t.value === type);
  return found ? found.label : type;
};

const getStatusBadgeVariant = (status: string): 'success' | 'danger' | 'warning' | 'default' => {
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

const getTestTypeBadgeVariant = (type: string): 'info' | 'warning' | 'success' | 'default' => {
  switch (type) {
    case 'incoming':
      return 'info';
    case 'in_process':
      return 'warning';
    case 'final':
      return 'success';
    default:
      return 'default';
  }
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export default function QualityTestsPage() {
  const router = useRouter();
  const [tests, setTests] = useState<QualityTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const fetchTests = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('testType', typeFilter);

      const res = await fetch(`/api/quality/tests?${params}`);
      const data = await res.json();

      if (data.success) {
        let fetchedTests = data.data?.items || [];

        // Client-side search filter
        if (search) {
          const searchLower = search.toLowerCase();
          fetchedTests = fetchedTests.filter((test: QualityTest) =>
            test.lotNumber?.toLowerCase().includes(searchLower) ||
            test.testName?.toLowerCase().includes(searchLower) ||
            test.sampleNumber?.toLowerCase().includes(searchLower)
          );
        }

        setTests(fetchedTests);
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
  }, [statusFilter, typeFilter, search]);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/quality/tests/${e.data.id}`);
    }
  };

  // Calculate summary stats
  const pendingCount = tests.filter((t) => t.status === 'pending').length;
  const passCount = tests.filter((t) => t.status === 'pass').length;
  const failCount = tests.filter((t) => t.status === 'fail').length;
  const retestCount = tests.filter((t) => t.status === 'retest').length;

  // Define columns for DevExtreme DataGrid
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'lotNumber',
      caption: 'Lot / ตัวอย่าง',
      width: 150,
      cellRender: (cellInfo) => (
        <div>
          <p className="font-mono font-medium">{cellInfo.data.lotNumber}</p>
          {cellInfo.data.sampleNumber && (
            <p className="text-xs text-gray-500">ตัวอย่าง: {cellInfo.data.sampleNumber}</p>
          )}
        </div>
      ),
    },
    {
      dataField: 'testName',
      caption: 'การทดสอบ',
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium">{cellInfo.data.testName}</p>
          {cellInfo.data.testMethod && (
            <p className="text-xs text-gray-500">{cellInfo.data.testMethod}</p>
          )}
        </div>
      ),
    },
    {
      dataField: 'testType',
      caption: 'ประเภท',
      width: 130,
      cellRender: (cellInfo) => (
        <Badge variant={getTestTypeBadgeVariant(cellInfo.data.testType)}>
          {getTestTypeLabel(cellInfo.data.testType)}
        </Badge>
      ),
    },
    {
      dataField: 'specification',
      caption: 'ข้อกำหนด',
      width: 150,
      cellRender: (cellInfo) => (
        <div className="text-sm">
          {cellInfo.data.specification ? (
            <p>{cellInfo.data.specification}</p>
          ) : cellInfo.data.minValue !== null || cellInfo.data.maxValue !== null ? (
            <p>
              {cellInfo.data.minValue !== null ? `Min: ${cellInfo.data.minValue}` : ''}
              {cellInfo.data.minValue !== null && cellInfo.data.maxValue !== null ? ' - ' : ''}
              {cellInfo.data.maxValue !== null ? `Max: ${cellInfo.data.maxValue}` : ''}
            </p>
          ) : (
            <p className="text-gray-400">-</p>
          )}
        </div>
      ),
    },
    {
      dataField: 'result',
      caption: 'ผลลัพธ์',
      width: 120,
      cellRender: (cellInfo) => (
        <div>
          {cellInfo.data.numericResult !== null ? (
            <p className="font-medium">{cellInfo.data.numericResult}</p>
          ) : cellInfo.data.result ? (
            <p className="font-medium">{cellInfo.data.result}</p>
          ) : (
            <p className="text-gray-400">-</p>
          )}
        </div>
      ),
    },
    {
      dataField: 'testDate',
      caption: 'วันที่ทดสอบ',
      width: 120,
      dataType: 'date',
      cellRender: (cellInfo) => formatDate(cellInfo.data.testDate),
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 120,
      cellRender: (cellInfo) => (
        <Badge variant={getStatusBadgeVariant(cellInfo.data.status)} dot>
          {getStatusLabel(cellInfo.data.status)}
        </Badge>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="การทดสอบคุณภาพ"
          description="จัดการการทดสอบและตรวจสอบคุณภาพ"
          actions={
            <DxButton
              text="ทดสอบใหม่"
              icon="plus"
              type="success"
              onClick={() => router.push('/quality/tests/new')}
            />
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Clock className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">รอทดสอบ</p>
                  <p className="text-xl font-bold">{pendingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">ผ่าน</p>
                  <p className="text-xl font-bold text-green-600">{passCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">ไม่ผ่าน</p>
                  <p className="text-xl font-bold text-red-600">{failCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">ทดสอบซ้ำ</p>
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
                <DxTextBox
                  placeholder="ค้นหาด้วย Lot หรือชื่อการทดสอบ..."
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                  onEnterKey={() => fetchTests()}
                />
              </div>
              <div className="w-full md:w-40">
                <DxSelectBox
                  items={testTypeOptions}
                  value={typeFilter}
                  onValueChange={setTypeFilter}
                  placeholder="ประเภท"
                  showClearButton
                />
              </div>
              <div className="w-full md:w-40">
                <DxSelectBox
                  items={statusOptions}
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  placeholder="สถานะ"
                  showClearButton
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table Card */}
        <Card elevation="raised">
          <CardContent>
            {tests.length > 0 || isLoading ? (
              <DxDataGrid
                dataSource={tests}
                keyExpr="id"
                columns={columns}
                loading={isLoading}
                sorting
                filterRow
                headerFilter
                export
                exportFileName="quality-tests"
                searchPanel
                columnChooser
                virtualScrolling={tests.length > 100}
                height={600}
                onRowClick={handleRowClick}
                noDataText="ไม่พบการทดสอบคุณภาพ"
              />
            ) : (
              <EmptyState
                icon={<FlaskConical className="h-8 w-8" />}
                title="ไม่พบการทดสอบคุณภาพ"
                description="เริ่มต้นด้วยการสร้างการทดสอบใหม่"
                action={{
                  label: 'ทดสอบใหม่',
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
