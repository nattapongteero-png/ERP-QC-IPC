'use client';

// Equipment & Maintenance List Page
// Feature: 010-accounting-module-integration
// User Story 8: Track Equipment and Maintenance Costs
// Pattern: Aligned with Template module

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import DataGrid, {
  Column,
  Export,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  Sorting,
  LoadPanel,
  MasterDetail,
} from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import {
  AccountingStatusBadge,
} from '@/components/accounting';
import { Wrench, AlertTriangle, Clock, CheckCircle, Activity, Eye, Edit, Trash2 } from 'lucide-react';
import type { AccountingEquipment } from '@/lib/db/schema';

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

interface EquipmentWithAsset extends AccountingEquipment {
  assetCode?: string;
  assetName?: string;
}

interface EquipmentSummary {
  totalEquipment: number;
  availableEquipment: number;
  unavailableEquipment: number;
  overdueMaintenanceCount: number;
  upcomingMaintenanceCount: number;
}

interface UpcomingMaintenance {
  schedule: {
    id: number;
    maintenanceType: string;
    description: string;
    nextDue: string;
  };
  equipment: {
    id: number;
  };
  daysUntilDue: number;
}

function formatDate(dateStr: string | Date | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

async function fetchEquipment(isAvailable?: boolean): Promise<EquipmentWithAsset[]> {
  const params = new URLSearchParams();
  if (isAvailable !== undefined) params.set('isAvailable', String(isAvailable));

  const res = await fetch(`/api/accounting/equipment?${params.toString()}`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch equipment');
  }
  const data = await res.json();
  return data.data;
}

async function fetchEquipmentSummary(): Promise<EquipmentSummary> {
  const res = await fetch('/api/accounting/equipment?summary=true');
  if (!res.ok) {
    return {
      totalEquipment: 0,
      availableEquipment: 0,
      unavailableEquipment: 0,
      overdueMaintenanceCount: 0,
      upcomingMaintenanceCount: 0,
    };
  }
  const data = await res.json();
  return data.data;
}

async function fetchOverdueMaintenance(): Promise<{ count: number }> {
  const res = await fetch('/api/accounting/maintenance/overdue');
  if (!res.ok) return { count: 0 };
  const data = await res.json();
  return { count: data.count || 0 };
}

async function fetchUpcomingMaintenance(): Promise<UpcomingMaintenance[]> {
  const res = await fetch('/api/accounting/maintenance/due?daysAhead=7');
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

async function deleteEquipment(id: number): Promise<void> {
  const res = await fetch(`/api/accounting/equipment/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete equipment');
  }
}

function MaintenanceDetailView({ data }: { data: { data: EquipmentWithAsset } }) {
  const t = useTranslations('accounting');
  const equipmentId = data.data.id;

  const { data: schedules = [] } = useQuery({
    queryKey: ['equipment-schedules', equipmentId],
    queryFn: async () => {
      const res = await fetch(`/api/accounting/equipment/${equipmentId}/schedules`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
  });

  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50/30">
      <h4 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <div className="w-1 h-4 bg-blue-500 rounded-full" />
        {t('equipment.detail.title')}
      </h4>
      {schedules.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">{t('equipment.detail.noSchedules')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedules.map((schedule: { id: number; maintenanceType: string; description: string; intervalType: string; intervalValue: number; nextDue: string }) => (
            <div key={schedule.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="text-sm font-semibold text-gray-900">{schedule.maintenanceType}</div>
                <div className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                  {t('equipment.detail.active')}
                </div>
              </div>
              <div className="text-xs text-gray-600 mb-3">{schedule.description}</div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500">
                  {t('equipment.detail.every')} {schedule.intervalValue} {schedule.intervalType}
                </div>
                <div className="text-xs font-medium text-blue-600">
                  {t('equipment.detail.next')}: {formatDate(schedule.nextDue)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

MaintenanceDetailView.displayName = 'MaintenanceDetailView';

export default function EquipmentPage() {
  const t = useTranslations('accounting');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('');
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithAsset | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const availabilityOptions = useMemo(() => [
    { value: '', text: t('equipment.availability.all') },
    { value: 'available', text: t('equipment.availability.available') },
    { value: 'unavailable', text: t('equipment.availability.unavailable') },
  ], [t]);

  const isAvailable = availabilityFilter === 'available'
    ? true
    : availabilityFilter === 'unavailable'
    ? false
    : undefined;

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ['equipment', availabilityFilter],
    queryFn: () => fetchEquipment(isAvailable),
  });

  const { data: summary } = useQuery({
    queryKey: ['equipment-summary'],
    queryFn: fetchEquipmentSummary,
  });

  const { data: overdue } = useQuery({
    queryKey: ['overdue-maintenance'],
    queryFn: fetchOverdueMaintenance,
  });

  const { data: upcoming = [] } = useQuery({
    queryKey: ['upcoming-maintenance'],
    queryFn: fetchUpcomingMaintenance,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEquipment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-summary'] });
      notify(t('equipment.deleteSuccess'), 'success', 3000);
      setShowDeleteConfirm(false);
      setSelectedEquipment(null);
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleExportJSON = useCallback(() => {
    if (!equipment || equipment.length === 0) return;
    const blob = new Blob([JSON.stringify(equipment, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `equipment-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify(t('equipment.exportSuccess'), 'success', 3000);
  }, [equipment, t]);

  const handleRowClick = (e: { data: EquipmentWithAsset }) => {
    router.push(`/accounting/equipment/${e.data.id}`);
  };

  const handleDelete = (equipmentItem: EquipmentWithAsset) => {
    setSelectedEquipment(equipmentItem);
    setShowDeleteConfirm(true);
  };

  // Add row sequence numbers for the grid
  const equipmentWithRowNumber = useMemo(
    () => equipment.map((item, index) => ({ ...item, _rowNumber: index + 1 })),
    [equipment]
  );

  const renderActionsCell = (cellData: { data: EquipmentWithAsset }) => {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/accounting/equipment/${cellData.data.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title={t('equipment.rowActions.view')}
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/accounting/equipment/${cellData.data.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
          title={t('equipment.rowActions.edit')}
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(cellData.data);
          }}
          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title={t('equipment.rowActions.delete')}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-1" data-testid="equipment-page">
      {/* Header */}
      <ResponsivePageHeader
        title={t('equipment.title')}
        subtitle={t('equipment.subtitle')}
        icon={Wrench}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: t('equipment.breadcrumbHome'), href: '/' },
          { label: t('equipment.breadcrumbAccounting'), href: '/accounting' },
          { label: t('equipment.breadcrumbEquipment') },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {equipment.length > 0 && (
              <Button
                text={t('equipment.exportJson')}
                icon="export"
                stylingMode="outlined"
                onClick={handleExportJSON}
              />
            )}
            <Button
              text={t('equipment.addEquipment')}
              icon="plus"
              type="success"
              onClick={() => router.push('/accounting/equipment/new')}
              data-testid="eq-add-btn"
            />
          </div>
        }
      />

      {/* Delete Confirmation */}
      {showDeleteConfirm && selectedEquipment && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-800">{t('equipment.delete.title')}</p>
                <p className="text-sm text-red-600">
                  {t('equipment.delete.message', {
                    name: selectedEquipment.assetName || `ID: ${selectedEquipment.id}`,
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text={t('equipment.delete.cancel')}
                  stylingMode="outlined"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedEquipment(null);
                  }}
                />
                <Button
                  text={deleteMutation.isPending ? t('equipment.delete.deleting') : t('equipment.delete.confirm')}
                  icon="trash"
                  type="danger"
                  onClick={() => deleteMutation.mutate(selectedEquipment.id)}
                  disabled={deleteMutation.isPending}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4" data-testid="eq-stats">
        <StatCard
          label={t('equipment.stats.totalEquipment')}
          value={summary?.totalEquipment || 0}
          icon={Wrench}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
        />
        <StatCard
          label={t('equipment.stats.available')}
          value={summary?.availableEquipment || 0}
          icon={CheckCircle}
          iconColor="text-green-500"
          accentColor="border-green-500"
        />
        <StatCard
          label={t('equipment.stats.inUse')}
          value={summary?.unavailableEquipment || 0}
          icon={Activity}
          iconColor="text-yellow-500"
          accentColor="border-yellow-500"
        />
        <StatCard
          label={t('equipment.stats.overdue')}
          value={overdue?.count || 0}
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
        />
        <StatCard
          label={t('equipment.stats.due7Days')}
          value={upcoming?.length || 0}
          icon={Clock}
          iconColor="text-orange-500"
          accentColor="border-orange-500"
        />
      </div>

      {/* Overdue Maintenance Alert */}
      {(overdue?.count || 0) > 0 && (
        <Card className="border-red-200 bg-gradient-to-r from-red-50 to-orange-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 text-red-900 mb-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <span className="font-semibold text-lg">{t('equipment.overdueAlert.title')}</span>
            </div>
            <p className="text-sm text-red-700 ml-11">
              {t('equipment.overdueAlert.message', { count: overdue?.count || 0 })}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('equipment.availability.label')}
              </label>
              <SelectBox
                key={locale}
                items={availabilityOptions}
                value={availabilityFilter}
                onValueChanged={(e) => setAvailabilityFilter(e.value)}
                valueExpr="value"
                displayExpr="text"
                width={200}
              />
            </div>
            {availabilityFilter && (
              <Button
                text={t('equipment.availability.clear')}
                stylingMode="text"
                onClick={() => setAvailabilityFilter('')}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Grid */}
      <Card data-testid="eq-grid">
        <CardContent className="p-0">
          <DataGrid
            key={locale}
            dataSource={equipmentWithRowNumber}
            keyExpr="id"
            showBorders={false}
            showRowLines
            rowAlternationEnabled
            hoverStateEnabled
            columnAutoWidth
            allowColumnResizing
            onRowClick={handleRowClick}
            className="min-h-[400px]"
          >
            <LoadPanel enabled={isLoading} />
            <FilterRow visible />
            <HeaderFilter visible />
            <Sorting mode="multiple" />
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
            <Column dataField="assetCode" caption={t('equipment.table.columns.assetCode')} width={150} />
            <Column dataField="assetName" caption={t('equipment.table.columns.assetName')} minWidth={200} />
            <Column dataField="serialNumber" caption={t('equipment.table.columns.serialNumber')} width={150} />
            <Column dataField="manufacturer" caption={t('equipment.table.columns.manufacturer')} width={150} />
            <Column dataField="model" caption={t('equipment.table.columns.model')} width={130} />
            <Column
              dataField="operatingHours"
              caption={t('equipment.table.columns.operatingHours')}
              dataType="number"
              format="#,##0"
              width={100}
              alignment="right"
            />
            <Column
              dataField="lastMaintenanceDate"
              caption={t('equipment.table.columns.lastMaintenance')}
              calculateCellValue={(rowData: EquipmentWithAsset) => formatDate(rowData.lastMaintenanceDate)}
              width={140}
            />
            <Column
              dataField="nextMaintenanceDue"
              caption={t('equipment.table.columns.nextDue')}
              calculateCellValue={(rowData: EquipmentWithAsset) => formatDate(rowData.nextMaintenanceDue)}
              width={140}
            />
            <Column
              dataField="isAvailable"
              caption={t('equipment.table.columns.status')}
              width={110}
              cellRender={({ data }) => (
                <AccountingStatusBadge
                  status={data.isAvailable ? 'active' : 'pending'}
                />
              )}
            />
            <Column
              caption={t('equipment.table.columns.actions')}
              width={120}
              cellRender={renderActionsCell}
              allowFiltering={false}
              allowSorting={false}
              alignment="center"
            />

            <Export enabled allowExportSelectedData />
            <MasterDetail enabled component={MaintenanceDetailView} />
          </DataGrid>
        </CardContent>
      </Card>

      {/* Upcoming Maintenance Section */}
      {upcoming.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-1 h-6 bg-orange-500 rounded-full" />
              <h3 className="text-lg font-semibold text-gray-900">
                {t('equipment.upcoming.title')}
              </h3>
            </div>
            <div className="space-y-3">
              {upcoming.slice(0, 5).map((item, index) => (
                <UpcomingMaintenanceItem key={`upcoming-${index}`} item={item} t={t} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UpcomingMaintenanceItem({ item, t }: { item: UpcomingMaintenance; t: TranslateFn }) {
  return (
    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50/30 rounded-lg border border-blue-100 hover:border-blue-200 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Clock className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <span className="font-semibold text-gray-900">
            {item.schedule.maintenanceType}
          </span>
          <span className="text-gray-600 ml-2">
            - {item.schedule.description}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          {t('equipment.upcoming.due')}: {formatDate(item.schedule.nextDue)}
        </span>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
          item.daysUntilDue <= 2
            ? 'bg-orange-100 text-orange-700'
            : 'bg-blue-100 text-blue-700'
        }`}>
          {item.daysUntilDue === 0 ? t('equipment.upcoming.today') : t('equipment.upcoming.days', { count: item.daysUntilDue })}
        </span>
      </div>
    </div>
  );
}
