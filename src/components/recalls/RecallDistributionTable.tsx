'use client';

/**
 * Recall Distribution Table Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Shows distribution data for affected lots - identifies customers who received the product.
 */

import { useQuery } from '@tanstack/react-query';
import { DxDataGrid, DxColumn, DxPaging, DxSummary, DxTotalItem } from '@/components/ui/dx-data-grid';
import { Package, Users, TrendingUp } from 'lucide-react';
import type { DistributionRecord } from '@/types/recalls';

interface RecallDistributionTableProps {
  recallId: number;
}

async function fetchDistribution(recallId: number): Promise<DistributionRecord[]> {
  const response = await fetch(`/api/recalls/${recallId}/distribution`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

export function RecallDistributionTable({ recallId }: RecallDistributionTableProps) {
  const { data: rawDistribution = [], isLoading } = useQuery({
    queryKey: ['recall-distribution', recallId],
    queryFn: () => fetchDistribution(recallId),
  });

  // Add a synthetic `id` (the grid needs a key, and a customer may appear for
  // several lots) and coerce the MySQL string decimal to a number.
  const distribution = rawDistribution.map((d) => ({
    ...d,
    id: `${d.customerId}-${d.lotId}`,
    quantityDistributed: Number(d.quantityDistributed) || 0,
  }));

  // Calculate summary stats
  const totalQuantity = distribution.reduce((sum, d) => sum + d.quantityDistributed, 0);
  const uniqueCustomers = new Set(distribution.map((d) => d.customerId)).size;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            <span className="text-sm">ลูกค้าที่ได้รับผลกระทบ</span>
          </div>
          <div className="text-2xl font-bold">{uniqueCustomers}</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Package className="h-4 w-4" />
            <span className="text-sm">กระจายทั้งหมด</span>
          </div>
          <div className="text-2xl font-bold">{totalQuantity.toLocaleString()}</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">การจัดส่ง</span>
          </div>
          <div className="text-2xl font-bold">{distribution.length}</div>
        </div>
      </div>

      {/* Distribution Table */}
      <DxDataGrid
        dataSource={distribution}
        keyExpr="id"
        showBorders
        rowAlternationEnabled
        loading={isLoading}
      >
        <DxPaging defaultPageSize={10} />

        <DxColumn dataField="customerName" caption="ลูกค้า" minWidth={150} />
        <DxColumn dataField="contactInfo" caption="ข้อมูลติดต่อ" width={150} />
        <DxColumn dataField="lotNumber" caption="เลขที่ล็อต" width={120} />
        <DxColumn
          dataField="quantityDistributed"
          caption="จำนวน"
          width={100}
          dataType="number"
          format="#,##0"
        />
        <DxColumn dataField="shipDate" caption="วันที่จัดส่ง" dataType="date" width={110} />

        <DxSummary>
          <DxTotalItem
            column="quantityDistributed"
            summaryType="sum"
            valueFormat="#,##0"
            displayFormat="รวม: {0}"
          />
        </DxSummary>
      </DxDataGrid>
    </div>
  );
}
