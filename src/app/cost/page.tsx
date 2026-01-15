'use client';

/**
 * Cost Management Dashboard Page
 * Feature: 014-unit-cost (US7 - Cost Reports Dashboard)
 */

import { useRouter } from 'next/navigation';
import { ResponsivePageHeader } from '@/components/shared';
import { CostDashboard } from '@/components/cost/CostDashboard';
import { DollarSign, FileText, Factory, Truck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function CostManagementPage() {
  const router = useRouter();

  return (
    <div className="p-6 space-y-6" data-testid="cost-management-page">
      <ResponsivePageHeader
        title="Cost Management"
        icon={DollarSign}
        subtitle="Monitor costs, margins, and variances across your operations"
      />

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push('/cost/landed-costs')}
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
      <CostDashboard />
    </div>
  );
}
