'use client';

import { use } from 'react';
import { SamplingPlanForm } from '@/components/master-data';

export default function SamplingPlanEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SamplingPlanForm mode="edit" id={Number(id)} />;
}
