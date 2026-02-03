'use client';

/**
 * New Recall Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Page for initiating a new product recall.
 * Uses RecallDataEntryDialog for consistent data entry experience.
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { RecallDataEntryDialog } from '@/components/recalls';
import { ResponsivePageHeader } from '@/components/shared';
import { AlertTriangle } from 'lucide-react';

// Fetch complaint details if linked
async function fetchComplaint(id: number) {
  const response = await fetch(`/api/complaints/${id}`);
  const result = await response.json();
  if (!result.success) return null;
  return result.data;
}

export default function NewRecallPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('gmp');
  const complaintId = searchParams.get('complaintId');
  const [dialogVisible, setDialogVisible] = useState(true);

  // Fetch complaint info if linked
  const { data: complaint } = useQuery({
    queryKey: ['complaint', complaintId],
    queryFn: () => fetchComplaint(parseInt(complaintId!, 10)),
    enabled: !!complaintId,
  });

  // Navigate back if dialog is closed without saving
  const handleClose = () => {
    setDialogVisible(false);
    router.push('/gmp/recalls');
  };

  // Navigate to list after save
  const handleSaved = () => {
    router.push('/gmp/recalls');
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title={t('recalls.new.title')}
        subtitle={t('recalls.new.subtitle')}
        onBack={() => router.push('/gmp/recalls')}
      />

      {/* Warning Banner */}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">
              {t('recalls.new.warningTitle')}
            </p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {t('recalls.new.warningDescription')}
            </p>
          </div>
        </div>
      </div>

      {/* Recall Data Entry Dialog */}
      <RecallDataEntryDialog
        visible={dialogVisible}
        onClose={handleClose}
        onSaved={handleSaved}
        complaintId={complaintId ? parseInt(complaintId, 10) : undefined}
        complaintNumber={complaint?.complaintNumber}
        mode="create"
      />
    </div>
  );
}
