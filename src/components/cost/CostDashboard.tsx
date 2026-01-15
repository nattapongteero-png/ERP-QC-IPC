'use client';

/**
 * Cost Dashboard Component
 * Feature: 014-unit-cost (US7 - Cost Reports Dashboard)
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Package,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Loader2,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { CostDashboardKPIs, ItemCostChange } from '@/types/unit-cost';

interface CostDashboardProps {
  className?: string;
}

async function fetchDashboardKPIs(): Promise<CostDashboardKPIs> {
  const res = await fetch('/api/cost/dashboard');
  if (!res.ok) throw new Error('Failed to fetch dashboard KPIs');
  const json = await res.json();
  return json.data;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return `${value.toFixed(1)}%`;
}

export function CostDashboard({ className = '' }: CostDashboardProps) {
  const { data: kpis, isLoading, error } = useQuery({
    queryKey: ['cost-dashboard-kpis'],
    queryFn: fetchDashboardKPIs,
    staleTime: 60000, // 1 minute
  });

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`} data-testid="cost-dashboard-loading">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 text-red-500 ${className}`} data-testid="cost-dashboard-error">
        Failed to load dashboard data
      </div>
    );
  }

  if (!kpis) {
    return null;
  }

  return (
    <div className={`space-y-6 ${className}`} data-testid="cost-dashboard">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="inventory-value-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Inventory Value</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(kpis.inventoryValue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="wip-value-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-orange-100">
                <DollarSign className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">WIP Value</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(kpis.wipValue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="gross-margin-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Gross Margin</p>
                <p className="text-2xl font-bold">
                  {formatPercent(kpis.grossMarginPercent)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="variance-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-100">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Cost Variances</p>
                <div className="flex gap-2 text-sm">
                  <span className="text-green-600">
                    +{formatCurrency(kpis.favorableVariance)}
                  </span>
                  <span className="text-red-600">
                    -{formatCurrency(kpis.unfavorableVariance)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Trend Chart */}
        <Card data-testid="cost-trend-card">
          <CardHeader>
            <CardTitle>Cost Trend (6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            {kpis.costTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={kpis.costTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => formatCurrency(value as number)}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgMaterialCost"
                    stroke="#3b82f6"
                    name="Avg Material Cost"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Cost Increases */}
        <Card data-testid="cost-increases-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-red-500" />
              Top Cost Increases
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kpis.topCostIncreases.length > 0 ? (
              <div className="space-y-4">
                {kpis.topCostIncreases.map((item: ItemCostChange) => (
                  <div
                    key={item.itemId}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">{item.itemCode}</p>
                      <p className="text-sm text-gray-500">{item.itemName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-red-600 font-bold">
                        +{item.changePercent.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(item.previousCost)} → {formatCurrency(item.currentCost)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-gray-500">
                No significant cost increases
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default CostDashboard;
