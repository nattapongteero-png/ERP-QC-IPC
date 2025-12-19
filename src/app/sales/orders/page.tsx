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
import { Inbox } from 'lucide-react';
import type { DataGridTypes } from 'devextreme-react/data-grid';

interface SalesOrder {
  id: number;
  soNumber: string;
  customerName: string;
  orderDate: string;
  requiredDate: string;
  status: string;
  totalAmount: number;
  currency: string;
}

const soStatuses = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'draft', label: 'ร่าง' },
  { value: 'confirmed', label: 'ยืนยันแล้ว' },
  { value: 'processing', label: 'กำลังดำเนินการ' },
  { value: 'ready', label: 'พร้อมส่ง' },
  { value: 'shipped', label: 'จัดส่งแล้ว' },
  { value: 'delivered', label: 'ส่งมอบแล้ว' },
  { value: 'cancelled', label: 'ยกเลิก' },
];

const getStatusVariant = (status: string): 'success' | 'danger' | 'warning' | 'info' | 'default' => {
  switch (status) {
    case 'delivered':
    case 'shipped':
      return 'success';
    case 'cancelled':
      return 'danger';
    case 'processing':
    case 'ready':
      return 'warning';
    case 'confirmed':
      return 'info';
    default:
      return 'default';
  }
};

const getStatusLabel = (status: string): string => {
  const found = soStatuses.find(s => s.value === status);
  return found ? found.label : status;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH');
};

const formatCurrency = (amount: number, currency: string = 'THB') => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency,
  }).format(amount || 0);
};

export default function SalesOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/sales/orders?${params}`);
      const data = await res.json();

      if (data.success) {
        let fetchedOrders = data.data?.items || [];

        // Client-side search filter
        if (search) {
          const searchLower = search.toLowerCase();
          fetchedOrders = fetchedOrders.filter((order: SalesOrder) =>
            order.soNumber?.toLowerCase().includes(searchLower) ||
            order.customerName?.toLowerCase().includes(searchLower)
          );
        }

        setOrders(fetchedOrders);
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/sales/orders/${e.data.id}`);
    }
  };

  // Define columns for DevExtreme DataGrid
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'soNumber',
      caption: 'เลขที่ SO',
      width: 140,
      cellRender: (cellInfo) => (
        <span className="font-mono font-medium">{cellInfo.data.soNumber}</span>
      ),
    },
    {
      dataField: 'customerName',
      caption: 'ลูกค้า',
    },
    {
      dataField: 'orderDate',
      caption: 'วันที่สั่งซื้อ',
      width: 120,
      dataType: 'date',
      cellRender: (cellInfo) => formatDate(cellInfo.data.orderDate),
    },
    {
      dataField: 'requiredDate',
      caption: 'วันที่ต้องการ',
      width: 120,
      dataType: 'date',
      cellRender: (cellInfo) => formatDate(cellInfo.data.requiredDate),
    },
    {
      dataField: 'totalAmount',
      caption: 'ยอดรวม',
      width: 150,
      dataType: 'number',
      cellRender: (cellInfo) => formatCurrency(cellInfo.data.totalAmount, cellInfo.data.currency),
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 130,
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
          title="ใบสั่งขาย"
          description="จัดการใบสั่งขาย"
          actions={
            <DxButton
              text="สร้างใบสั่งขาย"
              icon="plus"
              type="success"
              onClick={() => router.push('/sales/orders/new')}
            />
          }
        />

        {/* Filters Card */}
        <Card elevation="raised">
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <DxTextBox
                  placeholder="ค้นหาด้วยเลขที่ SO หรือชื่อลูกค้า..."
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                  onEnterKey={() => fetchOrders()}
                />
              </div>
              <div className="w-full md:w-48">
                <DxSelectBox
                  items={soStatuses}
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
            {orders.length > 0 || isLoading ? (
              <DxDataGrid
                dataSource={orders}
                keyExpr="id"
                columns={columns}
                loading={isLoading}
                sorting
                filterRow
                headerFilter
                export
                exportFileName="sales-orders"
                searchPanel
                columnChooser
                virtualScrolling={orders.length > 100}
                height={600}
                onRowClick={handleRowClick}
                noDataText="ไม่พบใบสั่งขาย"
              />
            ) : (
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="ไม่พบใบสั่งขาย"
                description="เริ่มต้นด้วยการสร้างใบสั่งขายใหม่"
                action={{
                  label: 'สร้างใบสั่งขาย',
                  onClick: () => router.push('/sales/orders/new'),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
