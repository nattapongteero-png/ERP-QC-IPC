'use client';

// HR Training Sessions Page
// Feature: 007-hr-personnel-management

import { useState, useCallback, useEffect } from 'react';
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
import { ResponsivePageHeader, StatCard } from '@/components/shared';
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
  // Handle nested response structure: { success, data: { data: sessions } }
  const data = result.data?.data || result.data || [];
  return Array.isArray(data) ? data : [];
}

async function fetchCourses(): Promise<TrainingCourse[]> {
  const response = await fetch('/api/hr/training/courses?isActive=true');
  if (!response.ok) throw new Error('Failed to fetch courses');
  const result = await response.json();
  // Handle nested response structure: { success, data: { data: courses } }
  const data = result.data?.data || result.data || [];
  return Array.isArray(data) ? data : [];
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
  const [gridHeight, setGridHeight] = useState(600);
  const [newSession, setNewSession] = useState({
    courseId: undefined as number | undefined,
    sessionDate: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '16:00',
    location: '',
    maxParticipants: undefined as number | undefined,
    instructorExternal: '',
  });

  // Responsive height calculation
  useEffect(() => {
    const calculateHeight = () => {
      const headerHeight = 280;
      const padding = 100;
      const minHeight = 400;
      const availableHeight = window.innerHeight - headerHeight - padding;
      setGridHeight(Math.max(minHeight, availableHeight));
    };

    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    return () => window.removeEventListener('resize', calculateHeight);
  }, []);

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
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {/* T037: ResponsivePageHeader */}
      <ResponsivePageHeader
        title="การจัดอบรม"
        subtitle={`Training Sessions • ${sessions.length} รายการ`}
        icon={CalendarDays}
        iconBgColor="bg-green-100"
        iconColor="text-green-600"
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'การอบรม', href: '/hr/training' },
          { label: 'รอบอบรม' },
        ]}
        actions={
          <DxButton
            text="จัดอบรมใหม่"
            icon="add"
            type="default"
            stylingMode="contained"
            onClick={() => setShowCreatePopup(true)}
          />
        }
      />

      {/* Stats using StatCard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="กำหนดการ"
          value={sessions.filter((s) => s.status === 'scheduled').length}
          icon={CalendarDays}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          label="กำลังดำเนินการ"
          value={sessions.filter((s) => s.status === 'in_progress').length}
          icon={PlayCircle}
          iconColor="text-yellow-500"
          accentColor="border-yellow-500"
          isLoading={isLoading}
        />
        <StatCard
          label="เสร็จสิ้น"
          value={sessions.filter((s) => s.status === 'completed').length}
          icon={CheckCircle}
          iconColor="text-green-500"
          accentColor="border-green-500"
          isLoading={isLoading}
        />
        <StatCard
          label="ผู้เข้าร่วมทั้งหมด"
          value={sessions.reduce((acc, s) => acc + (s.participantCount || 0), 0)}
          icon={Users}
          iconColor="text-gray-500"
          accentColor="border-gray-500"
          isLoading={isLoading}
        />
      </div>

      {/* T038: DataGrid with columnHidingEnabled */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <DataGrid
          dataSource={sessions}
          keyExpr="id"
          showBorders={false}
          showRowLines
          rowAlternationEnabled
          columnAutoWidth
          columnHidingEnabled
          height={gridHeight}
          hoverStateEnabled
          loadPanel={{ enabled: isLoading }}
        >
          <SearchPanel visible placeholder="ค้นหา..." width={200} />
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
            hidingPriority={0}
          />
          <Column dataField="courseName" caption="หลักสูตร" minWidth={180} hidingPriority={1} />
          <Column dataField="courseCode" caption="รหัส" width={100} hidingPriority={5} />
          <Column
            caption="เวลา"
            width={120}
            calculateCellValue={formatTimeRange}
            hidingPriority={4}
          />
          <Column dataField="location" caption="สถานที่" width={150} hidingPriority={3} />
          <Column dataField="instructorName" caption="วิทยากร" width={150} hidingPriority={6} />
          <Column
            dataField="participantCount"
            caption="ผู้เข้าร่วม"
            width={100}
            alignment="center"
            hidingPriority={7}
          />
          <Column
            dataField="status"
            caption="สถานะ"
            width={130}
            cellRender={renderStatusCell}
            alignment="center"
            hidingPriority={2}
          />
          <Column
            caption="การดำเนินการ"
            width={100}
            cellRender={renderActionsCell}
            alignment="center"
            hidingPriority={8}
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
