'use client';

import { use } from 'react';
import { PackagingToleranceForm } from '@/components/master-data';

export default function PackagingToleranceEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <PackagingToleranceForm mode="edit" id={Number(id)} />;
}
