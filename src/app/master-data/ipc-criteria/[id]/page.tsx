'use client';

import { use } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { IPCCriteriaForm } from '@/components/master-data/IPCCriteriaForm';

export default function EditIPCCriteriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <MainLayout>
      <IPCCriteriaForm mode="edit" id={Number(id)} />
    </MainLayout>
  );
}
