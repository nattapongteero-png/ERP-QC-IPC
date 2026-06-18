'use client';

// HR Health Records Management Page
// Feature: 007-hr-personnel-management
// Pattern: Aligned with Template module design

import { useState, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import DataGrid, {
  Column,
  SearchPanel,
  Paging,
  Pager,
  Scrolling,
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

const EXAMINATION_TYPE_CONFIG: Record<ExaminationType, { translationKey: string; color: string }> = {
  pre_employment: { translationKey: 'preEmployment', color: 'text-blue-700' },
  periodic: { translationKey: 'periodic', color: 'text-green-700' },
  special: { translationKey: 'special', color: 'text-orange-700' },
};

const FITNESS_STATUS_CONFIG: Record<FitnessStatus, { translationKey: string; variant: 'success' | 'danger' | 'warning' }> = {
  fit: { translationKey: 'fit', variant: 'success' },
  unfit: { translationKey: 'unfit', variant: 'danger' },
  restricted: { translationKey: 'restricted', variant: 'warning' },
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
  const t = useTranslations('hr');
  const locale = useLocale();
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

  const healthRecordsWithRowNum = useMemo(
    () => healthRecords.map((item, index) => ({ ...item, _rowNumber: index + 1 })),
    [healthRecords]
  );

  const healthChecksDueWithRowNum = useMemo(
    () => healthChecksDue.map((item, index) => ({ ...item, _rowNumber: index + 1 })),
    [healthChecksDue]
  );

  const overdueChecksWithRowNum = useMemo(
    () => overdueChecks.map((item, index) => ({ ...item, _rowNumber: index + 1 })),
    [overdueChecks]
  );

  const deleteMutation = useMutation({
    mutationFn: deleteHealthRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'health-records'] });
      notify(t('healthRecords.toast.deleteSuccess'), 'success', 3000);
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
        {t(`healthRecords.examinationType.${config.translationKey}`)}
      </span>
    );
  };

  const renderFitnessStatusCell = (cellData: { value: FitnessStatus }) => {
    const config = FITNESS_STATUS_CONFIG[cellData.value];
    if (!config) return cellData.value;
    return <Badge variant={config.variant}>{t(`healthRecords.fitnessStatus.${config.translationKey}`)}</Badge>;
  };

  const renderDaysUntilDue = (cellData: { value: number }) => {
    const days = cellData.value;
    if (days < 0) {
      return (
        <span className="text-red-600 font-medium">
          {t('healthRecords.daysStatus.overdueBy', { 0: Math.abs(days) })}
        </span>
      );
    }
    if (days <= 7) {
      return (
        <span className="text-orange-600 font-medium">
          {t('healthRecords.daysStatus.inDays', { 0: days })}
        </span>
      );
    }
    return (
      <span className="text-green-600">
        {t('healthRecords.daysStatus.inDays', { 0: days })}
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
          title={t('healthRecords.actionsHint.view')}
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/hr/health-records/${cellData.data.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
          title={t('healthRecords.actionsHint.edit')}
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(cellData.data);
          }}
          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title={t('healthRecords.actionsHint.delete')}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6" data-testid="hr-health-records-page">
      {/* ResponsivePageHeader */}
      <ResponsivePageHeader
        title={t('healthRecords.title')}
        subtitle={t('healthRecords.description')}
        icon={Heart}
        iconBgColor="bg-red-100"
        iconColor="text-red-600"
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: t('healthRecords.breadcrumb') },
        ]}
        actions={
          <Button
            text={t('healthRecords.addRecord')}
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
                <p className="font-medium text-red-800">{t('healthRecords.deleteConfirm.title')}</p>
                <p className="text-sm text-red-600">
                  {t('healthRecords.deleteConfirm.message', {
                    0: (selectedRecord as HealthRecordWithDetails).employeeName || t('healthRecords.deleteConfirm.defaultEmployee'),
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text={t('healthRecords.deleteConfirm.cancel')}
                  stylingMode="outlined"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedRecord(null);
                  }}
                />
                <Button
                  text={deleteMutation.isPending ? t('healthRecords.deleteConfirm.deleting') : t('healthRecords.deleteConfirm.delete')}
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
          label={t('healthRecords.stats.total')}
          value={healthRecords.length}
          icon={Heart}
          iconColor="text-green-500"
          accentColor="border-green-500"
        />
        <StatCard
          label={t('healthRecords.stats.dueIn30')}
          value={healthChecksDue.length}
          icon={Calendar}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
        />
        <StatCard
          label={t('healthRecords.stats.overdue')}
          value={overdueChecks.length}
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
        />
        <StatCard
          label={t('healthRecords.stats.restricted')}
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
          {t('healthRecords.tabs.records')}
        </button>
        <button
          className={`px-3 md:px-4 py-2 font-medium transition-colors whitespace-nowrap text-sm md:text-base min-h-[44px] ${
            activeTab === 'due'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('due')}
        >
          {t('healthRecords.tabs.due')} ({healthChecksDue.length})
        </button>
        <button
          className={`px-3 md:px-4 py-2 font-medium transition-colors whitespace-nowrap text-sm md:text-base min-h-[44px] ${
            activeTab === 'overdue'
              ? 'text-red-600 border-b-2 border-red-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('overdue')}
        >
          {t('healthRecords.tabs.overdue')} ({overdueChecks.length})
        </button>
      </div>

      {/* Health Records Grid */}
      {activeTab === 'records' && (
        <Card data-testid="hr-health-records-grid">
          <CardContent className="p-0">
            <DataGrid
              key={locale}
              dataSource={healthRecordsWithRowNum}
              showBorders={false}
              showRowLines
              rowAlternationEnabled
              columnAutoWidth
              hoverStateEnabled
              onRowClick={handleRowClick}
              height="auto"
            >
            <SearchPanel visible placeholder={t('common.search')} width={200} />
            <Scrolling mode="standard" />
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
              dataField="employeeName"
              caption={t('healthRecords.columns.employee')}
              minWidth={150}
              hidingPriority={0}
            />
            <Column
              dataField="examinationType"
              caption={t('healthRecords.columns.examType')}
              width={130}
              cellRender={renderExamTypeCell}
              hidingPriority={3}
            />
            <Column
              dataField="examinationDate"
              caption={t('healthRecords.columns.examDate')}
              dataType="date"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              format={buddhistDateFormat as any}
              width={110}
              hidingPriority={4}
            />
            <Column
              dataField="fitnessStatus"
              caption={t('healthRecords.columns.status')}
              width={140}
              cellRender={renderFitnessStatusCell}
              hidingPriority={1}
            />
            <Column
              dataField="restrictions"
              caption={t('healthRecords.columns.restrictions')}
              width={180}
              hidingPriority={5}
            />
            <Column
              dataField="nextExamDue"
              caption={t('healthRecords.columns.nextDue')}
              dataType="date"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              format={buddhistDateFormat as any}
              width={130}
              hidingPriority={2}
            />
            <Column
              dataField="examinerName"
              caption={t('healthRecords.columns.examiner')}
              width={130}
              hidingPriority={6}
            />
            <Column
              caption={t('healthRecords.columns.actions')}
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
              key={locale}
              dataSource={healthChecksDueWithRowNum}
              showBorders={false}
              showRowLines
              rowAlternationEnabled
              columnAutoWidth
              hoverStateEnabled
              className="min-h-[400px]"
            >
            <SearchPanel visible placeholder={t('common.search')} width={200} />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50]}
              showInfo
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
              dataField="employeeName"
              caption={t('healthRecords.columns.employee')}
              minWidth={150}
              hidingPriority={0}
            />
            <Column
              dataField="employeeEmail"
              caption={t('healthRecords.columns.email')}
              width={180}
              hidingPriority={4}
            />
            <Column
              dataField="lastExamDate"
              caption={t('healthRecords.columns.lastExamDate')}
              dataType="date"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              format={buddhistDateFormat as any}
              width={130}
              hidingPriority={3}
            />
            <Column
              dataField="nextExamDue"
              caption={t('healthRecords.columns.dueDate')}
              dataType="date"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              format={buddhistDateFormat as any}
              width={110}
              hidingPriority={2}
            />
            <Column
              dataField="daysUntilDue"
              caption={t('healthRecords.columns.daysRemaining')}
              width={100}
              cellRender={renderDaysUntilDue}
              hidingPriority={1}
            />
            <Column
              dataField="lastFitnessStatus"
              caption={t('healthRecords.columns.lastStatus')}
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
              key={locale}
              dataSource={overdueChecksWithRowNum}
              showBorders={false}
              showRowLines
              rowAlternationEnabled
              columnAutoWidth
              hoverStateEnabled
              className="min-h-[400px]"
            >
            <SearchPanel visible placeholder={t('common.search')} width={200} />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50]}
              showInfo
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
              dataField="employeeName"
              caption={t('healthRecords.columns.employee')}
              minWidth={150}
              hidingPriority={0}
            />
            <Column
              dataField="employeeEmail"
              caption={t('healthRecords.columns.email')}
              width={180}
              hidingPriority={4}
            />
            <Column
              dataField="lastExamDate"
              caption={t('healthRecords.columns.lastExamDate')}
              dataType="date"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              format={buddhistDateFormat as any}
              width={130}
              hidingPriority={3}
            />
            <Column
              dataField="nextExamDue"
              caption={t('healthRecords.columns.examDue')}
              dataType="date"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              format={buddhistDateFormat as any}
              width={110}
              hidingPriority={2}
            />
            <Column
              dataField="daysUntilDue"
              caption={t('healthRecords.stats.overdue')}
              width={100}
              cellRender={renderDaysUntilDue}
              hidingPriority={1}
            />
            <Column
              dataField="lastFitnessStatus"
              caption={t('healthRecords.columns.lastStatus')}
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
