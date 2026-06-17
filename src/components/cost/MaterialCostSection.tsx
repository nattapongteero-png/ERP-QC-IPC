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
        <CardTitle>วิเคราะห์ต้นทุนวัตถุดิบ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPICard title="ยอดซื้อเดือนนี้" icon={<ShoppingCart className="h-5 w-5 text-blue-600" />} kpi={data.purchasesMTD} format="currency" />
          <KPICard title="ต้นทุนสินค้าถึงคลัง %" icon={<Truck className="h-5 w-5 text-purple-600" />} kpi={data.landedCostPercent} format="percent" />
          <KPICard title="การเปลี่ยนแปลงต้นทุนเฉลี่ย" icon={<TrendingUp className="h-5 w-5 text-red-600" />} kpi={data.avgMaterialCostChange} format="percent" />
          <KPICard title="อัตราหมุนเวียนสินค้า" icon={<RotateCcw className="h-5 w-5 text-green-600" />} kpi={data.inventoryTurnover} format="number" />
          <KPICard title="จำนวนวันสินค้าคงคลัง" icon={<Clock className="h-5 w-5 text-orange-600" />} kpi={data.daysInventoryOutstanding} format="number" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">ต้นทุนที่เพิ่มสูงสุด</CardTitle></CardHeader>
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
              ) : <p className="text-gray-500 text-sm">ไม่มีการเพิ่มที่มีนัยสำคัญ</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">ยอดซื้อตามผู้ขาย</CardTitle></CardHeader>
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
              ) : <p className="text-gray-500 text-sm">ไม่มีข้อมูลการซื้อ</p>}
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

export default MaterialCostSection;
