'use client';

// New Training Session Page
// Feature: 007-hr-personnel-management - Training Sessions
// Simple page wrapper that uses the shared TrainingSessionForm

import { TrainingSessionForm } from '@/components/hr/TrainingSessionForm';

export default function NewSessionPage() {
  return (
    <div className="p-4 md:p-6">
      <TrainingSessionForm mode="create" />
    </div>
  );
}
