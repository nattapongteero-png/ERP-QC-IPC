'use client';

/**
 * New GMP Document Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * Page for creating a new GMP controlled document.
 */

import { useRouter } from 'next/navigation';
import { DocumentForm } from '@/components/documents';
import { ResponsivePageHeader } from '@/components/shared';
import type { Document } from '@/types/documents';

export default function NewDocumentPage() {
  const router = useRouter();

  const handleSave = (document: Document) => {
    // Redirect to the new document's detail page
    router.push(`/gmp/documents/${document.id}`);
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title="Create New Document"
        subtitle="Create a new GMP controlled document"
        onBack={() => router.push('/gmp/documents')}
      />

      {/* Form */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-card border rounded-lg shadow-sm">
          <DocumentForm onSave={handleSave} onCancel={handleCancel} />
        </div>
      </div>
    </div>
  );
}
