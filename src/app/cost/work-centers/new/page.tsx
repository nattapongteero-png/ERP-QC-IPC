'use client';

/**
 * New Work Center Page
 * Feature: 014-unit-cost (US6 - Work Center Configuration)
 */

import { WorkCenterForm } from '@/components/cost/WorkCenterForm';

export default function NewWorkCenterPage() {
  return (
    <div className="p-6" data-testid="new-work-center-page">
      <WorkCenterForm mode="create" />
    </div>
  );
}
