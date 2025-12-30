/**
 * New Purchase Requisition Page (T047)
 * Part of 011-accounting-spec-gap
 */

'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { PRForm } from '@/components/purchasing/PRForm';

export default function NewPurchaseRequisitionPage() {
  return (
    <MainLayout>
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">
            New Purchase Requisition
          </h1>
          <p className="text-gray-600">
            Create a new purchase requisition for approval
          </p>
        </div>

        <PRForm mode="create" />
      </div>
    </MainLayout>
  );
}
