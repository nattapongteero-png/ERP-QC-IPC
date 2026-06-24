'use client';

/**
 * ProductionCostSection Component - Production Cost Analysis section
 * Feature: 014-unit-cost (Executive Dashboard)
 */

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from './KPICard';
import { Factory, Hammer, Users, Settings, DollarSign, AlertCircle } from 'lucide-react';
import type { ProductionCostKPIs } from '@/types/unit-cost';

interface ProductionCostSectionProps {
  data: ProductionCostKPIs;
}

export function ProductionCostSection({ data }: ProductionCostSectionProps) {
  const t = useTranslations('cost');
  const total = data.costBreakdown.material + data.costBreakdown.labor + data.costBreakdown.overhead;
  const materialPct = total > 0 ? (data.costBreakdown.material / total * 100).toFixed(0) : 0;
  const laborPct = total > 0 ? (data.costBreakdown.labor / total * 100).toFixed(0) : 0;
  const overheadPct = total > 0 ? (data.costBreakdown.overhead / total * 100).toFixed(0) : 0;

  return (
    <Card data-testid="production-cost-section">
      <CardHeader>
        <CardTitle>{t('executiveDashboard.production.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard title={t('executiveDashboard.production.wipValue')} icon={<Factory className="h-5 w-5 text-blue-600" />} kpi={data.wipValue} format="currency" />
          <KPICard title={t('executiveDashboard.production.productionCostMTD')} icon={<Hammer className="h-5 w-5 text-purple-600" />} kpi={data.productionCostMTD} format="currency" />
          <KPICard title={t('executiveDashboard.production.laborEfficiency')} icon={<Users className="h-5 w-5 text-green-600" />} kpi={data.laborEfficiency} format="percent" />
          <KPICard title={t('executiveDashboard.production.overheadAbsorption')} icon={<Settings className="h-5 w-5 text-orange-600" />} kpi={data.overheadAbsorption} format="percent" />
          <KPICard title={t('executiveDashboard.production.avgUnitCost')} icon={<DollarSign className="h-5 w-5 text-teal-600" />} kpi={data.avgUnitCost} format="currency" />
          <KPICard title={t('executiveDashboard.production.variance')} icon={<AlertCircle className="h-5 w-5 text-red-600" />} kpi={data.productionVariance} format="currency" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">{t('executiveDashboard.production.costBreakdown')}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{t('executiveDashboard.production.material')}</span>
                    <span>{materialPct}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${materialPct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{t('executiveDashboard.production.labor')}</span>
                    <span>{laborPct}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div className="h-2 bg-green-500 rounded-full" style={{ width: `${laborPct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{t('executiveDashboard.production.overhead')}</span>
                    <span>{overheadPct}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div className="h-2 bg-orange-500 rounded-full" style={{ width: `${overheadPct}%` }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">{t('executiveDashboard.production.byWorkCenter')}</CardTitle></CardHeader>
            <CardContent>
              {data.byWorkCenter.length > 0 ? (
                <div className="space-y-2">
                  {data.byWorkCenter.slice(0, 5).map((wc) => (
                    <div key={wc.workCenterId} className="flex justify-between text-sm">
                      <span>{wc.workCenterName}</span>
                      <span className={wc.efficiency >= 90 ? 'text-green-600' : 'text-red-600'}>{wc.efficiency}%</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-500 text-sm">{t('executiveDashboard.production.noWorkCenterData')}</p>}
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

export default ProductionCostSection;
