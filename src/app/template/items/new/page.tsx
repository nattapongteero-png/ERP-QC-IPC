'use client';

// Template New Item Page
// Reusable page component that uses the shared TemplateItemForm

import { TemplateItemForm } from '@/components/template';

export default function TemplateNewItemPage() {
  return (
    <div className="p-1">
      <TemplateItemForm mode="create" />
    </div>
  );
}
