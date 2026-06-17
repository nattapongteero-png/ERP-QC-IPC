'use client';

/**
 * Cost Layer History Component
 * Displays a paginated table of cost layers (transaction history) for an item
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import DataGrid, { Column, Paging, Pager, Sorting } from 'devextreme-react/data-grid';
import type { ItemCostLayer, CostLayerTransactionType } from '@/types/unit-cost';

interface CostLayerHistoryProps {
  itemId: number;
  className?: string;
}

interface CostLayerListResult {
  data: ItemCostLayer[];
  total: number;
  page: number;
  pageSize: number;
}

const transactionTypeLabels: Record<CostLayerTransactionType, string> = {
  receipt: 'รับเข้า',
  landed_cost: 'ต้นทุนนำเข้า',
  adjustment: 'ปรับปรุง',
  return: 'คืน',
};

const transactionTypeColors: Record<CostLayerTransactionType, string> = {
  receipt: 'bg-green-100 text-green-800',
  landed_cost: 'bg-blue-100 text-blue-800',
  adjustment: 'bg-yellow-100 text-yellow-800',
  return: 'bg-red-100 text-red-800',
};

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function CostLayerHistory({ itemId, className = '' }: CostLayerHistoryProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading, error } = useQuery<CostLayerListResult>({
    queryKey: ['item-cost-layers', itemId, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      const res = await fetch(`/api/cost/items/${itemId}/cost-layers?${params}`);
      if (!res.ok) throw new Error('Failed to fetch cost layers');
      return res.json();
    },
    enabled: !!itemId,
    staleTime: 30000, // 30 seconds
  });

  if (isLoading) {
    return (
      <div className={`p-4 bg-white rounded-lg shadow ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-white rounded-lg shadow ${className}`}>
        <div className="text-red-500">ไม่สามารถโหลดประวัติชั้นต้นทุนได้</div>
      </div>
    );
  }

  const costLayers = data?.data || [];
  const totalItems = data?.total || 0;

  return (
    <div className={`p-4 bg-white rounded-lg shadow ${className}`} data-testid="cost-layer-history">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">ประวัติชั้นต้นทุน</h3>

      <DataGrid
        dataSource={costLayers}
        showBorders={true}
        columnAutoWidth={true}
        rowAlternationEnabled={true}
        onOptionChanged={(e) => {
          if (e.name === 'paging' && e.fullName === 'paging.pageIndex') {
            setPage((e.value as number) + 1);
          }
          if (e.name === 'paging' && e.fullName === 'paging.pageSize') {
            setPageSize(e.value as number);
            setPage(1);
          }
        }}
      >
        <Sorting mode="single" />

        <Column
          dataField="transactionDate"
          caption="วันที่"
          dataType="date"
          width={100}
          cellRender={({ data }) => formatDate(data.transactionDate)}
        />
        <Column
          dataField="transactionType"
          caption="ประเภท"
          width={120}
          cellRender={({ data }) => {
            const type = data.transactionType as CostLayerTransactionType;
            return (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${transactionTypeColors[type]}`}>
                {transactionTypeLabels[type]}
              </span>
            );
          }}
        />
        <Column
          dataField="quantityIn"
          caption="ปริมาณ"
          dataType="number"
          width={80}
          cellRender={({ data }) => (
            <span className={data.quantityIn >= 0 ? 'text-green-700' : 'text-red-700'}>
              {data.quantityIn >= 0 ? '+' : ''}{data.quantityIn?.toLocaleString()}
            </span>
          )}
        />
        <Column
          dataField="unitCost"
          caption="ต้นทุนต่อหน่วย"
          dataType="number"
          width={120}
          cellRender={({ data }) => formatCurrency(data.unitCost)}
        />
        <Column
          dataField="totalCost"
          caption="ต้นทุนรวม"
          dataType="number"
          width={120}
          cellRender={({ data }) => formatCurrency(data.totalCost)}
        />
        <Column
          dataField="runningQty"
          caption="ปริมาณสะสม"
          dataType="number"
          width={100}
          cellRender={({ data }) => data.runningQty?.toLocaleString()}
        />
        <Column
          dataField="runningWAC"
          caption="ต้นทุนเฉลี่ยถ่วงน้ำหนัก"
          dataType="number"
          width={120}
          cellRender={({ data }) => formatCurrency(data.runningWAC)}
        />
        <Column
          dataField="notes"
          caption="หมายเหตุ"
          minWidth={150}
        />

        <Paging
          enabled={true}
          pageSize={pageSize}
          pageIndex={page - 1}
        />
        <Pager
          visible={true}
          showPageSizeSelector={true}
          allowedPageSizes={[10, 20, 50]}
          showInfo={true}
          infoText={`แสดง {0}-{1} จาก ${totalItems}`}
        />
      </DataGrid>
    </div>
  );
}

export default CostLayerHistory;
