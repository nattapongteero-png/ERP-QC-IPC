'use client';

/**
 * New Complaint Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Page for creating a new customer complaint using the reusable dialog.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ComplaintDataEntryDialog } from '@/components/complaints';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { MessageSquareWarning } from 'lucide-react';
import type { Complaint } from '@/types/complaints';

export default function NewComplaintPage() {
  const router = useRouter();
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
        title="Register New Complaint"
        subtitle="Create a new customer complaint record"
        icon={MessageSquareWarning}
        iconBgColor="bg-orange-100"
        iconColor="text-orange-600"
        onBack={() => router.push('/gmp/complaints')}
        breadcrumbs={[
          { label: 'GMP', href: '/gmp' },
          { label: 'Complaints', href: '/gmp/complaints' },
          { label: 'New Complaint' },
        ]}
      />

      {/* Empty State with Action */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-card border rounded-lg shadow-sm p-8 text-center">
          <div className="p-4 bg-orange-100 dark:bg-orange-900/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <MessageSquareWarning className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Create a New Complaint</h2>
          <p className="text-muted-foreground mb-6">
            Register a new customer complaint to track and investigate quality issues.
          </p>
          <div className="flex items-center justify-center gap-3">
            <DxButton
              text="Back to List"
              icon="arrowleft"
              onClick={() => router.push('/gmp/complaints')}
              stylingMode="outlined"
            />
            <DxButton
              text="Open Form"
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
