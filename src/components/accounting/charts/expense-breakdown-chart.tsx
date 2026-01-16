'use client';

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PieChart as PieChartIcon } from 'lucide-react';
import type { ExpenseCategory } from '@/types/accounting';

interface ChartDataItem {
  categoryName: string;
  amount: number;
  percentage: number;
  [key: string]: string | number;
}

export interface ExpenseBreakdownChartProps {
  data: ExpenseCategory[];
  totalExpenses: number;
  isLoading?: boolean;
  className?: string;
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ExpenseBreakdownChart({ data, totalExpenses, isLoading, className = '' }: ExpenseBreakdownChartProps) {
  // Transform data to include index-based access for labels
  const chartData: ChartDataItem[] = data.map((item) => ({
    categoryName: item.categoryName,
    amount: item.amount,
    percentage: item.percentage,
  }));

  // Custom label renderer for pie chart
  const renderLabel = (props: { payload?: ChartDataItem }) => {
    if (!props.payload) return '';
    return `${props.payload.categoryName} (${props.payload.percentage.toFixed(0)}%)`;
  };

  return (
    <Card className={className} data-testid="expense-breakdown-chart">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <PieChartIcon className="h-5 w-5 text-purple-500" />
          Expense Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[250px] flex items-center justify-center">
            <div className="animate-pulse text-gray-400">Loading...</div>
          </div>
        ) : (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="amount"
                  nameKey="categoryName"
                  label={renderLabel}
                  labelLine={false}
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(value as number)}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-2 text-center">
          <p className="text-sm text-gray-500">Total Expenses</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(totalExpenses)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
