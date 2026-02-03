'use client';

/**
 * New GMP Document Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * Page for creating a new GMP controlled document using a dialog.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DocumentFormDialog } from '@/components/documents';
import type { Document } from '@/types/documents';

export default function NewDocumentPage() {
  const router = useRouter();
  const t = useTranslations('gmp');
  // Start with dialog open
  const [open, setOpen] = useState(true);

  const handleSave = (document: Document) => {
    // Redirect to the new document's detail page
    router.push(`/gmp/documents/${document.id}`);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      // Navigate back when dialog is closed
      router.push('/gmp/documents');
    }
  };

  return (
    <div className="container mx-auto py-6">
      {/* Background content - shows document list page briefly */}
      <div className="animate-pulse space-y-4" aria-label={t('common.loading')}>
        <div className="h-8 bg-muted rounded w-1/4" />
        <div className="h-64 bg-muted rounded" />
      </div>

      {/* Document Form Dialog */}
      <DocumentFormDialog
        open={open}
        onOpenChange={handleOpenChange}
        onSave={handleSave}
      />
    </div>
  );
}
