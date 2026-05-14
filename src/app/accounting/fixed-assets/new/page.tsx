'use client';

// Accounting Fixed Assets - New Asset Page
// Feature: 010-accounting-module-integration
// Pattern: Aligned with Template module

import { useTranslations } from 'next-intl';
import { FixedAssetForm } from '@/components/accounting/FixedAssetForm';

export default function NewFixedAssetPage() {
  const t = useTranslations('accounting');
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto" data-title={t('page.title')}>
      <FixedAssetForm mode="create" />
    </div>
  );
}
