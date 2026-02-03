'use client';

// Equipment & Maintenance List Page
// Feature: 010-accounting-module-integration
// User Story 8: Track Equipment and Maintenance Costs
// Pattern: Aligned with Template module

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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

const availabilityOptions = [
  { value: '', text: 'All Equipment' },
  { value: 'available', text: 'Available' },
  { value: 'unavailable', text: 'Unavailable / In Use' },
];

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
        Maintenance Schedules
      </h4>
      {schedules.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">No maintenance schedules configured.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedules.map((schedule: { id: number; maintenanceType: string; description: string; intervalType: string; intervalValue: number; nextDue: string }) => (
            <div key={schedule.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="text-sm font-semibold text-gray-900">{schedule.maintenanceType}</div>
                <div className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                  Active
                </div>
              </div>
              <div className="text-xs text-gray-600 mb-3">{schedule.description}</div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500">
                  Every {schedule.intervalValue} {schedule.intervalType}
                </div>
                <div className="text-xs font-medium text-blue-600">
                  Next: {formatDate(schedule.nextDue)}
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('');
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithAsset | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
      notify('Equipment deleted successfully', 'success', 3000);
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
    notify('Equipment data exported successfully', 'success', 3000);
  }, [equipment]);

  const handleRowClick = (e: { data: EquipmentWithAsset }) => {
    router.push(`/accounting/equipment/${e.data.id}`);
  };

  const handleDelete = (equipmentItem: EquipmentWithAsset) => {
    setSelectedEquipment(equipmentItem);
    setShowDeleteConfirm(true);
  };

  const renderActionsCell = (cellData: { data: EquipmentWithAsset }) => {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/accounting/equipment/${cellData.data.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title="View"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/accounting/equipment/${cellData.data.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
          title="Edit"
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(cellData.data);
          }}
          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Delete"
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
        title={t('page.title')}
        subtitle="Track equipment, maintenance schedules, and MTBF analysis"
        icon={Wrench}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Accounting', href: '/accounting' },
          { label: 'Equipment' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {equipment.length > 0 && (
              <Button
                text="Export JSON"
                icon="export"
                stylingMode="outlined"
                onClick={handleExportJSON}
              />
            )}
            <Button
              text="Add Equipment"
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
                <p className="font-medium text-red-800">Confirm Delete</p>
                <p className="text-sm text-red-600">
                  Are you sure you want to delete equipment &quot;{selectedEquipment.assetName || `ID: ${selectedEquipment.id}`}&quot;?
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text="Cancel"
                  stylingMode="outlined"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedEquipment(null);
                  }}
                />
                <Button
                  text={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
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
          label="Total Equipment"
          value={summary?.totalEquipment || 0}
          icon={Wrench}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
        />
        <StatCard
          label="Available"
          value={summary?.availableEquipment || 0}
          icon={CheckCircle}
          iconColor="text-green-500"
          accentColor="border-green-500"
        />
        <StatCard
          label="In Use"
          value={summary?.unavailableEquipment || 0}
          icon={Activity}
          iconColor="text-yellow-500"
          accentColor="border-yellow-500"
        />
        <StatCard
          label="Overdue"
          value={overdue?.count || 0}
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
        />
        <StatCard
          label="Due (7 days)"
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
              <span className="font-semibold text-lg">Overdue Maintenance Alert</span>
            </div>
            <p className="text-sm text-red-700 ml-11">
              There are <span className="font-bold">{overdue?.count}</span> maintenance tasks that are overdue. Please review and schedule immediately.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Availability</label>
              <SelectBox
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
                text="Clear"
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
            dataSource={equipment}
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

            <Column dataField="assetCode" caption="Asset Code" width={150} />
            <Column dataField="assetName" caption="Asset Name" minWidth={200} />
            <Column dataField="serialNumber" caption="Serial No." width={150} />
            <Column dataField="manufacturer" caption="Manufacturer" width={150} />
            <Column dataField="model" caption="Model" width={130} />
            <Column
              dataField="operatingHours"
              caption="Op. Hours"
              dataType="number"
              format="#,##0"
              width={100}
              alignment="right"
            />
            <Column
              dataField="lastMaintenanceDate"
              caption="Last Maintenance"
              calculateCellValue={(rowData: EquipmentWithAsset) => formatDate(rowData.lastMaintenanceDate)}
              width={140}
            />
            <Column
              dataField="nextMaintenanceDue"
              caption="Next Due"
              calculateCellValue={(rowData: EquipmentWithAsset) => formatDate(rowData.nextMaintenanceDue)}
              width={140}
            />
            <Column
              dataField="isAvailable"
              caption="Status"
              width={110}
              cellRender={({ data }) => (
                <AccountingStatusBadge
                  status={data.isAvailable ? 'active' : 'pending'}
                />
              )}
            />
            <Column
              caption="Actions"
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
                Upcoming Maintenance (Next 7 Days)
              </h3>
            </div>
            <div className="space-y-3">
              {upcoming.slice(0, 5).map((item, index) => (
                <div
                  key={`upcoming-${index}`}
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50/30 rounded-lg border border-blue-100 hover:border-blue-200 transition-colors"
                >
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
                      Due: {formatDate(item.schedule.nextDue)}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      item.daysUntilDue <= 2
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {item.daysUntilDue === 0 ? 'Today' : `${item.daysUntilDue} days`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
