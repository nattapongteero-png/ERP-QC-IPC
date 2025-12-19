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
import { FileText } from 'lucide-react';
import type { DataGridTypes } from 'devextreme-react/data-grid';

interface BOM {
  id: number;
  code: string;
  name: string;
  productId: number;
  productCode: string;
  productName: string;
  productUnit: string;
  version: string;
  status: string;
  standardBatchSize: number;
  batchUnit: string;
  createdAt: string;
}

const statusOptions = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'draft', label: 'ร่าง' },
  { value: 'active', label: 'ใช้งาน' },
  { value: 'approved', label: 'อนุมัติแล้ว' },
  { value: 'obsolete', label: 'ยกเลิก' },
];

const getStatusLabel = (status: string): string => {
  const found = statusOptions.find(s => s.value === status);
  return found ? found.label : status;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH');
};

export default function BOMListPage() {
  const router = useRouter();
  const [boms, setBoms] = useState<BOM[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const fetchBOMs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/bom?${params}`);
      const data = await res.json();

      if (data.success) {
        let fetchedBoms = data.data?.items || [];

        // Client-side search filter
        if (search) {
          const searchLower = search.toLowerCase();
          fetchedBoms = fetchedBoms.filter((bom: BOM) =>
            bom.code?.toLowerCase().includes(searchLower) ||
            bom.name?.toLowerCase().includes(searchLower) ||
            bom.productCode?.toLowerCase().includes(searchLower) ||
            bom.productName?.toLowerCase().includes(searchLower)
          );
        }

        setBoms(fetchedBoms);
      } else {
        console.error('API error:', data.error);
        setBoms([]);
      }
    } catch (error) {
      console.error('Failed to fetch BOMs:', error);
      setBoms([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchBOMs();
  }, [fetchBOMs]);

  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/production/bom/${e.data.id}`);
    }
  };

  // Define columns for DevExtreme DataGrid
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'code',
      caption: 'รหัส BOM',
      width: 130,
      cellRender: (cellInfo) => (
        <span className="font-mono font-medium">{cellInfo.data.code}</span>
      ),
    },
    {
      dataField: 'name',
      caption: 'ชื่อ BOM',
    },
    {
      dataField: 'productCode',
      caption: 'รหัสสินค้า',
      width: 130,
      hideOnMobile: true,
    },
    {
      dataField: 'productName',
      caption: 'ชื่อสินค้า',
      hideOnMobile: true,
    },
    {
      dataField: 'standardBatchSize',
      caption: 'ขนาด Batch',
      width: 130,
      dataType: 'number',
      hideOnMobile: true,
      cellRender: (cellInfo) =>
        `${cellInfo.data.standardBatchSize?.toLocaleString() || '-'} ${cellInfo.data.batchUnit || ''}`,
    },
    {
      dataField: 'version',
      caption: 'เวอร์ชัน',
      width: 100,
      hideOnMobile: true,
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
    {
      dataField: 'createdAt',
      caption: 'สร้างเมื่อ',
      width: 110,
      dataType: 'date',
      hideOnMobile: true,
      cellRender: (cellInfo) => formatDate(cellInfo.data.createdAt),
    },
  ];

  return (
    <MainLayout>
      <div className="flex flex-col h-full gap-3 md:gap-2 lg:gap-4">
        <PageHeader
          title="สูตรการผลิต (BOM)"
          description="จัดการสูตรการผลิตและส่วนประกอบ"
          actions={
            <DxButton
              text="สร้าง BOM"
              icon="plus"
              type="success"
              onClick={() => router.push('/production/bom/new')}
            />
          }
        />

        {/* Filters Card */}
        <Card elevation="raised" className="md:py-1">
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <DxTextBox
                  placeholder="ค้นหาด้วยรหัส BOM หรือชื่อ..."
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                  onEnterKey={() => fetchBOMs()}
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
            {boms.length > 0 || isLoading ? (
              <DxDataGrid
                dataSource={boms}
                keyExpr="id"
                columns={columns}
                loading={isLoading}
                sorting
                filterRow
                headerFilter
                export
                exportFileName="bom-list"
                searchPanel
                columnChooser
                virtualScrolling={boms.length > 100}
                fillHeight
                onRowClick={handleRowClick}
                noDataText="ไม่พบสูตรการผลิต"
              />
            ) : (
              <EmptyState
                icon={<FileText className="h-8 w-8" />}
                title="ไม่พบสูตรการผลิต"
                description="เริ่มต้นด้วยการสร้างสูตรการผลิตใหม่"
                action={{
                  label: 'สร้าง BOM',
                  onClick: () => router.push('/production/bom/new'),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
