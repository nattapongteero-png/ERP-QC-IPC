'use client';

// Accounting Equipment - New Equipment Page
// Feature: 010-accounting-module-integration
// Pattern: Aligned with Template module

import { useTranslations } from 'next-intl';
import { EquipmentForm } from '@/components/accounting/EquipmentForm';

export default function NewEquipmentPage() {
  const t = useTranslations('accounting');
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto" data-title={t('page.title')}>
      <EquipmentForm mode="create" />
    </div>
  );
}
