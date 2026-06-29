'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, X, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ExecutiveAlert, AlertPriority } from '@/types/accounting';

export interface ExecutiveAlertBarProps {
  alerts: ExecutiveAlert[];
  onDismiss?: (alertId: string) => void;
  className?: string;
}

const priorityConfig: Record<AlertPriority, { icon: typeof AlertTriangle; bg: string; border: string; text: string; badge: string }> = {
  critical: {
    icon: AlertTriangle,
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    badge: 'bg-red-500 text-white',
  },
  warning: {
    icon: AlertCircle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    badge: 'bg-amber-500 text-white',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    badge: 'bg-blue-500 text-white',
  },
};

// Map an alert's stable type → i18n key for its title + action label, so the
// English text the API sends gets localized. Message body (with dynamic period
// names / day counts) is left as-is from the API.
const ALERT_TITLE_KEY: Record<string, string> = {
  period_close_pending: 'dashboard.alerts.periodClosePending',
};
const ALERT_ACTION_KEY: Record<string, string> = {
  period_close_pending: 'dashboard.alerts.managePeriods',
};

export function ExecutiveAlertBar({ alerts, onDismiss, className = '' }: ExecutiveAlertBarProps) {
  const t = useTranslations('accounting');
  const tr = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };
  const [isExpanded, setIsExpanded] = useState(false);

  if (alerts.length === 0) return null;

  const criticalCount = alerts.filter(a => a.priority === 'critical').length;
  const warningCount = alerts.filter(a => a.priority === 'warning').length;
  const infoCount = alerts.filter(a => a.priority === 'info').length;

  const displayedAlerts = isExpanded ? alerts : alerts.slice(0, 3);

  return (
    <Card className={`overflow-hidden ${className}`} data-testid="executive-alert-bar">
      {/* Summary Header */}
      <div
        className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-gray-700">{tr('dashboard.alerts.title', 'Alerts')}</span>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white" data-testid="critical-count">
                <AlertTriangle className="h-3 w-3" />
                {criticalCount} {tr('dashboard.alerts.critical', 'Critical')}
              </span>
            )}
            {warningCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500 text-white" data-testid="warning-count">
                <AlertCircle className="h-3 w-3" />
                {warningCount} {tr('dashboard.alerts.warning', 'Warning')}
              </span>
            )}
            {infoCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500 text-white" data-testid="info-count">
                <Info className="h-3 w-3" />
                {infoCount} {tr('dashboard.alerts.info', 'Info')}
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span className="ml-1 text-xs">{isExpanded ? tr('dashboard.alerts.collapse', 'Collapse') : tr('dashboard.alerts.expand', 'Expand')}</span>
        </Button>
      </div>

      {/* Alert List */}
      <div className="divide-y divide-gray-100">
        {displayedAlerts.map((alert) => {
          const config = priorityConfig[alert.priority];
          const Icon = config.icon;

          return (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-3 ${config.bg}`}
              data-testid={`alert-${alert.id}`}
            >
              <div className={`p-1.5 rounded-full ${config.badge}`}>
                <Icon className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-semibold ${config.text}`}>
                    {ALERT_TITLE_KEY[alert.type] ? tr(ALERT_TITLE_KEY[alert.type], alert.title) : alert.title}
                  </p>
                  {alert.formattedValue && (
                    <span className="text-sm font-bold text-gray-900">{alert.formattedValue}</span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-0.5">{alert.message}</p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={alert.actionLink}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.text} hover:underline`}
                >
                  {ALERT_ACTION_KEY[alert.type] ? tr(ALERT_ACTION_KEY[alert.type], alert.actionLabel) : alert.actionLabel}
                  <ExternalLink className="h-3 w-3" />
                </Link>
                {onDismiss && alert.priority !== 'critical' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss(alert.id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more indicator */}
      {!isExpanded && alerts.length > 3 && (
        <div
          className="p-2 text-center text-xs text-gray-500 bg-gray-50 cursor-pointer hover:bg-gray-100"
          onClick={() => setIsExpanded(true)}
        >
          {tr('dashboard.alerts.moreAlerts', `+ ${alerts.length - 3} more alerts`).replace('{count}', String(alerts.length - 3))}
        </div>
      )}
    </Card>
  );
}

export function ExecutiveAlertBarSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
        <div className="flex items-center gap-4">
          <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <div className="h-12 bg-gray-100 rounded animate-pulse" />
        <div className="h-12 bg-gray-100 rounded animate-pulse" />
      </div>
    </Card>
  );
}
