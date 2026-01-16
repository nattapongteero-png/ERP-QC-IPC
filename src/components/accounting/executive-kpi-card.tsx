'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ExecutiveKPI } from '@/types/accounting';

export interface ExecutiveKPICardProps {
  kpi: ExecutiveKPI;
  onClick?: () => void;
  className?: string;
}

const statusStyles = {
  good: { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700', chart: '#22c55e' },
  warning: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700', chart: '#f59e0b' },
  danger: { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-700', chart: '#ef4444' },
};

export function ExecutiveKPICard({ kpi, onClick, className = '' }: ExecutiveKPICardProps) {
  const styles = statusStyles[kpi.status];
  const TrendIcon = kpi.trend === 'up' ? TrendingUp : kpi.trend === 'down' ? TrendingDown : Minus;

  const trendColor = kpi.trend === 'up' ? 'text-emerald-600' : kpi.trend === 'down' ? 'text-red-600' : 'text-gray-500';
  const chartData = kpi.sparklineData.map((value, index) => ({ value, index }));

  const targetRange = kpi.targetMin !== undefined || kpi.targetMax !== undefined
    ? `Target: ${kpi.targetMin ?? ''}${kpi.targetMin && kpi.targetMax ? ' - ' : ''}${kpi.targetMax ?? ''}`
    : null;

  return (
    <Card
      className={`relative overflow-hidden p-4 transition-all duration-200 hover:shadow-lg ${
        onClick ? 'cursor-pointer hover:scale-[1.01]' : ''
      } bg-white border-2 ${styles.border} ${className}`}
      onClick={onClick}
      data-testid={`kpi-card-${kpi.id}`}
    >
      {/* Status indicator bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${styles.bg.replace('bg-', 'bg-')}`}
           style={{ backgroundColor: styles.chart }} />

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-sm font-medium text-gray-600 truncate">{kpi.label}</p>
            {targetRange && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{targetRange}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <p className={`mt-1 text-2xl font-bold tracking-tight ${styles.text}`}>
            {kpi.formattedValue}
          </p>

          <div className="mt-1 flex items-center gap-2">
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
              <TrendIcon className="h-3 w-3" />
              {kpi.trendPercentage !== 0 && (
                <span>{kpi.trendPercentage > 0 ? '+' : ''}{kpi.trendPercentage.toFixed(1)}%</span>
              )}
            </span>
            <span className="text-xs text-gray-400">vs prior</span>
          </div>
        </div>

        {/* Mini sparkline */}
        <div className="w-16 h-10" data-testid={`sparkline-${kpi.id}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={styles.chart}
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

export function ExecutiveKPICardSkeleton() {
  return (
    <Card className="p-4 bg-white border-2 border-gray-200">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200" />
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-7 w-20 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="w-16 h-10 bg-gray-100 rounded animate-pulse" />
      </div>
    </Card>
  );
}
