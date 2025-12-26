'use client';

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import * as Icons from 'lucide-react';
import { Card } from '@/components/ui/card';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

type IconName = 'wallet' | 'arrow-up' | 'arrow-down' | 'activity' | 'credit-card' | 'piggy-bank' | 'trending-up' | 'clock' | 'file-text' | 'package' | 'wrench' | 'check-circle' | 'dollar-sign' | 'banknote' | 'receipt' | 'users' | 'calendar' | 'calculator' | 'bar-chart';

const iconMap: Record<IconName, LucideIcon> = {
  'wallet': Icons.Wallet,
  'arrow-up': Icons.ArrowUpRight,
  'arrow-down': Icons.ArrowDownRight,
  'activity': Icons.Activity,
  'credit-card': Icons.CreditCard,
  'piggy-bank': Icons.PiggyBank,
  'trending-up': Icons.TrendingUp,
  'clock': Icons.Clock,
  'file-text': Icons.FileText,
  'package': Icons.Package,
  'wrench': Icons.Wrench,
  'check-circle': Icons.CheckCircle2,
  'dollar-sign': Icons.DollarSign,
  'banknote': Icons.Banknote,
  'receipt': Icons.Receipt,
  'users': Icons.Users,
  'calendar': Icons.Calendar,
  'calculator': Icons.Calculator,
  'bar-chart': Icons.BarChart3,
};

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const variantStyles: Record<Variant, { bg: string; icon: string; border: string }> = {
  default: { bg: 'bg-gray-100', icon: 'text-gray-600', border: 'border-gray-200' },
  success: { bg: 'bg-emerald-100', icon: 'text-emerald-600', border: 'border-emerald-200' },
  warning: { bg: 'bg-orange-100', icon: 'text-orange-600', border: 'border-orange-200' },
  danger: { bg: 'bg-red-100', icon: 'text-red-600', border: 'border-red-200' },
  info: { bg: 'bg-blue-100', icon: 'text-blue-600', border: 'border-blue-200' },
};

export interface AccountingKPICardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: IconName;
  variant?: Variant;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  sparklineData?: number[];
  onClick?: () => void;
  className?: string;
}

export function AccountingKPICard({
  label,
  value,
  subtitle,
  icon = 'activity',
  variant = 'default',
  trend,
  trendValue,
  sparklineData,
  onClick,
  className = '',
}: AccountingKPICardProps) {
  const IconComponent = iconMap[icon] || Icons.Activity;
  const styles = variantStyles[variant];

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-600 bg-green-50' : trend === 'down' ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-50';

  const chartData = sparklineData?.map((value, index) => ({ value, index })) || [];
  const chartColor = variant === 'success' ? '#22c55e' : variant === 'danger' ? '#ef4444' : variant === 'warning' ? '#f97316' : '#3b82f6';

  return (
    <Card
      className={`relative overflow-hidden p-5 transition-all duration-200 hover:shadow-lg ${
        onClick ? 'cursor-pointer hover:scale-[1.02]' : ''
      } bg-white border ${styles.border} ${className}`}
      onClick={onClick}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-24 h-24 transform translate-x-8 -translate-y-8">
        <div className={`w-full h-full rounded-full ${styles.bg} opacity-50`} />
      </div>

      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 truncate">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 tracking-tight">
            {typeof value === 'number' ? value.toLocaleString('th-TH') : value}
          </p>

          <div className="mt-2 flex items-center gap-2">
            {subtitle && (
              <span className="text-xs text-gray-500">{subtitle}</span>
            )}
            {trend && trendValue && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${trendColor}`}>
                <TrendIcon className="h-3 w-3" />
                {trendValue}
              </span>
            )}
          </div>
        </div>

        <div className={`flex-shrink-0 p-3 rounded-xl ${styles.bg}`}>
          <IconComponent className={`h-6 w-6 ${styles.icon}`} />
        </div>
      </div>

      {/* Sparkline */}
      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-4 h-10" data-testid="sparkline-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export function AccountingKPICardSkeleton() {
  return (
    <Card className="p-5 bg-white border border-gray-200">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="h-12 w-12 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    </Card>
  );
}
