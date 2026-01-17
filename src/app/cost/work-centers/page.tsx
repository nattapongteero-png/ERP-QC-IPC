'use client';

/**
 * Work Centers List Page
 * Feature: 014-unit-cost (US6 - Work Center Configuration)
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  Sorting,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import notify from 'devextreme/ui/notify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsivePageHeader } from '@/components/shared';
import { Factory, CheckCircle, XCircle, DollarSign } from 'lucide-react';
import type { WorkCenter } from '@/types/unit-cost';

interface ListResult {
  data: WorkCenter[];
  total: number;
  page: number;
  pageSize: number;
}

async function fetchWorkCenters(page: number, pageSize: number, isActive?: boolean): Promise<ListResult> {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('pageSize', pageSize.toString());
  if (isActive !== undefined) params.append('isActive', isActive.toString());

  const res = await fetch(`/api/cost/work-centers?${params}`);
  if (!res.ok) throw new Error('Failed to fetch work centers');
  const json = await res.json();
  return json.data;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function WorkCentersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, error, isLoading } = useQuery({
    queryKey: ['work-centers', page, pageSize],
    queryFn: () => fetchWorkCenters(page, pageSize),
    staleTime: 30000,
  });

  const workCenters = data?.data || [];
  const total = data?.total || 0;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/cost/work-centers/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to delete work center');
      }
      return res.json();
    },
    onSuccess: () => {
      notify('Work center deleted successfully', 'success', 3000);
      queryClient.invalidateQueries({ queryKey: ['work-centers'] });
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleRowClick = (e: { data: WorkCenter }) => {
    router.push(`/cost/work-centers/${e.data.id}`);
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this work center?')) {
      deleteMutation.mutate(id);
    }
  };

  // Calculate stats
  const activeCount = workCenters.filter((wc) => wc.isActive).length;
  const inactiveCount = workCenters.filter((wc) => !wc.isActive).length;
  const avgTotalRate = workCenters.length > 0
    ? workCenters.reduce((sum, wc) => sum + wc.laborRatePerHour + wc.overheadRatePerHour + wc.machineRatePerHour, 0) / workCenters.length
    : 0;

  return (
    <div className="p-6 space-y-6" data-testid="work-centers-page">
      <ResponsivePageHeader
        title="Work Centers"
        icon={Factory}
        subtitle="Configure production work centers with labor and overhead rates"
        actions={
          <Button
            text="New Work Center"
            icon="plus"
            type="default"
            onClick={() => router.push('/cost/work-centers/new')}
            data-testid="new-work-center-btn"
          />
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-2xl font-bold" data-testid="active-count">
                  {activeCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-gray-100">
                <XCircle className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Inactive</p>
                <p className="text-2xl font-bold" data-testid="inactive-count">
                  {inactiveCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Avg Total Rate/hr</p>
                <p className="text-2xl font-bold" data-testid="avg-rate">
                  {formatCurrency(avgTotalRate)} THB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Work Center List</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="p-4 text-red-500" data-testid="error-message">
              Failed to load work centers
            </div>
          ) : isLoading ? (
            <div className="p-4 text-gray-500" data-testid="loading-message">
              Loading work centers...
            </div>
          ) : (
            <DataGrid
              dataSource={workCenters}
              showBorders
              columnAutoWidth
              rowAlternationEnabled
              onRowClick={handleRowClick}
              hoverStateEnabled
              onOptionChanged={(e) => {
                if (e.name === 'paging' && e.fullName === 'paging.pageIndex') {
                  setPage((e.value as number) + 1);
                }
                if (e.name === 'paging' && e.fullName === 'paging.pageSize') {
                  setPageSize(e.value as number);
                  setPage(1);
                }
              }}
              data-testid="work-centers-grid"
            >
              <FilterRow visible />
              <Sorting mode="single" />

              <Column
                dataField="code"
                caption="Code"
                width={120}
              />
              <Column
                dataField="name"
                caption="Name"
                minWidth={200}
              />
              <Column
                dataField="orgUnitName"
                caption="Org Unit"
                width={150}
              />
              <Column
                dataField="laborRatePerHour"
                caption="Labor Rate"
                dataType="number"
                width={120}
                cellRender={({ data }) => (
                  <span className="font-mono">
                    {formatCurrency(data.laborRatePerHour)}
                  </span>
                )}
              />
              <Column
                dataField="overheadRatePerHour"
                caption="Overhead Rate"
                dataType="number"
                width={130}
                cellRender={({ data }) => (
                  <span className="font-mono">
                    {formatCurrency(data.overheadRatePerHour)}
                  </span>
                )}
              />
              <Column
                dataField="machineRatePerHour"
                caption="Machine Rate"
                dataType="number"
                width={130}
                cellRender={({ data }) => (
                  <span className="font-mono">
                    {formatCurrency(data.machineRatePerHour)}
                  </span>
                )}
              />
              <Column
                caption="Total Rate"
                width={130}
                calculateCellValue={(data: WorkCenter) =>
                  data.laborRatePerHour + data.overheadRatePerHour + data.machineRatePerHour
                }
                cellRender={({ data }) => (
                  <span className="font-mono font-bold text-blue-600">
                    {formatCurrency(data.laborRatePerHour + data.overheadRatePerHour + data.machineRatePerHour)}
                  </span>
                )}
              />
              <Column
                dataField="capacityHoursPerDay"
                caption="Capacity (hrs/day)"
                dataType="number"
                width={140}
                cellRender={({ data }) => (
                  <span>
                    {data.capacityHoursPerDay !== null ? data.capacityHoursPerDay : '-'}
                  </span>
                )}
              />
              <Column
                dataField="isActive"
                caption="Status"
                width={100}
                cellRender={({ data }) => (
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      data.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {data.isActive ? 'Active' : 'Inactive'}
                  </span>
                )}
              />
              <Column
                caption="Actions"
                width={80}
                cellRender={({ data }) => (
                  <Button
                    icon="trash"
                    stylingMode="text"
                    type="danger"
                    hint="Delete"
                    onClick={(e) => handleDelete(e.event as unknown as React.MouseEvent, data.id)}
                    data-testid={`delete-btn-${data.id}`}
                  />
                )}
              />

              <Paging enabled pageSize={pageSize} pageIndex={page - 1} />
              <Pager
                visible
                showPageSizeSelector
                allowedPageSizes={[10, 20, 50]}
                showInfo
                infoText={`Showing {0}-{1} of ${total}`}
              />
            </DataGrid>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
