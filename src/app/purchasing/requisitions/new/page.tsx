/**
 * New Purchase Requisition Page (T047)
 * Part of 011-accounting-spec-gap
 */

'use client';

import { useTranslations } from 'next-intl';
import { PRForm } from '@/components/purchasing/PRForm';

export default function NewPurchaseRequisitionPage() {
  const t = useTranslations('purchasing');

  return (
    <div className="p-4" data-testid="new-pr-page" aria-label={t('requisitions.newPageTitle')}>
      <PRForm mode="create" />
    </div>
  );
}
