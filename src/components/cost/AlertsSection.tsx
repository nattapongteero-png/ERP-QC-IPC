'use client';

/**
 * AlertsSection Component - Alerts, Trends, and MoM Comparison section
 * Feature: 014-unit-cost (Executive Dashboard)
 */

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { CostAlert, TrendDataPoint, MoMComparisonRow } from '@/types/unit-cost';

interface AlertsSectionProps {
  alerts: CostAlert[];
  trends: TrendDataPoint[];
  momComparison: MoMComparisonRow[];
}

const severityConfig = {
  critical: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  warning: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
};

function formatMoMValue(value: number, unit: string, daysLabel: string): string {
  if (unit === 'currency') return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(value);
  if (unit === 'percent') return `${value.toFixed(1)}%`;
  if (unit === 'days') return `${value.toFixed(0)} ${daysLabel}`;
  return value.toLocaleString('th-TH', { maximumFractionDigits: 1 });
}

export function AlertsSection({ alerts, trends, momComparison }: AlertsSectionProps) {
  const t = useTranslations('cost');
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');

  return (
    <div className="space-y-4" data-testid="alerts-section">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            {t('executiveDashboard.alerts.activeAlerts', { count: alerts.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length > 0 ? (
            <div className="space-y-4">
              {criticalAlerts.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-red-600 mb-2">{t('executiveDashboard.alerts.critical', { count: criticalAlerts.length })}</p>
                  <div className="space-y-2">
                    {criticalAlerts.map(alert => {
                      const config = severityConfig[alert.severity];
                      const Icon = config.icon;
                      return (
                        <div key={alert.id} className={`p-3 rounded-lg border ${config.bg} ${config.border}`}>
                          <div className="flex items-start gap-2">
                            <Icon className={`h-4 w-4 ${config.color} mt-0.5`} />
                            <div>
                              <p className={`font-medium ${config.color}`}>{alert.title}</p>
                              <p className="text-sm text-gray-600">{alert.description}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {warningAlerts.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-yellow-600 mb-2">{t('executiveDashboard.alerts.warning', { count: warningAlerts.length })}</p>
                  <div className="space-y-2">
                    {warningAlerts.slice(0, 5).map(alert => {
                      const config = severityConfig[alert.severity];
                      const Icon = config.icon;
                      return (
                        <div key={alert.id} className={`p-3 rounded-lg border ${config.bg} ${config.border}`}>
                          <div className="flex items-start gap-2">
                            <Icon className={`h-4 w-4 ${config.color} mt-0.5`} />
                            <div>
                              <p className={`font-medium ${config.color}`}>{alert.title}</p>
                              <p className="text-sm text-gray-600">{alert.description}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : <p className="text-gray-500">{t('executiveDashboard.alerts.noActiveAlerts')}</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">{t('executiveDashboard.alerts.trend6Month')}</CardTitle></CardHeader>
          <CardContent>
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="grossMargin" stroke="#22c55e" name={t('executiveDashboard.alerts.grossMarginLine')} strokeWidth={2} />
                  <Line type="monotone" dataKey="avgUnitCost" stroke="#3b82f6" name={t('executiveDashboard.alerts.avgUnitCostLine')} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-500 text-sm">{t('executiveDashboard.alerts.noTrendData')}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">{t('executiveDashboard.alerts.momComparison')}</CardTitle></CardHeader>
          <CardContent>
            {momComparison.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">{t('executiveDashboard.alerts.metric')}</th>
                      <th className="text-right py-2">{t('executiveDashboard.alerts.thisMonth')}</th>
                      <th className="text-right py-2">{t('executiveDashboard.alerts.lastMonth')}</th>
                      <th className="text-right py-2">{t('executiveDashboard.alerts.change')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {momComparison.map((row) => (
                      <tr key={row.metric} className="border-b">
                        <td className="py-2">{row.metric}</td>
                        <td className="text-right">{formatMoMValue(row.thisMonth, row.unit, t('executiveDashboard.daysUnit'))}</td>
                        <td className="text-right">{formatMoMValue(row.lastMonth, row.unit, t('executiveDashboard.daysUnit'))}</td>
                        <td className={`text-right font-medium ${row.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {row.changePercent >= 0 ? '+' : ''}{row.changePercent.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-gray-500 text-sm">{t('executiveDashboard.alerts.noComparisonData')}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AlertsSection;
