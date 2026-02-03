'use client';

// New Training Session Page
// Feature: 007-hr-personnel-management - Training Sessions
// Simple page wrapper that uses the shared TrainingSessionForm

import { useTranslations } from 'next-intl';
import { TrainingSessionForm } from '@/components/hr/TrainingSessionForm';

export default function NewSessionPage() {
  const t = useTranslations('hr');
  return (
    <div className="p-4 md:p-6" data-title={t('training.sessions.actions.addSession')}>
      <TrainingSessionForm mode="create" />
    </div>
  );
}
