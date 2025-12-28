'use client';

// Template Category - Detail/Edit Page
// Edit category with professional form

import { use } from 'react';
import { TemplateCategoryForm } from '@/components/template';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TemplateCategoryDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const categoryId = parseInt(id, 10);

  if (isNaN(categoryId)) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-600">Invalid category ID</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-1">
      <TemplateCategoryForm mode="edit" categoryId={categoryId} />
    </div>
  );
}
