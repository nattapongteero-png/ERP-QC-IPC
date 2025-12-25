'use client';

/**
 * New CAPA Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * Page for creating a new CAPA using the reusable data entry dialog.
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CapaDataEntryDialog } from '@/components/capa/CapaDataEntryDialog';
import { ResponsivePageHeader } from '@/components/shared';
import type { Capa } from '@/types/capa';

export default function NewCapaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialogVisible, setDialogVisible] = useState(true);

  // Check if creating from deviation
  const deviationId = searchParams.get('deviationId');
  const deviationNumber = searchParams.get('deviationNumber');

  // Check if creating from complaint
  const complaintId = searchParams.get('complaintId');
  const complaintNumber = searchParams.get('complaintNumber');

  // Check if creating from audit finding
  const auditFindingId = searchParams.get('auditFindingId');
  const auditFindingNumber = searchParams.get('auditFindingNumber');

  const handleSaved = (capa: Capa) => {
    // Redirect to the new CAPA's detail page
    router.push(`/gmp/capa/${capa.id}`);
  };

  const handleClose = () => {
    setDialogVisible(false);
    // Navigate back to list
    router.push('/gmp/capa');
  };

  // Determine page title based on source
  const getTitle = () => {
    if (deviationId) return 'Create CAPA from Deviation';
    if (complaintId) return 'Create CAPA from Complaint';
    if (auditFindingId) return 'Create CAPA from Audit Finding';
    return 'Create New CAPA';
  };

  const getSubtitle = () => {
    if (deviationNumber) return `Linked to ${deviationNumber}`;
    if (complaintNumber) return `Linked to ${complaintNumber}`;
    if (auditFindingNumber) return `Linked to ${auditFindingNumber}`;
    return 'Create a new Corrective/Preventive Action';
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title={getTitle()}
        subtitle={getSubtitle()}
        onBack={() => router.push('/gmp/capa')}
      />

      {/* Placeholder content when dialog is visible */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-card border rounded-lg shadow-sm p-8 text-center">
          <p className="text-muted-foreground">
            Use the dialog to create a new CAPA...
          </p>
        </div>
      </div>

      {/* CAPA Data Entry Dialog */}
      <CapaDataEntryDialog
        visible={dialogVisible}
        onClose={handleClose}
        onSaved={handleSaved}
        deviationId={deviationId ? parseInt(deviationId, 10) : undefined}
        deviationNumber={deviationNumber || undefined}
        complaintId={complaintId ? parseInt(complaintId, 10) : undefined}
        complaintNumber={complaintNumber || undefined}
        auditFindingId={auditFindingId ? parseInt(auditFindingId, 10) : undefined}
        auditFindingNumber={auditFindingNumber || undefined}
      />
    </div>
  );
}
