'use client';

// HR Health Records - New Record Page
// Feature: 007-hr-personnel-management
// Pattern: Aligned with Template module

import { HealthRecordForm } from '@/components/hr/HealthRecordForm';

export default function NewHealthRecordPage() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <HealthRecordForm mode="create" />
    </div>
  );
}
