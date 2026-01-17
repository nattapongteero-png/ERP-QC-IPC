'use client';

/**
 * MarginAnalysisSection Component - Margin Analysis section
 * Feature: 014-unit-cost (Executive Dashboard)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from './KPICard';
import { Banknote, TrendingUp, TrendingDown, Award } from 'lucide-react';
import type { MarginKPIs } from '@/types/unit-cost';

interface MarginAnalysisSectionProps {
  data: MarginKPIs;
}

export function MarginAnalysisSection({ data }: MarginAnalysisSectionProps) {
  return (
    <Card data-testid="margin-analysis-section">
      <CardHeader>
        <CardTitle>Margin Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KPICard title="Revenue MTD" icon={<Banknote className="h-5 w-5 text-green-600" />} kpi={data.revenueMTD} format="currency" />
          <KPICard title="Gross Profit MTD" icon={<TrendingUp className="h-5 w-5 text-blue-600" />} kpi={data.grossProfitMTD} format="currency" />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">Margin by Category</CardTitle></CardHeader>
          <CardContent>
            {data.marginByCategory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Category</th>
                      <th className="text-right py-2">Revenue</th>
                      <th className="text-right py-2">COGS</th>
                      <th className="text-right py-2">Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.marginByCategory.map((cat) => (
                      <tr key={cat.category} className="border-b">
                        <td className="py-2">{cat.category}</td>
                        <td className="text-right">{new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(cat.revenue)}</td>
                        <td className="text-right">{new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(cat.cogs)}</td>
                        <td className={`text-right font-medium ${cat.marginPercent >= 30 ? 'text-green-600' : 'text-red-600'}`}>{cat.marginPercent.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-gray-500 text-sm">No category data</p>}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Margin Erosion
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.marginErosion.length > 0 ? (
                <div className="space-y-2">
                  {data.marginErosion.slice(0, 5).map((item) => (
                    <div key={item.itemId} className="flex justify-between text-sm">
                      <span>{item.itemCode}</span>
                      <span className="text-red-600 font-medium">{item.changePercent.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-500 text-sm">No margin erosion</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Award className="h-4 w-4 text-green-500" />
                Top Margin Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.topMarginProducts.length > 0 ? (
                <div className="space-y-2">
                  {data.topMarginProducts.slice(0, 5).map((item) => (
                    <div key={item.itemId} className="flex justify-between text-sm">
                      <span>{item.itemCode}</span>
                      <span className="text-green-600 font-medium">{item.marginPercent.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-500 text-sm">No product data</p>}
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

export default MarginAnalysisSection;
