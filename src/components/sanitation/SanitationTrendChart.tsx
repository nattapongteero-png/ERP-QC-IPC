'use client';

/**
 * Sanitation Trend Chart Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * Displays sanitation compliance trends and statistics.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import type { SanitationTrends } from '@/types/sanitation';

interface SanitationTrendChartProps {
  data: SanitationTrends | null;
  loading?: boolean;
}

export function SanitationTrendChart({ data, loading = false }: SanitationTrendChartProps) {
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-64 bg-muted rounded" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No trend data available
      </div>
    );
  }

  const areaLabels: Record<string, string> = {
    production: 'Production',
    warehouse: 'Warehouse',
    lab: 'Laboratory',
    office: 'Office',
  };

  return (
    <div className="space-y-8">
      {/* Overall Compliance */}
      <div className="bg-card border rounded-lg p-6">
        <h3 className="font-semibold mb-4">Overall Compliance</h3>
        <div className="flex items-center justify-center">
          <div
            className={`text-5xl font-bold ${
              data.overallComplianceRate >= 90
                ? 'text-green-600'
                : data.overallComplianceRate >= 70
                  ? 'text-yellow-600'
                  : 'text-red-600'
            }`}
          >
            {data.overallComplianceRate.toFixed(1)}%
          </div>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-2">
          {data.period} compliance rate
        </p>
      </div>

      {/* Compliance by Area */}
      <div className="bg-card border rounded-lg p-6">
        <h3 className="font-semibold mb-4">Compliance by Area</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={data.byArea.map((area) => ({
              ...area,
              name: areaLabels[area.areaType] || area.areaType,
            }))}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 100]} />
            <Tooltip
              formatter={(value: number, name: string) => [
                name === 'complianceRate' ? `${value.toFixed(1)}%` : value,
                name === 'complianceRate'
                  ? 'Compliance Rate'
                  : name === 'completedCount'
                    ? 'Completed'
                    : 'Missed',
              ]}
            />
            <Legend />
            <Bar dataKey="completedCount" fill="#22c55e" name="Completed" />
            <Bar dataKey="missedCount" fill="#ef4444" name="Missed" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pest Control Activity */}
      {data.pestActivityTrend && data.pestActivityTrend.length > 0 && (
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Pest Control Activity</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.pestActivityTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="findingsCount"
                stroke="#f97316"
                name="Pest Findings"
                strokeWidth={2}
                dot={{ fill: '#f97316' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily Trend */}
      {data.dataPoints && data.dataPoints.length > 0 && (
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Daily Compliance Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={data.dataPoints.filter((_, i) => i % Math.ceil(data.dataPoints.length / 30) === 0)}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === 'complianceRate' ? [`${value.toFixed(1)}%`, 'Compliance'] : [value, name]
                }
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="complianceRate"
                stroke="#3b82f6"
                name="Compliance Rate"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
