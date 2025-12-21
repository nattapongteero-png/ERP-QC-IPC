'use client';

// HR Health Records Management Page
// Feature: 007-hr-personnel-management

import { useState, useCallback } from 'react';
import DataGrid, {
  Column,
  SearchPanel,
  HeaderFilter,
  FilterRow,
  Paging,
  Pager,
  Scrolling,
} from 'devextreme-react/data-grid';
import { Popup, ToolbarItem } from 'devextreme-react/popup';
import SelectBox from 'devextreme-react/select-box';
import TextBox from 'devextreme-react/text-box';
import TextArea from 'devextreme-react/text-area';
import TagBox from 'devextreme-react/tag-box';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { DxDateBox, buddhistDateFormat } from '@/components/ui/dx-date-box';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import {
  Heart,
  AlertTriangle,
  Calendar,
  Clock,
} from 'lucide-react';
import type {
  HealthRecordPublic,
  ExaminationType,
  FitnessStatus,
  EmployeeSummary,
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

const AFFECTED_AREAS_OPTIONS = [
  'ฝ่ายผลิต',
  'ฝ่ายควบคุมคุณภาพ',
  'ฝ่ายบรรจุ',
  'ฝ่ายคลังสินค้า',
  'ทุกฝ่าย',
];

type HealthRecord = HealthRecordWithDetails | HealthRecordPublic;

async function fetchHealthRecords(): Promise<HealthRecord[]> {
  const response = await fetch('/api/hr/health-records');
  if (!response.ok) throw new Error('Failed to fetch health records');
  const result = await response.json();
  return result.data || [];
}

async function fetchEmployees(): Promise<EmployeeSummary[]> {
  const response = await fetch('/api/hr/employees?status=active');
  if (!response.ok) throw new Error('Failed to fetch employees');
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

async function createHealthRecord(data: {
  employeeId: number;
  examinationType: ExaminationType;
  examinationDate: string;
  nextExamDue?: string;
  fitnessStatus: FitnessStatus;
  restrictions?: string;
  affectedAreas?: string[];
  medicalDetails?: string;
  examinerName?: string;
  examinerNotes?: string;
}): Promise<HealthRecord> {
  const response = await fetch('/api/hr/health-records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || 'Failed to create health record');
  }
  const result = await response.json();
  return result.data;
}

export default function HealthRecordsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [activeTab, setActiveTab] = useState<'records' | 'due' | 'overdue'>('records');

  const [newRecord, setNewRecord] = useState({
    employeeId: undefined as number | undefined,
    examinationType: undefined as ExaminationType | undefined,
    examinationDate: new Date().toISOString().split('T')[0],
    nextExamDue: '' as string | undefined,
    fitnessStatus: undefined as FitnessStatus | undefined,
    restrictions: '',
    affectedAreas: [] as string[],
    medicalDetails: '',
    examinerName: '',
    examinerNotes: '',
  });

  const { data: healthRecords = [] } = useQuery({
    queryKey: ['hr', 'health-records'],
    queryFn: fetchHealthRecords,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['hr', 'employees', 'active'],
    queryFn: fetchEmployees,
  });

  const { data: healthChecksDue = [] } = useQuery({
    queryKey: ['hr', 'health-records', 'due'],
    queryFn: fetchHealthChecksDue,
  });

  const { data: overdueChecks = [] } = useQuery({
    queryKey: ['hr', 'health-records', 'overdue'],
    queryFn: fetchOverdueHealthChecks,
  });

  const createMutation = useMutation({
    mutationFn: createHealthRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'health-records'] });
      setShowCreatePopup(false);
      resetNewRecord();
      toast.success('บันทึกผลตรวจสุขภาพสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'ไม่สามารถบันทึกผลตรวจสุขภาพได้');
    },
  });

  const resetNewRecord = () => {
    setNewRecord({
      employeeId: undefined,
      examinationType: undefined,
      examinationDate: new Date().toISOString().split('T')[0],
      nextExamDue: '',
      fitnessStatus: undefined,
      restrictions: '',
      affectedAreas: [],
      medicalDetails: '',
      examinerName: '',
      examinerNotes: '',
    });
  };

  const handleCreateRecord = useCallback(() => {
    if (!newRecord.employeeId || !newRecord.examinationType || !newRecord.fitnessStatus) return;
    createMutation.mutate({
      employeeId: newRecord.employeeId,
      examinationType: newRecord.examinationType,
      examinationDate: newRecord.examinationDate,
      nextExamDue: newRecord.nextExamDue || undefined,
      fitnessStatus: newRecord.fitnessStatus,
      restrictions: newRecord.restrictions || undefined,
      affectedAreas: newRecord.affectedAreas.length > 0 ? newRecord.affectedAreas : undefined,
      medicalDetails: newRecord.medicalDetails || undefined,
      examinerName: newRecord.examinerName || undefined,
      examinerNotes: newRecord.examinerNotes || undefined,
    });
  }, [newRecord, createMutation]);

  const examinationTypeOptions = Object.entries(EXAMINATION_TYPE_CONFIG).map(([value, config]) => ({
    value,
    label: config.label,
  }));

  const fitnessStatusOptions = Object.entries(FITNESS_STATUS_CONFIG).map(([value, config]) => ({
    value,
    label: config.label,
  }));

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-red-600" />
            บันทึกสุขภาพพนักงาน
          </h1>
          <p className="text-gray-600 mt-1">
            จัดการข้อมูลการตรวจสุขภาพและสถานะความพร้อมปฏิบัติงาน
          </p>
        </div>
        <DxButton
          text="บันทึกผลตรวจ"
          icon="plus"
          type="default"
          onClick={() => setShowCreatePopup(true)}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-full">
              <Heart className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{healthRecords.length}</div>
              <div className="text-gray-600 text-sm">รายการทั้งหมด</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-full">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{healthChecksDue.length}</div>
              <div className="text-gray-600 text-sm">ครบกำหนดใน 30 วัน</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-full">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{overdueChecks.length}</div>
              <div className="text-gray-600 text-sm">เกินกำหนด</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-full">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {healthRecords.filter((r) => 'fitnessStatus' in r && r.fitnessStatus === 'restricted').length}
              </div>
              <div className="text-gray-600 text-sm">มีข้อจำกัด</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'records'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('records')}
        >
          ประวัติตรวจสุขภาพ
        </button>
        <button
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'due'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('due')}
        >
          ใกล้ครบกำหนด ({healthChecksDue.length})
        </button>
        <button
          className={`px-4 py-2 font-medium transition-colors ${
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
        <div className="bg-white rounded-lg shadow">
          <DataGrid
            dataSource={healthRecords}
            showBorders
            rowAlternationEnabled
            columnAutoWidth
            wordWrapEnabled
            height={600}
          >
            <SearchPanel visible placeholder="ค้นหา..." />
            <HeaderFilter visible />
            <FilterRow visible />
            <Scrolling mode="virtual" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50]}
              showInfo
            />

            <Column
              dataField="employeeName"
              caption="พนักงาน"
              width={180}
            />
            <Column
              dataField="examinationType"
              caption="ประเภทการตรวจ"
              width={140}
              cellRender={renderExamTypeCell}
            />
            <Column
              dataField="examinationDate"
              caption="วันที่ตรวจ"
              dataType="date"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              format={buddhistDateFormat as any}
              width={120}
            />
            <Column
              dataField="fitnessStatus"
              caption="สถานะ"
              width={150}
              cellRender={renderFitnessStatusCell}
            />
            <Column
              dataField="restrictions"
              caption="ข้อจำกัด"
              width={200}
            />
            <Column
              dataField="nextExamDue"
              caption="ครบกำหนดตรวจครั้งถัดไป"
              dataType="date"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              format={buddhistDateFormat as any}
              width={160}
            />
            <Column
              dataField="examinerName"
              caption="ผู้ตรวจ"
              width={150}
            />
          </DataGrid>
        </div>
      )}

      {/* Upcoming Health Checks Grid */}
      {activeTab === 'due' && (
        <div className="bg-white rounded-lg shadow">
          <DataGrid
            dataSource={healthChecksDue}
            showBorders
            rowAlternationEnabled
            columnAutoWidth
            wordWrapEnabled
            height={600}
          >
            <SearchPanel visible placeholder="ค้นหา..." />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50]}
              showInfo
            />

            <Column
              dataField="employeeName"
              caption="พนักงาน"
              width={200}
            />
            <Column
              dataField="employeeEmail"
              caption="อีเมล"
              width={200}
            />
            <Column
              dataField="lastExamDate"
              caption="วันที่ตรวจครั้งล่าสุด"
              dataType="date"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              format={buddhistDateFormat as any}
              width={160}
            />
            <Column
              dataField="nextExamDue"
              caption="ครบกำหนด"
              dataType="date"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              format={buddhistDateFormat as any}
              width={120}
            />
            <Column
              dataField="daysUntilDue"
              caption="เหลือเวลา"
              width={120}
              cellRender={renderDaysUntilDue}
            />
            <Column
              dataField="lastFitnessStatus"
              caption="สถานะล่าสุด"
              width={150}
              cellRender={renderFitnessStatusCell}
            />
          </DataGrid>
        </div>
      )}

      {/* Overdue Health Checks Grid */}
      {activeTab === 'overdue' && (
        <div className="bg-white rounded-lg shadow">
          <DataGrid
            dataSource={overdueChecks}
            showBorders
            rowAlternationEnabled
            columnAutoWidth
            wordWrapEnabled
            height={600}
          >
            <SearchPanel visible placeholder="ค้นหา..." />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50]}
              showInfo
            />

            <Column
              dataField="employeeName"
              caption="พนักงาน"
              width={200}
            />
            <Column
              dataField="employeeEmail"
              caption="อีเมล"
              width={200}
            />
            <Column
              dataField="lastExamDate"
              caption="วันที่ตรวจครั้งล่าสุด"
              dataType="date"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              format={buddhistDateFormat as any}
              width={160}
            />
            <Column
              dataField="nextExamDue"
              caption="กำหนดตรวจ"
              dataType="date"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              format={buddhistDateFormat as any}
              width={120}
            />
            <Column
              dataField="daysUntilDue"
              caption="เกินกำหนด"
              width={120}
              cellRender={renderDaysUntilDue}
            />
            <Column
              dataField="lastFitnessStatus"
              caption="สถานะล่าสุด"
              width={150}
              cellRender={renderFitnessStatusCell}
            />
          </DataGrid>
        </div>
      )}

      {/* Create Health Record Popup */}
      <Popup
        visible={showCreatePopup}
        onHiding={() => {
          setShowCreatePopup(false);
          resetNewRecord();
        }}
        title="บันทึกผลตรวจสุขภาพ"
        width={600}
        height="auto"
        showCloseButton
      >
        <div className="space-y-4 p-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                พนักงาน <span className="text-red-500">*</span>
              </label>
              <SelectBox
                dataSource={employees}
                displayExpr="fullName"
                valueExpr="id"
                value={newRecord.employeeId}
                onValueChanged={(e) =>
                  setNewRecord((prev) => ({ ...prev, employeeId: e.value }))
                }
                searchEnabled
                placeholder="เลือกพนักงาน..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ประเภทการตรวจ <span className="text-red-500">*</span>
              </label>
              <SelectBox
                dataSource={examinationTypeOptions}
                displayExpr="label"
                valueExpr="value"
                value={newRecord.examinationType}
                onValueChanged={(e) =>
                  setNewRecord((prev) => ({ ...prev, examinationType: e.value }))
                }
                placeholder="เลือกประเภท..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DxDateBox
              label="วันที่ตรวจ"
              value={newRecord.examinationDate}
              onValueChange={(value) =>
                setNewRecord((prev) => ({
                  ...prev,
                  examinationDate: value,
                }))
              }
              required
              requiredMessage="กรุณาระบุวันที่ตรวจ"
            />
            <DxDateBox
              label="ครบกำหนดตรวจครั้งถัดไป"
              value={newRecord.nextExamDue || ''}
              onValueChange={(value) =>
                setNewRecord((prev) => ({
                  ...prev,
                  nextExamDue: value || undefined,
                }))
              }
              showClearButton
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              สถานะความพร้อม <span className="text-red-500">*</span>
            </label>
            <SelectBox
              dataSource={fitnessStatusOptions}
              displayExpr="label"
              valueExpr="value"
              value={newRecord.fitnessStatus}
              onValueChanged={(e) =>
                setNewRecord((prev) => ({ ...prev, fitnessStatus: e.value }))
              }
              placeholder="เลือกสถานะ..."
            />
          </div>

          {newRecord.fitnessStatus === 'restricted' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ข้อจำกัดการปฏิบัติงาน
                </label>
                <TextArea
                  value={newRecord.restrictions}
                  onValueChanged={(e) =>
                    setNewRecord((prev) => ({ ...prev, restrictions: e.value || '' }))
                  }
                  placeholder="ระบุข้อจำกัด..."
                  height={80}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  พื้นที่ที่ได้รับผลกระทบ
                </label>
                <TagBox
                  items={AFFECTED_AREAS_OPTIONS}
                  value={newRecord.affectedAreas}
                  onValueChanged={(e) =>
                    setNewRecord((prev) => ({ ...prev, affectedAreas: e.value || [] }))
                  }
                  showSelectionControls
                  placeholder="เลือกพื้นที่..."
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ชื่อผู้ตรวจ
            </label>
            <TextBox
              value={newRecord.examinerName}
              onValueChanged={(e) =>
                setNewRecord((prev) => ({ ...prev, examinerName: e.value || '' }))
              }
              placeholder="ระบุชื่อแพทย์/พยาบาล..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              รายละเอียดทางการแพทย์ (เฉพาะเจ้าหน้าที่สุขภาพ)
            </label>
            <TextArea
              value={newRecord.medicalDetails}
              onValueChanged={(e) =>
                setNewRecord((prev) => ({ ...prev, medicalDetails: e.value || '' }))
              }
              placeholder="ระบุรายละเอียด..."
              height={80}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              หมายเหตุผู้ตรวจ (เฉพาะเจ้าหน้าที่สุขภาพ)
            </label>
            <TextArea
              value={newRecord.examinerNotes}
              onValueChanged={(e) =>
                setNewRecord((prev) => ({ ...prev, examinerNotes: e.value || '' }))
              }
              placeholder="ระบุหมายเหตุ..."
              height={80}
            />
          </div>
        </div>

        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'ยกเลิก',
            onClick: () => {
              setShowCreatePopup(false);
              resetNewRecord();
            },
          }}
        />
        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'บันทึก',
            type: 'default',
            disabled:
              !newRecord.employeeId ||
              !newRecord.examinationType ||
              !newRecord.fitnessStatus ||
              createMutation.isPending,
            onClick: handleCreateRecord,
          }}
        />
      </Popup>
    </div>
  );
}
