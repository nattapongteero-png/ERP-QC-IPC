'use client';

/**
 * MaterialCostSection Component - Material Cost Analysis section
 * Feature: 014-unit-cost (Executive Dashboard)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from './KPICard';
import { ShoppingCart, Truck, TrendingUp, RotateCcw, Clock } from 'lucide-react';
import type { MaterialCostKPIs } from '@/types/unit-cost';

interface MaterialCostSectionProps {
  data: MaterialCostKPIs;
}

export function MaterialCostSection({ data }: MaterialCostSectionProps) {
  return (
    <Card data-testid="material-cost-section">
      <CardHeader>
        <CardTitle>Material Cost Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPICard title="Purchases MTD" icon={<ShoppingCart className="h-5 w-5 text-blue-600" />} kpi={data.purchasesMTD} format="currency" />
          <KPICard title="Landed Cost %" icon={<Truck className="h-5 w-5 text-purple-600" />} kpi={data.landedCostPercent} format="percent" />
          <KPICard title="Avg Cost Change" icon={<TrendingUp className="h-5 w-5 text-red-600" />} kpi={data.avgMaterialCostChange} format="percent" />
          <KPICard title="Inv Turnover" icon={<RotateCcw className="h-5 w-5 text-green-600" />} kpi={data.inventoryTurnover} format="number" />
          <KPICard title="Days Inv" icon={<Clock className="h-5 w-5 text-orange-600" />} kpi={data.daysInventoryOutstanding} format="number" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Top Cost Increases</CardTitle></CardHeader>
            <CardContent>
              {data.topCostIncreases.length > 0 ? (
                <div className="space-y-2">
                  {data.topCostIncreases.slice(0, 5).map((item) => (
                    <div key={item.itemId} className="flex justify-between text-sm">
                      <span>{item.itemCode}</span>
                      <span className="text-red-600 font-medium">+{item.changePercent.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-500 text-sm">No significant increases</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Purchases by Supplier</CardTitle></CardHeader>
            <CardContent>
              {data.purchasesBySupplier.length > 0 ? (
                <div className="space-y-2">
                  {data.purchasesBySupplier.slice(0, 5).map((s) => (
                    <div key={s.supplierId} className="flex justify-between text-sm">
                      <span>{s.supplierName}</span>
                      <span className="font-medium">{s.percent}%</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-500 text-sm">No purchase data</p>}
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

export default MaterialCostSection;
