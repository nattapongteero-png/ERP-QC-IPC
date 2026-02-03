'use client';

// Accounting Fixed Assets - Edit Asset Page
// Feature: 010-accounting-module-integration
// Pattern: Aligned with Template module

import { use } from 'react';
import { useTranslations } from 'next-intl';
import { FixedAssetForm } from '@/components/accounting/FixedAssetForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditFixedAssetPage({ params }: Props) {
  const t = useTranslations('accounting');
  const { id } = use(params);
  const assetId = Number(id);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto" data-title={t('page.title')}>
      <FixedAssetForm mode="edit" assetId={assetId} />
    </div>
  );
}
