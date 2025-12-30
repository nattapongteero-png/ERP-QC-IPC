/**
 * Bank Statement Edit Page
 * Uses shared BankStatementForm component
 */

'use client';

import { use } from 'react';
import { BankStatementForm } from '@/components/accounting/bank-reconciliation/BankStatementForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default function BankStatementEditPage({ params }: Props) {
  const { id } = use(params);
  const statementId = Number(id);

  return (
    <div className="p-1">
      <BankStatementForm mode="edit" statementId={statementId} />
    </div>
  );
}
