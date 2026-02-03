'use client';

// Position Detail/Edit Page
// Feature: 007-hr-personnel-management - Task 4: Template Pattern Alignment
// Reusable page component that uses the shared PositionForm

import { use } from 'react';
import { useTranslations } from 'next-intl';
import { PositionForm } from '@/components/hr/PositionForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default function PositionDetailPage({ params }: Props) {
  const t = useTranslations('hr');
  const { id } = use(params);
  const positionId = Number(id);

  return (
    <div className="p-4 md:p-6" data-title={t('positions.actions.viewPosition')}>
      <PositionForm mode="edit" positionId={positionId} />
    </div>
  );
}
