'use client';

/**
 * Cost Summary Report Page
 * Feature: 014-unit-cost (US7 - Cost Reports Dashboard)
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  Sorting,
  Summary,
  TotalItem,
} from 'devextreme-react/data-grid';
import { SelectBox } from 'devextreme-react/select-box';
import { TextBox } from 'devextreme-react/text-box';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsivePageHeader } from '@/components/shared';
import { FileText, Loader2 } from 'lucide-react';
import type { ItemCostSummaryRow } from '@/types/unit-cost';

interface ReportResult {
  data: ItemCostSummaryRow[];
  total: number;
}

async function fetchCostSummary(params: {
  itemType?: string;
  search?: string;
  page: number;
  pageSize: number;
}): Promise<ReportResult> {
  const searchParams = new URLSearchParams();
  if (params.itemType) searchParams.append('itemType', params.itemType);
  if (params.search) searchParams.append('search', params.search);
  searchParams.append('page', params.page.toString());
  searchParams.append('pageSize', params.pageSize.toString());

  const res = await fetch(`/api/cost/reports/cost-summary?${searchParams}`);
  if (!res.ok) throw new Error('Failed to fetch cost summary');
  const json = await res.json();
  return json.data;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

const itemTypes = [
  { value: '', label: 'All Types' },
  { value: 'raw_material', label: 'Raw Material' },
  { value: 'finished_goods', label: 'Finished Goods' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'consumable', label: 'Consumable' },
];

export default function CostSummaryReportPage() {
  const [itemType, setItemType] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const { data, isLoading, error } = useQuery({
    queryKey: ['cost-summary-report', itemType, search, page, pageSize],
    queryFn: () => fetchCostSummary({ itemType, search, page, pageSize }),
    staleTime: 30000,
  });

  const items = data?.data || [];
  const total = data?.total || 0;

  return (
    <div className="p-6 space-y-6" data-testid="cost-summary-report-page">
      <ResponsivePageHeader
        title="Cost Summary Report"
        icon={FileText}
        subtitle="View current costs for all inventory items"
        onBack={() => window.history.back()}
      />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item Type
              </label>
              <SelectBox
                dataSource={itemTypes}
                displayExpr="label"
                valueExpr="value"
                value={itemType}
                onValueChanged={(e) => {
                  setItemType(e.value);
                  setPage(1);
                }}
                data-testid="item-type-filter"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <TextBox
                value={search}
                onValueChanged={(e) => {
                  setSearch(e.value || '');
                  setPage(1);
                }}
                placeholder="Search by code or name..."
                showClearButton
                data-testid="search-filter"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Item Cost Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8" data-testid="loading">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading...</span>
            </div>
          ) : error ? (
            <div className="p-4 text-red-500" data-testid="error">
              Failed to load report data
            </div>
          ) : (
            <DataGrid
              dataSource={items}
              showBorders
              columnAutoWidth
              rowAlternationEnabled
              onOptionChanged={(e) => {
                if (e.name === 'paging' && e.fullName === 'paging.pageIndex') {
                  setPage((e.value as number) + 1);
                }
                if (e.name === 'paging' && e.fullName === 'paging.pageSize') {
                  setPageSize(e.value as number);
                  setPage(1);
                }
              }}
              data-testid="cost-summary-grid"
            >
              <FilterRow visible />
              <Sorting mode="single" />

              <Column dataField="itemCode" caption="Code" width={120} />
              <Column dataField="itemName" caption="Name" minWidth={200} />
              <Column dataField="itemType" caption="Type" width={120} />
              <Column dataField="uom" caption="UOM" width={80} />
              <Column
                dataField="onHand"
                caption="On Hand"
                dataType="number"
                width={100}
                format="#,##0"
              />
              <Column
                dataField="currentWAC"
                caption="WAC"
                dataType="number"
                width={120}
                cellRender={({ data }) => (
                  <span className="font-mono">
                    {formatCurrency(data.currentWAC)}
                  </span>
                )}
              />
              <Column
                dataField="onHandValue"
                caption="Value"
                dataType="number"
                width={130}
                cellRender={({ data }) => (
                  <span className="font-mono font-bold">
                    {formatCurrency(data.onHandValue)}
                  </span>
                )}
              />
              <Column
                dataField="standardCost"
                caption="Std Cost"
                dataType="number"
                width={110}
                cellRender={({ data }) => (
                  <span className="font-mono text-gray-500">
                    {formatCurrency(data.standardCost)}
                  </span>
                )}
              />
              <Column
                dataField="lastPurchaseCost"
                caption="Last PO Cost"
                dataType="number"
                width={120}
                cellRender={({ data }) => (
                  <span className="font-mono">
                    {formatCurrency(data.lastPurchaseCost)}
                  </span>
                )}
              />
              <Column
                dataField="fullCost"
                caption="Full Cost"
                dataType="number"
                width={120}
                cellRender={({ data }) => (
                  <span className="font-mono text-blue-600">
                    {formatCurrency(data.fullCost)}
                  </span>
                )}
              />

              <Summary>
                <TotalItem
                  column="onHandValue"
                  summaryType="sum"
                  valueFormat="#,##0.00"
                  displayFormat="Total: {0}"
                />
              </Summary>

              <Paging enabled pageSize={pageSize} pageIndex={page - 1} />
              <Pager
                visible
                showPageSizeSelector
                allowedPageSizes={[20, 50, 100]}
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
