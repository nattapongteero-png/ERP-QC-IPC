'use client';

/**
 * MaterialCostSection Component - Material Cost Analysis section
 * Feature: 014-unit-cost (Executive Dashboard)
 */

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from './KPICard';
import { ShoppingCart, Truck, TrendingUp, RotateCcw, Clock } from 'lucide-react';
import type { MaterialCostKPIs } from '@/types/unit-cost';

interface MaterialCostSectionProps {
  data: MaterialCostKPIs;
}

export function MaterialCostSection({ data }: MaterialCostSectionProps) {
  const t = useTranslations('cost');
  return (
    <Card data-testid="material-cost-section">
      <CardHeader>
        <CardTitle>{t('executiveDashboard.material.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPICard title={t('executiveDashboard.material.purchasesMTD')} icon={<ShoppingCart className="h-5 w-5 text-blue-600" />} kpi={data.purchasesMTD} format="currency" />
          <KPICard title={t('executiveDashboard.material.landedCostPercent')} icon={<Truck className="h-5 w-5 text-purple-600" />} kpi={data.landedCostPercent} format="percent" />
          <KPICard title={t('executiveDashboard.material.avgCostChange')} icon={<TrendingUp className="h-5 w-5 text-red-600" />} kpi={data.avgMaterialCostChange} format="percent" />
          <KPICard title={t('executiveDashboard.material.inventoryTurnover')} icon={<RotateCcw className="h-5 w-5 text-green-600" />} kpi={data.inventoryTurnover} format="number" />
          <KPICard title={t('executiveDashboard.material.daysInventory')} icon={<Clock className="h-5 w-5 text-orange-600" />} kpi={data.daysInventoryOutstanding} format="number" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">{t('executiveDashboard.material.topCostIncreases')}</CardTitle></CardHeader>
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
              ) : <p className="text-gray-500 text-sm">{t('executiveDashboard.material.noCostIncreases')}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">{t('executiveDashboard.material.purchasesBySupplier')}</CardTitle></CardHeader>
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
              ) : <p className="text-gray-500 text-sm">{t('executiveDashboard.material.noPurchases')}</p>}
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

export default MaterialCostSection;
