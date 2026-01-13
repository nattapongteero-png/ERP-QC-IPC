'use client';

import { use } from 'react';
import { EnvironmentalConditionForm } from '@/components/master-data';

export default function EnvironmentalConditionEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <EnvironmentalConditionForm mode="edit" id={Number(id)} />;
}
