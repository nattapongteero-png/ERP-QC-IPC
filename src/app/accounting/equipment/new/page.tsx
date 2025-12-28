'use client';

// Accounting Equipment - New Equipment Page
// Feature: 010-accounting-module-integration
// Pattern: Aligned with Template module

import { EquipmentForm } from '@/components/accounting/EquipmentForm';

export default function NewEquipmentPage() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <EquipmentForm mode="create" />
    </div>
  );
}
