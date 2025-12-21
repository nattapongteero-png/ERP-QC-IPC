'use client';

// HR Notifications Page
// Feature: 007-hr-personnel-management

import { useState, useEffect } from 'react';
import DataGrid, {
  Column,
  SearchPanel,
  HeaderFilter,
  FilterRow,
  Paging,
  Pager,
  Selection,
} from 'devextreme-react/data-grid';
import { Popup } from 'devextreme-react/popup';
import SelectBox from 'devextreme-react/select-box';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { buddhistDateTimeFormat } from '@/components/ui/dx-date-box';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import {
  Bell,
  Clock,
  AlertTriangle,
  GraduationCap,
  HeartPulse,
  Shield,
} from 'lucide-react';
import type { NotificationType } from '@/types/hr';
import type { HRNotificationWithEmployee } from '@/lib/services/hr.service';

interface NotificationResponse {
  data: HRNotificationWithEmployee[];
  total: number;
}

async function fetchNotifications(params: {
  type?: string;
  limit?: number;
}): Promise<NotificationResponse> {
  const searchParams = new URLSearchParams();
  if (params.type) searchParams.set('type', params.type);
  if (params.limit) searchParams.set('limit', String(params.limit));

  const response = await fetch('/api/hr/notifications?' + searchParams.toString());
  if (!response.ok) throw new Error('Failed to fetch notifications');
  const result = await response.json();
  return result.data || { data: [], total: 0 };
}

async function runNotificationCheck(
  endpoint: string
): Promise<{ message: string; totalCreated: number }> {
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error('Failed to run notification check');
  const result = await response.json();
  return result.data;
}

async function markNotificationRead(id: number): Promise<void> {
  const response = await fetch(`/api/hr/notifications/${id}`, {
    method: 'PUT',
  });
  if (!response.ok) throw new Error('Failed to mark notification as read');
}

async function deleteNotification(id: number): Promise<void> {
  const response = await fetch(`/api/hr/notifications/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete notification');
}

const NOTIFICATION_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'training_expiring', label: 'การอบรมใกล้หมดอายุ' },
  { value: 'training_expired', label: 'การอบรมหมดอายุแล้ว' },
  { value: 'health_check_due', label: 'ถึงกำหนดตรวจสุขภาพ' },
  { value: 'health_check_overdue', label: 'เลยกำหนดตรวจสุขภาพ' },
  { value: 'authorization_expiring', label: 'สิทธิ์ใกล้หมดอายุ' },
];

const TYPE_ICONS: Record<NotificationType, typeof Bell> = {
  training_expiring: GraduationCap,
  training_expired: GraduationCap,
  health_check_due: HeartPulse,
  health_check_overdue: HeartPulse,
  authorization_expiring: Shield,
};

const TYPE_COLORS: Record<NotificationType, string> = {
  training_expiring: 'bg-yellow-100 text-yellow-800',
  training_expired: 'bg-red-100 text-red-800',
  health_check_due: 'bg-blue-100 text-blue-800',
  health_check_overdue: 'bg-red-100 text-red-800',
  authorization_expiring: 'bg-orange-100 text-orange-800',
};

const TYPE_LABELS: Record<NotificationType, string> = {
  training_expiring: 'อบรมใกล้หมดอายุ',
  training_expired: 'อบรมหมดอายุ',
  health_check_due: 'ตรวจสุขภาพ',
  health_check_overdue: 'เลยกำหนดตรวจ',
  authorization_expiring: 'สิทธิ์หมดอายุ',
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [selectedNotification, setSelectedNotification] =
    useState<HRNotificationWithEmployee | null>(null);
  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const [gridHeight, setGridHeight] = useState(600);

  // Responsive height calculation
  useEffect(() => {
    const calculateHeight = () => {
      const headerHeight = 380;
      const padding = 100;
      const minHeight = 400;
      const availableHeight = window.innerHeight - headerHeight - padding;
      setGridHeight(Math.max(minHeight, availableHeight));
    };

    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    return () => window.removeEventListener('resize', calculateHeight);
  }, []);

  // Fetch notifications
  const {
    data: notificationsData,
    refetch,
  } = useQuery({
    queryKey: ['hr-notifications', typeFilter],
    queryFn: () =>
      fetchNotifications({
        type: typeFilter || undefined,
        limit: 100,
      }),
  });

  // Mutation: Run training check
  const runTrainingCheckMutation = useMutation({
    mutationFn: () =>
      runNotificationCheck('/api/hr/training/notifications/check'),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hr-notifications'] });
      alert(`สร้างการแจ้งเตือน ${data.totalCreated} รายการ`);
    },
    onError: () => alert('เกิดข้อผิดพลาดในการตรวจสอบ'),
  });

  // Mutation: Run health check
  const runHealthCheckMutation = useMutation({
    mutationFn: () =>
      runNotificationCheck('/api/hr/health-records/notifications/check'),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hr-notifications'] });
      alert(`สร้างการแจ้งเตือน ${data.totalCreated} รายการ`);
    },
    onError: () => alert('เกิดข้อผิดพลาดในการตรวจสอบ'),
  });

  // Mutation: Mark as read
  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-notifications'] });
      setShowDetailPopup(false);
    },
    onError: () => alert('เกิดข้อผิดพลาด'),
  });

  // Mutation: Delete notification
  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-notifications'] });
      setShowDetailPopup(false);
    },
    onError: () => alert('เกิดข้อผิดพลาด'),
  });

  const notifications = notificationsData?.data || [];

  // Stats
  const stats = {
    total: notifications.length,
    trainingExpiring: notifications.filter(
      (n) => n.type === 'training_expiring'
    ).length,
    trainingExpired: notifications.filter(
      (n) => n.type === 'training_expired'
    ).length,
    healthDue: notifications.filter((n) => n.type === 'health_check_due')
      .length,
    healthOverdue: notifications.filter(
      (n) => n.type === 'health_check_overdue'
    ).length,
  };

  const renderTypeCell = (data: { data: HRNotificationWithEmployee }) => {
    const type = data.data.type;
    const Icon = TYPE_ICONS[type] || Bell;
    return (
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <Badge className={TYPE_COLORS[type]}>{TYPE_LABELS[type]}</Badge>
      </div>
    );
  };

  const renderActionsCell = (data: { data: HRNotificationWithEmployee }) => {
    return (
      <div className="flex gap-1">
        <DxButton
          icon="info"
          hint="ดูรายละเอียด"
          stylingMode="text"
          onClick={() => {
            setSelectedNotification(data.data);
            setShowDetailPopup(true);
          }}
        />
        <DxButton
          icon="check"
          hint="ทำเครื่องหมายอ่านแล้ว"
          stylingMode="text"
          onClick={() => markReadMutation.mutate(data.data.id)}
        />
        <DxButton
          icon="trash"
          hint="ลบ"
          stylingMode="text"
          onClick={() => {
            if (confirm('ต้องการลบการแจ้งเตือนนี้?')) {
              deleteMutation.mutate(data.data.id);
            }
          }}
        />
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {/* ResponsivePageHeader */}
      <ResponsivePageHeader
        title="การแจ้งเตือน HR"
        subtitle="จัดการการแจ้งเตือนการอบรมและการตรวจสุขภาพ"
        icon={Bell}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'การแจ้งเตือน' },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <DxButton
              text="ตรวจสอบอบรม"
              icon="event"
              type="default"
              stylingMode="outlined"
              onClick={() => runTrainingCheckMutation.mutate()}
              disabled={runTrainingCheckMutation.isPending}
            />
            <DxButton
              text="ตรวจสอบสุขภาพ"
              icon="mediumiconslayout"
              type="default"
              stylingMode="outlined"
              onClick={() => runHealthCheckMutation.mutate()}
              disabled={runHealthCheckMutation.isPending}
            />
            <DxButton
              icon="refresh"
              hint="รีเฟรช"
              stylingMode="text"
              onClick={() => refetch()}
            />
          </div>
        }
      />

      {/* Stats using StatCard - 2x2 on mobile, 5 cols on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        <StatCard
          label="รายการทั้งหมด"
          value={stats.total}
          icon={Bell}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
        />
        <StatCard
          label="อบรมใกล้หมดอายุ"
          value={stats.trainingExpiring}
          icon={Clock}
          iconColor="text-yellow-500"
          accentColor="border-yellow-500"
        />
        <StatCard
          label="อบรมหมดอายุ"
          value={stats.trainingExpired}
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
        />
        <StatCard
          label="ตรวจสุขภาพใกล้ถึง"
          value={stats.healthDue}
          icon={HeartPulse}
          iconColor="text-blue-400"
          accentColor="border-blue-400"
        />
        <StatCard
          label="เลยกำหนดตรวจ"
          value={stats.healthOverdue}
          icon={AlertTriangle}
          iconColor="text-red-400"
          accentColor="border-red-400"
        />
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 md:p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4">
          <span className="text-sm font-medium whitespace-nowrap">ประเภท:</span>
          <SelectBox
            items={NOTIFICATION_TYPES}
            valueExpr="value"
            displayExpr="label"
            value={typeFilter}
            onValueChanged={(e) => setTypeFilter(e.value)}
            width="100%"
          />
        </div>
      </div>

      {/* Notifications Grid with columnHidingEnabled */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <DataGrid
          dataSource={notifications}
          keyExpr="id"
          showBorders={false}
          showRowLines
          columnAutoWidth
          columnHidingEnabled
          rowAlternationEnabled
          wordWrapEnabled
          height={gridHeight}
          hoverStateEnabled
        >
          <SearchPanel visible placeholder="ค้นหา..." width={200} />
          <HeaderFilter visible />
          <FilterRow visible />
          <Selection mode="multiple" />
          <Paging defaultPageSize={20} />
          <Pager
            showPageSizeSelector
            allowedPageSizes={[10, 20, 50]}
            showInfo
          />

          <Column
            dataField="type"
            caption="ประเภท"
            width={160}
            cellRender={renderTypeCell}
            hidingPriority={2}
          />
          <Column
            dataField="employeeCode"
            caption="รหัสพนักงาน"
            width={100}
            hidingPriority={4}
          />
          <Column
            dataField="employeeName"
            caption="ชื่อพนักงาน"
            minWidth={150}
            hidingPriority={0}
          />
          <Column dataField="title" caption="หัวข้อ" minWidth={200} hidingPriority={1} />
          <Column
            dataField="createdAt"
            caption="วันที่สร้าง"
            dataType="datetime"
            width={140}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            format={buddhistDateTimeFormat as any}
            hidingPriority={5}
          />
          <Column
            caption="จัดการ"
            width={100}
            cellRender={renderActionsCell}
            allowFiltering={false}
            allowSorting={false}
            hidingPriority={3}
          />
        </DataGrid>
      </div>

      {/* Detail Popup */}
      <Popup
        visible={showDetailPopup}
        onHiding={() => setShowDetailPopup(false)}
        title="รายละเอียดการแจ้งเตือน"
        width={500}
        height="auto"
        showCloseButton={true}
      >
        {selectedNotification && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = TYPE_ICONS[selectedNotification.type] || Bell;
                return <Icon className="h-6 w-6" />;
              })()}
              <Badge className={TYPE_COLORS[selectedNotification.type]}>
                {TYPE_LABELS[selectedNotification.type]}
              </Badge>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">
                พนักงาน
              </label>
              <p className="text-lg">
                {selectedNotification.employeeCode} -{' '}
                {selectedNotification.employeeName}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">หัวข้อ</label>
              <p className="text-lg font-semibold">
                {selectedNotification.title}
              </p>
            </div>

            {selectedNotification.message && (
              <div>
                <label className="text-sm font-medium text-gray-500">
                  รายละเอียด
                </label>
                <p className="text-gray-700">{selectedNotification.message}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-500">
                วันที่สร้าง
              </label>
              <p>
                {new Date(selectedNotification.createdAt).toLocaleString(
                  'th-TH'
                )}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <DxButton
                text="ทำเครื่องหมายอ่านแล้ว"
                icon="check"
                type="success"
                onClick={() => markReadMutation.mutate(selectedNotification.id)}
                disabled={markReadMutation.isPending}
              />
              <DxButton
                text="ลบ"
                icon="trash"
                type="danger"
                onClick={() => {
                  if (confirm('ต้องการลบการแจ้งเตือนนี้?')) {
                    deleteMutation.mutate(selectedNotification.id);
                  }
                }}
                disabled={deleteMutation.isPending}
              />
              <DxButton
                text="ปิด"
                stylingMode="outlined"
                onClick={() => setShowDetailPopup(false)}
              />
            </div>
          </div>
        )}
      </Popup>
    </div>
  );
}
