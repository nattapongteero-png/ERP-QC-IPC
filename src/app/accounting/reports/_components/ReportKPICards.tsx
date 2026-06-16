'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useReportLanguage } from '@/contexts/report-language-context';

export interface ReportKPI {
  labelKey: string;
  value: number;
  previousValue?: number;
  format: 'currency' | 'percent' | 'ratio' | 'number';
  status: 'good' | 'warning' | 'danger' | 'neutral';
  suffix?: string;
}

export interface ReportKPICardsProps {
  kpis: ReportKPI[];
  isLoading?: boolean;
}

// White card + tone-coloured LEFT accent bar (matches the shared StatCard
// style). Colour comes from the left bar, not a tinted fill; value is near-black.
const statusStyles = {
  good: { accent: 'border-l-emerald-500', text: 'text-gray-900' },
  warning: { accent: 'border-l-amber-500', text: 'text-gray-900' },
  danger: { accent: 'border-l-rose-500', text: 'text-gray-900' },
  neutral: { accent: 'border-l-gray-400', text: 'text-gray-900' },
};

export function ReportKPICards({ kpis, isLoading }: ReportKPICardsProps) {
  const { t, formatCurrency } = useReportLanguage();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
            <div className="h-6 w-24 bg-gray-200 rounded" />
          </Card>
        ))}
      </div>
    );
  }

  function formatValue(kpi: ReportKPI): string {
    switch (kpi.format) {
      case 'currency':
        return formatCurrency(kpi.value);
      case 'percent':
        return `${kpi.value.toFixed(1)}%`;
      case 'ratio':
        return kpi.value.toFixed(2) + (kpi.suffix || '');
      case 'number':
        return new Intl.NumberFormat('th-TH').format(kpi.value);
      default:
        return String(kpi.value);
    }
  }

  function getTrend(kpi: ReportKPI) {
    if (kpi.previousValue === undefined) return null;
    const change = ((kpi.value - kpi.previousValue) / kpi.previousValue) * 100;
    if (Math.abs(change) < 0.1) return { icon: Minus, color: 'text-gray-500', value: '0%' };
    if (change > 0) return { icon: TrendingUp, color: 'text-emerald-600', value: `+${change.toFixed(1)}%` };
    return { icon: TrendingDown, color: 'text-red-600', value: `${change.toFixed(1)}%` };
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
      {kpis.map((kpi) => {
        const styles = statusStyles[kpi.status];
        const trend = getTrend(kpi);

        return (
          <Card
            key={kpi.labelKey}
            data-testid={`kpi-${kpi.labelKey}`}
            className={`p-4 bg-white border border-gray-200 border-l-4 ${styles.accent}`}
          >
            <p className="text-sm font-medium text-gray-500 truncate">{t(kpi.labelKey)}</p>
            <p className={`mt-1 text-xl font-bold ${styles.text}`}>{formatValue(kpi)}</p>
            {trend && (
              <div className={`flex items-center gap-1 mt-1 text-xs ${trend.color}`}>
                <trend.icon className="h-3 w-3" />
                <span>{trend.value}</span>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
