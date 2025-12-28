'use client';

// Training Course Detail/Edit Page
// Feature: 007-hr-personnel-management - Task 5: Template Pattern Alignment
// Reusable page component that uses the shared TrainingCourseForm

import { use } from 'react';
import { TrainingCourseForm } from '@/components/hr/TrainingCourseForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default function CourseDetailPage({ params }: Props) {
  const { id } = use(params);
  const courseId = Number(id);

  return (
    <div className="p-4 md:p-6">
      <TrainingCourseForm mode="edit" courseId={courseId} />
    </div>
  );
}
