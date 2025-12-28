'use client';

// HR Health Records Management Page
// Feature: 007-hr-personnel-management
// Pattern: Aligned with Template module design

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DataGrid, {
  Column,
  SearchPanel,
  HeaderFilter,
  FilterRow,
  Paging,
  Pager,
  Scrolling,
  Selection,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import notify from 'devextreme/ui/notify';
import {
  Heart,
  AlertTriangle,
  Calendar,
  Clock,
  Eye,
  Edit,
  Trash2,
} from 'lucide-react';
import { buddhistDateFormat } from '@/components/ui/dx-date-box';
import type {
  HealthRecordPublic,
  ExaminationType,
  FitnessStatus,
} from '@/types/hr';
import type { HealthRecordWithDetails, UpcomingHealthCheck } from '@/lib/services/hr.service';

const EXAMINATION_TYPE_CONFIG: Record<ExaminationType, { label: string; color: string }> = {
  pre_employment: { label: 'ก่อนเข้างาน', color: 'text-blue-700' },
  periodic: { label: 'ตรวจประจำปี', color: 'text-green-700' },
  special: { label: 'ตรวจพิเศษ', color: 'text-orange-700' },
};

const FITNESS_STATUS_CONFIG: Record<FitnessStatus, { label: string; variant: 'success' | 'danger' | 'warning' }> = {
  fit: { label: 'พร้อมปฏิบัติงาน', variant: 'success' },
  unfit: { label: 'ไม่พร้อมปฏิบัติงาน', variant: 'danger' },
  restricted: { label: 'มีข้อจำกัด', variant: 'warning' },
};

type HealthRecord = HealthRecordWithDetails | HealthRecordPublic;

async function fetchHealthRecords(): Promise<HealthRecord[]> {
  const response = await fetch('/api/hr/health-records');
  if (!response.ok) throw new Error('Failed to fetch health records');
  const result = await response.json();
  return result.data || [];
}

async function fetchHealthChecksDue(): Promise<UpcomingHealthCheck[]> {
  const response = await fetch('/api/hr/health-records/due?withinDays=30');
  if (!response.ok) throw new Error('Failed to fetch health checks due');
  const result = await response.json();
  return result.data || [];
}

async function fetchOverdueHealthChecks(): Promise<UpcomingHealthCheck[]> {
  const response = await fetch('/api/hr/health-records/overdue');
  if (!response.ok) throw new Error('Failed to fetch overdue health checks');
  const result = await response.json();
  return result.data || [];
}

async function deleteHealthRecord(id: number): Promise<void> {
  const res = await fetch(`/api/hr/health-records/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to delete record');
  }
}

export default function HealthRecordsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'records' | 'due' | 'overdue'>('records');
  const [selectedRecord, setSelectedRecord] = useState<HealthRecord | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: healthRecords = [] } = useQuery({
    queryKey: ['hr', 'health-records'],
    queryFn: fetchHealthRecords,
  });

  const { data: healthChecksDue = [] } = useQuery({
    queryKey: ['hr', 'health-records', 'due'],
    queryFn: fetchHealthChecksDue,
  });

  const { data: overdueChecks = [] } = useQuery({
    queryKey: ['hr', 'health-records', 'overdue'],
    queryFn: fetchOverdueHealthChecks,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHealthRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'health-records'] });
      notify('ลบบันทึกสุขภาพสำเร็จ', 'success', 3000);
      setShowDeleteConfirm(false);
      setSelectedRecord(null);
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleRowClick = useCallback((e: { data: HealthRecord }) => {
    router.push(`/hr/health-records/${e.data.id}`);
  }, [router]);

  const handleDelete = useCallback((record: HealthRecord) => {
    setSelectedRecord(record);
    setShowDeleteConfirm(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (selectedRecord) {
      deleteMutation.mutate(selectedRecord.id);
    }
  }, [selectedRecord, deleteMutation]);

  const renderExamTypeCell = (cellData: { value: ExaminationType }) => {
    const config = EXAMINATION_TYPE_CONFIG[cellData.value];
    if (!config) return cellData.value;
    return (
      <span className={'font-medium ' + config.color}>
        {config.label}
      </span>
    );
  };

  const renderFitnessStatusCell = (cellData: { value: FitnessStatus }) => {
    const config = FITNESS_STATUS_CONFIG[cellData.value];
    if (!config) return cellData.value;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const renderDaysUntilDue = (cellData: { value: number }) => {
    const days = cellData.value;
    if (days < 0) {
      return (
        <span className="text-red-600 font-medium">
          เกินกำหนด {Math.abs(days)} วัน
        </span>
      );
    }
    if (days <= 7) {
      return (
        <span className="text-orange-600 font-medium">
          อีก {days} วัน
        </span>
      );
    }
    return (
      <span className="text-green-600">
        อีก {days} วัน
      </span>
    );
  };

  const renderActionsCell = (cellData: { data: HealthRecord }) => {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/hr/health-records/${cellData.data.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title="ดูรายละเอียด"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/hr/health-records/${cellData.data.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
          title="แก้ไข"
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(cellData.data);
          }}
          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title="ลบ"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-1" data-testid="hr-health-records-page">
      {/* ResponsivePageHeader */}
      <ResponsivePageHeader
        title="บันทึกสุขภาพพนักงาน"
        subtitle="จัดการข้อมูลการตรวจสุขภาพและสถานะความพร้อมปฏิบัติงาน"
        icon={Heart}
        iconBgColor="bg-red-100"
        iconColor="text-red-600"
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'บันทึกสุขภาพ' },
        ]}
        actions={
          <Button
            text="บันทึกผลตรวจ"
            icon="plus"
            type="success"
            onClick={() => router.push('/hr/health-records/new')}
            elementAttr={{ 'data-testid': 'hr-add-health-record-btn' }}
          />
        }
      />

      {/* Delete Confirmation */}
      {showDeleteConfirm && selectedRecord && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-800">ยืนยันการลบ</p>
                <p className="text-sm text-red-600">
                  คุณแน่ใจหรือไม่ว่าต้องการลบบันทึกสุขภาพของ &quot;{(selectedRecord as HealthRecordWithDetails).employeeName || 'พนักงาน'}&quot;? การดำเนินการนี้ไม่สามารถยกเลิกได้
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text="ยกเลิก"
                  stylingMode="outlined"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedRecord(null);
                  }}
                />
                <Button
                  text={deleteMutation.isPending ? 'กำลังลบ...' : 'ลบ'}
                  icon={deleteMutation.isPending ? 'spindown' : 'trash'}
                  type="danger"
                  onClick={confirmDelete}
                  disabled={deleteMutation.isPending}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats using StatCard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4" data-testid="hr-health-stats">
        <StatCard
          label="รายการทั้งหมด"
          value={healthRecords.length}
          icon={Heart}
          iconColor="text-green-500"
          accentColor="border-green-500"
        />
        <StatCard
          label="ครบกำหนดใน 30 วัน"
          value={healthChecksDue.length}
          icon={Calendar}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
        />
        <StatCard
          label="เกินกำหนด"
          value={overdueChecks.length}
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
        />
        <StatCard
          label="มีข้อจำกัด"
          value={healthRecords.filter((r) => 'fitnessStatus' in r && r.fitnessStatus === 'restricted').length}
          icon={Clock}
          iconColor="text-orange-500"
          accentColor="border-orange-500"
        />
      </div>

      {/* Tab Navigation - Responsive */}
      <div className="flex overflow-x-auto gap-1 md:gap-2 border-b -mx-4 px-4 md:mx-0 md:px-0">
        <button
          className={`px-3 md:px-4 py-2 font-medium transition-colors whitespace-nowrap text-sm md:text-base min-h-[44px] ${
            activeTab === 'records'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('records')}
        >
          ประวัติตรวจสุขภาพ
        </button>
        <button
          className={`px-3 md:px-4 py-2 font-medium transition-colors whitespace-nowrap text-sm md:text-base min-h-[44px] ${
            activeTab === 'due'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('due')}
        >
          ใกล้ครบกำหนด ({healthChecksDue.length})
        </button>
        <button
          className={`px-3 md:px-4 py-2 font-medium transition-colors whitespace-nowrap text-sm md:text-base min-h-[44px] ${
            activeTab === 'overdue'
              ? 'text-red-600 border-b-2 border-red-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('overdue')}
        >
          เกินกำหนด ({overdueChecks.length})
        </button>
      </div>

      {/* Health Records Grid */}
      {activeTab === 'records' && (
        <Card data-testid="hr-health-records-grid">
          <CardContent className="p-0">
            <DataGrid
              dataSource={healthRecords}
              showBorders={false}
              showRowLines
              rowAlternationEnabled
              columnAutoWidth
              hoverStateEnabled
              onRowClick={handleRowClick}
              className="min-h-[400px]"
            >
            <SearchPanel visible placeholder="ค้นหา..." width={200} />
            <HeaderFilter visible />
            <FilterRow visible />
            <Scrolling mode="virtual" />
            <Selection mode="none" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50]}
              showInfo
              showNavigationButtons
            />

            <Column
              dataField="employeeName"
              caption="พนักงาน"
              minWidth={150}
              hidingPriority={0}
            />
            <Column
              dataField="examinationType"
              caption="ประเภทการตรวจ"
              width={130}
              cellRender={renderExamTypeCell}
              hidingPriority={3}
            />
            <Column
              dataField="examinationDate"
              caption="วันที่ตรวจ"
              dataType="date"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              format={buddhistDateFormat as any}
              width={110}
              hidingPriority={4}
            />
            <Column
              dataField="fitnessStatus"
              caption="สถานะ"
              width={140}
              cellRender={renderFitnessStatusCell}
              hidingPriority={1}
            />
            <Column
              dataField="restrictions"
              caption="ข้อจำกัด"
              width={180}
              hidingPriority={5}
            />
            <Column
              dataField="nextExamDue"
              caption="ครบกำหนดถัดไป"
              dataType="date"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              format={buddhistDateFormat as any}
              width={130}
              hidingPriority={2}
            />
            <Column
              dataField="examinerName"
              caption="ผู้ตรวจ"
              width={130}
              hidingPriority={6}
            />
            <Column
              caption="การดำเนินการ"
              width={120}
              cellRender={renderActionsCell}
              allowFiltering={false}
              allowSorting={false}
              alignment="center"
            />
            </DataGrid>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Health Checks Grid */}
      {activeTab === 'due' && (
        <Card>
          <CardContent className="p-0">
            <DataGrid
              dataSource={healthChecksDue}
              showBorders={false}
              showRowLines
              rowAlternationEnabled
              columnAutoWidth
              hoverStateEnabled
              className="min-h-[400px]"
            >
            <SearchPanel visible placeholder="ค้นหา..." width={200} />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50]}
              showInfo
            />

            <Column
              dataField="employeeName"
              caption="พนักงาน"
              minWidth={150}
              hidingPriority={0}
            />
            <Column
              dataField="employeeEmail"
              caption="อีเมล"
              width={180}
              hidingPriority={4}
            />
            <Column
              dataField="lastExamDate"
              caption="ตรวจครั้งล่าสุด"
              dataType="date"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              format={buddhistDateFormat as any}
              width={130}
              hidingPriority={3}
            />
            <Column
              dataField="nextExamDue"
              caption="ครบกำหนด"
              dataType="date"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              format={buddhistDateFormat as any}
              width={110}
              hidingPriority={2}
            />
            <Column
              dataField="daysUntilDue"
              caption="เหลือเวลา"
              width={100}
              cellRender={renderDaysUntilDue}
              hidingPriority={1}
            />
            <Column
              dataField="lastFitnessStatus"
              caption="สถานะล่าสุด"
              width={130}
              cellRender={renderFitnessStatusCell}
              hidingPriority={5}
            />
            </DataGrid>
          </CardContent>
        </Card>
      )}

      {/* Overdue Health Checks Grid */}
      {activeTab === 'overdue' && (
        <Card>
          <CardContent className="p-0">
            <DataGrid
              dataSource={overdueChecks}
              showBorders={false}
              showRowLines
              rowAlternationEnabled
              columnAutoWidth
              hoverStateEnabled
              className="min-h-[400px]"
            >
            <SearchPanel visible placeholder="ค้นหา..." width={200} />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50]}
              showInfo
            />

            <Column
              dataField="employeeName"
              caption="พนักงาน"
              minWidth={150}
              hidingPriority={0}
            />
            <Column
              dataField="employeeEmail"
              caption="อีเมล"
              width={180}
              hidingPriority={4}
            />
            <Column
              dataField="lastExamDate"
              caption="ตรวจครั้งล่าสุด"
              dataType="date"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              format={buddhistDateFormat as any}
              width={130}
              hidingPriority={3}
            />
            <Column
              dataField="nextExamDue"
              caption="กำหนดตรวจ"
              dataType="date"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              format={buddhistDateFormat as any}
              width={110}
              hidingPriority={2}
            />
            <Column
              dataField="daysUntilDue"
              caption="เกินกำหนด"
              width={100}
              cellRender={renderDaysUntilDue}
              hidingPriority={1}
            />
            <Column
              dataField="lastFitnessStatus"
              caption="สถานะล่าสุด"
              width={130}
              cellRender={renderFitnessStatusCell}
              hidingPriority={5}
            />
            </DataGrid>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
