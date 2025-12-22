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
  const { data: distribution = [], isLoading } = useQuery({
    queryKey: ['recall-distribution', recallId],
    queryFn: () => fetchDistribution(recallId),
  });

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
            <span className="text-sm">Customers Affected</span>
          </div>
          <div className="text-2xl font-bold">{uniqueCustomers}</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Package className="h-4 w-4" />
            <span className="text-sm">Total Distributed</span>
          </div>
          <div className="text-2xl font-bold">{totalQuantity.toLocaleString()}</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Shipments</span>
          </div>
          <div className="text-2xl font-bold">{distribution.length}</div>
        </div>
      </div>

      {/* Distribution Table */}
      <DxDataGrid
        dataSource={distribution}
        showBorders
        rowAlternationEnabled
        loading={isLoading}
      >
        <DxPaging defaultPageSize={10} />

        <DxColumn dataField="customerName" caption="Customer" minWidth={150} />
        <DxColumn dataField="contactInfo" caption="Contact" width={150} />
        <DxColumn dataField="lotNumber" caption="Lot #" width={120} />
        <DxColumn
          dataField="quantityDistributed"
          caption="Quantity"
          width={100}
          dataType="number"
          format="#,##0"
        />
        <DxColumn dataField="shipDate" caption="Ship Date" dataType="date" width={110} />

        <DxSummary>
          <DxTotalItem
            column="quantityDistributed"
            summaryType="sum"
            valueFormat="#,##0"
            displayFormat="Total: {0}"
          />
        </DxSummary>
      </DxDataGrid>
    </div>
  );
}
