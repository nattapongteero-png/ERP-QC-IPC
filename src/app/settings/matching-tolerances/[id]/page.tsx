'use client';

/**
 * Edit Matching Tolerance Page
 * Edit an existing tolerance configuration
 */

import { use } from 'react';
import { ToleranceForm } from '@/components/settings/matching';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditTolerancePage({ params }: PageProps) {
  const { id } = use(params);
  const toleranceId = parseInt(id, 10);

  if (isNaN(toleranceId)) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Invalid tolerance ID</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-1">
      <ToleranceForm mode="edit" toleranceId={toleranceId} />
    </div>
  );
}
