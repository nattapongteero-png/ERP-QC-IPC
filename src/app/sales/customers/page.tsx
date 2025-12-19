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
import { Users, Inbox } from 'lucide-react';
import type { DataGridTypes } from 'devextreme-react/data-grid';

interface Customer {
  id: number;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  customerType: string;
  creditLimit: number | null;
  creditTermDays: number | null;
  isActive: boolean;
}

const customerTypes = [
  { value: '', label: 'ทุกประเภท' },
  { value: 'hospital', label: 'โรงพยาบาล' },
  { value: 'clinic', label: 'คลินิก' },
  { value: 'pharmacy', label: 'ร้านขายยา' },
  { value: 'distributor', label: 'ตัวแทนจำหน่าย' },
  { value: 'traditional_medicine', label: 'แพทย์แผนไทย' },
  { value: 'spa_wellness', label: 'สปา & เวลเนส' },
  { value: 'government', label: 'หน่วยงานรัฐ' },
  { value: 'export', label: 'ส่งออก' },
  { value: 'other', label: 'อื่นๆ' },
];

const activeStatuses = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'true', label: 'ใช้งาน' },
  { value: 'false', label: 'ปิดใช้งาน' },
];

const getTypeVariant = (type: string): 'success' | 'info' | 'warning' | 'default' => {
  switch (type) {
    case 'hospital':
    case 'clinic':
      return 'success';
    case 'pharmacy':
    case 'distributor':
      return 'info';
    case 'government':
    case 'traditional_medicine':
      return 'warning';
    default:
      return 'default';
  }
};

const formatCustomerType = (type: string): string => {
  const found = customerTypes.find(t => t.value === type);
  return found ? found.label : type;
};

const formatCurrency = (amount: number | null) => {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
  }).format(amount);
};

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (typeFilter) params.set('customerType', typeFilter);
      if (activeFilter) params.set('isActive', activeFilter);

      const res = await fetch(`/api/customers?${params}`);
      const data = await res.json();

      if (data.success) {
        let fetchedCustomers = data.data?.items || [];

        // Client-side search filter
        if (search) {
          const searchLower = search.toLowerCase();
          fetchedCustomers = fetchedCustomers.filter((customer: Customer) =>
            customer.code?.toLowerCase().includes(searchLower) ||
            customer.name?.toLowerCase().includes(searchLower) ||
            customer.email?.toLowerCase().includes(searchLower) ||
            customer.phone?.toLowerCase().includes(searchLower)
          );
        }

        setCustomers(fetchedCustomers);
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, activeFilter, search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/sales/customers/${e.data.id}`);
    }
  };

  // Define columns for DevExtreme DataGrid
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'code',
      caption: 'รหัส',
      width: 100,
      cellRender: (cellInfo) => (
        <span className="font-mono font-medium">{cellInfo.data.code}</span>
      ),
    },
    {
      dataField: 'name',
      caption: 'ชื่อลูกค้า',
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-500" />
          <span className="font-medium">{cellInfo.data.name}</span>
        </div>
      ),
    },
    {
      dataField: 'contactPerson',
      caption: 'ผู้ติดต่อ',
      width: 150,
      cellRender: (cellInfo) => cellInfo.data.contactPerson || '-',
    },
    {
      dataField: 'phone',
      caption: 'โทรศัพท์',
      width: 130,
      cellRender: (cellInfo) => cellInfo.data.phone || '-',
    },
    {
      dataField: 'email',
      caption: 'อีเมล',
      width: 180,
      cellRender: (cellInfo) => cellInfo.data.email || '-',
    },
    {
      dataField: 'creditLimit',
      caption: 'วงเงินเครดิต',
      width: 140,
      dataType: 'number',
      cellRender: (cellInfo) => formatCurrency(cellInfo.data.creditLimit),
    },
    {
      dataField: 'creditTermDays',
      caption: 'เครดิต (วัน)',
      width: 110,
      dataType: 'number',
      cellRender: (cellInfo) => cellInfo.data.creditTermDays ? `${cellInfo.data.creditTermDays} วัน` : '-',
    },
    {
      dataField: 'customerType',
      caption: 'ประเภท',
      width: 140,
      cellRender: (cellInfo) => (
        <Badge variant={getTypeVariant(cellInfo.data.customerType)} dot>
          {formatCustomerType(cellInfo.data.customerType)}
        </Badge>
      ),
    },
    {
      dataField: 'isActive',
      caption: 'สถานะ',
      width: 100,
      cellRender: (cellInfo) => (
        <Badge variant={cellInfo.data.isActive ? 'success' : 'danger'} dot>
          {cellInfo.data.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
        </Badge>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="ลูกค้า"
          description="จัดการข้อมูลลูกค้า"
          actions={
            <DxButton
              text="เพิ่มลูกค้า"
              icon="plus"
              type="success"
              onClick={() => router.push('/sales/customers/new')}
            />
          }
        />

        {/* Filters Card */}
        <Card elevation="raised">
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <DxTextBox
                  placeholder="ค้นหาด้วยรหัส ชื่อ อีเมล หรือโทรศัพท์..."
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                  onEnterKey={() => fetchCustomers()}
                />
              </div>
              <div className="w-full md:w-40">
                <DxSelectBox
                  items={customerTypes}
                  value={typeFilter}
                  onValueChange={setTypeFilter}
                  placeholder="ประเภท"
                  showClearButton
                />
              </div>
              <div className="w-full md:w-32">
                <DxSelectBox
                  items={activeStatuses}
                  value={activeFilter}
                  onValueChange={setActiveFilter}
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
            {customers.length > 0 || isLoading ? (
              <DxDataGrid
                dataSource={customers}
                keyExpr="id"
                columns={columns}
                loading={isLoading}
                sorting
                filterRow
                headerFilter
                export
                exportFileName="customers"
                searchPanel
                columnChooser
                virtualScrolling={customers.length > 100}
                height={600}
                onRowClick={handleRowClick}
                noDataText="ไม่พบลูกค้า"
              />
            ) : (
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="ไม่พบลูกค้า"
                description="เริ่มต้นด้วยการเพิ่มลูกค้าใหม่"
                action={{
                  label: 'เพิ่มลูกค้า',
                  onClick: () => router.push('/sales/customers/new'),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
