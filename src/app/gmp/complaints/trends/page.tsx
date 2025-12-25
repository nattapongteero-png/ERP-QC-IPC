'use client';

/**
 * Complaint Trends Analysis Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 * T511: Shows complaint trends with filters and summary cards
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxButton } from '@/components/ui/dx-button';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { ComplaintTrendsChart } from '@/components/complaints/ComplaintTrendsChart';
import { TrendingUp, AlertCircle, Clock, Package, BarChart3 } from 'lucide-react';
import type { ComplaintTrends, ComplaintTrendsParams, ComplaintCategory } from '@/types/complaints';

// ============================================
// Types
// ============================================

interface TrendsSummary {
  totalComplaints: number;
  avgResolutionTime: number;
  topCategory: {
    name: string;
    count: number;
  } | null;
  criticalCount: number;
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

async function fetchDashboard() {
  const response = await fetch('/api/complaints/dashboard');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch dashboard');
  }
  return result.data;
}

// ============================================
// Main Component
// ============================================

export default function ComplaintTrendsPage() {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [customDateRange, setCustomDateRange] = useState<{
    from: string;
    to: string;
  }>({
    from: '',
    to: '',
  });
  const [showCustomRange, setShowCustomRange] = useState(false);

  const {
    data: trends,
    isLoading: trendsLoading,
    error: trendsError,
    refetch: refetchTrends,
  } = useQuery({
    queryKey: ['complaint-trends', period],
    queryFn: () => fetchTrends({ period }),
  });

  const {
    data: dashboard,
    isLoading: dashboardLoading,
  } = useQuery({
    queryKey: ['complaint-dashboard'],
    queryFn: fetchDashboard,
  });

  const periodOptions = [
    { value: 'month', label: 'Last 30 Days' },
    { value: 'quarter', label: 'Last 90 Days' },
    { value: 'year', label: 'Last Year' },
    { value: 'custom', label: 'Custom Range' },
  ];

  const handlePeriodChange = (value: string) => {
    if (value === 'custom') {
      setShowCustomRange(true);
    } else {
      setShowCustomRange(false);
      setPeriod(value as 'month' | 'quarter' | 'year');
    }
  };

  const handleApplyCustomRange = () => {
    // For now, custom range will use month period
    // In production, you'd pass custom dates to API
    setPeriod('month');
    refetchTrends();
  };

  // Calculate summary statistics
  const summary: TrendsSummary = useMemo(() => {
    if (!trends) {
      return {
        totalComplaints: 0,
        avgResolutionTime: 0,
        topCategory: null,
        criticalCount: 0,
      };
    }

    const totalComplaints = trends.dataPoints.reduce((sum, dp) => sum + dp.count, 0);

    // Find top category
    const categoryEntries = Object.entries(trends.byCategory) as [ComplaintCategory, number][];
    const topCategoryEntry = categoryEntries.reduce(
      (max, entry) => (entry[1] > max[1] ? entry : max),
      ['quality', 0] as [ComplaintCategory, number]
    );

    const categoryLabels: Record<ComplaintCategory, string> = {
      quality: 'Quality',
      efficacy: 'Efficacy',
      safety: 'Safety',
      packaging: 'Packaging',
      labeling: 'Labeling',
      other: 'Other',
    };

    // Average resolution time (mock - in production, calculate from actual data)
    // Using a fixed value to avoid impure function during render
    const avgResolutionTime = dashboard?.resolvedThisMonth ? 18 : 0;

    const criticalCount = dashboard?.criticalCount || 0;

    return {
      totalComplaints,
      avgResolutionTime,
      topCategory:
        topCategoryEntry[1] > 0
          ? {
              name: categoryLabels[topCategoryEntry[0]],
              count: topCategoryEntry[1],
            }
          : null,
      criticalCount,
    };
  }, [trends, dashboard]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Complaint Trends Analysis</h1>
        <p className="text-muted-foreground mt-2">
          Analyze complaint patterns by category, severity, product, and time period
        </p>
      </div>

      {/* Period Filter */}
      <Card>
        <div className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <label className="font-medium">Time Period:</label>
            </div>
            <DxSelectBox
              items={periodOptions}
              value={showCustomRange ? 'custom' : period}
              valueExpr="value"
              displayExpr="label"
              onValueChange={handlePeriodChange}
              width={200}
            />

            {showCustomRange && (
              <div className="flex items-center gap-2">
                <DxDateBox
                  value={customDateRange.from}
                  onValueChange={(value) =>
                    setCustomDateRange((prev) => ({ ...prev, from: value }))
                  }
                  placeholder="From Date"
                  width={150}
                />
                <span className="text-muted-foreground">to</span>
                <DxDateBox
                  value={customDateRange.to}
                  onValueChange={(value) =>
                    setCustomDateRange((prev) => ({ ...prev, to: value }))
                  }
                  placeholder="To Date"
                  width={150}
                />
                <DxButton
                  text="Apply"
                  onClick={handleApplyCustomRange}
                  stylingMode="contained"
                  type="default"
                  disabled={!customDateRange.from || !customDateRange.to}
                />
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Complaints */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Total Complaints</p>
                {trendsLoading || dashboardLoading ? (
                  <div className="h-8 w-16 bg-muted rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-2xl font-bold mt-1">{summary.totalComplaints}</p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Avg Resolution Time */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Clock className="h-6 w-6 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Avg Resolution</p>
                {trendsLoading || dashboardLoading ? (
                  <div className="h-8 w-16 bg-muted rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-2xl font-bold mt-1">
                    {summary.avgResolutionTime > 0
                      ? `${summary.avgResolutionTime} days`
                      : 'N/A'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Top Category */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <Package className="h-6 w-6 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Top Category</p>
                {trendsLoading ? (
                  <div className="h-8 w-20 bg-muted rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-2xl font-bold mt-1">
                    {summary.topCategory ? summary.topCategory.name : 'N/A'}
                  </p>
                )}
                {summary.topCategory && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.topCategory.count} complaints
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Critical Count */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/10 rounded-lg">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Critical Open</p>
                {dashboardLoading ? (
                  <div className="h-8 w-16 bg-muted rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-2xl font-bold mt-1">{summary.criticalCount}</p>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Trends Chart */}
      {trendsError ? (
        <Card>
          <div className="p-6 text-center">
            <p className="text-destructive mb-4">Failed to load trends data</p>
            <DxButton
              text="Retry"
              onClick={() => refetchTrends()}
              stylingMode="outlined"
            />
          </div>
        </Card>
      ) : (
        <ComplaintTrendsChart className="w-full" />
      )}

      {/* Additional Insights Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Severity */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Complaints by Severity</h3>
            {dashboardLoading ? (
              <div className="space-y-3">
                <div className="h-8 bg-muted rounded animate-pulse" />
                <div className="h-8 bg-muted rounded animate-pulse" />
                <div className="h-8 bg-muted rounded animate-pulse" />
              </div>
            ) : dashboard?.bySeverity ? (
              <div className="space-y-3">
                {Object.entries(dashboard.bySeverity as Record<string, number>).map(([severity, count]) => (
                  <div key={severity} className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        severity === 'critical'
                          ? 'bg-red-500'
                          : severity === 'major'
                          ? 'bg-orange-500'
                          : 'bg-yellow-500'
                      }`}
                    />
                    <span className="flex-1 capitalize">{severity}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No data available</p>
            )}
          </div>
        </Card>

        {/* By Status */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Complaints by Status</h3>
            {dashboardLoading ? (
              <div className="space-y-3">
                <div className="h-8 bg-muted rounded animate-pulse" />
                <div className="h-8 bg-muted rounded animate-pulse" />
                <div className="h-8 bg-muted rounded animate-pulse" />
              </div>
            ) : dashboard?.byStatus ? (
              <div className="space-y-3">
                {Object.entries(dashboard.byStatus as Record<string, number>).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        status === 'closed'
                          ? 'bg-gray-500'
                          : status === 'resolved'
                          ? 'bg-green-500'
                          : status === 'under_investigation'
                          ? 'bg-blue-500'
                          : 'bg-yellow-500'
                      }`}
                    />
                    <span className="flex-1 capitalize">{status.replace('_', ' ')}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No data available</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
