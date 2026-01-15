'use client';

/**
 * Edit Landed Cost Page
 * Feature: 014-unit-cost
 */

import { use } from 'react';
import { LandedCostForm } from '@/components/cost';

export default function EditLandedCostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const landedCostId = parseInt(id, 10);

  if (isNaN(landedCostId)) {
    return (
      <div className="p-6">
        <div className="text-red-500">Invalid landed cost ID</div>
      </div>
    );
  }

  return <LandedCostForm mode="edit" landedCostId={landedCostId} />;
}
