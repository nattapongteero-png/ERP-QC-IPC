'use client';

import { use } from 'react';
import { PackagingQCCriteriaForm } from '@/components/master-data';

export default function PackagingQCCriteriaEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <PackagingQCCriteriaForm mode="edit" id={Number(id)} />;
}
