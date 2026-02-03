'use client';

/**
 * New Complaint Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Page for creating a new customer complaint using the reusable dialog.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ComplaintDataEntryDialog } from '@/components/complaints';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { MessageSquareWarning } from 'lucide-react';
import type { Complaint } from '@/types/complaints';

export default function NewComplaintPage() {
  const router = useRouter();
  const t = useTranslations('gmp');
  // Start with dialog visible since this is the "new" page
  const [dialogVisible, setDialogVisible] = useState(true);

  const handleSaved = (complaint: Complaint) => {
    // Redirect to the new complaint's detail page
    router.push(`/gmp/complaints/${complaint.id}`);
  };

  const handleClose = () => {
    setDialogVisible(false);
    // Navigate back after a short delay to allow dialog animation
    setTimeout(() => {
      router.push('/gmp/complaints');
    }, 200);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title={t('complaints.new.title')}
        subtitle={t('complaints.new.subtitle')}
        icon={MessageSquareWarning}
        iconBgColor="bg-orange-100"
        iconColor="text-orange-600"
        onBack={() => router.push('/gmp/complaints')}
        breadcrumbs={[
          { label: t('page.title'), href: '/gmp' },
          { label: t('complaints.title'), href: '/gmp/complaints' },
          { label: t('complaints.new.breadcrumb') },
        ]}
      />

      {/* Empty State with Action */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-card border rounded-lg shadow-sm p-8 text-center">
          <div className="p-4 bg-orange-100 dark:bg-orange-900/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <MessageSquareWarning className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          </div>
          <h2 className="text-lg font-semibold mb-2">{t('complaints.new.heading')}</h2>
          <p className="text-muted-foreground mb-6">
            {t('complaints.new.description')}
          </p>
          <div className="flex items-center justify-center gap-3">
            <DxButton
              text={t('complaints.actions.backToList')}
              icon="arrowleft"
              onClick={() => router.push('/gmp/complaints')}
              stylingMode="outlined"
            />
            <DxButton
              text={t('complaints.actions.openForm')}
              icon="add"
              onClick={() => setDialogVisible(true)}
              type="default"
            />
          </div>
        </div>
      </div>

      {/* Complaint Data Entry Dialog */}
      <ComplaintDataEntryDialog
        visible={dialogVisible}
        onClose={handleClose}
        onSaved={handleSaved}
        mode="create"
      />
    </div>
  );
}
