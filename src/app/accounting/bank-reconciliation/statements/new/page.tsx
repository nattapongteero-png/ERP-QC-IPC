/**
 * New Bank Statement Page
 * Uses shared BankStatementForm component
 */

'use client';

import { useTranslations } from 'next-intl';
import { BankStatementForm } from '@/components/accounting/bank-reconciliation/BankStatementForm';

export default function NewBankStatementPage() {
  const t = useTranslations('accounting');
  return (
    <div className="p-1" data-title={t('page.title')}>
      <BankStatementForm mode="create" />
    </div>
  );
}
