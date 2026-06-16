'use client';

/**
 * Stability Trends Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * Overview of stability trends across all studies.
 */

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FlaskConical,
  Package,
} from 'lucide-react';
import type { StabilityTrends } from '@/types/stability';

// ============================================
// API Functions
// ============================================

async function fetchTrends(): Promise<StabilityTrends> {
  const response = await fetch('/api/stability/trends');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

// ============================================
// Component
// ============================================

export default function StabilityTrendsPage() {
  const router = useRouter();
  const t = useTranslations('gmp');

  const { data: trends, isLoading, error } = useQuery({
    queryKey: ['stability-trends-all'],
    queryFn: fetchTrends,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-destructive">{t('stability.trends.failedToLoad')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title={t('stability.trends.title')}
        subtitle={t('stability.trends.description')}
        onBack={() => router.push('/gmp/stability')}
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div className="flex items-center gap-3">
            <FlaskConical className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{trends?.totalActiveStudies || 0}</p>
              <p className="text-sm text-gray-500">{t('stability.dashboard.activeStudies')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 border-l-4 border-l-rose-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{trends?.overduesamples || 0}</p>
              <p className="text-sm text-gray-500">{t('stability.dashboard.overdueSamples')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 border-l-4 border-l-amber-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{trends?.oosThisMonth || 0}</p>
              <p className="text-sm text-gray-500">{t('stability.dashboard.oosThisMonth')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 border-l-4 border-l-emerald-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{trends?.studiesByProduct.length || 0}</p>
              <p className="text-sm text-gray-500">{t('stability.dashboard.productsTracked')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Studies by Product */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">{t('stability.trends.studiesByProduct')}</h2>

        {trends?.studiesByProduct && trends.studiesByProduct.length > 0 ? (
          <div className="space-y-4">
            {trends.studiesByProduct.map((product) => {
              const totalStudies = product.activeStudies + product.completedStudies;
              const completionRate =
                totalStudies > 0 ? (product.completedStudies / totalStudies) * 100 : 0;

              return (
                <div
                  key={product.productId}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() =>
                    router.push(`/gmp/stability/studies?productId=${product.productId}`)
                  }
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Package className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">{product.productName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t('stability.trends.activeCount', { count: product.activeStudies })}, {t('stability.trends.completedCount', { count: product.completedStudies })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-lg font-bold">{completionRate.toFixed(0)}%</div>
                      <div className="text-xs text-muted-foreground">{t('stability.trends.complete')}</div>
                    </div>
                    <div className="w-24 bg-muted rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t('stability.studies.noStudies')}</p>
            <p className="text-sm">{t('stability.studies.enrollFirst')}</p>
            <DxButton
              text={t('stability.actions.enrollBatch')}
              onClick={() => router.push('/gmp/stability/studies/new')}
              type="default"
              stylingMode="outlined"
              className="mt-4"
            />
          </div>
        )}
      </div>

      {/* Trend Insights */}
      {trends && trends.oosThisMonth > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800 dark:text-yellow-200">
                {t('stability.alerts.oosTitle')}
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                {t('stability.alerts.oosDescription', { count: trends.oosThisMonth })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
