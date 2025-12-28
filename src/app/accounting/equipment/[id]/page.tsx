'use client';

// Accounting Equipment - Edit Equipment Page
// Feature: 010-accounting-module-integration
// Pattern: Aligned with Template module

import { use } from 'react';
import { EquipmentForm } from '@/components/accounting/EquipmentForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditEquipmentPage({ params }: Props) {
  const { id } = use(params);
  const equipmentId = Number(id);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <EquipmentForm mode="edit" equipmentId={equipmentId} />
    </div>
  );
}
