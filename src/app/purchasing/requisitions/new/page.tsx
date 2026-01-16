/**
 * New Purchase Requisition Page (T047)
 * Part of 011-accounting-spec-gap
 */

'use client';

import { PRForm } from '@/components/purchasing/PRForm';

export default function NewPurchaseRequisitionPage() {
  return (
    <div className="p-4">
      <PRForm mode="create" />
    </div>
  );
}
