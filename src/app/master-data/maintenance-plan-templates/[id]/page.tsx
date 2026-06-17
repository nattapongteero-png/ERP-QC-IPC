'use client';

import { use } from 'react';
import { MaintenancePlanTemplateForm } from '@/components/master-data';

export default function MaintenancePlanTemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <MaintenancePlanTemplateForm mode="edit" id={Number(id)} />;
}
