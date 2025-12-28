'use client';

// HR Health Records - Edit Record Page
// Feature: 007-hr-personnel-management
// Pattern: Aligned with Template module

import { use } from 'react';
import { HealthRecordForm } from '@/components/hr/HealthRecordForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditHealthRecordPage({ params }: Props) {
  const { id } = use(params);
  const recordId = Number(id);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <HealthRecordForm mode="edit" recordId={recordId} />
    </div>
  );
}
