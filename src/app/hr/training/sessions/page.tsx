'use client';

// HR Training Sessions Page
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
  Toolbar,
  Item,
} from 'devextreme-react/data-grid';
import { Popup, ToolbarItem } from 'devextreme-react/popup';
import TextBox from 'devextreme-react/text-box';
import SelectBox from 'devextreme-react/select-box';
import NumberBox from 'devextreme-react/number-box';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { CalendarDays, Users, PlayCircle, CheckCircle, XCircle } from 'lucide-react';
import type { TrainingSession, TrainingCourse, TrainingSessionStatus } from '@/types/hr';

interface SessionWithDetails extends TrainingSession {
  courseName?: string;
  courseCode?: string;
  instructorName?: string;
  participantCount?: number;
}

const STATUS_CONFIG: Record<TrainingSessionStatus, { label: string; variant: 'secondary' | 'info' | 'success' | 'danger'; icon: React.ElementType }> = {
  scheduled: { label: 'กำหนดการ', variant: 'info', icon: CalendarDays },
  in_progress: { label: 'กำลังดำเนินการ', variant: 'secondary', icon: PlayCircle },
  completed: { label: 'เสร็จสิ้น', variant: 'success', icon: CheckCircle },
  cancelled: { label: 'ยกเลิก', variant: 'danger', icon: XCircle },
};

async function fetchSessions(): Promise<SessionWithDetails[]> {
  const response = await fetch('/api/hr/training/sessions');
  if (!response.ok) throw new Error('Failed to fetch sessions');
  const result = await response.json();
  return result.data || [];
}

async function fetchCourses(): Promise<TrainingCourse[]> {
  const response = await fetch('/api/hr/training/courses?isActive=true');
  if (!response.ok) throw new Error('Failed to fetch courses');
  const result = await response.json();
  return result.data || [];
}

async function createSession(data: Partial<TrainingSession>): Promise<TrainingSession> {
  const response = await fetch('/api/hr/training/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create session');
  const result = await response.json();
  return result.data;
}

async function updateSessionStatus(id: number, action: 'complete' | 'cancel'): Promise<TrainingSession> {
  const response = await fetch('/api/hr/training/sessions/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  if (!response.ok) throw new Error('Failed to update session');
  const result = await response.json();
  return result.data;
}

export default function TrainingSessionsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [newSession, setNewSession] = useState({
    courseId: undefined as number | undefined,
    sessionDate: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '16:00',
    location: '',
    maxParticipants: undefined as number | undefined,
    instructorExternal: '',
  });

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['hr', 'training', 'sessions'],
    queryFn: fetchSessions,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ['hr', 'training', 'courses'],
    queryFn: fetchCourses,
  });

  const createMutation = useMutation({
    mutationFn: createSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'sessions'] });
      setShowCreatePopup(false);
      setNewSession({
        courseId: undefined,
        sessionDate: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '16:00',
        location: '',
        maxParticipants: undefined,
        instructorExternal: '',
      });
      toast.success('สร้างการจัดอบรมสำเร็จ');
    },
    onError: () => {
      toast.error('ไม่สามารถสร้างการจัดอบรมได้');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'complete' | 'cancel' }) =>
      updateSessionStatus(id, action),
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'sessions'] });
      toast.success(action === 'complete' ? 'บันทึกการอบรมเสร็จสิ้น' : 'ยกเลิกการอบรมแล้ว');
    },
    onError: () => {
      toast.error('ไม่สามารถอัปเดตสถานะได้');
    },
  });

  const handleCreateSession = useCallback(() => {
    createMutation.mutate(newSession);
  }, [newSession, createMutation]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderStatusCell = (cellData: { value: TrainingSessionStatus }) => {
    const config = STATUS_CONFIG[cellData.value];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="text-xs">
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const renderActionsCell = (cellData: { data: SessionWithDetails }) => {
    const session = cellData.data;
    if (session.status !== 'scheduled') return null;

    return (
      <div className="flex gap-1">
        <DxButton
          icon="check"
          hint="เสร็จสิ้น"
          type="success"
          stylingMode="text"
          onClick={() => statusMutation.mutate({ id: session.id, action: 'complete' })}
        />
        <DxButton
          icon="close"
          hint="ยกเลิก"
          type="danger"
          stylingMode="text"
          onClick={() => statusMutation.mutate({ id: session.id, action: 'cancel' })}
        />
      </div>
    );
  };

  const formatTimeRange = (rowData: SessionWithDetails) => {
    const start = rowData.startTime || '-';
    const end = rowData.endTime || '-';
    return start + ' - ' + end;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-green-600" />
            การจัดอบรม
          </h1>
          <p className="text-gray-500 mt-1">
            Training Sessions • {sessions.length} รายการ
          </p>
        </div>
        <DxButton
          text="จัดอบรมใหม่"
          icon="add"
          type="default"
          stylingMode="contained"
          onClick={() => setShowCreatePopup(true)}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CalendarDays className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {sessions.filter((s) => s.status === 'scheduled').length}
              </p>
              <p className="text-sm text-gray-500">กำหนดการ</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <PlayCircle className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {sessions.filter((s) => s.status === 'in_progress').length}
              </p>
              <p className="text-sm text-gray-500">กำลังดำเนินการ</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {sessions.filter((s) => s.status === 'completed').length}
              </p>
              <p className="text-sm text-gray-500">เสร็จสิ้น</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Users className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {sessions.reduce((acc, s) => acc + (s.participantCount || 0), 0)}
              </p>
              <p className="text-sm text-gray-500">ผู้เข้าร่วมทั้งหมด</p>
            </div>
          </div>
        </div>
      </div>

      {/* DataGrid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <DataGrid
          dataSource={sessions}
          keyExpr="id"
          showBorders={false}
          showRowLines
          rowAlternationEnabled
          columnAutoWidth
          height={600}
          hoverStateEnabled
          loadPanel={{ enabled: isLoading }}
        >
          <SearchPanel visible placeholder="ค้นหา..." width={250} />
          <HeaderFilter visible />
          <FilterRow visible />
          <Scrolling mode="virtual" />
          <Paging defaultPageSize={20} />
          <Pager showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo />

          <Toolbar>
            <Item name="searchPanel" />
          </Toolbar>

          <Column
            dataField="sessionDate"
            caption="วันที่"
            width={120}
            calculateCellValue={(rowData) => formatDate(rowData.sessionDate)}
          />
          <Column dataField="courseName" caption="หลักสูตร" minWidth={200} />
          <Column dataField="courseCode" caption="รหัส" width={100} />
          <Column
            caption="เวลา"
            width={120}
            calculateCellValue={formatTimeRange}
          />
          <Column dataField="location" caption="สถานที่" width={150} />
          <Column dataField="instructorName" caption="วิทยากร" width={150} />
          <Column
            dataField="participantCount"
            caption="ผู้เข้าร่วม"
            width={100}
            alignment="center"
          />
          <Column
            dataField="status"
            caption="สถานะ"
            width={130}
            cellRender={renderStatusCell}
            alignment="center"
          />
          <Column
            caption="การดำเนินการ"
            width={100}
            cellRender={renderActionsCell}
            alignment="center"
          />
        </DataGrid>
      </div>

      {/* Create Session Popup */}
      <Popup
        visible={showCreatePopup}
        onHiding={() => setShowCreatePopup(false)}
        title="จัดอบรมใหม่"
        width={600}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <SelectBox
            dataSource={courses}
            valueExpr="id"
            displayExpr={(item: TrainingCourse | null) => item ? (item.code + ' - ' + item.name) : ''}
            value={newSession.courseId}
            onValueChanged={(e) => setNewSession((prev) => ({ ...prev, courseId: e.value }))}
            label="หลักสูตร"
            labelMode="floating"
            searchEnabled
            placeholder="เลือกหลักสูตร..."
          />
          <div className="grid grid-cols-3 gap-4">
            <DxDateBox
              value={newSession.sessionDate}
              onValueChange={(value) => setNewSession((prev) => ({
                ...prev,
                sessionDate: value || prev.sessionDate
              }))}
              label="วันที่"
            />
            <TextBox
              value={newSession.startTime}
              onValueChanged={(e) => setNewSession((prev) => ({ ...prev, startTime: e.value || '' }))}
              label="เวลาเริ่ม"
              labelMode="floating"
              placeholder="HH:MM"
            />
            <TextBox
              value={newSession.endTime}
              onValueChanged={(e) => setNewSession((prev) => ({ ...prev, endTime: e.value || '' }))}
              label="เวลาสิ้นสุด"
              labelMode="floating"
              placeholder="HH:MM"
            />
          </div>
          <TextBox
            value={newSession.location}
            onValueChanged={(e) => setNewSession((prev) => ({ ...prev, location: e.value || '' }))}
            label="สถานที่"
            labelMode="floating"
          />
          <div className="grid grid-cols-2 gap-4">
            <TextBox
              value={newSession.instructorExternal}
              onValueChanged={(e) => setNewSession((prev) => ({ ...prev, instructorExternal: e.value || '' }))}
              label="วิทยากร (ภายนอก)"
              labelMode="floating"
            />
            <NumberBox
              value={newSession.maxParticipants}
              onValueChanged={(e) => setNewSession((prev) => ({ ...prev, maxParticipants: e.value }))}
              label="จำนวนผู้เข้าร่วมสูงสุด"
              labelMode="floating"
              min={1}
            />
          </div>
        </div>
        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'บันทึก',
            type: 'default',
            stylingMode: 'contained',
            onClick: handleCreateSession,
            disabled: createMutation.isPending || !newSession.courseId || !newSession.sessionDate,
          }}
        />
        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'ยกเลิก',
            type: 'default',
            stylingMode: 'outlined',
            onClick: () => setShowCreatePopup(false),
          }}
        />
      </Popup>
    </div>
  );
}
