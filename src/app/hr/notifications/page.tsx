'use client';

// HR Notifications Page
// Following template design pattern for list page
// Feature: 007-hr-personnel-management

import { useState, useEffect, useCallback, useMemo } from 'react';
import DataGrid, {
  Column,
  HeaderFilter,
  FilterRow,
  Paging,
  Pager,
  Scrolling,
  LoadPanel,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { Popup } from 'devextreme-react/popup';
import SelectBox from 'devextreme-react/select-box';
import TextBox from 'devextreme-react/text-box';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { buddhistDateTimeFormat } from '@/components/ui/dx-date-box';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useToast } from '@/components/ui/toast';
import {
  Bell,
  Clock,
  AlertTriangle,
  GraduationCap,
  HeartPulse,
  Shield,
  Eye,
  Check,
  Trash2,
  Filter,
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
  const toast = useToast();
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [selectedNotification, setSelectedNotification] =
    useState<HRNotificationWithEmployee | null>(null);
  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<HRNotificationWithEmployee | null>(null);
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
    isLoading,
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
      toast.success(`สร้างการแจ้งเตือน ${data.totalCreated} รายการ`);
    },
    onError: () => toast.error('เกิดข้อผิดพลาดในการตรวจสอบ'),
  });

  // Mutation: Run health check
  const runHealthCheckMutation = useMutation({
    mutationFn: () =>
      runNotificationCheck('/api/hr/health-records/notifications/check'),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hr-notifications'] });
      toast.success(`สร้างการแจ้งเตือน ${data.totalCreated} รายการ`);
    },
    onError: () => toast.error('เกิดข้อผิดพลาดในการตรวจสอบ'),
  });

  // Mutation: Mark as read
  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-notifications'] });
      toast.success('ทำเครื่องหมายอ่านแล้ว');
      setShowDetailPopup(false);
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  });

  // Mutation: Delete notification
  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-notifications'] });
      toast.success('ลบการแจ้งเตือนสำเร็จ');
      setShowDeleteConfirm(false);
      setNotificationToDelete(null);
      setShowDetailPopup(false);
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  });

  const allNotifications = useMemo(() => notificationsData?.data || [], [notificationsData]);

  // Filter notifications based on search text
  const notifications = useMemo(() => {
    if (!searchText.trim()) return allNotifications;
    const searchLower = searchText.toLowerCase().trim();
    return allNotifications.filter((n) =>
      n.employeeCode?.toLowerCase().includes(searchLower) ||
      n.employeeName?.toLowerCase().includes(searchLower) ||
      n.title?.toLowerCase().includes(searchLower)
    );
  }, [allNotifications, searchText]);

  // Handlers
  const handleDelete = useCallback((notification: HRNotificationWithEmployee) => {
    setNotificationToDelete(notification);
    setShowDeleteConfirm(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (notificationToDelete) {
      deleteMutation.mutate(notificationToDelete.id);
    }
  }, [notificationToDelete, deleteMutation]);

  // Stats
  const stats = useMemo(() => ({
    total: allNotifications.length,
    trainingExpiring: allNotifications.filter(
      (n) => n.type === 'training_expiring'
    ).length,
    trainingExpired: allNotifications.filter(
      (n) => n.type === 'training_expired'
    ).length,
    healthDue: allNotifications.filter((n) => n.type === 'health_check_due')
      .length,
    healthOverdue: allNotifications.filter(
      (n) => n.type === 'health_check_overdue'
    ).length,
  }), [allNotifications]);

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

  const renderActionsCell = useCallback((data: { data: HRNotificationWithEmployee }) => {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedNotification(data.data);
            setShowDetailPopup(true);
          }}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title="ดูรายละเอียด"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            markReadMutation.mutate(data.data.id);
          }}
          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
          title="ทำเครื่องหมายอ่านแล้ว"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(data.data);
          }}
          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title="ลบ"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }, [markReadMutation, handleDelete]);

  return (
    <div className="space-y-6 p-1">
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
            <Button
              text="ตรวจสอบอบรม"
              icon="event"
              type="default"
              stylingMode="outlined"
              onClick={() => runTrainingCheckMutation.mutate()}
              disabled={runTrainingCheckMutation.isPending}
            />
            <Button
              text="ตรวจสอบสุขภาพ"
              icon="mediumiconslayout"
              type="default"
              stylingMode="outlined"
              onClick={() => runHealthCheckMutation.mutate()}
              disabled={runHealthCheckMutation.isPending}
            />
            <Button
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

      {/* Delete Confirmation Card */}
      {showDeleteConfirm && notificationToDelete && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-800">ยืนยันการลบ</p>
                <p className="text-sm text-red-600">
                  คุณต้องการลบการแจ้งเตือน &quot;{notificationToDelete.title}&quot; หรือไม่?
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text="ยกเลิก"
                  stylingMode="outlined"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setNotificationToDelete(null);
                  }}
                />
                <Button
                  text={deleteMutation.isPending ? 'กำลังลบ...' : 'ลบ'}
                  icon="trash"
                  type="danger"
                  onClick={confirmDelete}
                  disabled={deleteMutation.isPending}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters Card */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">ตัวกรอง:</span>
              </div>
              <div className="w-56">
                <TextBox
                  value={searchText}
                  onValueChanged={(e) => setSearchText(e.value || '')}
                  valueChangeEvent="keyup"
                  placeholder="ค้นหา..."
                  showClearButton
                  mode="search"
                />
              </div>
              <div className="w-48">
                <SelectBox
                  items={NOTIFICATION_TYPES}
                  valueExpr="value"
                  displayExpr="label"
                  value={typeFilter}
                  onValueChanged={(e) => setTypeFilter(e.value)}
                  placeholder="ประเภท"
                />
              </div>
              {(searchText || typeFilter) && (
                <Button
                  text="ล้าง"
                  stylingMode="text"
                  onClick={() => {
                    setSearchText('');
                    setTypeFilter('');
                  }}
                />
              )}
            </div>

            {/* Compact Statistics */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-md">
                <span className="text-gray-500">แสดง:</span>
                <span className="font-semibold text-gray-900">{notifications.length}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications DataGrid */}
      <Card>
        <CardContent className="p-0">
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
            <LoadPanel enabled={isLoading} />
            <HeaderFilter visible />
            <FilterRow visible />
            <Scrolling mode="virtual" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50]}
              showInfo
              showNavigationButtons
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
              width={120}
              cellRender={renderActionsCell}
              allowFiltering={false}
              allowSorting={false}
              hidingPriority={3}
            />
          </DataGrid>
        </CardContent>
      </Card>

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
              <Button
                text="ทำเครื่องหมายอ่านแล้ว"
                icon="check"
                type="success"
                onClick={() => markReadMutation.mutate(selectedNotification.id)}
                disabled={markReadMutation.isPending}
              />
              <Button
                text="ลบ"
                icon="trash"
                type="danger"
                onClick={() => {
                  setShowDetailPopup(false);
                  handleDelete(selectedNotification);
                }}
                disabled={deleteMutation.isPending}
              />
              <Button
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
