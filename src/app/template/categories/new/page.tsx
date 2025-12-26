'use client';

// Template Category - New Page
// Create new category with professional form

import { TemplateCategoryForm } from '@/components/template';

export default function NewTemplateCategoryPage() {
  return (
    <div className="p-1">
      <TemplateCategoryForm mode="create" />
    </div>
  );
}
