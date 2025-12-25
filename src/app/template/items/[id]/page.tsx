'use client';

// Template Item Detail/Edit Page
// Reusable page component that uses the shared TemplateItemForm

import { use } from 'react';
import { TemplateItemForm } from '@/components/template';

interface Props {
  params: Promise<{ id: string }>;
}

export default function TemplateItemDetailPage({ params }: Props) {
  const { id } = use(params);
  const itemId = Number(id);

  return (
    <div className="p-1">
      <TemplateItemForm mode="edit" itemId={itemId} />
    </div>
  );
}
