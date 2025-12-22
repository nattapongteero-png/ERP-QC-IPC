'use client';

/**
 * Stability Trend Chart Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * Displays trend data for stability parameters with projections.
 */

import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import type { TrendParameter, StudyTrendData } from '@/types/stability';

interface StabilityTrendChartProps {
  data: StudyTrendData | null;
  loading?: boolean;
}

export function StabilityTrendChart({ data, loading = false }: StabilityTrendChartProps) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/4" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  if (!data || data.parameters.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No trend data available</p>
        <p className="text-sm">Trend data will appear after test results are recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Projections Summary */}
      {data.projections.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-4">
          <h3 className="font-semibold mb-3">12-Month Projections</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.projections.map((proj) => (
              <div
                key={proj.parameter}
                className={`p-3 rounded-lg border ${
                  proj.withinSpec
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{proj.parameter}</span>
                  {proj.withinSpec ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div className="text-lg font-bold mt-1">
                  {proj.projectedValue.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  at {proj.atMonth} months
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parameter Trends */}
      <div className="space-y-4">
        {data.parameters.map((param) => (
          <ParameterTrendCard key={param.parameter} parameter={param} />
        ))}
      </div>
    </div>
  );
}

interface ParameterTrendCardProps {
  parameter: TrendParameter;
}

function ParameterTrendCard({ parameter }: ParameterTrendCardProps) {
  const isIncreasing = parameter.trendSlope > 0;
  const hasProjectedFailure = parameter.projectedFailureMonth !== null;

  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="font-semibold">{parameter.parameter}</h4>
          {parameter.unit && (
            <p className="text-sm text-muted-foreground">Unit: {parameter.unit}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isIncreasing ? (
            <TrendingUp className="h-5 w-5 text-yellow-600" />
          ) : (
            <TrendingDown className="h-5 w-5 text-green-600" />
          )}
          <span className="text-sm font-medium">
            {parameter.trendSlope > 0 ? '+' : ''}
            {parameter.trendSlope.toFixed(4)}/month
          </span>
        </div>
      </div>

      {/* Specification Limits */}
      {(parameter.specification.min !== undefined ||
        parameter.specification.max !== undefined) && (
        <div className="mb-4 p-2 bg-muted rounded text-sm">
          <span className="text-muted-foreground">Specification: </span>
          {parameter.specification.min !== undefined && (
            <span>Min: {parameter.specification.min} </span>
          )}
          {parameter.specification.max !== undefined && (
            <span>Max: {parameter.specification.max}</span>
          )}
        </div>
      )}

      {/* Data Points Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-2">Timepoint</th>
              <th className="text-left py-2 px-2">Value</th>
              <th className="text-left py-2 px-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {parameter.dataPoints.map((point, index) => (
              <tr key={index} className="border-b last:border-0">
                <td className="py-2 px-2">{point.timepoint}M</td>
                <td className="py-2 px-2 font-medium">{point.value.toFixed(2)}</td>
                <td className="py-2 px-2 text-muted-foreground">{point.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Projected Failure Warning */}
      {hasProjectedFailure && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              Projected to fail specification at month {parameter.projectedFailureMonth}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
