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
  // Localize the expense category name.
  //
  // The translation table is keyed on ENGLISH names ("Raw Materials", "Labor"),
  // but the dashboard service fills categoryName from gl_accounts.name_th — so
  // for a Thai account like "ต้นทุนวัตถุดิบใช้ไป" the lookup misses. The old
  // fallback compared t(key) against the bare key, while next-intl returns the
  // FULL path on a miss ("accounting.dashboard.expenseCategories.<name>"), so
  // the comparison never matched and the raw key was rendered into the legend.
  //
  // Names coming from the GL are already in the user's language, so a miss
  // should simply show the name as-is.
  const localizeCategory = (name: string) => {
    const key = `dashboard.expenseCategories.${name}`;
    try {
      const v = t(key);
      // Treat any result that still looks like the key path as "not translated".
      return v.includes('expenseCategories.') ? name : v;
    } catch {
      return name;
    }
  };

  // Transform data to include index-based access for labels
  const chartData: ChartDataItem[] = data.map((item) => ({
    categoryName: localizeCategory(item.categoryName),
    amount: item.amount,
    percentage: item.percentage,
  }));

  /**
   * On-slice label: percentage only.
   *
   * This used to print "<category> (NN%)" around the pie AND render a <Legend>
   * underneath, so every name appeared twice — and Thai GL account names like
   * "ต้นทุนวัตถุดิบใช้ไป" are long enough that the two labels overlapped each
   * other inside a 250px card. The name belongs in one place; the legend is
   * that place, so the slice keeps just the number.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderLabel = (entry: any) => {
    const pct = entry?.percentage ?? 0;
    // Hide labels for slivers — they collide with their neighbours.
    if (pct < 5) return '';
    return `${pct.toFixed(0)}%`;
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
          // Same height as the loaded chart so the card does not jump.
          <div className="h-[290px] flex items-center justify-center">
            <div className="animate-pulse text-gray-400">Loading...</div>
          </div>
        ) : (
          // 290px, up from 250: the legend now reserves 48px for wrapped Thai
          // category names, which was squeezing the donut.
          <div className="h-[290px]">
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
                {/* Long Thai account names ran off the card and collided with
                    each other on the default single-line legend. Constrain each
                    entry and truncate with the full name on hover. */}
                <Legend
                  verticalAlign="bottom"
                  height={48}
                  iconSize={10}
                  formatter={(value: string) => (
                    <span
                      title={value}
                      className="inline-block max-w-[150px] truncate align-middle text-xs text-gray-700"
                    >
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-2 text-center">
          {/* Was a hardcoded English string sitting on a Thai page. */}
          <p className="text-sm text-gray-500">
            {(() => {
              const v = t('dashboard.totalExpenses');
              return v.includes('totalExpenses') ? 'Total Expenses' : v;
            })()}
          </p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(totalExpenses)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
