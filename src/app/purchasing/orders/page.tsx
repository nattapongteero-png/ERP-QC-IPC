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

interface PurchaseOrder {
  id: number;
  poNumber: string;
  vendorName: string;
  orderDate: string;
  expectedDate: string;
  status: string;
  totalAmount: number;
  currency: string;
}

const poStatuses = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'draft', label: 'ร่าง' },
  { value: 'pending_approval', label: 'รออนุมัติ' },
  { value: 'approved', label: 'อนุมัติแล้ว' },
  { value: 'sent', label: 'ส่งให้ผู้ขาย' },
  { value: 'partial', label: 'รับบางส่วน' },
  { value: 'received', label: 'รับครบแล้ว' },
  { value: 'cancelled', label: 'ยกเลิก' },
];

const getStatusVariant = (status: string): 'success' | 'danger' | 'warning' | 'info' | 'default' => {
  switch (status) {
    case 'approved':
    case 'received':
      return 'success';
    case 'cancelled':
      return 'danger';
    case 'pending_approval':
      return 'warning';
    case 'partial':
      return 'info';
    default:
      return 'default';
  }
};

const getStatusLabel = (status: string): string => {
  const found = poStatuses.find(s => s.value === status);
  return found ? found.label : status.replace('_', ' ');
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

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/purchasing/orders?${params}`);
      const data = await res.json();

      if (data.success) {
        let fetchedOrders = data.data?.items || [];

        // Client-side search filter
        if (search) {
          const searchLower = search.toLowerCase();
          fetchedOrders = fetchedOrders.filter((order: PurchaseOrder) =>
            order.poNumber?.toLowerCase().includes(searchLower) ||
            order.vendorName?.toLowerCase().includes(searchLower)
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
      router.push(`/purchasing/orders/${e.data.id}`);
    }
  };

  // Define columns for DevExtreme DataGrid
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'poNumber',
      caption: 'เลขที่ PO',
      width: 140,
      cellRender: (cellInfo) => (
        <span className="font-mono font-medium">{cellInfo.data.poNumber}</span>
      ),
    },
    {
      dataField: 'vendorName',
      caption: 'ผู้ขาย',
    },
    {
      dataField: 'orderDate',
      caption: 'วันที่สั่ง',
      width: 120,
      dataType: 'date',
      cellRender: (cellInfo) => formatDate(cellInfo.data.orderDate),
    },
    {
      dataField: 'expectedDate',
      caption: 'วันที่คาดรับ',
      width: 120,
      dataType: 'date',
      cellRender: (cellInfo) => formatDate(cellInfo.data.expectedDate),
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
          title="ใบสั่งซื้อ"
          description="จัดการใบสั่งซื้อ"
          actions={
            <DxButton
              text="สร้างใบสั่งซื้อ"
              icon="plus"
              type="success"
              onClick={() => router.push('/purchasing/orders/new')}
            />
          }
        />

        {/* Filters Card */}
        <Card elevation="raised">
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <DxTextBox
                  placeholder="ค้นหาด้วยเลขที่ PO หรือชื่อผู้ขาย..."
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                  onEnterKey={() => fetchOrders()}
                />
              </div>
              <div className="w-full md:w-48">
                <DxSelectBox
                  items={poStatuses}
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
                exportFileName="purchase-orders"
                searchPanel
                columnChooser
                virtualScrolling={orders.length > 100}
                height={600}
                onRowClick={handleRowClick}
                noDataText="ไม่พบใบสั่งซื้อ"
              />
            ) : (
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="ไม่พบใบสั่งซื้อ"
                description="เริ่มต้นด้วยการสร้างใบสั่งซื้อใหม่"
                action={{
                  label: 'สร้างใบสั่งซื้อ',
                  onClick: () => router.push('/purchasing/orders/new'),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
