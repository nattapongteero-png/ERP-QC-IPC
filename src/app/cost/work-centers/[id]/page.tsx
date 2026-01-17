'use client';

/**
 * Edit Work Center Page
 * Feature: 014-unit-cost (US6 - Work Center Configuration)
 */

import { use } from 'react';
import { WorkCenterForm } from '@/components/cost/WorkCenterForm';

interface EditWorkCenterPageProps {
  params: Promise<{ id: string }>;
}

export default function EditWorkCenterPage({ params }: EditWorkCenterPageProps) {
  const { id } = use(params);
  const workCenterId = parseInt(id);

  if (isNaN(workCenterId)) {
    return (
      <div className="p-6">
        <div className="text-red-500">Invalid work center ID</div>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="edit-work-center-page">
      <WorkCenterForm mode="edit" workCenterId={workCenterId} />
    </div>
  );
}
