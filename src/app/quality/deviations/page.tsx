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
  AlertTriangle,
  AlertCircle,
  Clock,
  AlertOctagon,
} from 'lucide-react';
import type { DataGridTypes } from 'devextreme-react/data-grid';

interface Deviation {
  id: number;
  deviationNumber: string;
  title: string;
  description: string;
  sourceType: string;
  sourceId: number;
  severity: string;
  status: string;
  rootCause: string;
  correctiveAction: string;
  preventiveAction: string;
  reportedBy: number;
  assignedTo: number;
  dueDate: string;
  closedBy: number;
  closedAt: string;
  createdAt: string;
  updatedAt: string;
}

const statusOptions = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'open', label: 'เปิด' },
  { value: 'investigating', label: 'กำลังสอบสวน' },
  { value: 'resolved', label: 'แก้ไขแล้ว' },
  { value: 'closed', label: 'ปิด' },
];

const severityOptions = [
  { value: '', label: 'ทุกระดับ' },
  { value: 'minor', label: 'เล็กน้อย' },
  { value: 'major', label: 'สำคัญ' },
  { value: 'critical', label: 'วิกฤต' },
];

const getStatusLabel = (status: string): string => {
  const found = statusOptions.find(s => s.value === status);
  return found ? found.label : status;
};

const getSeverityLabel = (severity: string): string => {
  const found = severityOptions.find(s => s.value === severity);
  return found ? found.label : severity;
};

const getStatusBadgeVariant = (status: string): 'success' | 'warning' | 'info' | 'default' => {
  switch (status) {
    case 'closed':
      return 'success';
    case 'resolved':
      return 'info';
    case 'investigating':
      return 'warning';
    case 'open':
    default:
      return 'default';
  }
};

const getSeverityBadgeVariant = (severity: string): 'danger' | 'warning' | 'default' => {
  switch (severity) {
    case 'critical':
      return 'danger';
    case 'major':
      return 'warning';
    case 'minor':
    default:
      return 'default';
  }
};

const getSourceTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    production: 'การผลิต',
    quality: 'คุณภาพ',
    warehouse: 'คลังสินค้า',
  };
  return labels[type] || type || '-';
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const isOverdue = (dueDate: string, status: string) => {
  if (!dueDate || status === 'closed' || status === 'resolved') return false;
  return new Date(dueDate) < new Date();
};

export default function DeviationsPage() {
  const router = useRouter();
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  const fetchDeviations = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (statusFilter) params.set('status', statusFilter);
      if (severityFilter) params.set('severity', severityFilter);

      const res = await fetch(`/api/quality/deviations?${params}`);
      const data = await res.json();

      if (data.success) {
        let fetchedDeviations = data.data?.items || [];

        // Client-side search filter
        if (search) {
          const searchLower = search.toLowerCase();
          fetchedDeviations = fetchedDeviations.filter((dev: Deviation) =>
            dev.deviationNumber?.toLowerCase().includes(searchLower) ||
            dev.title?.toLowerCase().includes(searchLower)
          );
        }

        setDeviations(fetchedDeviations);
      } else {
        console.error('API error:', data.error);
        setDeviations([]);
      }
    } catch (error) {
      console.error('Failed to fetch deviations:', error);
      setDeviations([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, severityFilter, search]);

  useEffect(() => {
    fetchDeviations();
  }, [fetchDeviations]);

  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/quality/deviations/${e.data.id}`);
    }
  };

  // Calculate summary stats
  const openCount = deviations.filter((d) => d.status === 'open').length;
  const investigatingCount = deviations.filter((d) => d.status === 'investigating').length;
  const criticalCount = deviations.filter((d) => d.severity === 'critical' && d.status !== 'closed').length;
  const overdueCount = deviations.filter((d) => isOverdue(d.dueDate, d.status)).length;

  // Define columns for DevExtreme DataGrid
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'deviationNumber',
      caption: 'เลขที่',
      width: 140,
      cellRender: (cellInfo) => (
        <div>
          <p className="font-mono font-medium">{cellInfo.data.deviationNumber}</p>
          {isOverdue(cellInfo.data.dueDate, cellInfo.data.status) && (
            <Badge variant="danger" size="sm">
              เกินกำหนด
            </Badge>
          )}
        </div>
      ),
    },
    {
      dataField: 'title',
      caption: 'หัวข้อ',
      cellRender: (cellInfo) => (
        <div className="max-w-xs">
          <p className="font-medium truncate">{cellInfo.data.title}</p>
          <p className="text-xs text-gray-500 truncate">{cellInfo.data.description}</p>
        </div>
      ),
    },
    {
      dataField: 'sourceType',
      caption: 'แหล่งที่มา',
      width: 120,
      hideOnMobile: true,
      cellRender: (cellInfo) => getSourceTypeLabel(cellInfo.data.sourceType),
    },
    {
      dataField: 'severity',
      caption: 'ระดับ',
      width: 100,
      cellRender: (cellInfo) => (
        <Badge variant={getSeverityBadgeVariant(cellInfo.data.severity)}>
          {getSeverityLabel(cellInfo.data.severity)}
        </Badge>
      ),
    },
    {
      dataField: 'dueDate',
      caption: 'กำหนดส่ง',
      width: 120,
      dataType: 'date',
      hideOnMobile: true,
      cellRender: (cellInfo) => (
        <span className={isOverdue(cellInfo.data.dueDate, cellInfo.data.status) ? 'text-red-600 font-medium' : ''}>
          {formatDate(cellInfo.data.dueDate)}
        </span>
      ),
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 130,
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
          title="ความเบี่ยงเบน"
          description="ติดตามและจัดการความเบี่ยงเบนและ CAPA"
          actions={
            <DxButton
              text="รายงานความเบี่ยงเบน"
              icon="plus"
              type="success"
              onClick={() => router.push('/quality/deviations/new')}
            />
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">เปิด</p>
                  <p className="text-xl font-bold">{openCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">กำลังสอบสวน</p>
                  <p className="text-xl font-bold text-yellow-600">{investigatingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertOctagon className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">วิกฤต</p>
                  <p className="text-xl font-bold text-red-600">{criticalCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">เกินกำหนด</p>
                  <p className="text-xl font-bold text-orange-600">{overdueCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Critical Alert */}
        {criticalCount > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertOctagon className="h-6 w-6 text-red-600" />
                <div>
                  <p className="font-medium text-red-800">
                    {criticalCount} ความเบี่ยงเบนวิกฤตต้องการการดำเนินการ
                  </p>
                  <p className="text-sm text-red-600">
                    ความเบี่ยงเบนวิกฤตอาจส่งผลกระทบต่อความปลอดภัยหรือประสิทธิภาพของผลิตภัณฑ์ กรุณาดำเนินการทันที
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters Card */}
        <Card elevation="raised">
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <DxTextBox
                  placeholder="ค้นหาด้วยเลขที่หรือหัวข้อ..."
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                  onEnterKey={() => fetchDeviations()}
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
                  items={severityOptions}
                  value={severityFilter}
                  onValueChange={setSeverityFilter}
                  placeholder="ระดับ"
                  showClearButton
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table Card */}
        <Card elevation="raised">
          <CardContent>
            {deviations.length > 0 || isLoading ? (
              <DxDataGrid
                dataSource={deviations}
                keyExpr="id"
                columns={columns}
                loading={isLoading}
                sorting
                filterRow
                headerFilter
                export
                exportFileName="deviations"
                searchPanel
                columnChooser
                virtualScrolling={deviations.length > 100}
                height={600}
                mobileHeight={400}
                tabletHeight={500}
                onRowClick={handleRowClick}
                noDataText="ไม่พบความเบี่ยงเบน"
              />
            ) : (
              <EmptyState
                icon={<AlertTriangle className="h-8 w-8" />}
                title="ไม่พบความเบี่ยงเบน"
                description="รายงานความเบี่ยงเบนใหม่เมื่อพบปัญหาคุณภาพ"
                action={{
                  label: 'รายงานความเบี่ยงเบน',
                  onClick: () => router.push('/quality/deviations/new'),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
