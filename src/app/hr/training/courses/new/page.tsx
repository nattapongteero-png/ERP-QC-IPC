'use client';

// New Training Course Page
// Feature: 007-hr-personnel-management - Task 5: Template Pattern Alignment
// Reusable page component that uses the shared TrainingCourseForm

import { TrainingCourseForm } from '@/components/hr/TrainingCourseForm';

export default function NewCoursePage() {
  return (
    <div className="p-4 md:p-6">
      <TrainingCourseForm mode="create" />
    </div>
  );
}
