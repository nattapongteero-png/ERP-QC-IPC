'use client';

import { use } from 'react';
import { StandardWeightForm } from '@/components/master-data';

export default function StandardWeightEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <StandardWeightForm mode="edit" id={Number(id)} />;
}
