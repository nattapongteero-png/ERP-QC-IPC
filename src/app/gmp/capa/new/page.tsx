'use client';

/**
 * New CAPA Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * Page for creating a new CAPA.
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { CapaForm } from '@/components/capa';
import { ResponsivePageHeader } from '@/components/shared';
import type { Capa } from '@/types/capa';

export default function NewCapaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check if creating from deviation
  const deviationId = searchParams.get('deviationId');
  const deviationNumber = searchParams.get('deviationNumber');

  const handleSave = (capa: Capa) => {
    // Redirect to the new CAPA's detail page
    router.push(`/gmp/capa/${capa.id}`);
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title={deviationId ? 'Create CAPA from Deviation' : 'Create New CAPA'}
        subtitle={deviationId ? `Linked to ${deviationNumber}` : 'Create a new Corrective/Preventive Action'}
        onBack={() => router.push('/gmp/capa')}
      />

      {/* Form */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-card border rounded-lg shadow-sm">
          <CapaForm
            deviationId={deviationId ? parseInt(deviationId, 10) : undefined}
            deviationNumber={deviationNumber || undefined}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );
}
