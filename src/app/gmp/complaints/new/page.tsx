'use client';

/**
 * New Complaint Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Page for creating a new customer complaint.
 */

import { useRouter } from 'next/navigation';
import { ComplaintForm } from '@/components/complaints';
import { ResponsivePageHeader } from '@/components/shared';
import type { Complaint } from '@/types/complaints';

export default function NewComplaintPage() {
  const router = useRouter();

  const handleSave = (complaint: Complaint) => {
    // Redirect to the new complaint's detail page
    router.push(`/gmp/complaints/${complaint.id}`);
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title="Register New Complaint"
        subtitle="Create a new customer complaint record"
        onBack={() => router.push('/gmp/complaints')}
      />

      {/* Form */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-card border rounded-lg shadow-sm">
          <ComplaintForm
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );
}
