'use client';

// New Position Page
// Feature: 007-hr-personnel-management - Task 4: Template Pattern Alignment
// Reusable page component that uses the shared PositionForm

import { PositionForm } from '@/components/hr/PositionForm';

export default function NewPositionPage() {
  return (
    <div className="p-4 md:p-6">
      <PositionForm mode="create" />
    </div>
  );
}
