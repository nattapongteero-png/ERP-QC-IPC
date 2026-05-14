'use client';

/**
 * Stability Studies List Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * List of all stability studies with filters.
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { StabilityStudyList } from '@/components/stability';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import type { StabilityStudyListResponse, StabilityStudyStatus } from '@/types/stability';

// ============================================
// API Functions
// ============================================

async function fetchStudies(
  status?: StabilityStudyStatus,
  productId?: number
): Promise<StabilityStudyListResponse> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (productId) params.set('productId', String(productId));
  params.set('limit', '100');

  const response = await fetch(`/api/stability/studies?${params.toString()}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

// ============================================
// Component
// ============================================

export default function StabilityStudiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('gmp');
  const productId = searchParams.get('productId');

  const [statusFilter, setStatusFilter] = useState<StabilityStudyStatus | ''>('');

  // Status options with translations
  const statusOptions = [
    { value: '', label: t('common.allStatus') },
    { value: 'active', label: t('stability.status.active') },
    { value: 'completed', label: t('stability.status.completed') },
    { value: 'on_hold', label: t('stability.status.onHold') },
    { value: 'cancelled', label: t('stability.status.cancelled') },
  ];

  const { data, isLoading, error } = useQuery({
    queryKey: ['stability-studies', statusFilter, productId],
    queryFn: () =>
      fetchStudies(
        statusFilter || undefined,
        productId ? parseInt(productId, 10) : undefined
      ),
  });

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-destructive">{t('stability.studies.failedToLoad')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title={t('stability.studies.title')}
        subtitle={t('stability.studies.description')}
        onBack={() => router.push('/gmp/stability')}
        actions={
          <DxButton
            text={t('stability.actions.enrollBatch')}
            icon="add"
            onClick={() => router.push('/gmp/stability/studies/new')}
            type="default"
          />
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="w-48">
          <DxSelectBox
            dataSource={statusOptions}
            valueExpr="value"
            displayExpr="label"
            value={statusFilter}
            onValueChanged={(e) => setStatusFilter(e.value)}
            placeholder={t('stability.studies.filterByStatus')}
          />
        </div>
      </div>

      {/* Studies List */}
      <StabilityStudyList studies={data?.studies || []} loading={isLoading} />
    </div>
  );
}
