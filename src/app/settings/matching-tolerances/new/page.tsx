'use client';

/**
 * New Matching Tolerance Page
 * Creates a new tolerance configuration
 */

import { ToleranceForm } from '@/components/settings/matching';

export default function NewTolerancePage() {
  return (
    <div className="p-1">
      <ToleranceForm mode="create" />
    </div>
  );
}
