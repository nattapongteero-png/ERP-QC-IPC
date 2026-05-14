'use client';

// HR Health Records - Edit Record Page
// Feature: 007-hr-personnel-management
// Pattern: Aligned with Template module

import { use } from 'react';
import { useTranslations } from 'next-intl';
import { HealthRecordForm } from '@/components/hr/HealthRecordForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditHealthRecordPage({ params }: Props) {
  const t = useTranslations('hr');
  const { id } = use(params);
  const recordId = Number(id);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto" data-title={t('healthRecords.actions.viewRecord')}>
      <HealthRecordForm mode="edit" recordId={recordId} />
    </div>
  );
}
