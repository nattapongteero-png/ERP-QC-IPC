'use client';

/**
 * KPICard Component - Reusable expandable KPI card
 * Feature: 014-unit-cost (Executive Dashboard)
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { KPIValue } from '@/types/unit-cost';

interface KPICardProps {
  title: string;
  icon: React.ReactNode;
  kpi: KPIValue;
  format?: 'currency' | 'percent' | 'number';
  expandable?: boolean;
  children?: React.ReactNode;
}

function formatValue(value: number, format: 'currency' | 'percent' | 'number'): string {
  if (format === 'currency') {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (format === 'percent') {
    return `${value.toFixed(1)}%`;
  }
  return value.toLocaleString('th-TH', { maximumFractionDigits: 1 });
}

export function KPICard({ title, icon, kpi, format = 'currency', expandable = false, children }: KPICardProps) {
  const t = useTranslations('cost');
  const [expanded, setExpanded] = useState(false);

  const bgColors = {
    good: 'bg-green-100',
    warning: 'bg-yellow-100',
    critical: 'bg-red-100',
    neutral: 'bg-gray-100',
  };

  const TrendIcon = kpi.changeDirection === 'up' ? TrendingUp : kpi.changeDirection === 'down' ? TrendingDown : Minus;
  const trendColor = kpi.status === 'good' ? 'text-green-600' : kpi.status === 'warning' || kpi.status === 'critical' ? 'text-red-600' : 'text-gray-500';

  return (
    <Card
      className={`${expandable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={() => expandable && setExpanded(!expanded)}
      data-testid={`kpi-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${bgColors[kpi.status]}`}>
            {icon}
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold">{formatValue(kpi.current, format)}</p>
            <div className="flex items-center gap-2 text-sm">
              <TrendIcon className={`h-4 w-4 ${trendColor}`} />
              <span className={trendColor}>
                {kpi.changePercent > 0 ? '+' : ''}{kpi.changePercent.toFixed(1)}% {t('executiveDashboard.vsPriorPeriod')}
              </span>
            </div>
          </div>
          {expandable && (
            <div className="text-gray-400">
              {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </div>
          )}
        </div>
        {expanded && children && (
          <div className="mt-4 pt-4 border-t">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default KPICard;
