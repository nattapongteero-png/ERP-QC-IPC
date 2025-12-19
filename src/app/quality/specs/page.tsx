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
  FileCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import type { DataGridTypes } from 'devextreme-react/data-grid';

interface QualitySpec {
  id: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  testName: string;
  testMethod: string;
  specification: string;
  minValue: number | null;
  maxValue: number | null;
  unit: string;
  isCritical: boolean;
  isActive: boolean;
  createdAt: string;
}

const statusOptions = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'true', label: 'ใช้งาน' },
  { value: 'false', label: 'ไม่ใช้งาน' },
];

const criticalOptions = [
  { value: '', label: 'ทุกประเภท' },
  { value: 'true', label: 'Critical เท่านั้น' },
  { value: 'false', label: 'Non-Critical' },
];

export default function QualitySpecsPage() {
  const router = useRouter();
  const [specs, setSpecs] = useState<QualitySpec[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [criticalFilter, setCriticalFilter] = useState('');

  const fetchSpecs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (statusFilter) params.set('isActive', statusFilter);

      const res = await fetch(`/api/quality/specs?${params}`);
      const data = await res.json();

      if (data.success) {
        let fetchedSpecs = data.data?.items || [];

        // Client-side search filter
        if (search) {
          const searchLower = search.toLowerCase();
          fetchedSpecs = fetchedSpecs.filter((spec: QualitySpec) =>
            spec.itemCode?.toLowerCase().includes(searchLower) ||
            spec.itemName?.toLowerCase().includes(searchLower) ||
            spec.testName?.toLowerCase().includes(searchLower)
          );
        }

        // Client-side filter for critical
        if (criticalFilter) {
          fetchedSpecs = fetchedSpecs.filter((s: QualitySpec) =>
            criticalFilter === 'true' ? s.isCritical : !s.isCritical
          );
        }

        setSpecs(fetchedSpecs);
      } else {
        console.error('API error:', data.error);
        setSpecs([]);
      }
    } catch (error) {
      console.error('Failed to fetch quality specs:', error);
      setSpecs([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, criticalFilter, search]);

  useEffect(() => {
    fetchSpecs();
  }, [fetchSpecs]);

  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/quality/specs/${e.data.id}`);
    }
  };

  const formatRange = (spec: QualitySpec) => {
    if (spec.minValue !== null && spec.maxValue !== null) {
      return `${spec.minValue} - ${spec.maxValue} ${spec.unit || ''}`;
    } else if (spec.minValue !== null) {
      return `≥ ${spec.minValue} ${spec.unit || ''}`;
    } else if (spec.maxValue !== null) {
      return `≤ ${spec.maxValue} ${spec.unit || ''}`;
    }
    return spec.specification || '-';
  };

  // Calculate summary stats
  const activeCount = specs.filter((s) => s.isActive).length;
  const criticalCount = specs.filter((s) => s.isCritical).length;
  const inactiveCount = specs.filter((s) => !s.isActive).length;

  // Define columns for DevExtreme DataGrid
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'itemCode',
      caption: 'สินค้า',
      width: 200,
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium">{cellInfo.data.itemCode}</p>
          <p className="text-xs text-gray-500">{cellInfo.data.itemName}</p>
        </div>
      ),
    },
    {
      dataField: 'testName',
      caption: 'ชื่อการทดสอบ',
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{cellInfo.data.testName}</span>
          {cellInfo.data.isCritical && (
            <Badge variant="danger" size="sm">
              Critical
            </Badge>
          )}
        </div>
      ),
    },
    {
      dataField: 'testMethod',
      caption: 'วิธีการ',
      width: 150,
      hideOnMobile: true,
      cellRender: (cellInfo) => cellInfo.data.testMethod || '-',
    },
    {
      dataField: 'specification',
      caption: 'ข้อกำหนด',
      width: 180,
      hideOnMobile: true,
      cellRender: (cellInfo) => formatRange(cellInfo.data),
    },
    {
      dataField: 'isActive',
      caption: 'สถานะ',
      width: 120,
      cellRender: (cellInfo) => (
        <Badge variant={cellInfo.data.isActive ? 'success' : 'default'} dot>
          {cellInfo.data.isActive ? 'ใช้งาน' : 'ไม่ใช้งาน'}
        </Badge>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="flex flex-col h-full gap-3 md:gap-2 lg:gap-4">
        <PageHeader
          title="ข้อกำหนดคุณภาพ"
          description="จัดการข้อกำหนดและเกณฑ์การทดสอบ"
          actions={
            <DxButton
              text="เพิ่มข้อกำหนด"
              icon="plus"
              type="success"
              onClick={() => router.push('/quality/specs/new')}
            />
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-2 lg:gap-4">
          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileCheck className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">ทั้งหมด</p>
                  <p className="text-xl font-bold">{specs.length}</p>
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
                  <p className="text-sm text-gray-500">ใช้งาน</p>
                  <p className="text-xl font-bold text-green-600">{activeCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Critical</p>
                  <p className="text-xl font-bold text-red-600">{criticalCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <XCircle className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">ไม่ใช้งาน</p>
                  <p className="text-xl font-bold text-gray-600">{inactiveCount}</p>
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
                  placeholder="ค้นหาด้วยรหัสสินค้าหรือชื่อการทดสอบ..."
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                  onEnterKey={() => fetchSpecs()}
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
              <div className="w-full md:w-40">
                <DxSelectBox
                  items={criticalOptions}
                  value={criticalFilter}
                  onValueChange={setCriticalFilter}
                  placeholder="ประเภท"
                  showClearButton
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table Card */}
        <Card elevation="raised" className="flex-1 min-h-0 flex flex-col md:overflow-hidden">
          <CardContent className="flex-1 min-h-0 flex flex-col">
            {specs.length > 0 || isLoading ? (
              <DxDataGrid
                dataSource={specs}
                keyExpr="id"
                columns={columns}
                loading={isLoading}
                sorting
                filterRow
                headerFilter
                export
                exportFileName="quality-specs"
                searchPanel
                columnChooser
                virtualScrolling={specs.length > 100}
                fillHeight
                onRowClick={handleRowClick}
                noDataText="ไม่พบข้อกำหนดคุณภาพ"
              />
            ) : (
              <EmptyState
                icon={<FileCheck className="h-8 w-8" />}
                title="ไม่พบข้อกำหนดคุณภาพ"
                description="เริ่มต้นด้วยการสร้างข้อกำหนดใหม่"
                action={{
                  label: 'เพิ่มข้อกำหนด',
                  onClick: () => router.push('/quality/specs/new'),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
