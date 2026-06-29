'use client';

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('accounting');
  // Localize the expense category name (the data carries the English GL-category
  // name); fall back to the raw name if no translation key exists.
  const localizeCategory = (name: string) => {
    const key = `dashboard.expenseCategories.${name}`;
    const v = t(key);
    return v === key ? name : v;
  };

  // Transform data to include index-based access for labels
  const chartData: ChartDataItem[] = data.map((item) => ({
    categoryName: localizeCategory(item.categoryName),
    amount: item.amount,
    percentage: item.percentage,
  }));

  // Custom label renderer for pie chart - use any to avoid recharts strict typing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderLabel = (entry: any) => {
    if (!entry || !entry.categoryName) return '';
    return `${entry.categoryName} (${entry.percentage?.toFixed(0) ?? 0}%)`;
  };

  return (
    <Card className={className} data-testid="expense-breakdown-chart">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <PieChartIcon className="h-5 w-5 text-purple-500" />
          {(() => { const v = t('dashboard.expenseBreakdown'); return v === 'dashboard.expenseBreakdown' ? 'Expense Breakdown' : v; })()}
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
                  data={chartData as unknown as Array<Record<string, unknown>>}
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
                  formatter={(value) => {
                    if (value === undefined || value === null) return '';
                    return formatCurrency(typeof value === 'number' ? value : Number(value));
                  }}
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
