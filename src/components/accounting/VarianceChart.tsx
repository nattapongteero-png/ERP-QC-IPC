/**
 * Variance Chart Component (T147)
 * Visual representation of manufacturing variances
 * Part of 011-accounting-spec-gap - User Story 6
 */

'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import type { VarianceType } from '@/types/variance';

interface VarianceChartData {
  varianceType: VarianceType;
  varianceTypeName: string;
  amount: number;
  isFavorable: boolean;
}

interface VarianceChartProps {
  data: VarianceChartData[];
  title?: string;
  height?: number;
}

export function VarianceChart({ data, title, height = 300 }: VarianceChartProps) {
  const formattedData = data.map((item) => ({
    ...item,
    name: item.varianceTypeName,
    value: item.amount,
    fill: item.isFavorable ? '#22c55e' : '#ef4444', // green for favorable, red for unfavorable
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4" data-testid="variance-chart">
      {title && <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={formattedData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={formatCurrency} />
          <YAxis type="category" dataKey="name" width={100} />
          <Tooltip
            formatter={(value) => [formatCurrency(value as number), 'Amount']}
            labelStyle={{ fontWeight: 'bold' }}
          />
          <Legend />
          <ReferenceLine x={0} stroke="#000" strokeWidth={2} />
          <Bar dataKey="value" name="Variance Amount" barSize={30}>
            {formattedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 flex justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500"></div>
          <span className="text-gray-600">Favorable (Savings)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500"></div>
          <span className="text-gray-600">Unfavorable (Over Cost)</span>
        </div>
      </div>
    </div>
  );
}
