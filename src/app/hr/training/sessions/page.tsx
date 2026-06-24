'use client';

// HR Training Sessions Page
// Feature: 007-hr-personnel-management

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import DataGrid, {
  Column,
  SearchPanel,
  Paging,
  Pager,
  Scrolling,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useToast } from '@/components/ui/toast';
import { CalendarDays, Users, PlayCircle, CheckCircle, XCircle } from 'lucide-react';
import type { TrainingSession, TrainingSessionStatus } from '@/types/hr';

interface SessionWithDetails extends TrainingSession {
  courseName?: string;
  courseCode?: string;
  instructorName?: string;
  participantCount?: number;
}

const STATUS_CONFIG: Record<TrainingSessionStatus, { labelKey: string; variant: 'secondary' | 'info' | 'success' | 'danger'; icon: React.ElementType }> = {
  scheduled: { labelKey: 'training.sessions.status.scheduled', variant: 'info', icon: CalendarDays },
  in_progress: { labelKey: 'training.sessions.status.inProgress', variant: 'secondary', icon: PlayCircle },
  completed: { labelKey: 'training.sessions.status.completed', variant: 'success', icon: CheckCircle },
  cancelled: { labelKey: 'training.sessions.status.cancelled', variant: 'danger', icon: XCircle },
};

async function fetchSessions(): Promise<SessionWithDetails[]> {
  const response = await fetch('/api/hr/training/sessions');
  if (!response.ok) throw new Error('Failed to fetch sessions');
  const result = await response.json();
  // Handle nested response structure: { success, data: { data: sessions } }
  const data = result.data?.data || result.data || [];
  return Array.isArray(data) ? data : [];
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
  const t = useTranslations('hr');
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['hr', 'training', 'sessions'],
    queryFn: fetchSessions,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'complete' | 'cancel' }) =>
      updateSessionStatus(id, action),
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'sessions'] });
      toast.success(action === 'complete' ? t('training.sessions.toast.completed') : t('training.sessions.toast.cancelled'));
    },
    onError: () => {
      toast.error(t('training.sessions.toast.updateError'));
    },
  });

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
        {t(config.labelKey)}
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
          hint={t('training.sessions.completeHint')}
          type="success"
          stylingMode="text"
          onClick={() => statusMutation.mutate({ id: session.id, action: 'complete' })}
        />
        <DxButton
          icon="close"
          hint={t('training.sessions.cancelHint')}
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
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto" data-title={t('training.sessions.title')}>
      {/* T037: ResponsivePageHeader */}
      <ResponsivePageHeader
        title={t('training.sessions.title')}
        subtitle={t('training.sessions.description')}
        icon={CalendarDays}
        iconBgColor="bg-green-100"
        iconColor="text-green-600"
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: t('training.breadcrumb'), href: '/hr/training' },
          { label: t('training.sessions.breadcrumb') },
        ]}
        actions={
          <DxButton
            text={t('training.sessions.addNew')}
            icon="add"
            type="default"
            stylingMode="contained"
            onClick={() => router.push('/hr/training/sessions/new')}
          />
        }
      />

      {/* Stats using StatCard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('training.sessions.stats.scheduled')}
          value={sessions.filter((s) => s.status === 'scheduled').length}
          icon={CalendarDays}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('training.sessions.stats.inProgress')}
          value={sessions.filter((s) => s.status === 'in_progress').length}
          icon={PlayCircle}
          iconColor="text-yellow-500"
          accentColor="border-yellow-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('training.sessions.stats.completed')}
          value={sessions.filter((s) => s.status === 'completed').length}
          icon={CheckCircle}
          iconColor="text-green-500"
          accentColor="border-green-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('training.sessions.stats.totalParticipants')}
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
          height="auto"
          hoverStateEnabled
          loadPanel={{ enabled: isLoading }}
        >
          <SearchPanel visible placeholder={t('training.sessions.search')} width={200} />
          <Scrolling mode="standard" />
          <Paging defaultPageSize={20} />
          <Pager showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo />

          <Toolbar>
            <Item name="searchPanel" />
          </Toolbar>

          <Column
            dataField="sessionDate"
            caption={t('training.sessions.columns.date')}
            width={120}
            calculateCellValue={(rowData) => formatDate(rowData.sessionDate)}
            hidingPriority={0}
          />
          <Column dataField="courseName" caption={t('training.sessions.columns.course')} minWidth={180} hidingPriority={1} />
          <Column dataField="courseCode" caption={t('training.sessions.columns.code')} width={100} hidingPriority={5} />
          <Column
            caption={t('training.sessions.columns.time')}
            width={120}
            calculateCellValue={formatTimeRange}
            hidingPriority={4}
          />
          <Column dataField="location" caption={t('training.sessions.columns.location')} width={150} hidingPriority={3} />
          <Column dataField="instructorName" caption={t('training.sessions.columns.instructor')} width={150} hidingPriority={6} />
          <Column
            dataField="participantCount"
            caption={t('training.sessions.columns.participants')}
            width={100}
            alignment="center"
            hidingPriority={7}
          />
          <Column
            dataField="status"
            caption={t('training.sessions.columns.status')}
            width={130}
            cellRender={renderStatusCell}
            alignment="center"
            hidingPriority={2}
          />
          <Column
            caption={t('training.sessions.columns.actions')}
            width={100}
            cellRender={renderActionsCell}
            alignment="center"
            hidingPriority={8}
          />
        </DataGrid>
      </div>
    </div>
  );
}
