/**
 * Bank Statement Edit Page
 * Uses shared BankStatementForm component
 */

'use client';

import { use } from 'react';
import { useTranslations } from 'next-intl';
import { BankStatementForm } from '@/components/accounting/bank-reconciliation/BankStatementForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default function BankStatementEditPage({ params }: Props) {
  const t = useTranslations('accounting');
  const { id } = use(params);
  const statementId = Number(id);

  return (
    <div className="p-1" data-title={t('page.title')}>
      <BankStatementForm mode="edit" statementId={statementId} />
    </div>
  );
}
