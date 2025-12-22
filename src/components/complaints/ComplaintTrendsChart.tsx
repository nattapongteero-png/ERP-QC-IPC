'use client';

/**
 * Complaint Trends Chart Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Displays complaint trends and analytics.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxButton } from '@/components/ui/dx-button';
import { TrendingUp, BarChart3, Package, AlertTriangle } from 'lucide-react';
import type { ComplaintTrends, ComplaintCategory, ComplaintTrendsParams } from '@/types/complaints';

// ============================================
// Types
// ============================================

interface ComplaintTrendsChartProps {
  className?: string;
}

// ============================================
// API Functions
// ============================================

async function fetchTrends(params: ComplaintTrendsParams): Promise<ComplaintTrends> {
  const searchParams = new URLSearchParams();
  if (params.period) searchParams.set('period', params.period);
  if (params.groupBy) searchParams.set('groupBy', params.groupBy);

  const response = await fetch(`/api/complaints/trends?${searchParams.toString()}`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch trends');
  }
  return result.data;
}

// ============================================
// Component
// ============================================

export function ComplaintTrendsChart({ className }: ComplaintTrendsChartProps) {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  const {
    data: trends,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['complaint-trends', period],
    queryFn: () => fetchTrends({ period }),
  });

  const periodOptions = [
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
  ];

  const categoryLabels: Record<ComplaintCategory, string> = {
    quality: 'Quality',
    efficacy: 'Efficacy',
    safety: 'Safety',
    packaging: 'Packaging',
    labeling: 'Labeling',
    other: 'Other',
  };

  const categoryColors: Record<ComplaintCategory, string> = {
    quality: 'bg-blue-500',
    efficacy: 'bg-green-500',
    safety: 'bg-red-500',
    packaging: 'bg-yellow-500',
    labeling: 'bg-purple-500',
    other: 'bg-gray-500',
  };

  if (error) {
    return (
      <div className={`bg-card border rounded-lg shadow-sm p-6 ${className}`}>
        <div className="text-center py-8">
          <p className="text-destructive mb-4">Failed to load trends</p>
          <DxButton
            text="Retry"
            onClick={() => refetch()}
            stylingMode="outlined"
          />
        </div>
      </div>
    );
  }

  const totalComplaints = trends?.dataPoints.reduce((sum, dp) => sum + dp.count, 0) || 0;
  const categoryTotal = trends?.byCategory
    ? Object.values(trends.byCategory).reduce((sum, count) => sum + count, 0)
    : 0;

  return (
    <div className={`bg-card border rounded-lg shadow-sm ${className}`}>
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Complaint Trends</h3>
        </div>
        <DxSelectBox
          items={periodOptions}
          value={period}
          valueExpr="value"
          displayExpr="label"
          onValueChange={(value) => setPeriod(value as 'month' | 'quarter' | 'year')}
          width={150}
        />
      </div>

      {isLoading ? (
        <div className="p-6 animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded" />
          <div className="h-24 bg-muted rounded" />
        </div>
      ) : (
        <div className="p-4 space-y-6">
          {/* Summary Stats */}
          <div className="text-center py-4 bg-muted/50 rounded-lg">
            <p className="text-3xl font-bold text-primary">{totalComplaints}</p>
            <p className="text-sm text-muted-foreground">Total Complaints ({trends?.period})</p>
          </div>

          {/* Timeline Chart */}
          {trends?.dataPoints && trends.dataPoints.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium">Timeline</h4>
              </div>
              <div className="space-y-2">
                {trends.dataPoints.map((dp) => {
                  const maxCount = Math.max(...trends.dataPoints.map((d) => d.count), 1);
                  const percentage = (dp.count / maxCount) * 100;

                  return (
                    <div key={dp.label} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-24 truncate">{dp.label}</span>
                      <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium w-8 text-right">{dp.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* By Category */}
          {trends?.byCategory && categoryTotal > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium">By Category</h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(trends.byCategory) as [ComplaintCategory, number][])
                  .filter(([_, count]) => count > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, count]) => (
                    <div
                      key={category}
                      className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                    >
                      <div className={`w-3 h-3 rounded-full ${categoryColors[category]}`} />
                      <span className="text-sm flex-1">{categoryLabels[category]}</span>
                      <span className="text-sm font-medium">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Top Products */}
          {trends?.byProduct && trends.byProduct.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium">Top Products</h4>
              </div>
              <div className="space-y-2">
                {trends.byProduct.slice(0, 5).map((product, index) => (
                  <div
                    key={product.productId}
                    className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                  >
                    <span className="text-xs font-medium text-muted-foreground w-5">
                      #{index + 1}
                    </span>
                    <span className="text-sm flex-1 truncate">{product.productName}</span>
                    <span className="text-sm font-medium">{product.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalComplaints === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No complaints found for this period
            </div>
          )}
        </div>
      )}
    </div>
  );
}
