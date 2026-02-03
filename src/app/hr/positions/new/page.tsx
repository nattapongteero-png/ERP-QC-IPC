'use client';

// New Position Page
// Feature: 007-hr-personnel-management - Task 4: Template Pattern Alignment
// Reusable page component that uses the shared PositionForm

import { useTranslations } from 'next-intl';
import { PositionForm } from '@/components/hr/PositionForm';

export default function NewPositionPage() {
  const t = useTranslations('hr');
  return (
    <div className="p-4 md:p-6" data-title={t('positions.actions.addPosition')}>
      <PositionForm mode="create" />
    </div>
  );
}
