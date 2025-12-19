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

interface Vendor {
  id: number;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  isApproved: boolean;
  isVMI: boolean;
  isActive: boolean;
  leadTimeDays: number | null;
  paymentTerms: string | null;
}

const approvalStatuses = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'true', label: 'อนุมัติแล้ว' },
  { value: 'false', label: 'รอดำเนินการ' },
];

const vmiStatuses = [
  { value: '', label: 'ทุกประเภท' },
  { value: 'true', label: 'VMI' },
  { value: 'false', label: 'Non-VMI' },
];

export default function VendorsPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('');
  const [vmiFilter, setVmiFilter] = useState('');

  const fetchVendors = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (approvalFilter) params.set('isApproved', approvalFilter);
      if (vmiFilter) params.set('isVMI', vmiFilter);

      const res = await fetch(`/api/vendors?${params}`);
      const data = await res.json();

      if (data.success) {
        let fetchedVendors = data.data?.items || [];

        // Client-side search filter
        if (search) {
          const searchLower = search.toLowerCase();
          fetchedVendors = fetchedVendors.filter((vendor: Vendor) =>
            vendor.code?.toLowerCase().includes(searchLower) ||
            vendor.name?.toLowerCase().includes(searchLower)
          );
        }

        setVendors(fetchedVendors);
      } else {
        setVendors([]);
      }
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
      setVendors([]);
    } finally {
      setIsLoading(false);
    }
  }, [approvalFilter, vmiFilter, search]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/purchasing/vendors/${e.data.id}`);
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
      caption: 'ชื่อผู้ขาย',
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
      hideOnMobile: true,
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
      hideOnMobile: true,
      cellRender: (cellInfo) => cellInfo.data.email || '-',
    },
    {
      dataField: 'leadTimeDays',
      caption: 'Lead Time',
      width: 100,
      dataType: 'number',
      hideOnMobile: true,
      cellRender: (cellInfo) => cellInfo.data.leadTimeDays ? `${cellInfo.data.leadTimeDays} วัน` : '-',
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 160,
      hideOnMobile: true,
      cellRender: (cellInfo) => (
        <div className="flex gap-1">
          <Badge variant={cellInfo.data.isApproved ? 'success' : 'warning'} dot>
            {cellInfo.data.isApproved ? 'อนุมัติแล้ว' : 'รอดำเนินการ'}
          </Badge>
          {cellInfo.data.isVMI && (
            <Badge variant="info">VMI</Badge>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="flex flex-col h-full gap-3 md:gap-2 lg:gap-4">
        <PageHeader
          title="ผู้ขาย"
          description="จัดการข้อมูลผู้ขาย"
          actions={
            <DxButton
              text="เพิ่มผู้ขาย"
              icon="plus"
              type="success"
              onClick={() => router.push('/purchasing/vendors/new')}
            />
          }
        />

        {/* Filters Card */}
        <Card elevation="raised" className="md:py-1">
          <CardContent className="py-2 md:py-1 lg:py-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <DxTextBox
                  placeholder="ค้นหาด้วยรหัสหรือชื่อ..."
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                  onEnterKey={() => fetchVendors()}
                />
              </div>
              <div className="w-full md:w-40">
                <DxSelectBox
                  items={approvalStatuses}
                  value={approvalFilter}
                  onValueChange={setApprovalFilter}
                  placeholder="สถานะ"
                  showClearButton
                />
              </div>
              <div className="w-full md:w-32">
                <DxSelectBox
                  items={vmiStatuses}
                  value={vmiFilter}
                  onValueChange={setVmiFilter}
                  placeholder="ประเภท"
                  showClearButton
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table Card */}
        <Card elevation="raised" className="flex-1 min-h-0 flex flex-col md:overflow-hidden">
          <CardContent className="flex-1 min-h-0 flex flex-col py-2 md:py-2 lg:py-4">
            {vendors.length > 0 || isLoading ? (
              <DxDataGrid
                dataSource={vendors}
                keyExpr="id"
                columns={columns}
                loading={isLoading}
                sorting
                filterRow
                headerFilter
                export
                exportFileName="vendors"
                searchPanel
                columnChooser
                virtualScrolling={vendors.length > 100}
                fillHeight
                onRowClick={handleRowClick}
                noDataText="ไม่พบผู้ขาย"
              />
            ) : (
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="ไม่พบผู้ขาย"
                description="เริ่มต้นด้วยการเพิ่มผู้ขายใหม่"
                action={{
                  label: 'เพิ่มผู้ขาย',
                  onClick: () => router.push('/purchasing/vendors/new'),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
