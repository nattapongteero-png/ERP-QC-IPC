/**
 * New Bank Statement Page
 * Uses shared BankStatementForm component
 */

'use client';

import { BankStatementForm } from '@/components/accounting/bank-reconciliation/BankStatementForm';

export default function NewBankStatementPage() {
  return (
    <div className="p-1">
      <BankStatementForm mode="create" />
    </div>
  );
}
