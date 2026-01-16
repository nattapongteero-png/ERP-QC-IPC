'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

interface TrendDataPoint {
  month: string;
  revenue: number;
  cogs: number;
  operatingExpenses: number;
  netIncome: number;
  [key: string]: string | number; // Index signature for recharts compatibility
}

export interface RevenueExpensesTrendProps {
  data: TrendDataPoint[];
  isLoading?: boolean;
  className?: string;
}

function formatCompactCurrency(amount: number): string {
  if (Math.abs(amount) >= 1000000) {
    return `฿${(amount / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1000) {
    return `฿${(amount / 1000).toFixed(0)}K`;
  }
  return `฿${amount.toFixed(0)}`;
}

export function RevenueExpensesTrend({ data, isLoading, className = '' }: RevenueExpensesTrendProps) {
  return (
    <Card className={className} data-testid="revenue-expenses-trend">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-500" />
          Revenue vs Expenses Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse text-gray-400">Loading...</div>
          </div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cogsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="opexGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} tickFormatter={formatCompactCurrency} />
                <Tooltip
                  formatter={(value) => {
                    if (value === undefined || value === null) return '';
                    return formatCompactCurrency(typeof value === 'number' ? value : Number(value));
                  }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="cogs"
                  name="COGS"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#cogsGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="operatingExpenses"
                  name="Operating Expenses"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#opexGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
