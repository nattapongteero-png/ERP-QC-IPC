'use client';

import { use } from 'react';
import { IPCCriteriaForm } from '@/components/master-data/IPCCriteriaForm';

export default function EditIPCCriteriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <IPCCriteriaForm mode="edit" id={Number(id)} />;
}
