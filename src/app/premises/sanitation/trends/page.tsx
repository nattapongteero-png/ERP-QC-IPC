'use client';

/**
 * Sanitation Trends Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * Display sanitation compliance trends and analytics.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { SanitationTrendChart } from '@/components/sanitation';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import type { SanitationTrends, AreaType } from '@/types/sanitation';

// ============================================
// API Functions
// ============================================

async function fetchTrends(params: Record<string, string>): Promise<SanitationTrends> {
  const searchParams = new URLSearchParams(params);
  const response = await fetch(`/api/sanitation/trends?${searchParams}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

// ============================================
// Component
// ============================================

const periodOptions = [
  { value: 'week', text: 'สัปดาห์ที่ผ่านมา' },
  { value: 'month', text: 'เดือนที่ผ่านมา' },
  { value: 'quarter', text: 'ไตรมาสที่ผ่านมา' },
  { value: 'year', text: 'ปีที่ผ่านมา' },
];

const areaTypeOptions = [
  { value: '', text: 'ทุกพื้นที่' },
  { value: 'production', text: 'พื้นที่ผลิต' },
  { value: 'warehouse', text: 'คลังจัดเก็บ' },
  { value: 'lab', text: 'ห้องปฏิบัติการ' },
  { value: 'office', text: 'สำนักงาน' },
];

export default function SanitationTrendsPage() {
  const router = useRouter();
  const t = useTranslations('gmp');

  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [areaType, setAreaType] = useState<AreaType | ''>('');

  const queryParams: Record<string, string> = { period };
  if (areaType) queryParams.areaType = areaType;

  const { data: trends, isLoading } = useQuery({
    queryKey: ['sanitation-trends', queryParams],
    queryFn: () => fetchTrends(queryParams),
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title={t('sanitation.trends.title')}
        subtitle={t('sanitation.trends.description')}
        breadcrumbs={[
          { label: 'อาคารและสถานที่', href: '/premises' },
          { label: t('sanitation.pageTitle'), href: '/premises/sanitation' },
          { label: t('sanitation.trends.title') },
        ]}
        onBack={() => router.push('/premises/sanitation')}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <DxSelectBox
          items={periodOptions}
          value={period}
          onValueChanged={(e) => setPeriod(e.value)}
          displayExpr="text"
          valueExpr="value"
          width={160}
        />
        <DxSelectBox
          items={areaTypeOptions}
          value={areaType}
          onValueChanged={(e) => setAreaType(e.value)}
          displayExpr="text"
          valueExpr="value"
          width={160}
        />
      </div>

      {/* Trend Chart */}
      <SanitationTrendChart data={trends || null} loading={isLoading} />
    </div>
  );
}
