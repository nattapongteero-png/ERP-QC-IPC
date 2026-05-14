'use client';

// New Training Course Page
// Feature: 007-hr-personnel-management - Task 5: Template Pattern Alignment
// Reusable page component that uses the shared TrainingCourseForm

import { useTranslations } from 'next-intl';
import { TrainingCourseForm } from '@/components/hr/TrainingCourseForm';

export default function NewCoursePage() {
  const t = useTranslations('hr');
  return (
    <div className="p-4 md:p-6" data-title={t('training.courses.actions.addCourse')}>
      <TrainingCourseForm mode="create" />
    </div>
  );
}
