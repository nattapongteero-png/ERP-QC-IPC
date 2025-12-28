'use client';

// Accounting Fixed Assets - Edit Asset Page
// Feature: 010-accounting-module-integration
// Pattern: Aligned with Template module

import { use } from 'react';
import { FixedAssetForm } from '@/components/accounting/FixedAssetForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditFixedAssetPage({ params }: Props) {
  const { id } = use(params);
  const assetId = Number(id);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <FixedAssetForm mode="edit" assetId={assetId} />
    </div>
  );
}
