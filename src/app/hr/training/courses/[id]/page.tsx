'use client';

// Training Course Detail/Edit Page
// Feature: 007-hr-personnel-management - Task 5: Template Pattern Alignment
// Reusable page component that uses the shared TrainingCourseForm

import { use } from 'react';
import { useTranslations } from 'next-intl';
import { TrainingCourseForm } from '@/components/hr/TrainingCourseForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default function CourseDetailPage({ params }: Props) {
  const t = useTranslations('hr');
  const { id } = use(params);
  const courseId = Number(id);

  return (
    <div className="p-4 md:p-6" data-title={t('training.courses.actions.viewCourse')}>
      <TrainingCourseForm mode="edit" courseId={courseId} />
    </div>
  );
}
