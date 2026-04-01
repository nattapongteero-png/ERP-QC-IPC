'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { IPCCriteriaForm } from '@/components/master-data/IPCCriteriaForm';

export default function NewIPCCriteriaPage() {
  return (
    <MainLayout>
      <IPCCriteriaForm mode="create" />
    </MainLayout>
  );
}
