'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { FileText, ClipboardList } from 'lucide-react';
import type { DataGridTypes } from 'devextreme-react/data-grid';

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
  { value: '', label: 'ทุกสถานะ' },
  { value: 'pending', label: 'รอดำเนินการ' },
  { value: 'in_progress', label: 'กำลังดำเนินการ' },
  { value: 'completed', label: 'เสร็จสิ้น' },
  { value: 'deviation', label: 'มีความเบี่ยงเบน' },
];

const getStatusLabel = (status: string): string => {
  const found = statusOptions.find(s => s.value === status);
  return found ? found.label : status.replace('_', ' ');
};

const getStatusBadgeVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'in_progress':
      return 'info';
    case 'deviation':
      return 'danger';
    case 'pending':
    default:
      return 'default';
  }
};

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('th-TH', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
};

export default function BatchRecordsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<BatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/production/batch-records?${params}`);
      const data = await res.json();

      if (data.success) {
        let fetchedRecords = data.data?.items || [];

        // Client-side search filter
        if (search) {
          const searchLower = search.toLowerCase();
          fetchedRecords = fetchedRecords.filter((record: BatchRecord) =>
            record.woNumber?.toLowerCase().includes(searchLower) ||
            record.batchNumber?.toLowerCase().includes(searchLower) ||
            record.productCode?.toLowerCase().includes(searchLower) ||
            record.stepName?.toLowerCase().includes(searchLower)
          );
        }

        setRecords(fetchedRecords);
      } else {
        console.error('API error:', data.error);
        setRecords([]);
      }
    } catch (error) {
      console.error('Failed to fetch batch records:', error);
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/production/batch-records/${e.data.id}`);
    }
  };

  // Calculate summary stats
  const pendingCount = records.filter((r) => r.status === 'pending').length;
  const inProgressCount = records.filter((r) => r.status === 'in_progress').length;
  const completedCount = records.filter((r) => r.status === 'completed').length;

  // Define columns for DevExtreme DataGrid
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'woNumber',
      caption: 'ใบสั่งผลิต',
      width: 150,
      cellRender: (cellInfo) => (
        <div>
          <p className="font-mono font-medium">{cellInfo.data.woNumber}</p>
          <p className="text-xs text-gray-500">{cellInfo.data.batchNumber}</p>
        </div>
      ),
    },
    {
      dataField: 'productCode',
      caption: 'สินค้า',
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium">{cellInfo.data.productCode}</p>
          <p className="text-xs text-gray-500">{cellInfo.data.productName}</p>
        </div>
      ),
    },
    {
      dataField: 'stepName',
      caption: 'ขั้นตอน',
      width: 200,
      hideOnMobile: true,
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium">#{cellInfo.data.sequence} - {cellInfo.data.stepName}</p>
          <p className="text-xs text-gray-500">{cellInfo.data.operationName}</p>
        </div>
      ),
    },
    {
      dataField: 'startTime',
      caption: 'เวลา',
      width: 180,
      dataType: 'datetime',
      hideOnMobile: true,
      cellRender: (cellInfo) => (
        <div className="text-sm">
          <p>เริ่ม: {formatDateTime(cellInfo.data.startTime)}</p>
          <p>สิ้นสุด: {formatDateTime(cellInfo.data.endTime)}</p>
        </div>
      ),
    },
    {
      dataField: 'performerName',
      caption: 'ผู้ปฏิบัติงาน',
      width: 130,
      hideOnMobile: true,
      cellRender: (cellInfo) => cellInfo.data.performerName || '-',
    },
    {
      dataField: 'verifierName',
      caption: 'ผู้ตรวจสอบ',
      width: 130,
      hideOnMobile: true,
      cellRender: (cellInfo) => cellInfo.data.verifierName || '-',
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 140,
      cellRender: (cellInfo) => (
        <Badge variant={getStatusBadgeVariant(cellInfo.data.status)} dot>
          {getStatusLabel(cellInfo.data.status)}
        </Badge>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 flex flex-col h-full gap-3 md:gap-2 lg:gap-4">
      <PageHeader
        title="บันทึกการผลิต (eBMR)"
        description="Electronic Batch Manufacturing Records"
      />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-2 lg:gap-4">
          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <FileText className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">ทั้งหมด</p>
                  <p className="text-xl font-bold">{records.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <ClipboardList className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">รอดำเนินการ</p>
                  <p className="text-xl font-bold">{pendingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">กำลังดำเนินการ</p>
                  <p className="text-xl font-bold">{inProgressCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <ClipboardList className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">เสร็จสิ้น</p>
                  <p className="text-xl font-bold">{completedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters Card */}
        <Card elevation="raised" className="md:py-1">
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <DxTextBox
                  placeholder="ค้นหาด้วยเลขที่ WO, Batch หรือขั้นตอน..."
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                  onEnterKey={() => fetchRecords()}
                />
              </div>
              <div className="w-full md:w-48">
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
        <Card elevation="raised" className="flex-1 min-h-0 flex flex-col md:overflow-hidden">
          <CardContent className="flex-1 min-h-0 flex flex-col">
            {records.length > 0 || isLoading ? (
              <DxDataGrid
                dataSource={records}
                keyExpr="id"
                columns={columns}
                loading={isLoading}
                sorting
                filterRow
                headerFilter
                export
                exportFileName="batch-records"
                columnChooser
                virtualScrolling={records.length > 100}
                fillHeight
                onRowClick={handleRowClick}
                noDataText="ไม่พบบันทึกการผลิต"
              />
            ) : (
              <EmptyState
                icon={<ClipboardList className="h-8 w-8" />}
                title="ไม่พบบันทึกการผลิต"
                description="บันทึกการผลิตจะถูกสร้างเมื่อมีการดำเนินการผลิตตามใบสั่งผลิต"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
