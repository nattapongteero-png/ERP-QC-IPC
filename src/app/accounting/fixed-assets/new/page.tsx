'use client';

// Accounting Fixed Assets - New Asset Page
// Feature: 010-accounting-module-integration
// Pattern: Aligned with Template module

import { FixedAssetForm } from '@/components/accounting/FixedAssetForm';

export default function NewFixedAssetPage() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <FixedAssetForm mode="create" />
    </div>
  );
}
