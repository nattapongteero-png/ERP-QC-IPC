'use client';

/**
 * New Recall Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Page for initiating a new product recall.
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { RecallForm } from '@/components/recalls';
import { ResponsivePageHeader } from '@/components/shared';
import { AlertTriangle } from 'lucide-react';

export default function NewRecallPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const complaintId = searchParams.get('complaintId');

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title="Initiate Product Recall"
        subtitle="Thai FDA GMP หมวด 9 - Recall Initiation"
        onBack={() => router.push('/gmp/recalls')}
      />

      {/* Warning Banner */}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">
              Product Recall Initiation
            </p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              A product recall is a serious action that will notify all affected customers
              and may require regulatory reporting. Ensure you have verified the need for
              a recall before proceeding.
            </p>
          </div>
        </div>
      </div>

      {/* Recall Form */}
      <div className="max-w-2xl">
        <div className="bg-card border rounded-lg shadow-sm">
          <RecallForm
            complaintId={complaintId ? parseInt(complaintId, 10) : undefined}
            onSave={() => router.push('/gmp/recalls')}
            onCancel={() => router.back()}
          />
        </div>
      </div>
    </div>
  );
}
