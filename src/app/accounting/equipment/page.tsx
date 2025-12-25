'use client';

// Equipment & Maintenance List Page
// Feature: 010-accounting-module-integration
// User Story 8: Track Equipment and Maintenance Costs

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import DataGrid, { Column, Export, Paging, FilterRow, SearchPanel, MasterDetail } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { Wrench, Clock, AlertTriangle, CheckCircle2, Activity } from 'lucide-react';
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
    <div className="p-4 bg-gray-50">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Maintenance Schedules</h4>
      {schedules.length === 0 ? (
        <p className="text-gray-500 text-sm">No maintenance schedules configured.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {schedules.map((schedule: { id: number; maintenanceType: string; description: string; intervalType: string; intervalValue: number; nextDue: string }) => (
            <div key={schedule.id} className="bg-white rounded border p-3">
              <div className="text-sm font-medium text-gray-800">{schedule.maintenanceType}</div>
              <div className="text-xs text-gray-600">{schedule.description}</div>
              <div className="text-xs text-gray-500 mt-2">
                Every {schedule.intervalValue} {schedule.intervalType}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Next: {formatDate(schedule.nextDue)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EquipmentPage() {
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('');

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

  return (
    <div className="flex flex-col gap-6">
      <ResponsivePageHeader
        title="Equipment & Maintenance"
        subtitle="Track equipment, maintenance schedules, and MTBF analysis"
        icon={Wrench}
        iconColor="text-blue-600"
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard
          label="Total Equipment"
          value={summary?.totalEquipment?.toString() || '-'}
          icon={Wrench}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
        />
        <StatCard
          label="Available"
          value={summary?.availableEquipment?.toString() || '-'}
          icon={CheckCircle2}
          iconColor="text-green-500"
          accentColor="border-green-500"
        />
        <StatCard
          label="In Use"
          value={summary?.unavailableEquipment?.toString() || '-'}
          icon={Activity}
          iconColor="text-yellow-500"
          accentColor="border-yellow-500"
        />
        <StatCard
          label="Overdue"
          value={overdue?.count?.toString() || '0'}
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
        />
        <StatCard
          label="Due (7 days)"
          value={upcoming?.length?.toString() || '0'}
          icon={Clock}
          iconColor="text-orange-500"
          accentColor="border-orange-500"
        />
      </div>

      {/* Overdue Maintenance Alert */}
      {(overdue?.count || 0) > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold">Overdue Maintenance Alert</span>
          </div>
          <p className="text-sm text-red-700 mt-1">
            There are {overdue?.count} maintenance tasks that are overdue. Please review and schedule immediately.
          </p>
        </div>
      )}

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Availability</label>
            <SelectBox
              items={availabilityOptions}
              value={availabilityFilter}
              onValueChanged={(e) => setAvailabilityFilter(e.value)}
              valueExpr="value"
              displayExpr="text"
              width={200}
            />
          </div>
          <Button
            text="Add Equipment"
            type="default"
            stylingMode="contained"
            icon="plus"
            onClick={() => notify('Add Equipment dialog - coming soon', 'info', 3000)}
          />
          <Button
            text="Maintenance Dashboard"
            type="normal"
            stylingMode="outlined"
            onClick={() => notify('Maintenance Dashboard - coming soon', 'info', 3000)}
          />
          <Button
            text="MTBF Analysis"
            type="normal"
            stylingMode="outlined"
            onClick={() => notify('MTBF Analysis - coming soon', 'info', 3000)}
          />
          {equipment.length > 0 && (
            <Button
              text="Export JSON"
              type="normal"
              stylingMode="outlined"
              onClick={handleExportJSON}
            />
          )}
        </div>
      </div>

      {/* Equipment Grid */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Equipment Register
        </h3>
        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Loading equipment...</p>
          </div>
        ) : (
          <DataGrid
            dataSource={equipment}
            showBorders
            columnAutoWidth
            allowColumnResizing
            rowAlternationEnabled
            hoverStateEnabled
          >
            <FilterRow visible />
            <SearchPanel visible width={250} />
            <Paging defaultPageSize={20} />
            <Column dataField="assetCode" caption="Asset Code" width={150} />
            <Column dataField="assetName" caption="Asset Name" />
            <Column dataField="serialNumber" caption="Serial No." width={150} />
            <Column dataField="manufacturer" caption="Manufacturer" />
            <Column dataField="model" caption="Model" />
            <Column
              dataField="operatingHours"
              caption="Op. Hours"
              dataType="number"
              format="#,##0"
              width={100}
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
              width={100}
              cellRender={({ data }) => (
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  data.isAvailable
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {data.isAvailable ? 'Available' : 'In Use'}
                </span>
              )}
            />
            <Export enabled allowExportSelectedData />
            <MasterDetail enabled component={MaintenanceDetailView} />
          </DataGrid>
        )}
      </div>

      {/* Upcoming Maintenance Section */}
      {upcoming.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Upcoming Maintenance (Next 7 Days)
          </h3>
          <div className="space-y-2">
            {upcoming.slice(0, 5).map((item, index) => (
              <div
                key={`upcoming-${index}`}
                className="flex items-center justify-between p-3 bg-blue-50 rounded border border-blue-100"
              >
                <div>
                  <span className="font-medium text-gray-800">
                    {item.schedule.maintenanceType}
                  </span>
                  <span className="text-gray-600 ml-2">
                    - {item.schedule.description}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    Due: {formatDate(item.schedule.nextDue)}
                  </span>
                  <span className={`text-sm font-medium ${
                    item.daysUntilDue <= 2 ? 'text-orange-600' : 'text-blue-600'
                  }`}>
                    {item.daysUntilDue === 0 ? 'Today' : `${item.daysUntilDue} days`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
