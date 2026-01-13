'use client';

import { use } from 'react';
import { SOPTemplateForm } from '@/components/master-data';

export default function SOPTemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SOPTemplateForm mode="edit" id={Number(id)} />;
}
