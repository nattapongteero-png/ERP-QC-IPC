'use client';

// HR Notifications Page
// Following template design pattern for list page
// Feature: 007-hr-personnel-management

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import DataGrid, {
  Column,
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

const NOTIFICATION_TYPE_CONFIG: { value: string; translationKey: string }[] = [
  { value: '', translationKey: 'all' },
  { value: 'training_expiring', translationKey: 'trainingExpiring' },
  { value: 'training_expired', translationKey: 'trainingExpired' },
  { value: 'health_check_due', translationKey: 'healthCheckDue' },
  { value: 'health_check_overdue', translationKey: 'healthCheckOverdue' },
  { value: 'authorization_expiring', translationKey: 'authorizationExpiring' },
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

const TYPE_LABEL_KEYS: Record<NotificationType, string> = {
  training_expiring: 'trainingExpiring',
  training_expired: 'trainingExpired',
  health_check_due: 'healthCheckDue',
  health_check_overdue: 'healthCheckOverdue',
  authorization_expiring: 'authorizationExpiring',
};

export default function NotificationsPage() {
  const t = useTranslations('hr');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const toast = useToast();

  const NOTIFICATION_TYPES = useMemo(
    () =>
      NOTIFICATION_TYPE_CONFIG.map((c) => ({
        value: c.value,
        label: t(`notifications.types.${c.translationKey}`),
      })),
    [t]
  );
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
      toast.success(t('notifications.toast.checkSuccess', { 0: data.totalCreated }));
    },
    onError: () => toast.error(t('notifications.toast.checkError')),
  });

  // Mutation: Run health check
  const runHealthCheckMutation = useMutation({
    mutationFn: () =>
      runNotificationCheck('/api/hr/health-records/notifications/check'),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hr-notifications'] });
      toast.success(t('notifications.toast.checkSuccess', { 0: data.totalCreated }));
    },
    onError: () => toast.error(t('notifications.toast.checkError')),
  });

  // Mutation: Mark as read
  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-notifications'] });
      toast.success(t('notifications.toast.markReadSuccess'));
      setShowDetailPopup(false);
    },
    onError: () => toast.error(t('notifications.toast.error')),
  });

  // Mutation: Delete notification
  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-notifications'] });
      toast.success(t('notifications.toast.deleteSuccess'));
      setShowDeleteConfirm(false);
      setNotificationToDelete(null);
      setShowDetailPopup(false);
    },
    onError: () => toast.error(t('notifications.toast.error')),
  });

  const allNotifications = useMemo(() => notificationsData?.data || [], [notificationsData]);

  // Filter notifications based on search text
  const notifications = useMemo(() => {
    const filtered = !searchText.trim()
      ? allNotifications
      : allNotifications.filter((n) => {
          const searchLower = searchText.toLowerCase().trim();
          return (
            n.employeeCode?.toLowerCase().includes(searchLower) ||
            n.employeeName?.toLowerCase().includes(searchLower) ||
            n.title?.toLowerCase().includes(searchLower)
          );
        });
    return filtered.map((item, index) => ({ ...item, _rowNumber: index + 1 }));
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
    const labelKey = TYPE_LABEL_KEYS[type];
    return (
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <Badge className={TYPE_COLORS[type]}>{labelKey ? t(`notifications.typeLabels.${labelKey}`) : type}</Badge>
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
          title={t('notifications.actionsHint.view')}
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            markReadMutation.mutate(data.data.id);
          }}
          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
          title={t('notifications.actionsHint.markAsRead')}
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(data.data);
          }}
          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title={t('notifications.actionsHint.delete')}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }, [markReadMutation, handleDelete, t]);

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      {/* ResponsivePageHeader */}
      <ResponsivePageHeader
        title={t('notifications.title')}
        subtitle={t('notifications.description')}
        icon={Bell}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: t('notifications.breadcrumb') },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              text={t('notifications.checkTraining')}
              icon="event"
              type="default"
              stylingMode="outlined"
              onClick={() => runTrainingCheckMutation.mutate()}
              disabled={runTrainingCheckMutation.isPending}
            />
            <Button
              text={t('notifications.checkHealth')}
              icon="mediumiconslayout"
              type="default"
              stylingMode="outlined"
              onClick={() => runHealthCheckMutation.mutate()}
              disabled={runHealthCheckMutation.isPending}
            />
            <Button
              icon="refresh"
              hint={t('notifications.refreshHint')}
              stylingMode="text"
              onClick={() => refetch()}
            />
          </div>
        }
      />

      {/* Stats using StatCard - 2x2 on mobile, 5 cols on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        <StatCard
          label={t('notifications.stats.total')}
          value={stats.total}
          icon={Bell}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
        />
        <StatCard
          label={t('notifications.stats.trainingExpiring')}
          value={stats.trainingExpiring}
          icon={Clock}
          iconColor="text-yellow-500"
          accentColor="border-yellow-500"
        />
        <StatCard
          label={t('notifications.stats.trainingExpired')}
          value={stats.trainingExpired}
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
        />
        <StatCard
          label={t('notifications.stats.healthDue')}
          value={stats.healthDue}
          icon={HeartPulse}
          iconColor="text-blue-400"
          accentColor="border-blue-400"
        />
        <StatCard
          label={t('notifications.stats.healthOverdue')}
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
                <p className="font-medium text-red-800">{t('notifications.deleteConfirm.title')}</p>
                <p className="text-sm text-red-600">
                  {t('notifications.deleteConfirm.message', { 0: notificationToDelete.title })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text={t('notifications.deleteConfirm.cancel')}
                  stylingMode="outlined"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setNotificationToDelete(null);
                  }}
                />
                <Button
                  text={deleteMutation.isPending ? t('notifications.deleteConfirm.deleting') : t('notifications.deleteConfirm.delete')}
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
                <span className="text-sm font-medium text-gray-700">{t('notifications.filters.label')}</span>
              </div>
              <div className="w-56">
                <TextBox
                  value={searchText}
                  onValueChanged={(e) => setSearchText(e.value || '')}
                  valueChangeEvent="keyup"
                  placeholder={t('notifications.filters.searchPlaceholder')}
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
                  placeholder={t('notifications.filters.typePlaceholder')}
                />
              </div>
              {(searchText || typeFilter) && (
                <Button
                  text={t('notifications.filters.clear')}
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
                <span className="text-gray-500">{t('notifications.showing')}</span>
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
            key={locale}
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
            <Scrolling mode="virtual" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50]}
              showInfo
              showNavigationButtons
            />

            <Column
              dataField="_rowNumber"
              caption={t('items.grid.columns.rowNum')}
              width={60}
              alignment="center"
              allowFiltering={false}
              allowSorting={false}
              allowGrouping={false}
              cellRender={(cellInfo) => (
                <span className="text-gray-500 text-sm font-medium">
                  {cellInfo.data._rowNumber}
                </span>
              )}
            />
            <Column
              dataField="type"
              caption={t('notifications.columns.type')}
              width={160}
              cellRender={renderTypeCell}
              hidingPriority={2}
            />
            <Column
              dataField="employeeCode"
              caption={t('notifications.columns.employeeCode')}
              width={100}
              hidingPriority={4}
            />
            <Column
              dataField="employeeName"
              caption={t('notifications.columns.employeeName')}
              minWidth={150}
              hidingPriority={0}
            />
            <Column dataField="title" caption={t('notifications.columns.title')} minWidth={200} hidingPriority={1} />
            <Column
              dataField="createdAt"
              caption={t('notifications.columns.createdAt')}
              dataType="datetime"
              width={140}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              format={buddhistDateTimeFormat as any}
              hidingPriority={5}
            />
            <Column
              caption={t('notifications.columns.actions')}
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
        title={t('notifications.detailPopup.title')}
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
                {TYPE_LABEL_KEYS[selectedNotification.type]
                  ? t(`notifications.typeLabels.${TYPE_LABEL_KEYS[selectedNotification.type]}`)
                  : selectedNotification.type}
              </Badge>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">
                {t('notifications.detailPopup.employee')}
              </label>
              <p className="text-lg">
                {selectedNotification.employeeCode} -{' '}
                {selectedNotification.employeeName}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">{t('notifications.detailPopup.titleLabel')}</label>
              <p className="text-lg font-semibold">
                {selectedNotification.title}
              </p>
            </div>

            {selectedNotification.message && (
              <div>
                <label className="text-sm font-medium text-gray-500">
                  {t('notifications.detailPopup.message')}
                </label>
                <p className="text-gray-700">{selectedNotification.message}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-500">
                {t('notifications.detailPopup.createdAt')}
              </label>
              <p>
                {new Date(selectedNotification.createdAt).toLocaleString(
                  locale === 'th' ? 'th-TH' : 'en-US'
                )}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                text={t('notifications.detailPopup.markAsRead')}
                icon="check"
                type="success"
                onClick={() => markReadMutation.mutate(selectedNotification.id)}
                disabled={markReadMutation.isPending}
              />
              <Button
                text={t('notifications.detailPopup.delete')}
                icon="trash"
                type="danger"
                onClick={() => {
                  setShowDetailPopup(false);
                  handleDelete(selectedNotification);
                }}
                disabled={deleteMutation.isPending}
              />
              <Button
                text={t('notifications.detailPopup.close')}
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
