'use client';

/**
 * Cost Management Dashboard Page
 * Feature: 014-unit-cost (US7 - Executive Dashboard)
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ResponsivePageHeader } from '@/components/shared';
import { CostDashboard } from '@/components/cost/CostDashboard';
import { DollarSign, FileText, Factory, Truck, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import SelectBox from 'devextreme-react/select-box';

const periodOptions = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'ytd', label: 'Year to Date' },
];

export default function CostManagementPage() {
  const router = useRouter();
  const [periodType, setPeriodType] = useState('this_month');

  return (
    <div className="p-6 space-y-6" data-testid="cost-management-page">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <ResponsivePageHeader
          title="Cost Management"
          icon={DollarSign}
          subtitle="Executive dashboard for cost control and margin analysis"
        />

        {/* Period Selector */}
        <div className="flex items-center gap-2" data-testid="period-selector">
          <Calendar className="h-5 w-5 text-gray-500" />
          <SelectBox
            dataSource={periodOptions}
            valueExpr="value"
            displayExpr="label"
            value={periodType}
            onValueChanged={(e) => setPeriodType(e.value)}
            width={180}
            stylingMode="outlined"
          />
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push('/cost/landed-costs')}
          data-testid="quick-link-landed-costs"
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100">
                <Truck className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Landed Costs</p>
                <p className="text-sm text-gray-500">Allocate freight and duties</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push('/cost/work-centers')}
          data-testid="quick-link-work-centers"
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100">
                <Factory className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Work Centers</p>
                <p className="text-sm text-gray-500">Configure labor rates</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push('/cost/reports/cost-summary')}
          data-testid="quick-link-reports"
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-purple-100">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">Cost Reports</p>
                <p className="text-sm text-gray-500">View detailed reports</p>
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
