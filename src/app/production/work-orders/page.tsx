'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { Badge, getStatusVariant } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Inbox } from 'lucide-react';
import type { DataGridTypes } from 'devextreme-react/data-grid';

interface WorkOrder {
  id: number;
  woNumber: string;
  batchNumber: string;
  plannedQuantity: number;
  actualQuantity: number;
  unit: string;
  status: string;
  priority: number;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  yieldPercentage: number;
  productCode: string;
  productName: string;
}

const statusOptions = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'planned', label: 'วางแผน' },
  { value: 'released', label: 'ปล่อยงาน' },
  { value: 'in_progress', label: 'กำลังผลิต' },
  { value: 'completed', label: 'เสร็จสิ้น' },
  { value: 'cancelled', label: 'ยกเลิก' },
];

const getStatusLabel = (status: string): string => {
  const found = statusOptions.find(s => s.value === status);
  return found ? found.label : status.replace('_', ' ');
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH');
};

const getPriorityVariant = (priority: number): 'danger' | 'warning' | 'default' => {
  if (priority <= 3) return 'danger';
  if (priority <= 6) return 'warning';
  return 'default';
};

const getPriorityLabel = (priority: number): string => {
  if (priority <= 3) return 'สูง';
  if (priority <= 6) return 'กลาง';
  return 'ต่ำ';
};

export default function WorkOrdersPage() {
  const router = useRouter();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchWorkOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/production/work-orders?${params}`);
      const data = await res.json();

      if (data.success) {
        let fetchedOrders = data.data?.items || [];

        // Client-side search filter
        if (search) {
          const searchLower = search.toLowerCase();
          fetchedOrders = fetchedOrders.filter((wo: WorkOrder) =>
            wo.woNumber?.toLowerCase().includes(searchLower) ||
            wo.batchNumber?.toLowerCase().includes(searchLower) ||
            wo.productCode?.toLowerCase().includes(searchLower) ||
            wo.productName?.toLowerCase().includes(searchLower)
          );
        }

        setWorkOrders(fetchedOrders);
      } else {
        console.error('API error:', data.error);
        setWorkOrders([]);
      }
    } catch (error) {
      console.error('Failed to fetch work orders:', error);
      setWorkOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/production/work-orders/${e.data.id}`);
    }
  };

  // Define columns for DevExtreme DataGrid
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'woNumber',
      caption: 'เลขที่ WO',
      width: 130,
      cellRender: (cellInfo) => (
        <span className="font-mono font-medium">{cellInfo.data.woNumber}</span>
      ),
    },
    {
      dataField: 'batchNumber',
      caption: 'เลขที่ Batch',
      width: 130,
      cellRender: (cellInfo) => (
        <span className="font-mono">{cellInfo.data.batchNumber}</span>
      ),
    },
    {
      dataField: 'productCode',
      caption: 'รหัสสินค้า',
      width: 120,
    },
    {
      dataField: 'productName',
      caption: 'ชื่อสินค้า',
    },
    {
      dataField: 'plannedQuantity',
      caption: 'จำนวนแผน',
      width: 120,
      dataType: 'number',
      cellRender: (cellInfo) => `${cellInfo.data.plannedQuantity.toLocaleString()} ${cellInfo.data.unit}`,
    },
    {
      dataField: 'actualQuantity',
      caption: 'จำนวนจริง',
      width: 120,
      dataType: 'number',
      cellRender: (cellInfo) =>
        cellInfo.data.actualQuantity ? `${cellInfo.data.actualQuantity.toLocaleString()} ${cellInfo.data.unit}` : '-',
    },
    {
      dataField: 'plannedStartDate',
      caption: 'วันเริ่ม',
      width: 100,
      dataType: 'date',
      cellRender: (cellInfo) => formatDate(cellInfo.data.plannedStartDate),
    },
    {
      dataField: 'priority',
      caption: 'ความสำคัญ',
      width: 100,
      dataType: 'number',
      cellRender: (cellInfo) => (
        <Badge variant={getPriorityVariant(cellInfo.data.priority)} dot>
          {getPriorityLabel(cellInfo.data.priority)}
        </Badge>
      ),
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 120,
      cellRender: (cellInfo) => (
        <Badge variant={getStatusVariant(cellInfo.data.status)} dot>
          {getStatusLabel(cellInfo.data.status)}
        </Badge>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="ใบสั่งผลิต"
          description="จัดการใบสั่งผลิต"
          actions={
            <DxButton
              text="สร้างใบสั่งผลิต"
              icon="plus"
              type="success"
              onClick={() => router.push('/production/work-orders/new')}
            />
          }
        />

        {/* Filters Card */}
        <Card elevation="raised">
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <DxTextBox
                  placeholder="ค้นหาด้วยเลขที่ WO, Batch หรือสินค้า..."
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                  onEnterKey={() => fetchWorkOrders()}
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
        <Card elevation="raised">
          <CardContent>
            {workOrders.length > 0 || isLoading ? (
              <DxDataGrid
                dataSource={workOrders}
                keyExpr="id"
                columns={columns}
                loading={isLoading}
                sorting
                filterRow
                headerFilter
                export
                exportFileName="work-orders"
                searchPanel
                columnChooser
                virtualScrolling={workOrders.length > 100}
                height={600}
                onRowClick={handleRowClick}
                noDataText="ไม่พบใบสั่งผลิต"
              />
            ) : (
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="ไม่พบใบสั่งผลิต"
                description="เริ่มต้นด้วยการสร้างใบสั่งผลิตใหม่"
                action={{
                  label: 'สร้างใบสั่งผลิต',
                  onClick: () => router.push('/production/work-orders/new'),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
