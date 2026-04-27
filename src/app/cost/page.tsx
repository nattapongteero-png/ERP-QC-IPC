'use client';

/**
 * Cost Management Dashboard Page
 * Feature: 014-unit-cost (US7 - Executive Dashboard)
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import { CostDashboard } from '@/components/cost/CostDashboard';
import { DollarSign, FileText, Factory, Truck, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import SelectBox from 'devextreme-react/select-box';

export default function CostManagementPage() {
  const router = useRouter();
  const t = useTranslations('cost');
  const [periodType, setPeriodType] = useState('this_month');

  const periodOptions = [
    { value: 'this_month', label: t('dashboard.periodOptions.this_month') },
    { value: 'last_month', label: t('dashboard.periodOptions.last_month') },
    { value: 'this_quarter', label: t('dashboard.periodOptions.this_quarter') },
    { value: 'last_quarter', label: t('dashboard.periodOptions.last_quarter') },
    { value: 'ytd', label: t('dashboard.periodOptions.ytd') },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" data-testid="cost-management-page">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <ResponsivePageHeader
          title={t('dashboard.title')}
          icon={DollarSign}
          iconBgColor="bg-cyan-100"
          iconColor="text-cyan-600"
          subtitle={t('dashboard.subtitle')}
        />

        {/* Period Selector */}
        <div
          className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm w-full md:w-auto"
          data-testid="period-selector"
        >
          <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0" />
          <SelectBox
            dataSource={periodOptions}
            valueExpr="value"
            displayExpr="label"
            value={periodType}
            onValueChanged={(e) => setPeriodType(e.value)}
            stylingMode="underlined"
            className="flex-1"
          />
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <Card
          className="cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all border-l-4 border-l-blue-500"
          onClick={() => router.push('/cost/landed-costs')}
          data-testid="quick-link-landed-costs"
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100">
                <Truck className="h-6 w-6 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{t('dashboard.quickLinks.landedCosts.title')}</p>
                <p className="text-sm text-gray-500 truncate">{t('dashboard.quickLinks.landedCosts.description')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all border-l-4 border-l-emerald-500"
          onClick={() => router.push('/cost/work-centers')}
          data-testid="quick-link-work-centers"
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-emerald-100">
                <Factory className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{t('dashboard.quickLinks.workCenters.title')}</p>
                <p className="text-sm text-gray-500 truncate">{t('dashboard.quickLinks.workCenters.description')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all border-l-4 border-l-violet-500"
          onClick={() => router.push('/cost/reports/cost-summary')}
          data-testid="quick-link-reports"
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-violet-100">
                <FileText className="h-6 w-6 text-violet-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{t('dashboard.quickLinks.reports.title')}</p>
                <p className="text-sm text-gray-500 truncate">{t('dashboard.quickLinks.reports.description')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard */}
      <CostDashboard periodType={periodType} />
    </div>
  );
}
