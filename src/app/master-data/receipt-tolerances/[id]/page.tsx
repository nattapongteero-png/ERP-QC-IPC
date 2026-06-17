'use client';

import { use } from 'react';
import { ReceiptToleranceForm } from '@/components/master-data';

export default function ReceiptToleranceEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ReceiptToleranceForm mode="edit" id={Number(id)} />;
}
